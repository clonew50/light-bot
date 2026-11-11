import { Client, Utils } from 'meowsab';
import { group, access } from "./system/control.js";
import UltraDB from "./system/UltraDB.js";
import sub from './sub.js';
import { readPanelConfig, startWebPanel, panelRuntime } from './system/webPanel.js';
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
  phoneNumber: process.env.BOT_PHONE || '201505362172', // Bot number (يمكن تغييره من BOT_PHONE)
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

/* =========== Healer — علاج Bad session تلقائيًا ========== */
// المشكلة المعروفة في إطار meowsab: لما الاتصال يتقفل بسبب badSession
// (الجلسة بقت فاسدة عند سيرفر واتساب — دي اللي بتحصل بعد فترة من التشغيل)
// الإطار بيكتفي بكتابة " Bad session" في اللوج ويسيب البوت ميت
// (isRunning=false) من غير أي محاولة رجوع — وبفضل ميت لحد ما تريح ريستارت يدوي.
// هنا بنتكدس على connection.update بنفسنا ونصلّحه في ثواني: بنعمل نفس
// الريستارت اللي بيحصل لما تعمله من اللوحة يدويًا، بس أوتوماتيك.
// ملاحظة: 401 (loggedOut) و 440 (connectionReplaced) معناها جلسة تانية
// سحبت الحساب — دول مش بيتصلحوا بريستارت فمينفعش نلمسهم.
// اقفله: HEALER=0 npm start
if (process.env.HEALER !== '0') {
  const healer = { attached: null, quiet: 0 };
  const BAD_CLOSE = /bad.?session|session.?error|bad.?mac/i;
  setInterval(() => {
    const sock = client?.sock;
    if (!sock || !sock.ev || sock === healer.attached) return;
    healer.attached = sock;
    try {
      sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u || {};
        if (connection === 'open') { global.__lastConnOpen = Date.now(); return; }
        if (connection !== 'close') return;
        const err = lastDisconnect?.error;
        const code = err?.output?.statusCode;
        const msg = String(err?.message || err || '');
        // 500 = DisconnectReason.badSession في Baileys
        const healable = code === 500 || BAD_CLOSE.test(msg);
        if (!healable || Date.now() < healer.quiet) return;
        const rt = panelRuntime();
        if (rt.stopped || rt.pairing) return;   // إيقاف يدوي أو عملية ربط — مش عيب في الجلسة
        healer.quiet = Date.now() + 30 * 1000; // مش أكتر من محاولة كل 30 ثانية
        console.log('🩹 [HEALER] الاتصال قفل بسبب badSession — ريستارت تلقائي لإصلاح الجلسة');
        setTimeout(() => global.restartBot?.('bad-session auto-heal'), 2000);
      });
    } catch (e) {
      console.error('⚠️ [HEALER] تعذّر ربط مستمع الاتصال:', e?.message || e);
    }
  }, 800);
}

/* =========== Start SubBots ========== */
// تشغيل البوتات الفرعية بعد ما نظام الأوامر يجهز — مع إعادة محاولة لو مش جاهز
// (الكود القديم كان بيفحص مرة واحدة بعد ثانيتين بس، ولو مش جاهز كان بيضيع خالص)
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!client.commandSystem) continue;
    try {
      await sub(client);
      return;
    } catch (e) {
      console.error('❌ [SUB] فشل تشغيل البوتات الفرعية:', e?.message || e);
      return;
    }
  }
  console.error('❌ [SUB] نظام الأوامر مش جهز بعد 90 ثانية — البوتات الفرعية مش هتشتغل');
})().catch(() => {});

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

