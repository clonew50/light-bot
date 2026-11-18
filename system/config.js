/**
 * config.js — إعدادات تشغيل البوت (مفصولة عن index.js)
 * =====================================================
 * الهدف: بصمة الجهاز (browser) تبقى ثابتة عبر كل مرات التشغيل.
 * الإطار (meowsab) بيختار اسم متصفح عشوائي افتراضيًا
 * (Chrome / Firefox / Safari / Edge) فبصمة الجهاز كانت بتتغيّر في كل تشغيل،
 * يعني البوت بيبان على واتساب كأنه جهاز جديد كل مرة.
 * هنا بنثبّت البصمة على "LightBot" (أو BOT_BROWSER لو اتحدّد من البيئة)
 * قبل ما يتعمل الاتصال.
 *
 * export buildConfig(env) → إعدادات الـ Client (نفس القيم القديمة + browser مثبّت)
 * export buildInfo(env)  → بيانات البوت المعروضة (nameBot / urls / copyright ...)
 */

/** البصمة الثابتة الافتراضية للجهاز */
export const DEFAULT_BROWSER = 'LightBot';

/* =========== onError — خطّاف أخطاء الإطار (todo 4 / GAP-11) ===========
   الإطار (node_modules/meowsab/dist) بينادي this.config.onError?.(n)
   في مسار فشل start() بعد ما يسجّل "Failed to start: ..." — فده هو
   hook فشل الإقلاع الرسمي عندنا. المفتاح موجود في مخطط الإطارات
   الصارم (z.object({...}).strict() فيه onError: z.custom().optional())
   فتمريره هنا آمن — أي مفتاح غريب تاني كان هيرمي عند البناء.
   بنسجّل آخر خطأ بس، وحارس التشغيل (system/bootGuard.js) بيقراه
   عند فشل محاولة التشغيل عشان يعرض سبب واضح. */

/** آخر خطأ اتسجّل من الإطار عبر config.onError. */
let clientError = null;

/** يسجّل آخر خطأ من الإطار (هي اللي تتباس كـ onError في buildConfig). */
export function recordClientError(err) {
  clientError = err || null;
  if (clientError) {
    try {
      console.error('⚠️ [CONFIG] الإطار أبلغ عن خطأ (onError):', clientError.message || clientError);
    } catch {}
  }
}

/** آخر خطأ مسجّل من الإطار أو null (للقراءة — من غير مسح). */
export function lastClientError() {
  return clientError;
}


/**
 * parseNumEnv — قراءة رقم من متغيّرات البيئة بشكل آمن.
 *
 * المشكلة القديمة: `Number(env) || 0` كان بيحوّل أي قيمة غلط (أو سالبة)
 * لـ 0 — يعني حماية كانت شغالة بقت مقفولة من غير ما حد يعلم.
 *
 * القواعد:
 *   • متغيّر مش موجود → القيمة الافتراضية (من غير تحذير).
 *   • قيمة فاضية أو مش رقم → تحذير بالعربي + القيمة الافتراضية.
 *   • قيمة سالبة → بتتقصّ على min (مش بترجع للافتراضي).
 *   * القيمة 0 بتتم محترمة (0 = مقفول هو قيمة مقصودة مش غلطة).
 *   • أكبر من max → بتتقصّ على max.
 *
 * @param {string} name اسم المتغيّر
 * @param {number} fallback القيمة الافتراضية
 * @param {object} [options] { min, max, env, warn }
 * @returns {number}
 */
export function parseNumEnv(name, fallback, options = {}) {
  const {
    min,
    max,
    env = process.env,
    warn = (msg) => console.warn(msg),
  } = options;

  const raw = env?.[name];
  if (raw === undefined || raw === null) return fallback;

  const text = String(raw).trim();
  const parsed = text === '' ? NaN : Number(text);
  if (!Number.isFinite(parsed)) {
    warn(`⚠️ قيمة ${name} غير صالحة، استخدمت ${fallback}`);
    return fallback;
  }

  let value = parsed;
  if (typeof min === 'number' && value < min) value = min;
  if (typeof max === 'number' && value > max) value = max;
  return value;
}

/**
 * يبني إعدادات الـ Client.
 * @param {NodeJS.ProcessEnv} env
 */
export function buildConfig(env = process.env) {
  return {
    phoneNumber: env.BOT_PHONE || '', // Bot number (يجب تعيينه عبر BOT_PHONE في البيئة)
    prefix: [".", "/", "!"],
    fromMe: null, // null = السماح للرقم المتصل بالبوت وبقية المستخدمين بتشغيل الأوامر
    owners: [
    // Owner 1
      { name: "𝑮𝑶𝑲𝑶", lid: "129723211@lid", jid: "218930171336@s.whatsapp.net" },
    // Owner 2
      { name: "GOKO", lid: "218945778513@lid", jid: "218930171337@s.whatsapp.net" },
    // Owner 3
     { name: "GOKO", jid: "201212446299@s.whatsapp.net", lid: "959666432747@lid" }
    ],
    settings: { noWelcome: true },
    commandsPath: './plugins',
    // بصمة الجهاز الثابتة — بتتحوّل جوه واتساب لـ ['Ubuntu', <browser>, '22.04.4']
    browser: env.BOT_BROWSER || DEFAULT_BROWSER,
    // خطّاف أخطاء الإطار (فشل الإقلاع + أخطاء المعالجات) — مسموح به في
    // المخطط الصارم: onError: z.custom().optional()
    onError: recordClientError
  };
}

/**
 * يبني بيانات البوت (info) — نفس القيم القديمة بالظبط.
 * @param {NodeJS.ProcessEnv} env
 */
export function buildInfo(env = process.env) {
  return {

    nameBot: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻", 
    nameChannel: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳", 
    // قناة البوت (newsletter) — بيانات المشغّل، مش قناة المطور الأصلي.
    // بتتظبط من البيئة: BOT_NEWSLETTER_JID (لو فاضية مفيش أي رسالة هتتحوّل لقناة).
    idChannel: (env.BOT_NEWSLETTER_JID || '').trim(),
    urls: {
      repo: "https://github.com/clonew50/light-bot",
      // المزود الافتراضي للذكاء الاصطناعي: Pollinations النصي المجاني (بدون مفتاح).
      // المزود القديم كان بيرد 402 على كل طلب فالأمر .اوبن كان مكسور.
      // المشغّل يقدر يغيّر العنوان من البيئة: AI_API_URL
      api: (env.AI_API_URL || '').trim().replace(/\/+$/, '') || "https://text.pollinations.ai",
      channel: "https://github.com/clonew50/light-bot"
    },
    copyright: { 
      pack: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻', 
      author: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻'
    },
    images: [
      "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/df4a4068-978a-4f77-afa8-bb5dd22968e1.jpg",
      "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg",
      "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/64789104-e032-44cd-a94f-8531fd17522c.jpg"
    ]
  };
}
