/**
 * plugins/packs/empire_realm_pack.js — حزمة بناء الممالك والإمبراطورية والحضارات التفاعلية (105+ أمر)
 */
import {
  ensureDbUser,
  awardUser,
  pickRandom,
  seededPick,
  makeSimpleHtmlWidget,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeQuickButton
} from '../../system/creativePackUtils.js';

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

function ensureRealm(sender, defaultName = 'مملكة النور') {
  const u = ensureDbUser(sender);
  if (!u.realm) {
    u.realm = {
      name: defaultName,
      capital: 'العاصمة الكبرى',
      gold: 500,
      stone: 200,
      food: 250,
      iron: 100,
      knowledge: 40,
      loyalty: 75,
      guards: 20,
      archers: 10,
      scouts: 5,
      scholars: 3,
      buildings: {},
      relics: [],
      decrees: [],
      rankTitle: 'حاكم ناشئ'
    };
  }
  return { u, realm: u.realm };
}

// ── 1. Founding, Throne & Kingdom Management ──
add('تأسيس_مملكة', 'تأسيس مملكتك الخاصة وتسميتها وحفظها في السجل الملكي', async (m, ctx) => {
  const name = String(ctx.text || '').trim() || 'مملكة الفجر';
  const { realm } = ensureRealm(m.sender, name);
  realm.name = name;
  awardUser(m.sender, 100, 50);
  await sendInteractiveCard(m, ctx, {
    title: `إعلان قيام ${realm.name}!`,
    badge: '👑',
    fields: [
      { icon: '🏰', label: 'العاصمة', value: realm.capital },
      { icon: '🪙', label: 'ذهب الخزينة', value: String(realm.gold) },
      { icon: '🪨', label: 'الحجارة', value: String(realm.stone) },
      { icon: '🌾', label: 'الغذاء', value: String(realm.food) }
    ],
    theme: 'royal',
    buttons: [makeQuickButton('👑 عرض العرش', 'عرش_المملكة'), makeQuickButton('⛏️ جمع الموارد', 'جمع_الموارد')]
  });
}, ['تأسيس_مملكة <الاسم>']);

add('عرش_المملكة', 'استعراض تقرير شامل عن مملكتك وجيشك ومبانيك وولاء الشعب', async (m, ctx) => {
  const { realm } = ensureRealm(m.sender);
  const bCount = Object.values(realm.buildings).reduce((a, b) => a + b, 0);
  await sendInteractiveCard(m, ctx, {
    title: `${realm.name} — ديوان العرش`,
    subtitle: `العاصمة: ${realm.capital} | اللقب: ${realm.rankTitle}`,
    badge: '🏰',
    fields: [
      { icon: '🪙', label: 'الذهب / الحديد', value: `${realm.gold} ذهب | ${realm.iron} حديد` },
      { icon: '🪨', label: 'الحجارة / الغذاء', value: `${realm.stone} حجر | ${realm.food} غذاء` },
      { icon: '🛡️', label: 'القوات', value: `${realm.guards} حارس | ${realm.archers} رامٍ | ${realm.scouts} كشاف` },
      { icon: '🏗️', label: 'المباني / الآثار', value: `${bCount} مبنى | ${realm.relics.length} أثر` },
      { icon: '❤️', label: 'ولاء الشعب', value: progressBar(realm.loyalty, 100, 10) }
    ],
    theme: 'royal',
    buttons: [makeQuickButton('⛏️ جمع الموارد', 'جمع_الموارد'), makeQuickButton('🐉 استكشاف كهف', 'استكشاف_كهف_المملكة')]
  });
});

add('خزينة_المملكة', 'جرد تفصيلي لثروات مملكتك وتحويل أرباح لمحفظتك', async (m, ctx) => {
  const { u, realm } = ensureRealm(m.sender);
  await sendInteractiveCard(m, ctx, {
    title: 'خزينة المملكة المالية',
    badge: '💰',
    fields: [
      { icon: '👑', label: 'خزينة المملكة', value: `${realm.gold} ذهب` },
      { icon: '👛', label: 'محفظتك الشخصية', value: `${u.money} عملة` },
      { icon: '📚', label: 'نقاط المعرفة', value: `${realm.knowledge} نقطة` }
    ],
    theme: 'royal',
    buttons: [makeQuickButton('🪙 ضرب عملة', 'ضرب_عملة'), makeQuickButton('🐪 تجارة القوافل', 'تجارة_القوافل')]
  });
});

