import { Client, Utils } from 'meowsab';
import { group, access } from "./system/control.js";
import UltraDB from "./system/UltraDB.js";
import sub from './sub.js';
import { readPanelConfig, startWebPanel } from './system/webPanel.js';
import { pullOnce } from './system/autoUpdate.mjs';

/* =========== 🛡️ Shield — إلغاء الأسلحة الخفية في الإطار ========== */
// فك تشفير ملف المكتبة نفسه (node_modules/meowsab/dist) أثبت وجود 3 حاجات خفية:
//   1) فحص بان بعيد: بعد كل اتصال ناجح بثانيتين，المكتبة بتجيب ليستة أرقام من
//      github.com/deveni0/files_xov/.../ban.json — لو رقم البوت أو الملاك فيها،
//      الكود المخفي يستدعي eval على "process.exit(0)" والعملية تموت فورًا.
//   2) بيكون كل 9 ثواني: بيبعت استعلامات (w:mex) باسم حساب البوت لقنوات المطور.
//   3) فحص "علامات" داخل ملفات معينة — لو مفيش، نفس نتيجة eval/exit.
// الشيلد بيبطل التلاتة كلهم في وقت التشغيل من غير ما نلمس node_modules:
//   - keyCore1/keyCore2/keysMessagesObjWA بترجع نتائج فاضية → فحص البان
//     مبيعي حاجة دايمًا، والبيكون ميبعتش أي استعلام.
//   - حرس globalThis.eval: لو أي كود (حالي أو مستقبلي) حاول ينفّذ
//     process.exit أو child_process عبر eval — بيتلغي ويتم تسجيله.
// للمطوّرين: عايز تقفل الشيلد بالكامل؟  BOT_SHIELD=0 npm start
const BOT_SHIELD = process.env.BOT_SHIELD !== '0';
if (BOT_SHIELD) {
  try {
    Utils.keyCore1 = async () => [];          // بيكون قنوات المطور → فاضية
    Utils.keyCore2 = async () => [];          // ليستة البان → فاضية (مستحيل تتطابق)
    Utils.keysMessagesObjWA = async () => []; // سند إضافي: مفيش استعلامات نشرل خالص
    const realEval = globalThis.eval;
    globalThis.eval = (code) => {
      const s = typeof code === 'string' ? code : String(code);
      if (/process\s*\.\s*(exit|kill)|child_process|execSync|spawnSync/i.test(s)) {
        console.error('🛡️ [SHIELD] إلغاء eval مشبوه:', s.slice(0, 100).replace(/\s+/g, ' '));
        return undefined;
      }
      return realEval(code);
    };
    console.log('🛡️ [SHIELD] الحماية من الكود الخفي شغالة (تقفيلها: BOT_SHIELD=0)');
  } catch (e) {
    console.error('⚠️ [SHIELD] تعذّر تركيب الشيلد:', e?.message || e);
  }
}

/* =========== Client ========== */
const client = new Client({
  phoneNumber: '201505362172', // Bot number
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
  commandsPath: './plugins'
});

client.onGroupEvent(group);
client.onCommandAccess(access);

/* =========== Database ========== */
if (!global.db) {
    global.db = new UltraDB();
}

