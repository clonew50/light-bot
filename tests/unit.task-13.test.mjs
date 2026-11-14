/**
 * tests/unit.task-13.test.mjs — todo 13:
 * "Make the database durable and its state shapes real"
 * ==========================================================================================
 * GAP-22 / GAP-6(DB shape) / GAP-7(counters):
 *   - `global.db.data` was never created: the `get` trap returned `target[prop]`
 *     (undefined), so every XP award in plugins/game/* and every agent setting
 *     write went into a throwaway object and was silently lost.
 *   - the top-level `set` trap returned `false` for `groups` / `users`, which is a
 *     TypeError in ESM strict mode; the nested set traps already save nested
 *     writes (guarded here against regressing) and the `@lid` fix (2c8f90f) stays.
 *   - three separate warning counters (warning.js / anti-badword.js / مانع الحالات)
 *     now share one DB-backed counter keyed by chat + user.
 *
 * Every case asserts a VALUE — file content, return value, counter — never a log.
 * The Arabic literals are \u escapes on purpose (shell locale is not utf-8).
 * Writes are awaited by polling the file (never a fixed sleep): the suite runs
 * inside the aggregate where timers can be delayed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const { default: UltraDB } = await import(pathToFileURL(path.join(repoRoot, 'system', 'UltraDB.js')).href);
const warnMod = await import(pathToFileURL(path.join(repoRoot, 'system', 'warnings.js')).href);
const { default: banHandler, isBanned } = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'owner', 'ban.js')).href);
const { default: atuo } = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'auto', 'atuo.js')).href);
const sportModule = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'game', 'sport.js')).href);
const sportBefore = sportModule.default.before;
const { default: antiBadword } = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'auto', 'anti-badword.js')).href);
const { setGroupFlag } = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'admins', 'setting.js')).href);

const ARABIC_GROUP_ERR = '\u274c [DB] \u0645\u0639\u0631\u0651\u0641 \u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d';
const ARABIC_ROOT_ERR = '\u0645\u0645\u0646\u0648\u0639 \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u062c\u0630\u0631';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** poll until the condition holds (or the budget runs out) */
async function waitFor(fn, ms = 5000) {
  const t0 = Date.now();
  for (;;) {
    let ok = false;
    try { ok = !!fn(); } catch { ok = false; }
    if (ok) return true;
    if (Date.now() - t0 > ms) return false;
    await sleep(25);
  }
}

/* ------------------------------------------------------------------ *
 * harness: a real UltraDB pointed at a temp file (never system/database.json)
 * ------------------------------------------------------------------ */
function withDb(tag, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), `task13-${tag}-`));
  const file = path.join(dir, 'database.json');
  const prevEnv = process.env.LIGHTBOT_DB_FILE;
  const prevDb = global.db;
  process.env.LIGHTBOT_DB_FILE = file;
  const db = new UltraDB();
  global.db = db;
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  const restore = () => {
    if (prevEnv === undefined) delete process.env.LIGHTBOT_DB_FILE; else process.env.LIGHTBOT_DB_FILE = prevEnv;
    if (prevDb === undefined) delete global.db; else global.db = prevDb;
  };
  return (async () => {
    try {
      await fn({ db, file, dir, read });
    } finally {
      try { db.flush(); } catch { /* ignore */ }
      await sleep(120);            // let any in-flight async write settle
      restore();
      rmSync(dir, { recursive: true, force: true });
    }
  })();
}

/* ------------------------------------------------------------------ *
 * 1. the grouped traps already save nested writes — guard it
 * ------------------------------------------------------------------ */
test('nested write persists (users[x].xp after the 50ms debounce)', () => withDb('nested', async ({ read }) => {
  global.db.users['x@lid'].xp = 5;
  global.db.users['x@lid'].cookies = 7;
  assert.equal(await waitFor(() => read().users['x@lid']?.xp === 5 && read().users['x@lid']?.cookies === 7), true);
}));

test('nested write persists (groups[chat].antiLink after the debounce)', () => withDb('nested-group', async ({ read }) => {
  global.db.groups['123@g.us'].antiLink = true;
  assert.equal(await waitFor(() => read().groups['123@g.us']?.antiLink === true), true);
}));

