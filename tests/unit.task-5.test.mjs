/*
 * tests/unit.task-5.test.mjs — todo 5
 * "Repeat the periodic restart, cap presence intervals, validate env numbers"
 *
 * كل الحالات هنا بتستخدم ساعة ومؤقّتات مزروعة (fake clock) — مفيش أي نوم
 * حقيقي ولا تشغيل للبوت، فمفيش flakiness.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseNumEnv } from '../system/config.js';
import {
  createPeriodicRestartScheduler,
  createPresenceCap,
  installPresenceCap,
  PRESENCE_INTERVAL_MS,
} from '../system/runtime-controls.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

/* ─────────────── helpers ─────────────── */

/** ساعة مزروعة: مؤقّتات ووقت بدل 시간 حقيقي. */
function createFakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  let created = 0;

  function setTimer(fn, ms) {
    const id = ++seq;
    created += 1;
    timers.set(id, { id, at: now + Math.max(0, Number(ms) || 0), every: 0, fn });
    return id;
  }
  function clearTimer(id) { timers.delete(id); }
  function setInterval(fn, ms) {
    const every = Math.max(1, Number(ms) || 1);
    const id = ++seq;
    created += 1;
    timers.set(id, { id, at: now + every, every, fn });
    return id;
  }
  function clearInterval(id) { timers.delete(id); }

  async function advance(ms) {
    const target = now + ms;
    for (;;) {
      let next = null;
      for (const t of timers.values()) {
        if (t.at > target) continue;
        if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
      }
      if (!next) break;
      now = next.at;
      if (next.every > 0) {
        next.at = now + next.every;   // مؤقّت متكرّر: يفضل مجدوَل
      } else {
        timers.delete(next.id);
      }
      await next.fn();
      // flush للـ microtasks (زي await Promise.resolve بس أعمق)
      await new Promise((r) => setImmediate(r));
    }
    now = target;
    await new Promise((r) => setImmediate(r));
  }

  return {
    now: () => now,
    setTimer,
    clearTimer,
    setInterval,
    clearInterval,
    advance,
    pending: () => timers.size,
    createdTimers: () => created,
  };
}

/** سوكيت مزروع: بيعدّ الإرسالات اللي وصلته فعلاً (Presence SENDs). */
function makeFakeSocket(label = 'sock') {
  const sends = [];
  return {
    label,
    user: { id: `${label}:1` },
    sends,
    async sendPresenceUpdate(kind) {
      sends.push(kind);
      return true;
    },
  };
}

/** محاكاة interval presence اللي الإطار (meowsab) بيضيفه جوه كل start(). */
function simulateFrameworkPresence(clock, client) {
  return clock.setInterval(() => {
    const sock = client?.sock;
    if (sock?.user) sock.sendPresenceUpdate('available');
  }, PRESENCE_INTERVAL_MS);
}

function readSource(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

/* ─────────────── 1) env parsing ─────────────── */

test('env parsing: an invalid number warns in Arabic and falls back (never silently 0)', () => {
  const warnings = [];
  const env = { RESTART_INTERVAL_MIN: 'abc' };
  const value = parseNumEnv('RESTART_INTERVAL_MIN', 10, {
    min: 0, max: 1440, env, warn: (m) => warnings.push(m),
  });
  assert.equal(value, 10, 'invalid value must fall back to 10');
  assert.equal(warnings.length, 1);
  assert.ok(
    warnings[0].includes('قيمة RESTART_INTERVAL_MIN غير صالحة، استخدمت 10'),
    `Arabic warning expected, got: ${warnings[0]}`,
  );
});

test('env parsing: negative clamps to min, 0 is honoured, valid values pass through', () => {
  const warnings = [];
  const opts = (env) => ({ min: 0, max: 1440, env, warn: (m) => warnings.push(m) });

  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({ RESTART_INTERVAL_MIN: '-5' })), 0);
  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({ RESTART_INTERVAL_MIN: '0' })), 0);
  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({ RESTART_INTERVAL_MIN: '15' })), 15);
  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({})), 10, 'missing var -> fallback, no warning');
  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({ RESTART_INTERVAL_MIN: '' })), 10, 'empty -> fallback');
  assert.equal(parseNumEnv('RESTART_INTERVAL_MIN', 10, opts({ RESTART_INTERVAL_MIN: '99999' })), 1440, 'max clamp');
  assert.equal(warnings.length, 1, 'only the empty value warns; clamping is not an invalid value');
});