/* =========== Watchdog — حرس الاتصال ========== */
// كل دقيقة: لو السوكيت مش متصل + عدّى 5 دقايق من التشغيل + مفيش عملية ربط
// شغالة دلوقتي (QR/كود) + المستخدم ماهوش قافل البوت عمدًا من اللوحة
// → ريستارت داخل العملية، مع كولداون: مرة واحدة كل 5 دقايق كحد أقصى.
// اقفله: WATCHDOG=0 npm start
if (process.env.WATCHDOG !== '0') {
  const BOOT_AT = Date.now();
  const NEEDS_BOOT_MS = 5 * 60 * 1000;   // بعد التشغيل قبل ما يشتغل الحرس
  const COOLDOWN_MS = 5 * 60 * 1000;     // المسافة الدنيا بين ريستارتين من الحرس
  let lastWatchdogRestart = 0;
  let esc = 0;                           // محاولات ريستارت ما فيش منها الاتصال رجع
  // نتابع آخر مرة شفنا اتصال ناجح (لو HEALER مقفول عشان ما نتصعّدش غلط)
  let lastOpenSeen = client.isConnected?.() ? Date.now() : 0;
  setInterval(() => { if (client.isConnected?.()) lastOpenSeen = Date.now(); }, 10 * 1000);
  setInterval(() => {
    try {
      if (Date.now() - BOOT_AT < NEEDS_BOOT_MS) return;
      if (typeof global.restartBot !== 'function') return;
      const rt = panelRuntime();
      if (rt.stopped) return;   // المستخدم وقف البوت عمدًا من اللوحة — مش هنعمل حاجة
      if (rt.pairing) return;   // في وسط عملية ربط/اسكان — هنسيبها تكمل
      if (client.isConnected?.()) return;
      if (Date.now() - lastWatchdogRestart < COOLDOWN_MS) return;
      // لو الريستارت اللي قبل كده مهرّجش الاتصال (مفيش open من ساعتها) — نصعّد.
      // بعد محاولتين فاشلت: نخرج من العملية خالص عشان مدير العمليات في لوحة
      // الاستضافة يرجّعنا بحالة نضيفة (جلسة فاسدة مش دايمًا بتتصلح داخل العملية).
      if (lastWatchdogRestart && lastOpenSeen < lastWatchdogRestart) esc++; else esc = 0;
      lastWatchdogRestart = Date.now();
      if (esc >= 2) {
        console.error('💀 [WATCHDOG] الريستارت الداخلي مهرّجش الاتصال بعد محاولات — خروج كامل عشان لوحة الاستضافة ترجّعنا نضيفين');
        process.exit(0);
      }
      console.log('⏱️ [WATCHDOG] الاتصال مقطوع من فترة طويلة — ريستارت تلقائي');
      global.restartBot('watchdog');
    } catch (e) {
      console.error('⚠️ [WATCHDOG] خطأ في فحص الحرس:', e?.message || e);
    }
  }, 60 * 1000);
}

/* =========== Memory Guard — حرس الذاكرة ========== */
// لو الذاكرة علت فوق الحد نعمل ريستارت داخل العملية قبل ما لوحة الاستضافة
// تقتل العملية بـ OOM (وده موت مفاجئ للبوت واللوحة مع بعض).
// الحد بالـ MB:  MEMORY_RESTART_MB=950 (افتراضي)  |  0 = مقفول
const MEMORY_RESTART_MB = Number(process.env.MEMORY_RESTART_MB ?? '950') || 0;
if (MEMORY_RESTART_MB > 0) {
  setInterval(() => {
    try {
      const rss = process.memoryUsage().rss / 1024 / 1024;
      if (rss > MEMORY_RESTART_MB) {
        console.log(`🧠 [MEMORY] الذاكرة وصلت ${rss.toFixed(0)}MB (الحد ${MEMORY_RESTART_MB}MB) — ريستارت وقائي`);
        global.restartBot?.('memory high');
      }
    } catch {}
  }, 5 * 60 * 1000);
}

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
// بديل الكود القديم اللي كان بيبلع أي Exception بلا تسجيل، وكمان كان ممكن
// يعمل كراش جوه المعالج نفسه لو e.message فاضي (لما الحاجة تترمي مش Error).
// دلوقتي: بنسجل الخطأ كاملًا، ونكمل عادي للأخطاء العابرة المعروفة بس،
// ونخرج للأخطاء المجهولة عشان مدير العمليات يرجّعنا بحالة نظيفة.
const BENIGN_ERRORS =
  /rate-overlimit|ECONNRESET|EPIPE|ETIMEDOUT|ENETUNREACH|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Connection Closed|timed out|stream errored|conflict|restart required/i;
process.on('uncaughtException', (e) => {
  const msg = e && e.message ? e.message : String(e);
  console.error('💥 [UNCAUGHT] استثناء غير متوقع:', msg);
  if (e && e.stack) console.error(e.stack);
  if (BENIGN_ERRORS.test(msg)) return; // خطأ عابر من سوكت واتساب/الشبكة — نكمل الشغل
  console.error('💀 [UNCAUGHT] خطأ مجهول — ريستارت داخل العملية (اللوحة تبقى شغالة)');
  if (typeof global.restartBot === 'function') { global.restartBot('uncaught-exception'); return; }
  process.exit(1);
});

// بنسجل أول 30 + كل 100 عشان اللوج ميفيضش لو في بيبوج رفضات متكرر
let rejLogged = 0;
process.on('unhandledRejection', (err) => {
  rejLogged++;
  if (rejLogged <= 30 || rejLogged % 100 === 1) {
    console.error('⚠️ [UNHANDLED REJECTION]', err?.message || String(err));
  }
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
