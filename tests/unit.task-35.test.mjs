/**
 * tests/unit.task-35.test.mjs — todo 35: truthful liveness + restart outcome
 * ==========================================================================================
 * يثبت (بقيم/أحداث، مش لوجات) إن:
 *   1) socket ws.readyState === 1 + sock.user + open قريب => alive.
 *   2) ws.readyState === 3 (أو running===true مع سوكيت مقفول) => NOT alive —
 *      الحالة اللي client.isConnected() بيقول فيها "متصل" وهي كذبة.
 *   3) open أقدم من 3 دقايق => not alive.
 *   4) 10 دقايق من غير حركة مرور => degraded (حدث لوحة، مش ريستارت).
 *   5) بعد إعادة تشغيل: open حقيقي => "تمت إعادة الاتصال"؛ مفيش open خلال
 *      المهلة => "فشلت إعادة الاتصال" + تسليم واحد بالظبط للسلّم المشترك.
 *   + stale_state: close بعد آخر open يلغي الحياة حتى لو الـ open قريب.
 *   + cancel_resume: مفيش waiter ولا مؤقّت معلّق بعد انتهاء المهلة.
 *
 * ساعة وهمية/ مؤقّتات وهمية بالكامل — مفيش نوم حقيقي، ومفيش بوت بيقلع.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
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

test('liveness: ws CLOSED (or running=true on a dead socket) => NOT alive, while isConnected() lies', () => {
  const clock = makeClock();
  const client = makeClient(3);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  // الإطار بيقول "متصل" (running + sock.user) — الكذبة الأصلية
  assert.equal(client.isConnected(), true);
  assert.equal(isSocketOpen(client), false);
  assert.equal(isAlive(client, clock.now()), false);
  live.stop();
});

test('liveness: an open older than 3 minutes => not alive (stale_state)', () => {
  const clock = makeClock();
  const client = makeClient(1);
  const live = attach(client, clock);
  client.update({ connection: 'open' });
  assert.equal(isAlive(client, clock.now()), true);
  clock.advance(OPEN_WINDOW_MS + 1);
  assert.equal(isAlive(client, clock.now()), false, 'open قديم ما يخلّيش سوكيت ميت "حي"');
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