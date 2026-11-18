/**
 * plugins/packs/economy_social_pack.js — حزمة الاقتصاد والوظائف والبطاقات الاجتماعية (145+ أمر)
 */
import { progressBar, sendInteractiveCard, makeCopyButton } from '../../system/interactiveUI.js';

const handlers = [];
const add = (cmd, desc, fn, usage, cat = 'bank') => {
  const triggers = Array.isArray(cmd) ? cmd : [cmd];
  const h = async (m, ctx) => {
    try { await fn(m, ctx); }
    catch (e) { await m.reply('❌ ' + (e?.message || e)); }
  };
  h.command = triggers;
  h.usage = usage || [triggers[0]];
  h.description = desc;
  h.category = cat;
  h.usePrefix = true;
  handlers.push(h);
};

function ensureUser(sender) {
  if (!global.db) global.db = { users: {}, groups: {} };
  if (!global.db.users) global.db.users = {};
  if (!sender || !String(sender).includes('@')) return null;
  if (!global.db.users[sender]) global.db.users[sender] = {};
  return global.db.users[sender];
}

function getStats(sender) {
  const u = ensureUser(sender) || {};
  const coins = Number(u.money || u.coins || 0) || 0;
  const bank = Number(u.bank || 0) || 0;
  const xp = Number(u.exp || u.xp || 0) || 0;
  const streak = Number(u.streak || 0) || 0;
  const rank = u.customRank || (xp >= 5000 ? '👑 أسطورة' : xp >= 2000 ? '💎 ماسي' : xp >= 800 ? '🥇 ذهبي' : '🌱 مبتدئ');
  return { u, coins, bank, xp, streak, rank };
}

function grant(sender, addCoins = 0, addXp = 0) {
  const u = ensureUser(sender);
  if (!u) return getStats(sender);
  const c = (Number(u.money || u.coins || 0) || 0) + addCoins;
  const x = (Number(u.exp || u.xp || 0) || 0) + addXp;
  if (c > 0) u.money = c;
  if (x > 0) u.exp = x;
  return getStats(sender);
}

// ── 1. 25 Bank, Shop, Streak & Economy Commands ──
add('محفظتي', 'عرض تفاصيل رصيد المحفظة والبنك والرتبة', async (m, ctx) => {
  const s = getStats(m.sender);
  await sendInteractiveCard(m, ctx, {
    title: 'محفظتك الرقمية',
    badge: '💳',
    theme: 'royal',
    fields: [
      { icon: '🪙', label: 'الرصيد النقدي', value: `${s.coins} عملة` },
      { icon: '🏦', label: 'رصيد البنك', value: `${s.bank} عملة` },
      { icon: '⭐', label: 'نقاط الخبرة', value: `${s.xp} XP` },
      { icon: '🏅', label: 'الرتبة', value: s.rank },
      { icon: '🔥', label: 'السلسلة', value: `${s.streak} يوم` }
    ],
    buttons: [
      { label: '🎁 مكافأة الساعة', id: 'مكافأة_ساعة' },
      { label: '🛒 متجر البوت', id: 'متجر_البوت' },
      { label: '💼 وظيفة مبرمج', id: 'وظيفة_مبرمج' }
    ]
  });
});

add('مكافأة_ساعة', 'استلام مكافأة ساعية سريعة', async (m, ctx) => {
  const s = grant(m.sender, 150, 40);
  await sendInteractiveCard(m, ctx, {
    title: 'تم استلام المكافأة',
    badge: '🎁',
    body: 'أُضيف إلى رصيدك *+150* عملة و *+40* XP!',
    theme: 'emerald',
    fields: [{ icon: '🪙', label: 'الرصيد الحالي', value: `${s.coins} عملة` }],
    buttons: [{ label: '💳 محفظتي', id: 'محفظتي' }, { label: '🔥 سلسلة يومي', id: 'سلسلة_يومي' }]
  });
});

add('سلسلة_يومي', 'تسجيل الحضور اليومي وزيادة السلسلة', async (m, ctx) => {
  const u = ensureUser(m.sender);
  const nextStreak = (Number(u?.streak || 0) || 0) + 1;
  if (u) u.streak = nextStreak;
  const reward = 200 + Math.min(nextStreak * 25, 500);
  const s = grant(m.sender, reward, 80);
  await sendInteractiveCard(m, ctx, {
    title: 'سلسلة الحضور المتواصل',
    badge: '🔥',
    body: `سلسلتك وصلت إلى *${nextStreak}* يوم!\nمكافأتك اليوم: *+${reward}* عملة.`,
    theme: 'crimson',
    fields: [{ icon: '🪙', label: 'الرصيد', value: `${s.coins} عملة` }],
    buttons: [{ label: '💳 محفظتي', id: 'محفظتي' }]
  });
});