add('جمع_الموارد', 'تحصيل إنتاج المباني والمزارع والمناجم في مملكتك', async (m, ctx) => {
  const { realm } = ensureRealm(m.sender);
  const b = realm.buildings;
  const gAdd = 60 + (b['منجم_ذهب'] || 0) * 45 + (b['سوق_كبير'] || 0) * 35;
  const sAdd = 35 + (b['مقلع_حجارة'] || 0) * 30;
  const fAdd = 40 + (b['مزرعة_ملكية'] || 0) * 35 + (b['قناة_ري'] || 0) * 20;
  const iAdd = 20 + (b['حدادة_أسطورية'] || 0) * 20;
  const kAdd = 10 + (b['أكاديمية_علوم'] || 0) * 18 + (b['مكتبة_عظمى'] || 0) * 15;
  realm.gold += gAdd;
  realm.stone += sAdd;
  realm.food += fAdd;
  realm.iron += iAdd;
  realm.knowledge += kAdd;
  awardUser(m.sender, 45, 30);
  await sendInteractiveCard(m, ctx, {
    title: 'حصاد إنتاج المملكة',
    badge: '🌾',
    fields: [
      { icon: '🪙', label: 'ذهب مضاف', value: `+${gAdd}` },
      { icon: '🪨', label: 'حجارة', value: `+${sAdd}` },
      { icon: '🍞', label: 'غذاء', value: `+${fAdd}` },
      { icon: '⚙️', label: 'حديد / معرفة', value: `+${iAdd} حديد | +${kAdd} علم` }
    ],
    theme: 'emerald'
  });
});

// ── 2. 22 Distinct Kingdom Buildings (Real DB Leveling + Output Bonuses) ──
const BUILDINGS = [
  ['بناء_مقلع_حجارة', 'مقلع_حجارة', 'مقلع الحجارة الملكي', 80, '+30 حجر لكل حصاد'],
  ['بناء_منجم_ذهب', 'منجم_ذهب', 'منجم الذهب العميق', 120, '+45 ذهب لكل حصاد'],
  ['بناء_مزرعة_ملكية', 'مزرعة_ملكية', 'المزارع الملكية الخصبة', 70, '+35 غذاء ويزيد الولاء'],
  ['بناء_ثكنة_فرسان', 'ثكنة_فرسان', 'ثكنة الفرسان', 140, 'يرفع قوة التدريب العسكري'],
  ['بناء_أكاديمية_علوم', 'أكاديمية_علوم', 'أكاديمية العلوم والابتكار', 160, '+18 معرفة لكل حصاد'],
  ['بناء_مرصد_ملكي', 'مرصد_ملكي', 'المرصد الفلكي الملكي', 150, 'يحسّن استكشاف البحار والطرق'],
  ['بناء_ميناء_بحري', 'ميناء_بحري', 'الميناء التجاري البحري', 170, 'يفتح أرباحاً إضافية للرحلات'],
  ['بناء_حدادة_أسطورية', 'حدادة_أسطورية', 'دار الحدادة الكبرى', 130, '+20 حديد لكل حصاد'],
  ['بناء_منارة_الساحل', 'منارة_الساحل', 'منارة هداية السفن', 110, 'تحمي السفن وتجلب التجار'],
  ['بناء_قناة_ري', 'قناة_ري', 'قناة الري الكبرى', 95, '+20 غذاء دائم'],
  ['بناء_سوق_كبير', 'سوق_كبير', 'السوق المركزي الكبير', 145, '+35 ذهب مع كل جولة'],
  ['بناء_حصن_منيع', 'حصن_منيع', 'الحصن الدفاعي المنيع', 180, 'يرفع أمان المملكة واستقرارها'],
  ['بناء_دار_السك', 'دار_السك', 'دار سك العملات الذهبية', 200, 'يضاعف عائد ضرب العملة'],
  ['بناء_مكتبة_عظمى', 'مكتبة_عظمى', 'المكتبة العظمى', 155, '+15 معرفة ويزيد الخبرة'],
  ['بناء_إسطبل_الخيول', 'إسطبل_الخيول', 'إسطبل الخيول العربية', 125, 'يسرّع القوافل والكشافة'],
  ['بناء_برج_المراقبة', 'برج_المراقبة', 'برج المراقبة الحدودي', 90, 'ينبه مبكراً عن المخاطر'],
  ['بناء_حديقة_معلقة', 'حديقة_معلقة', 'الحديقة المعلقة الجميلة', 135, 'يرفع ولاء الشعب +5% عند البناء'],
  ['بناء_محكمة_العدل', 'محكمة_العدل', 'قصر العدل والإنصاف', 140, 'يعزز الاستقرار والولاء +6%'],
  ['بناء_مستشفى_ملكي', 'مستشفى_ملكي', 'البيمارستان الملكي', 150, 'يرعى صحة السكان والحرس'],
  ['بناء_ورشة_الآلات', 'ورشة_الآلات', 'ورشة الميكانيكا والمحركات', 175, 'يعزز كفاءة كل المنشآت'],
  ['بناء_مسجد_المدينة', 'مسجد_المدينة', 'الجامع الكبير للمملكة', 100, 'يزيد البركة والولاء +8%'],
  ['بناء_جسر_التجارة', 'جسر_التجارة', 'الجسر الحجري التجاري', 115, 'يربط ضفتي العاصمة بالتجارة']
];

