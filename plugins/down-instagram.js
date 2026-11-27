import { downloadInstagramMedia } from './ig.js';

let handler = async (m, { conn, text, usedPrefix, command }) => {
	try {
		const input = (m.quoted ? m.quoted.text : text) || '';
		const regex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[a-zA-Z0-9_.-]+\/?[^\s]*)/i;
		const parseUrl = input.match(regex)?.[0];

		if (!parseUrl) {
			throw `# How to Use\n\n> Enter an Instagram URL to download content\n\n# Usage Example\n> *${usedPrefix + command} https://www.instagram.com/reel/xxx*`;
		}

		const mediaList = await downloadInstagramMedia(parseUrl);
		if (mediaList.length > 1 && mediaList.every((v) => v.type === 'image')) {
			await conn.sendAlbumMessage(
				m.chat,
				mediaList.map((v) => ({ image: v.buffer })),
				{ quoted: m }
			);
			return;
		}

		for (const item of mediaList) {
			if (item.type === 'video') {
				await conn.sendMessage(m.chat, { video: item.buffer, mimetype: 'video/mp4', caption: '✅ Downloaded successfully' }, { quoted: m });
			} else {
				await conn.sendMessage(m.chat, { image: item.buffer, caption: '✅ Downloaded successfully' }, { quoted: m });
			}
		}
	} catch (err) {
		console.error('Instagram Error:', err?.message || err);
		await m.reply(typeof err === 'string' ? err : `There was an error fetching the IG media: ${err?.message || 'Unknown error'}`);
	}
};

handler.help = ['igdl'];
handler.tags = ['downloader'];
handler.command = /^(igdl|instagramdl)$/i;
handler.limit = true;

export default handler;

// Hi
