/*
  ═══════════════════════════════════════════
  🔒 قفل الريستارت أحادي المسار + سلّم التصعيد
  ═══════════════════════════════════════════
  المشكلة: restartBot() كان بيتنادى من مصادر مستقلين (المؤقّت الدوري، حرس
  الاتصال، حرس الذاكرة، التحديث التلقائي، مُصلح الجلسة، أزرار لوحة التحكم،
  أمر المالك في البلجِن...) من غير أي قفل. طلبين إعادة تشغيل قريبين بيعملوا
  teardown مزدوج على نفس السوكيت، فبتبقى اللوج متكسّرة والبوت مش شغّال.

  الحل — دول قاعدتين:
    1) قفل أحادي المسار (single-flight): لو فيه إعادة تشغيل شغّالة، أي طلب
       تاني بيرجع نفس الـ promise بالظبط (مش promise جديد) — فمفيش أي
       تداخل، والكل بينضم لعملية واحدة.
    2) سلّم تصعيد (escalation ladder): بنعدّ عمليات إعادة التشغيل المتتالية
       اللي مقدرتش ترجّع connection === 'open' خلال OPEN_TIMEOUT_MS (90 ثانية).
       لو عدّت ESCALATE_AFTER (2) محاولات فاشلة متتالية → إعادة تشغيل كاملة
       نضيفة: تفريغ الداتابيز وبعدين process.exit(1) — مش 0 — عشان مدير
       العمليات (systemd Restart=on-failure / PM2) يرجّع البوت تاني.

  قواعد صارمة:
    • القطع العادي (close من غير open) ما بيخرجش من العملية خالص.
    • إعادة التشغيل ما بتحذفش بيانات الجلسة (لا session ولا creds).
    • مفيش مسار قاتل بيخرج بكود 0 — الكود 1 هو الوحيد (systemd/PM2 بيعيدوا
      التشغيل على الفشل بس).

  ملاحظة عن الإطار (meowsab):
    • En.restart(e=true) = running=false → cleanup() → ثانية → start(true)،
      وبيبلع أخطاءه بنفسه (catch داخلي) — فبنقيس النتيجة بأنفسنا:
      بنستنى open حقيقي خلال 90 ثانية.
    • cleanup() بينادي Se(sock) اللي بيشيل كل الـ listeners من السوكيت —
      فالمستمع بتاعنا لازم يتربط تاني على السوكيت الجديد بعد كل إعادة تشغيل.
*/

export const OPEN_TIMEOUT_MS = 90_000;  // مهلة الـ open بعد إعادة التشغيل
export const ESCALATE_AFTER = 2;        // بعد كام فشل متتالي نصعّد
export const FATAL_EXIT_CODE = 1;       // كود الخروج القاتل (مش 0!)
export const POLL_MS = 2_000;           // فحص احتياطي: هل الاتصال رجع فعلاً؟

/**
 * ينشئ متحكّم إعادة تشغيل بقفل أحادي المسار + سلّم تصعيد.
 * كل الاعتماديات الخارجية (الوقت، المؤقّتات، الخروج، تفريغ الداتابيز) تُحقن
 * عشان نقدر نجرّب الوحدة من غير ما نشغّل البوت كله.
 *
 * @param {object} [options]
 * @param {object} [options.client]        عميل meowsab (أو أي mock بيحاكيّه)
 * @param {'inprocess'|'exit'} [options.mode]  وضع إعادة التشغيل
 * @param {()=>Promise<void>} [options.flushDb]  تفريغ الداتابيز قبل الخروج
 * @param {(code:number)=>void} [options.exit]   الخروج من العملية
 * @param {(...a:any[])=>void} [options.log]
 * @param {(...a:any[])=>void} [options.logError]
 * @param {number} [options.openTimeoutMs]  مهلة الـ open
 * @param {number} [options.escalateAfter]   عدد الفشل المتتالي قبل التصعيد
 * @param {number} [options.pollMs]          فترة الفحص الاحتياطي
 * @param {()=>number} [options.now]
 * @param {(fn:Function, ms:number)=>any} [options.setTimer]
 * @param {(handle:any)=>void} [options.clearTimer]
 */
