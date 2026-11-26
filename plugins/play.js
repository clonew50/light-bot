import { toAudio } from '../lib/converter.js';
import { downloadYouTubeMedia, extractYouTubeId, searchYouTube } from '../lib/ytdl.js';

let handler = async (m, { conn, args, usedPrefix, command }) => {
	const q = args.join(' ').trim();
	const type = /mp3|audio|play/i.test(command) ? 'audio' : 'video';
	if (!q) {
		return m.reply(`*Example:*\n${usedPrefix + command} https://youtu.be/xxx\n${usedPrefix + command} latest music`);
	}

	await conn.sendMessage(m.chat, { react: { text: '🕕', key: m.key } });
	try {
		let url = q;
		if (!extractYouTubeId(q)) {
			const search = await searchYouTube(q, 1);
			if (!search.length) return m.reply(`❌ Not found: ${q}`);
			url = search[0].url;
		}

		const result = await downloadYouTubeMedia(url, type);
		if (type === 'audio') {
			let audioBuf = result.buffer;
			try {
				const converted = await toAudio(result.buffer, result.ext);
				audioBuf = converted.data;
			} catch {}
			await conn.sendMessage(
				m.chat,
				{ audio: audioBuf, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` },
				{ quoted: m }
			);
		} else {
			await conn.sendMessage(
				m.chat,
				{ video: result.buffer, caption: `✅ *${result.title}*`, mimetype: 'video/mp4', fileName: `${result.title}.mp4` },
				{ quoted: m }
			);
		}
		await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
	} catch (e) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
		return m.reply(`❌ Error: ${e.message}`);
	}
};

handler.help = ['play <title/url>', 'yt <url>'];
handler.tags = ['downloader'];
handler.command = /^(play|yt)$/i;
handler.limit = true;
export default handler;