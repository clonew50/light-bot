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

/**
 * يبني إعدادات الـ Client.
 * @param {NodeJS.ProcessEnv} env
 */
export function buildConfig(env = process.env) {
  return {
    phoneNumber: env.BOT_PHONE || '201505362172', // Bot number (يمكن تغييره من BOT_PHONE)
    prefix: [".", "/", "!"],
    fromMe: false,
    owners: [
    // Owner 1
      { name: "𝑮𝑶𝑲𝑶", lid: "12 972 3211@lid", jid: "218930171336@s.whatsapp.net" },
    // Owner 2
      { name: "GOKO", lid: "218945778513@lid", jid: "218930171336@s.whatsapp.net" },
    // Owner 3
      { name: "GOKO", jid: "120363411398644841@g.us", lid: "79006443503783@lid" },
    // Owner 4 
     { name: "GOKO", jid: "201212446299@s.whatsapp.net", lid: "959666432747@lid" }
    ],
    settings: { noWelcome: true },
    commandsPath: './plugins',
    // بصمة الجهاز الثابتة — بتتحوّل جوه واتساب لـ ['Ubuntu', <browser>, '22.04.4']
    browser: env.BOT_BROWSER || DEFAULT_BROWSER
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
    idChannel: "120363405545946827@newsletter",
    urls: {
      repo: "https://github.com/deveni0/Pomni-AI",
      api: "https://emam-api.web.id",
      channel: "https://whatsapp.com/channel/0029Vb7dTmNJENy9sp5yqi3T"
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
