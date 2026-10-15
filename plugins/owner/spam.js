const DEV_NUMBER = '218945778513'; // رقم المطور

const handler = async (m, { conn, text }) => {
  const senderNumber = m.sender.split('@')[0];

  // التحقق من المطور
  if (senderNumber !== DEV_NUMBER) {
    return m.reply('❌ هذا الأمر مخصص للمطور فقط');
  }

  try {
    const usage = `🐉 *الاستخدام الصحيح:*\n.سبام/الرقم/العدد الرسالة\n\n*مثال:*\n.سبام/218945778513/5 مرحبا`;

    if (!text) return m.reply(usage);

    // تقسيم النص
    const [cmdPart, ...msgArr] = text.split(' ');
    const parts = cmdPart.split('/');
    const message = msgArr.join(' ');

    if (parts.length !== 3 || !message) return m.reply(usage);

    const [, targetNumber, countStr] = parts;
    const total = parseInt(countStr);
    const cleanTarget = targetNumber.replace(/[^0-9]/g, '');
    const jid = cleanTarget + '@s.whatsapp.net';

    if (isNaN(total) || total < 1 || total > 200) {
      return m.reply('❌ عدد الرسائل يجب أن يكون بين 1 و 200');
    }

    // إرسال الرسائل
    const batchSize = 10;
    for (let i = 0; i < total; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j < total; j++) {
        batch.push(conn.sendMessage(jid, { text: message }));
      }
      await Promise.all(batch);
      await new Promise(res => setTimeout(res, 300)); // تأخير بسيط للحماية
    }

    m.reply(`✅ تم إرسال *${total}* رسالة إلى الرقم *${cleanTarget}*`);

  } catch (e) {
    console.error(e);
    m.reply('❌ حدث خطأ أثناء محاولة إرسال السبام');
  }
};

handler.help = ['سبام'];
handler.usage = ['سبام/الرقم/العدد الرسالة'];
handler.category = 'owner';
handler.command = ['سبام', 'spam'];
handler.rowner = true; // لضمان عمله للمطور فقط من خلال النظام أيضاً

export default handler;