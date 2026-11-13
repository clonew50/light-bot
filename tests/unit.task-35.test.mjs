/**
 * tests/unit.task-35.test.mjs — todo 35: truthful liveness + restart outcome
 * ==========================================================================================
 * يثبت (بقيم/أحداث، مش لوجات) إن:
 *   1) قبل أول open (حتى مع ws.readyState === 1 + sock.user) => NOT alive.
 *   2) ws.readyState === 1 + sock.user + open اتسجّل => ALIVE (مهما طال الزمن من
 *      غير قطع، حتى بعد 10 دقايق صمت).
 *   3) ws.readyState === 3 أو 2 (أو running===true مع سوكيت مقفول) => NOT alive
 *      فورًا — الحالة اللي client.isConnected() بيقول فيها "متصل" وهي كذبة.
 *   4) 10 دقايق من غير حركة مرور => degraded: true + حدث لوحة عربي (مع بقاء
 *      isAlive === true و NO restart).
 *   5) بعد إعادة تشغيل: open حقيقي => "تمت إعادة الاتصال"؛ مفيش open خلال
 *      المهلة => "فشلت إعادة الاتصال" + تسليم واحد بالظبط للسلّم المشترك.
 *   + stale_state / socket swap: تبديل client.sock يلغي آخر open القديم؛
 *     السوكيت الجديد بيتسمع open بتاعه الحقيقي وwaitForOpen بيرصده.
 *   + watchdog/panel/healer wiring: مثبّت إن الـ watchdog بيستخدم isAlive(client)
 *     مش client.isConnected?.() (لو اترجع client.isConnected?.() في الـ watchdog
 *     بيفشل الاختبار فورًا).
 *
 * ساعة وهمية/ مؤقّتات وهمية بالكامل — مفيش نوم حقيقي، ومفيش بوت بيقلع.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const {
  isAlive,
  attachLiveness,
  verifyRestartOutcome,
  livenessStatus,
  isSocketOpen,
  OPEN_WINDOW_MS,
  DEGRADED_AFTER_MS,
} = await import(pathToFileURL(path.join(repoRoot, 'system', 'liveness.js')).href);

const panel = await import(pathToFileURL(path.join(repoRoot, 'system', 'webPanel.js')).href);
const { computeConnected, handleConnectionUpdate } = panel;

/* ------------------------------ ساعة وهمية ------------------------------ */
function makeClock(start = 1_700_000_000_000) {
  let t = start;
  let seq = 0;
  const intervals = new Map();
  const timeouts = new Map();
  return {
    now: () => t,
    setInterval(fn, ms) { const id = ++seq; intervals.set(id, { fn, ms, next: t + ms }); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn, ms) { const id = ++seq; timeouts.set(id, { fn, at: t + ms }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    advance(ms) {
      const end = t + ms;
      for (let guard = 0; guard < 100_000; guard++) {
        let nextAt = Infinity, kind = null, key = null;
        for (const [id, s] of intervals) if (s.next < nextAt) { nextAt = s.next; kind = 'i'; key = id; }
        for (const [id, s] of timeouts) if (s.at < nextAt) { nextAt = s.at; kind = 't'; key = id; }
        if (nextAt > end) break;
        t = nextAt;
        if (kind === 'i') { const s = intervals.get(key); s.next = t + s.ms; s.fn(); }
        else { const s = timeouts.get(key); timeouts.delete(key); s.fn(); }
      }
      t = end;
    },
    pendingTimeouts: () => timeouts.size,
    pendingIntervals: () => intervals.size,
  };
}

/* ------------------------------ عميل وهمي ------------------------------ */
// يحاكي client.isConnected() بالظبط: running + sock + sock.user — من غير أي
// اعتبار لـ ws.readyState، عشان نثبت إنه بيكدب.
function makeClient(readyState = 1) {
  const ev = new EventEmitter();
  ev.setMaxListeners(100);
  const ws = { readyState, addEventListener() {}, send() {} };
  const client = {
    running: true,
    sock: { ws, user: { id: '1:2' }, ev },
    isConnected() { return this.running && this.sock !== null && this.sock.user !== undefined; },
  };
  client.update = (u) => ev.emit('connection.update', u);
  return client;
}

function attach(client, clock, events = []) {
  return attachLiveness(client, {
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    emit: (kind, message) => events.push({ kind, message }),
  });
}

const flush = () => new Promise((r) => setImmediate(r));

/* ------------------------------------------------------------------ *
 * 1. إشارة الحياة الأساسية
 * ------------------------------------------------------------------ */

test('liveness: ws OPEN + user + recent open => alive', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  assert.equal(isSocketOpen(client), true);
  assert.equal(isAlive(client, clock.now()), true);
  assert.equal(live.status(clock.now()).alive, true);
  live.stop();
});

test('liveness: before the first open => not alive even with ws OPEN + user', () => {
  const clock = makeClock();
  const client = makeClient(1); // ws OPEN + user + running=true, but NO 'open' event yet
  const live = attach(client, clock);
  assert.equal(isSocketOpen(client), true);
  assert.equal(isAlive(client, clock.now()), false, 'before the first open, isAlive must be false');
  assert.equal(live.status(clock.now()).alive, false);
  live.stop();
});

test('liveness: closed/closing socket (readyState 3 or 2) => NOT alive immediately', () => {
  const clock = makeClock();
  const client = makeClient(3);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  assert.equal(client.isConnected(), true, 'framework claims connected');
  assert.equal(isSocketOpen(client), false);
  assert.equal(isAlive(client, clock.now()), false, 'readyState 3 is not alive immediately');
  client.sock.ws.readyState = 2;
  assert.equal(isAlive(client, clock.now()), false, 'readyState 2 is not alive immediately');
  live.stop();
});

test('liveness: healthy open socket with 10 min of silence => ALIVE and NOT restarted', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const events = [];
  const live = attach(client, clock, events);
  client.update({ connection: 'open' });
  const openAt = live.tracker.lastOpenAt;
  assert.equal(isAlive(client, clock.now()), true);
  // 10+ minutes of silence ( > OPEN_WINDOW_MS ) on a healthy open socket:
  clock.advance(OPEN_WINDOW_MS + 1);
  assert.equal(isSocketOpen(client), true);
  assert.equal(isAlive(client, clock.now()), true, 'established open socket stays alive past 3 minutes');
  assert.equal(live.status(clock.now()).alive, true);
  assert.equal(live.tracker.lastOpenAt, openAt);
  live.stop();
});

