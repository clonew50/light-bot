/**
 * tests/unit.task-2.test.mjs — todo 2: "Single-flight restart mutex with an escalation ladder"
 * ==========================================================================================
 * GAP-10 / GAP-19 / GAP-11(partial):
 *   restartBot() was called from 10 independent sources with no in-flight guard, so two
 *   restarts could overlap on the same socket teardown, and every fatal path exited with
 *   code 0 — which systemd (Restart=on-failure) and PM2 treat as "clean", so the bot stayed
 *   down instead of being respawned.
 *
 * These cases assert the RECORDED VALUES, not the presence of a log line:
 *   - "restart mutex": 5 concurrent global.restartBot() calls share ONE in-flight promise
 *     and produce exactly ONE client.restart() call (all five promises resolve).
 *   - "escalation": with a restart that never yields an 'open', the SECOND consecutive
 *     failure records process.exit code 1 (asserted value, not 0) after flushing the DB.
 *   - the exit-mode path (RESTART_MODE=exit) also exits with code 1.
 *   - a plain disconnect never exits the process.
 *   - a restart never deletes the credentials/session.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const LADDER_PATH = path.join(repoRoot, 'system', 'restart-ladder.js');

const {
  createRestartController,
  installGlobalRestart,
  OPEN_TIMEOUT_MS,
  ESCALATE_AFTER,
  FATAL_EXIT_CODE,
} = await import(pathToFileURL(LADDER_PATH).href);

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

/** ساعة وهمية: بتتحكم في الوقت وبتطلق المؤقّتات بالترتيب — فمفيش تذبذب. */
function makeFakeClock() {
  let current = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimer(fn, ms) {
      const id = ++seq;
      timers.set(id, { fn, at: current + ms });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const target = current + ms;
      for (;;) {
        let pick = null;
        for (const [id, t] of timers) {
          if (t.at <= target && (!pick || t.at < pick.t.at)) pick = { id, t };
        }
        if (!pick) break;
        timers.delete(pick.id);
        current = pick.t.at;
        pick.t.fn();
      }
      current = target;
    },
  };
}

/** سوكيت وهمية بترفع أحداث connection.update زي ما baileys بيفعل. */
function makeFakeSocket() {
  const handlers = new Map();
  return {
    handlers,
    user: undefined,
    ev: {
      on(evt, fn) { handlers.set(evt, fn); },
    },
    emit(evt, payload) { handlers.get(evt)?.(payload); },
  };
}

/** عميل meowsab وهمية: بتعدّ نداءات restart() وبتحتفظ بعداد لحذف بيانات الجلسة. */
function makeFakeClient({ onRestart } = {}) {
  const sock = makeFakeSocket();
  const state = { restartCalls: 0, authRemovals: 0, sessionRemovals: 0 };
  return {
    sock,
    state,
    get restartCalls() { return state.restartCalls; },
    get authRemovals() { return state.authRemovals; },
    get sessionRemovals() { return state.sessionRemovals; },
    auth: { remove: async () => { state.authRemovals += 1; } },
    async restart() {
      state.restartCalls += 1;
      if (onRestart) await onRestart();
    },
    isConnected() { return false; },
  };
}

/** بيشيل تعليقات السطور — عشان نتحقق من الكود التنفيذي مش من الكلام. */
function stripLineComments(src) {
  return src.split('\n').map((line) => {
    const i = line.indexOf('//');
    return i === -1 ? line : line.slice(0, i);
  }).join('\n');
}

const tick = () => new Promise((r) => setImmediate(r));

/* ------------------------------------------------------------------ *
 * 1. the restart mutex
 * ------------------------------------------------------------------ */

test('restart mutex: five concurrent restartBot calls share ONE in-flight restart', async (t) => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  const prev = global.restartBot;
  installGlobalRestart(ctrl);
  t.after(() => {
    if (prev === undefined) delete global.restartBot;
    else global.restartBot = prev;
  });

  // five concurrent requests — the classic "two sources fire at once" race
  const ps = [
    global.restartBot('a'),
    global.restartBot('b'),
    global.restartBot('c'),
    global.restartBot('d'),
    global.restartBot('e'),
  ];

  // the in-flight promise is SHARED, not re-created (stale_state guard)
  assert.equal(new Set(ps).size, 1, 'all five calls must return the same in-flight promise');

  const settled = await Promise.all(ps);   // resolves only if none of them rejects
  assert.equal(settled.length, 5);
  assert.equal(client.restartCalls, 1, 'exactly one client.restart() call for five requests');
  assert.equal(exits.length, 0, 'a normal restart must never exit');
  assert.equal(ctrl.stats().restarts, 1);
  assert.equal(ctrl.stats().inFlight, false, 'the lock is released when the restart finishes');
});

