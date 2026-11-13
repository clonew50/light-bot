/**
 * tests/unit.task-4.test.mjs — todo 4: "Await client.start() and survive a failed boot"
 * ==========================================================================================
 * GAP-11:
 *   `client.start()` in meowsab never rejects — its internal try/catch logs
 *   "Failed to start", calls `config.onError?.(n)`, schedules a reconnect, and
 *   resolves normally. Furthermore, `fetchLatestBaileysVersion()` inside `start()`
 *   has no timeout, so an unreachable version-lookup host hangs `start()` forever.
 *
 * These cases assert STATE VALUES and RECORDED CALLS (never just log strings):
 *   - BOOT_TIMEOUT_MS === 90_000 and RETRY_DELAYS_MS === [5_000, 15_000, 45_000]
 *   - fake client whose start() never resolves within the 90s timeout:
 *       * attempts start() 3 times (1/3, 2/3, 3/3)
 *       * waits the exact retry delays [5000, 15000] between the 3 attempts
 *       * pushes 3 Arabic panel events ("تعذر تشغيل البوت: ...")
 *       * hands off to global.restartBot('boot-failed') on final failure
 *       * never calls process.exit directly and never removes auth/session
 *   - fake client whose start() resolves and connects (isConnected() === true):
 *       * succeeds on the first attempt without retrying or restarting
 *   - config.onError is present in meowsab's .strict() zod schema and wired
 *     in system/config.js so boot failure reasons are captured and reported
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const {
  startClientBounded,
  BOOT_TIMEOUT_MS,
  RETRY_DELAYS_MS,
} = await import(pathToFileURL(path.join(repoRoot, 'system', 'bootGuard.js')).href);

const {
  buildConfig,
  recordClientError,
  lastClientError,
} = await import(pathToFileURL(path.join(repoRoot, 'system', 'config.js')).href);

/* ------------------------------------------------------------------ *
 * helpers — fake clock, zero wall-clock sleeps
 * ------------------------------------------------------------------ */