test('liveness: a close after the last open => not alive even with a recent open', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  clock.advance(1_000);
  client.update({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } });
  assert.equal(isAlive(client, clock.now()), false);
  live.stop();
});

test('liveness: socket swap resets open expectation until a real open on the new socket is observed', async () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  const events = [];
  const handoffs = [];

  client.update({ connection: 'open' });
  const oldOpenAt = live.tracker.lastOpenAt;
  clock.advance(2_000);

  // Framework swaps client.sock for a new connecting socket
  const ev2 = new EventEmitter();
  ev2.setMaxListeners(100);
  const sock2 = { ws: { readyState: 0, addEventListener() {}, send() {} }, user: undefined, ev: ev2 };
  client.sock = sock2;
  clock.advance(1_000);
  live.beat();
  assert.equal(isAlive(client, clock.now()), false, 'old lastOpenAt must not keep a swapped connecting socket alive');

  // Restart completes by opening sock2 with a real open event
  const ok = await verifyRestartOutcome(client, {
    restart: async () => {
      sock2.ws.readyState = 1;
      sock2.user = { id: '1:2' };
      ev2.emit('connection.update', { connection: 'open' });
    },
    restartBot: (reason) => handoffs.push(reason),
    emit: (kind, message) => events.push({ kind, message }),
    now: clock.now,
    timeoutMs: 5_000,
    setTimer: clock.setTimeout,
    clearTimer: clock.clearTimeout,
  });
  assert.ok(live.tracker.lastOpenAt > oldOpenAt, 'open on new socket must update lastOpenAt');
  assert.equal(isAlive(client, clock.now()), true);
  assert.equal(ok, true);
  assert.equal(events.at(-1).message, 'تمت إعادة الاتصال');
  assert.equal(handoffs.length, 0);
  live.stop();
});

/* ------------------------------------------------------------------ *
 * 2. النبضة / degraded
 * ------------------------------------------------------------------ */

test('liveness: 10 minutes without traffic => degraded (Arabic event, no restart)', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const events = [];
  const live = attach(client, clock, events);
  client.update({ connection: 'open' });
  assert.equal(live.status(clock.now()).degraded, false);
  clock.advance(DEGRADED_AFTER_MS + 1);   // النبضة (30s) بتضرب في الطريق
  const status = live.status(clock.now());
  assert.equal(status.degraded, true);
  assert.equal(status.alive, true, 'degraded must NOT make isAlive() false');
  assert.equal(isAlive(client, clock.now()), true);
  assert.ok(status.silenceMs > DEGRADED_AFTER_MS);
  assert.ok(events.some((e) => /راكد/.test(e.message)), 'لازم حدث عربي للوحة');
  assert.ok(events.some((e) => /من غير ريستارت/.test(e.message)), 'degraded مش ريستارت');
  live.stop();
});

