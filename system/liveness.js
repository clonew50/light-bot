/*
  ═══════════════════════════════════════════
  💓 إشارة الحياة الحقيقية (Liveness)
  ───────────────────────────────────────────
  المشكلة: client.isConnected() بيقرأ `running` و `sock` و `sock.user` بس.
  لما واتساب يقفل الجلسة بـ badSession الإطار بيعمل cleanup للـ WebSocket
  ويسيب `sock` و `sock.user` موجودين — فـ isConnected() بتفضل تقول "متصل"
  والبوت ميت. النتيجة: الـ watchdog ("if (client.isConnected?.()) return;")
  ما بيطلقش، واللوحة بتقول "متصل ✅" while the bot is dead.

  الحل: إشارة واحدة مشتركة بتعتمد على الحاجات اللي الإطار مش بيقدر يكدب فيها:
    1) socket.ws.readyState === 1 (WebSocket.OPEN) — السوكيت مقفول = مش عايش.
    2) sock.user موجود (جلسة واتساب حقيقية، مش مجرد كائن).
    3) آخر connection === 'open' حصل خلال آخر 3 دقايق (نافذة الحياة).
  وكمان:
    • heartbeat كل 30 ثانية: أي رسالة داخلة/ خارجة (messages.upsert /
      messages.update / أي frame على الـ WebSocket) بتحدّث lastTrafficAt.
    • بعد 10 دقايق صمت كامل بن状态 "degraded" — بننشر حدث عربي للوحة بس،
      من غير أي ريستارت (الصمت ممكن يكون هدوء طبيعي في الشات).

  القواعد:
    • الوحدة دي مفيهاش أي process.exit ولا restart — هي قياس بس.
    • كل الأوقات والحقن قابلة للتبديل (ساعة وهمية/ مؤقّتات وهمية) عشان
      نختبر من غير أي نوم حقيقي.
    • مفيش أي اعتماد على client.isConnected() هنا.
  ═══════════════════════════════════════════
*/

/** نافذة الحياة: أحدث open لازم يكون خلال 3 دقايق. */
export const OPEN_WINDOW_MS = 3 * 60 * 1000;
/** نبضة حركة المرور: كل 30 ثانية. */
export const HEARTBEAT_MS = 30 * 1000;
/** بعد كام صمت نعتبر الاتصال "degraded" (حدث لوحة، مش ريستارت). */
export const DEGRADED_AFTER_MS = 10 * 60 * 1000;
/** مهلة التحقق من نتيجة إعادة التشغيل (نفس سلّم الريستارت: 90 ثانية). */
export const RESTART_OUTCOME_MS = 90 * 1000;

/** حالة كل عميل (last open / close / traffic / degraded). */
const trackers = new WeakMap();

function socketOf(client) {
  try { return client?.sock || null; } catch { return null; }
}

function newTracker(now) {
  return {
    lastOpenAt: 0,
    lastCloseAt: 0,
    lastTrafficAt: now(),
    degraded: false,
    openWaiters: new Set(),
  };
}

function trackerFor(client, now = () => Date.now()) {
  let tr = trackers.get(client);
  if (!tr) {
    tr = newTracker(now);
    trackers.set(client, tr);
  }
  return tr;
}

/**
 * هل الـ WebSocket مفتوح فعلاً؟ (readyState === 1) — من غير أي اعتماد على
 * running/isRunning أو أي خاصية الإطار بيخترعها.
 */
export function isSocketOpen(client) {
  const sock = socketOf(client);
  if (!sock) return false;
  let ready = false;
  try {
    const ws = sock.ws;
    ready = !!ws && typeof ws.readyState === 'number' ? ws.readyState === 1 : false;
  } catch { ready = false; }
  return !!(ready && sock.user);
}

/**
 * إشارة الحياة المشتركة: كل الـ consumers (watchdog / panel / healer) بتستخدمها.
 * @param {object} client عميل meowsab (أو mock بنفس الشكل)
 * @param {number} [now]  الوقت الحالي (ms) — clock وهمي في الاختبارات
 * @param {{lastOpenAt?:number,lastCloseAt?:number}} [extra] حالة اللوحة
 *        (لو معندهاش tracker، مثلاً في اختبارات computeConnected القديمة)
 * @returns {boolean}
 */
export function isAlive(client, now = Date.now(), extra = {}) {
  if (!isSocketOpen(client)) return false;
  const tr = trackers.get(client);
  const openAt = Number.isFinite(extra.lastOpenAt) && extra.lastOpenAt > 0
    ? extra.lastOpenAt
    : (tr?.lastOpenAt || 0);
  const closeAt = Number.isFinite(extra.lastCloseAt) && extra.lastCloseAt > 0
    ? extra.lastCloseAt
    : (tr?.lastCloseAt || 0);
  if (!openAt) return false;                 // مفيش open اتسجّل خالص
  if (closeAt >= openAt) return false;       // فيه close بعد آخر open
  const age = now - openAt;
  return age >= 0 && age <= OPEN_WINDOW_MS;
}

