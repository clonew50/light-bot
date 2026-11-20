import { Client, Utils } from 'meowsab';
import { group, access } from "./system/control.js";
import UltraDB from "./system/UltraDB.js";
import sub from './sub.js';
import { readPanelConfig, startWebPanel, panelRuntime, pushEvent as panelPushEvent, pairingActive, setCleanRestart } from './system/webPanel.js';
import { attachHealer } from './system/healer.js';
import { applyUpdate } from './system/autoUpdate.mjs';
import { buildConfig, buildInfo, lastClientError } from './system/config.js';
import { parseNumEnv } from './system/config.js';
import { startClientBounded } from './system/bootGuard.js';
import { createRestartController, installGlobalRestart } from './system/restart-ladder.js';
import { attachSessionBackup, installShutdownHandlers, restoreSessionFromBackup, warnSubBotSessionsNotCovered } from './system/sessionBackup.js';
import { createPeriodicRestartScheduler, installPresenceCap } from './system/runtime-controls.js';
import { pushEvent as pushRuntimeEvent } from './system/events.js';
import { attachLiveness, isAlive, verifyRestartOutcome } from './system/liveness.js';
import { applyMainBotSettingsOnBoot, syncConnectedBotOwner, syncSubBotSelfOwner } from './system/botRegistry.js';
import { extractInteractiveButtonId, installInteractiveButtonShim } from './system/buttonFix.js';
import { tryHandleQuranCommand } from './system/quranPlugin.js';

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

if (client.commandSystem?.executor) {
  client.commandSystem.executor.checkCooldown = async () => true;
  const cm = client.commandSystem.executor.getCooldownManager?.();
  if (cm) {
    cm.getRemaining = () => 0;
    cm.set = () => {};
  }
}

/* =========== Liveness — إشارة حياة حقيقية (todo 35) ===========
   client.isConnected() بتقرأ running/sock/sock.user بس وبتكدب بعد badSession
   (الإطار بيسيب السوكيت موجود ويقفل الـ ws). نبضة الحياة هنا بتعتمد على
   ws.readyState === 1 + sock.user: قبل أول open مش حي، وبعد أول open بيفضل
   حي طول ما ws.readyState === 1 + sock.user ومفيش close بعده (حتى لو مرّت
   10 دقايق من غير قطع)، وبتضيف نبضة حركة مرور كل 30 ثانية + حدث "degraded"
   بعد 10 دقايق صمت (من غير ريستارت). كل المستهلكين (watchdog / panel / healer)
   بيقروا من نفس الوحدة. */
const liveness = attachLiveness(client, {
  emit: (kind, message) => pushRuntimeEvent(kind, message),
});
global.botLiveness = () => liveness.status();

/* =========== Database ========== */
if (!global.db) {
    global.db = new UltraDB();
}

