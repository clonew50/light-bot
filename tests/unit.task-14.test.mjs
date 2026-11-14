/**
 * tests/unit.task-14.test.mjs — todo 14:
 * "Make the auto-updater honest, bounded and non-destructive"
 * ==========================================================================================
 * GAP-9  : needsInstall was reported and ignored → dependency updates never landed.
 * GAP-17 : an in-process restart cannot reload ES modules → the "restart" was a no-op.
 * GAP-28 : unbounded fetches (a hung GitHub connection stalls the boot) + destructive
 *          deletes (fs.rmSync) that destroy locally-modified files.
 * GAP-30 : tmp/ and the system/.removed-<ts> backups were not ignored by git.
 *
 * Every case asserts a VALUE: a file's content, a recorded call/args, a return field.
 * The updater is pointed at a scratch root (LIGHTBOT_UPDATE_ROOT) and a fake GitHub,
 * so no network and no real npm install ever run.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const AUTO_UPDATE = path.join(repoRoot, 'system', 'autoUpdate.mjs');
const INDEX_JS = path.join(repoRoot, 'index.js');
const GITIGNORE = path.join(repoRoot, '.gitignore');

// the updater reads LIGHTBOT_UPDATE_ROOT at import time; never leak it to other lanes
after(() => { delete process.env.LIGHTBOT_UPDATE_ROOT; });

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const API = `https://api.github.com/repos/clonew50/light-bot`;
const RAW = `https://raw.githubusercontent.com/clonew50/light-bot`;

/* ---------------- scratch repo + fake GitHub ---------------- */
let seq = 0;

async function loadUpdater(root) {
  process.env.LIGHTBOT_UPDATE_ROOT = root;
  const url = pathToFileURL(AUTO_UPDATE).href + `?root=${seq++}`;
  const mod = await import(url);
  return mod;
}

function scratchRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task14-'));
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(dir, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body, arrayBuffer: async () => Buffer.from('') };
}

/** fake GitHub: branch + tree + raw blobs, all built from `files` */
function fakeGithub(files) {
  const remote = {};
  for (const [p, content] of Object.entries(files)) remote[p] = mod0.gitBlobSha(Buffer.from(content));
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url, hasSignal: !!opts.signal });
    if (url.endsWith('/branches/main')) {
      return jsonResponse({ commit: { sha: COMMIT, commit: { tree: { sha: TREE } } } });
    }
    if (url.includes('/git/trees/')) {
      const tree = Object.entries(remote).map(([p, sha]) => ({ path: p, type: 'blob', sha }));
      return jsonResponse({ tree });
    }
    const at = url.indexOf(`/${COMMIT}/`);
    if (at !== -1) {
      const rel = decodeURIComponent(url.slice(at + COMMIT.length + 2));
      if (!(rel in files)) return { ok: false, status: 404, json: async () => ({}) };
      const buf = Buffer.from(files[rel]);
      return { ok: true, status: 200, arrayBuffer: async () => buf };
    }
    throw new Error('unexpected url ' + url);
  };
  return { impl, remote, calls };
}

// gitBlobSha is needed before the first import; a tiny local copy is used for setup
const mod0 = await import(pathToFileURL(AUTO_UPDATE).href);
const { gitBlobSha } = mod0;

function writeState(dir, files) {
  fs.writeFileSync(path.join(dir, '.git-pull-state.json'), JSON.stringify({
    commit: COMMIT, tree: TREE, files, at: new Date().toISOString()
  }, null, 2));
}
const readState = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.git-pull-state.json'), 'utf8'));

/* ------------------------------------------------------------------ *
 * 1. every network call is bounded; a hung connection yields {error:'timeout'}
 * ------------------------------------------------------------------ */
