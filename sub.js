import { SubBots } from "meowsab";
import { pushEvent } from "./system/events.js";
import {
  registerBotRegistryHooks,
  getSubBotSettings,
  setSubBotModeByUidOrPhone,
  recordSubPairEvent,
  recordSubReadyEvent,
  recordSubStatusEvent,
  syncSubBotSelfOwner
} from "./system/botRegistry.js";

// خريطة لتخزين حالة الوضع لكل بوت فرعي (المفتاح هو uid أو رقم البوت)
const subBotModes = new Map();

// ─── كود اقتران عشوائي (todo 31a) ───
// "LIGHTBOT" كان كود ثابت معروف — أي حد يقدر يربط بوت على رقم الضحية.
// بنولّد كود عشوائي لكل دور اقتران، بنخزّنه في الداتابيز (المطور بيشوفه
// من اللوحة)، وبنبطّله بعد أول اقتران ناجح عشان ما يتستخدمش تاني.
const PAIR_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // من غير حروف ملتبسة
const PAIR_CODE_LEN = 8;

const generatePairCode = () => {
  let code = "";
  for (let i = 0; i < PAIR_CODE_LEN; i++) {
    code += PAIR_CODE_CHARS[Math.floor(Math.random() * PAIR_CODE_CHARS.length)];
  }
  return code;
};

const persistPairCode = (code, meta = {}) => {
  try {
    global.db.subPairing = { code, createdAt: Date.now(), used: false, ...meta };
  } catch (e) {
    console.error("⚠️ [SUB] تعذّر حفظ كود الاقتران في الداتابيز:", e?.message || e);
  }
};

