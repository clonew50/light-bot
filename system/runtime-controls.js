/*
  ═══════════════════════════════════════════
  🔁 أدوات التحكم في دورة حياة العملية
  ═══════════════════════════════════════════
  جوّه الملف ده حاجتين مستقلّتين، كل واحدة في شغل لوحدها:

  1) createPeriodicRestartScheduler — الجدولة الدورية للريستارت.
     المشكلة القديمة: المؤقّت كان setTimeout واحد → بيتنفّذ مرة واحدة بس في عمر
     العملية، يعني "ريستارت كل 10 دقايق" مكانش بيعمل حاجة غير أول مرة.
     هنا: مؤقّت بيتعاد ضبطه بعد كل دورة — سواء حصل ريستارت، أو اتخطّى لأن
     البوت واقف من اللوحة، أو اتخطّى لأن فيه ريستارت تاني شغّال — فبيدور
     طول عمر العملية.
     القواعد:
       • ما بنعملش ريستارت جديد لو فيه ريستارت شغّال (single-flight).
       • ما بنعملش ريستارت خالص لو المستخدم واقف البوت من اللوحة (stopped).
       • بعد ما الريستارت يخلص → بنعاد ضبط المؤقّت تاني (الجدولة بتفضل شغالة
         بعد كل ريستارت).

  2) createPresenceCap / installPresenceCap — كبح إرسالات presence المكرّرة.
     المشكلة: الإطار (meowsab) بيضيف setInterval(25s) جوه كل start() بيعمل
     sendPresenceUpdate("available")، وبيسيب المؤقّت من غير ما يمسحه وبيحفظش
     الـ handle — فبعد N ريستارت بيبعت presence N مرات كل 25 ثانية.
     الحل من غير تعديل node_modules:
       • نلفّ sendPresenceUpdate على السوكيت (runtime patch جنب الشيلد).
       • الإرسال التلقائي ("available") من الإطار بيتكبَح ويتعدّ (duplicate).
       • عندنا مؤقّت واحد بس (owned) هو اللي بيبعت presence كل 25 ثانية عن طريق
         الـ original اللي اتصادّر من السوكيت.
       • أي سوكيت جديد (بعد كل start/restart) بيتلفّ تاني فورًا.
     يعني: رسالة presence واحدة كل 25 ثانية مهما كان عدد مرات إعادة التشغيل،
     والعدّاد بيكشف قد إيه اتكبح.
*/

export const PRESENCE_INTERVAL_MS = 25_000; // الفترة اللي بيبعت فيها الإطار presence
export const DEFAULT_RESTART_INTERVAL_MIN = 10; // افتراضي: ريستارت كل 10 دقايق

/* ══════════════════════════════════════════════════════════════
   1) الجدولة الدورية للريستارت
   ══════════════════════════════════════════════════════════════ */

/**
 * ينشئ جدولة ريستارت دورية بتتكرر طول عمر العملية.
 * كل الاعتماديات (الوقت، المؤقّتات، الريستارت نفسه) تُحقن عشان نقدر
 * نجرّب الوحدة من غير ما نشغّل البوت ولا نستخدم نوم حقيقي.
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs]      الفترة بين الدورات (ms)
 * @param {(reason:string)=>Promise<any>} [options.restart]  مسار الريستارت (لازم يكون القفل الأحادي)
 * @param {()=>boolean} [options.isStopped]   المستخدم واقف البوت من اللوحة؟
 * @param {()=>boolean} [options.isRestarting] فيه ريستارت شغّال دلوقتي؟
 * @param {(fn:Function, ms:number)=>any} [options.setTimer]
 * @param {(handle:any)=>void} [options.clearTimer]
 * @param {()=>number} [options.now]
 * @param {(...a:any[])=>void} [options.log]
 * @param {(...a:any[])=>void} [options.logError]
 * @param {string} [options.label] اسم عربي يظهر في اللوج
 */