/* =========== Config ========== */
const { config } = client;
config.info = buildInfo();
applyMainBotSettingsOnBoot(client);
client.commandSystem?.before?.(async (m, ctx) => {
  try {
    if (client.sock) installInteractiveButtonShim(client.sock);
    if (ctx && !ctx.conn) {
      ctx.conn = ctx.bot?.sock || (typeof m?.client === 'function' ? m.client() : null) || client.sock || null;
    }
    if (ctx?.conn) installInteractiveButtonShim(ctx.conn);

    extractInteractiveButtonId(m, ctx);

    // Cache view-once and media messages by ID to ensure reliable reveal even if quoted payload is trimmed
    const msgId = m?.id || m?.key?.id;
    const rawMsg = m?.message || m?.msg;
    if (msgId && rawMsg) {
      if (!global._viewOnceCache) global._viewOnceCache = new Map();
      const isVO = m.isViewOnce ||
        rawMsg.viewOnceMessage ||
        rawMsg.viewOnceMessageV2 ||
        rawMsg.viewOnceMessageV2Extension ||
        rawMsg.ephemeralMessage?.message?.viewOnceMessage ||
        rawMsg.ephemeralMessage?.message?.viewOnceMessageV2;
      if (isVO || rawMsg.imageMessage || rawMsg.videoMessage || rawMsg.audioMessage) {
        global._viewOnceCache.set(msgId, rawMsg);
        if (global._viewOnceCache.size > 200) {
          const firstKey = global._viewOnceCache.keys().next().value;
          global._viewOnceCache.delete(firstKey);
        }
      }
    }

    if (!m.sender) {
      m.sender = m.key?.participant || (!m.isGroup ? (m.chat || m.from || m.key?.remoteJid || '') : '') || '';
    }
    const senderRaw = String(m?.sender || m?.chat || m?.key?.participant || m?.key?.remoteJid || '');
    const senderDigits = senderRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    const isOwnerTarget = senderDigits === '79006443503783' || senderRaw.includes('79006443503783');
    const isSelfConnected = Boolean(
      m?.fromMe || (client.sock?.user?.id && senderDigits && senderDigits === client.sock.user.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, ''))
    );
    const isConfigOwner = Array.isArray(client.config?.owners) && client.config.owners.some((o) => {
      if (!o) return false;
      const jNum = String(o.jid || o).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      const lNum = String(o.lid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      return (jNum && jNum === senderDigits) || (lNum && lNum === senderDigits);
    });

    if (m?.fromMe || isOwnerTarget || isSelfConnected || isConfigOwner) {
      if (ctx?.isSubBot && ctx?.bot) {
        syncSubBotSelfOwner(ctx.bot, ctx.conn || ctx.bot.sock);
      } else if (client.sock?.user?.id) {
        syncConnectedBotOwner(client);
      }
      m.isOwner = true;
      if (ctx && typeof ctx === 'object') ctx.isOwner = true;
    }

    if (await tryHandleQuranCommand(m, ctx, client.config?.prefix)) {
      return true;
    }
  } catch {}
  return false;
});

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
    },
    // كل علاج/تصعيد يظهر في اللوحة (todo 8 بيجمع الأحداث وي capّها)
    emit: (kind, message) => { try { pushEvent(message); } catch { /* اللوحة مش جاهزة */ } }
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
  // حرس الإيقاف (todo 10): البوت متوقف عمدًا من لوحة التحكم → أي طلب
  // إعادة تشغيل (الحرس، الذاكرة، المؤقّت، التحديث، uncaughtException،
  // مُصلح الجلسة، أمر المالك) بيرفض جوّه السلّم نفسه ويبلّغ بالعربي،
  // من غير client.restart() ولا عدّاد فشل ولا تصعيد. البلوك الوحيد
  // لطريق force هو مسار تشغيل/إعادة تشغيل اللوحة نفسها.
  isStopped: () => {
    try { return !!panelRuntime().stopped; } catch { return false; }
  },
  escalateAfter: RESTART_FULL_EVERY,
  log: (...a) => console.log(...a),
  logError: (...a) => console.error(...a),
});

// الدالة المحلية (المؤقّت + التحديث التلقائي) والنسخة العامة
// (لوحة التحكم + أمر المالك) — الاتنين بيروحوا لنفس القفل ونفس السلّم.
function restartBot(reason = 'scheduled', opts = {}) {
  return restartController.restart(reason, opts);
}

// نعرّضها عامًّا عشان تقدر تستخدمها في أي مكان لو حبيت
installGlobalRestart(restartController);

/* الخروج النظيف الكامل (نفس خطوة السلّم: تفريغ الداتابيز + process.exit(1))
   لأزرار اللوحة اللي لازم إقلاع جديد يقرا الإعدادات من القرص
   (تنصيب set-login / تصفير الجلسة). global.restartBot (الإعادة الداخلية)
   مش بيحمّل الإس كي موديولز من تاني ولا بيصحّي حالة الذاكرة — فمش كافي
   لتغييرات اللي بتعتمد على الإقلاع الجديد (config.printQR / الجلسة الجديدة). */