for (const [cmd, key, title, baseCost, effect] of BUILDINGS) {
  add(cmd, `بناء أو ترقية ${title} (${effect})`, async (m, ctx) => {
    const { realm } = ensureRealm(m.sender);
    const lvl = realm.buildings[key] || 0;
    const costGold = baseCost + lvl * 65;
    if (realm.gold < costGold) {
      return sendInteractiveCard(m, ctx, {
        title: 'الذهب في الخزينة لا يكفي',
        badge: '🪙',
        body: `ترقية *${title}* للمستوى ${lvl + 1} تتطلب *${costGold} ذهب*، بينما في خزينتك *${realm.gold} ذهب*.`,
        buttons: [makeQuickButton('⛏️ جمع الموارد', 'جمع_الموارد')],
        theme: 'crimson'
      });
    }
    realm.gold -= costGold;
    realm.buildings[key] = lvl + 1;
    if (['حديقة_معلقة', 'محكمة_العدل', 'مسجد_المدينة', 'مزرعة_ملكية'].includes(key)) {
      realm.loyalty = Math.min(100, realm.loyalty + 5);
    }
    awardUser(m.sender, 40, 45);
    await sendInteractiveCard(m, ctx, {
      title: `تم تشييد ${title}!`,
      badge: '🏗️',
      fields: [
        { icon: '⭐', label: 'المستوى الجديد', value: `Lv.${lvl + 1}` },
        { icon: '✨', label: 'التأثير الدائم', value: effect },
        { icon: '🪙', label: 'الذهب المتبقي', value: String(realm.gold) }
      ],
      theme: 'royal'
    });
  }, [cmd]);
}

