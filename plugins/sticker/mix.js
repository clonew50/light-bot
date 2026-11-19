import { Sticker } from 'wa-sticker-formatter';
import { createEmojiMixPng } from '../../system/mediaService.js';

const run = async (m, { conn, text, command }) => {
  const parts = String(text || '').split('+').map((s) => s.trim()).filter(Boolean);
  const [emo1, emo2] = parts;

  if (!(emo1 && emo2)) {
    return m.reply(`*⚠️ طـريـقـة الاسـتـخـدام:*\n- أرسل الأمر متبوعاً بإيموجيين بينهما علامة (+)\n\n*مثال:*\n\`.${command} 🗿+🔥\``);
  }

  try {
    await m.react?.('⏳');
    const pngBuffer = await createEmojiMixPng(emo1, emo2);
    const stiker = await new Sticker(pngBuffer, {
      type: 'full',
      categories: [emo1, emo2],
      pack: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
      author: '𝑬𝑴𝑶𝑱𝑰 𝑴𝑰𝑿'
    }).toMessage();

    await conn.sendMessage(m.chat, stiker, { quoted: m });
    await m.react?.('✅');
  } catch (error) {
    await m.react?.('❌');
    await m.reply(`❌ *تعذر دمج الإيموجيات:* ${error?.message || 'جرب إيموجيات أخرى'}`);
  }
};

run.command = ['مكس', 'ملصق-ايموجي', 'emojimix'];
run.usage = ['مكس <ايموجي+ايموجي>'];
run.category = 'sticker';
run.limit = true;

export default run;