/* ------------------------------------------------------------------ *
 * 2. the real defect: the `data` root
 * ------------------------------------------------------------------ */
test('data root exists (global.db.data.users is an object and persists)', () => withDb('data', async ({ read, file }) => {
  const data = global.db.data;
  assert.equal(typeof data, 'object');
  assert.ok(data);
  assert.equal(typeof data.users, 'object');          // created on first access

  data.agent = { settings: { nvidiaKey: 'k' } };      // nested write under the root
  assert.equal(await waitFor(() => read().data?.agent?.settings?.nvidiaKey === 'k'), true);

  // and it is a *real* persisted object, not a throwaway: a fresh load sees it
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).data.agent.settings, { nvidiaKey: 'k' });
}));

test('data root created on first access is written even with no other change', () => withDb('data-lazy', async ({ read }) => {
  const d = global.db.data;                 // first access creates it
  assert.equal(typeof d, 'object');
  assert.equal(await waitFor(() => read().data && typeof read().data === 'object'), true, 'data root must be persisted');
}));

/* ------------------------------------------------------------------ *
 * 3. the `@lid` fix from 2c8f90f must not regress
 * ------------------------------------------------------------------ */
test('@lid ids are valid, junk ids throw the Arabic error, empty object creates', () => withDb('lid', async ({ read, db }) => {
  global.db.users['999@lid'] = {};                    // empty object CREATES a record
  assert.equal(await waitFor(() => read().users['999@lid'] !== undefined), true);
  assert.deepEqual(read().users['999@lid'], {});
  assert.ok(global.db.users['999@lid']);

  global.db.users['999@lid'].cookies = 4;
  global.db.users['999@lid'].xp = 3;                  // and the created record is writable
  assert.equal(await waitFor(() => read().users['999@lid']?.xp === 3), true);

  // delete-on-falsy semantics stay: 0 removes the key
  global.db.users['999@lid'].xp = 0;
  assert.equal(await waitFor(() => read().users['999@lid']?.xp === undefined), true);
  assert.equal(read().users['999@lid'].cookies, 4);

  assert.throws(() => { global.db.users['bad id'] = {}; }, /\u0645\u0639\u0631\u0651\u0641 \u0645\u0633\u062a\u062e\u062f\u0645 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d/);
  assert.throws(() => { global.db.groups['bad id'] = {}; }, (e) => e.message.includes(ARABIC_GROUP_ERR));
  assert.throws(() => { global.db.groups['bad id'].x = true; }, (e) => e.message.includes(ARABIC_GROUP_ERR));
  assert.throws(() => { global.db.users['@newsletter'] = {}; }, /\u0645\u0639\u0631\u0651\u0641 \u0645\u0633\u062a\u062e\u062f\u0645 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d/);

  // reading alone must not create an entry (no file pollution)
  void global.db.users['ghost@lid'];
  db.flush();
  assert.equal('ghost@lid' in read().users, false);
}));

/* ------------------------------------------------------------------ *
 * 4. the top-level set trap must throw, not return falsish
 * ------------------------------------------------------------------ */
test('top-level set on groups/users throws the Arabic error instead of returning false', () => withDb('root-set', async ({ read, file }) => {
  assert.throws(() => { global.db.groups = {}; }, (e) => e.message.includes(ARABIC_ROOT_ERR));
  assert.throws(() => { global.db.users = {}; }, (e) => e.message.includes(ARABIC_ROOT_ERR));
  // a normal root key still works and persists
  global.db.dev = true;
  global.db.flush();
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).dev, true);
  assert.equal(read().dev, true);
}));

/* ------------------------------------------------------------------ *
 * 5. guarded setting write (the plugin call site)
 * ------------------------------------------------------------------ */
