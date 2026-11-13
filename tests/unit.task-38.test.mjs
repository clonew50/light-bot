/**
 * tests/unit.task-38.test.mjs — todo 38: "Make every fatal exit in the bot resumable by the hosting supervisor"
 * ==========================================================================================
 * Hosting contract (todos 2 & 36): a fatal path must exit with a NON-ZERO code so a panel
 * running systemd `Restart=on-failure` / PM2 respawns the bot. `process.exit(0)` tells the
 * supervisor "work finished normally" and leaves the bot dead.
 *
 * Asserted:
 *   - "fatal exit codes": a repo-wide sweep of every `process.exit(<literal>)` in the
 *     shipped tree uses only codes from {0,1}, and the ONLY surviving `process.exit(0)`
 *     sites are the explicitly justified intentional clean shutdowns (each justified in
 *     the evidence file .omo/evidence/task-38-*.txt).
 *   - the update plugin's fallback (plugins/owner/update.js, global.restartBot missing
 *     after an update asks for a restart) flushes the DB FIRST and then exits 1 — never 0.
 *   - the flush happens BEFORE the exit (recorded ordering).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const UPDATE_PLUGIN_PATH = path.join(repoRoot, 'plugins', 'owner', 'update.js');
const LADDER_PATH = path.join(repoRoot, 'system', 'restart-ladder.js');

const { fatalRestartFallback } = await import(pathToFileURL(UPDATE_PLUGIN_PATH).href);
const { FATAL_EXIT_CODE } = await import(pathToFileURL(LADDER_PATH).href);

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

/** walks the shipped tree (no node_modules/.git/.omo/tests) and collects every literal exit code */
function sweepExitCodes() {
  const SKIP_DIRS = new Set(['node_modules', '.git', '.omo', 'tests', 'sub', 'session', 'agent-backups']);
  const SKIP_FILES = new Set(['.git-pull-state.json', 'package-lock.json']);
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') && entry !== '.') continue;
      const abs = path.join(dir, entry);
      const rel = path.relative(repoRoot, abs);
      let st;
      try { st = statSync(abs); } catch { continue; }
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue;
        walk(abs);
      } else if (/\.(js|mjs)$/.test(entry) && !SKIP_FILES.has(entry)) {
        const src = readFileSync(abs, 'utf8');
        src.split('\n').forEach((l, i) => {
          for (const m of l.matchAll(/process\.exit\((\d+)\)/g)) {
            // is the match inside a line comment (code mention, not an executed exit)?
            const before = l.slice(0, m.index);
            const inComment = before.indexOf('//') !== -1;
            found.push({ file: rel, line: i + 1, code: Number(m[1]), inComment, text: l.trim() });
          }
        });
      }
    }
  };
  walk(repoRoot);
  return found;
}

/**
 * The JUSTIFIED survivors of `process.exit(0)` (see .omo/evidence/task-38-*.txt):
 *   - plugins/owner/agent.js — `process.exit(0)` sits inside the TOOL_VM_CHILD_BOOTSTRAP
 *     template string: it is the source of a SHORT-LIVED HELPER CHILD process
 *     (execFileSync) that exits 0 after successfully writing its verdict to stdout.
 *     It is a success exit of a helper child, not a fatal path in the bot process.
 *   - system/sessionBackup.js — installShutdownHandlers exits 0 on SIGTERM/SIGINT only:
 *     the operator asked for a clean stop, the DB is flushed first. A deliberate clean
 *     shutdown must stay 0 (turning it into 1 would make systemd/PM2 log a fake crash).
 *   - system/restart-ladder.js — the injected default `exit = (code) => process.exit(code)`
 *     is parameterised; every actual call passes FATAL_EXIT_CODE = 1 (or the tested 0/1).
 *   - index.js — uncaughtException fatal path exits 1 (todo 2 kept that way).
 */
const JUSTIFIED_EXIT_0 = [
  { file: 'plugins/owner/agent.js', code: 0, why: 'helper child-process bootstrap template: success exit of the vm-gate child' },
  { file: 'system/sessionBackup.js', code: 0, why: 'deliberate clean shutdown on SIGTERM/SIGINT after a DB flush (operator-initiated stop)' },
];

/** comment-only mentions of process.exit(0) — documented here so the raw grep is fully accounted for */
const JUSTIFIED_COMMENT_MENTIONS = [
  { file: 'index.js', why: 'Arabic comment (line ~25) warning that hidden code calling process.exit(0) kills the process instantly — documentation, not an executed exit' },
];

/* ------------------------------------------------------------------ *
 * 1. the repo-wide fatal-exit sweep
 * ------------------------------------------------------------------ */

test('fatal exit codes: every EXECUTED process.exit code in the shipped tree is in {0,1}', () => {
  const found = sweepExitCodes().filter((f) => !f.inComment);
  assert.ok(found.length > 0, 'the sweep must actually find exit sites');
  for (const f of found) {
    assert.ok(
      f.code === 0 || f.code === 1,
      `${f.file}:${f.line} uses process.exit(${f.code}) — only 0 or 1 are allowed`
    );
  }
});

