/*
  اختبارات وحدة لمُصلح الجلسة (system/healer.js)
  الهدف: نثبت السلوك قبل وبعد التعديل بدون ما نشغّل البوت كله:
    1) 500 close  → علاج (restart)
    2) 401 close  → لا علاج
    3) 440 close  → لا علاج
    4) "Bad MAC"  → علاج
    5) ثلاث قطع متتالية → علاج واحد (نافذة الهدوء)
    6) shouldSkip() → لا علاج
    7) سوكيت جديد → يُربَط ويُشفى
    8) open → يسجّل lastOpen
  وإضافات المهمة:
    9)  أربع قطع 500 متتالية → 3 علاجات + تصعيد واحد (والسبب مميّز)
   10)  open حقيقي يصفّر العدّاد
   11)  stop() يرجّع عدد مستمعي السوكيت القديم لصفرة
   12)  إيقاف/ربط يبدأ بعد الحدث وقبل المؤقّت → العلاج يتلغى (صفر restart)
   13)  تبديل السوكيت يلغي العلاج المعلّق على القديم
   14)  كل علاج/تصعيد ينشر حدث عربي للوحة

  كل الأوقات وهمية (fake clock) — مفيش أي نوم حقيقي.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachHealer } from '../system/healer.js';

/* ------------------------------ ساعة وهمية ------------------------------ */
function makeClock(start = 1_000_000) {
  let t = start;
  let seq = 0;
  const intervals = new Map(); // id -> { fn, ms, next }
  const timeouts = new Map();  // id -> { fn, at }

  return {
    now: () => t,
    setInterval(fn, ms) {
      const id = ++seq;
      intervals.set(id, { fn, ms, next: t + ms });
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn, ms) {
      const id = ++seq;
      timeouts.set(id, { fn, at: t + ms });
      return id;
    },
    clearTimeout(id) { timeouts.delete(id); },
    // يقدّم الوقت ويرتّب المؤقّتات: الأقرب أولًا.
    advance(ms) {
      const end = t + ms;
      for (let guard = 0; guard < 100_000; guard++) {
        let nextAt = Infinity;
        let kind = null;
        let key = null;
        for (const [id, s] of intervals) {
          if (s.next < nextAt) { nextAt = s.next; kind = 'i'; key = id; }
        }
        for (const [id, s] of timeouts) {
          if (s.at < nextAt) { nextAt = s.at; kind = 't'; key = id; }
        }
        if (nextAt > end) break;
        t = nextAt;
        if (kind === 'i') {
          const s = intervals.get(key);
          s.next = t + s.ms;
          s.fn();
        } else {
          const s = timeouts.get(key);
          timeouts.delete(key);
          s.fn();
        }
      }
      t = end;
    },
    pendingTimeouts: () => timeouts.size,
    pendingIntervals: () => intervals.size
  };
}

/* ------------------------------ سوكيت وهمي ------------------------------ */
function makeSock() {
  const ev = new EventEmitter();
  ev.setMaxListeners(100);
  return {
    ev,
    update(u) { ev.emit('connection.update', u); },
    listeners: () => ev.listenerCount('connection.update')
  };
}

function closeEvent(statusCode, message) {
  const error = {};
  if (statusCode != null) error.output = { statusCode };
  if (message != null) error.message = message;
  return { connection: 'close', lastDisconnect: { error } };
}

/**
 * يبني هيلر مع ساعة وهمية وrestart并记录 الأسباب.
 */
function setup(overrides = {}) {
  const clock = makeClock();
  const restarts = [];
  const events = [];
  const client = { sock: makeSock() };
  const healer = attachHealer(client, {
    restart: (reason) => { restarts.push(reason); },
    shouldSkip: () => false,
    quietMs: 30_000,
    pollMs: 800,
    log: () => {},
    emit: (kind, msg) => events.push({ kind, msg }),
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    ...overrides
  });
  // نربط السوكيت الحالي فورًا (بدون انتظار أول دورة polling)
  healer.attach(client.sock);
  return { clock, client, healer, restarts, events, sock: client.sock };
}

/* --------------------------- ٨ سلوكيات الأساس --------------------------- */

test('healer: 500 close يستدعي restart', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0], 'bad-session auto-heal');
  healer.stop();
});

test('healer: 401 close لا يستدعي restart', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(401));
  clock.advance(5000);
  assert.equal(restarts.length, 0);
  healer.stop();
});

test('healer: 440 close لا يستدعي restart', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(440));
  clock.advance(5000);
  assert.equal(restarts.length, 0);
  healer.stop();
});

test('healer: رسالة Bad MAC تستدعي restart', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(null, 'Bad MAC'));
  clock.advance(2001);
  assert.equal(restarts.length, 1);
  healer.stop();
});

test('healer: ثلاث قطع متتالية → restart واحد (نافذة الهدوء)', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(500));
  sock.update(closeEvent(500));
  sock.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 1);
  // بعد ما نافذة الهدوء تخلص، قطع جديد يقدر يعلاج تاني
  clock.advance(30_000);
  sock.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 2);
  healer.stop();
});

test('healer: shouldSkip() → لا restart', () => {
  const { clock, sock, restarts, healer } = setup({ shouldSkip: () => true });
  sock.update(closeEvent(500));
  clock.advance(5000);
  assert.equal(restarts.length, 0);
  healer.stop();
});

test('healer: سوكيت جديد يُربَط ويُشفى', () => {
  const { clock, client, restarts, healer, sock: first } = setup();
  const second = makeSock();
  client.sock = second;
  clock.advance(801);                       // دورة polling
  assert.equal(second.listeners(), 1, 'السوكيت الجديد لازم يتسمع');
  second.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0], 'bad-session auto-heal');
  healer.stop();
  assert.equal(first.listeners(), 0, 'السوكيت القديم لازم يتنظّف');
});