add('متجر_البوت', 'عرض متجر الرتب والمزايا التفاعلي', async (m, ctx) => {
  await sendInteractiveCard(m, ctx, {
    title: 'متجر لايت التفاعلي',
    badge: '🛒',
    body: 'اشترِ رتباً وأوسمة باستخدام عملاتك داخل البوت:',
    theme: 'royal',
    fields: [
      '🥇 وسام النخبة — 300 عملة (`شراء_رتبة نخبة`)',
      '💎 وسام الماس — 750 عملة (`شراء_رتبة ماسي`)',
      '👑 التاج الملكي — 1500 عملة (`شراء_رتبة ملكي`)'
    ],
    buttons: [
      { label: '🥇 شراء نخبة', id: 'شراء_رتبة نخبة' },
      { label: '💎 شراء ماسي', id: 'شراء_رتبة ماسي' },
      { label: '👑 شراء ملكي', id: 'شراء_رتبة ملكي' }
    ]
  });
});

add('شراء_رتبة', 'شراء رتبة خاصة من متجر البوت', async (m, ctx) => {
  const tier = (ctx.text || 'نخبة').trim();
  const prices = { 'نخبة': [300, '🥇 وسام النخبة'], 'ماسي': [750, '💎 وسام الماس'], 'ملكي': [1500, '👑 التاج الملكي'] };
  const chosen = prices[tier] || prices['نخبة'];
  const s = getStats(m.sender);
  if (s.coins < chosen[0]) {
    return await sendInteractiveCard(m, ctx, {
      title: 'رصيد غير كافٍ',
      badge: '💳',
      body: `سعر *${chosen[1]}* هو *${chosen[0]}* عملة، ورصيدك الحالي *${s.coins}* عملة.\nاجمع العملات من الوظائف والألعاب!`,
      theme: 'crimson',
      buttons: [{ label: '💼 وظيفة مبرمج', id: 'وظيفة_مبرمج' }, { label: '🎁 مكافأة الساعة', id: 'مكافأة_ساعة' }]
    });
  }
  if (s.u) {
    const rem = s.coins - chosen[0];
    if (rem > 0) s.u.money = rem; else delete s.u.money;
    s.u.customRank = chosen[1];
  }
  await sendInteractiveCard(m, ctx, {
    title: 'تمت عملية الشراء بنجاح!',
    badge: '🎉',
    body: `مبارك! حصلت على *${chosen[1]}* وتم تفعيلها في بطاقتك.`,
    theme: 'emerald',
    buttons: [{ label: '🏅 رتبتي', id: 'رتبتي' }, { label: '💳 محفظتي', id: 'محفظتي' }]
  });
}, ['شراء_رتبة <نخبة|ماسي|ملكي>']);

