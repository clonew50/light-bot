import * as cheerio from 'cheerio';
import axios from 'axios';

const emoji = '⚠️';
const emoji2 = '❌';
const msm = '⚠️';

let handler = async (m, { conn, args, command, usedPrefix }) => {
	if (!global.db?.data?.chats?.[m.chat]?.nsfw && m.isGroup) {
		return conn.reply(m.chat, `${emoji} NSFW content is disabled in this group.\n> An admin can enable it with *${usedPrefix}enable nsfw*`, m);
	}

	const query = args.join(' ').trim();
	if (!query) {
		return conn.reply(m.chat, `${emoji} Please enter a search query.\nExample: ${usedPrefix + command} music`, m);
	}

	try {
		const searchResults = await searchPornhub(query);
		let teks = searchResults.result
			.slice(0, 10)
			.map(
				(v) =>
					`「 *P O R N H U B  - S E A R C H* 」\n🎞️ *Title:* ${v.title}\n🕒 *Duration:* ${v.duration}\n👀 *Views:* ${v.views}\n🔗 *Link:* ${v.url}\n---------------------------------------------------\n`
			)
			.join('\n\n');

		if (searchResults.result.length === 0) {
			teks = `${emoji2} No results found...`;
		}

		await conn.reply(m.chat, teks, m);
	} catch (e) {
		return conn.reply(m.chat, `${msm} Error: ${e.message}`, m);
	}
};

handler.tags = ['+18'];
handler.help = ['pornhubsearch'];
handler.command = ['phsearch', 'pornhubsearch'];
export default handler;

async function searchPornhub(search) {
	try {
		const response = await axios.get(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
			timeout: 15000,
		});
		const html = response.data;
		const $ = cheerio.load(html);
		const result = [];

		$('ul#videoSearchResult > li.pcVideoListItem').each(function () {
			const _title = $(this).find('a').attr('title');
			const _duration = $(this).find('var.duration').text().trim();
			const _views = $(this).find('var.views').text().trim();
			const href = $(this).find('a').attr('href');
			const _url = href ? 'https://www.pornhub.com' + href : '';
			if (_title) result.push({ title: _title, duration: _duration, views: _views, url: _url });
		});

		return { result };
	} catch (error) {
		console.error(`${msm} Pornhub search error:`, error?.message || error);
		return { result: [] };
	}
}