// ── 3. Decrees, Economy, Crafting & Specialists ──
const REALM_ACTIONS = [
  ['إصدار_مرسوم', 'إصدار مرسوم ملكي مخصص وتسجيله في ديوان المملكة', ({ realm, txt }) => {
    const dec = txt || 'إلغاء الضرائب في يوم الاحتفال السنوي';
    realm.decrees.push({ text: dec, at: Date.now() });
    realm.loyalty = Math.min(100, realm.loyalty + 4);
    return `📜 المرسوم رقم ${realm.decrees.length}: "${dec}"\nارتفع ولاء الشعب إلى ${realm.loyalty}%!`;
  }],
  ['سجل_المراسيم', 'عرض آخر 5 مراسيم ملكية صادرة', ({ realm }) =>
    realm.decrees.length ? realm.decrees.slice(-5).map((d, i) => `${i + 1}. ${d.text}`).join('\n') : 'لم تصدر مراسيم بعد. اكتب `.إصدار_مرسوم نص المرسوم`.'
  ],
  ['تغيير_عاصمة', 'تغيير اسم عاصمة مملكتك', ({ realm, txt }) => {
    realm.capital = txt || 'مدينة السلام';
    return `🏛️ أصبحت عاصمة ${realm.name} الآن هي: *${realm.capital}*`;
  }],
  ['شعار_المملكة', 'تصميم شعار وعبارة رسمية لمملكتك', ({ realm, txt }) => {
    const motto = txt || 'بالعلم والعدل نبني المجد';
    realm.motto = motto;
    return `🛡️ الشعار المعتمد لمملكة *${realm.name}*:\n"${motto}"`;
  }],
  ['ضرائب_الشعب', 'تحصيل عوائد الضرائب المعتدلة مقابل انخفاض طفيف بالولاء', ({ realm }) => {
    if (realm.loyalty < 25) return '⚠️ ولاء الشعب منخفض جداً! أقم `.احتفال_ملكي` أولاً.';
    const gain = 120 + (realm.buildings['سوق_كبير'] || 0) * 40;
    realm.gold += gain;
    realm.loyalty = Math.max(10, realm.loyalty - 8);
    return `💰 تم تحصيل +${gain} ذهب للخزينة. الولاء الحالي: ${realm.loyalty}%`;
  }],
  ['احتفال_ملكي', 'إقامة مهرجان للشعب لرفع الولاء (+15%) مقابل 60 غذاء', ({ realm }) => {
    if (realm.food < 60) return '🍞 يلزم 60 وحدة غذاء لإقامة المهرجان!';
    realm.food -= 60;
    realm.loyalty = Math.min(100, realm.loyalty + 15);
    return `🎉 عمّت البهجة أرجاء ${realm.capital}! ارتفع الولاء إلى ${realm.loyalty}%`;
  }],
  ['مؤشر_الولاء', 'فحص رضا المواطنين ومقترحات رفع الشعبية', ({ realm }) =>
    `الولاء الشعبي: ${progressBar(realm.loyalty, 100, 10)}\n${realm.loyalty >= 80 ? 'شعبية جارفة ومستقرة 👑' : 'يُنصح ببناء الحدائق وإقامة الاحتفالات 🎉'}`
  ],
  ['مجلس_الشورى_الملكي', 'عرض توصيات الوزراء الثلاثة لتحسين مواردك', ({ realm }) =>
    `• وزير المالية: لديك ${realm.gold} ذهب — ${realm.gold > 300 ? 'وقت مثالي لبناء منجم أو سوق!' : 'ركز على جمع الموارد والتجارة.'}\n• وزير الدفاع: القوة (${realm.guards + realm.archers}) مقاتل.\n• وزير المعارف: نقاط العلم (${realm.knowledge}).`
  ],
  ['رتب_النبلاء', 'معرفة رتبتك الإمبراطورية حسب مجموع مباني مملكتك', ({ realm }) => {
    const b = Object.values(realm.buildings).reduce((x, y) => x + y, 0);
    const title = b >= 20 ? 'إمبراطور القارات 🌟' : b >= 12 ? 'سلطان العصر 👑' : b >= 6 ? 'ملك راسخ 🛡️' : 'حاكم ناشئ 🏰';
    realm.rankTitle = title;
    return `مباني المملكة: ${b}\nالرتبة الحالية: *${title}*`;
  }],
  ['ضرب_عملة', 'تحويل 100 ذهب مملكة إلى +120 عملة في محفظتك الشخصية', ({ u, realm }) => {
    const bonus = (realm.buildings['دار_السك'] || 0) * 35;
    if (realm.gold < 100) return '🪙 تحتاج 100 ذهب في الخزينة.';
    realm.gold -= 100;
    u.money += 120 + bonus;
    return `🪙 تم سك وإيداع +${120 + bonus} عملة في محفظتك الشخصية!`;
  }],
  ['إيداع_الخزينة', 'تحويل 100 عملة من محفظتك إلى خزينة المملكة (+120 ذهب)', ({ u, realm }) => {
    if (u.money < 100) return '💳 رصيدك الشخصي أقل من 100 عملة.';
    u.money -= 100;
    realm.gold += 120;
    return `🏦 تم دعم الخزينة بـ +120 ذهب ملكي!`;
  }],
  ['صناعة_سيف', 'صياغة سيوف متينة من 30 حديد لزيادة الجاهزية', ({ realm }) => {
    if (realm.iron < 30) return '⚙️ يلزم 30 حديد للصياغة.';
    realm.iron -= 30;
    realm.guards += 3;
    return '⚔️ تم تجهيز 3 فرسان جدد بسيوف فولاذية!';
  }],
  ['صناعة_درع', 'صياغة دروع واقية ترفع القوة والولاء', ({ realm }) => {
    if (realm.iron < 25) return '⚙️ يلزم 25 حديد.';
    realm.iron -= 25;
    realm.loyalty = Math.min(100, realm.loyalty + 3);
    return '🛡️ تم تعزيز دروع الحراسة (+3% استقرار)!';
  }],
  ['صناعة_سفينة', 'بناء سفينة تجارية جديدة في الميناء (70 ذهب + 40 حجر)', ({ realm }) => {
    if (realm.gold < 70 || realm.stone < 40) return '⛵ تحتاج 70 ذهب و40 حجر.';
    realm.gold -= 70; realm.stone -= 40;
    realm.gold += 140;
    return '⛵ انطلقت السفينة وعادت بأول شحنة أرباح (+140 ذهب)!';
  }],
  ['صهر_السبائك', 'تنقية 40 حجراً لاستخراج +25 حديد نقي', ({ realm }) => {
    if (realm.stone < 40) return '🪨 تحتاج 40 حجراً.';
    realm.stone -= 40;
    realm.iron += 25;
    return '🔥 تم صهر الصخور واستخراج +25 سبيكة حديد!';
  }],
  ['تجارة_القوافل', 'إرسال قافلة تجارية عبر الصحراء وجني الأرباح', ({ realm }) => {
    const bonus = (realm.buildings['إسطبل_الخيول'] || 0) * 30;
    const profit = 85 + Math.floor(Math.random() * 65) + bonus;
    realm.gold += profit;
    return `🐪 عادت القافلة سالمة بأرباح صافية: +${profit} ذهب!`;
  }],
  ['سوق_التوابل', 'صفقة تجارية في سوق التوابل مقابل الغذاء', ({ realm }) => {
    if (realm.food < 40) return '🌾 يلزم 40 وحدة غذاء للمقايضة.';
    realm.food -= 40;
    realm.gold += 95;
    return '🌶️ تم بيع فائض الحصاد بـ +95 ذهب!';
  }],
  ['مقايضة_ملكية', 'مبادلة 50 حجر مقابل 50 غذاء في السوق الإقليمي', ({ realm }) => {
    if (realm.stone < 50) return '🪨 يلزم 50 حجراً.';
    realm.stone -= 50; realm.food += 50;
    return '⚖️ تمت المقايضة بنجاح: -50 حجر / +50 غذاء.';
  }],
  ['تمويل_البحث', 'استثمار 80 ذهباً في أكاديمية العلوم (+30 معرفة)', ({ realm }) => {
    if (realm.gold < 80) return '🪙 يلزم 80 ذهباً.';
    realm.gold -= 80; realm.knowledge += 30;
    return `🔬 قفزت نقاط المعرفة إلى ${realm.knowledge}!`;
  }],
  ['تجنيد_حرس', 'تجنيد 10 حراس لتأمين المدن (60 ذهب + 30 غذاء)', ({ realm }) => {
    if (realm.gold < 60 || realm.food < 30) return '🛡️ يلزم 60 ذهب و30 غذاء.';
    realm.gold -= 60; realm.food -= 30; realm.guards += 10;
    return `🛡️ انضم 10 حراس جدد! المجموع: ${realm.guards}`;
  }],
  ['تجنيد_رماة', 'تدريب 8 رماة أسهم لحماية الأسوار (75 ذهب + 20 حديد)', ({ realm }) => {
    if (realm.gold < 75 || realm.iron < 20) return '🏹 يلزم 75 ذهب و20 حديد.';
    realm.gold -= 75; realm.iron -= 20; realm.archers += 8;
    return `🏹 انضم 8 رماة مهرة! المجموع: ${realm.archers}`;
  }],
  ['تجنيد_كشافة', 'تدريب 5 كشافة لفتح طرق التجارة (50 ذهب)', ({ realm }) => {
    if (realm.gold < 50) return '🧭 يلزم 50 ذهب.';
    realm.gold -= 50; realm.scouts += 5;
    return `🧭 ارتفع عدد الكشافة إلى ${realm.scouts}!`;
  }],
  ['تجنيد_علماء', 'استقطاب عالم جديد لنهضة المملكة (100 ذهب)', ({ realm }) => {
    if (realm.gold < 100) return '📜 يلزم 100 ذهب.';
    realm.gold -= 100; realm.scholars += 1; realm.knowledge += 20;
    return `🎓 انضم عالم جليل! العلماء: ${realm.scholars} | المعرفة: ${realm.knowledge}`;
  }],
  ['تعيين_وزير', 'تعيين وزير إداري لرفع كفاءة الديوان', ({ realm, txt }) => `🏛️ تم تعيين *${txt || 'وزير الحكمة'}* مستشاراً أول في ${realm.name}.`],
  ['تعيين_قائد_بحري', 'تعيين أدميرال لقيادة الأسطول التجاري', ({ txt }) => `⚓ تولّى *${txt || 'قبطان البحار'}* قيادة الأسطول الملكي!`],
  ['تعيين_مستشار', 'طلب نصيحة اقتصادية فورية من مستشارك الخاص', ({ realm }) => `📜 نصيحة اليوم: ${realm.knowledge < 80 ? 'ارفع نقاط المعرفة لفتح الأسرار الحضارية.' : 'ثروتك العلمية ممتازة، توسع في القوافل والاستكشاف!'}`],
  ['رحلة_استكشاف', 'إرسال الكشافة لاكتشاف وادٍ جديد وجمع الغنائم', ({ realm }) => {
    const g = 50 + realm.scouts * 6;
    realm.gold += g; realm.stone += 25;
    return `🗺️ اكتشفت البعثة وادياً خصباً وجلبت +${g} ذهب و +25 حجر!`;
  }],
  ['غوص_البحار', 'بحث الغواصين عن اللؤلؤ والمرجان قرب السواحل', ({ realm }) => {
    const g = 75 + (realm.buildings['ميناء_بحري'] || 0) * 35;
    realm.gold += g;
    return `🦪 عاد الغواصون بمحار ثمين بقيمة +${g} ذهب!`;
  }],
  ['عبور_الصحراء_الشرقية', 'بعثة صحراوية للبحث عن واحات وطرق قوافل', ({ realm }) => {
    realm.food += 55; realm.gold += 45;
    return '🏜️ اكتشف الكشافة واحة عذبة: +55 غذاء و +45 ذهب!';
  }],
  ['فتح_جزيرة', 'تأسيس مركز تجاري سلمي على جزيرة نائية', ({ realm }) => {
    realm.gold += 110; realm.knowledge += 12;
    return '🏝️ تم ربط الجزيرة التجارية بشبكتك: +110 ذهب و +12 معرفة!';
  }],
  ['تحصين_الحدود', 'تعزيز الأبراج والأسوار لحماية الحدود', ({ realm }) => {
    if (realm.stone < 45) return '🪨 يلزم 45 حجراً.';
    realm.stone -= 45; realm.loyalty = Math.min(100, realm.loyalty + 5);
    return '🏰 ارتفعت الأسوار الحصينة واطمأن المواطنون!';
  }],
  ['مناورة_عسكرية', 'تدريب ميداني سلمي لرفع جاهزية الحرس والرماة', ({ realm }) => {
    realm.knowledge += 10;
    return `⚔️ أتم الحرس (${realm.guards}) والرماة (${realm.archers}) مناورة الانضباط بنجاح!`;
  }],
  ['حملة_تأمين_الطرق', 'تأمين طرق القوافل من قطاع الطرق', ({ realm }) => {
    realm.gold += 70; realm.loyalty = Math.min(100, realm.loyalty + 4);
    return '🛡️ أصبحت الطرق آمنة تماماً، وتدفقت تجارة +70 ذهب!';
  }],
  ['استكشاف_كهف_المملكة', 'مغامرة داخل الكهف البلوري للبحث عن آثار وذهب', ({ realm }) => {
    const relicPool = ['تاج النور', 'بوصلة الملاح', 'مخطوطة الخلود', 'درع الأمل', 'خاتم الحكمة', 'منظار النجوم'];
    const found = pickRandom(relicPool);
    const added = !realm.relics.includes(found);
    if (added) realm.relics.push(found);
    realm.gold += 90;
    return added ? `💎 اكتشفت أثراً نادراً في الكهف: *${found}* + 90 ذهب!` : '🪙 استخرجت +90 ذهب من العروق البلورية!';
  }],
  ['معركة_حراس_الأنقاض', 'تحدي تماثيل الأنقاض الحجرية لاختبار قوة جيشك', ({ realm }) => {
    const power = realm.guards * 2 + realm.archers * 3;
    if (power < 35) return `⚔️ قوتك الحالية (${power}) لا تكفي! جنّد مزيداً من الحرس لتجاوز 35.`;
    realm.gold += 160; realm.iron += 35;
    return `🏆 انتصرت بقوة (${power})! الغنيمة: +160 ذهب و +35 حديد.`;
  }],
  ['متحف_المملكة', 'عرض قائمة الآثار والمقتنيات الملكية النادرة التي جمعتها', ({ realm }) =>
    realm.relics.length ? realm.relics.map((r, i) => `${i + 1}. 🏺 ${r}`).join('\n') : 'المتحف فارغ حالياً — استكشف الكهف عبر `.استكشاف_كهف_المملكة`!'
  ],
  ['عقد_تحالف', 'توقيع ميثاق تعاون وصداقة سلمية مع مملكة مجاورة', ({ txt }) => `🤝 تم توقيع ميثاق التعاون والازدهار المشترك مع *${txt || 'مملكة الأفق'}*.`],
  ['إرسال_هدية_دبلوماسية', 'إهداء قافلة رمزية (50 ذهب) لتعزيز العلاقات', ({ realm }) => {
    if (realm.gold < 50) return '🪙 يلزم 50 ذهب.';
    realm.gold -= 50; realm.loyalty = Math.min(100, realm.loyalty + 6);
    return '🎁 أشادت الممالك بكرمك وازدادت هيبة دولتك!';
  }],
  ['معاهدة_تجارة', 'اتفاقية تجارة حرة مستمرة تدرّ +80 ذهباً فورياً', ({ realm }) => {
    realm.gold += 80;
    return '📜 دُشّن خط التجارة المفتوح: +80 ذهب!';
  }],
  ['تحكيم_النزاع', 'حل نزاع حدودي بالحكمة والدبلوماسية', ({ realm }) => {
    realm.knowledge += 15; realm.loyalty = Math.min(100, realm.loyalty + 5);
    return '⚖️ أشاد الجميع بحكمتك ونلت +15 معرفة!';
  }],
  ['إعلان_الهدنة', 'تعليق الحملات وإعلان عام الرخاء والسلام', ({ realm }) => {
    realm.food += 45; realm.loyalty = Math.min(100, realm.loyalty + 7);
    return '🕊️ عمّ السلام وزاد الإنتاج الزراعي +45 غذاء!';
  }],
  ['مكافأة_العروش', 'صرف منحة العرش التأسيسية المتجددة', ({ realm }) => {
    realm.gold += 100;
    return '👑 صُرفت منحة ديوان العرش: +100 ذهب للخزينة!';
  }],
  ['تقرير_الحصاد', 'تقييم الإنتاج المتوقع من كافة منشآتك الحالية', ({ realm }) => {
    const b = realm.buildings;
    return `🪙 الذهب المتوقع: ${60 + (b['منجم_ذهب'] || 0) * 45 + (b['سوق_كبير'] || 0) * 35}/دورة\n🌾 الغذاء المتوقع: ${40 + (b['مزرعة_ملكية'] || 0) * 35}/دورة`;
  }],
  ['توزيع_الأراضي', 'منح أراضٍ زراعية للأسر لزيادة الرخاء', ({ realm }) => {
    realm.food += 50; realm.loyalty = Math.min(100, realm.loyalty + 6);
    return '🌱 أثمرت الأراضي الموزعة +50 غذاء ورضا شعبياً!';
  }],
  ['تطوير_الأسطول', 'تحديث أشرعة السفن بـ 30 حديد', ({ realm }) => {
    if (realm.iron < 30) return '⚙️ يلزم 30 حديد.';
    realm.iron -= 30; realm.gold += 90;
    return '⛵ ارتفعت سرعة الأسطول وعاد بعائد +90 ذهب!';
  }],
  ['شجرة_العلوم', 'عرض مراحل النهضة العلمية الأربعة في مملكتك', ({ realm }) =>
    `📚 نقاطك العلمية: ${realm.knowledge}\n1) الزراعة (20)\n2) الهندسة البحرية (60)\n3) الفلك والميكانيكا (120)\n4) العصر الذهبي (250)`
  ],
  ['تأمين_القوافل', 'تخصيص كشافين لحماية خطوط الإمداد', ({ realm }) => `🐪 خطوط القوافل محمية بالكامل بفضل ${realm.scouts} كشاف.`],
  ['فحص_الكنز', 'فحص وتلميع التحف الموجودة في المتحف الملكي', ({ realm }) => `✨ عدد التحف المصقولة: ${realm.relics.length} تحفة تاريخية.`],
  ['استخراج_أثر_قديم', 'تنقيب أثري عن قطعة منقوشة بالمعرفة', ({ realm }) => {
    realm.knowledge += 22;
    return '🏺 استُخرج لوح منقوش أضاف +22 نقطة معرفة!';
  }],
  ['ميثاق_العرش', 'استعراض المبادئ السبعة للحكم الرشيد في مملكتك', () =>
    '1. العدل أساس الملك\n2. العلم يسبق السيف\n3. استقرار الغذاء أمن قومي\n4. التجارة شريان الازدهار\n5. التحصين يمنع الطمع\n6. الشورى تحفظ القرار\n7. الوفاء بالعهد.'
  ],
  ['موسوعة_المماليك', 'نبذة تاريخية عن أعظم الحضارات والممالك العربية والعالمية', ({ txt }) =>
    seededPick([
      'حضارة الأندلس: منارة للطب والفلك والمكتبات في قرطبة وطليطلة.',
      'الحضارة المصرية القديمة: هندسة الأهرامات والتقويم الشمسي الدقيق.',
      'بابل وآشور: شريعة حمورابي وحدائق بابل والعلوم الفلكية الأولى.'
    ], txt || 'hist')
  ],
  ['مقارنة_الحضارات', 'مؤشر قوة حضارتك مقارنة بمتوسط الممالك الكلاسيكية', ({ realm }) => {
    const score = realm.gold + realm.knowledge * 5 + Object.keys(realm.buildings).length * 40;
    return `📊 مؤشر مجد حضارتك: *${score}* نقطة!`;
  }],
  ['ترتيب_الممالك', 'عرض تصنيف أغنى الممالك المسجلة في الذاكرة الحالية', () => {
    const users = Object.entries(global.db?.users || {})
      .filter(([, v]) => v?.realm)
      .sort((a, b) => (b[1].realm.gold || 0) - (a[1].realm.gold || 0))
      .slice(0, 5);
    if (!users.length) return 'لا توجد ممالك مسجلة بعد! كن أول مؤسس عبر `.تأسيس_مملكة`';
    return users.map(([id, v], i) => `${i + 1}. 👑 *${v.realm.name}* (${id.split('@')[0]}) — ${v.realm.gold} ذهب`).join('\n');
  }]
];