test('env parsing: the default logger prints the Arabic warning to the console', () => {
  const original = console.warn;
  const lines = [];
  console.warn = (m) => lines.push(String(m));
  try {
    const value = parseNumEnv('RESTART_INTERVAL_MIN', 10, {
      min: 0, max: 1440, env: { RESTART_INTERVAL_MIN: 'abc' },
    });
    assert.equal(value, 10);
  } finally {
    console.warn = original;
  }
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('قيمة RESTART_INTERVAL_MIN غير صالحة، استخدمت 10'), lines[0]);
});

test('env parsing: every guarded env var is parsed with parseNumEnv', () => {
  const warnings = [];
  const env = {
    MEMORY_RESTART_MB: 'abc',
    RESTART_FULL_EVERY: 'xyz',
    WATCHDOG_INTERVAL_S: 'soon',
  };
  const opts = { env, warn: (m) => warnings.push(m) };
  assert.equal(parseNumEnv('MEMORY_RESTART_MB', 950, { ...opts, min: 0, max: 65536 }), 950);
  assert.equal(parseNumEnv('RESTART_FULL_EVERY', 2, { ...opts, min: 1, max: 100 }), 2);
  assert.equal(parseNumEnv('WATCHDOG_INTERVAL_S', 60, { ...opts, min: 5, max: 3600 }), 60);
  assert.equal(warnings.length, 3);
  for (const name of ['MEMORY_RESTART_MB', 'RESTART_FULL_EVERY', 'WATCHDOG_INTERVAL_S']) {
    assert.ok(warnings.some((w) => w.includes(`قيمة ${name} غير صالحة`)), `missing warning for ${name}`);
  }
});

/* ─────────────── 2) periodic restart repeats ─────────────── */

test('periodic restart repeats: two periods fire twice and the schedule re-arms after each restart', async () => {
  const clock = createFakeClock();
  const calls = [];
  const scheduler = createPeriodicRestartScheduler({
    intervalMs: 60_000,
    restart: async (reason) => { calls.push(reason); },
    isStopped: () => false,
    isRestarting: () => false,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
    logError: () => {},
  });

  assert.equal(scheduler.start(), true);
  assert.equal(scheduler.isArmed(), true);

  await clock.advance(60_000);
  assert.equal(calls.length, 1, 'the first period must fire exactly once');
  assert.equal(scheduler.isArmed(), true, 'the schedule must re-arm after the restart completed');

  await clock.advance(60_000);
  assert.equal(calls.length, 2, 'the second period must fire again (repeat, not one-shot)');
  assert.equal(scheduler.stats().fires, 2);
  assert.equal(scheduler.stats().restarts, 2);
  assert.equal(scheduler.stats().errors, 0);
  assert.equal(scheduler.isArmed(), true, 'the schedule stays armed for the next period');
});

test('periodic restart: never fires while the bot is stopped, and still re-arms', async () => {
  const clock = createFakeClock();
  const calls = [];
  const scheduler = createPeriodicRestartScheduler({
    intervalMs: 60_000,
    restart: async (reason) => { calls.push(reason); },
    isStopped: () => true,
    isRestarting: () => false,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
    logError: () => {},
  });
  scheduler.start();

  await clock.advance(60_000);
  assert.equal(calls.length, 0, 'a stopped bot must not be restarted');
  assert.equal(scheduler.stats().skippedStopped, 1);
  assert.equal(scheduler.isArmed(), true, 'the schedule must survive a skipped period');
});

test('periodic restart: skips while another restart is in flight, then fires when it is free', async () => {
  const clock = createFakeClock();
  const calls = [];
  let busy = true;
  const scheduler = createPeriodicRestartScheduler({
    intervalMs: 60_000,
    restart: async (reason) => { calls.push(reason); },
    isStopped: () => false,
    isRestarting: () => busy,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
    logError: () => {},
  });
  scheduler.start();

  await clock.advance(60_000);
  assert.equal(calls.length, 0, 'no second restart while one is in flight');
  assert.equal(scheduler.stats().skippedBusy, 1);
  assert.equal(scheduler.isArmed(), true);

  busy = false;
  await clock.advance(60_000);
  assert.equal(calls.length, 1, 'the next period fires once the ladder is free');
});