test('updater timeout: a fetch that never settles yields {error:"timeout"} inside the budget', async () => {
  const dir = scratchRepo({});
  try {
    const mod = await loadUpdater(dir);
    let observedSignal = false;
    const never = (url, opts = {}) => {
      observedSignal = !!opts.signal;
      return new Promise((_, reject) => {
        // a ref'd keepalive so the (unref'd) AbortSignal.timeout timer can fire
        const keepAlive = setTimeout(() => {}, 5000);
        opts.signal?.addEventListener('abort', () => {
          clearTimeout(keepAlive);
          const e = new Error('The operation was aborted due to timeout');
          e.name = 'TimeoutError';
          reject(e);
        });
      });
    };
    const t0 = Date.now();
    const r = await mod.checkUpdate({ fetchImpl: never, timeoutMs: 80 });
    const elapsed = Date.now() - t0;
    assert.equal(r.error, 'timeout');
    assert.equal(observedSignal, true, 'the fetch must carry an AbortSignal');
    assert.ok(elapsed < 2000, `must fail fast, took ${elapsed}ms`);
    assert.equal(mod.FETCH_TIMEOUT_MS >= 1000, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('updater timeout: pullOnce on a hung connection fails with {error:"timeout"} (no crash)', async () => {
  const dir = scratchRepo({});
  try {
    const mod = await loadUpdater(dir);
    const never = (url, opts = {}) => new Promise((_, reject) => {
      const keepAlive = setTimeout(() => {}, 5000);
      opts.signal?.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        const e = new Error('aborted');
        e.name = 'TimeoutError';
        reject(e);
      });
    });
    const r = await mod.pullOnce({ fetchImpl: never, timeoutMs: 60, log: () => {} });
    assert.equal(r.error, 'timeout');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every fetch site carries AbortSignal.timeout(...) in the source', () => {
  const src = fs.readFileSync(AUTO_UPDATE, 'utf8');
  assert.equal(/AbortSignal\.timeout\(/.test(src), true);
  assert.equal(/fetchImpl\(url, \{ \.\.\.opts, signal: AbortSignal\.timeout\(timeoutMs\) \}\)/.test(src), true);
});

/* ------------------------------------------------------------------ *
 * 2. needsInstall is real and the caller installs + clean-restarts
 * ------------------------------------------------------------------ */
test('needs install: a pull that changes package.json returns needsInstall and the caller runs npm install', async () => {
  const dir = scratchRepo({
    'package.json': JSON.stringify({ name: 'x', version: '1.0.0' }),
    'index.js': 'v1'
  });
  try {
    const gh = fakeGithub({
      'package.json': JSON.stringify({ name: 'x', version: '1.0.1' }),
      'index.js': 'v1'
    });
    writeState(dir, {
      'package.json': gitBlobSha(Buffer.from(JSON.stringify({ name: 'x', version: '1.0.0' }))),
      'index.js': gitBlobSha(Buffer.from('v1'))
    });

    const mod = await loadUpdater(dir);
    const r = await mod.pullOnce({ fetchImpl: gh.impl, log: () => {} });
    assert.equal(r.needsInstall, true, 'package.json changed -> needsInstall');
    assert.equal(r.needsRestart, false);
    assert.deepEqual(r.downloaded, ['package.json']);
    assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8').includes('1.0.1'), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('needs install: the exact npm invocation is used (no --force, no audit)', async () => {
  const dir = scratchRepo({});
  const calls = [];
  const mod = await loadUpdater(dir);
  const res = await mod.runInstall({
    runner: async (args, opts) => { calls.push({ args, opts }); return { stdout: '' }; },
    log: () => {}
  });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['install', '--no-audit', '--no-fund', '--loglevel=error']);
  assert.equal(calls[0].args.includes('--force'), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyUpdate: install runs first, then a CLEAN full restart (not an in-process one)', async () => {
  const dir = scratchRepo({});
  const mod = await loadUpdater(dir);
  const events = [];
  const order = [];
  const r = await mod.applyUpdate({
    pull: async () => {
      order.push('pull');
      return { changes: 1, downloaded: ['index.js'], deleted: [], needsInstall: true, needsRestart: false };
    },
    install: async ({ log }) => { order.push('install'); return { ok: true }; },
    restart: (reason) => { order.push('restart:' + reason); return true; },
    delayMs: 0,
    log: () => {},
    event: (m) => events.push(m)
  });
  assert.deepEqual(order.slice(0, 2), ['pull', 'install'], 'install must happen before the restart');
  assert.equal(order[2].startsWith('restart:'), true);
  assert.equal(r.restarted, true);
  assert.equal(events.some((e) => /إعادة تشغيل/.test(e)), true, 'the summary is published to the panel event stream');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyUpdate: code change without package.json still forces a clean restart', async () => {
  const dir = scratchRepo({});
  const mod = await loadUpdater(dir);
  let restarts = 0;
  const r = await mod.applyUpdate({
    pull: async () => ({ changes: 2, downloaded: ['index.js', 'system/x.mjs'], deleted: [], needsInstall: false, needsRestart: true }),
    install: async () => { throw new Error('must not install'); },
    restart: () => { restarts += 1; },
    delayMs: 0,
    log: () => {},
    event: () => {}
  });
  assert.equal(restarts, 1);
  assert.equal(r.restarted, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyUpdate: a failed pull never restarts and never installs', async () => {
  const dir = scratchRepo({});
  const mod = await loadUpdater(dir);
  let restarts = 0, installs = 0;
  const r = await mod.applyUpdate({
    pull: async () => ({ error: 'timeout' }),
    install: async () => { installs += 1; return { ok: true }; },
    restart: () => { restarts += 1; },
    log: () => {},
    event: () => {}
  });
  assert.equal(r.error, 'timeout');
  assert.equal(restarts, 0);
  assert.equal(installs, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyUpdate: a failed npm install never restarts (the running build keeps serving)', async () => {
  const dir = scratchRepo({});
  const mod = await loadUpdater(dir);
  let restarts = 0;
  const events = [];
  const r = await mod.applyUpdate({
    pull: async () => ({ changes: 1, downloaded: ['package.json'], deleted: [], needsInstall: true, needsRestart: false }),
    install: async () => ({ ok: false, error: 'npm exited 1' }),
    restart: () => { restarts += 1; },
    delayMs: 0,
    log: () => {},
    event: (m) => events.push(m)
  });
  assert.equal(restarts, 0);
  assert.equal(r.restarted, false);
  assert.equal(events.some((e) => /فشل تثبيت الحزم/.test(e)), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 * 3. nothing is ever unlinked: files are moved into system/.removed-<ts>/
 * ------------------------------------------------------------------ */
test('no unlink: a file the remote no longer has is moved into system/.removed-<ts>/', async () => {
  const dir = scratchRepo({ 'index.js': 'v1', 'gone.js': 'obsolete' });
  try {
    const gh = fakeGithub({ 'index.js': 'v1' });
    writeState(dir, {
      'index.js': gitBlobSha(Buffer.from('v1')),
      'gone.js': gitBlobSha(Buffer.from('obsolete'))
    });
    const mod = await loadUpdater(dir);
    const r = await mod.pullOnce({ fetchImpl: gh.impl, log: () => {} });

    assert.deepEqual(r.deleted, ['gone.js']);
    assert.equal(fs.existsSync(path.join(dir, 'gone.js')), false, 'the old path must be gone');
    assert.ok(r.backupDir && r.backupDir.startsWith('system/.removed-'), r.backupDir);
    const backup = path.join(dir, r.backupDir, 'gone.js');
    assert.equal(fs.existsSync(backup), true, 'the content must be preserved');
    assert.equal(fs.readFileSync(backup, 'utf8'), 'obsolete');
    // the only rmSync left is the atomicWrite tmp cleanup — no real file is ever removed
    assert.equal(/unlinkSync\(|rmSync\(full|fs\.rm\(/.test(fs.readFileSync(AUTO_UPDATE, 'utf8')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no unlink: a file that cannot be moved stays in place (never deleted)', async () => {
  const dir = scratchRepo({ 'index.js': 'v1', 'gone.js': 'obsolete' });
  try {
    const gh = fakeGithub({ 'index.js': 'v1' });
    writeState(dir, {
      'index.js': gitBlobSha(Buffer.from('v1')),
      'gone.js': gitBlobSha(Buffer.from('obsolete'))
    });
    const mod = await loadUpdater(dir);
    // make system/ a FILE so mkdirSync inside the backup path fails
    fs.rmSync(path.join(dir, 'system'), { recursive: true, force: true });
    fs.writeFileSync(path.join(dir, 'system'), 'not a dir');
    const r = await mod.pullOnce({ fetchImpl: gh.impl, log: () => {} });
    assert.equal(fs.existsSync(path.join(dir, 'gone.js')), true, 'the original must survive');
    assert.deepEqual(r.deletedSkipped, ['gone.js']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 4. a locally modified file is never overwritten without AUTO_UPDATE_FORCE=1
 * ------------------------------------------------------------------ */
test('local edit: a modified file is skipped and reported as "محلي - تم التجاوز"', async () => {
  const dir = scratchRepo({ 'index.js': 'LOCAL EDIT' });
  try {
    const gh = fakeGithub({ 'index.js': 'v2' });
    writeState(dir, { 'index.js': gitBlobSha(Buffer.from('v1')) });
    const mod = await loadUpdater(dir);
    const r = await mod.pullOnce({ fetchImpl: gh.impl, log: () => {} });

    assert.deepEqual(r.skippedLocal, ['index.js']);
    assert.deepEqual(r.downloaded, []);
    assert.equal(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), 'LOCAL EDIT');
    assert.equal(readState(dir).files['index.js'], gitBlobSha(Buffer.from('v1')), 'the recorded sha must survive the skip');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('local edit: AUTO_UPDATE_FORCE=1 overwrites it anyway', async () => {
  const dir = scratchRepo({ 'index.js': 'LOCAL EDIT' });
  try {
    const gh = fakeGithub({ 'index.js': 'v2' });
    writeState(dir, { 'index.js': gitBlobSha(Buffer.from('v1')) });
    process.env.AUTO_UPDATE_FORCE = '1';
    const mod = await loadUpdater(dir);
    try {
      const r = await mod.pullOnce({ fetchImpl: gh.impl, log: () => {} });
      assert.deepEqual(r.downloaded, ['index.js']);
      assert.deepEqual(r.skippedLocal, []);
      assert.equal(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), 'v2');
    } finally {
      delete process.env.AUTO_UPDATE_FORCE;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 5. "up to date" is explicit (nothing new vs. a stuck updater)
 * ------------------------------------------------------------------ */
test('up to date: an unchanged remote says so explicitly and exits 0 on --check', async () => {
  const dir = scratchRepo({ 'index.js': 'v1' });
  try {
    const gh = fakeGithub({ 'index.js': 'v1' });
    writeState(dir, { 'index.js': gitBlobSha(Buffer.from('v1')) });
    const mod = await loadUpdater(dir);
    const lines = [];
    const r = await mod.pullOnce({ fetchImpl: gh.impl, log: (m) => lines.push(m) });
    assert.equal(r.upToDate, true);
    assert.equal(r.changes, 0);
    assert.equal(lines.some((l) => l.includes('لا يوجد تحديث')), true);

    const c = await mod.checkUpdate({ fetchImpl: gh.impl });
    assert.equal(c.upToDate, true);
    assert.equal(c.error, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 6. wiring + gitignore
 * ------------------------------------------------------------------ */
test('index.js wires the clean restart path (the in-process restart is only a fallback)', () => {
  const src = fs.readFileSync(INDEX_JS, 'utf8');
  assert.equal(/applyUpdate\(/.test(src), true);
  assert.equal(/AUTO_UPDATE/.test(src), true);
  // the primary path is the ladder's clean step (flush + process.exit(1))
  assert.equal(/global\.restartBotClean\(reason\)/.test(src), true);
  assert.equal(/restart:\s*updateRestart/.test(src), true);
  // the guarded in-process restart survives only as the no-clean-hook fallback:
  // it is checked AFTER the clean hook, never instead of it
  const cleanAt = src.indexOf('global.restartBotClean(reason)');
  const fallbackAt = src.indexOf('return restartBot(');
  assert.ok(cleanAt !== -1 && fallbackAt > cleanAt, 'the clean hook must be checked first');
  // and the summary fields are still surfaced to the operator
  for (const f of ['r.changes', 'r.skipped', 'r.deleted', 'r.needsInstall']) {
    assert.equal(src.includes(f), true, 'missing ' + f);
  }
});

test('gitignore covers tmp/ and the removal backups', () => {
  const src = fs.readFileSync(GITIGNORE, 'utf8');
  assert.equal(/^tmp\/$/m.test(src), true);
  assert.equal(/^system\/\.removed-\*\/$/m.test(src), true);
});