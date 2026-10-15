const handler = async (m, { conn, text, args }) => {
  // فقط في المجموعات
  if (!m.isGroup) return m.reply('هذا الأمر يعمل فقط في المجموعات');

  // الهدف: المرسل افتراضيًا
  let target = m.sender;

  // إذا تم ذكر مستخدم أو كتابة رقم، نستخدمه
  if (args[0]) {
    const mention = m.mentionedJid[0];
    if (mention) target = mention;
    else {
      // إزالة كل ما عدا الأرقام ثم إضافة @s.whatsapp.net
      const v = args[0].replace(/[^0-9]/g, '');
      if (v) target = v + '@s.whatsapp.net';
    }
  }

  // عدد عشوائي من 1 إلى 100
  const egg = Math.floor(Math.random() * 100) + 1;

  // إرسال النتيجة مع mention
  await conn.sendMessage(m.chat, {
    text: `@${target.split('@')[0]} وجد بيضة عددها ${egg}!`,
    mentions: [target]
  });
};

handler.command = ['بيبيضني'];
handler.usage = ['بيبيضني [@user أو رقم]'];
handler.category = 'games';
export default handler;