test('periodic restart: interval 0 means off (no timer, no restart)', async () => {
  const clock = createFakeClock();
  const calls = [];
  const scheduler = createPeriodicRestartScheduler({
    intervalMs: 0,
    restart: async (reason) => { calls.push(reason); },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
    logError: () => {},
  });
  assert.equal(scheduler.start(), false);
  assert.equal(scheduler.isArmed(), false);
  await clock.advance(10 * 60 * 1000);
  assert.equal(calls.length, 0);
  assert.equal(scheduler.stats().fires, 0);
});

/* ─────────────── 3) presence: at most ONE send per tick ─────────────── */

test('single presence send: after one restart exactly one presence SEND reaches the socket per 25s tick', async () => {
  const clock = createFakeClock();
  const client = { sock: null };
  const cap = installPresenceCap(client, {
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
  });

  // start #1: الإطار حطّ سوكيت جديد وبعدين ضاف interval presence بتاعه.
  // الترتيب مهم: بنقيس عدد مؤقّتاتنا المملوكة قبل محاكاة مؤقّت الإطار.
  const sock1 = makeFakeSocket('sock1');
  client.sock = sock1;
  const ownedTimersAfterFirstStart = clock.createdTimers();
  assert.equal(ownedTimersAfterFirstStart, 1, 'exactly ONE owned presence interval must exist');
  simulateFrameworkPresence(clock, client);

  await clock.advance(PRESENCE_INTERVAL_MS);
  assert.equal(sock1.sends.length, 1, 'exactly one presence SEND per tick, not two');
  assert.deepEqual(sock1.sends, ['available']);
  assert.equal(cap.stats().sends, 1);
  assert.equal(cap.stats().suppressed, 1, 'the framework duplicate must be counted as suppressed');

  // restart: الإطار عمل start تاني → سوكيت جديد + interval presence تاني
  const sock2 = makeFakeSocket('sock2');
  client.sock = sock2;
  const ownedBeforeSecondFrameworkTimer = clock.createdTimers();
  simulateFrameworkPresence(clock, client);
  assert.equal(cap.stats().wraps, 2, 'the new socket must be wrapped again');
  assert.equal(
    clock.createdTimers(),
    ownedBeforeSecondFrameworkTimer + 1,
    'only the framework adds a timer after a restart — no second owned interval',
  );

  await clock.advance(PRESENCE_INTERVAL_MS);
  assert.equal(sock2.sends.length, 1, 'still exactly one presence SEND per tick after a restart');
  assert.equal(sock1.sends.length, 1, 'the old socket must not receive presence any more');
  assert.equal(cap.stats().sends, 2);
  // بعد الريستارت فيه interval اتنين مسرّبين من الإطار (القديم + الجديد) —
  // الاتنين بيتكبحوا، والمسموح بيه SEND واحد بس من مؤقّتنا.
  assert.equal(cap.stats().suppressed, 3, 'both leaked framework intervals must be counted as suppressed');
  assert.ok(cap.stats().suppressed >= 2, 'suppressed duplicates must be provable');
  assert.equal(cap.stats().ownedTimer, true);
});

test('single presence send: the framework timer is untouched (runtime wrapper only) and the counter keeps growing', async () => {
  const framework = path.join(repoRoot, 'node_modules', 'meowsab', 'dist', 'index.cjs');
  const source = fs.readFileSync(framework, 'utf8');
  assert.ok(
    source.includes('sendPresenceUpdate("available")'),
    'node_modules/meowsab must not be modified — the framework keeps its own interval',
  );

  const clock = createFakeClock();
  const client = { sock: null };
  const cap = installPresenceCap(client, {
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
  });
  const sock = makeFakeSocket('sock');
  client.sock = sock;
  // three framework intervals = three starts
  simulateFrameworkPresence(clock, client);
  simulateFrameworkPresence(clock, client);
  simulateFrameworkPresence(clock, client);

  await clock.advance(PRESENCE_INTERVAL_MS);
  assert.equal(sock.sends.length, 1, 'three framework intervals must still produce ONE send per tick');
  assert.equal(cap.stats().suppressed, 3, 'the two extra duplicates must be counted');
  assert.equal(cap.stats().sends, 1);

  await clock.advance(PRESENCE_INTERVAL_MS);
  assert.equal(sock.sends.length, 2);
  assert.equal(cap.stats().suppressed, 6);
  assert.equal(cap.stats().sends, 2);
});