test('restart mutex: a request that arrives while a restart runs joins the running one', async () => {
  const clock = makeFakeClock();
  let release = null;
  const client = makeFakeClient({
    onRestart: () => new Promise((r) => { release = r; }),
  });
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  const first = ctrl.restart('first');
  assert.equal(ctrl.isRestarting(), true);
  const second = ctrl.restart('second');
  assert.equal(first, second, 'the second request must get the very same promise');
  release();
  await Promise.all([first, second]);
  assert.equal(client.restartCalls, 1);
});

/* ------------------------------------------------------------------ *
 * 2. the escalation ladder
 * ------------------------------------------------------------------ */

test('escalation: the second consecutive failure exits with code 1 (never 0)', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();          // never yields an 'open'
  const exits = [];
  const order = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => { order.push('flush'); },
    exit: (code) => { order.push('exit:' + code); exits.push(code); },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  // attempt #1 — no open within the window => one failure, no exit yet
  await ctrl.restart('first');
  clock.advance(OPEN_TIMEOUT_MS);
  await tick();
  assert.equal(exits.length, 0, 'a single failure must not kill the process');
  assert.equal(ctrl.stats().consecutiveFailures, 1);

  // attempt #2 — still no open => escalate
  await ctrl.restart('second');
  clock.advance(OPEN_TIMEOUT_MS);
  await tick();

  assert.equal(exits.length, 1, 'the second consecutive failure must exit exactly once');
  assert.equal(exits[0], 1, 'the recorded exit code must be 1, not 0');
  assert.notEqual(exits[0], 0);
  assert.equal(exits[0], FATAL_EXIT_CODE);
  assert.deepEqual(order, ['flush', 'exit:1'], 'the DB must be flushed BEFORE the exit');
  assert.equal(ctrl.stats().lastExitCode, 1);
});

test('escalation: a real open inside the window clears the failure counter', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  await ctrl.restart('first');
  clock.advance(OPEN_TIMEOUT_MS);
  await tick();
  assert.equal(ctrl.stats().consecutiveFailures, 1);

  await ctrl.restart('second');
  client.sock.emit('connection.update', { connection: 'open' });
  assert.equal(ctrl.stats().consecutiveFailures, 0, 'the open must clear the failure counter');

  clock.advance(OPEN_TIMEOUT_MS);
  await tick();
  assert.equal(exits.length, 0, 'a recovered connection must never escalate');
  assert.equal(ESCALATE_AFTER, 2);
});

test('escalation: rapid consecutive restarts still escalate (a new attempt does not reset the window)', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();          // never yields an 'open'
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  await ctrl.restart('first');     // window #1: t=0..90s
  clock.advance(30_000);           // t=30s — window #1 is still open
  await ctrl.restart('second');    // window #2: t=30..120s — window #1 must survive
  assert.equal(exits.length, 0);
  assert.equal(ctrl.stats().activeTrials, 2, 'both attempts must be tracked');

  clock.advance(60_000);           // t=90s — window #1 expires
  await tick();
  assert.equal(ctrl.stats().consecutiveFailures, 1, 'the superseded attempt must still count as a failure');
  assert.equal(exits.length, 0, 'one failure is not enough to escalate');

  clock.advance(30_000);           // t=120s — window #2 expires
  await tick();
  assert.equal(exits.length, 1, 'the second consecutive failure must escalate');
  assert.equal(exits[0], 1, 'the recorded exit code must be 1');
});

test('escalation: a late open after a failed window breaks the consecutive-failure chain', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  await ctrl.restart('first');
  clock.advance(OPEN_TIMEOUT_MS);   // window expires -> failure #1
  await tick();
  assert.equal(ctrl.stats().consecutiveFailures, 1);

  client.sock.emit('connection.update', { connection: 'open' });  // late open
  assert.equal(ctrl.stats().consecutiveFailures, 0, 'a late open must break the chain');

  await ctrl.restart('second');
  clock.advance(OPEN_TIMEOUT_MS);   // one failure after the recovery — no escalation yet
  await tick();
  assert.equal(exits.length, 0, 'the failure after a recovery is not consecutive');
});

test('escalation: RESTART_MODE=exit still exits — with code 1, after flushing the DB', async () => {
  const order = [];
  const client = makeFakeClient();
  const ctrl = createRestartController({
    client,
    mode: 'exit',
    flushDb: async () => { order.push('flush'); },
    exit: (code) => { order.push('exit:' + code); },
    log: () => {},
    logError: () => {},
  });

  await ctrl.restart('exit-mode');
  assert.deepEqual(order, ['flush', 'exit:1']);
  assert.equal(client.restartCalls, 0, 'exit mode must not run an in-process restart');
});