test('liveness: traffic resets the degraded state', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  clock.advance(DEGRADED_AFTER_MS + 1);
  assert.equal(live.status(clock.now()).degraded, true);
  client.sock.ev.emit('messages.upsert', { messages: [] });
  assert.equal(live.status(clock.now()).degraded, false);
  live.stop();
});

/* ------------------------------------------------------------------ *
 * 3. نتيجة إعادة التشغيل (بصدق)
 * ------------------------------------------------------------------ */

test('restart outcome: a real open => "تمت إعادة الاتصال" and zero hand-offs', async () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  const events = [];
  const handoffs = [];

  const ok = await verifyRestartOutcome(client, {
    restart: async () => { client.update({ connection: 'open' }); },
    restartBot: (reason) => handoffs.push(reason),
    emit: (kind, message) => events.push({ kind, message }),
    now: clock.now,
    setTimer: clock.setTimeout,
    clearTimer: clock.clearTimeout,
  });

  assert.equal(ok, true);
  assert.equal(events.at(-1).message, 'تمت إعادة الاتصال');
  assert.equal(handoffs.length, 0, 'مفيش تسليم للسلّم لما الاتصال رجع');
  assert.equal(live.tracker.openWaiters.size, 0);
  live.stop();
});

test('restart outcome: no open within the grace => "فشلت إعادة الاتصال" + exactly ONE hand-off', async () => {
  const clock = makeClock();
  const client = makeClient(3);   // سوكيت مقفول، ومفيش open
  const live = attach(client, clock);
  const events = [];
  const handoffs = [];

  const pending = verifyRestartOutcome(client, {
    restart: async () => { /* restart صامت/مبيفتحش */ },
    restartBot: (reason) => handoffs.push(reason),
    emit: (kind, message) => events.push({ kind, message }),
    now: clock.now,
    timeoutMs: 1_000,
    setTimer: clock.setTimeout,
    clearTimer: clock.clearTimeout,
  });

  await flush();                 // restart() + إعداد مؤقّت المهلة
  clock.advance(1_001);          // المهلة خلصت
  const ok = await pending;

  assert.equal(ok, false);
  assert.equal(events.at(-1).message, 'فشلت إعادة الاتصال');
  assert.equal(handoffs.length, 1, 'تسليم واحد بالظبط للسلّم المشترك');
  assert.equal(handoffs[0], 'restart-outcome-failed');
  // cancel_resume: مفيش waiter ولا مؤقّت معلّق بعد الفشل
  assert.equal(live.tracker.openWaiters.size, 0);
  assert.equal(clock.pendingTimeouts(), 0);
  live.stop();
});

test('restart outcome: running=true but socket closed is still a failure (misleading success)', async () => {
  const clock = makeClock();
  const client = makeClient(3);
  const events = [];
  const handoffs = [];
  const pending = verifyRestartOutcome(client, {
    restart: async () => { client.running = true; }, // الإطار بيقول running
    restartBot: (reason) => handoffs.push(reason),
    emit: (kind, message) => events.push({ kind, message }),
    now: clock.now,
    timeoutMs: 500,
    setTimer: clock.setTimeout,
    clearTimer: clock.clearTimeout,
  });
  await flush();
  clock.advance(501);
  const ok = await pending;
  assert.equal(ok, false);
  assert.equal(events.at(-1).message, 'فشلت إعادة الاتصال');
  assert.equal(handoffs.length, 1);
});

/* ------------------------------------------------------------------ *
 * 4. اللوحة بتقري من نفس الوحدة (نفس المفاتيح، مصدر قيمة واحد)
 * ------------------------------------------------------------------ */

