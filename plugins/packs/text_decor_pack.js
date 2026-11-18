/**
 * plugins/packs/text_decor_pack.js — حزمة الزخرفة والخطوط والبايو والفواصل (150+ أمر)
 */
import { formatCard, sendInteractiveCard, makeCopyButton, makeQuickButton } from '../../system/interactiveUI.js';

const handlers = [];
const add = (cmd, desc, fn, usage) => {
  const triggers = Array.isArray(cmd) ? cmd : [cmd];
  const h = async (m, ctx) => {
    try { await fn(m, ctx); }
    catch (e) { await m.reply('❌ ' + (e?.message || e)); }
  };
  h.command = triggers;
  h.usage = usage || [triggers[0]];
  h.description = desc;
  h.category = 'logos';
  h.usePrefix = true;
  handlers.push(h);
};

// Unicode font mapper for Latin text + Arabic ornamentation wrappers
function mapAlpha(text, upperStart, lowerStart, digitsStart = null) {
  return [...String(text)].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(upperStart + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(lowerStart + (code - 97));
    if (digitsStart !== null && code >= 48 && code <= 57) return String.fromCodePoint(digitsStart + (code - 48));
    return ch;
  }).join('');
}

const FONT_STYLES = [
  ['خط_عريض', 'خط عريض (Bold)', (t) => mapAlpha(t, 0x1D400, 0x1D41A, 0x1D7CE)],
  ['خط_مائل', 'خط مائل (Italic)', (t) => mapAlpha(t, 0x1D434, 0x1D44E)],
  ['خط_مزدوج', 'خط مزدوج (Double-Struck)', (t) => mapAlpha(t, 0x1D538, 0x1D552, 0x1D7D8)],
  ['خط_فخم', 'خط فرينكتور (Fraktur)', (t) => mapAlpha(t, 0x1D56C, 0x1D586)],
  ['خط_سنس', 'خط Sans Bold', (t) => mapAlpha(t, 0x1D5D4, 0x1D5EE, 0x1D7EC)],
  ['خط_مونو', 'خط Monospace', (t) => mapAlpha(t, 0x1D670, 0x1D68A, 0x1D7F6)],
  ['خط_فقاعات', 'خط فقاعات (Bubbles)', (t) => mapAlpha(t, 0x24B6, 0x24D0)],
  ['خط_مربعات', 'خط مربعات (Squared)', (t) => mapAlpha(t, 0x1F130, 0x1F130)],
  ['خط_مربعات_مملوءة', 'مربعات سوداء', (t) => mapAlpha(t, 0x1F170, 0x1F170)],
  ['خط_سكريبت', 'خط يدوي Script', (t) => mapAlpha(t, 0x1D4D0, 0x1D4EA)],
  ['خط_صغير', 'أحرف صغيرة علوية', (t) => [...t].map((c) => ({ a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' }[c.toLowerCase()] || c)).join('')],
  ['خط_مقلوب', 'نص مقلوب رأساً على عقب', (t) => [...t].reverse().map((c) => ({ a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z' }[c.toLowerCase()] || c)).join('')],
  ['خط_مشرط', 'نص مشطوب (Strikethrough)', (t) => [...t].map((c) => c + '\u0336').join('')],
  ['خط_تحته', 'نص مسطّر (Underline)', (t) => [...t].map((c) => c + '\u0332').join('')],
  ['خط_موجي', 'نص مزين بموجات', (t) => `〰️ ${t} 〰️`]
];

for (const [cmd, desc, fn] of FONT_STYLES) {
  add(cmd, desc, async (m, ctx) => {
    const raw = (ctx.text && ctx.text.trim()) || 'Light Bot';
    const out = fn(raw);
    await sendInteractiveCard(m, ctx, {
      title: desc,
      badge: '✒️',
      body: out,
      theme: 'royal',
      buttons: [makeCopyButton('📋 نسخ النص المزخرف', out)]
    });
  }, [`${cmd} <نص>`]);
}

// 35 Arabic + Symbol Ornamental Styles: زخرفة1 .. زخرفة35
const WRAPPERS = [
  ['꧁༒☬ ', ' ☬༒꧂'],
  ['『★』', '『★』'],
  ['༺🌸༻ ', ' ༺🌸༻'],
  ['⚡═━ ', ' ━═⚡'],
  ['👑 ┇ ', ' ┇ 👑'],
  ['🩸 ⟞ ', ' ⟝ 🩸'],
  ['✦ ━━ ', ' ━━ ✦'],
  ['❖ ══ ', ' ══ ❖'],
  ['★彡 ', ' 彡★'],
  ['☾ ✧ ', ' ✧ ☽'],
  ['⚔️ ⟦ ', ' ⟧ ⚔️'],
  ['🔥 ╾ ', ' ╼ 🔥'],
  ['❄️ ✧ ', ' ✧ ❄️'],
  ['💎 ◈ ', ' ◈ 💎'],
  ['🦋 ✿ ', ' ✿ 🦋'],
  ['🌙 ۞ ', ' ۞ 🌙'],
  ['🔱 「 ', ' 」 🔱'],
  ['🏆 『 ', ' 』 🏆'],
  ['🎯 ⦇ ', ' ⦈ 🎯'],
  ['🖤 ︵‿ ', ' ‿︵ 🖤'],
  ['✨ ═══ ', ' ═══ ✨'],
  ['🌹 ╰─ ', ' ─╯ 🌹'],
  ['🐉 ༺ ', ' ༻ 🐉'],
  ['🎭 《 ', ' 》 🎭'],
  ['⚜️ ━━ ', ' ━━ ⚜️'],
  ['🌊 ≈≈ ', ' ≈≈ 🌊'],
  ['⭐ ✦ ', ' ✦ ⭐'],
  ['🧿 ◈ ', ' ◈ 🧿'],
  ['💠 ══ ', ' ══ 💠'],
  ['☄️ ━ ', ' ━ ☄️'],
  ['🏹 ↣ ', ' ↢ 🏹'],
  ['🧩 ╭ ', ' ╮ 🧩'],
  ['🛡️ ╠ ', ' ╣ 🛡️'],
  ['🎵 ♪ ', ' ♪ 🎵'],
  ['☄️ ꧁ ', ' ꧂ ☄️']
];

for (let i = 0; i < WRAPPERS.length; i++) {
  const [L, R] = WRAPPERS[i];
  const n = i + 1;
  add(`زخرفة${n}`, `زخرفة نص جاهزة رقم ${n}`, async (m, ctx) => {
    const raw = (ctx.text && ctx.text.trim()) || 'لايت بوت';
    const stretched = raw.split('').join('ـ').replace(/ـ\sـ/g, ' ');
    const out = `${L}${n % 2 === 0 ? stretched : raw}${R}`;
    const next = `زخرفة${(n % WRAPPERS.length) + 1}`;
    await sendInteractiveCard(m, ctx, {
      title: `زخرفة رقم ${n}`,
      badge: '✨',
      body: out,
      theme: 'royal',
      buttons: [
        makeCopyButton('📋 نسخ الزخرفة', out),
        makeQuickButton(`🎨 جرب ${next}`, `${next} ${raw}`, ctx.usedPrefix || '.')
      ]
    });
  }, [`زخرفة${n} <اسم>`]);
}

// 15 Bio templates: بايو1 .. بايو15
const BIOS = [
  (n) => `✨ ${n}\n🎯 أصنع طريقي بنفسي\n📍 لا وقت للتردد`,
  (n) => `👑 ${n}\n⚡ الهدوء قوة لا يفهمها الجميع\n🖤 2026`,
  (n) => `🌿 ${n}\n🤲 اللهم ارزقنا الرضا والتوفيق\n📖 القرآن ربيع قلبي`,
  (n) => `💻 ${n}\n⚙️ Developer • Builder • Dreamer\n🚀 Always learning`,
  (n) => `🔥 ${n}\n🦁 لا أعود للخلف أبداً\n🏆 القادم أجمل`,
  (n) => `🌙 ${n}\n☕ قهوة وموسيقى هادئة\n📚 في عالمي الخاص`,
  (n) => `🎨 ${n}\n✨ أبحث عن الجمال في التفاصيل\n🦋`,
  (n) => `⚔️ ${n}\n🩸 لا مجال للصدفة — كل شيء بالعمل\n💎`,
  (n) => `🌊 ${n}\n🧭 مسافر نحو القمة\n⏳ الصبر مفتاح الفرج`,
  (n) => `🎮 ${n}\n🕹️ Gamer • Competitive\n🥇 GG WP`,
  (n) => `📸 ${n}\n🎞️ توثيق اللحظات الجميلة\n🌍`,
  (n) => `💎 ${n}\n🌟 نادر كالألماس، ثابت كالجبل`,
  (n) => `🕊️ ${n}\n🤍 سلام داخلي أهم من كل ضجيج`,
  (n) => `🚀 ${n}\n💡 أفكار كبيرة وخطوات ثابتة`,
  (n) => `🛡️ ${n}\n🤝 الوفاء مبدأ لا يتغير`
];
for (let i = 0; i < BIOS.length; i++) {
  const n = i + 1;
  add(`بايو${n}`, `تصميم بايو احترافي رقم ${n}`, async (m, ctx) => {
    const name = (ctx.text && ctx.text.trim()) || 'لايت';
    const out = BIOS[i](name);
    await sendInteractiveCard(m, ctx, {
      title: `بايو جاهز #${n}`,
      badge: '📝',
      body: out,
      theme: 'royal',
      buttons: [
        makeCopyButton('📋 نسخ البايو', out),
        makeQuickButton('➡️ بايو آخر', `بايو${(n % BIOS.length) + 1} ${name}`, ctx.usedPrefix || '.')
      ]
    });
  }, [`بايو${n} <الاسم>`]);
}

// 10 Frames + 5 Dividers
const FRAMES = [
  ['╭─━━━━━━─╮\n┃  {T}  ┃\n╰─━━━━━━─╯'],
  ['╔═══════╗\n║ {T} ║\n╚═══════╝'],
  ['┏━━━ 👑 ━━━┓\n   {T}\n┗━━━ 👑 ━━━┛'],
  ['╭─┈┄─⟞🩸⟝─┈┄─╮\n  {T}\n╰─┈┄─⟞🩸⟝─┈┄─╯'],
  ['◈ ━━━━━━━ ◈\n   {T}\n◈ ━━━━━━━ ◈'],
  ['┌── ✦ ──┐\n  {T}\n└── ✦ ──┘'],
  ['【★】 {T} 【★】'],
  ['▀▄▀▄ {T} ▄▀▄▀'],
  ['░▒▓ {T} ▓▒░'],
  ['╰─▸ {T} ◂─╯']
];
for (let i = 0; i < FRAMES.length; i++) {
  const n = i + 1;
  add(`اطار${n}`, `تزيين النص داخل إطار فخم رقم ${n}`, async (m, ctx) => {
    const t = (ctx.text && ctx.text.trim()) || 'LIGHT BOT';
    const out = FRAMES[i][0].replace('{T}', t);
    await sendInteractiveCard(m, ctx, { title: `إطار #${n}`, badge: '🖼️', body: out, theme: 'royal', buttons: [makeCopyButton('📋 نسخ الإطار', out)] });
  });
}
const DIVIDERS = [
  '❐═━━━═╊⊰🩸⊱╉═━━━═❐',
  '╔═━━━═╊⊰👑⊱╉═━━━═╗',
  '◈═━━━═╊⊰✨⊱╉═━━━═◈',
  '•┈┈┈••✦✿✦••┈┈┈•',
  '━━━━━━━༺༻━━━━━━━'
];
for (let i = 0; i < DIVIDERS.length; i++) {
  const n = i + 1;
  add(`فاصل${n}`, `فاصل نصي جاهز رقم ${n}`, async (m, ctx) => {
    const d = DIVIDERS[i];
    await sendInteractiveCard(m, ctx, { title: `فاصل #${n}`, badge: '➖', body: d, buttons: [makeCopyButton('📋 نسخ الفاصل', d)] });
  });
}

// 40 Text Effects & Ready Social Copy Templates
const EFFECTS = [
  ['تمديد_كلام', 'مد الكلمات العربية', (t) => t.replace(/([بتثجحخدذرزسشصضطظعغفقكلمنهوي])/g, '$1ـ').replace(/ـ$/g, '')],
  ['تباعد_حروف', 'تباعد بين الحروف', (t) => [...t].join(' ')],
  ['قلوب_نص', 'إضافة قلوب بين الكلمات', (t) => t.split(/\s+/).join(' ❤️ ')],
  ['نجوم_نص', 'إضافة نجوم حول النص', (t) => `✨ ${t.split(/\s+/).join(' ⭐ ')} ✨`],
  ['ايموجي_نص', 'تنسيق النص بإيموجي ناري', (t) => `🔥 ${t} 🔥`],
  ['حرف_بسطر', 'كل حرف في سطر عمودي', (t) => [...t.replace(/\s+/g, '')].join('\n')],
  ['هرم_نصي', 'تشكيل هرم من الكلمة', (t) => [...Array(Math.min(12, t.length))].map((_, i) => t.slice(0, i + 1)).join('\n')],
  ['مراة_نص', 'النص ومعكوسه معاً', (t) => `${t} | ${[...t].reverse().join('')}`],
  ['ازالة_تشكيل', 'تنظيف النص من الحركات والتشكيل', (t) => t.replace(/[\u064B-\u065F\u0670]/g, '')],
  ['تشكيل_تجميلي', 'إضافة لمسة زخرفية للكلمات', (t) => `༺ ${t} ༻`]
];
for (const [cmd, desc, fn] of EFFECTS) {
  add(cmd, desc, async (m, ctx) => {
    const out = fn((ctx.text && ctx.text.trim()) || 'لايت');
    await sendInteractiveCard(m, ctx, { title: desc, badge: '🪄', body: out, theme: 'royal', buttons: [makeCopyButton('📋 نسخ', out)] });
  });
}

const TEMPLATES = [
  ['توقيع_فخم', 'توقيع جاهز لرسائلك', (n) => `— مع أطيب التحيات، *${n}* 🩸`],
  ['لقب_فخم', 'توليد لقب مزخرف', (n) => `👑 الأسطورة ┇ ${n} ┇ ⚡`],
  ['اسم_كلان', 'تنسيق اسم كلان أو فريق', (n) => `⚔️ 『 ${n.toUpperCase()} 』 CLAN ⚔️`],
  ['بايو_واتس', 'بايو واتساب مختصر', (n) => `✨ ${n} | لا تستسلم قبل أن تصل`],
  ['بايو_انستا', 'بايو إنستغرام مرتب', (n) => `📍 ${n}\n🎨 صانع محتوى\n📩 تواصل بالرسائل`],
  ['بايو_تيكتوك', 'بايو تيك توك جذاب', (n) => `🎬 ${n} • محتوى يومي جديد 🔥`],
  ['حالة_فخمة', 'عبارة حالة واتساب فخمة', () => 'النجاح لا يحتاج ضجيجاً، الإنجاز يتحدث عن نفسه.'],
  ['حالة_تحفيز', 'حالة تحفيزية قصيرة', () => 'كل يوم جديد فرصة لتكون أقوى مما كنت عليه بالأمس 🚀'],
  ['حالة_دينية', 'حالة دينية هادئة', () => 'اللهم اجعل القادم من حياتنا خيراً مما مضى 🌿'],
  ['حالة_حزينة', 'حالة أدبية هادئة', () => 'بعض المشاعر تُفهم بالصمت أكثر مما تُحكى بالكلمات.'],
  ['تهنئة_عيد', 'رسالة تهنئة بالعيد', (n) => `🎉 كل عام وأنتم بخير وعيدكم مبارك! — ${n}`],
  ['تهنئة_رمضان', 'رسالة تهنئة برمضان', (n) => `🌙 مبارك عليكم شهر رمضان وتقبل الله طاعتكم — ${n}`],
  ['تهنئة_نجاح', 'رسالة تهنئة بالنجاح', (n) => `🎓 ألف مبروك النجاح والتفوق، ومنها للأعلى دائماً! — ${n}`],
  ['تهنئة_زواج', 'رسالة تهنئة بالزواج', () => '💍 بارك الله لكما وبارك عليكما وجمع بينكما في خير!'],
  ['تهنئة_ميلاد', 'رسالة عيد ميلاد سعيد', (n) => `🎂 عام سعيد ومليء بالإنجازات والفرح يا ${n}!`],
  ['دعوة_فرح', 'نموذج دعوة مناسبة سعيدة', (n) => `💌 نتشرف بدعوتكم لحضور حفلنا السعيد — ${n}`],
  ['رسالة_شكر', 'رسالة شكر راقية', () => '🙏 شكراً من القلب على دعمك وتعاونك الدائم، أقدّر ذلك كثيراً.'],
  ['رسالة_اعتذار', 'رسالة اعتذار مهذبة', () => '🤍 أعتذر عن أي تقصير غير مقصود، ولكم مني كل الاحترام.'],
  ['رسالة_ترحيب', 'رسالة ترحيب بالضيوف', (n) => `🌹 أهلاً وسهلاً بكم في ${n}، نورتونا!`],
  ['اعلان_متجر', 'قالب إعلان متجر جذاب', (n) => `🛍️ عرض خاص في *${n}*!\n🔥 خصومات حصرية لفترة محدودة\n📩 اطلب الآن`],
  ['كود_خصم_نموذج', 'نموذج إعلان كود خصم', () => '🎟️ استخدم كود: *LIGHT20* للحصول على خصم 20% الآن!'],
  ['سيرة_مصغرة', 'نبذة تعريفية احترافية', (n) => `👤 ${n}\n💼 متخصص في الحلول الرقمية وإدارة المشاريع`],
  ['منشور_تسويقي', 'قالب منشور تسويقي', () => '🚀 حلول ذكية توفر وقتك وتضاعف نتائجك — ابدأ اليوم!'],
  ['تغريدة_فخمة', 'نموذج تغريدة ملهمة', () => 'البساطة في التنفيذ والوضوح في الهدف هما سر كل مشروع ناجح.'],
  ['وصف_قناة', 'وصف جاهز لقناة واتساب', (n) => `📢 قناة *${n}* الرسمية\n⚡ أخبار • أدوات • محتوى حصري يومياً`],
  ['وصف_جروب', 'وصف جاهز لمجموعة', (n) => `🛡️ أهلاً بكم في مجموعة *${n}*\n✨ هدفنا الفائدة والتعاون باحترام متبادل`],
  ['قوانين_نموذج', 'قالب قوانين للمجموعات', () => '📜 *القوانين:*\n1. الاحترام المتبادل\n2. منع الروابط العشوائية\n3. الالتزام بموضوع الجروب'],
  ['هاشتاج_عربي', 'حزمة هاشتاجات عربية', () => '#تطوير #نجاح #إلهام #تقنية #العرب #محتوى'],
  ['هاشتاج_تقني', 'حزمة هاشتاجات برمجية', () => '#JavaScript #NodeJS #AI #WebDev #Coding'],
  ['نص_سري', 'وضع النص داخل قوسين مميزين', (n) => `⟦ 🔒 ${n} 🔒 ⟧`]
];

for (const [cmd, desc, fn] of TEMPLATES) {
  add(cmd, desc, async (m, ctx) => {
    const out = fn((ctx.text && ctx.text.trim()) || 'أصدقائي');
    await sendInteractiveCard(m, ctx, { title: desc, badge: '📄', body: out, theme: 'royal', buttons: [makeCopyButton('📋 نسخ القالب', out)] });
  });
}

// 30 ASCII / Badge Art Signatures
const BADGES = [
  ['شعار_تاج', '👑 ═══ KING ═══ 👑'],
  ['شعار_سيف', '⚔️ ═══ WARRIOR ═══ ⚔️'],
  ['شعار_قلب', '❤️‍🔥 ═══ HEART ═══ ❤️‍🔥'],
  ['شعار_نار', '🔥 ═══ BLAZE ═══ 🔥'],
  ['شعار_قمر', '🌙 ═══ MOONLIGHT ═══ 🌙'],
  ['شعار_برق', '⚡ ═══ THUNDER ═══ ⚡'],
  ['شعار_درع', '🛡️ ═══ GUARDIAN ═══ 🛡️'],
  ['شعار_جمجمة', '💀 ═══ PHANTOM ═══ 💀'],
  ['شعار_وردة', '🌹 ═══ ROSE ═══ 🌹'],
  ['شعار_فراشة', '🦋 ═══ BUTTERFLY ═══ 🦋'],
  ['شعار_نجم', '🌟 ═══ STARLIGHT ═══ 🌟'],
  ['شعار_اسد', '🦁 ═══ LIONHEART ═══ 🦁'],
  ['شعار_صقر', '🦅 ═══ FALCON ═══ 🦅'],
  ['شعار_تنين', '🐉 ═══ DRAGON ═══ 🐉'],
  ['شعار_ذئب', '🐺 ═══ ALPHA ═══ 🐺'],
  ['شعار_الماس', '💎 ═══ DIAMOND ═══ 💎'],
  ['شعار_صاروخ', '🚀 ═══ LAUNCH ═══ 🚀'],
  ['شعار_مجرة', '🌌 ═══ GALAXY ═══ 🌌'],
  ['شعار_موسيقى', '🎵 ═══ MELODY ═══ 🎵'],
  ['شعار_كأس', '🏆 ═══ CHAMPION ═══ 🏆'],
  ['شعار_سهم', '🏹 ═══ ARCHER ═══ 🏹'],
  ['شعار_مفتاح', '🗝️ ═══ MASTERKEY ═══ 🗝️'],
  ['شعار_بوصلة', '🧭 ═══ EXPLORER ═══ 🧭'],
  ['شعار_ساعة', '⌛ ═══ TIMELESS ═══ ⌛'],
  ['شعار_مصباح', '💡 ═══ GENIUS ═══ 💡'],
  ['شعار_عدسة', '🔍 ═══ DETECTIVE ═══ 🔍'],
  ['شعار_جبل', '🏔️ ═══ SUMMIT ═══ 🏔️'],
  ['شعار_محيط', '🌊 ═══ OCEAN ═══ 🌊'],
  ['شعار_شمس', '☀️ ═══ SUNRISE ═══ ☀️'],
  ['شعار_رعد', '⛈️ ═══ STORM ═══ ⛈️']
];

for (const [cmd, art] of BADGES) {
  add(cmd, `شعار مزخرف (${cmd})`, async (m, ctx) => {
    const t = (ctx.text && ctx.text.trim()) || '';
    const out = t ? `${art.split(' ')[0]} ═══ *${t}* ═══ ${art.split(' ').pop()}` : art;
    await sendInteractiveCard(m, ctx, { title: 'شعار جاهز', badge: '🎨', body: out, theme: 'royal', buttons: [makeCopyButton('📋 نسخ الشعار', out)] });
  });
}

export default handlers;
