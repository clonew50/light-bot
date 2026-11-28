import { AIRich } from '../lib/AIRich.js';
import {
	formatSourcesHelp,
	IMAGE_SOURCES,
	parseImageSearchInput,
	searchImages,
} from '../lib/imageSearch.js';

async function sendInteractiveCard(conn, jid, payload, quoted, fallbackText) {
	if (typeof conn?.sendButton === 'function') {
		try {
			return await conn.sendButton(jid, payload, { quoted });
		} catch {}
	}
	if (payload?.image) {
		return conn.sendMessage(jid, { image: payload.image, caption: fallbackText || payload.body || '' }, { quoted });
	}
	return conn.sendMessage(jid, { text: fallbackText || payload?.body || '' }, { quoted });
}

function buildSourcesSelectButton(p, sampleQuery = 'طبيعة') {
	const q = String(sampleQuery || 'طبيعة').slice(0, 45);
	const byCat = {
		search: [],
		wallpapers: [],
		encyclopedia: [],
		anime: [],
	};
	for (const src of Object.values(IMAGE_SOURCES)) {
		const row = {
			header: src.id.toUpperCase(),
			title: src.arLabel || src.label,
			description: `بحث من ${src.label} (${src.aliases[0]})`,
			id: `${p}صور ${src.id} 4 ${q}`,
		};
		if (src.category === 'search') byCat.search.push(row);
		else if (src.category === 'wallpapers' || src.category === 'social' || src.category === 'art' || src.category === 'photography') byCat.wallpapers.push(row);
		else if (src.category === 'anime') byCat.anime.push(row);
		else byCat.encyclopedia.push(row);
	}

	return {
		name: 'single_select',
		buttonParamsJson: JSON.stringify({
			title: `🌐 اختر من ${Object.keys(IMAGE_SOURCES).length} موقعاً`,
			sections: [
				{
					title: '🔍 محركات البحث والتوزيع التلقائي',
					highlight_label: 'الأسرع',
					rows: [
						{
							header: 'AUTO',
							title: 'الوضع التلقائي المتنوع (Auto)',
							description: 'يجمع من أفضل المصادر المتاحة تلقائياً',
							id: `${p}صور auto 4 ${q}`,
						},
						...byCat.search,
					],
				},
				{ title: '🎨 الخلفيات والفنون والتصوير', rows: byCat.wallpapers },
				{ title: '🏛️ الموسوعات العلمية والفضاء', rows: byCat.encyclopedia },
				{ title: '🌸 الأنمي والرسوم', rows: byCat.anime },
				{
					title: '🛠️ صانع وقوالب الأوامر',
					rows: [
						{
							header: 'COMPOSER',
							title: 'فتح صانع أوامر البحث التفاعلي (AIRich)',
							description: 'قوالب جاهزة للنسخ والاقتراحات التفاعلية',
							id: `${p}صور صانع`,
						},
						{
							header: 'TABLE',
							title: 'جدول المصادر الـ 14 الكامل',
							description: 'كل المواقع مع الاختصارات العربية والإنجليزية',
							id: `${p}صور جدول`,
						},
					],
				},
			],
		}),
	};
}

