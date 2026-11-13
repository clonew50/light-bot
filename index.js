import { Client, Utils } from 'meowsab';
import { group, access } from "./system/control.js";
import UltraDB from "./system/UltraDB.js";
import sub from './sub.js';
import { readPanelConfig, startWebPanel, panelRuntime, pushEvent as panelPushEvent, pairingActive } from './system/webPanel.js';
import { attachHealer } from './system/healer.js';
import { pullOnce } from './system/autoUpdate.mjs';
import { buildConfig, buildInfo, lastClientError } from './system/config.js';
import { parseNumEnv } from './system/config.js';
import { startClientBounded } from './system/bootGuard.js';
import { createRestartController, installGlobalRestart } from './system/restart-ladder.js';
import { attachSessionBackup, installShutdownHandlers, restoreSessionFromBackup, warnSubBotSessionsNotCovered } from './system/sessionBackup.js';
import { createPeriodicRestartScheduler, installPresenceCap } from './system/runtime-controls.js';
import { pushEvent as pushRuntimeEvent } from './system/events.js';

// أحداث حارس الإقلاع (bootGuard) بتتبعت من هنا بنوع مستقل — نفس الدالة اللي
// بتترحّل لناقل الأحداث، بس kind='boot' عشان تبان في اللوحة كـ"إقلاع".
const pushEvent = (m) => pushRuntimeEvent('boot', m);

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
    pushRuntimeEvent('shield', 'الحماية من الكود الخفي شغالة');
  } catch (e) {
    console.error('⚠️ [SHIELD] تعذّر تركيب الشيلد:', e?.message || e);
    pushRuntimeEvent('shield', 'تعذّر تركيب الشيلد: ' + (e?.message || e));
  }
}

/* =========== Client ========== */
const client = new Client(buildConfig());
// بصمة الجهاز الثابتة — بتتحوّل جوه واتساب لـ ['Ubuntu', <browser>, '22.04.4']
console.log(`🔎 بصمة الجهاز: ${client.config.browser}`);

/* =========== Presence — كبح الإرسال المكرّر ========== */
// الإطار (meowsab) بيضيف setInterval(25s) جوه كل start() بيعمل
// sendPresenceUpdate("available")، وبيسيب المؤقّت من غير ما يمسحه وبيحفظش
// الـ handle — فبعد كل ريستارت بيبعت presence مرّة إضافية كل 25 ثانية.
// الحل من غير أي تعديل في node_modules: غلاف runtime على sendPresenceUpdate
// ( جنب الشيلد ) بيكبح الإرسال التلقائي، ومؤقّت واحد بتاعنا هو اللي بيبعت
// رسالة واحدة كل 25 ثانية — والعدّاد بيتعرض في اللوحة.
const presenceCap = installPresenceCap(client, {
  log: (...a) => console.log(...a),
});
global.presenceStats = () => presenceCap.stats();

client.onGroupEvent(group);
client.onCommandAccess(access);

/* =========== Database ========== */
if (!global.db) {
    global.db = new UltraDB();
}

/* =========== Config ========== */
const { config } = client;
config.info = buildInfo();

/* =========== Web Panel config ========== */
// نطبّق إعدادات طريقة الربط (QR / كود) ورقم البوت قبل تشغيل الجلسة
const panelCfg = readPanelConfig();
config.printQR = panelCfg.loginMode === 'qr'; // qr => true | code => false
if (panelCfg.phone) config.phoneNumber = panelCfg.phone;

/* =========== Session Backup — حماية جلسة واتساب من التلف ========== */
// لو session/creds.json اتلخبط أو اتقطع → نرجّعه من النسخة الاحتياطية قبل
// ما نعمل أي اتصال. لو مفيش نسخة → البوت يقلع من غير ربط (unpaired)
// من غير ما نمسح أي حاجة ومن غير كراش.
try {
  const restored = restoreSessionFromBackup(client.config?.sessionPath || './session');
  if (restored?.restored) pushRuntimeEvent('restore', 'تم استرجاع نسخة الجلسة من النسخة الاحتياطية');
  else pushRuntimeEvent('restore', 'الجلسة سليمة — مفيش استرجاع مطلوب (' + (restored?.reason || 'unknown') + ')');
} catch (e) {
  console.error('⚠️ [SESSION] فشل فحص النسخة الاحتياطية للجلسة:', e?.message || e);
  pushRuntimeEvent('restore', 'فشل فحص جلسة الاسترجاع: ' + (e?.message || e));
}
// نسخة احتياطية تلقائية كل ما الإطار يحدّث بيانات الاعتماد
attachSessionBackup(client);
// تحذير واضح: جلسات البوتات الفرعية (sub/) مش داخل في النسخة الاحتياطية
warnSubBotSessionsNotCovered({ push: panelPushEvent });

