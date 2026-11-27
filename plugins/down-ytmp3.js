import { toAudio } from '../lib/converter.js';
import { downloadYouTubeMedia } from '../lib/ytdl.js';

let handler = async (m, { conn, usedPrefix, command, text }) => {
	if (!text) throw `Usage: ${usedPrefix + command} <YouTube Audio URL>`;
	m.react('🔁');
	try {
		const dl = await ytdown(text, 'audio');
		const info = dl.info;
		const sthumb = await conn.adReply(
			m.chat,
			`– 乂 *YouTube - Audio*\n> *- Title :* ${info.title}\n> *- Channel :* ${info.uploader}\n> *- Duration :* ${info.duration}\n> *- Views :* ${info.views}\n> *- Size :* ${info.size}`,
			info.thumbnail,
			m,
			{ title: info.title, source: text }
		);
		let audioData = dl.buffer;
		try {
			const audios = await toAudio(dl.buffer, dl.ext);
			audioData = audios.data;
		} catch {}
		await conn.sendMessage(
			m.chat,
			{
				audio: audioData,
				mimetype: 'audio/mpeg',
				fileName: `${info.title}.mp3`,
			},
			{ quoted: sthumb }
		);
	} catch (e) {
		return m.reply(e.message);
	}
};

handler.help = ['ytmp3'];
handler.tags = ['downloader'];
handler.command = /^(yta|ytmp3|ytaudio)$/i;
handler.limit = true;

export default handler;

export async function ytdown(url, type = 'video') {
	const result = await downloadYouTubeMedia(url, type === 'audio' ? 'audio' : 'video');
	return {
		info: {
			title: result.title,
			desc: '',
			thumbnail: result.thumbnail,
			views: result.views,
			uploader: result.uploader,
			quality: result.quality,
			duration: result.duration,
			extension: result.ext,
			size: result.size,
		},
		download: result.download_url,
		buffer: result.buffer,
		ext: result.ext,
	};
}

// Hi
