import { getWarnings, addWarning, resetWarnings, WARNING_LIMIT } from '../../system/warnings.js';

const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس');
  let targetLid = m.mentionedJid?.[0] || m.quoted?.sender;
  let targetJid = await m.lid2jid(targetLid);

  if (!targetJid || !targetLid) return m.reply('⚠️ *يرجى منشن الشخص أو الرد على رسالته* ⚠️');

  const user = (await conn.groupMetadata(m.chat)).participants.find(
    p => p.id === targetLid || p.phoneNumber === targetJid
  );

  if (!user) return m.reply("*❌ المستخدم غير موجود في المجموعة*");

  const id = user.phoneNumber;
  const jid = targetLid;

  // العدّاد الموحّد: نفس المصدر اللي بيقرا منه anti-badword ومانع الحالات
  const warnCount = addWarning(m.chat, targetLid, { by: m.sender, reason: 'warn' });
  if (!warnCount) return m.reply('⚠️ *تعذر تسجيل الإنذار — معرّف الشات غير صالح*');

  await conn.sendMessage(m.chat, {
    text: `⚠️ تم إعطاء إنذار

👤: @${id.split("@")[0]}
📊 عدد الإنذارات: ${warnCount}`,
    mentions: [jid]
  }, { quoted: global.reply_status });
};

handler.before = async (m, { conn }) => {
  const user = m.sender;
  const count = getWarnings(m.chat, user);

  if (count < WARNING_LIMIT) return false;

  await conn.sendMessage(m.chat, {
    text: `*🚫 @${user.split("@")[0]} لقد خالفت القوانين والان سوف يتم طردك*`,
    mentions: [user]
  }, { quoted: global.reply_status });

  await conn.groupParticipantsUpdate(m.chat, [user], "remove");
  resetWarnings(m.chat, user);

  return false;
};

handler.command = ["انذار", "تحذير", "warn"];
handler.usage = ['انذار'];
handler.category = "admin";
handler.admin = true;
handler.group = true;
handler.botAdmin = false 

export default handler;