test('guarded setting write: invalid id -> false (no crash), valid id -> persisted', () => withDb('setting', async ({ read }) => {
  // the DB itself throws the clear Arabic error for a rejected id
  assert.throws(() => { global.db.groups['bad id'].x = true; }, (e) => e.message.includes(ARABIC_GROUP_ERR));

  // the plugin guard swallows it and reports failure
  assert.equal(setGroupFlag('bad id', 'antiLink', true), false);

  const chat = '123456789@g.us';
  assert.equal(setGroupFlag(chat, 'antiLink', true), true);
  assert.equal(setGroupFlag(chat, 'adminOnly', true), true);
  assert.equal(await waitFor(() => read().groups[chat]?.antiLink === true && read().groups[chat]?.adminOnly === true), true);
}));

/* ------------------------------------------------------------------ *
 * 6. durability: debounce coalesces, nothing is rewritten when nothing changed
 * ------------------------------------------------------------------ */
test('writes coalesce: three mutations in one debounce window = one file write', () => withDb('coalesce', async ({ db }) => {
  global.db.users['a@lid'].xp = 1;
  const before = db.writeCount;
  global.db.users['a@lid'].xp = 1;
  global.db.users['a@lid'].level = 2;
  global.db.users['b@lid'].xp = 3;
  assert.equal(await waitFor(() => db.writeCount >= before + 1), true);
  await sleep(400);
  assert.equal(db.writeCount, before + 1, 'one write for the whole batch');
}));

test('no rewrite when nothing changed', () => withDb('no-rewrite', async ({ db, file }) => {
  global.db.users['a@lid'].xp = 1;
  assert.equal(await waitFor(() => db.writeCount >= 1 && existsSync(file)), true);
  const mtime1 = statSync(file).mtimeMs;
  const count1 = db.writeCount;
  await sleep(200);
  db.flush();
  await sleep(50);
  assert.equal(db.writeCount, count1, 'flush with no dirty state must not write');
  assert.equal(statSync(file).mtimeMs, mtime1);
}));

/* ------------------------------------------------------------------ *
 * 7. the ban is a real record now (owner/ban.js)
 * ------------------------------------------------------------------ */
test('ban records: a ban stores a dated record, the check reads it, unban clears it', () => withDb('ban', async () => {
  const sender = '111@lid';
  const jid = '222@s.whatsapp.net';
  const sent = [];
  const conn = { user: { jid: 'bot@s.whatsapp.net' }, isSubBot: false, sendMessage: async (chat, payload) => { sent.push(payload); return {}; } };
  const m = {
    chat: 'chat@g.us', sender: 'owner@s.whatsapp.net',
    mentionedJid: [sender], text: 'باند',
    lid2jid: async () => jid, reply: (t) => sent.push({ text: t })
  };

  await banHandler(m, { conn, text: '', command: 'حظر' });

  const rec = global.db.users[jid];
  assert.equal(typeof rec.banned, 'object');
  assert.ok(rec.banned.at && !Number.isNaN(Date.parse(rec.banned.at)), 'ban record carries a timestamp');
  assert.equal(rec.banned.by, 'owner@s.whatsapp.net');
  assert.equal(isBanned(rec), true);
  assert.equal(isBanned({ banned: true }), true, 'legacy boolean bans still read as banned');

  // the gate that actually enforces the ban reads the same record
  const blocked = await atuo({ chat: 'chat@g.us', sender: jid, isGroup: true, isOwner: false, key: {} }, { conn, bot: { isSubBot: false } });
  assert.equal(blocked, true);

  // persisted
  global.db.flush();
  assert.equal(JSON.parse(readFileSync(global.db.file, 'utf8')).users[jid].banned.at, rec.banned.at);

  // unban
  await banHandler(m, { conn, text: '', command: 'فك_حظر' });
  assert.equal(isBanned(global.db.users[jid]), false);
  assert.equal('banned' in global.db.users[jid], false);
}));

/* ------------------------------------------------------------------ *
 * 8. one warning counter, shared by all three call sites
 * ------------------------------------------------------------------ */
