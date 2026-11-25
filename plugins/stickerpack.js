import axios from 'axios';

async function searchPack(query) {
  try {
    const res = await axios.post(
      "https://getstickerpack.com/api/v1/stickerdb/search",
      { query: query, page: 1, size: 20 },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json',
          'Referer': 'https://getstickerpack.com/',
          'Origin': 'https://getstickerpack.com'
        },
        timeout: 15000
      }
    );
    if (res.data && res.data.data) return res.data.data;
    return [];
  } catch (e) {
    console.log("[STICKERPACK] Search error:", e.response?.data || e.message);
    return [];
  }
}

async function getDetail(slug) {
  try {
    const id = slug.includes('/') ? slug.split('/').pop() : slug;
    const res = await axios.get(
      `https://getstickerpack.com/api/v1/stickerdb/stickers/${id}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://getstickerpack.com/'
        }
      }
    );
    let data = res.data.data;
    return {
      title: data.title,
      stickers: data.images.map(i => `https://s3.getstickerpack.com/${i.url}`)
    };
  } catch (e) {
    console.log("[STICKERPACK] Detail error:", e.message);
    return null;
  }
}

let handler = async (m, { conn, args, usedPrefix }) => {
  let query = args.join(" ").trim();
  if (!query) {
    return conn.reply(m.chat, `*STICKER PACK*\n\nExample: ${usedPrefix}sp anime`, m);
  }

  await conn.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

  let packs = await searchPack(query);
  if (!packs.length) {
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    return conn.reply(m.chat, `Search API failed. Try another query or try again later.\nQuery: ${query}`, m);
  }

  let random = packs[Math.floor(Math.random() * packs.length)];
  let detail = await getDetail(random.slug || random.title);

  if (!detail || !detail.stickers.length) {
    return conn.reply(m.chat, `Failed to get pack detail ${random.title}`, m);
  }

  await conn.reply(m.chat, `> Pack: *${detail.title}*\n> Sending ${Math.min(detail.stickers.length, 10)} stickers...`, m);

  let sent = 0;
  for (let url of detail.stickers.slice(0, 10)) {
    try {
      await conn.sendMessage(m.chat, { sticker: { url } }, { quoted: m });
      sent++;
      await new Promise(r => setTimeout(r, 1000));
    } catch { continue; }
  }

  await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  if (sent == 0) conn.reply(m.chat, `Failed to send, maybe s3 is blocked by the host`, m);
};

handler.help = ['stickerpack'];
handler.tags = ['sticker'];
handler.command = /^(stickerpack|sp|stickersearch)$/i;

export default handler;