const BANK_EXTRAS = [
  ['رتبتي', 'عرض رتبتك ومؤشر المستوى', (m, ctx) => {
    const s = getStats(m.sender);
    return sendInteractiveCard(m, ctx, { title: 'بطاقة الرتبة', badge: '🏅', theme: 'royal', fields: [{ icon: '🏅', label: 'الرتبة', value: s.rank }, { icon: '⭐', label: 'الخبرة', value: `${s.xp} XP` }, { icon: '📈', label: 'المسار', value: progressBar(s.xp % 500, 500, 10) }], buttons: [{ label: '🛒 متجر البوت', id: 'متجر_البوت' }] });
  }],
  ['بنك_استثمار', 'استثمار سريع بعائد مضمون', (m, ctx) => {
    const s = grant(m.sender, 180, 35);
    return sendInteractiveCard(m, ctx, { title: 'عائد الاستثمار', badge: '📈', body: 'حقق استثمارك أرباحاً بنسبة +18% (+180 عملة)!', theme: 'emerald', fields: [{ icon: '🪙', label: 'رصيدك', value: String(s.coins) }] });
  }],
  ['سحب_بنك', 'سحب رصيد من حساب البنك إلى المحفظة', (m, ctx) => {
    const s = getStats(m.sender);
    if (s.u && s.bank > 0) { s.u.money = s.coins + s.bank; delete s.u.bank; }
    return sendInteractiveCard(m, ctx, { title: 'تحويل بنكي', badge: '🏦', body: s.bank > 0 ? `تم سحب *${s.bank}* عملة إلى محفظتك.` : 'حساب البنك فارغ حالياً — رصيدك جاهز في المحفظة.', theme: 'cyber' });
  }],
  ['تبرع', 'إرسال تبرع خيري ورفع السمعة', (m, ctx) => {
    const s = grant(m.sender, 25, 120);
    return sendInteractiveCard(m, ctx, { title: 'وسام العطاء', badge: '🤝', body: 'زادت نقاط خبرتك وتأثيرك بمقدار *+120 XP*!', theme: 'emerald', fields: [{ icon: '⭐', label: 'الخبرة', value: `${s.xp} XP` }] });
  }],
  ['ترتيب_اغنى', 'عرض قائمة أغنى الأعضاء في قاعدة البيانات', async (m, ctx) => {
    const users = Object.entries(global.db?.users || {})
      .map(([jid, u]) => ({ jid: jid.split('@')[0], coins: Number(u?.money || u?.coins || 0) || 0 }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 5);
    const body = users.length ? users.map((u, i) => `${i + 1}. @${u.jid} — *${u.coins}* 🪙`).join('\n') : 'لا توجد حسابات مسجلة بعد — ابدأ بالعمل أو الألعاب!';
    await sendInteractiveCard(m, ctx, { title: 'قائمة الأغنى', badge: '🏆', body, theme: 'royal', buttons: [{ label: '💳 محفظتي', id: 'محفظتي' }] });
  }],
  ['جائزة_اسبوعية', 'استلام حافز النشاط الأسبوعي', (m, ctx) => { const s = grant(m.sender, 350, 90); return sendInteractiveCard(m, ctx, { title: 'الجائزة الأسبوعية', badge: '🎊', body: `استلمت *+350* عملة و *+90* XP! رصيدك: ${s.coins}`, theme: 'royal' }); }],
  ['بطاقة_ثراء', 'إصدار بطاقة حساب VIP', (m, ctx) => { const s = getStats(m.sender); return sendInteractiveCard(m, ctx, { title: 'بطاقة VIP المالية', badge: '💠', theme: 'royal', fields: [{ icon: '🪙', label: 'السيولة', value: String(s.coins) }, { icon: '🏅', label: 'التصنيف', value: s.rank }] }); }],
  ['تأمين_حساب', 'تفعيل درع حماية للمحفظة', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'حماية الحساب', badge: '🛡️', body: 'تم تفعيل طبقة حماية نشطة لمحفظتك بنجاح.', theme: 'emerald' })],
  ['حزمة_بداية', 'استلام حزمة ترحيبية للأعضاء الجدد', (m, ctx) => { const s = grant(m.sender, 250, 100); return sendInteractiveCard(m, ctx, { title: 'حزمة البداية', badge: '🎒', body: `تم شحن حسابك بـ *+250* عملة و *+100* XP! الرصيد: ${s.coins}`, theme: 'emerald' }); }],
  ['تبديل_نقاط', 'تحويل 50 XP إلى عملات ذهبية', (m, ctx) => { const s = grant(m.sender, 100, 10); return sendInteractiveCard(m, ctx, { title: 'تبديل النقاط', badge: '🔄', body: `حصلت على *+100* عملة! الرصيد: ${s.coins}`, theme: 'cyber' }); }],
  ['هدية_عضو', 'إهداء عملات تشجيعية للأصدقاء', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'هدية فورية', badge: '🎁', body: `أرسل *${ctx.text || 'الصديق'}* باقة تقدير +100 عملة معنوية!`, theme: 'royal' })],
  ['صندوق_حظ_بنك', 'فتح خزنة الحظ البنكية', (m, ctx) => { const amt = 80 + Math.floor(Math.random() * 220); const s = grant(m.sender, amt, 30); return sendInteractiveCard(m, ctx, { title: 'خزنة الحظ', badge: '🔐', body: `فتحت الخزنة وربحت *+${amt}* عملة! رصيدك: ${s.coins}`, theme: 'game' }); }],
  ['عقد_عمل', 'توقيع عقد وظيفي يومي', (m, ctx) => { const s = grant(m.sender, 140, 60); return sendInteractiveCard(m, ctx, { title: 'عقد عمل معتمد', badge: '📄', body: `حصلت على مكافأة توقيع *+140* عملة! الرصيد: ${s.coins}`, theme: 'cyber' }); }],
  ['تقييم_اقتصادي', 'تحليل وضع محفظتك ونشاطك', (m, ctx) => { const s = getStats(m.sender); const score = Math.min(100, Math.round((s.coins + s.xp) / 20)); return sendInteractiveCard(m, ctx, { title: 'التقييم الاقتصادي', badge: '📊', body: progressBar(score, 100, 12), theme: 'cyber' }); }],
  ['شهادة_عضوية', 'شهادة عضوية رقمية مزخرفة', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'شهادة عضوية معتمدة', badge: '📜', body: `يشهد نظام لايت بوت بتميّز العضو @${String(m.sender).split('@')[0]} وحسن تفاعله.`, theme: 'royal' })],
  ['وسام_نشاط', 'عرض أوسمة النشاط', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'أوسمة النشاط', badge: '🎖️', body: '🌟 متفاعل نشط\n⚡ سريع البديهة\n🤝 داعم للمجموعة', theme: 'emerald' })],
  ['مستوى_تفصيلي', 'تفاصيل نقاط الخبرة والمستوى التالي', (m, ctx) => { const s = getStats(m.sender); const lvl = Math.floor(s.xp / 250) + 1; return sendInteractiveCard(m, ctx, { title: `المستوى ${lvl}`, badge: '📈', body: progressBar(s.xp % 250, 250, 12), theme: 'cyber' }); }],
  ['خزنتي', 'فحص خزنة الأصول الخاصة بك', (m, ctx) => { const s = getStats(m.sender); return sendInteractiveCard(m, ctx, { title: 'خزنتي', badge: '🗝️', fields: [{ icon: '🪙', label: 'المحفظة', value: String(s.coins) }, { icon: '🏦', label: 'البنك', value: String(s.bank) }], theme: 'royal' }); }],
  ['تصفية_ديون', 'تصفير أي رسوم افتراضية بالنظام', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'براءة ذمة', badge: '✅', body: 'حسابك سليم وخالٍ من أي التزامات أو قيود.', theme: 'emerald' })],
  ['بورصة_البوت', 'مؤشر أسهم البوت الافتراضية الآن', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'مؤشر البورصة', badge: '📉', fields: [{ icon: '📈', label: 'سهم الذكاء', value: '+4.8%' }, { icon: '⚡', label: 'سهم الألعاب', value: '+3.1%' }, { icon: '🛡️', label: 'سهم الحماية', value: '+6.2%' }], theme: 'cyber' })]
];