/** يسجّل open (من مستمع connection.update أو من اختبار). */
export function markOpen(client, ts = Date.now()) {
  const tr = trackerFor(client, () => ts);
  tr.lastOpenAt = ts;
  tr.lastTrafficAt = ts;
  tr.degraded = false;
  for (const resolve of [...tr.openWaiters]) {
    try { resolve(true); } catch { /* waiter مش شغّال */ }
  }
  tr.openWaiters.clear();
  return tr;
}

/** يسجّل close. */
export function markClose(client, ts = Date.now()) {
  const tr = trackerFor(client, () => ts);
  tr.lastCloseAt = ts;
  return tr;
}

/** يسجّل مرور حركة مرور (رسالة داخلة/خارجة أو frame على الـ ws). */
export function markTraffic(client, ts = Date.now()) {
  const tr = trackerFor(client, () => ts);
  tr.lastTrafficAt = ts;
  tr.degraded = false;
  return tr;
}

/** حالة قابلة للقراءة (للاختبارات وللوحة). */
export function livenessStatus(client, now = Date.now()) {
  const tr = trackers.get(client) || null;
  const lastOpenAt = tr?.lastOpenAt || 0;
  const lastCloseAt = tr?.lastCloseAt || 0;
  const lastTrafficAt = tr?.lastTrafficAt || 0;
  return {
    alive: isAlive(client, now),
    socketOpen: isSocketOpen(client),
    degraded: !!tr?.degraded,
    lastOpenAt,
    lastCloseAt,
    lastTrafficAt,
    silenceMs: lastTrafficAt ? Math.max(0, now - lastTrafficAt) : 0,
  };
}

/**
 * يربط نبضة الحياة على العميل: بيتابع السوكيت الحالي (والجديد بعد كل
 * ريستارت)، وبيسمع connection.update + messages.upsert/update + frames
 * الـ WebSocket، وبيطلق نبضة كل 30 ثانية.
 *
 * @param {object} client
 * @param {object} [opts]
 * @param {()=>number} [opts.now]
 * @param {(fn:Function,ms:number)=>any} [opts.setInterval]
 * @param {(h:any)=>void} [opts.clearInterval]
 * @param {(kind:string,message:string)=>void} [opts.emit]  حدث للوحة
 */
export function attachLiveness(client, opts = {}) {
  if (!client) return { stop() {}, status: () => livenessStatus(client), tracker: null };

  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const setIntervalFn = typeof opts.setInterval === 'function' ? opts.setInterval : (fn, ms) => setInterval(fn, ms);
  const clearIntervalFn = typeof opts.clearInterval === 'function' ? opts.clearInterval : (h) => clearInterval(h);
  const emit = typeof opts.emit === 'function' ? opts.emit : () => {};

  const tr = trackerFor(client, now);
  if (!tr.lastTrafficAt) tr.lastTrafficAt = now();

  let attached = null;
  const bindings = [];   // [target, event, fn]
  let poll = null;
  let stopped = false;

  function bind(target, event, fn) {
    try {
      if (!target || typeof target.on !== 'function') return;
      target.on(event, fn);
      bindings.push([target, event, fn]);
    } catch { /* ev وهمي */ }
  }

  function unbindAll() {
    for (const [target, event, fn] of bindings) {
      try { target.removeListener?.(event, fn); } catch { /* ev وهمي */ }
      try { target.off?.(event, fn); } catch { /* ev وهمي */ }
    }
    bindings.length = 0;
  }

  const onConnection = (u) => {
    const conn = u?.connection;
    if (conn === 'open') markOpen(client, now());
    else if (conn === 'close') markClose(client, now());
  };

  const onMessage = () => markTraffic(client, now());

  function bindSocket(sock) {
    if (!sock || sock === attached) return;
    unbindAll();
    attached = sock;

    if (sock.ev && typeof sock.ev.on === 'function') {
      bind(sock.ev, 'connection.update', onConnection);
      // حركة المرور الداخلة (رسائل جديدة/معدّلة)
      bind(sock.ev, 'messages.upsert', onMessage);
      bind(sock.ev, 'messages.update', onMessage);
    }

    // أي frame على الـ WebSocket نفسه (داخل أو خارج) — من غير ما نغيّر سلوكه
    try {
      const ws = sock.ws;
      if (ws && typeof ws.addEventListener === 'function') {
        ws.addEventListener('message', onMessage);
        bindings.push([ws, 'message', onMessage]);
      }
      if (ws && typeof ws.send === 'function' && !ws.__livenessWrapped) {
        const original = ws.send.bind(ws);
        ws.send = (...args) => {
          markTraffic(client, now());
          return original(...args);
        };
        ws.__livenessWrapped = true;
      }
    } catch { /* ws وهمي */ }
  }

  function beat() {
    if (stopped) return;
    const sock = socketOf(client);
    if (sock && sock !== attached) bindSocket(sock);
    if (!tr.lastOpenAt) return;
    const silence = now() - (tr.lastTrafficAt || tr.lastOpenAt);
    if (!tr.degraded && silence >= DEGRADED_AFTER_MS) {
      tr.degraded = true;
      try {
        emit('watchdog', '⚠️ الاتصال راكد: مفيش حركة رسائل من 10 دقايق — من غير ريستارت');
      } catch { /* حدث اللوحة ما يوقّعش النبضة */ }
    }
  }

  bindSocket(socketOf(client));
  poll = setIntervalFn(beat, HEARTBEAT_MS);
  try { poll?.unref?.(); } catch { /* مؤقّت وهمي */ }

  return {
    tracker: tr,
    status: (at = now()) => livenessStatus(client, at),
    beat,
    attach: (sock) => bindSocket(sock || socketOf(client)),
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { clearIntervalFn(poll); } catch { /* مؤقّت وهمي */ }
      poll = null;
      unbindAll();
      attached = null;
    },
  };
}

