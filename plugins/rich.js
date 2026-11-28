import { delay } from 'baileys';
import { AIRich } from '../lib/AIRich.js';

const RANDOM_IDEAS = [
	{
		title: 'القاهرة المستقبلية النيون',
		category: 'صورة AI (Flux)',
		cmd: '.ارسم -m flux -a 16:9 أفق مدينة القاهرة المستقبلية ليلاً بأضواء نيون ومطر سينمائي',
		hint: 'خلفية عرضية فائقة الجودة بمحرك Flux',
	},
	{
		title: 'أسد ملكي فوق الأهرامات',
		category: 'صورة AI (Horde)',
		cmd: '.ارسم -m horde -a 1:1 أسد ملكي ذهبي يقف بشموخ فوق قمة أهرامات الجيزة وقت الغروب',
		hint: 'صورة مربعة ممتازة للملف الشخصي',
	},
	{
		title: 'رائد فضاء والمجرة المتوهجة',
		category: 'صورة AI (ستوري)',
		cmd: '.ارسم -m flux -a 9:16 رائد فضاء يقف على سطح كوكب بعيد ينظر إلى مجرة متوهجة',
		hint: 'مقاس ستوري 9:16 لخلفيات الهاتف',
	},
	{
		title: 'أمواج المحيط السينمائية',
		category: 'فيديو AI (LTX)',
		cmd: '.فيديو_ai أمواج المحيط الزرقاء تتلاطم مع الصخور وقت الغروب بأسلوب سينمائي 4k',
		hint: 'توليد فيديو بحركة واقعية',
	},
	{
		title: 'قافلة الصحراء مع التعليق الصوتي',
		category: 'فيديو AI (--tts)',
		cmd: '.فيديو_ai --tts صحراء ذهبية ساحرة وجمال تسير بهدوء وقت شروق الشمس في الصباح',
		hint: 'فيديو متحرك مع نطق الوصف كتعليق صوتي مدمج',
	},
	{
		title: 'خلفيات طبيعة خيالية',
		category: 'بحث صور (Pinterest)',
		cmd: '.صور pinterest 4 خلفيات طبيعة خيالية شلالات وجبال عالية الدقة',
		hint: '4 صور منتقاة ومفحوصة الجودة',
	},
	{
		title: 'خلفيات سايبربانك 4K',
		category: 'بحث صور (Wallhaven)',
		cmd: '.صور wallhaven 4 cyberpunk neon city aesthetic 4k wallpaper',
		hint: 'خلفيات شاشات كمبيوتر بدقة 4K',
	},
	{
		title: 'سدم ومجرات عميقة',
		category: 'بحث صور (NASA)',
		cmd: '.صور nasa 3 deep space nebula james webb telescope',
		hint: 'تصوير فلكي حقيقي من تلسكوب جيمس ويب',
	},
	{
		title: 'لحن عود شرقي أصيل',
		category: 'موسيقى AI (شرقي)',
		cmd: '.موسيقى_ai موسيقى عود شرقية أصيلة هادئة ومريحة للأعصاب -d 15',
		hint: 'مقطوعة شرقية 15 ثانية بالعود والمقام',
	},
	{
		title: 'موسيقى لوفي للتركيز',
		category: 'موسيقى AI (Lo-Fi)',
		cmd: '.موسيقى_ai lofi chill beats for study and concentration -d 15',
		hint: 'إيقاع لوفي هادئ مع كوردات دافئة',
	},
	{
		title: 'مقطوعة سينمائية ملحمية',
		category: 'موسيقى AI (Epic)',
		cmd: '.موسيقى_ai epic orchestral cinematic battle soundtrack -d 15',
		hint: 'إيقاع أوركسترا ملحمي حماسي',
	},
	{
		title: 'نطق ترحيبي احترافي',
		category: 'صوت AI (TTS)',
		cmd: '.انطق أهلاً بكم في البوت الذكي الأقوى على واتساب',
		hint: 'تعليق صوتي عربي نقي ومفهوم',
	},
];

function pickRandomIdea() {
	return RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)];
}

async function sendInteractiveCard(conn, jid, payload, quoted, fallbackText) {
	if (typeof conn?.sendButton === 'function') {
		try {
			return await conn.sendButton(jid, payload, { quoted });
		} catch {}
	}
	return conn.sendMessage(jid, { text: fallbackText || payload?.body || '' }, { quoted });
}

