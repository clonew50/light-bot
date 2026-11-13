/**
 * tests/unit.task-10.test.mjs — todo 10: "Make the operator's stop button authoritative"
 * ==========================================================================================
 * GAP-14 / GAP-12(uncaughtException):
 *   While panelRuntime().stopped === true (the operator pressed "stop" in the panel),
 *   EVERY restart source must be refused by the single guard inside the restart ladder
 *   (system/restart-ladder.js) — with an Arabic "البوت متوقف من اللوحة" message — and
 *   client.restart() must not be called at all. Only `force:true` (panel start/restart
 *   path, which clears the flag first) and the internal fatal escalation ladder bypass
 *   the guard. A queued timer must not ride over an intentional stop.
 *
 * Asserted on recorded values, never on booting the bot:
 *   - "stop authority": stopped → restartBot('test') resolves {skipped:true}, zero
 *     client.restart() calls; force:true → exactly one call.
 *   - a queued request that arrives while a restart runs AND the operator then stops
 *     the bot is refused (the stop wins over the in-flight lock for NEW requests).
 *   - the fatal ladder still exits 1 after a flush even while stopped (operator stop
 *     must NOT leave the bot permanently unable to come back via the supervisor).
 *   - every restart source in index.js routes through the guard; the watchdog treats
 *     "stopped" as intentional (no error event, no escalation, no exit).
 *   - the panel's start action clears the flag before starting the client.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const LADDER_PATH = path.join(repoRoot, 'system', 'restart-ladder.js');
const INDEX_PATH = path.join(repoRoot, 'index.js');
const PANEL_PATH = path.join(repoRoot, 'system', 'webPanel.js');

const {
  createRestartController,
  installGlobalRestart,
  FATAL_EXIT_CODE,
} = await import(pathToFileURL(LADDER_PATH).href);

/* ------------------------------------------------------------------ *
 * helpers (same shapes as unit.task-2 — fake clock / fake client)
 * ------------------------------------------------------------------ */

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

function makeFakeSocket() {
  const handlers = new Map();
  return {
    handlers,
    ev: { on(evt, fn) { handlers.set(evt, fn); } },
    emit(evt, payload) { handlers.get(evt)?.(payload); },
  };
}

/** fake client with a restart call counter and a controllable restart gate */
function makeFakeClient({ onRestart } = {}) {
  const sock = makeFakeSocket();
  const state = { restartCalls: 0, authRemovals: 0, sessionRemovals: 0 };
  return {
    sock,
    state,
    get restartCalls() { return state.restartCalls; },
    auth: { remove: async () => { state.authRemovals += 1; } },
    async restart() {
      state.restartCalls += 1;
      if (onRestart) await onRestart();
    },
    isConnected() { return false; },
  };
}

/** captures log lines so we can assert the Arabic stopped message */
function makeLogCapture() {
  const lines = [];
  return {
    lines,
    log: (...a) => lines.push(a.join(' ')),
    logError: (...a) => lines.push('ERR ' + a.join(' ')),
    containsArabic: (needle) => lines.some((l) => l.includes(needle)),
  };
}

const tick = () => new Promise((r) => setImmediate(r));

/** index.js contains Arabic → grep needs -a; readFileSync with utf8 is fine here */
function readSource(p) {
  return readFileSync(p, 'utf8');
}

function stripLineComments(src) {
  return src.split('\n').map((line) => {
    const i = line.indexOf('//');
    return i === -1 ? line : line.slice(0, i);
  }).join('\n');
}

/* ------------------------------------------------------------------ *
 * 1. stop authority — the guard inside the ladder
 * ------------------------------------------------------------------ */

test("stop authority: with stopped=true, restartBot('test') resolves {skipped:true} and client.restart() is never called", async (t) => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const logs = makeLogCapture();
  let stopped = true; // the operator already pressed "stop" in the panel
  const exits = [];
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    isStopped: () => stopped,
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: logs.log,
    logError: logs.logError,
  });

  const prev = global.restartBot;
  installGlobalRestart(ctrl);
  t.after(() => {
    if (prev === undefined) delete global.restartBot;
    else global.restartBot = prev;
  });

  const res = await global.restartBot('test');
  assert.equal(res?.skipped, true, 'the request must be refused as skipped');
  assert.equal(client.restartCalls, 0, 'client.restart() call count must stay 0');
  assert.deepEqual(exits, [], 'an intentional stop must never exit the process');
  assert.equal(ctrl.stats().restarts, 0, 'no restart may actually begin');
  // the refusal is announced in Arabic (the operator reads Arabic)
  assert.ok(logs.containsArabic('البوت متوقف من اللوحة'), 'the log must say the bot is stopped by the operator');
  assert.equal(ctrl.stats().stoppedRefusals, 1);
});

