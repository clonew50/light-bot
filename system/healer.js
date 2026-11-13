/*
  ═══════════════════════════════════════════
  🩹 مُصلح الجلسة (Session Healer)
  ───────────────────────────────────────────
  المشكلة: إطار meowsab لما الاتصال يتقفل بسبب badSession (الجلسة بقت فاسدة
  عند سيرفر واتساب — بعد فترة من التشغيل غالبًا) بيكتب " Bad session" في اللوج
  ويسيب البوت ميت (isRunning=false) من غير أي محاولة رجوع. النتيجة: البوت
  بيفضل "ميت" لحد ما تعمل ريستارت يدوي، واللوحة بتقول "غير متصل".

  الحل: بنتكدس على connection.update بنفسنا، ولما نسمع close بسبب badSession
  بنعمل نفس ريستارت اللوحة بالظبط (ريستارت داخل العملية) — أوتوماتيكًا.

  ليه مش بنغلق{cases التانية؟
    • 401 loggedOut           → الحساب اتقفل/اتعمل logout — مش بنرجّعه.
    • 440 connectionReplaced  → جلسة تانية سحبت الحساب (خطر) — مش بنلمسها.
    • 411 multideviceMismatch → محتاج إعادة ربط يدوي.

  ليه مفيش خطر إعادة تشغيل مزدوجة؟
    لأن cleanup() في meowsab بيشيل كل الـ listeners من السوكيت قبل ما يسكّر
    الـ ws — فمفيش أي close event داخلي بيوصلنا.
  ═══════════════════════════════════════════
*/

const BAD_CLOSE = /bad.?session|session.?error|bad.?mac/i;
const BAD_SESSION_STATUS = 500; // DisconnectReason.badSession في Baileys

/* سلّم تصعيد محدود: 3 محاولات علاج كحد أقصى كل 10 دقايق، وبعدها
   بنسلّم الأمر لسلّم الريستارت المشترك (restart-ladder) — مش بنعمل
   process.exit من هنا أبدًا. و90 ثانية هي المهلة اللي بعدها يعتبر العلاج
   فاشل (مفيش connection === 'open'). */
const HEAL_CAP = 3;
const HEAL_WINDOW_MS = 10 * 60 * 1000;
const OPEN_GRACE_MS = 90 * 1000;
const HEAL_DELAY_MS = 2000;
const HEAL_REASON = 'bad-session auto-heal';
const ESCALATE_REASON = 'bad-session escalation';

/**
 * يربط مُصلح الجلسة على السوكيت الحالي، ويعيد ربطه تلقائيًا لما السوكيت يتغير.
 * @param {object} client  عميل meowsab
 * @param {object} opts
 * @param {(reason:string)=>void} opts.restart     دالة تنفيذ الريستارت
 * @param {()=>boolean} [opts.shouldSkip]          لو رجّع true → متدخلش (إيقاف يدوي/ربط)
 * @param {number} [opts.quietMs]  أقل مدة بين محاولتين علاج (30 ثانية)
 * @param {number} [opts.pollMs]   مدة فحص السوكيت (800ms)
 * @param {(msg:string)=>void} [opts.log]
 * @param {(kind:string, msg:string)=>void} [opts.emit]  حدث للوحة (اختياري)
 * @param {number} [opts.healCap=3]         أقصى علاجات متتالية قبل التصعيد
 * @param {number} [opts.healWindowMs]      نافذة عدّ العلاجات (10 دقايق)
 * @param {number} [opts.openGraceMs]       مهلة الـ open بعد كل علاج (90 ثانية)
 */