function buildComposerSelectMenu(p) {
	return {
		name: 'single_select',
		buttonParamsJson: JSON.stringify({
			title: '⚡ اختر قالباً جاهزاً من الصانع',
			sections: [
				{
					title: '🖼️ قوالب توليد الصور (AI Image)',
					highlight_label: 'مجاني',
					rows: [
						{
							header: 'FLUX 16:9',
							title: 'خلفية سينمائية عريضة (Flux)',
							description: 'مقاس 16:9 للشاشات والحواسيب',
							id: `${p}rich ارسم -m flux -a 16:9 أفق مدينة القاهرة المستقبلية بأضواء نيون ومطر`,
						},
						{
							header: 'HORDE 1:1',
							title: 'صورة مربعة مستقرة (AI Horde)',
							description: 'مقاس 1:1 للبروفايل ومتاح دائماً',
							id: `${p}rich ارسم -m horde -a 1:1 أسد ملكي فوق قمة أهرامات الجيزة`,
						},
						{
							header: 'STORY 9:16',
							title: 'خلفية ستوري طولية 9:16',
							description: 'مثالية لشاشات الهواتف والحالات',
							id: `${p}rich ارسم -m flux -a 9:16 رائد فضاء يقف أمام مجرة متوهجة`,
						},
						{
							header: 'Z-IMAGE',
							title: 'توليد سريع تفصيلي (Z-Image)',
							description: 'محرك سريع للأعمال الفنية',
							id: `${p}rich ارسم -m zimage قلعة خيالية محاطة بالغيوم`,
						},
					],
				},
				{
					title: '🎬 قوالب فيديو الذكاء الاصطناعي (AI Video)',
					rows: [
						{
							header: 'CINEMA',
							title: 'فيديو طبيعة سينمائي LTX',
							description: 'حركة واقعية للأمواج والمناظر',
							id: `${p}rich فيديو أمواج المحيط وقت الغروب بأسلوب سينمائي`,
						},
						{
							header: 'WITH TTS',
							title: 'فيديو مع تعليق صوتي (--tts)',
							description: 'صورة AI متحركة مع نطق الوصف صوتياً',
							id: `${p}rich فيديو --tts صحراء ذهبية وجمال تسير وقت الشروق`,
						},
					],
				},
				{
					title: '🔍 قوالب بحث الصور (14 موقعاً)',
					rows: [
						{
							header: 'PINTEREST',
							title: 'خلفيات وفنون راقية (Pinterest)',
							description: '4 صور منتقاة عالية الجمالية',
							id: `${p}rich صور pinterest 4 خلفيات انمي فخمة سوداء`,
						},
						{
							header: 'WALLHAVEN',
							title: 'خلفيات ألعاب وشاشات 4K',
							description: 'Wallhaven بدقة 4K',
							id: `${p}rich صور wallhaven 4 cyberpunk neon aesthetic`,
						},
						{
							header: 'NASA',
							title: 'صور الفضاء والمجرات (NASA)',
							description: 'أرشيف ناسا الفلكي الحقيقي',
							id: `${p}rich صور nasa 3 deep space nebula hubble`,
						},
					],
				},
				{
					title: '🎙️ قوالب الصوت والموسيقى والألحان',
					rows: [
						{
							header: 'AR TTS',
							title: 'نطق تعليق صوتي عربي نقي',
							description: 'Google + SoundOfText',
							id: `${p}rich صوت أهلاً بكم في البوت الذكي الأقوى على واتساب`,
						},
						{
							header: 'EN HOST',
							title: 'مذيع إنجليزي احترافي (StreamElements)',
							description: 'صوت إنجليزي فائق الوضوح',
							id: `${p}rich صوت -l en Welcome to the ultimate WhatsApp AI bot`,
						},
						{
							header: 'ORIENTAL',
							title: 'مقطوعة عود شرقية أصيلة',
							description: 'لحن عود عربي هادئ 15 ثانية',
							id: `${p}rich موسيقى عود شرقي أصيل ومريح للأعصاب -d 15`,
						},
						{
							header: 'LO-FI',
							title: 'موسيقى لوفي للدراسة والتركيز',
							description: 'إيقاع هادئ مع كوردات دافئة',
							id: `${p}rich موسيقى lofi chill study beats -d 15`,
						},
					],
				},
				{
					title: '🎲 أفكار وتجارب عشوائية',
					rows: [
						{
							header: 'RANDOM',
							title: 'تركيب فكرة إبداعية عشوائية',
							description: 'يولد لك فكرة عشوائية مجهزة للنسخ والتنفيذ',
							id: `${p}rich عشوائي`,
						},
						{
							header: 'DEMO',
							title: 'جولة AIRich الحية (Live MessageBuilder)',
							description: 'عرض البناء التفاعلي المباشر للرسائل',
							id: `${p}rich demo`,
						},
					],
				},
			],
		}),
	};
}