/* =========== Start — تشغيل مقيّد بمهلة وإعادة محاولة (todo 4 / GAP-11) ===========
   client.start(); لا يرفق خطأ أبدًا: الإطار بيقبض على خطأه داخليًا، يسجّل
   "Failed to start"، ينادي config.onError (شوف buildConfig في system/config.js)
   ويعيد الجدولة بنفسه — يعني await وحده مش بيكتشف فشل الإقلاع.
   و fetchLatestBaileysVersion() جوّه نفس try بتاعه ملهاش مهلة، فشبكة
   معلّقة (host مش بييجي) هتخلي التشغيل معلّق للأبد من غير أي إشارة.
   عشان كده بنستخدم system/bootGuard.js:
     - مهلة 90 ثانية لكل محاولة: مفيش connection === 'open' خلالها = فشل
     - 3 محاولات بفواصل 5 / 15 / 45 ثانية، وكل فشل بيدفع حدث عربي للوحة
     - بعد آخر فشل بنسلّم الأمر للسلّم: global.restartBot('boot-failed')
       (السلّم في system/restart-ladder.js هو اللي بيحدد كود الخروج)
     - الجلسة (auth state) مش بنتمسح عند الفشل خالص.
   التشغيل مش بيستنى هنا — باقي ترتيب الإقلاع (healer / SubBots / اللوحة)
   بيكمل زي ما هو، والسوبرفايزر/السلّم بيديروا التشغيل من جديد. */
startClientBounded(client, {
  pushEvent,
  lastFailureReason: lastClientError,
  // إيقاف عدّاد المهلة أثناء عملية ربط حقيقية (QR/كود) — نفس الدالة اللي
  // بيستخدمها الـ watchdog والـ healer. بدونها: bootGuard بيستخدم
  // () => false افتراضيًا، فربط شرعي أقدم من 90 ثانية بيتحسب فشل ويتكرر.
  isPairing: pairingActive,
}).catch((e) => console.error('❌ [BOOT] خطأ غير متوقع في حارس التشغيل:', e?.message || e));