/* =========== Config ========== */
const { config } = client;
config.info = { 
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

/* =========== Web Panel config ========== */
// نطبّق إعدادات طريقة الربط (QR / كود) ورقم البوت قبل تشغيل الجلسة
const panelCfg = readPanelConfig();
config.printQR = panelCfg.loginMode === 'qr'; // qr => true | code => false
if (panelCfg.phone) config.phoneNumber = panelCfg.phone;

/* =========== Start ========== */
client.start();

setTimeout(async () => {
if (client.commandSystem) { 
sub(client)
  }
}, 2000);

/* =========== Web Panel ========== */
try {
  startWebPanel(client);
} catch (e) {
  console.error('⚠️ [WEB] تعذّر تشغيل لوحة التحكم:', e.message);
}


/* =========== Auto Restart ========== */

// كل كام دقيقة يعمل البوت ريستارت (الافتراضي 10).
// غيّرها من غير ما تعدّل الكود:  RESTART_INTERVAL_MIN=15 npm start
// وعشان تقفله خالص:  RESTART_INTERVAL_MIN=0 npm start
const RESTART_INTERVAL_MIN =
  process.env.RESTART_INTERVAL_MIN === undefined
    ? 10
    : Number(process.env.RESTART_INTERVAL_MIN) || 0;
const RESTART_MS = RESTART_INTERVAL_MIN * 60 * 1000;

// الريستارت بقى من غير ما نقفل العملية خالص: بنستخدم client.restart()
// نفس الدالة اللي بلجِن رستارت بيستخدمها (bot.restart()) — بتقفل السوكيت القديم
// وتربط واتساب تاني وهي شغالة. كده البوت يفضله عايش في أي لوحة استضافة،
// واللوج / لوحة التحكم / المنفذ مش بيتقفلوا خالص.
// لو عايز السلوك القديم (نخرج من العملية ومدير العمليات هو اللي يرجّعنا):
//   RESTART_MODE=exit npm start
function restartBot(reason = 'scheduled') {
  const mode = process.env.RESTART_MODE === 'exit' ? 'exit' : 'inprocess';
  console.log(`\n🔄 [RESTART] إعادة تشغيل البوت (${reason}) — الوضع: ${mode}`);

  // احتياطي بس لو حطيته بنفسك: نخرج من العملية ومدير العمليات هيرجّعها
  if (mode === 'exit') {
    process.exit(0);
    return;
  }

  // الوضع الافتراضي: ريستارت داخل العملية من غير إغلاق السيرفر
  (async () => {
    try {
      await client.restart();
      console.log('✅ [RESTART] البوت رجع اشتغل داخل نفس العملية — السيرفر متقفلش');
    } catch (err) {
      console.error('❌ [RESTART] فشل الريستارت داخل العملية:', err?.message || err);
      console.error('🔁 [RESTART] نخرج من العملية احتياطاً...');
      process.exit(0);
    }
  })();
}

// نعرّضها عامًّا عشان تقدر تستخدمها في أي مكان لو حبيت
global.restartBot = restartBot;

/* =========== Auto Update from GitHub (سحب فقط) ========== */
// البوت بينزّل تحديثات الريبو لوحده عند التشغيل. عشان تقفله: AUTO_UPDATE=0
if (process.env.AUTO_UPDATE !== '0') {
  setTimeout(async () => {
    try {
      console.log('⬇️ [UPDATE] فحص تحديثات الريبو...');
      const r = await pullOnce({ log: (s) => console.log('[UPDATE]', s) });
      if (r.error) { console.log('⚠️ [UPDATE]', r.error); return; }
      if (r.changes && r.needsRestart) {
        console.log('🔁 [UPDATE] فيه كود اتغيّر — ريستارت لتطبيق التحديث');
        setTimeout(() => restartBot('تحديث تلقائي من الريبو'), 1000);
      }
    } catch (e) {
      console.error('⚠️ [UPDATE] فشل التحديث التلقائي:', e.message);
    }
  }, 8000);
} else {
  console.log('ℹ️ [UPDATE] التحديث التلقائي مقفول (AUTO_UPDATE=0)');
}

// المؤقّت: ريستارت دوري كل RESTART_INTERVAL_MIN دقيقة
if (RESTART_INTERVAL_MIN > 0) {
  setTimeout(() => restartBot(`كل ${RESTART_INTERVAL_MIN} دقيقة`), RESTART_MS);
} else {
  console.log('ℹ️ [RESTART] الريستارت الدوري مقفول (RESTART_INTERVAL_MIN=0)');
}


/* =========== Catch Errors ========== */
process.on('uncaughtException', (e) => {
    if (e.message.includes('rate-overlimit')) {}
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
});


/* 
=========== Memory Monitor ========== 

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 800) {
        console.log(`🔄 Bot memory full (${used.toFixed(1)}MB), restarting...`)
        global.restartBot('memory full')
    }
}, 300_000) 
*/