/**
 * ينتظر open جديد (بعد إعادة تشغيل) خلال مهلة محدودة.
 * @param {object} client
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=90_000]
 * @param {()=>number} [opts.now]
 * @param {(fn:Function,ms:number)=>any} [opts.setTimer]
 * @param {(h:any)=>void} [opts.clearTimer]
 * @param {number} [opts.baselineAt]  آخر open قبل إعادة التشغيل
 * @returns {Promise<boolean>}
 */
export function waitForOpen(client, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : RESTART_OUTCOME_MS;
  const setTimer = typeof opts.setTimer === 'function' ? opts.setTimer : (fn, ms) => setTimeout(fn, ms);
  const clearTimer = typeof opts.clearTimer === 'function' ? opts.clearTimer : (h) => clearTimeout(h);
  const tr = trackerFor(client, now);
  const baseline = Number.isFinite(opts.baselineAt) ? opts.baselineAt : tr.lastOpenAt;

  return new Promise((resolve) => {
    let done = false;
    let handle = null;

    const finish = (value) => {
      if (done) return;
      done = true;
      if (handle != null) { try { clearTimer(handle); } catch { /* وهمي */ } handle = null; }
      tr.openWaiters.delete(check);
      resolve(value);
    };

    const check = () => {
      if (tr.lastOpenAt > baseline && isAlive(client, now())) { finish(true); return; }
      // لو الـ open جه بنفس المللي ثانية (baseline=0) بنقبل أي open حي
      if (baseline === 0 && tr.lastOpenAt >= baseline && isAlive(client, now())) { finish(true); return; }
    };

    tr.openWaiters.add(check);
    check();
    if (done) return;
    handle = setTimer(() => finish(false), timeoutMs);
    try { handle?.unref?.(); } catch { /* مؤقّت وهمي */ }
  });
}

/**
 * ينفّذ إعادة تشغيل ويتحقق من نتيجتها بصدق:
 *   • open حقيقي خلال المهلة → حدث "تمت إعادة الاتصال" + true.
 *   • مفيش open → حدث "فشلت إعادة الاتصال" + تسليم واحد للسلّم المشترك
 *     (restartBot) — مش لوج نجاح كاذب، ومش process.exit من هنا.
 *
 * @param {object} client
 * @param {object} opts
 * @param {()=>any} opts.restart  تنفيذ إعادة التشغيل (المسار المشترك)
 * @param {(reason:string)=>any} [opts.restartBot]  السلّم المشترك (global.restartBot)
 * @param {(kind:string,message:string)=>void} [opts.emit]
 * @param {number} [opts.timeoutMs=90_000]
 * @param {()=>number} [opts.now]
 * @param {(fn:Function,ms:number)=>any} [opts.setTimer]
 * @param {(h:any)=>void} [opts.clearTimer]
 * @returns {Promise<boolean>}
 */
export async function verifyRestartOutcome(client, opts = {}) {
  const {
    restart,
    restartBot = null,
    emit = () => {},
    timeoutMs = RESTART_OUTCOME_MS,
    now = () => Date.now(),
    setTimer,
    clearTimer,
  } = opts;

  const tr = trackers.get(client);
  const baseline = tr?.lastOpenAt || 0;

  try {
    await restart();
  } catch (e) {
    try { emit('warn', 'فشلت إعادة الاتصال'); } catch { /* حدث آمن */ }
    try { restartBot?.('restart-outcome-failed'); } catch { /* السلّم مش متاح */ }
    return false;
  }

  const ok = await waitForOpen(client, {
    timeoutMs,
    now,
    baselineAt: baseline,
    ...(setTimer ? { setTimer } : {}),
    ...(clearTimer ? { clearTimer } : {}),
  });

  if (ok) {
    try { emit('ok', 'تمت إعادة الاتصال'); } catch { /* حدث آمن */ }
    return true;
  }

  try { emit('warn', 'فشلت إعادة الاتصال'); } catch { /* حدث آمن */ }
  try { restartBot?.('restart-outcome-failed'); } catch { /* السلّم مش متاح */ }
  return false;
}

export default { isAlive, attachLiveness, verifyRestartOutcome };