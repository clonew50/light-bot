import axios from 'axios';
import FormData from 'form-data';

let handler = async (m, { conn }) => {
  try {
    if (!m.quoted) return m.reply("*ابعت الصوره الي و رد عليها الي عاوز انسخ منها الكلام (⁠ ⁠╹⁠▽⁠ ⁠)*");

    const buffer = await m.quoted.download();
    const form = new FormData();
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    form.append('language', 'ara');
    form.append('isOverlayRequired', 'false');

    const res = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: { ...form.getHeaders(), apikey: 'helloworld' },
      timeout: 30000
    });

    const parsed = res.data?.ParsedResults?.[0]?.ParsedText;
    if (!parsed) {
      const err = res.data?.ErrorMessage || 'تعذر استخراج النص';
      return await conn.sendMessage(m.chat, { text: `❌ ${err}` }, { quoted: m });
    }

    await conn.sendMessage(m.chat, { text: parsed }, { quoted: m });
  } catch (error) {
    await conn.sendMessage(m.chat, { text: `Err: ${error.message}` }, { quoted: m });
  }
};

handler.usage = ["نسخ"];
handler.command = ["نسخ", "ocr"];
handler.category = "tools";

export default handler;