async function runLiveTourDemo(m, conn) {
	const rich = new AIRich(conn)
		.setTitle('⚡ جولة MessageBuilder & AIRich الحية')
		.addText(
			'مرحباً بك في جولة AIRich التفاعلية المباشرة! 🚀\nيتم بناء وتعديل هذا المحتوى حياً في نفس الرسالة.',
			{ id: 'intro' }
		)
		.setFooter('مدعوم بمكتبة AIRich • Yono Multi-Device');

	await rich.send(m.chat);
	await delay(1200);

	rich.addText('✨ المرحلة الأولى: إضافة اقتراحات سريعة للمستخدم...', { insertAt: 'intro', id: 'step1' });
	rich.addSuggest(['.rich', '.ارسم قطة في الفضاء', '.موسيقى_ai عود شرقي']);
	await rich.sendEdit();
	await delay(1500);

	rich.addText('📊 المرحلة الثانية: عرض جدول مقارنة المحركات المجانية...', { insertAt: 'step1', id: 'step2' });
	rich.addTable(
		[
			['المحرك', 'النوع', 'الاستقرار'],
			['Flux Schnell', 'صور 16:9 / 9:16', 'ممتاز'],
			['AI Horde', 'صور 512x512', '100% مستقر'],
			['LTX-Video', 'فيديو سينمائي', 'سريع'],
		],
		{ insertAt: 'step2', id: 'table_demo' }
	);
	await rich.sendEdit();
	await delay(1800);

	rich.addTip('💡 انتهت الجولة بنجاح! اكتب `.rich` لفتح صانع الأوامر الشامل في أي وقت.');
	await rich.sendEdit();
}

