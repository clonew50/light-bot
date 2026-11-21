import { createSticker } from '../../system/utils.js';
import { downloadViewOnceMediaBuffer } from '../../system/mediaService.js';

const handler = async (m, { conn }) => {
  try {
    // استخراج الميديا robust: بيدور في m.quoted أو في contextInfo.quotedMessage
    // أو في كاش العرض-لمرة-واحدة — فبيشتغل حتى لو m.quoted مش متعرّف.
    const res = await downloadViewOnceMediaBuffer(m, conn);
    if (!res.ok || !res.buffer) {
      return m.reply('⚠️ رد على صورة (أو فيديو) لتحويلها إلى ملصق أولًا.');
    }

    const isImage = res.type === 'image' || /image/i.test(String(res.mimetype || ''));
    if (!isImage) {
      return m.reply('⚠️ الرد يجب أن يكون على صورة (مش فيديو).');
    }

    const sticker = await createSticker(res.buffer, {
      pack: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
      author: 'LIGHT BOT'
    });
    await conn.sendMessage(m.chat, { sticker }, { quoted: m });
  } catch (e) {
    console.error('ملصق:', e?.message || e);
    m.reply('❌ حدث خطأ أثناء تحويل الصورة إلى ملصق');
  }
};

handler.command = ['ملصق', 's'];
handler.usage = ['ملصق <رد على صورة>'];
handler.category = 'sticker';

export default handler;