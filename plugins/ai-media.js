import { AIRich } from '../lib/AIRich.js';
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

async function sendInteractiveCard(conn, jid, payload, quoted, fallbackText) {
	if (typeof conn?.sendButton === 'function') {
		try {
			return await conn.sendButton(jid, payload, { quoted });
		} catch {}
	}
	if (payload?.image) {
		return conn.sendMessage(jid, { image: payload.image, caption: fallbackText || payload.body || '' }, { quoted });
	}
	if (payload?.video) {
		return conn.sendMessage(jid, { video: payload.video, caption: fallbackText || payload.body || '' }, { quoted });
	}
	return conn.sendMessage(jid, { text: fallbackText || payload?.body || '' }, { quoted });
}

function buildStudioButtons(p) {
	const selectMenu = {
		title: '🎨 استوديو التوليد السريع',
		sections: [
			{
				title: '🖼️ توليد الصور (بدون مفاتيح)',
				highlight_label: 'مجاني',
				rows: [
					{
						header: 'FLUX',
						title: 'لوحة مستقبلية بأسلوب Flux',
						description: 'رسم تفصيلي سريع + ترجمة تلقائية',
						id: `${p}ارسم -m flux القاهرة المستقبلية ليلاً بأضواء نيون ومطر`,
					},
					{
						header: 'HORDE',
						title: 'رسم سريع عبر AI Horde',
						description: 'مستقر ومتاح دائماً بدون قيود IP',
						id: `${p}ارسم -m horde أسد ملكي فوق أهرامات الجيزة وقت الغروب`,
					},
					{
						header: '16:9',
						title: 'خلفية عرضية عالية الدقة',
						description: 'مقاس سينمائي عريض 16:9',
						id: `${p}ارسم -a 16:9 جبال خضراء وشلالات وقت شروق الشمس`,
					},
					{
						header: '9:16',
						title: 'تصميم ستوري طولي 9:16',
						description: 'مثالي لخلفيات الهاتف والحالات',
						id: `${p}ارسم -a 9:16 رائد فضاء يقف أمام مجرة متوهجة`,
					},
				],
			},
			{
				title: '🎬 توليد الفيديو بالذكاء الاصطناعي',
				rows: [
					{
						header: 'VIDEO',
						title: 'فيديو طبيعة سينمائي',
						description: 'LTX-Video أو حركة FFmpeg تلقائية',
						id: `${p}فيديو_ai أمواج المحيط وقت الغروب بأسلوب سينمائي`,
					},
					{
						header: 'VOICE',
						title: 'فيديو مع تعليق صوتي (--tts)',
						description: 'صورة AI متحركة مع نطق الوصف صوتياً',
						id: `${p}فيديو_ai --tts صحراء ذهبية وجمال تسير وقت الشروق`,
					},
				],
			},
			{
				title: '🎙️ الكلام والموسيقى والألحان',
				rows: [
					{
						header: 'AR TTS',
						title: 'نطق نص عربي واضح',
						description: 'Google TTS + SoundOfText',
						id: `${p}انطق أهلاً بكم في استوديو البوت الذكي`,
					},
					{
						header: 'EN TTS',
						title: 'صوت إنجليزي احترافي (StreamElements)',
						description: 'مذيع إنجليزي نقي بدون مفتاح',
						id: `${p}tts -m streamelements -l en Welcome to the AI media studio`,
					},
					{
						header: 'SING',
						title: 'صوت غنائي تفاعلي (TikTok)',
						description: 'نغمة غنائية إنجليزية مرحة',
						id: `${p}say -m tiktok -v sing Happy birthday to you my friend`,
					},
					{
						header: 'ORIENTAL',
						title: 'موسيقى شرقية بالعود والمقام',
						description: 'لحن عربي هادئ 12 ثانية',
						id: `${p}موسيقى_ai موسيقى شرقية بالعود هادئة -d 12`,
					},
					{
						header: 'LO-FI',
						title: 'موسيقى لوفي (Lo-Fi) للتركيز',
						description: 'كوردات دافئة مريحة',
						id: `${p}موسيقى_ai موسيقى لوفي هادئة للدراسة -d 12`,
					},
					{
						header: 'CINEMATIC',
						title: 'مقطوعة سينمائية ملحمية',
						description: 'إيقاع درامي ملحمي 15 ثانية',
						id: `${p}موسيقى_ai موسيقى سينمائية ملحمية حماسية -d 15`,
					},
				],
			},
			{
				title: '📊 المزودون بدون مفاتيح',
				rows: [
					{
						header: 'RICH',
						title: 'عرض جدول المزودين الكامل (AIRich)',
						description: 'كل المحركات المجانية وحدود الاستخدام',
						id: `${p}توليد جدول`,
					},
				],
			},
		],
	};

	return [
		{ name: 'single_select', buttonParamsJson: JSON.stringify(selectMenu) },
		{
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: '🎨 ارسم مثالاً',
				id: `${p}ارسم أسد يطير فوق أهرامات الجيزة وقت الغروب`,
			}),
		},
		{
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: '🎵 لحن شرقي',
				id: `${p}موسيقى_ai موسيقى شرقية هادئة بالعود -d 12`,
			}),
		},
		{
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({
				display_text: '📋 نسخ قالب احترافي',
				copy_code: `${p}ارسم -a 16:9 -m auto `,
			}),
		},
	];
}