test('stop authority: force:true bypasses the guard and calls client.restart() exactly once', async (t) => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const logs = makeLogCapture();
  const stopped = () => true;
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    isStopped: stopped,
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: logs.log,
    logError: logs.logError,
  });
  const prev = global.restartBot;
  installGlobalRestart(ctrl);
  t.after(() => {
    if (prev === undefined) delete global.restartBot;
    else global.restartBot = prev;
  });

  await global.restartBot('panel-start', { force: true });
  assert.equal(client.restartCalls, 1, 'with force:true the call count becomes 1');
  assert.ok(!logs.containsArabic('البوت متوقف من اللوحة'), 'forced restarts must not be refused');
});

test('stop authority: the guard is checked BEFORE the in-flight lock — a queued timer cannot ride over an intentional stop', async (t) => {
  const clock = makeFakeClock();
  // a client whose restart() is parked on a deferred promise (restart in flight)
  let releaseRestart;
  const client = makeFakeClient({
    onRestart: () => new Promise((res) => { releaseRestart = res; }),
  });
  let stopped = false;
  const ctrl = createRestartController({
    client,
    flushDb: async () => {},
    isStopped: () => stopped,
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  const first = ctrl.restart('periodic');
  assert.equal(ctrl.stats().inFlight, true, 'a restart is now in flight');
  // the operator stops the bot while the restart is still running
  stopped = true;
  const queued = await ctrl.restart('queued-timer'); // must NOT join the in-flight one
  assert.equal(queued?.skipped, true, 'the queued request is refused by the stop');
  assert.equal(client.restartCalls, 1, 'no second restart may start for the queued request');
  // release the in-flight restart; the stop still governs any further request
  releaseRestart?.();
  await first;
  const again = await ctrl.restart('after');
  assert.equal(again?.skipped, true, 'requests after the restart remain refused while stopped');
  assert.equal(client.restartCalls, 1);
});

test('stop authority: the fatal escalation ladder still works while stopped (no permanent death)', async (t) => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const exits = [];
  const flushed = [];
  let stopped = true;
  const ctrl = createRestartController({
    client,
    flushDb: async () => { flushed.push(true); },
    isStopped: () => stopped,
    exit: (code) => exits.push(code),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });

  // force also unblocks a full restart through the guard
  await ctrl.restart('escalated', { force: true });
  assert.equal(client.restartCalls, 1);
  // and the internal fatal path (called by the ladder itself, not via restart()) exits 1 after the flush
  await ctrl.fatal('test-escalation');
  assert.deepEqual(flushed, [true], 'the DB is flushed before the fatal exit');
  assert.deepEqual(exits, [FATAL_EXIT_CODE], 'the fatal ladder exits with code 1 even while stopped');
});

test('stop authority: stats() reports the stopped state and the refusal count', async (t) => {
  const holder = { stopped: true };
  const ctrl = createRestartController({ isStopped: () => holder.stopped, log: () => {}, logError: () => {} });
  assert.equal(ctrl.stats().stopped, true);
  holder.stopped = false;
  assert.equal(ctrl.stats().stopped, false);
});

/* ------------------------------------------------------------------ *
 * 2. the wiring in index.js — every source funnels into the guard
 * ------------------------------------------------------------------ */

test('wiring: index.js injects the panelRuntime stopped flag into the restart controller', () => {
  const src = stripLineComments(readSource(INDEX_PATH));
  assert.ok(
    /isStopped:\s*\(\)\s*=>\s*\{[\s\S]{0,120}?panelRuntime\(\)\.stopped/.test(src),
    'createRestartController must receive isStopped from panelRuntime().stopped'
  );
  // the local restartBot passes the options through (force escape for the panel path)
  assert.ok(
    /function restartBot\([^)]*opts[^)]*\)\s*\{\s*return restartController\.restart\(reason,\s*opts\)/.test(src),
    'the local restartBot must forward {force} to the controller'
  );
});

test('wiring: every restart source in index.js routes through global.restartBot (no direct restart calls)', () => {
  const src = stripLineComments(readSource(INDEX_PATH));
  // the ONLY direct call to the controller is inside the local restartBot definition
  const directCalls = [...src.matchAll(/restartController\.restart\(/g)];
  assert.equal(directCalls.length, 1, 'restartController.restart( appears exactly once — inside restartBot()');
  // memory guard → global.restartBot
  assert.ok(/global\.restartBot\?\.\(\s*['"]memory high['"]\)/.test(src), 'the memory guard routes through restartBot');
  // updater restart → restartBot (the local alias of the guarded path)
  assert.ok(/restartBot\('تحديث تلقائي من الريبو'\)/.test(src), 'the updater restart routes through restartBot');
  // periodic restart → global.restartBot
  assert.ok(/restart:\s*\(reason\)\s*=>\s*global\.restartBot\(reason\)/.test(src), 'the periodic scheduler routes through restartBot');
  // uncaughtException → global.restartBot (GAP-12)
  assert.ok(/global\.restartBot\('uncaught-exception'\)/.test(src), 'uncaughtException routes through restartBot');
  // watchdog → global.restartBot
  assert.ok(/global\.restartBot\('watchdog'\)/.test(src), 'the watchdog routes through restartBot');
  // the ladder (installGlobalRestart) is the only installer of global.restartBot
  assert.ok(/installGlobalRestart\(restartController\)/.test(src), 'the global function comes from the ladder');
});

test('wiring: the watchdog treats "stopped" as intentional — no restart, no error event, no exit', () => {
  const src = readSource(INDEX_PATH);
  const watchdogStart = src.indexOf('Watchdog — حرس الاتصال');
  const memoryStart = src.indexOf('Memory Guard — حرس الذاكرة');
  assert.ok(watchdogStart !== -1 && memoryStart !== -1, 'both sections are present');
  const watchdogSrc = stripLineComments(src.slice(watchdogStart, memoryStart));
  assert.ok(
    /if\s*\(\s*rt\.stopped\s*\)\s*return;/.test(watchdogSrc),
    'the watchdog returns silently while the bot is intentionally stopped'
  );
  // and it returns BEFORE any restart request is made
  const stoppedIdx = watchdogSrc.indexOf('rt.stopped');
  const restartIdx = watchdogSrc.indexOf("global.restartBot('watchdog')");
  assert.ok(stoppedIdx !== -1 && restartIdx !== -1 && stoppedIdx < restartIdx,
    'the stopped check happens before the watchdog asks for a restart');
  assert.ok(!/process\.exit/.test(watchdogSrc), 'the watchdog never exits the process itself');
});

test('wiring: installGlobalRestart forwards the {force} option to the controller', async (t) => {
  const clock = makeFakeClock();
  const client = makeFakeClient();
  const ctrl = createRestartController({
    client,
    isStopped: () => true,
    exit: () => {},
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    log: () => {},
    logError: () => {},
  });
  const prev = global.restartBot;
  const fn = installGlobalRestart(ctrl, global);
  t.after(() => {
    if (prev === undefined) delete global.restartBot;
    else global.restartBot = prev;
  });
  assert.equal(fn, global.restartBot);
  const skipped = await global.restartBot('test');
  assert.equal(skipped?.skipped, true, 'without force the request is refused');
  await global.restartBot('test', { force: true });
  assert.equal(client.restartCalls, 1, 'force is forwarded through installGlobalRestart');
});

/* ------------------------------------------------------------------ *
 * 3. the panel side — stop/start pair (webPanel.js is read-only here)
 * ------------------------------------------------------------------ */

test('panel: the start action clears the stopped flag BEFORE starting the client; the restart action clears it too', () => {
  const src = readSource(PANEL_PATH);
  const startIdx = src.indexOf("case 'start':");
  const restartIdx = src.indexOf("case 'restart':");
  const resetIdx = src.indexOf("case 'reset-session':");
  assert.ok(startIdx !== -1 && restartIdx !== -1 && resetIdx !== -1, 'all three actions exist');
  const startBlock = stripLineComments(src.slice(startIdx, resetIdx));
  assert.ok(/state\.stopped\s*=\s*false;/.test(startBlock), 'start clears the stopped flag');
  assert.ok(/client\.start\?\.\(\)/.test(startBlock), 'start then starts the client');
  const stoppedIdx = startBlock.indexOf('state.stopped = false;');
  const startCallIdx = startBlock.indexOf('client.start?.()');
  assert.ok(stoppedIdx < startCallIdx, 'the flag is cleared BEFORE the client starts');
  const restartBlock = stripLineComments(src.slice(restartIdx, startIdx));
  assert.ok(/state\.stopped\s*=\s*false;/.test(restartBlock), 'restart also clears the stopped flag first');
});