export function createRestartController(options = {}) {
  const {
    client = null,
    mode = 'inprocess',
    flushDb = async () => {},
    exit = (code) => process.exit(code),
    log = (...args) => console.log(...args),
    logError = (...args) => console.error(...args),
    openTimeoutMs = OPEN_TIMEOUT_MS,
    escalateAfter = ESCALATE_AFTER,
    pollMs = POLL_MS,
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
  } = options;

  const state = {
    inflight: null,          // الـ promise المشترك — كل الطلبات المتداخلة بترجعه
    restarts: 0,             // عدد عمليات إعادة التشغيل اللي بدأت فعلاً
    consecutiveFailures: 0,  // فشل متتالي (من غير open خلال المهلة)
    lastExitCode: null,      // آخر كود خروج استخدمناه
    lastOpenAt: 0,           // آخر مرة شفنا فيها connection === 'open'
    watchedSock: null,       // السوكيت اللي مستمعنا مربوط عليه دلوقتي
    // كل محاولة ليها موعد نهائي بها — محاولة جديدة ما بتلغيش موعد المحاولة
    // اللي قبلهما: لو الاتصال ما رجعش خلال 90 ثانية من بداية كل محاولة، كل
    // محاولة بتحسب فشل متتالي (مهم لما مصلح الجلسة يعيد المحاولة بسرعة).
    deadlines: new Set(),    // مواعيد نهاية نوافذ الـ open للشغّالة دلوقتي
    poll: null,              // مؤقّت الفحص الاحتياطي المشترك
    fatalDone: false,        // منع تصعيد مزدوج
  };

  /* ---------------- أدوات داخلية ---------------- */

  function isConnectedNow() {
    try { return !!client?.isConnected?.(); } catch { return false; }
  }

  /**
   * جدولة مؤقّت.
   * مؤقّت الموعد النهائي (90 ثانية) بيسيب العملية شغالة لحد ما يتنفّذ
   * التصعيد — لو اتعمله unref كانت ممكن العملية تموت قبل ما reaches decides.
   * مؤقّت الفحص المساعد بس بيتعمل له unref عشان ما يفضلش شغال لوحده.
   */
  function armTimer(fn, ms, keepAlive = false) {
    const handle = setTimer(fn, ms);
    if (!keepAlive) {
      try { handle?.unref?.(); } catch { /* المؤقّت المزروع مش فيه unref */ }
    }
    return handle;
  }

  function clearDeadlines() {
    for (const handle of state.deadlines) clearTimer(handle);
    state.deadlines.clear();
  }

  function clearPoll() {
    if (state.poll != null) { clearTimer(state.poll); state.poll = null; }
  }

  function endTrial() {
    clearDeadlines();
    clearPoll();
  }

  /** ربط مستمع الاتصال على السوكيت الحالي (idempotent). */
  function attachWatcher() {
    const sock = client?.sock;
    if (!sock || !sock.ev || typeof sock.ev.on !== 'function') return;
    if (state.watchedSock === sock) return;
    state.watchedSock = sock;
    try {
      sock.ev.on('connection.update', (u) => {
        // أحداث السوكيت القديم بعد ما السوكيت اتبدّل مش بتاعنا
        if (state.watchedSock !== sock) return;
        const conn = u?.connection;
        if (conn === 'open') onOpen();
        // close عادي: بنتجاهله تمامًا — البوت ما بيخرجش من العملية على قطع عادي
      });
    } catch (e) {
      logError('⚠️ [RESTART] تعذّر ربط مستمع الاتصال:', e?.message || e);
    }
  }

  /**
   * وصل connection === 'open' — نجاح المحاولات الشغّالة + تصفير عدّاد الفشل.
   * حتى لو الاتصال رجع متأخر بعد ما مهلة المحاولة خلّصت، الرجوع ده كاسر
   * للفشل المتتالي (نفس دلالة "consecutive" — زي العدّاد القديم في الحرس).
   */
  function onOpen() {
    state.lastOpenAt = now();
    const had = state.consecutiveFailures;
    const hadTrials = state.deadlines.size > 0;
    endTrial();
    state.consecutiveFailures = 0;
    if (hadTrials || had) {
      log(`✅ [RESTART] الاتصال رجع (open)${had ? ' — عدّاد الفشل اتصفّر' : ''}`);
    }
  }

  /** فحص احتياطي أثناء المحاولات: لو الاتصال رجع من غير حدث open (سباق). */
  function pollOnce() {
    state.poll = null;
    if (state.deadlines.size === 0) return;
    attachWatcher(); // السوكيت ممكن يكون اتبدّل (إعادة اتصال تلقائي من الإطار)
    if (isConnectedNow()) { onOpen(); return; }
    schedulePoll();
  }

  function schedulePoll() {
    if (state.poll != null || state.deadlines.size === 0) return;
    state.poll = armTimer(() => { pollOnce(); }, pollMs);
  }

  /**
   * بداية نافذة الـ open: 90 ثانية لازم يوصل فيها connection === 'open'.
   * المحاولات السابقة اللي لسه نافذتها شغّالة بتفضل مرصودة — من غير إلغاء —
   * عشان الفشل المتتالي ما يتصفّرش لما محاولة جديدة تبدأ بدري.
   */
  function beginTrial() {
    clearPoll();
    // لو الاتصال رجع بالفعل (الريستارت كان أسرع من ما نلحق نربط) → نجاح فوري
    if (isConnectedNow()) {
      endTrial();
      state.lastOpenAt = now();
      state.consecutiveFailures = 0;
      log('✅ [RESTART] الاتصال رجع بالفعل — العملية نجحت');
      return;
    }
    // keepAlive: الموعد النهائي لازم يفضل شغال — لو العملية اتقفلت قبله
    // التصعيد مينفّذش خالص والبوت يفضل ميت من غير ما مدير العمليات يرجّعه.
    const deadline = armTimer(() => { onTrialTimeout(deadline); }, openTimeoutMs, true);
    state.deadlines.add(deadline);
    schedulePoll();
  }

  /** انتهت مهلة محاولة من غير open → فشل متتالي، وعندها نتصعّد. */
  function onTrialTimeout(deadline) {
    if (!state.deadlines.has(deadline)) return;
    state.deadlines.delete(deadline);
    clearPoll();
    state.consecutiveFailures += 1;
    const n = state.consecutiveFailures;
    logError(
      `⚠️ [RESTART] مفيش اتصال (open) خلال ${Math.round(openTimeoutMs / 1000)} ثانية ` +
      `من آخر محاولة — فشل متتالي رقم ${n}`
    );
    // لسه فيه محاولات شغّالة → نكمل الفحص الاحتياطي ليهم
    if (state.deadlines.size > 0) schedulePoll();
    if (n >= escalateAfter) {
      void fatal(`${n} محاولات متتالية فاشلة`);
    }
  }

  /**
   * المسار القاتل: تفريغ الداتابيز وبعدين خروج نظيف بكود 1 (مش 0).
   * @param {string} reason
   */
  async function fatal(reason) {
    if (state.fatalDone) return;
    state.fatalDone = true;
    logError(`💀 [RESTART] ${reason} — خروج كامل نظيف عشان مدير العمليات يرجّع البوت (كود ${FATAL_EXIT_CODE})`);
    try {
      await flushDb();
    } catch (e) {
      logError('⚠️ [RESTART] فشل تفريغ الداتابيز قبل الخروج:', e?.message || e);
    }
    state.lastExitCode = FATAL_EXIT_CODE;
    exit(FATAL_EXIT_CODE);
  }

  /** تنفيذ عملية إعادة تشغيل واحدة (بتتادى من القفل بس). */
  async function runRestart(reason) {
    const m = mode === 'exit' ? 'exit' : 'inprocess';
    log(`\n🔄 [RESTART] ريستارت البوت (${reason}) — الوضع: ${m}`);
    state.restarts += 1;

    // وضع الخروج: تفريغ الداتابيز وبعدين خروج بكود 1 (مش 0) — مدير العمليات يرجّعنا
    if (m === 'exit') {
      try {
        await flushDb();
      } catch (e) {
        logError('⚠️ [RESTART] فشل تفريغ الداتابيز قبل الخروج:', e?.message || e);
      }
      state.lastExitCode = FATAL_EXIT_CODE;
      exit(FATAL_EXIT_CODE);
      return;
    }

    try {
      await client.restart();
    } catch (err) {
      // الإطار بيبتلع أخطاءه بنفسه، بس لو حصل خطأ عندنا فالمحاولة فاشلة
      logError('❌ [RESTART] فشل إعادة التشغيل داخل العملية:', err?.message || err);
      state.consecutiveFailures += 1;
      const n = state.consecutiveFailures;
      if (n >= escalateAfter) await fatal(`${n} محاولات متتالية فاشلة`);
      return;
    }

    attachWatcher();
    beginTrial();
    log('✅ [RESTART] تم تنفيذ إعادة التشغيل داخل نفس العملية — السيرفر متقفلش');
  }

  /**
   * القفل أحادي المسار: كل الطلبات اللي جت وقت العملية الجارية بترجع
   * نفس الـ promise — فمفيش أي تداخل بين عمليتين.
   * @param {string} reason
   * @returns {Promise<void>}
   */
  function restart(reason = 'scheduled') {
    if (state.inflight) {
      log(`⏳ [RESTART] فيه عملية إعادة تشغيل شغّالة بالفعل — الطلب اتضاف ليها (${reason})`);
      return state.inflight;
    }
    const running = runRestart(reason)
      .catch((e) => {
        logError('❌ [RESTART] خطأ غير متوقع أثناء إعادة التشغيل:', e?.message || e);
      })
      .finally(() => {
        if (state.inflight === running) state.inflight = null;
      });
    state.inflight = running;
    return running;
  }

  /** حالة قابلة للقراءة (للاختبارات ولوحة التحكم). */
  function stats() {
    return {
      restarts: state.restarts,
      consecutiveFailures: state.consecutiveFailures,
      inFlight: !!state.inflight,
      lastExitCode: state.lastExitCode,
      lastOpenAt: state.lastOpenAt,
      watchingSocket: !!state.watchedSock,
      activeTrials: state.deadlines.size,
      mode: mode === 'exit' ? 'exit' : 'inprocess',
    };
  }

  attachWatcher();

  return {
    restart,
    stats,
    /** يبلّغ عن connection === 'open' (مفيد للاختبارات وللمسار البديل). */
    notifyOpen: onOpen,
    /** المسار القاتل — reused من مسار فشل الإقلاع (todo 4). */
    fatal,
    /** هل فيه عملية إعادة تشغيل شغّالة دلوقتي؟ */
    isRestarting: () => !!state.inflight,
  };
}

/**
 * يركّب global.restartBot — نفس الدالة اللي بتستدعيها لوحة التحكم
 * (system/webPanel.js) وأمر المالك (plugins/owner/restart.js).
 * @param {ReturnType<typeof createRestartController>} controller
 * @param {object} [target] الهدف (global افتراضيًا)
 */
export function installGlobalRestart(controller, target = global) {
  const fn = (reason = 'scheduled') => controller.restart(reason);
  target.restartBot = fn;
  return fn;
}

export default createRestartController;