test('single presence send: interactive presence (composing) still passes through', async () => {
  const clock = createFakeClock();
  const client = { sock: null };
  const cap = installPresenceCap(client, {
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
  });
  const sock = makeFakeSocket('sock');
  client.sock = sock;

  await sock.sendPresenceUpdate('composing');
  assert.deepEqual(sock.sends, ['composing']);
  assert.equal(cap.stats().passes, 1);
  assert.equal(cap.stats().suppressed, 0);
});

test('presence cap: no presence is sent while the socket has no user (not connected)', async () => {
  const clock = createFakeClock();
  const cap = createPresenceCap({
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    now: clock.now,
    log: () => {},
  });
  const sock = makeFakeSocket('sock');
  sock.user = undefined;
  cap.capture(sock);

  await clock.advance(PRESENCE_INTERVAL_MS);
  assert.equal(sock.sends.length, 0, 'no presence without a logged-in user');
  assert.equal(cap.stats().sends, 0);
});

/* ─────────────── 4) wiring (source scans) ─────────────── */

test('wiring: index.js routes the periodic restart through the shared ladder and re-arms it', () => {
  const src = readSource('index.js');
  assert.ok(src.includes('createPeriodicRestartScheduler'), 'the scheduler must be used');
  assert.ok(src.includes('restart: (reason) => global.restartBot(reason)'), 'must go through global.restartBot');
  assert.ok(!src.includes('setTimeout(() => restartBot(`كل'), 'the one-shot periodic setTimeout must be gone');
  assert.ok(!/^\s*(await\s+)?client\.restart\(/m.test(src), 'no direct client.restart() — the ladder is the only path');
  assert.ok(src.includes('isStopped:'), 'the scheduler must honour panelRuntime().stopped');
  assert.ok(src.includes('isRestarting:'), 'the scheduler must skip while a restart is in flight');
  assert.ok(/panelRuntime\(\)/.test(src), 'the stop flag must come from the panel runtime');
  assert.ok(/\.stopped\b/.test(src), 'the scheduler must read the panel stop flag');
});

test('wiring: index.js parses every numeric env var with parseNumEnv', () => {
  const src = readSource('index.js');
  assert.ok(src.includes("parseNumEnv('RESTART_INTERVAL_MIN', 10"));
  assert.ok(src.includes("parseNumEnv('MEMORY_RESTART_MB', 950"));
  assert.ok(src.includes("parseNumEnv('RESTART_FULL_EVERY', 2"));
  assert.ok(src.includes("parseNumEnv('WATCHDOG_INTERVAL_S', 60"));
  assert.ok(!src.includes('Number(process.env.MEMORY_RESTART_MB'), 'the old `|| 0` parsing must be gone');
  assert.ok(!/Number\(process\.env\.RESTART_INTERVAL_MIN\)/.test(src), 'the old RESTART_INTERVAL_MIN parsing must be gone');
  assert.ok(src.includes('WATCHDOG_INTERVAL_S * 1000'), 'the watchdog must use the parsed interval');
});

test('wiring: the presence cap is installed at runtime and its counter is exposed', () => {
  const src = readSource('index.js');
  assert.ok(src.includes('installPresenceCap(client'), 'the presence cap must be installed');
  assert.ok(src.includes('global.presenceStats'), 'the suppressed-duplicate counter must be exposed');
  // حديث فقط: مفيش أي كتابة على قرص في مسار node_modules/meowsab (الغلاف runtime).
  assert.ok(!/(writeFileSync|appendFileSync|copyFileSync|rmSync)\([^)]*node_modules/.test(src), 'the framework must not be patched on disk');
});

test('wiring: the shield, the device fingerprint and the ladder survive', () => {
  const src = readSource('index.js');
  assert.ok(src.includes('const BOT_SHIELD = process.env.BOT_SHIELD'), 'BOT_SHIELD must stay');
  assert.ok(src.includes('🔎 بصمة الجهاز'), 'the fingerprint log must stay');
  assert.ok(src.includes('buildConfig()') && src.includes('buildInfo()'), 'buildConfig/buildInfo must stay');
  assert.ok(src.includes("from './system/restart-ladder.js'"), 'the restart ladder must stay');
  assert.ok(src.includes("from './system/sessionBackup.js'"), 'the session backup must stay');
});
