import { uploadMediaBuffer } from '../../system/mediaService.js';

const handler = async (m, { conn }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || '';

  if (!mime) return m.reply('*رد على الصورة أو الفيديو أو الصوت لتحويله لرابط 🔗*');

  try {
    const media = await q.download();
    if (!media || !Buffer.isBuffer(media)) {
      return m.reply('❌ تعذر تحميل الوسائط');
    }

    const link = await uploadMediaBuffer(media);
    const caption = '🗃️ *تم رفع الملف بنجاح*\n- ```' + link + '```';

    if (mime.includes('image')) {
      await conn.sendButtonNormal(m.chat, {
        media: { url: link },
        mediaType: 'image',
        caption,
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
        buttons: [{ name: 'cta_copy', params: { display_text: 'نسخ الرابط 📋', copy_code: link } }],
        mentions: [m.sender]
      }, m);
    } else if (mime.includes('video')) {
      await conn.sendButtonNormal(m.chat, {
        media: { url: link },
        mediaType: 'video',
        caption,
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
        buttons: [{ name: 'cta_copy', params: { display_text: 'نسخ الرابط 📋', copy_code: link } }],
        mentions: [m.sender]
      }, m);
    } else {
      await conn.sendMessage(m.chat, {
        text: caption,
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
        buttons: [{ name: 'cta_copy', params: { display_text: 'نسخ الرابط 📋', copy_code: link } }],
        mentions: [m.sender]
      }, { quoted: m });
    }
  } catch (error) {
    console.error('image2url:', error?.message || error);
    m.reply('❌ حدث خطأ أثناء الرفع');
  }
};

handler.usage = ['لرابط'];
handler.category = 'tools';
handler.command = ['لرابط', 'image2url'];

export default handler;
