import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { uploadToQuax } from '../../system/utils.js';

const handler = async (m, { conn, command }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || '';

  if (!mime) return m.reply('*رد علي الصوره او الفيديو أو الصوت🔗 لتحويله لرابط*');

  try {
    const media = await q.download();
    const link = await uploadToQuax(media);

    await conn.sendButtonNormal(m.chat, {
      media: { url: link },
      mediaType: 'image',
      caption: '🗃️ نجح رفع الصورة على *(catbox.moe)*\n- ```' + link + '```',
      footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
      buttons: [
        { name: 'cta_copy', params: { display_text: 'Copy Link', copy_code: link } },
      ],
      mentions: [m.sender]
    }, m);
  } catch (error) {
    console.error('image2url:', error?.message || error);
    m.reply('❌ حدث خطأ أثناء الرفع');
  }
};

handler.usage = ['لرابط'];
handler.category = 'tools';
handler.command = ['لرابط', 'image2url'];

export default handler;