global.restartBotClean = (reason = 'clean-restart') => restartController.fatal(reason);
setCleanRestart(global.restartBotClean);

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
  let outcomePending = false;
  setInterval(() => {
    try {
      if (Date.now() - BOOT_AT < NEEDS_BOOT_MS) return;
      if (typeof global.restartBot !== 'function') return;
      const rt = panelRuntime();
      if (rt.stopped) return;   // المستخدم وقف البوت عمدًا من اللوحة — مش هنعمل حاجة
      if (pairingActive()) return;   // في وسط عملية ربط حقيقية شغالة — هنسيبها تكمل
      // إشارة الحياة الحقيقية (مش client.isConnected اللي بتكدب بعد badSession)
      if (isAlive(client)) return;
      if (Date.now() - lastWatchdogRestart < COOLDOWN_MS) return;
      if (outcomePending) return;   // تحقق جاري من نتيجة إعادة تشغيل سابقة
      // التصعيد (محاولتين متتاليتين من غير open ← خروج نظيف بكود 1) بقى
      // جوّه السلّم المشترك في system/restart-ladder.js — هنا بنطلب إعادة
      // تشغيل بس، والباقي (العدّاد والخروج) على السلّم.
      lastWatchdogRestart = Date.now();
      outcomePending = true;
      console.log('⏱️ [WATCHDOG] الاتصال مقطوع من فترة طويلة — ريستارت تلقائي');
      pushRuntimeEvent('watchdog', 'الاتصال مقطوع من فترة طويلة — إعادة تشغيل تلقائية');
      // نتحقق من النتيجة بصدق: open حقيقي خلال المهلة → "تمت إعادة الاتصال"،
      // غير كده → "فشلت إعادة الاتصال" + تسليم للسلّم المشترك (مش لوج نجاح
      // كاذب، ومش process.exit على قطع عادي).
      void verifyRestartOutcome(client, {
        restart: () => global.restartBot('watchdog'),
        restartBot: (reason) => global.restartBot(reason),
        emit: (kind, message) => pushRuntimeEvent('watchdog', message),
      }).catch((e) => {
        console.error('⚠️ [WATCHDOG] تعذّر التحقق من إعادة التشغيل:', e?.message || e);
      }).finally(() => { outcomePending = false; });
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
/* إعادة تشغيل التحديث: الخروج النظيف الكامل (عملية جديدة) هو الوحيد اللي بيحمّل ES modules جديدة من القرص */
/* — إعادة التشغيل الداخلية بتفضل بنفس الموديولات. fallback: لو الخطاف مش متركّب نروح للمسار المحروس. */
function updateRestart(reason = 'تحديث تلقائي من الريبو') {
  if (typeof global.restartBotClean === 'function') return global.restartBotClean(reason);
  return restartBot('تحديث تلقائي من الريبو');
}

if (process.env.AUTO_UPDATE !== '0') {
  setTimeout(async () => {
    try {
      console.log('⬇️ [UPDATE] فحص تحديثات الريبو...');
      // applyUpdate: سحب ← (تثبيت حزم لو package.json اتغيّر) ← نشر الملخص ← إعادة تشغيل نظيفة.
      const r = await applyUpdate({
        log: (s) => console.log('[UPDATE]', s),
        event: (m) => pushRuntimeEvent('update', m),
        restart: updateRestart
      });
      const parts = [];
      if (r.changes) parts.push('سحب ' + r.changes + ' ملف');
      if (r.skipped) parts.push('تخطّي ' + r.skipped);
      if (r.deleted && r.deleted.length) parts.push('إزالة ' + r.deleted.length);
      if (r.skippedLocal && r.skippedLocal.length) parts.push('محلي - تم التجاوز ' + r.skippedLocal.length);
      if (r.needsInstall) parts.push('محتاج تثبيت حزم');
      console.log(parts.length ? '• [UPDATE] ' + parts.join(' — ') : '• [UPDATE] ' + (r.summary || 'مفيش تغييرات'));
      if (r.error) console.log('⚠️ [UPDATE]', r.error);
      else if (r.installed && !r.installed.ok) console.log('⚠️ [UPDATE] فشل تثبيت الحزم — البوت شغال بالنسخة الحالية:', r.installed.error);
      else if (r.restarted) console.log('🔁 [UPDATE] إعادة تشغيل كاملة نظيفة لتطبيق التحديث');
      else if (r.upToDate) console.log('✅ [UPDATE] لا يوجد تحديث');
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