test('panel computeConnected uses the shared liveness helper (not client.isConnected)', () => {
  const quiet = (fn) => { const o = console.log; console.log = () => {}; try { return fn(); } finally { console.log = o; } };
  quiet(() => handleConnectionUpdate({ connection: 'open' })); // baseline للوحة
  const alive = makeClient(1);
  const dead = makeClient(3);
  assert.equal(alive.isConnected(), true);
  assert.equal(quiet(() => computeConnected(alive)), true);
  assert.equal(dead.isConnected(), true, 'الإطار بيكدب على السوكيت المقفول');
  assert.equal(quiet(() => computeConnected(dead)), false);

  const panelSrc = readFileSync(path.join(repoRoot, 'system', 'webPanel.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(panelSrc, /client\.isConnected/, 'webPanel.js must not call client.isConnected');
  assert.match(panelSrc, /from '\.\/liveness\.js'/);
});

test('healer consults isAlive from the shared liveness helper (not client.isConnected)', () => {
  const healerSrc = readFileSync(path.join(repoRoot, 'system', 'healer.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(healerSrc, /client\.isConnected/, 'healer.js must not call client.isConnected');
  assert.match(healerSrc, /from '\.\/liveness\.js'/);
  assert.match(healerSrc, /isAlive\(client,\s*now\(\)\)/);
});

test('watchdog wiring in index.js uses isAlive(client) and does not skip when isConnected() lies', async () => {
  const indexSrc = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
  const wdStart = indexSrc.indexOf("if (process.env.WATCHDOG !== '0')");
  const wdEnd = indexSrc.indexOf('MEMORY_RESTART_MB', wdStart);
  assert.ok(wdStart >= 0 && wdEnd > wdStart, 'watchdog block missing in index.js');
  const wdBlock = indexSrc.slice(wdStart, wdEnd);
  const wdCode = wdBlock.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // 1) Static check on the watchdog block: must use isAlive(client), never client.isConnected?.()
  assert.match(
    wdCode,
    /if\s*\(\s*isAlive\(client\)\s*\)\s*return;/,
    'index.js watchdog must check if (isAlive(client)) return;'
  );
  assert.doesNotMatch(
    wdCode,
    /if\s*\(\s*client\.isConnected\??\(\)\s*\)\s*return;/,
    'index.js watchdog must NOT use client.isConnected?.()'
  );

  // 2) Dynamic check driving the watchdog tick callback with a fake client whose
  //    isConnected() returns TRUE while isAlive() returns FALSE (socket closed / no open yet).
  const fnMatch = wdCode.match(/setInterval\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*WATCHDOG_INTERVAL_S\s*\*\s*1000\)/);
  assert.ok(fnMatch, 'watchdog setInterval callback missing');
  const tickBody = fnMatch[1].replace('if (isAlive(client)) return;', 'if (__isAlive(client)) return;');

  const clock = makeClock();
  for (const readyState of [3, 1]) {
    const fakeClient = makeClient(readyState);
    const live = attach(fakeClient, clock);
    if (readyState === 1) {
      // readyState 1 but NO open event yet => framework isConnected()=true, isAlive()=false
      assert.equal(fakeClient.isConnected(), true);
      assert.equal(isAlive(fakeClient, clock.now()), false);
    }
    let verifyCalls = 0;
    let restartCalls = 0;
    const savedRestart = global.restartBot;
    global.restartBot = () => { restartCalls++; };
    const tickFn = new Function(
      'client',
      'Date',
      'panelRuntime',
      'pairingActive',
      '__isAlive',
      'isAlive',
      'verifyRestartOutcome',
      'pushRuntimeEvent',
      'BOOT_AT',
      'NEEDS_BOOT_MS',
      'COOLDOWN_MS',
      'lastWatchdogRestart',
      'outcomePending',
      'verifyRestartOutcomeMock',
      tickBody.replace(
        /void\s+verifyRestartOutcome\(client,[\s\S]*?\)\.catch\([\s\S]*?\)\.finally\([\s\S]*?\);/,
        'verifyRestartOutcomeMock(client);'
      )
    );
    tickFn(
      fakeClient,
      { now: () => clock.now() },
      () => ({ stopped: false }),
      () => false,
      (c) => isAlive(c, clock.now()),
      isAlive,
      verifyRestartOutcome,
      () => {},
      clock.now() - 10 * 60 * 1000,
      5 * 60 * 1000,
      5 * 60 * 1000,
      0,
      false,
      () => { verifyCalls++; }
    );
    global.restartBot = savedRestart;
    live.stop();
    assert.equal(
      verifyCalls,
      1,
      `watchdog tick must NOT skip when readyState=${readyState} (isConnected=true, isAlive=false)`
    );
  }
});

test('livenessStatus exposes the value keys the consumers read', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  const s = livenessStatus(client, clock.now());
  for (const k of ['alive', 'socketOpen', 'degraded', 'lastOpenAt', 'lastCloseAt', 'lastTrafficAt']) {
    assert.ok(k in s, 'مفتاح ناقص: ' + k);
  }
  assert.equal(s.socketOpen, true);
  live.stop();
});