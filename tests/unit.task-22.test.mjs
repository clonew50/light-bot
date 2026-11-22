/**
 * tests/unit.task-22.test.mjs — todo 22: native menu surfaces + plugin metadata
 * ===========================================================================
 * Fake client only (no bot boot, no network). Asserts:
 *   (a) plugins/native/quickmenu.js exports a reusable sendNativeMenu renderer
 *       and `.قائمة` lists every visible category (the `native` section is hidden)
 *   (b) both text menus keep working and offer the native surface
 *   (c) every plugin file that declares a `.command` also declares `.usage`
 *       and `.category` (fails listing the offending file path)
 *   (d) the guard scan: no shipped plugin source contains a group jid,
 *       mmg.whatsapp.net, messageSecret, a foreign sender-key or a foreign
 *       media-key triple
 *   (e) no duplicate command names are introduced
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const pluginDir = path.join(repoRoot, 'plugins');

const load = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);

const quickmenu = await load('plugins/native/quickmenu.js');
const menuModule = (await load('plugins/menu.js')).default;
const menuHandlers = Array.isArray(menuModule) ? menuModule : [menuModule];
const menu2 = (await load('plugins/menu2.js')).default;

/* ── fake client ─────────────────────────────────────────────────────── */
const ALL_COMMANDS = [
  { command: 'صد', usage: ['صد'], category: 'tools' },
  { command: 'صور', usage: ['صور'], category: 'search' },
  { command: 'ايقاف', usage: ['ايقاف'], category: 'owner' },
  { command: 'قائمة', usage: ['قائمة'], category: 'native' },
  { command: 'تجربة', usage: ['تجربة'], category: 'native' },
  { command: 'اختر', usage: ['اختر'], category: 'native' },
  { command: 'عين', usage: ['عين'], category: 'games' }
];

const INFO = {
  nameBot: 'BOT-TEST',
  nameChannel: 'CHAN-TEST',
  supaimg: ['https://i.supaimg.com/own-1.jpg'],
  images: ['https://i.supaimg.com/own-1.jpg'],
  urls: { repo: 'https://github.com/clonew50/light-bot' }
};

function makeConn() {
  const native = [];
  const texts = [];
  const conn = {
    sendButtonNormal: async (chat, payload, quoted) => native.push({ chat, payload, quoted }),
    sendMessage: async (chat, content, opts) => texts.push({ chat, content, opts }),
    relayMessage: async (...a) => { throw new Error('relayMessage must not be used in these tests'); }
  };
  return { conn, native, texts };
}

function makeBot() {
  return {
    config: { info: INFO, prefix: '.' },
    getAllCommands: async () => ALL_COMMANDS.map((c) => ({ ...c }))
  };
}

const makeM = () => ({
  chat: 'test@s.whatsapp.net',
  sender: 'user@s.whatsapp.net',
  reply: async () => {},
  react: async () => {}
});

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** Strip // and /* *\/ comments so explanatory prose never trips the guard scan. */
function stripLineComments(src) {
  let out = '';
  let inStr = null;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  return out;
}

/* ── (a) reusable renderer ───────────────────────────────────────────── */
test('quickmenu exports sendNativeMenu and it lists every visible category', async () => {
  assert.equal(typeof quickmenu.sendNativeMenu, 'function');
  const { conn, native } = makeConn();
  const res = await quickmenu.sendNativeMenu(conn, 'test@s.whatsapp.net', {
    bot: makeBot(), info: INFO, images: INFO.images, quoted: null
  });
  assert.ok(res.sent >= 1);
  // 7 commands across 5 categories, but `native` is hidden => 4 quick_reply buttons
  assert.equal(res.categories, 4);
  assert.equal(native.length, 1);
  const buttons = native[0].payload.buttons;
  assert.equal(buttons.length, 4);
  for (const b of buttons) {
    assert.equal(b.name, 'quick_reply');
    assert.ok(b.params.id.startsWith('.'), `id must be prefixed: ${b.params.id}`);
  }
  const flat = JSON.stringify(buttons);
  assert.doesNotMatch(flat, /native/, 'the native category must be hidden');
  // no visible category lost: tools/search/owner/games all present
  for (const key of ['tools', 'search', 'owner', 'games']) {
    assert.match(flat, new RegExp(key), `category missing: ${key}`);
  }
});

test('quickmenu refuses without the interactive transport', async () => {
  const res = await quickmenu.sendNativeMenu({}, 'test@s.whatsapp.net', { bot: makeBot() });
  assert.deepEqual(res, { sent: 0, categories: 0 });
});

test('.قائمة hides the native category', async () => {
  const { conn, native } = makeConn();
  const m = makeM();
  await quickmenu.default(m, { conn, bot: makeBot(), text: '', args: [], command: 'قائمة', usedPrefix: '.' });
  assert.ok(native.length >= 1);
  const flat = JSON.stringify(native[0].payload.buttons);
  assert.doesNotMatch(flat, /native/, 'the native category must not be listed');
});

/* ── (b) text menus keep working ─────────────────────────────────────── */
test('menu2 zero-arg still sends its own single_select/cta/quick_reply surface', async () => {
  const { conn, native, texts } = makeConn();
  const m = makeM();
  await menu2(m, { conn, bot: makeBot(), command: 'menu', args: [] });
  assert.equal(texts.length, 0, 'text fallback must not be used when the native path works');
  assert.ok(native.length >= 1);
  const names = native.flatMap((n) => n.payload.buttons.map((b) => b.name));
  for (const n of ['single_select', 'cta_url', 'quick_reply']) {
    assert.ok(names.includes(n), `menu2 lost its ${n} button`);
  }
  const ids = native.flatMap((n) => n.payload.buttons.map((b) => b.params.id || ''));
  assert.ok(ids.some((i) => i === '.قائمة'), 'menu2 must offer the .قائمة native affordance');
});