function makeFakeClock() {
  let current = 0;
  let seq = 0;
  const timers = new Map();
  const sleepCalls = [];

  return {
    sleepCalls,
    now: () => current,
    setTimer(fn, ms) {
      const id = ++seq;
      timers.set(id, { fn, at: current + ms });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    async sleep(ms) {
      sleepCalls.push(ms);
      await new Promise((resolve) => {
        const id = ++seq;
        timers.set(id, { fn: resolve, at: current + ms });
      });
    },
    async advance(ms) {
      const target = current + ms;
      while (true) {
        let pick = null;
        for (const [id, t] of timers) {
          if (t.at <= target && (!pick || t.at < pick.t.at)) pick = { id, t };
        }
        if (!pick) break;
        timers.delete(pick.id);
        current = pick.t.at;
        pick.t.fn();
        await new Promise((r) => setImmediate(r));
      }
      current = target;
    },
  };
}

const tick = () => new Promise((r) => setImmediate(r));

/* ------------------------------------------------------------------ *
 * 1. constants & exact retry bounds
 * ------------------------------------------------------------------ */

test('bootGuard: timeout is 90s and retry delays are [5000, 15000, 45000]', () => {
  assert.equal(BOOT_TIMEOUT_MS, 90_000);
  assert.deepEqual(RETRY_DELAYS_MS, [5_000, 15_000, 45_000]);
});

/* ------------------------------------------------------------------ *
 * 2. failed boot where start() never resolves within the 90s timeout
 * ------------------------------------------------------------------ */

test('boot retry: hung start() attempts 3 times with [5000, 15000] delays, pushes 3 Arabic events, and calls global.restartBot', async (t) => {
  const clock = makeFakeClock();
  const startCalls = [];
  const pushedEvents = [];
  const logLines = [];
  const errorLines = [];
  const restartReasons = [];

  const fakeClient = {
    authRemovals: 0,
    start() {
      startCalls.push(clock.now());
      return new Promise(() => {}); // never resolves (simulates hung fetchLatestBaileysVersion)
    },
    isConnected() {
      return false;
    },
    auth: {
      remove: async () => { fakeClient.authRemovals += 1; },
    },
  };

  const prevRestart = global.restartBot;
  global.restartBot = (reason) => {
    restartReasons.push(reason);
    return Promise.resolve();
  };
  t.after(() => {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
  });

  const runPromise = startClientBounded(fakeClient, {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: clock.sleep,
    log: (m) => logLines.push(String(m)),
    logError: (m) => errorLines.push(String(m)),
    pushEvent: (m) => pushedEvents.push(String(m)),
  });

  // Drive the clock through all 3 * 90s timeouts + 5s + 15s retry delays
  for (let step = 0; step < 6; step++) {
    await tick();
    await clock.advance(95_000);
    await tick();
  }
  const result = await Promise.race([
    runPromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('runPromise timed out')), 2000)),
  ]);

  assert.equal(startCalls.length, 3, 'client.start() must be called 3 times');
  assert.deepEqual(startCalls, [0, 95_000, 200_000], 'each retry starts after 90s timeout + delay');

  // Attempt 1 -> fail at 90s -> sleep 5000ms -> Attempt 2 starts at 95,000ms
  // Attempt 2 -> fail at 185s -> sleep 15000ms -> Attempt 3 starts at 200,000ms
  const retryDelaysUsed = [
    startCalls[1] - (startCalls[0] + BOOT_TIMEOUT_MS),
    startCalls[2] - (startCalls[1] + BOOT_TIMEOUT_MS),
  ];
  assert.deepEqual(retryDelaysUsed, [5_000, 15_000]);
  assert.deepEqual(RETRY_DELAYS_MS, [5_000, 15_000, 45_000]);

  const attemptLogs = logLines.filter((l) => l.includes('محاولة بدء التشغيل'));
  assert.equal(attemptLogs.length, 3, 'each of the 3 attempts logs an Arabic attempt message');
  assert.ok(attemptLogs[0].includes('محاولة بدء التشغيل 1/3'));
  assert.ok(attemptLogs[1].includes('محاولة بدء التشغيل 2/3'));
  assert.ok(attemptLogs[2].includes('محاولة بدء التشغيل 3/3'));

  assert.equal(pushedEvents.length, 3, 'each failed attempt pushes an Arabic panel event');
  for (const ev of pushedEvents) {
    assert.ok(ev.startsWith('تعذر تشغيل البوت:'), `unexpected panel event: ${ev}`);
  }

  assert.deepEqual(restartReasons, ['boot-failed'], 'final failure hands off to global.restartBot(\'boot-failed\')');
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 3);
  assert.equal(result.handedOff, true);
  assert.equal(fakeClient.authRemovals, 0, 'auth.remove must never be called on boot failure');
});

/* ------------------------------------------------------------------ *
 * 3. successful boot where start() resolves
 * ------------------------------------------------------------------ */