for (const [cmd, desc, fn] of BANK_EXTRAS) add(cmd, desc, fn);

// ── 2. 35 Career / Work Commands ──
const CAREERS = [
  ['وظيفة_مبرمج', 'مبرمج تطبيقات', '💻', 180, 90],
  ['وظيفة_طبيب', 'طبيب طوارئ', '🩺', 200, 95],
  ['وظيفة_مهندس', 'مهندس معماري', '📐', 175, 85],
  ['وظيفة_طيار', 'قائد طائرة', '✈️', 210, 90],
  ['وظيفة_معلم', 'معلم ملهم', '📚', 140, 100],
  ['وظيفة_مصمم', 'مصمم واجهات UI/UX', '🎨', 165, 80],
  ['وظيفة_صحفي', 'صحفي ميداني', '📰', 135, 70],
  ['وظيفة_محامي', 'محامٍ ومستشار', '⚖️', 185, 80],
  ['وظيفة_طباخ', 'شيف محترف', '👨‍🍳', 130, 65],
  ['وظيفة_مصور', 'مصور فوتوغرافي', '📸', 145, 70],
  ['وظيفة_مزارع', 'مزارع منتج', '🌾', 120, 65],
  ['وظيفة_تاجر', 'تاجر إلكتروني', '🛍️', 170, 75],
  ['وظيفة_صياد', 'صياد محترف', '🎣', 125, 60],
  ['وظيفة_محقق', 'محقق خاص', '🕵️', 160, 85],
  ['وظيفة_رائد_فضاء', 'رائد فضاء', '👨‍🚀', 240, 120],
  ['وظيفة_بحار', 'قبطان سفينة', '⚓', 155, 75],
  ['وظيفة_موسيقار', 'ملحّن صوتيات', '🎵', 140, 70],
  ['وظيفة_مترجم', 'مترجم فوري', '🌐', 150, 75],
  ['وظيفة_مخرج', 'مخرج أفلام', '🎬', 170, 80],
  ['وظيفة_حارس', 'حارس أمن رقمي', '🛡️', 145, 70],
  ['وظيفة_كيميائي', 'باحث كيميائي', '⚗️', 165, 85],
  ['وظيفة_جيولوجي', 'خبير جيولوجيا', '🪨', 150, 75],
  ['وظيفة_مدرب', 'مدرب لياقة', '🏋️', 135, 70],
  ['وظيفة_ميكانيكي', 'مهندس محركات', '🔧', 140, 65],
  ['وظيفة_كهربائي', 'فني طاقة', '⚡', 140, 70],
  ['وظيفة_نجار', 'حرفي خشب', '🪚', 125, 60],
  ['وظيفة_خباز', 'خباز ماهر', '🥖', 120, 60],
  ['وظيفة_صائغ', 'صائغ مجوهرات', '💍', 190, 80],
  ['وظيفة_كاتب', 'كاتب روايات', '✍️', 145, 85],
  ['وظيفة_فلكي', 'راصد فلكي', '🔭', 175, 95],
  ['وظيفة_بريد', 'ساعي سريع', '📦', 115, 55],
  ['وظيفة_طوارئ', 'مسعف إنقاذ', '🚑', 180, 100],
  ['وظيفة_بناء', 'مشرف إنشاءات', '🏗️', 150, 70],
  ['وظيفة_محاسب', 'محاسب مالي', '🧾', 160, 75],
  ['وظيفة_مسوق', 'خبير تسويق رقمي', '📣', 165, 80]
];

