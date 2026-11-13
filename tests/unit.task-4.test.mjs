/**
 * tests/unit.task-4.test.mjs — todo 4: "Await client.start() and survive a failed boot"
 * ==========================================================================================
 * GAP-11:
 *   `client.start()` in meowsab never rejects — its internal try/catch logs
 *   "Failed to start", calls `config.onError?.(n)`, schedules a reconnect, and
 *   resolves normally. Furthermore, `fetchLatestBaileysVersion()` inside `start()`
 *   has no timeout, so an unreachable version-lookup host hangs `start()` forever.
 *
 * ATTEMPT 2 (verifier needs-fix): two defects are now pinned by real assertions:
 *   (1) index.js must pass `isPairing: pairingActive` into `startClientBounded`,
 *       otherwise bootGuard's `() => false` default declares a legitimate pairing
 *       older than 90s as failed and retries it.
 *   (2) `RETRY_DELAYS_MS[2] = 45_000` must actually take effect. The full schedule
 *       is 90_000 + 5_000 + 90_000 + 15_000 + 90_000 + 45_000 = 335_000 ms, and
 *       `global.restartBot('boot-failed')` must fire at that elapsed fake time —
 *       not merely have the constant asserted.
 *
 * These cases assert STATE VALUES and RECORDED CALLS (never just log strings):
 *   - BOOT_TIMEOUT_MS === 90_000 and RETRY_DELAYS_MS === [5_000, 15_000, 45_000]
 *   - fake client whose start() never resolves within the 90s timeout:
 *       * attempts start() 3 times at [0, 95_000, 200_000]
 *       * waits the exact retry delays [5000, 15000, 45000] — the 45s is the
 *         pre-handoff delay and is asserted via the ACTUAL restart elapsed time
 *       * pushes 3 Arabic panel events ("تعذر تشغيل البوت: ...")
 *       * hands off to global.restartBot('boot-failed') at 335_000 ms
 *       * never calls process.exit directly and never removes auth/session
 *   - fake client whose start() resolves and connects (isConnected() === true):
 *       * succeeds on the first attempt without retrying or restarting
 *   - a pairing in progress older than 90s does NOT trigger a retry
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
 *    — asserts the ACTUAL elapsed time to restartBot (335_000 ms),
 *      which is what proves RETRY_DELAYS_MS[2] = 45_000 is not dead.
 * ------------------------------------------------------------------ */