test('boot success: start() resolves and connects on attempt 1 without retrying or restarting', async (t) => {
  const clock = makeFakeClock();
  let startCalls = 0;
  let connected = false;
  const pushedEvents = [];
  const restartReasons = [];

  const fakeClient = {
    start() {
      startCalls += 1;
      connected = true;
      return Promise.resolve();
    },
    isConnected() {
      return connected;
    },
  };

  const prevRestart = global.restartBot;
  global.restartBot = (reason) => {
    restartReasons.push(reason);
    return Promise.resolve();
  };
  t.after(() => {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
  });

  const result = await startClientBounded(fakeClient, {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: clock.sleep,
    log: () => {},
    logError: () => {},
    pushEvent: (m) => pushedEvents.push(String(m)),
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(startCalls, 1, 'a successful boot only calls client.start() once');
  assert.equal(pushedEvents.length, 0, 'a successful boot pushes no error events');
  assert.equal(restartReasons.length, 0, 'a successful boot never calls restartBot');
});

test('boot timeout reason: uses config.onError failure reason when reported before timeout', async (t) => {
  const clock = makeFakeClock();
  const pushedEvents = [];
  const restartReasons = [];
  const bootError = new Error('fetch failed: ENOTFOUND raw.githubusercontent.com');

  const fakeClient = {
    startCalls: 0,
    async start() {
      this.startCalls += 1;
    },
    isConnected() {
      return false;
    },
  };

  const prevRestart = global.restartBot;
  global.restartBot = (reason) => {
    restartReasons.push(reason);
    return Promise.resolve();
  };
  t.after(() => {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
  });

  const runPromise = startClientBounded(fakeClient, {
    timeoutMs: 100,
    retryDelays: [10, 20, 30],
    pollMs: 10,
    now: clock.now,
    sleep: clock.sleep,
    log: () => {},
    logError: () => {},
    pushEvent: (m) => pushedEvents.push(String(m)),
    lastFailureReason: () => bootError.message,
  });

  for (let i = 0; i < 6; i++) {
    await tick();
    await clock.advance(100);
    await tick();
  }
  const result = await runPromise;

  assert.equal(result.ok, false);
  assert.equal(fakeClient.startCalls, 3);
  assert.deepEqual(restartReasons, ['boot-failed']);
  assert.equal(pushedEvents.length, 3);
  for (const ev of pushedEvents) {
    assert.ok(ev.includes('ENOTFOUND raw.githubusercontent.com'));
  }
});

/* ------------------------------------------------------------------ *
 * 4. config.onError wiring in system/config.js and index.js
 * ------------------------------------------------------------------ */

test('config.onError is wired in buildConfig() and accepted by meowsab strict schema', () => {
  const cfg = buildConfig({});
  assert.equal(typeof cfg.onError, 'function', 'buildConfig() must wire onError');
  assert.equal(cfg.onError, recordClientError);

  recordClientError(null);
  assert.equal(lastClientError(), null);
  const err = new Error('ENOTFOUND raw.githubusercontent.com');
  cfg.onError(err);
  assert.equal(lastClientError(), err);
  recordClientError(null);

  const script = `
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const { Client } = require('${path.join(repoRoot, 'node_modules', 'meowsab').replace(/\\/g, '/')}');
    const cfgUrl = ${JSON.stringify(pathToFileURL(path.join(repoRoot, 'system', 'config.js')).href)};
    const mod = await import(cfgUrl);
    const cfg = mod.buildConfig({});
    const c = new Client(cfg);
    console.log(JSON.stringify({ ok: c.config.onError === mod.recordClientError }));
    await c.cleanup();
    process.exit(0);
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000,
  });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true, 'meowsab .strict() zod schema accepts and preserves onError');
});

test('index.js wires startClientBounded with lastClientError and preserves startup order', () => {
  const src = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');

  assert.ok(
    src.includes("import { startClientBounded } from './system/bootGuard.js';"),
    'index.js must import startClientBounded from system/bootGuard.js'
  );
  assert.ok(
    src.includes("import { buildConfig, buildInfo, lastClientError } from './system/config.js';"),
    'index.js must import lastClientError from system/config.js'
  );
  assert.ok(
    /startClientBounded\(client,\s*\{[\s\S]*?pushEvent,[\s\S]*?lastFailureReason:\s*lastClientError,[\s\S]*?\}\)/.test(src),
    'index.js must call startClientBounded with pushEvent and lastFailureReason: lastClientError'
  );
  assert.ok(
    src.includes('client.start();'),
    'index.js references client.start();'
  );

  // Keep existing bot startup order unchanged
  const idxBootCall = src.indexOf('\n/* =========== Start —');
  const idxHealer = src.indexOf('\n/* =========== Healer');
  const idxSub = src.indexOf('\n/* =========== Start SubBots');
  const idxPanel = src.lastIndexOf('\n/* =========== Web Panel');
  const idxWatchdog = src.indexOf('\n/* =========== Watchdog');

  assert.ok(idxBootCall > -1 && idxBootCall < idxHealer, 'boot guard runs before Healer');
  assert.ok(idxHealer < idxSub && idxSub < idxPanel, 'Healer -> SubBots -> Web Panel order preserved');
  assert.ok(idxPanel < idxWatchdog, 'Watchdog comes after Web Panel');
});