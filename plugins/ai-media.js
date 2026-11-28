import {
	formatAiMediaHelp,
	generateAiImage,
	generateAiMusic,
	generateAiSpeech,
	generateAiVideo,
	parseAiMediaOptions,
} from '../lib/aiMedia.js';

function detectDefaultMode(command) {
	const cmd = String(command || '').toLowerCase();
	if (/^(aivideo|genvideo|vidai|فيديو_ai|توليد_فيديو|انيميشن|مقطع_ai)$/i.test(cmd)) return 'video';
	if (/^(tts|say|aiaudio|aivoice|صوت_ai|انطق|تكلم|توليد_صوت)$/i.test(cmd)) return 'tts';
	if (/^(aimusic|genmusic|موسيقى_ai|موسيقي_ai|توليد_موسيقى|لحن_ai)$/i.test(cmd)) return 'music';
	if (/^(ai_media|aimedia|توليد|gen|create|اصنع)$/i.test(cmd)) return 'hub';
	return 'image';
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
	const defaultMode = detectDefaultMode(command);
	const opts = parseAiMediaOptions(text, defaultMode);

	// Allow .فيديو_ai without text if user is replying to an image
	let quotedImageBuffer = null;
	if (m.quoted && /image/i.test(m.quoted.mimetype || m.quoted.mtype || '')) {
		try {
			const dl = await m.quoted.download?.();
			if (Buffer.isBuffer(dl) && dl.length > 0) quotedImageBuffer = dl;
		} catch {}
	}

	if (opts.showHelp || (!opts.prompt && !(opts.mode === 'video' && quotedImageBuffer))) {
		return conn.sendMessage(
			m.chat,
			{ text: formatAiMediaHelp(usedPrefix || '.') },
			{ quoted: m }
		);
	}

	await conn.sendMessage(m.chat, { react: { text: '⌛', key: m.key } }).catch(() => {});

	try {
		if (opts.mode === 'image') {
			const total = opts.count;
			for (let i = 0; i < total; i++) {
				const res = await generateAiImage({
					prompt: opts.prompt,
					model: opts.model,
					aspect: opts.aspect,
					referenceImage: quotedImageBuffer,
				});
				const indexLabel = total > 1 ? ` (${i + 1}/${total})` : '';
				await conn.sendMessage(
					m.chat,
					{
						image: res.buffer,
						caption: `🎨 *صورة بالذكاء الاصطناعي${indexLabel}*\n⚙️ المحرك: *${res.provider}*\n📐 المقاس: \`${opts.aspect}\``,
					},
					{ quoted: m }
				);
			}
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}

		if (opts.mode === 'video') {
			const res = await generateAiVideo({
				prompt: opts.prompt,
				imageBuffer: quotedImageBuffer,
				aspect: opts.aspect === '1:1' && !text?.includes('1:1') ? '16:9' : opts.aspect,
				duration: opts.duration,
				model: opts.model,
				withVoice: opts.withVoice,
				lang: opts.lang,
			});
			await conn.sendMessage(
				m.chat,
				{
					video: res.buffer,
					caption: `🎬 *فيديو بالذكاء الاصطناعي*\n⚙️ المحرك: *${res.provider}*${opts.prompt ? `\n📝 ${opts.prompt.slice(0, 120)}` : ''}`,
				},
				{ quoted: m }
			);
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}

		if (opts.mode === 'tts') {
			const res = await generateAiSpeech({
				text: opts.prompt,
				lang: opts.lang,
				voice: opts.voice,
				model: opts.model,
				asPtt: opts.asPtt,
			});
			await conn.sendMessage(
				m.chat,
				{
					audio: res.buffer,
					mimetype: res.mimetype,
					ptt: res.ptt,
				},
				{ quoted: m }
			);
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}

		if (opts.mode === 'music') {
			const res = await generateAiMusic({
				prompt: opts.prompt,
				duration: opts.duration,
				model: opts.model,
			});
			await conn.sendMessage(
				m.chat,
				{
					audio: res.buffer,
					mimetype: res.mimetype,
					ptt: false,
				},
				{ quoted: m }
			);
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}
	} catch (err) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		return conn.sendMessage(
			m.chat,
			{ text: `❌ تعذر إتمام التوليد: ${err?.message || err}` },
			{ quoted: m }
		);
	}
};

handler.help = [
	'ارسم <الوصف> (توليد صورة AI)',
	'فيديو_ai <الوصف> (توليد فيديو AI)',
	'انطق <النص> (توليد صوت AI)',
	'موسيقى_ai <الوصف> (توليد موسيقى AI)',
	'توليد <صورة|فيديو|صوت|موسيقى> <الوصف>',
];
handler.tags = ['ai', 'tools'];
handler.command = /^(imagine|aiimg|genimg|تخيل|ارسم|توليد_صورة|صورة_ai|رسم_ai|aivideo|genvideo|vidai|فيديو_ai|توليد_فيديو|انيميشن|مقطع_ai|tts|say|aiaudio|aivoice|صوت_ai|انطق|تكلم|توليد_صوت|aimusic|genmusic|موسيقى_ai|موسيقي_ai|توليد_موسيقى|لحن_ai|ai_media|aimedia|توليد|gen|create|اصنع)$/i;

export default handler;