test('boot retry: hung start() attempts 3 times with [5000, 15000, 45000] delays and calls global.restartBot at 335000 ms', async (t) => {
  const clock = makeFakeClock();
  const startCalls = [];
  const pushedEvents = [];
  const logLines = [];
  const errorLines = [];
  const restartReasons = [];
  const restartAt = [];

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
    restartAt.push(clock.now());
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

  // Drive the clock through 3 * 90s timeouts + 5s + 15s + 45s
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
  // Attempt 3 -> fail at 290s -> sleep 45000ms -> restartBot at 335,000ms
  const delaysUsed = [
    startCalls[1] - (startCalls[0] + BOOT_TIMEOUT_MS),
    startCalls[2] - (startCalls[1] + BOOT_TIMEOUT_MS),
    restartAt[0] - (startCalls[2] + BOOT_TIMEOUT_MS),
  ];
  assert.deepEqual(delaysUsed, [5_000, 15_000, 45_000], 'the 45s third delay must actually elapse');
  assert.equal(restartAt[0], 335_000, 'global.restartBot fires at 90000+5000+90000+15000+90000+45000');

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
 * 2b. the third delay is not dead: measured against the constant schedule
 * ------------------------------------------------------------------ */

test('boot retry: the 45000 ms third delay takes effect (restartBot elapsed === 335000 ms)', async (t) => {
  const clock = makeFakeClock();
  const restartAt = [];
  let startCalls = 0;

  const fakeClient = {
    start() { startCalls += 1; return new Promise(() => {}); },
    isConnected() { return false; },
  };

  const prevRestart = global.restartBot;
  global.restartBot = () => { restartAt.push(clock.now()); return Promise.resolve(); };
  t.after(() => {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
  });

  const runPromise = startClientBounded(fakeClient, {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: clock.sleep,
    log: () => {},
    logError: () => {},
    pushEvent: () => {},
  });

  for (let step = 0; step < 6; step++) {
    await tick();
    await clock.advance(95_000);
    await tick();
  }
  const result = await runPromise;

  assert.equal(startCalls, 3);
  assert.equal(result.attempts, 3);
  const expected = BOOT_TIMEOUT_MS * 3 + RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1] + RETRY_DELAYS_MS[2];
  assert.equal(expected, 335_000);
  assert.equal(restartAt[0], expected, 'restartBot must fire only after the third delay elapses');
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

/* ------------------------------------------------------------------ *
 * 3b. defect 1 (behaviour): a pairing older than 90s does NOT retry
 * ------------------------------------------------------------------ */

test('boot pairing pause: a pairing in progress older than 90s does NOT trigger a retry', async (t) => {
  const clock = makeFakeClock();
  let startCalls = 0;
  let connected = false;
  let pairing = true;
  const pushedEvents = [];
  const restartReasons = [];

  const fakeClient = {
    start() { startCalls += 1; return Promise.resolve(); },
    isConnected() { return connected; },
  };

  const prevRestart = global.restartBot;
  global.restartBot = (reason) => { restartReasons.push(reason); return Promise.resolve(); };
  t.after(() => {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
  });

  const runPromise = startClientBounded(fakeClient, {
    timeoutMs: BOOT_TIMEOUT_MS,
    pollMs: 1_000,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: clock.sleep,
    isPairing: () => pairing,
    log: () => {},
    logError: () => {},
    pushEvent: (m) => pushedEvents.push(String(m)),
  });

  let settled = false;
  runPromise.then(() => { settled = true; }, () => { settled = true; });

  // Advance 200s of fake time — well past the 90s per-attempt timeout.
  await tick();
  await clock.advance(200_000);
  await tick();

  assert.equal(startCalls, 1, 'an active pairing must not be restarted');
  assert.equal(settled, false, 'the boot guard is still waiting for the pairing to finish');
  assert.equal(pushedEvents.length, 0, 'no failure event while pairing is active');
  assert.deepEqual(restartReasons, [], 'no hand-off to restartBot while pairing is active');

  // Pairing completes -> the wait ends successfully on the same attempt.
  pairing = false;
  connected = true;
  await clock.advance(1_000);
  await tick();
  const result = await runPromise;
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(startCalls, 1);
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
 * 3c. malformed_input: bad timing options fall back, never hang
 * ------------------------------------------------------------------ */

test('malformed_input: non-finite timeout/poll/retryDelays fall back instead of hanging', async () => {
  const clock = makeFakeClock();
  const restartAt = [];
  const fakeClient = {
    start() { return Promise.resolve(); },
    isConnected() { return false; },
  };
  const prevRestart = global.restartBot;
  global.restartBot = () => { restartAt.push(clock.now()); return Promise.resolve(); };

  try {
    const runPromise = startClientBounded(fakeClient, {
      timeoutMs: NaN,
      pollMs: -1,
      retryDelays: null,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      sleep: clock.sleep,
      log: () => {},
      logError: () => {},
      pushEvent: () => {},
    });
    for (let i = 0; i < 6; i++) {
      await tick();
      await clock.advance(95_000);
      await tick();
    }
    const result = await runPromise;
    assert.equal(result.attempts, 3);
    assert.equal(restartAt[0], 335_000, 'fallback schedule is the documented one');
  } finally {
    if (prevRestart === undefined) delete global.restartBot;
    else global.restartBot = prevRestart;
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

/* ------------------------------------------------------------------ *
 * 5. defect 1 (wiring): index.js passes isPairing: pairingActive
 * ------------------------------------------------------------------ */

test('index.js passes isPairing: pairingActive into startClientBounded', () => {
  const src = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');

  assert.ok(
    /import[^;]*\bpairingActive\b[^;]*from\s*'\.\/system\/webPanel\.js'/.test(src),
    'index.js must import pairingActive from system/webPanel.js (the shared pairing state accessor)'
  );
  assert.ok(
    /startClientBounded\(client,\s*\{[\s\S]*?isPairing:\s*pairingActive,?\s*\}\)/.test(src),
    'index.js must pass isPairing: pairingActive into startClientBounded'
  );
});