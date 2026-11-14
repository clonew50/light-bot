import { getWarnings, removeWarning } from '../../system/warnings.js';

const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس');
  let targetLid = m.mentionedJid?.[0] || m.quoted?.sender;
  let targetJid = m.lid2jid(targetLid);

  if (!targetJid || !targetLid) return m.reply('⚠️ *يرجى منشن الشخص أو الرد على رسالته* ⚠️');

  const user = (await conn.groupMetadata(m.chat)).participants.find(
    p => p.id === targetLid || p.phoneNumber === targetJid
  );

  if (!user) return m.reply("*❌ المستخدم غير موجود في المجموعة*");

  const id = user.phoneNumber;
  const jid = targetLid;
  const currentWarn = getWarnings(m.chat, targetLid);

  if (currentWarn === 0) {
    return await conn.sendMessage(m.chat, {
      text: `*ℹ️ @${id.split("@")[0]} ليس لديه أي إنذارات لحذفها.*`,
      mentions: [jid]
    }, { quoted: m });
  }

  const newWarn = removeWarning(m.chat, targetLid);

  await conn.sendMessage(m.chat, {
    text: `✅ *تم حذف إنذار واحد*

👤: @${id.split("@")[0]}
📊 عدد الإنذارات المتبقي: ${newWarn}`,
    mentions: [jid]
  }, { quoted: m });
};

handler.command = ["حذف_انذار", "حذف_الانذار"];
handler.usage = ['حذف_انذار @مستخدم', 'حذف_الانذار @مستخدم'];
handler.category = "admin";
handler.admin = true;
handler.group = true;
handler.botAdmin = false;

export default handler;