const handler = async (m, { conn, text, usedPrefix }) => {
	const p = usedPrefix || '.';
	const trimmed = String(text || '').trim();

	// 1. Live tour demo mode
	if (/^(demo|جولة|tour|test)$/i.test(trimmed)) {
		return runLiveTourDemo(m, conn);
	}

	// 2. Random Idea Composer
	if (/^(random|عشوائي|فكره|فكرة)$/i.test(trimmed)) {
		const pick = pickRandomIdea();
		const ornateMsg = [
			'╭───┈「 🎲 فـكـرة أمـر إبـداعـيـة مـن الـصـانـع 」┈───╮',
			'│',
			`│ 🏷️ الـعـنـوان: ${pick.title}`,
			`│ 📂 الـقـسـم: ${pick.category}`,
			`│ 💡 الـمـيـزة: ${pick.hint}`,
			'│',
			'│ 📋 الأمـر الـجـاهـز لـلـنـسـخ والـتـشـغـيـل:',
			`│ \`${pick.cmd}\``,
			'│',
			'╰───────────────────────────╯',
			'> ⚡ اضغط على زر "نسخ الأمر الجاهز" أو نفّذه مباشرة بالزر أدناه!',
		].join('\n');

		const buttons = [
			{
				name: 'cta_copy',
				buttonParamsJson: JSON.stringify({
					display_text: '📋 نسخ الأمر الجاهز',
					copy_code: pick.cmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '⚡ تنفيذ الأمر فوراً',
					id: pick.cmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🎲 فكرة أخرى',
					id: `${p}rich عشوائي`,
				}),
			},
			buildComposerSelectMenu(p),
		];

		try {
			if (typeof conn?.relayMessage === 'function') {
				await new AIRich(conn)
					.setTitle('🎲 فكرة إبداعية جاهزة • AIRich')
					.addText(ornateMsg)
					.addSuggest([pick.cmd, `${p}rich عشوائي`, `${p}rich`])
					.addTip('اضغط زر النسخ المرفق لأخذ الأمر مباشرة إلى الحافظة.')
					.send(m.chat, { quoted: m });
			}
		} catch {}

		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '🎲 فكرة أمر إبداعية جاهزة',
				subtitle: pick.title,
				body: ornateMsg,
				footer: 'صانع الأوامر الذكي • اضغط لنسخ الأمر',
				buttons,
			},
			m,
			ornateMsg
		);
	}

	// 3. Sub-Category: Image Command Maker (.rich ارسم / .rich صورة / .rich image)
	const imgMatch = trimmed.match(/^(?:ارسم|صورة|صوره|image|imagine)\s*(.*)$/i);
	if (imgMatch) {
		const rawPrompt = imgMatch[1].trim() || 'أسد يطير فوق أهرامات الجيزة وقت الغروب';
		const formattedCmd = `${p}ارسم -m flux -a 16:9 ${rawPrompt}`;
		const squareCmd = `${p}ارسم -m horde -a 1:1 ${rawPrompt}`;
		const storyCmd = `${p}ارسم -a 9:16 ${rawPrompt}`;

		const ornateMsg = [
			'╭───┈「 🎨 صـانـع أمـر الـصـور (AI Image) 」┈───╮',
			'│',
			'│ 📝 الأمـر الـمـركّـب الـجـاهـز لـلـنـسـخ:',
			`│ \`${formattedCmd}\``,
			'│',
			'│ ⚙️ الـمـواصـفـات الـمـطـبـقـة:',
			'│ ⌑ الـمـحـرك: Flux Schnell (عالي الدقة ومجاني)',
			'│ ⌑ الأبـعـاد: 16:9 عريض سينمائي للشاشات',
			'│ ⌑ الـتـرجـمـة: تلقائية من العربية إلى الإنجليزية',
			'│',
			'│ 🔄 قـوالـب بـديـلـة سـريـعـة:',
			`│ ⌑ مـربـع (1:1): \`${squareCmd}\``,
			`│ ⌑ سـتـوري (9:16): \`${storyCmd}\``,
			'│',
			'╰───────────────────────────╯',
			'> 📋 اضغط زر "نسخ الأمر الجاهز" أو نفّذ الأمر مباشرة بالأزرار أدناه!',
		].join('\n');

		const buttons = [
			{
				name: 'cta_copy',
				buttonParamsJson: JSON.stringify({
					display_text: '📋 نسخ الأمر الجاهز',
					copy_code: formattedCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '⚡ تنفيذ (16:9)',
					id: formattedCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '📱 ستوري (9:16)',
					id: storyCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🎬 تحويله لفيديو',
					id: `${p}فيديو_ai ${rawPrompt}`,
				}),
			},
			buildComposerSelectMenu(p),
		];

		try {
			if (typeof conn?.relayMessage === 'function') {
				await new AIRich(conn)
					.setTitle('🎨 صانع أمر الصور • AIRich')
					.addText(ornateMsg)
					.addSuggest([formattedCmd, squareCmd, storyCmd])
					.send(m.chat, { quoted: m });
			}
		} catch {}

		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '🎨 صانع أمر الصور الذكي',
				subtitle: 'قالب توليد صورة AI مجهز',
				body: ornateMsg,
				footer: 'اضغط على زر النسخ لاستخدام الأمر فوراً',
				buttons,
			},
			m,
			ornateMsg
		);
	}

	// 4. Sub-Category: Video Command Maker (.rich فيديو / .rich video)
	const vidMatch = trimmed.match(/^(?:فيديو|فديو|فيديو_ai|video|aivideo)\s*(.*)$/i);
	if (vidMatch) {
		const rawPrompt = vidMatch[1].trim() || 'أمواج المحيط وقت الغروب بأسلوب سينمائي';
		const formattedCmd = `${p}فيديو_ai --tts ${rawPrompt}`;
		const silentCmd = `${p}فيديو_ai ${rawPrompt}`;

		const ornateMsg = [
			'╭───┈「 🎬 صـانـع أمـر الـفـيـديـو (AI Video) 」┈───╮',
			'│',
			'│ 📝 الأمـر الـمـركّـب الـجـاهـز لـلـنـسـخ:',
			`│ \`${formattedCmd}\``,
			'│',
			'│ ⚙️ الـمـواصـفـات الـمـطـبـقـة:',
			'│ ⌑ الـحـركـة: LTX-Video سينمائية + تحريك بديل سريع',
			'│ ⌑ الـتـعـلـيـق: تم تفعيل النطق الصوتي المرافق (--tts)',
			'│ ⌑ الـجـودة: عالية الدقة بصيغة MP4 مباشرة لواتساب',
			'│',
			'│ 🔄 بـدون صـوت:',
			`│ ⌑ صـامـت: \`${silentCmd}\``,
			'│',
			'╰───────────────────────────╯',
			'> 📋 اضغط زر "نسخ الأمر الجاهز" أو نفّذ بالأزرار التفاعلية أدناه!',
		].join('\n');

		const buttons = [
			{
				name: 'cta_copy',
				buttonParamsJson: JSON.stringify({
					display_text: '📋 نسخ أمر الفيديو الجاهز',
					copy_code: formattedCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🎬 تنفيذ مع تعليق صوتي',
					id: formattedCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🔇 تنفيذ صامت',
					id: silentCmd,
				}),
			},
			buildComposerSelectMenu(p),
		];

		try {
			if (typeof conn?.relayMessage === 'function') {
				await new AIRich(conn)
					.setTitle('🎬 صانع أمر الفيديو • AIRich')
					.addText(ornateMsg)
					.addSuggest([formattedCmd, silentCmd])
					.send(m.chat, { quoted: m });
			}
		} catch {}

		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '🎬 صانع أمر الفيديو الذكي',
				subtitle: 'قالب توليد فيديو AI مع صوت',
				body: ornateMsg,
				footer: 'اضغط على زر النسخ لاستخدام الأمر',
				buttons,
			},
			m,
			ornateMsg
		);
	}

	// 5. Sub-Category: Search Command Maker (.rich صور / .rich search)
	const searchMatch = trimmed.match(/^(?:صور|صورة|بحث|search|img)\s*(.*)$/i);
	if (searchMatch) {
		const rawQuery = searchMatch[1].trim() || 'خلفيات طبيعة خيالية';
		const pinCmd = `${p}صور pinterest 4 ${rawQuery}`;
		const wallCmd = `${p}صور wallhaven 4 ${rawQuery}`;
		const autoCmd = `${p}صور auto 4 ${rawQuery}`;

		const ornateMsg = [
			'╭───┈「 🔍 صـانـع أمـر بـحـث الـصـور (14 مـوقـعـاً) 」┈───╮',
			'│',
			'│ 📝 الأمـر الـمـركّـب الـجـاهـز لـلـنـسـخ:',
			`│ \`${pinCmd}\``,
			'│',
			'│ 🌐 خـيـارات الـبـحـث الـمـتـاحـة:',
			`│ ⌑ Pinterest (فنون وخلفيات): \`${pinCmd}\``,
			`│ ⌑ Wallhaven (خلفيات 4K): \`${wallCmd}\``,
			`│ ⌑ تـلـقـائـي مـتـنـوع (Auto): \`${autoCmd}\``,
			'│',
			'│ ⚡ مـجـانـي بـدون مـفـاتـيـح مـع فـحـص سـلامـة الـصـور',
			'╰───────────────────────────╯',
			'> 📋 اضغط زر "نسخ الأمر الجاهز" أو ابدأ البحث فوراً بالزر أدناه!',
		].join('\n');

		const buttons = [
			{
				name: 'cta_copy',
				buttonParamsJson: JSON.stringify({
					display_text: '📋 نسخ أمر Pinterest',
					copy_code: pinCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🔍 بحث Pinterest فوراً',
					id: pinCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🌌 بحث Wallhaven 4K',
					id: wallCmd,
				}),
			},
			buildComposerSelectMenu(p),
		];

		try {
			if (typeof conn?.relayMessage === 'function') {
				await new AIRich(conn)
					.setTitle('🔍 صانع أمر بحث الصور • AIRich')
					.addText(ornateMsg)
					.addSuggest([pinCmd, wallCmd, autoCmd])
					.send(m.chat, { quoted: m });
			}
		} catch {}

		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '🔍 صانع أمر بحث الصور',
				subtitle: '14 موقعاً عالمياً متاحاً فوراً',
				body: ornateMsg,
				footer: 'اضغط على زر النسخ لبدء البحث',
				buttons,
			},
			m,
			ornateMsg
		);
	}

	// 6. Sub-Category: Audio & Music Command Maker (.rich صوت / .rich موسيقى)
	const audioMatch = trimmed.match(/^(?:صوت|موسيقى|موسيقي|لحن|audio|music|tts)\s*(.*)$/i);
	if (audioMatch) {
		const rawText = audioMatch[1].trim() || 'موسيقى عود شرقية أصيلة ومريحة للأعصاب';
		const musicCmd = `${p}موسيقى_ai ${rawText} -d 15`;
		const ttsCmd = `${p}انطق مرحباً بكم في البوت الذكي`;

		const ornateMsg = [
			'╭───┈「 🎙️ صـانـع الـصـوت والـمـوسـيـقـى 」┈───╮',
			'│',
			'│ 📝 الأمـر الـمـركّـب الـجـاهـز لـلـنـسـخ:',
			`│ \`${musicCmd}\``,
			'│',
			'│ 🎵 الألـحـان الـمـتـوفـرة (سـنـثـايـزر مـجـانـي):',
			'│ ⌑ عود شرقي (oriental) • لوفي (lofi) • سينمائي (epic)',
			'│',
			'│ 🗣️ الـتـعـلـيـق الـصـوتـي (TTS):',
			`│ ⌑ عـربـي: \`${ttsCmd}\``,
			`│ ⌑ إنـجـلـيـزي: \`${p}tts -m streamelements -l en Welcome to the future\``,
			'│',
			'╰───────────────────────────╯',
			'> 📋 اضغط زر "نسخ الأمر الجاهز" أو نفّذه مباشرة بالأزرار أدناه!',
		].join('\n');

		const buttons = [
			{
				name: 'cta_copy',
				buttonParamsJson: JSON.stringify({
					display_text: '📋 نسخ أمر الموسيقى',
					copy_code: musicCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🎵 تشغيل اللحن فوراً',
					id: musicCmd,
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '🗣️ تجربة نطق عربي',
					id: ttsCmd,
				}),
			},
			buildComposerSelectMenu(p),
		];

		try {
			if (typeof conn?.relayMessage === 'function') {
				await new AIRich(conn)
					.setTitle('🎙️ صانع الصوت والموسيقى • AIRich')
					.addText(ornateMsg)
					.addSuggest([musicCmd, ttsCmd])
					.send(m.chat, { quoted: m });
			}
		} catch {}

		return sendInteractiveCard(
			conn,
			m.chat,
			{
				title: '🎙️ صانع الصوت والموسيقى',
				subtitle: 'توليد نغمات وتعليق صوتي ذكي',
				body: ornateMsg,
				footer: 'اضغط لنسخ الأمر الجاهز',
				buttons,
			},
			m,
			ornateMsg
		);
	}

	// 7. General Hub: Main Command Studio & Maker Dashboard
	const defaultSampleCmd = `${p}ارسم -m flux -a 16:9 أفق مدينة القاهرة المستقبلية ليلاً بأضواء نيون ومطر سينمائي`;

	const ornateHubMsg = [
		'╭───┈「 ⚡ صـانـع الأوامـر الـذكـي (AIRich) 」┈───╮',
		'│',
		'│  🌟 مـرحـبـاً بـك فـي صـانـع الأوامـر الاحـتـرافـي',
		'│  🛠️ ركّب أمرك الجاهز بضغطة زر دون حفظ الاختصارات!',
		'│  ⚡ مـجـانـي 100% • بـدون مـفـاتـيـح • تـرجـمـة فـوريـة',
		'│',
		'├─┈「 🖼️ 1) صـانـع صـور الـذكـاء الاصـطـنـاعـي 」',
		'│ ⌑ الأمـر: `.ارسم <الوصف>` أو `.imagine -m <محرك> -a <مقاس>`',
		'│ ⌑ الـمـحـركـات: `auto` • `flux` (سينمائي) • `horde` (مستقر) • `zimage`',
		'│ ⌑ الأبـعـاد: `1:1` مربع • `16:9` عريض • `9:16` ستوري • `4:3`',
		`│ ⌑ مـثـال: \`${p}ارسم -m flux -a 16:9 صقر ذهبي فوق قمة الجبل\``,
		'│',
		'├─┈「 🎬 2) صـانـع فـيـديـو الـذكـاء الاصـطـنـاعـي 」',
		'│ ⌑ الأمـر: `.فيديو_ai <الوصف>` أو `.aivideo --tts <الوصف>`',
		'│ ⌑ الـتـوجـيـه: حركة سينمائية LTX أو تحريك سريع FFmpeg',
		'│ ⌑ الـتـعـلـيـق: أضف علم `--tts` لنطق الوصف مع الفيديو صوتياً',
		`│ ⌑ مـثـال: \`${p}فيديو_ai --tts أمواج المحيط وقت الغروب\``,
		'│',
		'├─┈「 🔍 3) صـانـع بـحـث الـصـور (14 مـوقـعـاً) 」',
		'│ ⌑ الأمـر: `.صور <الموقع> <العدد> <الكلمة>`',
		'│ ⌑ الـمـواقـع: `pinterest` • `wallhaven` • `unsplash` • `google`...',
		`│ ⌑ مـثـال: \`${p}صور pinterest 4 خلفيات انمي فخمة سوداء\``,
		'│',
		'├─┈「 🎙️ 4) صـانـع الـصـوت والـمـوسـيـقـى 」',
		'│ ⌑ الأمـر: `.انطق <نص>` أو `.موسيقى_ai <نوع> -d 15`',
		'│ ⌑ الأنـمـاط: عود شرقي (oriental) • لوفي (lofi) • سينمائي (epic)',
		`│ ⌑ مـثـال: \`${p}موسيقى_ai عود شرقي هادئ -d 15\``,
		'│',
		'╰───────────────────────────╯',
		'> 💡 *نصيحة:* اضغط على أي زر أدناه أو اختر قالباً من القائمة لنسخه فوراً!',
	].join('\n');

	const summaryTable = [
		['الأداة', 'الخيارات والمحركات', 'الأمر الجاهز'],
		['صور AI', 'Flux / Horde / Z-Image (1:1, 16:9, 9:16)', `${p}ارسم -m flux -a 16:9 <وصف>`],
		['فيديو AI', 'LTX Cinema / FFmpeg / --tts', `${p}فيديو_ai --tts <وصف>`],
		['بحث صور', '14 موقعاً (Pinterest/Wallhaven/NASA)', `${p}صور pinterest 4 <بحث>`],
		['صوت وموسيقى', 'عربي / إنجليزي / عود شرقي / لوفي', `${p}موسيقى_ai عود شرقي -d 15`],
	];

	const buttons = [
		buildComposerSelectMenu(p),
		{
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({
				display_text: '📋 نسخ قالب Flux 16:9',
				copy_code: defaultSampleCmd,
			}),
		},
		{
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: '🎲 فكرة عشوائية',
				id: `${p}rich عشوائي`,
			}),
		},
		{
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: '🖼️ صانع الصور',
				id: `${p}rich ارسم أسد في الفضاء`,
			}),
		},
		{
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: '🎬 صانع الفيديو',
				id: `${p}rich فيديو أمواج المحيط`,
			}),
		},
	];

	try {
		if (typeof conn?.relayMessage === 'function') {
			await new AIRich(conn)
				.setTitle('⚡ صانع الأوامر الذكي • AIRich Studio')
				.addText(ornateHubMsg)
				.addTable(summaryTable)
				.addSuggest([
					defaultSampleCmd,
					`${p}فيديو_ai --tts أمواج المحيط وقت الغروب`,
					`${p}صور pinterest 4 خلفيات سوداء`,
					`${p}موسيقى_ai عود شرقي هادئ -d 15`,
					`${p}rich عشوائي`,
				])
				.addTip('اضغط على أي زر تفاعلي لنسخ الأمر الجاهز إلى الحافظة أو تشغيله فوراً.')
				.send(m.chat, { quoted: m });
		}
	} catch {}

	return sendInteractiveCard(
		conn,
		m.chat,
		{
			title: '⚡ صانع الأوامر الذكي (AIRich Studio)',
			subtitle: 'تركيب وتجهيز أوامر الذكاء الاصطناعي وبحث الصور',
			body: ornateHubMsg,
			footer: 'اختر قالباً من القائمة أو انسخ الأمر بضغطة زر',
			buttons,
		},
		m,
		ornateHubMsg
	);
};

handler.command = [
	'rich',
	'airich',
	'صانع',
	'صانع_الاوامر',
	'صانع_الأوامر',
	'صنع',
	'composer',
	'maker',
];
handler.help = ['rich', 'صانع [ارسم|فيديو|صور|صوت|عشوائي]'];
handler.tags = ['tools', 'ai'];

export default handler;