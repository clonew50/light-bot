/*
  ═══════════════════════════════════════════
  🔗 حالة الربط (Pairing State)
  ───────────────────────────────────────────
  المشكلة: اللوحة كانت بتحسب "في عملية ربط شغالة" من وجود QR أو كود ربط
  في الذاكرة بس (state.qr || state.pairingCode). لو المستخدم مكمّلش الربط،
  أو البوت اتقفل قبل ما يكمّل، الـ flag بيفضل true للأبد → الـ watchdog
  والـ healer بيقفوا ومحدش بيعمل ريستارت → البوت ميت والزومبيرج مش شايف ده.

  الحل: حالة ربط حقيقية بساعة خاصة. الـ pairing نشط بس طول ما:
    • اتصدر QR أو كود ربط (ومفيش open بعده)، و
    • مفيش اتصال اتفتح بعد كده، و
    • عدّت أقل من 3 دقايق (PAIRING_TTL_MS) من غير اتصال.
  أي QR/كود جديد بيعيد تشغيل الساعة من الأول، وأي open بيصفّر الحالة.
  حالة الربط منتهية الصلاحية بتتقفل لوحدها — من غير ما نلمس الجلسة خالص.
  ═══════════════════════════════════════════
*/

/** مدة صلاحية عملية الربط قبل ما تتconsidered منتهية (3 دقايق) */
export const PAIRING_TTL_MS = 3 * 60 * 1000;

/**
 * بيعمل حالة ربط مستقلة (state machine) — كل نسخة عليها ساعتها الخاصة.
 * @param {object} [options]
 * @param {number} [options.ttlMs]  مدة الصلاحية بالمللي ثانية (افتراضي PAIRING_TTL_MS)
 * @param {() => number} [options.now] ساعة (وحدة اختبار بتعمل fake clock)
 */
export function createPairingState(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? options.ttlMs : PAIRING_TTL_MS;
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();

  let qr = null;          // آخر QR اتصدر
  let pairingCode = null; // آخر كود ربط اتصدر
  let startedAt = 0;      // وقت صدور آخر QR/كود

  const nowOf = (now) => (typeof now === 'number' && Number.isFinite(now) ? now : clock());
  const hasPairing = () => !!(qr || pairingCode);

  /** اتصدر QR جديد → العملية بقت شغالة والعداد رجع من الأول */
  function setQr(code) {
    qr = code ?? null;
    pairingCode = null;
    startedAt = nowOf();
    return qr;
  }

  /** اتصدر كود ربط جديد → العملية بقت شغالة والعداد رجع من الأول */
  function setPairingCode(code) {
    pairingCode = code ?? null;
    qr = null;
    startedAt = nowOf();
    return pairingCode;
  }

  /** اتفصل الاتصال / اتقفل — العملية مبقتش شغالة (من غير ما نلمس الجلسة) */
  function clear() {
    qr = null;
    pairingCode = null;
    startedAt = 0;
  }

  /** هل انتهت صلاحية العملية؟ (من غير مسح — عشان نعرف قبل المسح) */
  function expired(now) {
    if (!hasPairing()) return false;
    return nowOf(now) - startedAt >= ttlMs;
  }

  /** نشط بس لو فيه QR/كود صادر ومفيش open بعده والوقت لسه داخل في الصلاحية */
  function isActive(now) {
    if (!hasPairing()) return false;
    return !expired(now);
  }

  /** عمر عملية الربط بالمللي ثانية (0 لو مفيش عملية) */
  function ageMs(now) {
    if (!hasPairing()) return 0;
    return Math.max(0, nowOf(now) - startedAt);
  }

  return {
    ttlMs,
    setQr,
    setPairingCode,
    clear,
    expired,
    isActive,
    ageMs,
    get qr() { return qr; },
    get pairingCode() { return pairingCode; },
    get startedAt() { return startedAt; }
  };
}

export default createPairingState;
