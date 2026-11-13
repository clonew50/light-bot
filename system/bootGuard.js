/**
 * bootGuard.js — تشغيل مقيّد بمهلة وإعادة محاولة (todo 4 / GAP-11)
 * ================================================================
 * ليه ده موجود أصلًا؟ فك تشفير node_modules/meowsab/dist أثبت حاجتين:
 *   1) client.start() لا يرفق خطأ أبدًا (never rejects): جوّه try/catch بتاعها،
 *      مسار الخطأ بيعمل g.error("Failed to start: ...") وبعدين
 *      this.config.onError?.(n) وبعدين autoReconnect && !recMgr?.maxed
 *      → recMgr.schedule() — يعني الـ promise بيتحلّ عادي حتى بعد فشل الإقلاع،
 *        فـ `await client.start()` لوحده مش بيكتشف أي فشل.
 *   2) fetchLatestBaileysVersion() جوّه نفس الـ try وملهاش مهلة —
 *      شبكة معلّقة (host مش بييجي) = تشغيل معلّق للأبد من غير أي إشارة.
 * الحل هنا:
 *   (أ) نجاح المحاولة = وصول connection === 'open' (بنقرأه عبر isConnected
 *       اللي بيفحص حالة السوكيت) خلال مهلة 90 ثانية.
 *   (ب) الفشل = انتهاء المهلة من غير open — السبب المفضّل بيتقرأ من
 *       آخر خطأ سجّله الإطار عبر config.onError (شوف system/config.js)،
 *       ولو مفيش بنقول "انتهت مهلة التشغيل".
 *   (ج) 3 محاولات كحد أقصى بفواصل 5 / 15 / 45 ثانية، وكل فشل بيدفع
 *       حدث عربي للوحة (تعذر تشغيل البوت: <السبب>) + سجل واضح.
 *   (د) بعد آخر فشل بنسلّم الأمر للسلّم الموجود global.restartBot('boot-failed')
 *       — السلّم (system/restart-ladder.js) هو اللي بيتكفل بالخروج بكود 1
 *       أو بإعادة التشغيل داخل العملية — ممنوع process.exit من هنا مباشرة.
 * ممنوع أيضًا: مسح جلسة الربط (auth state) عند الفشل — الجلسة أمانة.
 *
 * الاستدعاء من index.js بعد تجهيز اللوحة والـ healer — الترتيب القديم
 * للتشغيل (healer / SubBots / webPanel) مش بيتغيّر.
 */

/** مهلة المحاولة الواحدة بالمللي ثانية (90 ثانية). */
export const BOOT_TIMEOUT_MS = 90_000;

/** فواصل إعادة المحاولة (5 / 15 / 45 ثانية). */
export const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

/**
 * يشدّ محاولة تشغيل واحدة بمهلة: النجاح = open وصل قبل المهلة.
 * أثناء عملية ربط حقيقية (QR/كود لسه شغالة) بنوقف العدّ — مهلة الربط
 * نفسها معرّفة في حالة الـ pairing (3 دقايق)، فمش هنقتل محاولة ربط سليمة.
 * @param {object} p
 * @returns {Promise<string|null>} null = نجحت، أو نص سبب الفشل.
 */
async function awaitBootOutcome({
  isConnected,
  isPairing,
  lastFailureReason,
  timeoutMs,
  pollMs,
  sleep,
  now,
}) {
  let deadline = now() + timeoutMs;
  for (;;) {
    if (isConnected()) return null;
    // عملية ربط شغالة دلوقتي → المهلة تتنقل (العدّ يتوقف مؤقتًا)
    if (isPairing()) deadline = now() + timeoutMs;
    const remain = deadline - now();
    if (remain <= 0) {
      return lastFailureReason()
        || `انتهت مهلة التشغيل (${Math.round(timeoutMs / 1000)} ثانية) بدون فتح الاتصال`;
    }
    await sleep(Math.min(pollMs, remain));
  }
}

/**
 * يشغّل العميل مع مهلة وإعادة محاولة مقيّدة.
 * كل الحقن اختياري عشان يبقى سهل الاختبار (tests/unit.task-4.test.mjs) —
 * القيم الافتراضية هي اللي بتشتغل في الإنتاج.
 *
 * @param {object} client عميل meowsab (مطلوب فيه start())
 * @param {object} [options]
 * @returns {Promise<{ok: boolean, attempts: number, reason?: string}>}
 */
export async function startClientBounded(client, options = {}) {
  const {
    timeoutMs = BOOT_TIMEOUT_MS,
    retryDelays = RETRY_DELAYS_MS,
    pollMs = 1_000,
    log = (...a) => console.log(...a),
    logError = (...a) => console.error(...a),
    /** دفع حدث للوحة التحكم (system/webPanel.js → pushEvent) */
    pushEvent = () => {},
    /** في عملية ربط حقيقية شغالة؟ (pairingActive من webPanel) */
    isPairing = () => false,
    /** وصل connection === 'open'؟ */
    isConnected = () => client?.isConnected?.() === true,
    /** آخر خطأ سجّله الإطار عبر config.onError (system/config.js) */
    lastFailureReason = () => null,
    /** المسار النهائي عند فشل كل المحاولات — السلّم مش process.exit */
    onFinalFailure = (reason) => global.restartBot?.('boot-failed'),
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    sleep = (ms) => new Promise((r) => setTimer(r, ms)),
  } = options;

  const totalAttempts = 3;
  let lastReason = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    log(`🚀 [BOOT] محاولة بدء التشغيل ${attempt}/${totalAttempts}`);

    // client.start() ما بترفقش خطأ أبدًا — بس بنمسكها برضه عشان أي
    // رفض مستقبلي من الإطار ميبقاش unhandledRejection. التشغيل مستمر
    // بالتوازي — النجاح بيتقاس بحالة السوكيت (connection === 'open')
    // مش بحلّ الـ promise.
    void (async () => {
      try { await client.start(); } catch {}
    })();

    const reason = await awaitBootOutcome({
      isConnected,
      isPairing,
      lastFailureReason,
      timeoutMs,
      pollMs,
      sleep,
      now,
    });

    if (reason === null) {
      log(`✅ [BOOT] التشغيل نجح (المحاولة ${attempt}/${totalAttempts})`);
      return { ok: true, attempts: attempt };
    }

    lastReason = reason;
    const msg = `تعذر تشغيل البوت: ${reason}`;
    logError(`❌ [BOOT] ${msg} (المحاولة ${attempt}/${totalAttempts})`);
    try { pushEvent(msg); } catch {}

    if (attempt < totalAttempts) {
      const delay = retryDelays[attempt - 1];
      log(`⏳ [BOOT] إعادة المحاولة بعد ${Math.round(delay / 1000)} ثانية`);
      await sleep(delay);
    }
  }

  // كل المحاولات فشلت → السلّم المشترك بيتكفل بالباقي (خروج بكود 1
  // أو ريستارت داخل العملية) — ممنوع process.exit من هنا.
  logError(`💀 [BOOT] فشل الإقلاع بعد ${totalAttempts} محاولات — تسليم للسلّم (سبب آخر فشل: ${lastReason})`);
  let handedOff = false;
  try {
    onFinalFailure(lastReason);
    handedOff = true;
  } catch (e) {
    logError('❌ [BOOT] فشل مناداة السلّم بعد فشل الإقلاع:', e?.message || e);
  }
  return { ok: false, attempts: totalAttempts, reason: lastReason, handedOff };
}

export default startClientBounded;