/* =========== Healer — علاج Bad session تلقائيًا ========== */
// البروفوكول موجود في system/healer.js — شرحه الكامل there.
// ملخص: لما الاتصال يتقفل بسبب badSession (الجلسة فاسدة عند سيرفر واتساب —
// بتحصل بعد فترة من التشغيل) الإطار بيسيب البوت ميت من غير ما يرجع، فبنعمل
// نفس ريستارت اللوحة أوتوماتيك. 401/440 (حساب مقفول/جلسة تانية) مش بنلمسهم.
// اقفله: HEALER=0 npm start
if (process.env.HEALER !== '0') {
  attachHealer(client, {
    restart: (reason) => {
      pushRuntimeEvent('healer', 'مُصلح الجلسة: ' + reason);
      return global.restartBot?.(reason);
    },
    shouldSkip: () => {
      try {
        const rt = panelRuntime();
        // نقف بس لو في عملية ربط حقيقية شغالة دلوقتي (الحالة عندها عمر محدود)
        return !!(rt.stopped || pairingActive());
      } catch { return false; }
    }
  });
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
let panelServer = null;
try {
  panelServer = startWebPanel(client);
} catch (e) {
  console.error('⚠️ [WEB] تعذّر تشغيل لوحة التحكم:', e.message);
}


/* =========== Auto Restart ========== */

// كل كام دقيقة يعمل البوت ريستارت (الافتراضي 10).
// غيّرها من غير ما تعدّل الكود:  RESTART_INTERVAL_MIN=15 npm start
// وعشان تقفله خالص:  RESTART_INTERVAL_MIN=0 npm start
// القيمة بتتحقّق parseNumEnv: قيمة مش رقم بتتحذّر بالعربي وبترجع للافتراضي
// (مش بتتحوّل لـ 0 زي الأول — كانت القيمة الغلط بتقفل الحماية من غير ما حد يعلم).
const RESTART_INTERVAL_MIN = parseNumEnv('RESTART_INTERVAL_MIN', 10, { min: 0, max: 1440 });
const RESTART_MS = RESTART_INTERVAL_MIN * 60 * 1000;

// الريستارت بقى من غير ما نقفل العملية خالص: بنستخدم client.restart()
// نفس الدالة اللي بلجِن رستارت بيستخدمها (bot.restart()) — بتقفل السوكيت القديم
// وتربط واتساب تاني وهي شغالة. كده البوت يفضله عايش في أي لوحة استضافة،
// واللوج / لوحة التحكم / المنفذ مش بيتقفلوا خالص.
// لو عايز السلوك القديم (نخرج من العملية ومدير العمليات هو اللي يرجّعنا):
//   RESTART_MODE=exit npm start
//
// كل مصادر إعادة التشغيل (المؤقّت، الحرس، حرس الذاكرة، التحديث التلقائي،
// مُصلح الجلسة، أزرار اللوحة، أمر المالك) بتمر من المسار الواحد ده:
//   system/restart-ladder.js فيه القفل أحادي المسار (عملية واحدة في نفس الوقت)
//   + سلّم التصعيد (بعد محاولتين متتاليتين من غير open ← خروج نظيف بكود 1).
// تفصيل القفل والتصعيد كله في system/restart-ladder.js.

// تفريغ الداتابيز قبل أي خروج قاتل.
// UltraDB بيكتب الملف عند process.on('exit') (system/UltraDB.js) — فبنطلب
// flush صريح لو متاح، وبعدين الخروج بيكمل حفظ أي تغييرات معلّقة.
async function flushDb() {
  try {
    const db = global.db;
    if (db && typeof db.flush === 'function') { await db.flush(); return true; }
  } catch (e) {
    console.error('⚠️ [RESTART] فشل تفريغ الداتابيز:', e?.message || e);
  }
  return false;
}

// كم محاولة فاشلة متتالية قبل ما نعمل خروج كامل نظيف (كود 1) عشان مدير
// العمليات يرجّع البوت. الافتراضي 2 (زي سلّم التصعيد في system/restart-ladder.js).
const RESTART_FULL_EVERY = parseNumEnv('RESTART_FULL_EVERY', 2, { min: 1, max: 100 });

const restartController = createRestartController({
  client,
  mode: process.env.RESTART_MODE === 'exit' ? 'exit' : 'inprocess',
  flushDb,
  escalateAfter: RESTART_FULL_EVERY,
  log: (...a) => console.log(...a),
  logError: (...a) => console.error(...a),
});

// الدالة المحلية (المؤقّت + التحديث التلقائي) والنسخة العامة
// (لوحة التحكم + أمر المالك) — الاتنين بيروحوا لنفس القفل ونفس السلّم.
function restartBot(reason = 'scheduled') {
  return restartController.restart(reason);
}

// نعرّضها عامًّا عشان تقدر تستخدمها في أي مكان لو حبيت
installGlobalRestart(restartController);

/* =========== Watchdog — حرس الاتصال ========== */
// كل دقيقة: لو السوكيت مش متصل + عدّى 5 دقايق من التشغيل + مفيش عملية ربط
// شغالة دلوقتي (QR/كود) + المستخدم ماهوش قافل البوت عمدًا من اللوحة
// → ريستارت داخل العملية، مع كولداون: مرة واحدة كل 5 دقايق كحد أقصى.
// اقفله: WATCHDOG=0 npm start
if (process.env.WATCHDOG !== '0') {
  const WATCHDOG_INTERVAL_S = parseNumEnv('WATCHDOG_INTERVAL_S', 60, { min: 5, max: 3600 });
  const BOOT_AT = Date.now();
  const NEEDS_BOOT_MS = 5 * 60 * 1000;   // بعد التشغيل قبل ما يشتغل الحرس
  const COOLDOWN_MS = 5 * 60 * 1000;     // المسافة الدنيا بين ريستارتين من الحرس
  let lastWatchdogRestart = 0;
  setInterval(() => {
    try {
      if (Date.now() - BOOT_AT < NEEDS_BOOT_MS) return;
      if (typeof global.restartBot !== 'function') return;
      const rt = panelRuntime();
      if (rt.stopped) return;   // المستخدم وقف البوت عمدًا من اللوحة — مش هنعمل حاجة
      if (pairingActive()) return;   // في وسط عملية ربط حقيقية شغالة — هنسيبها تكمل
      if (client.isConnected?.()) return;
      if (Date.now() - lastWatchdogRestart < COOLDOWN_MS) return;
      // التصعيد (محاولتين متتاليتين من غير open ← خروج نظيف بكود 1) بقى
      // جوّه السلّم المشترك في system/restart-ladder.js — هنا بنطلب إعادة
      // تشغيل بس، والباقي (العدّاد والخروج) على السلّم.
      lastWatchdogRestart = Date.now();
      console.log('⏱️ [WATCHDOG] الاتصال مقطوع من فترة طويلة — ريستارت تلقائي');
      pushRuntimeEvent('watchdog', 'الاتصال مقطوع من فترة طويلة — إعادة تشغيل تلقائية');
      global.restartBot('watchdog');
    } catch (e) {
      console.error('⚠️ [WATCHDOG] خطأ في فحص الحرس:', e?.message || e);
    }
  }, WATCHDOG_INTERVAL_S * 1000);
}

/* =========== Memory Guard — حرس الذاكرة ========== */
// لو الذاكرة علت فوق الحد نعمل ريستارت داخل العملية قبل ما لوحة الاستضافة
// تقتل العملية بـ OOM (وده موت مفاجئ للبوت واللوحة مع بعض).
// الحد بالـ MB:  MEMORY_RESTART_MB=950 (افتراضي)  |  0 = مقفول
// القيمة بتتحقّق parseNumEnv: قيمة مش رقم بتحذّر بالعربي وبترجع 950
// (مش 0 — الرقم الغلط كان بيقفل حرس الذاكرة من غير ما حد يعلم).
const MEMORY_RESTART_MB = parseNumEnv('MEMORY_RESTART_MB', 950, { min: 0, max: 65536 });
if (MEMORY_RESTART_MB > 0) {
  setInterval(() => {
    try {
      const rss = process.memoryUsage().rss / 1024 / 1024;
      if (rss > MEMORY_RESTART_MB) {
        console.log(`🧠 [MEMORY] الذاكرة وصلت ${rss.toFixed(0)}MB (الحد ${MEMORY_RESTART_MB}MB) — ريستارت وقائي`);
        pushRuntimeEvent('memory', `الذاكرة وصلت ${rss.toFixed(0)}MB — إعادة تشغيل وقائية`);
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
      if (r.error) { console.log('⚠️ [UPDATE]', r.error); pushRuntimeEvent('update', 'فشل التحديث التلقائي: ' + r.error); return; }
      const parts = [];
      if (r.changes) parts.push('سحب ' + r.changes + ' ملف');
      if (r.skipped) parts.push('تخطّي ' + r.skipped);
      if (r.deleted && r.deleted.length) parts.push('حذف ' + r.deleted.length);
      if (r.needsInstall) parts.push('محتاج تثبيت حزم');
      pushRuntimeEvent('update', parts.length ? parts.join(' — ') : 'مفيش تحديثات جديدة');
      if (r.changes && r.needsRestart) {
        console.log('🔁 [UPDATE] فيه كود اتغيّر — ريستارت لتطبيق التحديث');
        pushRuntimeEvent('update', 'كود اتغيّر — إعادة تشغيل لتطبيق التحديث');
        setTimeout(() => restartBot('تحديث تلقائي من الريبو'), 1000);
      }
    } catch (e) {
      console.error('⚠️ [UPDATE] فشل التحديث التلقائي:', e.message);
      pushRuntimeEvent('update', 'فشل التحديث التلقائي: ' + e.message);
    }
  }, 8000);
} else {
  console.log('ℹ️ [UPDATE] التحديث التلقائي مقفول (AUTO_UPDATE=0)');
}

// المؤقّت: ريستارت دوري بيتكرر كل RESTART_INTERVAL_MIN دقيقة.
// كان setTimeout واحد → بيتنفّذ مرة واحدة بس في عمر العملية. دلوقتي جدولة
// بتتعاد بعد كل دورة (فبتفضل شغالة بعد كل ريستارت) وبتتخطّى
// لو البوت واقف من اللوحة أو فيه ريستارت شغّال، وبتروح كلها لنفس القفل
// الأحادي في system/restart-ladder.js (global.restartBot).
const periodicRestart = createPeriodicRestartScheduler({
  intervalMs: RESTART_MS,
  restart: (reason) => global.restartBot(reason),
  isStopped: () => {
    try { return !!panelRuntime().stopped; } catch { return false; }
  },
  isRestarting: () => !!restartController.isRestarting?.(),
  log: (...a) => console.log(...a),
  logError: (...a) => console.error(...a),
});
if (RESTART_INTERVAL_MIN > 0) {
  periodicRestart.start();
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
  pushRuntimeEvent('uncaught', 'استثناء غير متوقع: ' + String(msg).slice(0, 160));
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
  pushRuntimeEvent('rejection', 'رفض وعد غير معالَج: ' + String(err?.message || err).slice(0, 160));
});

/* =========== إشارات الإيقاف — حفظ الحالة قبل الخروج ========== */
// SIGTERM / SIGINT: نحفظ الداتابيز فورًا (flush)، نقفل سيرفر اللوحة،
// وبعدين نخرج من العملية بـ exit code 0 (مش 1 — الإيقاف ده طبيعي).
// ملاحظة: الإطار (meowsab) مسجّل معالج إشارات خاص بيه قبلنا — المعالجين
// بيشتغلوا مع بعض: احنا بنحفظ الداتابيز ونقفل اللوحة ونخرج بـ 0 فورًا.
installShutdownHandlers({ db: global.db, server: panelServer });


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