test('unified counter: same number from warn / badword / status-blocker and it persists', () => withDb('warn', async ({ read }) => {
  const chat = '123@g.us';
  const user = '555@s.whatsapp.net';

  assert.equal(warnMod.getWarnings(chat, user), 0);
  assert.equal(warnMod.addWarning(chat, user, { by: 'warn' }), 1);
  assert.equal(warnMod.addWarning(chat, user, { by: 'anti-badword' }), 2);
  assert.equal(warnMod.addWarning(chat, user, { by: 'status-blocker' }), 3);
  assert.equal(warnMod.getWarnings(chat, user), 3);
  assert.equal(warnMod.removeWarning(chat, user), 2);
  assert.equal(warnMod.getWarnings(chat, user), 2);
  warnMod.resetWarnings(chat, user);
  assert.equal(warnMod.getWarnings(chat, user), 0);

  // the anti-badword call site really uses the shared counter (not its own map)
  global.db.groups[chat].antiBadWords = true;
  const conn = { sendMessage: async () => ({}) };
  const m = {
    chat, sender: user, text: 'كسمك', isGroup: true, isOwner: false,
    key: { fromMe: false, id: 'm1' }
  };
  const handled = await antiBadword(m, { conn, isAdmin: false, bot: null });
  assert.equal(handled, true);
  assert.equal(warnMod.getWarnings(chat, user), 1, 'the badword path increments the shared counter');

  assert.equal(await waitFor(() => read().groups[chat]?.warnings?.[user] === 1), true);
}));

/* ------------------------------------------------------------------ *
 * 9. XP awards land in the canonical users root
 * ------------------------------------------------------------------ */
test('XP award persists in global.db.users (not the dead db.data.users path)', () => withDb('xp', async ({ read }) => {
  const chat = '123@g.us';
  const sender = '777@s.whatsapp.net';
  const conn = { sendMessage: async () => ({}), reply: async () => ({}) };

  // the data root is real (created on first access) — the dead db.data.users
  // path must NOT receive the award; the canonical global.db.users must.
  assert.equal(typeof global.db.data.users, 'object');

  global.gameKora = { [chat]: { current: { answer: 'ميسي', opts: ['ميسي'], caption: 'q', id: 'mid', timer: 0 } } };
  const m = { chat, sender, text: 'ميسي', quoted: { id: 'mid' }, react: async () => ({}) };

  const handled = await sportBefore(m, { conn });
  assert.equal(handled, true);
  assert.equal(global.db.users[sender].xp, 500);
  assert.equal(global.db.users[sender].cookies, 10);
  // the award must NOT land in the throwaway data.users box
  assert.equal(global.db.data.users[sender], undefined);

  assert.equal(await waitFor(() => read().users[sender]?.xp === 500 && read().users[sender]?.cookies === 10), true);
}));

/* ------------------------------------------------------------------ *
 * 10. the existing roots are not lost
 * ------------------------------------------------------------------ */
test('users / groups / dev roots survive a load+write cycle', () => withDb('roots', async ({ file }) => {
  global.db.users['keep@s.whatsapp.net'] = { xp: 9 };
  global.db.groups['keep@g.us'] = { antiLink: true };
  global.db.dev = true;
  assert.equal(await waitFor(() => {
    const d = JSON.parse(readFileSync(file, 'utf8'));
    return d.users['keep@s.whatsapp.net']?.xp === 9 && d.groups['keep@g.us']?.antiLink === true && d.dev === true;
  }), true);
}));

test('a corrupt database file does not lose the other roots', () => withDb('corrupt', async ({ file, read }) => {
  // a fresh instance on the same file with a corrupt payload must keep groups/users
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, '{ not json');
  const prev = global.db;
  const prevEnv = process.env.LIGHTBOT_DB_FILE;
  process.env.LIGHTBOT_DB_FILE = file;
  global.db = new UltraDB();
  try {
    assert.equal(Object.keys(global.db.groups).length, 0);
    global.db.users['ok@s.whatsapp.net'] = { xp: 1 };
    global.db.flush();
    assert.equal(await waitFor(() => read().users['ok@s.whatsapp.net']?.xp === 1), true);
    assert.equal(typeof read().groups, 'object');
    assert.equal(typeof read().data, 'object');
  } finally {
    if (prevEnv === undefined) delete process.env.LIGHTBOT_DB_FILE; else process.env.LIGHTBOT_DB_FILE = prevEnv;
    if (prev === undefined) delete global.db; else global.db = prev;
  }
}));