export function createPeriodicRestartScheduler(options = {}) {
  const {
    intervalMs = DEFAULT_RESTART_INTERVAL_MIN * 60 * 1000,
    restart = async () => {},
    isStopped = () => false,
    isRestarting = () => false,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
    now = () => Date.now(),
    log = (...args) => console.log(...args),
    logError = (...args) => console.error(...args),
    label = 'ريستارت دوري',
  } = options;

  const state = {
    timer: null,        // المؤقّت الحالي (null = مش مarmed)
    started: false,     // هل الجدولة مفعّلة أصلاً
    fires: 0,           // عدد المرات اللي اشتغل فيها المؤقّت
    restarts: 0,        // عدد ريستارتات فعلية اتنفذت
    skippedStopped: 0,  // مرات اتخطّت لأن البوت واقف
    skippedBusy: 0,     // مرات اتخطّت لأن فيه ريستارت شغّال
    errors: 0,          // مرات فشل فيها الريستارت
    lastFireAt: 0,
  };

  /** بيعيد ضبط المؤقّت لدورة جديدة (مرة واحدة بس في نفس الوقت). */
  function arm() {
    if (state.timer != null) return false;
    if (!(intervalMs > 0)) return false;
    state.timer = setTimer(() => {
      state.timer = null;
      void fire();
    }, intervalMs);
    return true;
  }

  /** الدورة الواحدة: فحص الحالة → ريستارت (لو مسموح) → إعادة ضبط. */
  async function fire() {
    state.fires += 1;
    state.lastFireAt = now();
    try {
      if (isStopped()) {
        state.skippedStopped += 1;
        log(`⏹️ [RESTART] البوت متوقف من اللوحة — تم تأجيل ${label}`);
        return;
      }
      if (isRestarting()) {
        state.skippedBusy += 1;
        log(`⏳ [RESTART] فيه إعادة تشغيل شغّالة — تم تأجيل ${label}`);
        return;
      }
      const minutes = Math.round(intervalMs / 60000);
      log(`⏰ ${label} كل ${minutes} دقيقة`);
      await restart(`${label} كل ${minutes} دقيقة`);
      state.restarts += 1;
    } catch (e) {
      state.errors += 1;
      logError('⚠️ [RESTART] فشل الريستارت الدوري:', e?.message || e);
    } finally {
      // الجدولة بتفضل شغالة بعد كل دورة — سواء حصل ريستارت أو اتخطّى.
      if (state.started) arm();
    }
  }

  /** يشغّل الجدولة (بترجع false لو الفترة = 0 يعني مقفولة). */
  function start() {
    if (!(intervalMs > 0)) return false;
    state.started = true;
    return arm();
  }

  /** يوقف الجدولة نهائيًا (المؤقّت الحالي يتشال). */
  function stop() {
    state.started = false;
    if (state.timer != null) {
      clearTimer(state.timer);
      state.timer = null;
    }
  }

  /** حالة قابلة للقراءة (للاختبارات ولوحة التحكم). */
  function stats() {
    return {
      fires: state.fires,
      restarts: state.restarts,
      skippedStopped: state.skippedStopped,
      skippedBusy: state.skippedBusy,
      errors: state.errors,
      lastFireAt: state.lastFireAt,
      armed: state.timer != null,
      started: state.started,
      intervalMs,
    };
  }

  return {
    start,
    stop,
    arm,
    fireNow: fire,
    stats,
    isArmed: () => state.timer != null,
  };
}

/* ══════════════════════════════════════════════════════════════
   2) كبح إرسالات presence المكرّرة
   ══════════════════════════════════════════════════════════════ */

/**
 * كاشف presence: يلفّ sendPresenceUpdate على كل سوكيت جديد ويكبح الإرسال
 * التلقائي ("available") ويبعت رسالة واحدة كل فترة من مؤقّت واحد بتاعنا.
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs]
 * @param {()=>number} [options.now]
 * @param {(fn:Function, ms:number)=>any} [options.setTimer]
 * @param {(handle:any)=>void} [options.clearTimer]
 * @param {(fn:Function, ms:number)=>any} [options.setInterval]
 * @param {(handle:any)=>void} [options.clearInterval]
 * @param {(...a:any[])=>void} [options.log]
 */