test('a plain disconnect never exits the process', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  // a normal close (even a badSession 500) must not kill the bot
  client.sock.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 500 }, message: 'Bad session' } },
  });
  await tick();
  assert.equal(exits.length, 0, 'a disconnect must never exit');
  assert.equal(client.restartCalls, 0, 'a disconnect must not trigger a restart either');
});

test('a restart never deletes the credentials or the session', async () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  await ctrl.restart('keep-creds');
  clock.advance(OPEN_TIMEOUT_MS);
  await tick();

  assert.equal(client.authRemovals, 0, 'auth.remove must never be called by a restart');
  assert.equal(client.sessionRemovals, 0, 'the session must never be deleted by a restart');

  const src = readFileSync(LADDER_PATH, 'utf8');
  for (const forbidden of ['rmSync', 'unlink', 'rm(', 'auth.remove', 'sessionPath', 'creds.json']) {
    assert.equal(src.includes(forbidden), false, `the ladder must not touch "${forbidden}"`);
  }
});

/* ------------------------------------------------------------------ *
 * 3. the wiring — every call site goes through the single-flight path
 * ------------------------------------------------------------------ */

test('wiring: every restart call site goes through the shared ladder', () => {
  const index = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
  const panel = readFileSync(path.join(repoRoot, 'system', 'webPanel.js'), 'utf8');
  const owner = readFileSync(path.join(repoRoot, 'plugins', 'owner', 'restart.js'), 'utf8');

  // index.js: the ladder owns the restart, the global is installed from it
  assert.match(index, /import \{ createRestartController, installGlobalRestart \} from '\.\/system\/restart-ladder\.js';/);
  assert.match(index, /const restartController = createRestartController\(\{/);
  assert.match(index, /installGlobalRestart\(restartController\)/);

  // index.js: no fatal path may exit with 0, and the restart is never called directly
  const indexCode = stripLineComments(index);
  assert.equal(indexCode.includes('process.exit(0)'), false, 'index.js must never exit with code 0');
  assert.equal(indexCode.includes('process.exit(1)'), true, 'the fatal path must exit with code 1');
  assert.equal(indexCode.includes('client.restart()'), false, 'index.js must not call client.restart() directly');
  // the watchdog's private escalation counter moved into the ladder
  assert.equal(indexCode.includes('let esc = 0'), false, 'the watchdog must not keep its own counter');

  // the panel and the owner plugin must not bypass the mutex
  assert.equal(panel.includes('client.restart?.()'), false, 'the panel must not bypass the restart lock');
  assert.equal(owner.includes('bot.restart()'), false, 'the owner plugin must not bypass the restart lock');

  // the sources that call the restart still do — through global.restartBot
  assert.match(index, /global\.restartBot\('watchdog'\)/);
  assert.match(index, /global\.restartBot\?\.\('memory high'\)/);
  assert.match(index, /global\.restartBot\('uncaught-exception'\)/);
  assert.match(panel, /global\.restartBot\('لوحة التحكم'\)/);
  // todo 9: the install (set-login) and reset-session actions must NOT use the
  // in-process restart (it cannot re-import ES modules) — they exit via the
  // shared ladder's clean full-restart step instead.
  assert.doesNotMatch(panel, /global\.restartBot\('تغيير إعدادات الربط'\)/);
  assert.doesNotMatch(panel, /global\.restartBot\('تصفير الجلسة'\)/);
  assert.match(panel, /requestCleanRestart\('تغيير إعدادات الربط'\)/);
  assert.match(panel, /requestCleanRestart\('تصفير الجلسة'\)/);
  assert.match(owner, /global\.restartBot\('أمر رستارت من المالك'\)/);
});

test('wiring: global.restartBot keeps the contract used by the panel and the owner plugin', () => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });
  const prev = global.restartBot;
  const fn = installGlobalRestart(ctrl);
  try {
    assert.equal(typeof global.restartBot, 'function');
    assert.equal(global.restartBot, fn);
    // the panel calls it without awaiting; it must return a promise and never throw
    const p = global.restartBot('لوحة التحكم');
    assert.equal(typeof p.then, 'function');
    return p.then(() => {
      assert.equal(client.restartCalls, 1);
    });
  } finally {
    if (prev === undefined) delete global.restartBot;
    else global.restartBot = prev;
  }
});
