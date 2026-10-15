const handler = async (m, { conn }) => {
  if (!m.quoted) return m.reply('*يرجى الرد على صورة أو فيديو لتحويله إلى ملصق*');
  const mime = m.quoted.msg?.mimetype || '';
  if (!mime || !mime.includes('image')) return m.reply('⚠️ الرد يجب أن يكون على صورة');

  try {
    const sticker = await conn.convertToSticker(m.quoted, { contextInfo: { mentionedJid: [m.sender] } });
    await conn.sendMessage(m.chat, { sticker }, { quoted: m });
  } catch (e) {
    console.error(e);
    m.reply('❌ حدث خطأ أثناء تحويل الصورة إلى ملصق');
  }
};

handler.command = ['ملصق', 's'];
handler.usage = ['ملصق <رد على صورة>'];
handler.category = 'sticker';

export default handler;