for (const [cmd, desc, fn] of REALM_ACTIONS) {
  add(cmd, desc, async (m, ctx) => {
    const { u, realm } = ensureRealm(m.sender);
    const txt = String(ctx.text || '').trim();
    const out = fn({ u, realm, txt });
    awardUser(m.sender, 15, 15);
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: realm.name,
      badge: '👑',
      body: out,
      theme: 'royal'
    });
  }, [cmd]);
}

// ── 4. 16 Legendary Relics & Chronicles Encyclopedia ──
const RELICS_GUIDE = [
  ['تاج_النور', 'رمز القيادة المستنيرة والشرعية في الديوان الملكي'],
  ['صولجان_العدالة', 'شارة القضاء المنصف الذي يرفع ثقة المواطنين'],
  ['خاتم_الحكمة', 'الختم الرسمي للمعاهدات والاتفاقيات طويلة الأمد'],
  ['بوصلة_الملاح', 'أداة ملاحية تاريخية تضاعف دقة الإبحار ليلاً'],
  ['مخطوطة_الخلود', 'وثيقة علمية تضم أسرار الفلك والهندسة المعمارية'],
  ['درع_الأمل', 'درع احتفالي يُرفع على أسوار القلعة يوم النصر'],
  ['راية_السلام', 'الراية البيضاء المزخرفة بالذهب لبعثات الدبلوماسية'],
  ['مفتاح_الكنوز', 'مفتاح الخزائن السفلية تحت القصر الملكي'],
  ['منظار_النجوم', 'منظار نحاسي عتيق لمراقبة الأبراج والسفن البعيدة'],
  ['عدسة_النار', 'عدسة أرخميدس الكروية لتركيز أشعة الشمس'],
  ['ساعة_الرمل_الملكية', 'ميقاتية جلسات مجلس الشورى لإدارة الوقت بحزم'],
  ['ختم_السلطان', 'الختم المعتمد لتصديق المراسيم الكبرى'],
  ['معاهدة_الواحات', 'وثيقة حماية المسافرين والقوافل بين المدن'],
  ['خريطة_البحار_السبعة', 'مخطوطة الملاحين العرب لطرق الرياح الموسمية'],
  ['مقياس_النيل_التاريخي', 'نظام رصد فيضان الأنهار لتخطيط مواسم الزراعة'],
  ['قانون_الأسواق', 'دستور الأمانة في الموازين ومنع الاحتكار'],
  ['مدرسة_الفرسان', 'منهج تربية النخبة على الفروسية والأدب والشجاعة'],
  ['أبراج_الحمام_الزاجل', 'أسرع شبكة اتصالات بريدية عرفتها الممالك القديمة'],
  ['طواحين_الرياح_الشرقية', 'اختراع هندسي لتسخير الرياح في طحن الحبوب وضخ المياه'],
  ['صناعة_الأسطرلاب', 'حاسوب الفلك المحمول لتحديد الوقت وارتفاع النجوم'],
  ['قنوات_الأفلاج', 'هندسة القنوات الجوفية لنقل المياه دون تبخر'],
  ['سفن_الداو_العربية', 'السفن مثلثة الشراع القادرة على الإبحار عكس الريح'],
  ['مستشفيات_البيمارستان', 'أولى المستشفيات التعليمية المجانية في التاريخ الإسلامي'],
  ['بيت_الحكمة_التاريخي', 'أعظم مركز ترجمة وبحث علمي جمع علماء العالم'],
  ['ديوان_الحسبة', 'مؤسسة الرقابة الحضارية على جودة البضائع والبيئة'],
  ['مواثيق_التسامح', 'صكوك التعايش التي صنعت ازدهار المدن متعددة الثقافات']
];