for (const [cmd, title, icon, pay, xp] of CAREERS) {
  add(cmd, `العمل بمهنة ${title} وكسب أرباح`, async (m, ctx) => {
    const s = grant(m.sender, pay, xp);
    await sendInteractiveCard(m, ctx, {
      title: `وردية عمل: ${title}`,
      badge: icon,
      body: `أتممت مهمة *${title}* بنجاح واستلمت مستحقاتك!`,
      theme: 'emerald',
      fields: [
        { icon: '💵', label: 'الراتب', value: `+${pay} عملة` },
        { icon: '⭐', label: 'الخبرة', value: `+${xp} XP` },
        { icon: '🪙', label: 'إجمالي الرصيد', value: `${s.coins} عملة` }
      ],
      buttons: [{ label: '💳 محفظتي', id: 'محفظتي' }, { label: '🛒 المتجر', id: 'متجر_البوت' }]
    });
  });
}

// ── 3. 45 Social Greeting, Motivation, Joke & Stylish Reply Cards ──
const SOCIAL_CARDS = [
  ['بطاقة_عيد', 'بطاقة تهنئة بالعيد فخمة', '🌙', 'عيدكم مبارك، تقبل الله طاعاتكم وأدام عليكم الأفراح والمسرات.'],
  ['بطاقة_نجاح', 'بطاقة تهنئة نجاح وتفوق', '🎓', 'ألف مبارك هذا النجاح الباهر! ثمرة تعبك واجتهادك أزهرت تفوقاً نفخر به.'],
  ['بطاقة_زواج', 'بطاقة تهنئة زواج مبارك', '💍', 'بارك الله لكما وبارك عليكما وجمع بينكما في خير، حياة سعيدة هانئة.'],
  ['بطاقة_رمضان', 'بطاقة تهنئة شهر رمضان', '🏮', 'مبارك عليكم شهر رمضان المبارك، أعاننا الله وإياكم على صيامه وقيامه.'],
  ['تهنئة_جمعة', 'رسالة جمعة مباركة', '🕌', 'طابت جمعتكم بذكر الله، لا تنسوا سورة الكهف والصلاة على النبي ﷺ.'],
  ['بطاقة_ميلاد', 'بطاقة تهنئة يوم ميلاد', '🎂', 'عام جديد مليء بالصحة والنجاح وتحقيق أجمل الأماني بإذن الله!'],
  ['شكر_خاص', 'بطاقة شكر وامتنان', '🌷', 'شكراً من القلب على حضورك الراقي ومساعدتك الصادقة، دمت مصدر خير.'],
  ['اعتذار_راقي', 'رسالة اعتذار مهذبة', '🕊️', 'أعتذر بصدق إن بدر مني ما يزعجك، فمكانك وقدرك أكبر من أي سوء فهم.'],
  ['ترحيب_ملكي', 'بطاقة ترحيب راقية', '👑', 'أهلاً وسهلاً بك بيننا! حللت أهلاً ووطئت سهلاً، وجودك يضيف للمكان بهاءً.'],
  ['مدح_فخم', 'رسالة إطراء مهذبة', '✨', 'أسلوبك المتزن وحضورك الراقي يتركان أثراً طيباً في كل مجلس.'],
  ['تحفيز_صباحي', 'رسالة تحفيز لبداية اليوم', '🌅', 'صباح الهمة! اليوم فرصة جديدة لتقترب خطوة حقيقية من أهدافك الكبيرة.'],
  ['تحفيز_دراسة', 'تشجيع للمذاكرة والامتحانات', '📖', 'تعب الساعات يزول، ويبقى فخر الإنجاز معك طوال العمر — واصل!'],
  ['تحفيز_عمل', 'طاقة إيجابية للعمل والإنتاج', '🚀', 'التركيز ساعة بإتقان خير من يوم كامل من التشتت — أبدع الآن!']
];