async function sendProvidersRichTable(conn, jid, usedPrefix, quoted) {
	const p = usedPrefix || '.';
	const bodyText = formatAiMediaHelp(p);
	try {
		if (typeof conn?.relayMessage === 'function') {
			await new AIRich(conn)
				.setTitle('✨ مزودو استوديو الذكاء الاصطناعي (بدون مفاتيح API)')
				.addText(
					'جميع المحركات التالية تعمل مباشرة مجاناً وتدعم الترجمة التلقائية من العربية للإنجليزية لرفع دقة النتائج:'
				)
				.addTable([
					['النوع', 'المزودون المجانيون', 'الملاحظات والخيارات'],
					['🖼️ الصور', 'Pollinations (Turbo/Flux) • HF Z-Image • HF FLUX.1 • AI Horde', '-a 1:1 / 16:9 / 9:16 | -m horde/flux'],
					['🎬 الفيديو', 'LTX-Video Distilled (HF) • FFmpeg Ken Burns Motion', 'أضف --tts أو رد على صورة بـ .فيديو_ai'],
					['🎙️ الصوت TTS', 'Google TTS • TikTok TTS • SoundOfText • StreamElements', '-l ar/en | -m tiktok/streamelements | -v sing'],
					['🎵 الموسيقى', 'FFmpeg Synth (شرقي/عود، لوفي، سينمائي، بيانو، إلكتروني)', '-d 4..20 ثانية لتحديد المدة'],
				])
				.addTip('تلميح: إذا انضغط مزود مجاني لثوانٍ ينتقل البوت تلقائياً إلى AI Horde بدون تدخل منك.')
				.addSuggest([
					`${p}ارسم -m horde قلعة عربية على السحاب وقت الغروب`,
					`${p}فيديو_ai أمواج البحر الهادئة`,
					`${p}توليد`,
				])
				.send(jid, { quoted });
			return true;
		}
	} catch {}

	await sendInteractiveCard(
		conn,
		jid,
		{
			title: '📊 جدول المزودين المجانيين',
			subtitle: 'توليد الصور والفيديو والصوت والموسيقى بدون مفاتيح',
			body: bodyText,
			footer: 'اختر أسلوب التوليد من الأزرار أدناه',
			buttons: buildStudioButtons(p),
		},
		quoted,
		bodyText
	);
	return true;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
	const p = usedPrefix || '.';
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

	if (opts.mode === 'rich') {
		return sendProvidersRichTable(conn, m.chat, p, m);
	}

	if (opts.showHelp || (!opts.prompt && !(opts.mode === 'video' && quotedImageBuffer))) {
		const helpText = formatAiMediaHelp(p);
		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '✨ استوديو التوليد بالذكاء الاصطناعي',
				subtitle: 'توليد الصور • الفيديو • الصوت • الموسيقى بدون مفاتيح',
				body: helpText,
				footer: 'جرّب من القائمة التفاعلية أو اضغط أحد أزرار الاختصار',
				buttons: buildStudioButtons(p),
			},
			m,
			helpText
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
				const caption = [
					`╭───┈「 🎨 تـم تـولـيـد الـصـورة بـنـجـاح${indexLabel} 」┈───╮`,
					'│',
					`│ ⚙️ الـمـحـرك: *${res.provider}*`,
					`│ 📐 الـمـقـاس: \`${opts.aspect}\``,
					`│ 📝 الـوصـف: _${opts.prompt.slice(0, 90)}_`,
					'│',
					'╰───────────────────────────╯',
					'> 💡 اضغط على الأزرار أدناه للتعديل أو طلب أبعاد جديدة',
				].join('\n');

				if (i === total - 1) {
					const shortPrompt = opts.prompt.slice(0, 75);
					await sendInteractiveCard(
						conn,
						m.chat,
						{
							image: res.buffer,
							title: `🎨 تم التوليد بنجاح${indexLabel}`,
							subtitle: res.provider,
							body: caption,
							footer: 'اضغط لإعادة الرسم أو تجربة محرك آخر',
							buttons: [
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: '🔄 إعادة التوليد',
										id: `${p}ارسم -a ${opts.aspect} ${shortPrompt}`,
									}),
								},
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: '⚡ محرك AI Horde',
										id: `${p}ارسم -m horde -a ${opts.aspect} ${shortPrompt}`,
									}),
								},
								{
									name: 'quick_reply',
									buttonParamsJson: JSON.stringify({
										display_text: '🎬 حوّل الوصف لفيديو',
										id: `${p}فيديو_ai ${shortPrompt}`,
									}),
								},
								{
									name: 'cta_copy',
									buttonParamsJson: JSON.stringify({
										display_text: '📋 نسخ الوصف',
										copy_code: opts.prompt,
									}),
								},
							],
						},
						m,
						caption
					);
				} else {
					await conn.sendMessage(m.chat, { image: res.buffer, caption }, { quoted: m });
				}
			}
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}

		if (opts.mode === 'video') {
			const finalAspect = opts.aspect === '1:1' && !text?.includes('1:1') ? '16:9' : opts.aspect;
			const res = await generateAiVideo({
				prompt: opts.prompt,
				imageBuffer: quotedImageBuffer,
				aspect: finalAspect,
				duration: opts.duration,
				model: opts.model,
				withVoice: opts.withVoice,
				lang: opts.lang,
			});
			const caption = [
				'╭───┈「 🎬 تـم صـنـاعـة الـفـيـديـو بـنـجـاح 」┈───╮',
				'│',
				`│ 🎥 الـمـحـرك: *${res.provider}*`,
				`│ 📐 الأبـعـاد: \`${finalAspect}\``,
				`│ 🎙️ الـتـعـلـيـق: ${opts.withVoice ? 'مـع صـوت نـاطـق (--tts)' : 'بـدون صـوت'}`,
				opts.prompt ? `│ 📝 الـوصـف: _${opts.prompt.slice(0, 110)}_` : '',
				'│',
				'╰───────────────────────────╯',
				'> 💡 يمكنك الرد على أي صورة بـ .فيديو_ai لتحريكها فوراً',
			]
				.filter(Boolean)
				.join('\n');

			await sendInteractiveCard(
				conn,
				m.chat,
				{
					video: res.buffer,
					title: '🎬 اكتمل إنشاء الفيديو',
					subtitle: res.provider,
					body: caption,
					footer: 'يمكنك الرد على أي صورة بـ .فيديو_ai لتحريكها',
					buttons: [
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎬 فيديو جديد',
								id: `${p}فيديو_ai ${opts.prompt ? opts.prompt.slice(0, 70) : 'أمواج البحر وقت الغروب'}`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎵 موسيقى AI',
								id: `${p}موسيقى_ai موسيقى سينمائية ملحمية -d 12`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '✨ قائمة الاستوديو',
								id: `${p}توليد`,
							}),
						},
					],
				},
				m,
				caption
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
			const metaBody = [
				'╭───┈「 🎙️ تـم تـولـيـد الـتـعـلـيـق الـصـوتـي 」┈───╮',
				'│',
				`│ 🗣️ الـمـحـرك: *${res.provider}*`,
				`│ 🌐 الـلـغـة: \`${res.lang || opts.lang || 'auto'}\``,
				`│ 📝 الـنـص: _${opts.prompt.slice(0, 90)}_`,
				'│',
				'╰───────────────────────────╯',
			].join('\n');
			await sendInteractiveCard(
				conn,
				m.chat,
				{
					title: '🎙️ مخرج الصوت الذكي (TTS)',
					subtitle: res.provider,
					body: metaBody,
					footer: 'اختر صوتاً بديلاً أو عد إلى الاستوديو',
					buttons: [
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎭 صوت TikTok غنائي',
								id: `${p}say -m tiktok -v sing ${opts.prompt.slice(0, 60)}`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '📊 جدول المزودين',
								id: `${p}توليد جدول`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '✨ الاستوديو',
								id: `${p}توليد`,
							}),
						},
					],
				},
				m,
				metaBody
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
			const musicBody = [
				'╭───┈「 🎵 تـم تـألـيـف الـمـقـطـوعـة الـمـوسـيـقـيـة 」┈───╮',
				'│',
				`│ 🎼 الـمـحـرك: *${res.provider}*`,
				`│ ⏱️ الـمـدة: \`${res.duration || opts.duration} ثـانـيـة\``,
				`│ 📝 الـوصـف: _${opts.prompt.slice(0, 90)}_`,
				'│',
				'╰───────────────────────────╯',
			].join('\n');
			await sendInteractiveCard(
				conn,
				m.chat,
				{
					title: '🎵 استوديو الموسيقى والألحان',
					subtitle: res.provider,
					body: musicBody,
					footer: 'جرّب أنماطاً أخرى: شرقي، لوفي، سينمائي، بيانو',
					buttons: [
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🪕 مقام شرقي',
								id: `${p}موسيقى_ai موسيقى شرقية بالعود -d 15`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎧 لوفي هادئ',
								id: `${p}موسيقى_ai موسيقى لوفي هادئة -d 15`,
							}),
						},
						{
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: '🎻 ملحمي سينمائي',
								id: `${p}موسيقى_ai موسيقى سينمائية ملحمية -d 15`,
							}),
						},
					],
				},
				m,
				musicBody
			);
			await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
			return;
		}
	} catch (err) {
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		const errBody = [
			'❌ *تعذر إتمام التوليد الآن*',
			`📋 التفاصيل: ${err?.message || err}`,
			'',
			'💡 جرّب التبديل السريع إلى *AI Horde* أو البحث عن صور جاهزة بالأسفل:',
		].join('\n');
		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '⚠️ تنبيه التوليد',
				subtitle: 'خيارات بديلة فورية',
				body: errBody,
				footer: 'أو أرسل .توليد جدول لعرض حالة المزودين',
				buttons: [
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '⚡ جرّب AI Horde',
							id: `${p}ارسم -m horde ${(opts.prompt || 'nature landscape').slice(0, 65)}`,
						}),
					},
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '🖼️ بحث صور جاهزة',
							id: `${p}صور ${(opts.prompt || 'nature').slice(0, 60)}`,
						}),
					},
					{
						name: 'quick_reply',
						buttonParamsJson: JSON.stringify({
							display_text: '📖 الاستوديو',
							id: `${p}توليد`,
						}),
					},
				],
			},
			m,
			errBody
		);
	}
};

handler.help = [
	'ارسم <الوصف> (توليد صورة AI)',
	'فيديو_ai <الوصف> (توليد فيديو AI)',
	'انطق <النص> (توليد صوت AI)',
	'موسيقى_ai <الوصف> (توليد موسيقى AI)',
	'توليد <صورة|فيديو|صوت|موسيقى|جدول> <الوصف>',
];
handler.tags = ['ai', 'tools'];
handler.command = /^(imagine|aiimg|genimg|تخيل|ارسم|توليد_صورة|صورة_ai|رسم_ai|aivideo|genvideo|vidai|فيديو_ai|توليد_فيديو|انيميشن|مقطع_ai|tts|say|aiaudio|aivoice|صوت_ai|انطق|تكلم|توليد_صوت|aimusic|genmusic|موسيقى_ai|موسيقي_ai|توليد_موسيقى|لحن_ai|ai_media|aimedia|توليد|gen|create|اصنع)$/i;

export default handler;