for (const [cmd, desc] of RELICS_GUIDE) {
  add(cmd, desc, async (m, ctx) => {
    const { realm } = ensureRealm(m.sender);
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: 'موسوعة الإرث الحضاري والمقتنيات',
      badge: '🏺',
      body: `📜 *الوصف:* ${desc}\n🏰 *في مملكتك (${realm.name}):* ${realm.relics.includes(cmd.replace(/_/g, ' ')) ? 'مقتنى داخل متحفك ✅' : 'يمكن اكتسابه عبر البعثات والاستكشاف 🗺️'}`,
      theme: 'royal'
    });
  }, [cmd], 'info');
}

// ── 5. Interactive Poll & HTML Kingdom Map Widget ──
add('تصويت_المجلس_الملكي', 'تصويت مجلس الشورى لاختيار مشروع التطوير القادم للمملكة', async (m, ctx) => {
  await sendInteractivePoll(m, ctx, {
    name: 'ما أولوية المجلس الملكي في الخطة الخمسية القادمة؟',
    values: ['🌾 توسيع المزارع وقنوات الري', '🎓 بناء الأكاديمية والمكتبة', '⛵ تطوير الأسطول والميناء', '🛡️ تحصين الأسوار وتدريب الحرس'],
    selectableCount: 1
  });
}, ['تصويت_المجلس_الملكي'], 'native');

add('ودجت_خريطة_المملكة', 'فتح خريطة تفاعلية مصغرة لحالة مملكتك بصيغة HTML', async (m, ctx) => {
  const { realm } = ensureRealm(m.sender);
  const html = makeSimpleHtmlWidget(`🏰 خريطة ${realm.name}`, '#f59e0b', [
    ['العاصمة', realm.capital],
    ['الذهب / الحديد', `${realm.gold} / ${realm.iron}`],
    ['الحجارة / الغذاء', `${realm.stone} / ${realm.food}`],
    ['الولاء / المعرفة', `${realm.loyalty}% / ${realm.knowledge}`]
  ]);
  await sendInteractiveWidget(m, ctx, { title: `خريطة ${realm.name}`, html, fallbackText: `${realm.name} — الذهب: ${realm.gold}` });
}, ['ودجت_خريطة_المملكة'], 'native');

export default handlers;
