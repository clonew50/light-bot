import axios from 'axios';

export async function searchStickersTenor(query, limit = 8) {
	const url = `https://tenor.com/search/${encodeURIComponent(query)}-stickers`;
	const { data: html } = await axios.get(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
			Accept: 'text/html,application/xhtml+xml',
		},
		timeout: 15000,
	});

	const matches = String(html).match(/https:\/\/media1?\.tenor\.com\/m\/[A-Za-z0-9_-]+\/[^"'\s<>]+\.(?:gif|png|webp|jpg)/gi) || [];
	const unique = [...new Set(matches)].slice(0, limit);
	return unique;
}

let handler = async (m, { conn, args, usedPrefix }) => {
	const query = args.join(' ').trim();
	if (!query) {
		return conn.reply(m.chat, `*STICKER PACK*\n\nExample: ${usedPrefix}sp anime`, m);
	}

	await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

	try {
		const stickers = await searchStickersTenor(query, 6);
		if (!stickers.length) {
			await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
			return conn.reply(m.chat, `No stickers found for query: *${query}*`, m);
		}

		await conn.reply(m.chat, `> Query: *${query}*\n> Sending ${stickers.length} stickers...`, m);

		let sent = 0;
		for (const url of stickers) {
			try {
				const res = await axios.get(url, {
					responseType: 'arraybuffer',
					timeout: 15000,
					headers: { 'User-Agent': 'Mozilla/5.0' },
				});
				const buf = Buffer.from(res.data);
				if (!buf.length) continue;
				await conn.sendSticker(m.chat, buf, m);
				sent++;
				await new Promise((r) => setTimeout(r, 600));
			} catch {
				continue;
			}
		}

		if (sent === 0) {
			await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
			return conn.reply(m.chat, `Failed to process stickers for "${query}".`, m);
		}

		await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
	} catch (e) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
		return conn.reply(m.chat, `Sticker search failed: ${e.message}`, m);
	}
};

handler.help = ['stickerpack'];
handler.tags = ['sticker'];
handler.command = /^(stickerpack|sp|stickersearch)$/i;

export default handler;