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

/**
 * يربط مُصلح الجلسة على السوكيت الحالي، ويعيد ربطه تلقائيًا لما السوكيت يتغير.
 * @param {object} client  عميل meowsab
 * @param {object} opts
 * @param {(reason:string)=>void} opts.restart     دالة تنفيذ الريستارت
 * @param {()=>boolean} [opts.shouldSkip]          لو رجّع true → متدخلش (إيقاف يدوي/ربط)
 * @param {number} [opts.quietMs]  أقل مدة بين محاولتين علاج (30 ثانية)
 * @param {number} [opts.pollMs]   مدة فحص السوكيت (800ms)
 * @param {(msg:string)=>void} [opts.log]
 */
export function attachHealer(client, opts = {}) {
  const {
    restart = (reason) => global.restartBot?.(reason),
    shouldSkip = () => false,
    quietMs = 30 * 1000,
    pollMs = 800,
    log = (m) => console.log(m)
  } = opts;

  const state = { attached: null, quiet: 0, lastOpen: 0, heals: 0 };

  const timer = setInterval(() => {
    const sock = client?.sock;
    if (!sock || !sock.ev || sock === state.attached) return;
    state.attached = sock;
    try {
      sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u || {};
        if (connection === 'open') { state.lastOpen = Date.now(); return; }
        if (connection !== 'close') return;

        const err = lastDisconnect?.error;
        const code = err?.output?.statusCode;
        const msg = String(err?.message || err || '');

        // بنعالج بس badSession (أو رسايل زي Bad MAC) — لا غير
        if (!(code === BAD_SESSION_STATUS || BAD_CLOSE.test(msg))) return;
        if (Date.now() < state.quiet) return;      // quiet window
        if (shouldSkip()) return;                 // إيقاف يدوي أو عملية ربط

        state.quiet = Date.now() + quietMs;
        state.heals++;
        log(`🩹 [HEALER] الاتصال قفل بسبب badSession (المحاولة ${state.heals}) — ريستارت تلقائي لإصلاح الجلسة`);
        setTimeout(() => restart('bad-session auto-heal'), 2000);
      });
    } catch (e) {
      log('⚠️ [HEALER] تعذّر ربط مستمع الاتصال: ' + (e?.message || e));
    }
  }, pollMs);

  timer.unref?.();
  return { stop: () => clearInterval(timer), state };
}

export default attachHealer;