async function sub(client) {
  global.subBots = new SubBots(client.commandSystem)

  // كود البداية: عشوائي ومخزّن — الإطار بيرجّع لـ "VENI1234" من غيره
  const bootCode = generatePairCode();
  SubBots.pariCode(bootCode) // Pairing
  persistPairCode(bootCode, { note: "كود بدء التشغيل" })
 
  const { config } = client;

  await global.subBots.setConfig({
    commandsPath: config.commandsPath || './plugins',
    owners: config.owners,
    prefix: config.prefix,
    fromMe: null,
    info: config.info,
    printQR: false
  });

  registerBotRegistryHooks({
    onSubSettingsChange: (uid, _phone, settings) => {
      if (uid && settings) {
        subBotModes.set(uid, settings.mode === 'private');
      }
    }
  });

  global.subBots.on('error', (uid, error) => {
    console.error(`❌ [SubBot ${uid}] Error:`, error?.message || error);
    try { recordSubStatusEvent(uid, 'error', error?.message || String(error), global.subBots); } catch {}
  });

  const loadedCount = await global.subBots.load();
  console.log(`✅ Loaded ${loadedCount} saved bots`);

  global.subBots.on('ready', async (uid, sock) => {
    console.log(`✅ [SubBot ${uid}] Connected!`);
    try { syncSubBotSelfOwner(global.subBots.get(uid), sock); } catch {}
    try { recordSubReadyEvent(uid, sock, global.subBots); } catch {}
  });

  global.subBots.on('pair', (uid, code) => {
    console.log(`🔐 [SubBot ${uid}] Pairing code: ${code}`);
    try { recordSubPairEvent(uid, code, global.subBots); } catch {}
    // (todo 31a) الاقتران نجح → الكود اتسهلك: نبطّله ونولّد كود جديد
    // للاقترانات الجاية — الكود المخزّن مبقاش صالح للاستخدام.
    try {
      const rec = global.db.subPairing || {};
      if (rec.code && code === rec.code && rec.used !== true) {
        rec.used = true;
        rec.usedAt = Date.now();
        rec.usedBy = uid;
      }
      const fresh = generatePairCode();
      SubBots.pariCode(fresh);
      persistPairCode(fresh, { note: "كود جديد بعد اقتران ناجح" });
      pushEvent('sub', `🔐 اقتران ناجح للبوت الفرعي ${uid} — تم تجديد كود الاقتران`);
    } catch (e) {
      console.error("⚠️ [SUB] تجديد كود الاقتران بعد الاقتران فشل:", e?.message || e);
    }
  });

  global.subBots.on('message', async (uid, msg) => {
    // (todo 31b) رسايل ناقصة العنوان كانت ترمي TypeError وبتوقف المعالج
    const keyId = msg?.key?.id;
    const remoteJid = msg?.key?.remoteJid;
    if (!keyId || !remoteJid) return;
    if (keyId.includes("3EB0")) return;

    const body = getMessageText(msg);
    const bot = global.subBots.get(uid);
    const sock = bot?.sock;

    if (!sock || !body) return;

    // استخراج رقم البوت الفرعي وصاحب الرسالة
    const botNumber = uid.replace(/[^0-9]/g, '');
    // (todo 31d) الرقم لازم رقم حقيقي بـ 8 لـ 15 رقم — أي شكل تاني
    // بنرفض الرسالة بهدوء بديل ما نحسب أرقام وهمية.
    if (!/^\+?\d{8,15}$/.test(botNumber)) {
      console.warn(`⚠️ [SubBot ${uid}] رقم البوت الفرعي مش صحيح (${botNumber}) — تم تجاهل الرسالة`);
      return;
    }
    const senderNumber = msg.key?.fromMe
      ? botNumber
      : (remoteJid.includes('@s.whatsapp.net')
        ? remoteJid.split('@')[0]
        : (msg.key.participant ? msg.key.participant.split('@')[0] : ''));

    const botSettings = getSubBotSettings(botNumber, global.subBots);

    // تهيئة الوضع الافتراضي من الإعدادات المحفوظة (عام = false)
    if (!subBotModes.has(uid)) {
      subBotModes.set(uid, botSettings.mode === 'private'); // false يعني عام، true يعني خاص
    }

    const isPrivate = subBotModes.get(uid);

    try {
      // التعامل مع أمر التحويل إلى وضع الخاص أو العام (مسموح فقط لمالك الرقم الفرعي)
      if (senderNumber === botNumber) {
        if (body === ".خاص") {
          subBotModes.set(uid, true);
          setSubBotModeByUidOrPhone(uid, true, global.subBots);
          await sock.sendMessage(remoteJid, { text: "🔒 تم تفعيل وضع (الخاص). البوت سيرد عليك وحدك الآن." }, { quoted: msg });
          return;
        }
        if (body === ".عام") {
          subBotModes.set(uid, false);
          setSubBotModeByUidOrPhone(uid, false, global.subBots);
          await sock.sendMessage(remoteJid, { text: "🌐 تم تفعيل وضع (العام). البوت سيستجيب للجميع الآن." }, { quoted: msg });
          return;
        }
      }

      if (botSettings.paused && senderNumber !== botNumber) {
        return;
      }

      // إذا كان البوت في وضع الخاص، يمنع الرد على أي شخص غير صاحب الرقم الفرعي نفسه
      if (isPrivate && senderNumber !== botNumber) {
        return; 
      }

      // الأوامر العادية للبوت الفرعي
      if (body === "بوتات") {
        await sock.sendMessage(remoteJid, {
          react: { text: "✅", key: msg.key }
        });
      }

    } catch (error) {
      console.error(`❌ [SubBot ${uid}] Send error:`, error?.message || error);
    }
  });

  global.subBots.on('close', (uid) => {
    console.log(`🔌 [SubBot ${uid}] Disconnected`);
    try { recordSubStatusEvent(uid, 'disconnected', null, global.subBots); } catch {}
  });

  global.subBots.on('badSession', (uid) => {
    console.log(`⚠️ [SubBot ${uid}] Bad session, removing record`);
    // (todo 31c) كان بس بيكتب "removed" ومش بيمسح حاجة — دلوقتي
    // بنمسح سجل البوت الفرعي فعليًا وبنبعت حدث للوحة.
    try {
      let removed = false;
      if (typeof global.subBots.remove === 'function') {
        try { global.subBots.remove(uid); removed = true; } catch (e) { removed = false; }
      }
      if (!removed && typeof global.subBots.removeByphone === 'function') {
        try { global.subBots.removeByphone(uid.replace(/[^0-9]/g, '')); removed = true; } catch (e) { removed = false; }
      }
      pushEvent('sub', `⚠️ البوات الفرعي ${uid} جلسته سيئة — ${removed ? 'تم حذف سجله' : 'تعطّر حذف السجل (شوف اللوج)'}`);
    } catch (e) {
      console.error("⚠️ [SUB] حذف البوات الفرعي بعد الجلسة السيئة فشل:", e?.message || e);
      pushEvent('sub', `⚠️ تعطّر حذف البوات الفرعي ${uid} بعد الجلسة السيئة: ${e?.message || e}`);
    }
  });

  return global.subBots;
}

function getMessageText(msg) {
  if (!msg.message) return null;
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
  return msg.body || null;
}

export default sub;