test('menu (V1) zero-arg sends the native quick-reply surface', async () => {
  const menuV1 = menuHandlers.find((h) => Array.isArray(h.command) && h.command.includes('اوامر1'));
  assert.ok(menuV1, 'menuV1 handler present');
  const { conn, native, texts } = makeConn();
  const m = makeM();
  await menuV1(m, { conn, bot: makeBot(), command: 'اوامر1', args: [] });
  assert.ok(native.length >= 1, 'menuV1 must send the native menu');
  const buttons = native.flatMap((n) => n.payload.buttons);
  assert.ok(buttons.every((b) => b.name === 'quick_reply'));
  assert.doesNotMatch(JSON.stringify(buttons), /native/, 'native category button must be hidden');
  assert.ok(buttons.some((b) => b.params.id === '.قسم tools'), 'tools category button present');
});

/* ── (c) metadata scan ───────────────────────────────────────────────── */
test('every plugin declaring .command also declares .usage and .category', () => {
  const files = walk(pluginDir).filter((p) => p.endsWith('.js'));
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/^\s*[\w$]+\.command\s*=/m.test(src)) continue; // before-handlers / libraries
    if (!/^\s*[\w$]+\.usage\s*=/m.test(src)) offenders.push(`${path.relative(repoRoot, f)}: missing .usage`);
    if (!/^\s*[\w$]+\.category\s*=/m.test(src)) offenders.push(`${path.relative(repoRoot, f)}: missing .category`);
  }
  assert.deepEqual(offenders, [], `metadata gaps:\n${offenders.join('\n')}`);
});

test('dino uses .usage/.category (no .help/.tags leftovers)', () => {
  const src = readFileSync(path.join(pluginDir, 'dino.js'), 'utf8');
  assert.match(src, /^\s*handler\.usage\s*=/m);
  assert.match(src, /^\s*handler\.category\s*=/m);
  assert.doesNotMatch(src, /^\s*handler\.(help|tags)\s*=/m);
});

test('no duplicate command names are introduced (menu / native surface)', async () => {
  const names = [];
  const add = (cmds) => {
    if (Array.isArray(cmds)) names.push(...cmds);
    else if (cmds instanceof RegExp) names.push(cmds.source);
  };
  add(menu2.command);
  add(menuHandlers.find((h) => Array.isArray(h.command))?.command);
  add(quickmenu.default.command);
  add((await load('plugins/native/buttons.js')).default.command);
  add((await load('plugins/native/carousel.js')).default.command);
  add((await load('plugins/native/annotate.js')).default.command);
  add((await load('plugins/native/vanish.js')).default.command);
  add((await load('plugins/native/experimental.js')).default.command);
  // menu2 owns 'menu', menuV1 owns 'اوامر1', quickmenu owns 'قائمة'
  const counts = names.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
  const dupes = Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(dupes, [], `duplicate commands: ${dupes.join(', ')}`);
  assert.ok(names.includes('menu'));
  assert.ok(names.includes('قائمة'));
});

/* ── (d) guard scan ──────────────────────────────────────────────────── */
test('guard scan: no group jid / mmg host / messageSecret / foreign sender-key / media-key triple', () => {
  const files = walk(pluginDir).filter((p) => /\.(js|cjs|mjs)$/.test(p));
  const patterns = [
    { re: /\d{10,}@g\.us/, label: 'group jid <digits>@g.us' },
    { re: /mmg\.whatsapp\.net/, label: 'mmg.whatsapp.net' },
    { re: /messageSecret/, label: 'messageSecret' },
    { re: /axolotlSenderKeyDistributionMessage\s*:\s*\{/, label: 'foreign sender-key struct' }
  ];
  const hits = [];
  for (const f of files) {
    const src = stripLineComments(readFileSync(f, 'utf8'));
    for (const { re, label } of patterns) {
      if (re.test(src)) hits.push(`${path.relative(repoRoot, f)}: ${label}`);
    }
    // A FOREIGN media triple: a single object literal carrying all three keys with
    // literal values (the raw fork capture). A real upload response spread or
    // separate named properties is the bot's own pipeline, not a hardcoded triple.
    const literals = src.match(/[{,]\s*mediaKey\s*:\s*['"`][^'"`]+['"`][^}]*fileSha256\s*:\s*['"`][^'"`]+['"`][^}]*directPath\s*:\s*['"`][^'"`]+['"`]/s)
      || src.match(/[{,]\s*directPath\s*:\s*['"`][^'"`]+['"`][^}]*mediaKey\s*:\s*['"`][^'"`]+['"`][^}]*fileSha256\s*:\s*['"`][^'"`]+['"`]/s);
    if (literals) {
      hits.push(`${path.relative(repoRoot, f)}: hardcoded foreign media triple`);
    }
  }
  assert.deepEqual(hits, [], `guard scan failed:\n${hits.join('\n')}`);
});

test('no plugin uses the legacy conn.sendButton(', () => {
  const files = walk(pluginDir).filter((p) => /\.(js|cjs|mjs)$/.test(p));
  const hits = [];
  for (const f of files) {
    const src = stripLineComments(readFileSync(f, 'utf8'));
    if (/conn\.sendButton\s*\(/.test(src)) hits.push(path.relative(repoRoot, f));
  }
  assert.deepEqual(hits, [], `legacy conn.sendButton( in: ${hits.join(', ')}`);
});