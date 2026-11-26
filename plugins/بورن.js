import * as cheerio from 'cheerio';

async function searchPornhub(search) {
  try {
    let res = await fetch(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    let html = await res.text();
    let $ = cheerio.load(html);
    let result = [];
    $('ul#videoSearchResult > li.pcVideoListItem').each((a, b) => {
      let title = $(b).find('a').attr('title');
      let duration = $(b).find('var.duration').text().trim();
      let views = $(b).find('var.views').text().trim();
      let href = $(b).find('a').attr('href');
      if (title && href) result.push({ title, duration, views, url: 'https://www.pornhub.com' + href });
    });
    return result.slice(0, 10);
  } catch {
    return [];
  }
}

let handler = async (m, { conn, args, usedPrefix }) => {
  if (!global.db?.data?.chats?.[m.chat]?.nsfw && m.isGroup) {
    return conn.reply(m.chat, `nsfw is off, enable with ${usedPrefix}nsfw on`, m);
  }
  if (!args[0]) {
    return conn.reply(m.chat, `Example: ${usedPrefix}ph mia khalifa`, m);
  }
  let results = await searchPornhub(args.join(' '));
  if (!results.length) return conn.reply(m.chat, `No results`, m);
  let text = `PORNHUB SEARCH - REM BOT\n\n`;
  text += results.map((v, i) => `${i+1}. ${v.title}\n${v.duration} | ${v.views}\n${v.url}\n`).join('\n');
  await conn.reply(m.chat, text, m);
};

handler.help = ['ph2'];
handler.tags = ['+18'];
handler.command = /^ph2$/i;
handler.nsfw = true;

export default handler;