async function sendSourcesRichTable(conn, jid, usedPrefix, quoted) {
	const p = usedPrefix || '.';
	const fallback = formatSourcesHelp(p);
	try {
		if (typeof conn?.relayMessage === 'function') {
			const sourcesRows = [['المصدر', 'التخصص والوصف', 'الاختصارات']];
			for (const src of Object.values(IMAGE_SOURCES)) {
				sourcesRows.push([src.id, src.arLabel || src.label, src.aliases.slice(0, 3).join(' / ')]);
			}
			await new AIRich(conn)
				.setTitle(`🖼️ صـانـع أوامـر الـبـحـث عـن الـصـور (${Object.keys(IMAGE_SOURCES).length} موقعاً بدون مفاتيح)`)
				.addText(
					'╭───┈「 🛠️ صـانـع أوامـر الـبـحـث (Search Recipes) 」┈───╮\n' +
					'⌑ مرحباً بك في صانع أوامر البحث عن الصور عبر 14 موقعاً عالمياً!\n' +
					'⌑ اختر قالباً جاهزاً من الجدول أدناه لتنفيذه مباشرة أو نسخه بضغطة زر:\n' +
					'╰───────────────────────────╯'
				)
				.addTable([
					['المصدر والقالب', 'أمر البحث المباشر الجاهز للنسخ والتنفيذ', 'التصنيف والهدف'],
					['📌 بنترست (فنون ورمزيات)', `${p}صور pinterest 4 خلفيات انمي فخمة سوداء`, 'تصاميم وفنون راقية'],
					['💻 وولهيفن (خلفيات 4K)', `${p}صور wallhaven 4 cyberpunk neon 4k`, 'خلفيات شاشات كمبيوتر'],
					['📸 أنسبلاش (طبيعة ومناظر)', `${p}صور unsplash 5 مناظر طبيعية شلالات`, 'تصوير فوتوغرافي واقعي'],
					['🚀 ناسا (فضاء ومجرات)', `${p}صور nasa 3 deep space nebula hubble`, 'أرشيف تلسكوب الفضاء'],
					['🌐 بينج (بحث عام دقيق)', `${p}صور bing 4 سيارات كلاسيكية نادرة`, 'محرك بحث دقيق وشامل'],
					['🦆 داك داك جو (خصوصية)', `${p}صور ddg 4 cute baby animals`, 'بحث سريع بدون تتبع'],
					['🌸 سيف بورو (أنمي ورسوم)', `${p}صور safebooru 4 anime landscape fantasy`, 'رسومات وأنمي نقي'],
					['⚡ تلقائي متنوع (Auto)', `${p}صور auto 6 طيور استوائية نادرة`, 'يوزع بالتساوي على المواقع'],
				])
				.addText(
					`╭───┈「 🌐 الـمـصـادر الـمـدعـومـة (${Object.keys(IMAGE_SOURCES).length} موقعاً مجانياً) 」┈───╮\n` +
					`⌑ الصيغة: \`${p}صور <الموقع> <العدد> <الكلمة>\` أو تلقائياً \`${p}صور 5 قطط\`:\n` +
					'╰───────────────────────────╯'
				)
				.addTable(sourcesRows)
				.addTip('💡 تلميح: اضغط على أي اقتراح أدناه لتنفيذه فوراً، أو استخدم زر (نسخ قالب بنترست) لتعديله!')
				.addSuggest([
					`${p}صور pinterest 4 خلفيات انمي فخمة سوداء`,
					`${p}صور wallhaven 4 cyberpunk neon 4k`,
					`${p}صور unsplash 5 مناظر طبيعية شلالات`,
					`${p}صور nasa 3 deep space nebula hubble`,
					`${p}صور auto 4 قطط لطيفة`,
					`${p}صور bing 4 سيارات رياضية حديثة`,
				])
				.send(jid, { quoted });
			return true;
		}
	} catch {}

	await sendInteractiveCard(
		conn,
		jid,
		{
			title: `🖼️ صانع وقوالب البحث عن الصور (${Object.keys(IMAGE_SOURCES).length} موقعاً)`,
			subtitle: 'بحث متعدد المصادر بدون API Key',
			body: fallback,
			footer: 'اختر مصدراً من القائمة أو انسخ القالب الجاهز للتعديل',
			buttons: [
				buildSourcesSelectButton(p),
				{
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: '🛠️ صانع الأوامر (AIRich)',
						id: `${p}صور صانع`,
					}),
				},
				{
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: '📌 بنترست (4 صور)',
						id: `${p}صور pinterest 4 خلفيات انمي فخمة سوداء`,
					}),
				},
				{
					name: 'cta_copy',
					buttonParamsJson: JSON.stringify({
						display_text: '📋 نسخ قالب بنترست الجاهز',
						copy_code: `${p}صور pinterest 4 خلفيات انمي فخمة سوداء`,
					}),
				},
			],
		},
		quoted,
		fallback
	);
	return true;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
	const p = usedPrefix || '.';
	const trimmed = String(text || '').trim();
	if (/^(rich|table|جدول|صانع|صانع_الاوامر|صانع_الأوامر|composer|maker)(\s|$)/i.test(trimmed)) {
		return sendSourcesRichTable(conn, m.chat, p, m);
	}

	const parsed = parseImageSearchInput(text);

	if (parsed.showSources || !parsed.query) {
		const helpText = formatSourcesHelp(p);
		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: `🖼️ محرك البحث عن الصور (${Object.keys(IMAGE_SOURCES).length} موقعاً)`,
				subtitle: 'بحث ذكي متعدد المصادر + تصفية تلقائية للصور التالفة',
				body: helpText,
				footer: 'اختر الموقع من القائمة أو جرّب أزرار البحث السريع',
				buttons: [
					buildSourcesSelectButton(p, 'خلفيات طبيعة'),
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '🛠️ صانع الأوامر (AIRich)',
							id: `${p}صور صانع`,
						}),
					},
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '🔍 بحث تلقائي (قطط)',
							id: `${p}صور auto 4 قطط`,
						}),
					},
					{
						name: 'cta_copy',
						buttonParamsJson: JSON.stringify({
							display_text: '📋 نسخ قالب بنترست الجاهز',
							copy_code: `${p}صور pinterest 4 خلفيات انمي فخمة سوداء`,
						}),
					},
				],
			},
			m,
			helpText
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
			const emptyText = `❌ لم يتم العثور على صور صالحة لـ *"${parsed.query}"* في *${srcName}*.\n💡 جرّب الوضع التلقائي أو بدّل المصدر أو ارسمها بالذكاء الاصطناعي:`;
			return sendInteractiveCard(
				conn,
				m.chat,
				{
					title: '🔍 لا توجد نتائج مطابقة',
					subtitle: srcName,
					body: emptyText,
					footer: 'اختر بديلاً بضغطة واحدة',
					buttons: [
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🔄 البحث بالوضع التلقائي',
								id: `${p}${command} auto ${parsed.count} ${parsed.query}`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '📌 جرب Pinterest',
								id: `${p}صور pinterest ${parsed.count} ${parsed.query}`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎨 ارسمها بالذكاء AI',
								id: `${p}ارسم ${parsed.query}`,
							}),
						},
					],
				},
				m,
				emptyText
			);
		}

		for (let i = 0; i < res.images.length; i++) {
			const img = res.images[i];
			const captionLines = [
				'╭───┈「 🖼️ نـتـائـج الـبـحـث عـن الـصـور 」┈───╮',
				'│',
				`│ 🔍 الـبـحـث: *${parsed.query}* (${i + 1}/${res.images.length})`,
				`│ 🌐 الـمـصـدر: *${img.sourceLabel || img.source}*`,
			];
			if (img.title && img.title.toLowerCase() !== parsed.query.toLowerCase()) {
				captionLines.push(`│ 📝 ${img.title.slice(0, 90)}`);
			}
			captionLines.push('│', '╰───────────────────────────╯');
			const caption = captionLines.join('\n');

			if (i === res.images.length - 1) {
				const qShort = parsed.query.slice(0, 50);
				await sendInteractiveCard(
					conn,
					m.chat,
					{
						image: img.buffer,
						title: `🖼️ نتائج البحث: ${qShort}`,
						subtitle: `المصادر: ${res.usedSources.join(', ') || img.sourceLabel}`,
						body: caption,
						footer: 'تبديل الموقع أو طلب المزيد بضغطة واحدة',
						buttons: [
							buildSourcesSelectButton(p, qShort),
							{
								name: 'quick_reply',
								buttonParamsJson: JSON.stringify({
									display_text: '➕ هات 6 صور',
									id: `${p}صور ${parsed.source} 6 ${qShort}`,
								}),
							},
							{
								name: 'quick_reply',
								buttonParamsJson: JSON.stringify({
									display_text: '🎨 ارسمها بالذكاء',
									id: `${p}ارسم ${qShort}`,
								}),
							},
						],
					},
					m,
					caption
				);
			} else {
				await conn.sendMessage(
					m.chat,
					{
						image: img.buffer,
						caption,
					},
					{ quoted: m }
				);
			}
		}

		await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
	} catch (err) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		const errText = `❌ حدث خطأ أثناء البحث عن الصور: ${err?.message || err}`;
		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '⚠️ تعذر إتمام البحث',
				subtitle: 'خيارات بديلة',
				body: errText,
				buttons: [
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '🔄 إعادة في الوضع التلقائي',
							id: `${p}صور auto ${parsed.count} ${parsed.query}`,
						}),
					},
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '🌐 عرض المصادر',
							id: `${p}صور المصادر`,
						}),
					},
				],
			},
			m,
			errText
		);
	}
};

handler.help = [
	'صور <كلمة البحث>',
	'صور <المصدر> <العدد> <كلمة البحث>',
	'صور جدول (عرض جدول الـ 14 موقعاً)',
	'img [-s source] [-n count] <query>',
];
handler.tags = ['search', 'internet'];
handler.command = /^(img|image|images|imgsearch|pic|pics|صور|صورة|صوره|بحث_صور|هات_صور)$/i;

export default handler;
