const handler = async (m, { conn }) => {
  // Sticker handler - convert image to sticker
  if (!m.quoted) return m.reply('⚠️ رد على صورة أو فيديو');
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

handler.command = ['ستيكر', 'sticker'];
handler.usage = ['ستيكر <رد على صورة>'];
handler.category = 'sticker';

export default handler;