test('fatal exit codes: the only surviving process.exit(0) sites are the justified ones', () => {
  const all = sweepExitCodes();
  // executed code sites
  const zeros = all.filter((f) => f.code === 0 && !f.inComment);
  const allowed = new Map(JUSTIFIED_EXIT_0.map((j) => [j.file, j.why]));
  for (const z of zeros) {
    assert.ok(
      allowed.has(z.file),
      `unjustified process.exit(0) at ${z.file}:${z.line} — a fatal path must exit 1. Seen: ${z.text}`
    );
  }
  const files = new Set(zeros.map((z) => z.file));
  for (const f of files) assert.ok(allowed.get(f), `${f} must be justified in the evidence file`);
  // comment-only mentions are also accounted for (documented in the evidence file)
  const commentMentions = all.filter((f) => f.code === 0 && f.inComment);
  const allowedComments = new Map(JUSTIFIED_COMMENT_MENTIONS.map((j) => [j.file, j.why]));
  for (const c of commentMentions) {
    assert.ok(
      allowedComments.has(c.file),
      `unaccounted process.exit(0) mention in a comment at ${c.file}:${c.line}`
    );
  }
});

test('fatal exit codes: the update plugin fallback no longer exits 0 — it calls the code-1 helper', () => {
  const src = readFileSync(UPDATE_PLUGIN_PATH, 'utf8');
  assert.ok(!src.includes('process.exit(0)'), 'plugins/owner/update.js must never exit 0');
  // the fallback branch (global.restartBot missing) routes into the shared helper
  assert.ok(
    /else\s+void\s+fatalRestartFallback\(\);/.test(src),
    'the needsRestart fallback must call fatalRestartFallback()'
  );
  // and the helper itself exits with the fatal code
  assert.ok(/process\.exit\(1\);/.test(src), 'the fallback helper exits with code 1');
});

test('fatal exit codes: the escalation ladder keeps its fatal code at 1', () => {
  assert.equal(FATAL_EXIT_CODE, 1, 'systemd/PM2 respawn on failure only — the fatal code must be 1');
  const ladder = readFileSync(LADDER_PATH, 'utf8');
  assert.ok(!/process\.exit\(0\)/.test(ladder), 'the restart ladder must never exit 0');
});

/* ------------------------------------------------------------------ *
 * 2. the fallback path proven live: flush FIRST, then exit 1
 * ------------------------------------------------------------------ */

/** stubs process.exit to record the code and stop execution with a sentinel */
function stubProcessExit(t, onExit) {
  const real = process.exit;
  const sentinel = new Error('__EXIT_SENTINEL__');
  sentinel.name = 'ExitSentinel';
  process.exit = (code) => {
    try { onExit(code); } finally { throw sentinel; }
  };
  t.after(() => { process.exit = real; });
  return sentinel;
}

test('fatal exit codes: the update fallback flushes the DB BEFORE exiting with code 1', async (t) => {
  const order = [];
  const flushedDb = { flush: async () => { order.push('flush'); } };
  const prevDb = global.db;
  global.db = flushedDb;
  t.after(() => {
    if (prevDb === undefined) delete global.db;
    else global.db = prevDb;
  });
  const sentinel = stubProcessExit(t, (code) => order.push('exit:' + code));

  await assert.rejects(() => fatalRestartFallback('test'), (e) => e === sentinel);
  assert.deepEqual(order, ['flush', 'exit:1'], 'flush first, then exit 1 — recorded ordering');
});

test('fatal exit codes: without a usable DB the fallback still exits 1 (never 0)', async (t) => {
  const codes = [];
  const prevDb = global.db;
  global.db = undefined;
  t.after(() => {
    if (prevDb === undefined) delete global.db;
    else global.db = prevDb;
  });
  const sentinel = stubProcessExit(t, (code) => codes.push(code));

  await assert.rejects(() => fatalRestartFallback('test'), (e) => e === sentinel);
  assert.deepEqual(codes, [1], 'no flush available — the exit code is still the fatal 1');
});

test('fatal exit codes: a throwing flush never turns the fatal exit into a success', async (t) => {
  const codes = [];
  const prevDb = global.db;
  global.db = { flush: async () => { throw new Error('disk on fire'); } };
  t.after(() => {
    if (prevDb === undefined) delete global.db;
    else global.db = prevDb;
  });
  const sentinel = stubProcessExit(t, (code) => codes.push(code));

  await assert.rejects(() => fatalRestartFallback('test'), (e) => e === sentinel);
  assert.deepEqual(codes, [1], 'the flush failure is contained and the exit stays 1');
});

/* ------------------------------------------------------------------ *
 * 3. no regressions: fatal paths elsewhere stay non-zero
 * ------------------------------------------------------------------ */

test('fatal exit codes: autoUpdate CLI and the uncaughtException path exit 1', () => {
  const autoUpdate = readFileSync(path.join(repoRoot, 'system', 'autoUpdate.mjs'), 'utf8');
  const exits = [...autoUpdate.matchAll(/process\.exit\((\d+)\)/g)].map((m) => Number(m[1]));
  assert.ok(exits.length >= 2, 'the autoUpdate CLI error paths are present');
  for (const c of exits) assert.equal(c, 1, 'autoUpdate error exits must be 1');

  const index = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
  const indexExits = [...index.matchAll(/process\.exit\((\d+)\)/g)]
    .filter((m) => m.input.slice(0, m.index).split('\n').pop().indexOf('//') === -1)
    .map((m) => Number(m[1]));
  assert.ok(indexExits.length >= 1, 'index.js has executed exit sites');
  for (const c of indexExits) assert.equal(c, 1, 'index.js fatal paths must stay at exit 1 (todo 2 contract)');
});
