import {
	formatSourcesHelp,
	IMAGE_SOURCES,
	parseImageSearchInput,
	searchImages,
} from '../lib/imageSearch.js';

const handler = async (m, { conn, text, usedPrefix, command }) => {
	const parsed = parseImageSearchInput(text);

	if (parsed.showSources || !parsed.query) {
		return conn.sendMessage(
			m.chat,
			{ text: formatSourcesHelp(usedPrefix || '.') },
			{ quoted: m }
		);
	}

	await conn.sendMessage(m.chat, { react: { text: '⌛', key: m.key } }).catch(() => {});

	try {
		const res = await searchImages({
			query: parsed.query,
			source: parsed.source,
			count: parsed.count,
		});

		if (!res.images.length) {
			await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
			const srcName = parsed.source === 'auto'
				? 'المصادر التلقائية'
				: IMAGE_SOURCES[parsed.source]?.arLabel || parsed.source;
			return conn.sendMessage(
				m.chat,
				{
					text: `❌ لم يتم العثور على صور صالحة لـ *"${parsed.query}"* في *${srcName}*.\n💡 جرّب تغيير الكلمة أو استخدام الوضع التلقائي:\n\`${usedPrefix || '.'}${command} auto ${parsed.count} ${parsed.query}\``,
				},
				{ quoted: m }
			);
		}

		for (let i = 0; i < res.images.length; i++) {
			const img = res.images[i];
			const captionLines = [
				`🖼️ *${parsed.query}* (${i + 1}/${res.images.length})`,
				`🌐 المصدر: *${img.sourceLabel || img.source}*`,
			];
			if (img.title && img.title.toLowerCase() !== parsed.query.toLowerCase()) {
				captionLines.push(`📝 ${img.title.slice(0, 120)}`);
			}
			await conn.sendMessage(
				m.chat,
				{
					image: img.buffer,
					caption: captionLines.join('\n'),
				},
				{ quoted: m }
			);
		}

		await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
	} catch (err) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		return conn.sendMessage(
			m.chat,
			{ text: `❌ حدث خطأ أثناء البحث عن الصور: ${err?.message || err}` },
			{ quoted: m }
		);
	}
};

handler.help = [
	'صور <كلمة البحث>',
	'صور <المصدر> <العدد> <كلمة البحث>',
	'img [-s source] [-n count] <query>',
];
handler.tags = ['search', 'internet'];
handler.command = /^(img|image|images|imgsearch|pic|pics|صور|صورة|صوره|بحث_صور|هات_صور)$/i;

export default handler;
