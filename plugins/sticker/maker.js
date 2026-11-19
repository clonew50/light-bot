import sharp from 'sharp';
import { Sticker } from 'wa-sticker-formatter';

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const handler = async (m, { conn, text, usedPrefix = '.', command = 'ستيكر-نص' }) => {
  const raw = String(text || m.quoted?.text || m.quoted?.msg?.conversation || '').trim();
  if (!raw) {
    return m.reply(`✍️ *اكتب النص أو رد على رسالة لتحويلها إلى ملصق:*\n\`${usedPrefix}${command} سبحان الله\``);
  }

  try {
    await m.react?.('⏳');
    const clean = raw.slice(0, 120);
    const words = clean.split(/\s+/);
    const lines = [];
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > 16) {
        if (current) lines.push(current.trim());
        current = w;
      } else {
        current = (current + ' ' + w).trim();
      }
    }
    if (current) lines.push(current.trim());

    const displayLines = lines.slice(0, 6);
    const fontSize = displayLines.length <= 2 ? 64 : displayLines.length <= 4 ? 48 : 38;
    const lineHeight = fontSize * 1.3;
    const startY = 256 - ((displayLines.length - 1) * lineHeight) / 2;

    const tspans = displayLines
      .map((ln, idx) => `<text x="256" y="${Math.round(startY + idx * lineHeight)}" text-anchor="middle" dominant-baseline="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="#111827">${xmlEscape(ln)}</text>`)
      .join('');

    const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="64" fill="#ffffff"/>
      <rect x="16" y="16" width="480" height="480" rx="52" fill="#f8fafc" stroke="#0f172a" stroke-width="8"/>
      ${tspans}
    </svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const sticker = await new Sticker(png, {
      pack: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
      author: 'TEXT STICKER',
      type: 'full',
      quality: 90
    }).toMessage();

    await conn.sendMessage(m.chat, sticker, { quoted: m });
    await m.react?.('✅');
  } catch (e) {
    console.error('maker:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل تحويل النص إلى ملصق');
  }
};

handler.command = ['ستيكر-نص', 'brat', 'stickertext'];
handler.usage = ['ستيكر-نص <نص>', 'brat <نص>'];
handler.category = 'sticker';
export default handler;
