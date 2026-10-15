const handler = async (m, { conn }) => {
  if (!m.quoted) return m.reply('*الرجاء الرد على الرسالة التي تريد حذفها 📩*');
  try {
    await conn.sendMessage(m.chat, { delete: m.quoted.key });
    await m.reply('✅ تم حذف الرسالة بنجاح');
  } catch (e) {
    console.error(e);
    m.reply('❌ فشل حذف الرسالة');
  }
};

handler.command = ['حذف'];
handler.usage = ['حذف'];
handler.category = 'admin';
handler.admin = true;

export default handler;
