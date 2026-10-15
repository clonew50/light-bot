import { SubBots } from "meowsab";

// خريطة لتخزين حالة الوضع لكل بوت فرعي (المفتاح هو uid أو رقم البوت)
const subBotModes = new Map();

async function sub(client) {
  global.subBots = new SubBots(client.commandSystem)
  
  SubBots.pariCode("LIGHTBOT") // Pairing
 
  const { config } = client;

  await global.subBots.setConfig({
    commandsPath: config.commandsPath || './plugins',
    owners: config.owners,
    prefix: config.prefix,
    info: config.info,
    printQR: false
  });

  global.subBots.on('error', (uid, error) => {
    console.error(`❌ [SubBot ${uid}] Error:`, error?.message || error);
  });

  const loadedCount = await global.subBots.load();
  console.log(`✅ Loaded ${loadedCount} saved bots`);

  global.subBots.on('ready', async (uid, sock) => {
    console.log(`✅ [SubBot ${uid}] Connected!`);
  });

  global.subBots.on('pair', (uid, code) => {
    console.log(`🔐 [SubBot ${uid}] Pairing code: ${code}`);
  });

  global.subBots.on('message', async (uid, msg) => {
    if (msg.key.id.includes("3EB0")) return;

    const body = getMessageText(msg);
    const bot = global.subBots.get(uid);
    const sock = bot?.sock;

    if (!sock || !body) return;

    // استخراج رقم البوت الفرعي وصاحب الرسالة
    const botNumber = uid.replace(/[^0-9]/g, '');
    const senderNumber = msg.key.remoteJid.includes('@s.whatsapp.net') 
      ? msg.key.remoteJid.split('@')[0] 
      : (msg.key.participant ? msg.key.participant.split('@')[0] : '');

    // تهيئة الوضع الافتراضي (عام = false) إذا لم يتم تحديده مسبقاً
    if (!subBotModes.has(uid)) {
      subBotModes.set(uid, false); // false يعني عام، true يعني خاص
    }

    const isPrivate = subBotModes.get(uid);

    try {
      // التعامل مع أمر التحويل إلى وضع الخاص أو العام (مسموح فقط لمالك الرقم الفرعي)
      if (senderNumber === botNumber) {
        if (body === ".خاص") {
          subBotModes.set(uid, true);
          await sock.sendMessage(msg.key.remoteJid, { text: "🔒 تم تفعيل وضع (الخاص). البوت سيرد عليك وحدك الآن." }, { quoted: msg });
          return;
        }
        if (body === ".عام") {
          subBotModes.set(uid, false);
          await sock.sendMessage(msg.key.remoteJid, { text: "🌐 تم تفعيل وضع (العام). البوت سيستجيب للجميع الآن." }, { quoted: msg });
          return;
        }
      }

      // إذا كان البوت في وضع الخاص، يمنع الرد على أي شخص غير صاحب الرقم الفرعي نفسه
      if (isPrivate && senderNumber !== botNumber) {
        return; 
      }

      // الأوامر العادية للبوت الفرعي
      if (body === "بوتات") {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: "✅", key: msg.key }
        });
      }

    } catch (error) {
      console.error(`❌ [SubBot ${uid}] Send error:`, error?.message || error);
    }
  });

  global.subBots.on('close', (uid) => {
    console.log(`🔌 [SubBot ${uid}] Disconnected`);
  });

  global.subBots.on('badSession', (uid) => {
    console.log(`⚠️ [SubBot ${uid}] Bad session, removed`);
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
