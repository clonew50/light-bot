import cheerio from 'cheerio';

async function searchPornhub(search) {
  try {
    let res = await fetch(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    let html = await res.text();
    let $ = cheerio.load(html);
    let result = [];
    $('ul#videoSearchResult > li.pcVideoListItem').each((a, b) => {
      let title = $(b).find('a').attr('title');
      let duration = $(b).find('var.duration').text().trim();
      let views = $(b).find('var.views').text().trim();
      let url = 'https://www.pornhub.com' + $(b).find('a').attr('href');
      if (title && url) result.push({ title, duration, views, url });
    });
    return result.slice(0, 10);
  } catch {
    return [];
  }
}

let handler = async (m, { conn, args, usedPrefix }) => {
  if (!global.db.groups[m.chat].nsfw && m.isGroup) {
    return conn.reply(m.chat, `nsfw is off, enable with ${usedPrefix}nsfw on`, m);
  }
  if (!args[0]) {
    return conn.reply(m.chat, `Example: ${usedPrefix}ph mia khalifa`, m);
  }
  let results = await searchPornhub(args.join(' '));
  if (!results.length) return conn.reply(m.chat, `No results`, m);
  let text = `PORNHUB SEARCH - REM BOT\n\n`;
  text += results.map((v, i) => `${i+1}. ${v.title}\n${v.duration} | ${v.views}\n${v.url}\n`).join('\n');
  conn.reply(m.chat, text, m);
};

handler.usage = ['ph'];
handler.category = 'adult';
handler.command = /^ph$/i;
handler.nsfw = true;

export default handler;