for (const [cmd, title, badge, body] of SOCIAL_CARDS) {
  add(cmd, title, async (m, ctx) => {
    await sendInteractiveCard(m, ctx, {
      title,
      badge,
      body,
      theme: 'royal',
      buttons: [makeCopyButton('📋 نسخ الرسالة', body)]
    });
  }, undefined, 'group');
}

const JOKES = [
  'مبرمج دخل مطعم، طلب شاي قال للويتر: بدون سكر أو مع سكر؟ قال له: boolean!',
  'واحد اشترى ساعة ذكية، نام متأخر فكتبت له: تم تأجيل طموحك لغدٍ!',
  'طالب سأل أستاذه: هل يُعاقب الإنسان على شيء لم يفعله؟ قال: لا. قال: ممتاز، لم أحل الواجب!',
  'حاسوب أصابه البرد، قالوا له: أغلق الـ Windows!',
  'شخص فتح ثلاجة ورأى الجيلي يرتجف، قال له: لا تخف سأشرب ماء فقط!',
  'سألوا ذكياً: ما أسرع وسيلة لإنقاص الوزن؟ قال: حرّك رأسك يميناً ويساراً كلما قُدّم لك طعام!',
  'واحد كل ما يتأخر على العمل يقول: الحركة بركة... ما عدا حركة السير!',
  'مبرمج تزوج، فكتب في بطاقة الدعوة: تم دمج الفرعين بنجاح بدون Conflicts!',
  'سألوا شخصاً: ما هوايتك؟ قال: وضع خطط رائعة لا أنفذها!',
  'قهوة الصباح ليست مشروباً... هي تحديث نظام التشغيل اليومي!'
];
JOKES.forEach((j, i) => add(`نكتة${i + 1}`, `نكتة خفيفة #${i + 1}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `ضحكة اليوم #${i + 1}`, badge: '😄', body: j, theme: 'game', buttons: [{ label: '😄 نكتة أخرى', id: `نكتة${((i + 1) % 10) + 1}` }] }), undefined, 'group'));

const CLASSY_REPLIES = [
  'حضورك يغني عن الكثير من الكلام، دمت راقياً.',
  'اختلاف الآراء لا يفسد للود قضية ما دمنا نحفظ الاحترام.',
  'الكلمة الطيبة صدقة وأثرها يبقى أطول مما نتخيل.',
  'شكراً لوقتك ولطفك؛ تقديرك محل اعتزاز دائم.',
  'الهدوء عند الرد دليل قوة وثقة لا ضعف.',
  'نلتقي دائماً على الخير والفائدة المشتركة.',
  'جمال أي مجموعة في رقيّ أعضائها وتعاونهم.',
  'سعدت جداً بسماع هذا الخبر المبهج!',
  'دعنا نركز على الحل لا على المشكلة، وسنصل أسرع.',
  'احترام المواعيد والكلمة عنوان الشخصية المتزنة.'
];
CLASSY_REPLIES.forEach((r, i) => add(`رد_فخم${i + 1}`, `رد جاهز راقٍ #${i + 1}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `رد راقٍ #${i + 1}`, badge: '💬', body: r, theme: 'royal', buttons: [makeCopyButton('📋 نسخ الرد', r)] }), undefined, 'group'));

const FRIEND_MSGS = [
  'الصديق الحقيقي هو من يذكر اسمك بالخير في غيابك.',
  'وجود أمثالك في الحياة نعمة تستحق الحمد كل يوم.',
  'المسافات لا تقلل من مكانة الأوفياء في القلب.',
  'شكراً لأنك تجعل الأيام العادية أكثر إشراقاً ومرحاً.',
  'بعض الأصدقاء يشبهون القهوة الدافئة في صباح شتوي.',
  'دمت سنداً ورفيقاً طيباً في كل الأوقات.'
];
FRIEND_MSGS.forEach((f, i) => add(`رسالة_صداقة${i + 1}`, `رسالة صداقة ووفاء #${i + 1}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `رسالة صداقة #${i + 1}`, badge: '🤝', body: f, theme: 'emerald', buttons: [makeCopyButton('📋 نسخ', f)] }), undefined, 'group'));

const KIND_COMPLIMENTS = [
  'طيب الأثر يسبق حضورك دائماً.',
  'ابتسامتك وكلماتك تبعثان الطمأنينة في المكان.',
  'ذوقك الرفيع يظهر في أدق اختياراتك.',
  'أنت من الأشخاص الذين تتحسن الأجواء بمجرد وجودهم.',
  'عقل متزن وقلب نقي — مزيج نادر يُحترم.',
  'كل التوفيق لقلبك الطيب في كل خطوة.'
];
KIND_COMPLIMENTS.forEach((g, i) => add(`غزل_محترم${i + 1}`, `عبارة إطراء مهذبة #${i + 1}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `كلمة لطيفة #${i + 1}`, badge: '🌸', body: g, theme: 'royal', buttons: [makeCopyButton('📋 نسخ', g)] }), undefined, 'group'));

// ── 4. 40 Mood, Guild, Certificates & Badges ──
const MOODS = [
  ['مزاجي_سعيد', 'سعيد ومتفائل', '😄', 'طاقة إيجابية مشرقة اليوم — شارك ابتسامتك مع الجميع!'],
  ['مزاجي_حزين', 'هادئ ومتأمل', '🌧️', 'خذ نفساً عميقاً، كل غيمة تمر وتترك سماءً أصفى.'],
  ['مزاجي_متحمس', 'متحمس للإنجاز', '🔥', 'الوقت مناسب جداً لبدء مهمة طال انتظارها!'],
  ['مزاجي_هادئ', 'رايق ومطمئن', '🍃', 'أجمل ما في اليوم صفاء الذهن وبساطة اللحظة.'],
  ['مزاجي_مرهق', 'يحتاج راحة', '☕', 'استراحة قصيرة وكوب ماء أو قهوة يعيدان إليك نشاطك.'],
  ['مزاجي_ملكي', 'مزاج ملكي راقٍ', '👑', 'هدوء وثقة ولا مجال للأمور السلبية اليوم.'],
  ['مزاجي_مبدع', 'في قمة الإبداع', '🎨', 'دوّن أفكارك فوراً قبل أن تتبخر — الإلهام حاضر!'],
  ['مزاجي_مركز', 'تركيز حاد', '🎯', 'وضع الصامت مفعّل والإنتاجية في أعلى مستوياتها!']
];
for (const [cmd, label, icon, msg] of MOODS) {
  add(cmd, `تعيين حالتك المزاجية: ${label}`, async (m, ctx) => {
    const u = ensureUser(m.sender);
    if (u) u.mood = `${icon} ${label}`;
    await sendInteractiveCard(m, ctx, { title: `مزاجك الآن: ${label}`, badge: icon, body: msg, theme: 'emerald' });
  }, undefined, 'group');
}

for (let i = 1; i <= 12; i++) {
  const crests = ['⚔️ صقور الليل', '🛡️ فرسان الضياء', '🐉 تنانين الشرق', '⚡ برق السماء', '👑 تاج الأساطير', '🔥 عنقاء الفجر', '❄️ ذئاب الجليد', '🦁 أسود الحكمة', '🌌 حراس المجرة', '💎 نخبة الماس', '🦅 أجنحة العز', '🏛️ بناة المجد'];
  add(`شعار_نقابة${i}`, `شعار نقابة جاهز #${i}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `شعار نقابة #${i}`, badge: '🏰', body: `*${crests[i - 1]}*\n_اتحاد القوة والإبداع والتعاون_`, theme: 'royal', buttons: [makeCopyButton('📋 نسخ الشعار', crests[i - 1])] }), undefined, 'guild');
}

for (let i = 1; i <= 10; i++) {
  const tiers = ['برونزي', 'فضي', 'ذهبي', 'بلاتيني', 'ماسي', 'ياقوتي', 'زمردي', 'ملكي', 'إمبراطوري', 'أسطوري'];
  add(`رتبة_تفاعلية${i}`, `معاينة الرتبة التفاعلية #${i}: ${tiers[i - 1]}`, (m, ctx) => sendInteractiveCard(m, ctx, { title: `المستوى ${i}: ${tiers[i - 1]}`, badge: '🎖️', body: progressBar(i * 10, 100, 12), theme: 'cyber' }));
}

const EXTRA_CARDS = [
  ['انجازاتي', 'عرض إنجازاتك المفتوحة', (m, ctx) => { const s = getStats(m.sender); return sendInteractiveCard(m, ctx, { title: 'لوحة إنجازاتك', badge: '🏆', fields: [{ icon: '🪙', label: 'العملات', value: String(s.coins) }, { icon: '⭐', label: 'الخبرة', value: `${s.xp} XP` }, { icon: '🎭', label: 'المزاج', value: s.u?.mood || 'غير محدد' }], theme: 'royal' }); }],
  ['ميثاق_جروب', 'ميثاق احترام وتعاون أعضاء الجروب', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'ميثاق المجموعة', badge: '📜', body: '1. الاحترام المتبادل أساس الحوار.\n2. تجنّب السبام والإزعاج.\n3. مشاركة المفيد واحترام الخصوصية.', theme: 'emerald' })],
  ['بطاقة_تقدير', 'إصدار بطاقة شكر وتقدير لعضو', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'شهادة تقدير', badge: '🌟', body: `تُمنح هذه البطاقة لـ *${ctx.text || 'عضو متميز'}* تقديراً لعطائه وتفاعله الإيجابي.`, theme: 'royal' })],
  ['تحدي_صديق', 'إرسال بطاقة تحدي ودي لصديق', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'تحدي الأصدقاء', badge: '⚔️', body: `تحدٍ مباشر إلى *${ctx.text || 'صديقك'}*: من يحقق نقاطاً أعلى في الألعاب اليوم؟`, theme: 'game' })],
  ['نسبة_نشاط', 'حساب نسبة نشاطك بالمحادثة', (m, ctx) => { const s = getStats(m.sender); const pct = Math.min(100, 35 + Math.floor(s.xp / 20)); return sendInteractiveCard(m, ctx, { title: 'مؤشر النشاط', badge: '⚡', body: progressBar(pct, 100, 12), theme: 'cyber' }); }],
  ['شهادة_تخرج', 'شهادة تخرج ترفيهية من أكاديمية البوت', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'شهادة تخرج', badge: '🎓', body: `أتم *${ctx.text || 'المتفوق'}* جميع اختبارات المهارة بنجاح!`, theme: 'royal' })],
  ['وسام_اسطورة', 'بطاقة وسام الأسطورة', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'وسام الأسطورة', badge: '🐉', body: 'يُمنح لأصحاب التميز المستمر والأثر الطيب.', theme: 'crimson' })],
  ['وسام_ذهب', 'بطاقة الوسام الذهبي', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'الوسام الذهبي', badge: '🥇', body: 'تقديراً للمشاركة المثمرة والتعاون الدائم.', theme: 'royal' })],
  ['وسام_فضة', 'بطاقة الوسام الفضي', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'الوسام الفضي', badge: '🥈', body: 'خطوة واثقة نحو القمة والاستمرارية.', theme: 'cyber' })],
  ['وسام_الماس', 'بطاقة الوسام الماسي', (m, ctx) => sendInteractiveCard(m, ctx, { title: 'الوسام الماسي', badge: '💎', body: 'لصاحب البصمة الفريدة والأفكار المبتكرة.', theme: 'cyber' })]
];
for (const [cmd, desc, fn] of EXTRA_CARDS) add(cmd, desc, fn, undefined, 'group');

export default handlers;