test('healer: open يسجّل lastOpen', () => {
  const { clock, sock, healer } = setup();
  assert.equal(healer.state.lastOpen, 0);
  sock.update({ connection: 'open' });
  assert.equal(healer.state.lastOpen, clock.now());
  healer.stop();
});

/* --------------------------- إضافات المهمة --------------------------- */

test('healer escalation: أربع قطع 500 → 3 علاجات + تصعيد واحد بسبب مميّز', () => {
  const { clock, sock, restarts, healer, events } = setup();
  for (let i = 0; i < 4; i++) {
    sock.update(closeEvent(500));
    clock.advance(2001);      // العلاج المعلّق يضرب
    if (i < 3) clock.advance(30_000); // نافذة هدوء تخلص قبل القطع اللي بعده
  }
  assert.equal(healer.state.heals, 3, 'الحد الأقصى 3 علاجات');
  assert.equal(restarts.length, 4, '3 علاجات + تصعيد واحد');
  assert.equal(restarts.filter((r) => r === 'bad-session auto-heal').length, 3);
  assert.equal(restarts[3], 'bad-session escalation', 'سبب التصعيد مميّز');
  assert.ok(
    events.some((e) => e.kind === 'warn' && /تصعيد/.test(e.msg)),
    'التصعيد لازم ينشر حدث عربي للوحة'
  );
  // مفيش تصعيد مزدوج: قطع خامس ما يضيفش restart جديد
  clock.advance(30_000);
  sock.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 4, 'بعد التصعيد مفيش علاج تاني لحد ما open يرجع');
  healer.stop();
});

test('healer: open حقيقي يصفّر العدّاد ويسمح بعلاج جديد', () => {
  const { clock, sock, restarts, healer } = setup({ openGraceMs: 1000 });
  // علاجان يفشلا (open ما جهوش خلال المهلة)
  for (let i = 0; i < 2; i++) {
    sock.update(closeEvent(500));
    clock.advance(2001);
    clock.advance(1100); // مهلة الـ open تخلص → فشل متتالي
    clock.advance(30_000);
  }
  assert.equal(healer.state.consecutive, 2);
  // رجوع اتصال حقيقي
  sock.update({ connection: 'open' });
  assert.equal(healer.state.consecutive, 0, 'open يصفّر الفشل المتتالي');
  assert.equal(healer.state.heals, 0, 'open يصفّر عدّاد العلاجات');
  sock.update(closeEvent(500));
  clock.advance(2001);
  assert.equal(restarts.length, 3, 'بعد الـ open العلاج رجع يشتغل عادي');
  assert.equal(restarts[2], 'bad-session auto-heal');
  healer.stop();
});

test('healer detach: stop() يرجّع عدد مستمعي السوكيت لصفرة', () => {
  const { sock, healer } = setup();
  assert.equal(sock.listeners(), 1);
  healer.stop();
  assert.equal(sock.listeners(), 0, 'كل مستمع أضفناه لازم يتشال');
});

test('healer detach: تبديل السوكيت يرجّع عدد القديم لصفرة', () => {
  const { clock, client, healer, sock: first } = setup();
  const second = makeSock();
  client.sock = second;
  clock.advance(801);
  assert.equal(first.listeners(), 0, 'المستمع القديم اتشال قبل ربط الجديد');
  assert.equal(second.listeners(), 1);
  healer.stop();
});

test('healer stop: إيقاف يبدأ بعد الحدث وقبل المؤقّت → صفر restart', () => {
  const { clock, sock, restarts, healer } = setup();
  sock.update(closeEvent(500));       // الحدث: اتجدول علاج بعد ثانيتين
  healer.stop();                      // الإيقاف بعد الحدث
  clock.advance(5000);
  assert.equal(restarts.length, 0, 'العلاج المعلّق اتلغى والتنفيذ ما اشتغلش');
  assert.equal(clock.pendingTimeouts(), 0, 'مفيش مؤقّت معلّق بعد الإيقاف');
});

test('healer: shouldSkip وقت إطلاق المؤقّت (مش وقت الحدث) → صفر restart', () => {
  const clock = makeClock();
  const restarts = [];
  let skip = false;
  const client = { sock: makeSock() };
  const healer = attachHealer(client, {
    restart: (r) => restarts.push(r),
    shouldSkip: () => skip,          // يتغيّر بعد الحدث
    quietMs: 30_000,
    pollMs: 800,
    log: () => {},
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout
  });
  healer.attach(client.sock);
  client.sock.update(closeEvent(500)); // الحدث: shouldSkip() كانت false
  skip = true;                         // الإيقاف/الربط بدأ بعد الحدث
  clock.advance(5000);
  assert.equal(restarts.length, 0, 'الفحص لازم يتكرر وقت إطلاق المؤقّت');
  assert.equal(healer.state.heals, 0, 'مفيش علاج اتسجّل');
  assert.equal(clock.pendingTimeouts(), 0, 'المؤقّت اتلغى/اتنفّذ من غير restart');
  healer.stop();
});

test('healer: تبديل السوكيت يلغي العلاج المعلّق على القديم', () => {
  const { clock, client, restarts, healer, sock: first } = setup();
  first.update(closeEvent(500));      // علاج مجدول على الأول
  client.sock = makeSock();           // سوكيت جديد
  clock.advance(801);                 // دورة polling
  clock.advance(5000);                // مؤقّت العلاج القديم كان المفروض يضرب
  assert.equal(restarts.length, 0, 'العلاج القديم اتلغى مع تبديل السوكيت');
  healer.stop();
});