export function attachHealer(client, opts = {}) {
  const {
    restart = (reason) => global.restartBot?.(reason),
    shouldSkip = () => false,
    quietMs = 30 * 1000,
    pollMs = 800,
    log = (m) => console.log(m),
    emit = null,
    // نقاط حقن للاختبار: ساعة وهمية ومؤقّتات وهمية — بدون أي نوم حقيقي.
    now = () => Date.now(),
    setInterval: setPollInterval = (fn, ms) => setInterval(fn, ms),
    clearInterval: clearPollInterval = (h) => clearInterval(h),
    setTimeout: setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimeout: clearTimer = (h) => clearTimeout(h),
    healDelayMs = HEAL_DELAY_MS,
    healCap = HEAL_CAP,
    healWindowMs = HEAL_WINDOW_MS,
    openGraceMs = OPEN_GRACE_MS
  } = opts;

  const state = {
    attached: null,     // السوكيت اللي المستمع مربوط عليه دلوقتي
    listener: null,     // نفس المستمع — عشان نشيله بالظبط وقت الاستبدال/الإيقاف
    quiet: 0,           // نهاية نافذة الهدوء (منع تكرار العلاج على نفس القطع)
    lastOpen: 0,        // آخر مرة شفنا connection === 'open'
    heals: 0,           // علاجات اتعملت في النافذة الحالية
    restarts: 0,        // إجمالي نداءات restart (علاج + تصعيد)
    consecutive: 0,     // علاجات متتالية من غير open خلال المهلة
    escalated: false,   // منعناش التصعيد المزدوج
    windowStart: 0,     // بداية نافذة الـ 10 دقايق
    lastHealAt: 0,
    pending: null,      // مؤقّت العلاج المعلّق
    stopped: false,
    deadlines: new Set() // مواعيد نهاية مهلة الـ open لكل علاج
  };

  function publish(kind, message) {
    if (typeof emit !== 'function') return;
    try { emit(kind, message); } catch { /* حدث اللوحة ما يوقّعش الشفاء */ }
  }

  function clearDeadlines() {
    for (const handle of state.deadlines) {
      try { clearTimer(handle); } catch { /* مؤقّت وهمي */ }
    }
    state.deadlines.clear();
  }

  function cancelPending() {
    if (state.pending == null) return;
    try { clearTimer(state.pending); } catch { /* مؤقّت وهمي */ }
    state.pending = null;
  }

  /* شيل كل مستمع أضفناه على السوكيت — قبل ما نربط غيره أو نوقف. */
  function detach(sock) {
    const target = sock || state.attached;
    const listener = state.listener;
    if (target && listener && target.ev) {
      try { target.ev.removeListener?.('connection.update', listener); } catch { /* ev مزيّف */ }
      try { if (typeof target.ev.off === 'function') target.ev.off('connection.update', listener); } catch { /* ev مزيّف */ }
    }
    if (target === state.attached) { state.attached = null; state.listener = null; }
  }

  /* سوكيت جديد يلغي أي علاج كان مجدولًا على القديم. */
  function attach(sock) {
    if (!sock || !sock.ev || typeof sock.ev.on !== 'function') return;
    if (state.attached === sock && state.listener) return;
    if (state.attached) detach(state.attached);
    cancelPending();
    const listener = (u) => onUpdate(u, sock);
    state.attached = sock;
    state.listener = listener;
    try {
      sock.ev.on('connection.update', listener);
    } catch (e) {
      state.attached = null;
      state.listener = null;
      log('⚠️ [HEALER] تعذّر ربط مستمع الاتصال: ' + (e?.message || e));
    }
  }

  function rollWindowIfStale() {
    const t = now();
    if (state.windowStart && t - state.windowStart > healWindowMs) {
      state.windowStart = 0;
      state.heals = 0;
      state.consecutive = 0;
      state.escalated = false;
      clearDeadlines(); // مواعيد علاجات من نافذة قديمة خلصت
    }
  }

  function markOpen() {
    state.lastOpen = now();
    const had = state.heals > 0 || state.consecutive > 0 || state.escalated;
    state.heals = 0;
    state.consecutive = 0;
    state.escalated = false;
    state.windowStart = 0;
    clearDeadlines();
    if (had) log('✅ [HEALER] الاتصال رجع (open) — عدّاد العلاج اتصفّر');
  }

  /* سلّمنا الأمر لسلّم الريستارت المشترك — مرة واحدة بس لحد ما open يرجّع العدّاد. */
  function escalate(sock) {
    if (state.stopped || state.escalated) return false;
    if (sock && sock !== state.attached) return false;
    if (shouldSkip()) { log('⏸️ [HEALER] تصعيد مؤجّل — فيه إيقاف/ربط شغّال'); return false; }
    state.escalated = true;
    if (state.heals > healCap) state.heals = healCap;
    state.restarts++;
    log(`🚨 [HEALER] تصعيد: ${state.heals} محاولات علاج متتالية من غير اتصال — بنسلّم الأمر لسلّم الريستارت المشترك`);
    publish('warn', `🚨 تصعيد الجلسة: ${state.heals} محاولات علاج فاشلة — إعادة تشغيل كاملة`);
    try { restart(ESCALATE_REASON); } catch (e) { log('⚠️ [HEALER] فشل التصعيد: ' + (e?.message || e)); }
    return true;
  }

  /* بعد كل علاج: لو 90 ثانية عدّت من غير open → فشل متتالي. */
  function armOpenDeadline(sock) {
    const handle = setTimer(() => {
      state.deadlines.delete(handle);
      if (state.stopped || sock !== state.attached) return;
      if (state.lastOpen >= state.lastHealAt) { state.consecutive = 0; return; }
      state.consecutive++;
      log(`⚠️ [HEALER] ${Math.round(openGraceMs / 1000)} ثانية من غير open بعد العلاج — فشل متتالي ${state.consecutive}`);
      if (state.consecutive >= healCap) escalate(sock);
    }, openGraceMs);
    try { handle?.unref?.(); } catch { /* مؤقّت وهمي */ }
    state.deadlines.add(handle);
  }

  function fireHeal(sock) {
    state.pending = null;
    if (state.stopped) return;
    if (sock !== state.attached) { log('↩️ [HEALER] السوكيت اتبدّل — العلاج المعلّق اتلغى'); return; }
    // الفحص واجب هنا كمان: الإيقاف/الربط ممكن يبدأ بعد الحدث وقبل ما المؤقّت يضرب.
    if (shouldSkip()) { log('⏸️ [HEALER] العلاج المعلّق اتلغى — فيه إيقاف/ربط شغّال'); return; }
    rollWindowIfStale();
    if (!state.windowStart) state.windowStart = now();
    if (state.escalated) return;
    if (state.heals >= healCap) { escalate(sock); return; }
    state.heals++;
    state.lastHealAt = now();
    state.restarts++;
    log(`🩹 [HEALER] الاتصال قفل بسبب badSession (المحاولة ${state.heals} من ${healCap}) — ريستارت تلقائي لإصلاح الجلسة`);
    publish('ok', '🩹 شُفي اتصال واتساب تلقائياً');
    armOpenDeadline(sock);
    try { restart(HEAL_REASON); } catch (e) { log('⚠️ [HEALER] فشل العلاج: ' + (e?.message || e)); }
  }

  function onUpdate(u, sock) {
    if (state.stopped || sock !== state.attached) return;
    const { connection, lastDisconnect } = u || {};
    if (connection === 'open') { markOpen(); return; }
    if (connection !== 'close') return;

    const err = lastDisconnect?.error;
    const code = err?.output?.statusCode;
    const msg = String(err?.message || err || '');

    // بنعالج بس badSession (أو رسايل زي Bad MAC) — لا غير
    if (!(code === BAD_SESSION_STATUS || BAD_CLOSE.test(msg))) return;
    if (now() < state.quiet) return;          // quiet window
    if (shouldSkip()) return;                 // إيقاف يدوي أو عملية ربط

    state.quiet = now() + quietMs;
    cancelPending();                          // قطع جديد بينسخ أي علاج معلّق
    log('🩹 [HEALER] الاتصال قفل بسبب badSession — بجدولة علاج تلقائي');
    state.pending = setTimer(() => fireHeal(sock), healDelayMs);
  }

  const poll = setPollInterval(() => {
    const sock = client?.sock;
    if (!sock || !sock.ev || sock === state.attached) return;
    attach(sock);
  }, pollMs);

  try { poll?.unref?.(); } catch { /* مؤقّت وهمي */ }

  return {
    stop: () => {
      if (state.stopped) return;
      state.stopped = true;
      try { clearPollInterval(poll); } catch { /* مؤقّت وهمي */ }
      cancelPending();
      clearDeadlines();
      detach();
    },
    attach,
    state
  };
}

export default attachHealer;
