import * as cheerio from 'cheerio';
import axios from 'axios';

async function searchPornhub(search) {
  try {
    const response = await axios.get(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000,
    });
    const html = response.data;
    const $ = cheerio.load(html);
    const result = [];
    $('ul#videoSearchResult > li.pcVideoListItem').each((a, b) => {
      const title = $(b).find('a').attr('title');
      const duration = $(b).find('var.duration').text().trim();
      const views = $(b).find('var.views').text().trim();
      const href = $(b).find('a').attr('href');
      const url = href? 'https://www.pornhub.com' + href : '';
      if (title) result.push({ title, duration, views, url });
    });
    return { result };
  } catch {
    return { result: [] };
  }
}

let handler = async (m, { conn, args, usedPrefix }) => {
  if (!global.db?.data?.chats?.[m.chat]?.nsfw && m.isGroup) {
    return conn.reply(m.chat, `*NSFW is off*\nEnable it with ${usedPrefix}enable nsfw`, m);
  }
  if (!args[0]) return conn.reply(m.chat, `Example: ${usedPrefix}phub music`, m);

  let res = await searchPornhub(args.join(' '));
  if (!res.result.length) return conn.reply(m.chat, `No results for ${args.join(' ')}`, m);

  let teks = res.result.slice(0,10).map((v,i) =>
`*[${i+1}] P O R N H U B*
🎞️ ${v.title}
🕒 ${v.duration} | 👀 ${v.views}
🔗 ${v.url}
`).join('\n----------------\n');

  await conn.reply(m.chat, teks, m);
};

handler.help = ['pornhubdl'];
handler.tags = ['+18'];
handler.command = /^(phub|porn|pornsearch|pornhubdl)$/i;
handler.nsfw = true;

export default handler;