export function createPresenceCap(options = {}) {
  const {
    intervalMs = PRESENCE_INTERVAL_MS,
    now = () => Date.now(),
    setInterval: setIntervalFn = (fn, ms) => setInterval(fn, ms),
    clearInterval: clearIntervalFn = (handle) => clearInterval(handle),
    setTimer = setIntervalFn,
    clearTimer = clearIntervalFn,
    log = (...args) => console.log(...args),
    presence = 'available',
    reportEveryTicks = 12, // كل 5 دقايق بنطبع إجمالي المكبوح
  } = options;

  const state = {
    socket: null,      // السوكيت الحالي
    original: null,    // sendPresenceUpdate الأصلي (متصادّر) من السوكيت الحالي
    timer: null,       // المؤقّت المملوك (واحد بس طول عمر العملية)
    ticks: 0,
    sends: 0,          // رسايل presence اللي وصلات واتساب
    suppressed: 0,     // رسايل المكرّرة اللي اتكبحت
    passes: 0,         // presence التفاعلي (composing/recording) اللي عدّى زي ما هو
    wraps: 0,          // عدد السوكيتات اللي اتلفّت
    lastSendAt: 0,
  };

  /**
   * يلصّ الغلاف على سوكيت جديد.
   * @param {any} sock
   * @returns {boolean} هل ده سوكيت جديد اتلفّ؟
   */
  function capture(sock) {
    if (!sock || sock === state.socket) return false;
    const original = typeof sock.sendPresenceUpdate === 'function'
      ? sock.sendPresenceUpdate.bind(sock)
      : null;
    state.socket = sock;
    state.original = original;
    state.wraps += 1;
    if (original) {
      sock.sendPresenceUpdate = function wrappedSendPresenceUpdate(kind, ...rest) {
        const value = kind === undefined || kind === null ? presence : kind;
        if (value !== presence) {
          // presence التفاعلي (composing / recording / paused) — بنعدّيه زي ما هو
          state.passes += 1;
          return original(value, ...rest);
        }
        // الإرسال التلقائي من الإطار — ده هو المكرّر: مؤقّتنا هو اللي بيبعت
        state.suppressed += 1;
        return Promise.resolve(false);
      };
    } else {
      // سوكيت من غير الدالة الأصلية (مش متوقع في الإطار): الغلاف بيمنع
      // الـ TypeError جوه interval الإطار بدل ما نسيبه يكرّش العملية.
      sock.sendPresenceUpdate = function wrappedMissingSendPresenceUpdate() {
        state.suppressed += 1;
        return Promise.resolve(false);
      };
    }
    ensureTimer();
    return true;
  }

  /** مؤقّت واحد بس طول عمر العملية — هو اللي بيبعت presence (بيتكرر). */
  function ensureTimer() {
    if (state.timer != null) return;
    state.timer = setIntervalFn(() => { void tick(); }, intervalMs);
    try { state.timer?.unref?.(); } catch { /* المؤقّت المزروع مش فيه unref */ }
  }

  /** دور المؤقّت: رسالة presence واحدة (نفس شرط الإطار: لازم المستخدم يكون متصل). */
  async function tick() {
    const sock = state.socket;
    const original = state.original;
    if (!sock || !original) return;
    if (!sock.user) return; // لسه مش متصل — زي ما الإطار بيعمل
    state.ticks += 1;
    state.sends += 1;
    state.lastSendAt = now();
    try {
      await original(presence);
    } catch {
      // فشل إرسال presence مش قاتل — بنكمل
    }
    if (reportEveryTicks > 0 && state.ticks % reportEveryTicks === 0 && state.suppressed > 0) {
      log(`👻 [PRESENCE] إجمالي الإرسالات المكرّرة المكبوحة: ${state.suppressed}`);
    }
  }

  /** حالة قابلة للقراءة — العدّاد بتاع المكبوح بتاعه اللوحة هتعرضه. */
  function stats() {
    return {
      sends: state.sends,
      suppressed: state.suppressed,
      passes: state.passes,
      wraps: state.wraps,
      ticks: state.ticks,
      attached: !!state.socket,
      ownedTimer: state.timer != null,
      intervalMs,
      lastSendAt: state.lastSendAt,
    };
  }

  function stop() {
    if (state.timer != null) {
      clearTimer(state.timer);
      state.timer = null;
    }
  }

  return { capture, tick, stats, stop, isAttached: () => !!state.socket };
}

/**
 * يثبّت كبح الـ presence على عميل meowsab.
 * بيلفّ sendPresenceUpdate على كل سوكيت جديد (بعد كل start/restart) فورًا:
 * بنراقب تبدّل client.sock عن طريق accessor (أسرع وأضمن من الفحص الدوري).
 *
 * ملاحظة: ده runtime patch جنب الشيلد — من غير أي تعديل في node_modules/meowsab.
 *
 * @param {any} client عميل meowsab
 * @param {object} [options] نفس اختيارات createPresenceCap
 */
export function installPresenceCap(client, options = {}) {
  const {
    log = (...args) => console.log(...args),
    pollMs = 1000,
  } = options;

  const cap = createPresenceCap(options);
  let current = client?.sock ?? null;

  function onNewSocket(sock) {
    if (!sock) return;
    if (cap.capture(sock)) {
      log(`👻 [PRESENCE] تم لفّ sendPresenceUpdate على السوكيت الجديد (لفّات: ${cap.stats().wraps})`);
    }
  }

  try {
    // بنتحوّل لخصائص (getter/setter) عشان أي سوكيت جديد يتلفّ في نفس اللحظة
    // اللي الإطار بيحطّ فيه السوكيت (start / restart) — من غير سباق.
    Object.defineProperty(client, 'sock', {
      configurable: true,
      enumerable: true,
      get() { return current; },
      set(value) {
        current = value;
        onNewSocket(value);
      },
    });
  } catch (e) {
    log('⚠️ [PRESENCE] تعذّر مراقبة تبدّل السوكيت — هنستخدم فحص دوري:', e?.message || e);
    const poll = setInterval(() => {
      const sock = client?.sock;
      if (sock && sock !== current) {
        current = sock;
        onNewSocket(sock);
      }
    }, pollMs);
    try { poll?.unref?.(); } catch { /* ignore */ }
  }

  onNewSocket(current);
  return cap;
}

export default {
  createPeriodicRestartScheduler,
  createPresenceCap,
  installPresenceCap,
  PRESENCE_INTERVAL_MS,
  DEFAULT_RESTART_INTERVAL_MIN,
};
