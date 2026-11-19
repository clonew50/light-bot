/**
 * plugins/packs/chronos_time_pack.js — حزمة الزمن والإنتاجية والفلك الزمني (105+ أمر إبداعي)
 */
import {
  ensureDbUser,
  awardUser,
  parseNumbers,
  splitArgsPipe,
  seededPick,
  makeSimpleHtmlWidget,
  formatDurationAr,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeCopyButton,
  makeQuickButton
} from '../../system/creativePackUtils.js';

const handlers = [];
const add = (cmd, desc, fn, usage, cat = 'tools') => {
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

// ── 1. Time Capsules & Future Vault (DB Persistent) ──
add('كبسولة_زمن', 'حفظ رسالة في كبسولة زمنية تفتح بعد مدة محددة (مثال: .كبسولة_زمن 7 | رسالتي لنفسي)', async (m, ctx) => {
  const parts = splitArgsPipe(ctx);
  if (parts.length < 2) {
    return sendInteractiveCard(m, ctx, {
      title: 'كبسولة الزمن الشخصية',
      badge: '⏳',
      body: 'اكتب عدد الأيام ثم الرسالة مفصولة بـ `|`:\n`.كبسولة_زمن 30 | أرجو أن تكون قد أنهيت مشروعك!`',
      theme: 'royal',
      buttons: [makeQuickButton('📦 عرض كبسولاتي', 'كبسولاتي'), makeQuickButton('🔓 فتح الجاهز', 'فتح_كبسولتي')]
    });
  }
  const parsedDays = parseFloat(parts[0]);
  const days = Math.max(0, Math.min(3650, Number.isFinite(parsedDays) ? parsedDays : 1));
  const message = parts.slice(1).join(' | ');
  const u = ensureDbUser(m.sender);
  if (!Array.isArray(u.capsules)) u.capsules = [];
  const now = Date.now();
  const unlockAt = now + Math.round(days * 86400000);
  const id = `CAP-${(u.capsules.length + 1).toString(36).toUpperCase()}-${now.toString(36).slice(-3).toUpperCase()}`;
  u.capsules.push({ id, message, createdAt: now, unlockAt, opened: false });
  awardUser(m.sender, 25, 15);
  await sendInteractiveCard(m, ctx, {
    title: 'تم إغلاق كبسولة الزمن بنجاح',
    badge: '🔒',
    fields: [
      { icon: '🆔', label: 'رقم الكبسولة', value: id },
      { icon: '🗓️', label: 'تُفتح بعد', value: `${days} يوم` },
      { icon: '🎁', label: 'مكافأة الالتزام', value: '+25 🪙 | +15 XP' }
    ],
    theme: 'royal',
    buttons: [makeQuickButton('📦 كبسولاتي', 'كبسولاتي'), makeCopyButton('📋 نسخ الرقم', id)]
  });
}, ['كبسولة_زمن <أيام> | <الرسالة>']);

add('كبسولاتي', 'استعراض جميع كبسولات الزمن الخاصة بك ونسبة اكتمال الوقت', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const list = Array.isArray(u.capsules) ? u.capsules : [];
  if (!list.length) {
    return sendInteractiveCard(m, ctx, {
      title: 'خزنة كبسولات الزمن فارغة',
      badge: '⏳',
      body: 'لم تقم بحفظ أي كبسولة زمنية بعد.\nاكتب `.كبسولة_زمن 7 | هدفك القادم` لحفظ أول رسالة.',
      theme: 'cyber'
    });
  }
  const now = Date.now();
  const lines = list.slice(-6).map((c) => {
    const total = Math.max(1, c.unlockAt - c.createdAt);
    const done = Math.min(total, Math.max(0, now - c.createdAt));
    const ready = now >= c.unlockAt;
    return `• *${c.id}* — ${ready ? '🔓 جاهزة للفتح!' : `⏳ متبقي ${formatDurationAr(c.unlockAt - now)}`}\n  ${progressBar(done, total, 8)}`;
  }).join('\n');
  await sendInteractiveCard(m, ctx, {
    title: 'سجل كبسولاتك الزمنية',
    badge: '📦',
    body: lines,
    theme: 'royal',
    buttons: [makeQuickButton('🔓 فتح الكبسولات الجاهزة', 'فتح_كبسولتي')]
  });
});

add('فتح_كبسولتي', 'فتح جميع كبسولات الزمن التي حان وقتها', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const list = Array.isArray(u.capsules) ? u.capsules : [];
  const now = Date.now();
  const ready = list.filter((c) => now >= c.unlockAt && !c.opened);
  if (!ready.length) {
    return sendInteractiveCard(m, ctx, {
      title: 'لا توجد كبسولات جاهزة للفتح الآن',
      badge: '🔒',
      body: list.length ? 'ما زال الوقت مبكراً على كبسولاتك المحفوظة. راجعها عبر `.كبسولاتي`.' : 'أنشئ كبسولتك الأولى عبر `.كبسولة_زمن 0 | تجربة فورية`.',
      theme: 'cyber',
      buttons: [makeQuickButton('📦 عرض الكبسولات', 'كبسولاتي')]
    });
  }
  for (const c of ready) c.opened = true;
  awardUser(m.sender, 40 * ready.length, 25 * ready.length);
  const body = ready.map((c) => `🔓 *${c.id}* (${new Date(c.createdAt).toLocaleDateString('ar-EG')}):\n"${c.message}"`).join('\n\n');
  await sendInteractiveCard(m, ctx, {
    title: `رسائل من الماضي (${ready.length})`,
    badge: '📜',
    body,
    tip: `حصلت على +${40 * ready.length} عملة لفتح كبسولتك في موعدها!`,
    theme: 'royal'
  });
});

add('ختم_زمني', 'توليد ختم زمني رقمي فريد باللحظة الحالية بصيغ متعددة', async (m, ctx) => {
  const d = new Date();
  const unix = Math.floor(d.getTime() / 1000);
  await sendInteractiveCard(m, ctx, {
    title: 'الختم الزمني الدقيق',
    badge: '🕰️',
    fields: [
      { icon: '🌐', label: 'ISO 8601', value: d.toISOString() },
      { icon: '⏱️', label: 'Unix (ثوانٍ)', value: String(unix) },
      { icon: '⚡', label: 'مللي ثانية', value: String(d.getTime()) },
      { icon: '📅', label: 'التوقيت المحلي', value: d.toLocaleString('ar-EG') }
    ],
    theme: 'cyber',
    buttons: [makeCopyButton('📋 نسخ ISO', d.toISOString()), makeCopyButton('📋 نسخ Unix', String(unix))]
  });
});

add('عقد_الالتزام', 'توقيع عقد التزام ذاتي في قاعدة البيانات لهدف معين لمدة أيام', async (m, ctx) => {
  const parts = splitArgsPipe(ctx);
  if (parts.length < 2) {
    return sendInteractiveCard(m, ctx, {
      title: 'ميثاق الالتزام الشخصي',
      badge: '📜',
      body: 'اكتب الهدف وعدد الأيام مفصولاً بـ `|`:\n`.عقد_الالتزام قراءة 20 صفحة يومياً | 21`',
      theme: 'royal'
    });
  }
  const u = ensureDbUser(m.sender);
  if (!Array.isArray(u.promises)) u.promises = [];
  const days = Math.max(1, Math.min(365, parseFloat(parts[1]) || 7));
  const id = `PACT-${u.promises.length + 1}`;
  u.promises.push({ id, goal: parts[0], days, createdAt: Date.now(), verified: false });
  awardUser(m.sender, 20, 20);
  await sendInteractiveCard(m, ctx, {
    title: 'تم توثيق عقد الالتزام',
    badge: '✍️',
    fields: [
      { icon: '🎯', label: 'الهدف', value: parts[0] },
      { icon: '📆', label: 'المدة', value: `${days} يوم` },
      { icon: '🆔', label: 'الرمز', value: id }
    ],
    theme: 'royal',
    buttons: [makeQuickButton('📋 سجل الوعود', 'سجل_الوعود'), makeQuickButton('✅ توثيق الإنجاز', 'تحقق_عقدي')]
  });
}, ['عقد_الالتزام <الهدف> | <الأيام>']);

add('سجل_الوعود', 'عرض عقود الالتزام الموثقة ونسبة إنجازها', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const list = u.promises || [];
  if (!list.length) return m.reply('📜 لا توجد وعود مسجلة بعد. ابدأ بـ `.عقد_الالتزام هدفك | 14`');
  const body = list.slice(-5).map((p) => `• *${p.id}*: ${p.goal} (${p.days} يوم) — ${p.verified ? '✅ منجز' : '🔥 قيد التنفيذ'}`).join('\n');
  await sendInteractiveCard(m, ctx, { title: 'سجل عقود الالتزام', badge: '📒', body, theme: 'emerald' });
});

add('تحقق_عقدي', 'إتمام آخر عقد التزام مفتوح وحصد المكافأة المضاعفة', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const open = (u.promises || []).find((p) => !p.verified);
  if (!open) return m.reply('📌 لا يوجد عقد مفتوح حالياً. أنشئ واحداً عبر `.عقد_الالتزام`.');
  open.verified = true;
  awardUser(m.sender, 150, 90);
  await sendInteractiveCard(m, ctx, {
    title: 'إنجاز مشرّف!',
    badge: '🏆',
    body: `تم إتمام العقد *${open.id}*: "${open.goal}"\nحصلت على +150 🪙 و +90 XP!`,
    theme: 'royal'
  });
});

// ── 2. Relativistic & Deep Time Calculators ──
const RELATIVITY_CMDS = [
  ['تمدد_الزمن', 'حساب تباطؤ الزمن النسبي لمركبة بسرعة معينة (% من سرعة الضوء)', [50, 10], ([pct, yrs]) => {
    const v = Math.min(99.99, Math.max(0.1, pct)) / 100;
    const gamma = 1 / Math.sqrt(1 - v * v);
    return [
      { icon: '🚀', label: 'السرعة المختارة', value: `${(v * 100).toFixed(2)}% من سرعة الضوء` },
      { icon: '⏳', label: 'زمن المسافر', value: `${yrs} سنة` },
      { icon: '🌍', label: 'الزمن على الأرض', value: `${(yrs * gamma).toFixed(2)} سنة` },
      { icon: '📐', label: 'معامل لورنتز γ', value: gamma.toFixed(4) }
    ];
  }, 'تمدد_الزمن <نسبة_السرعة%> <سنوات>'],
  ['انكماش_الطول', 'حساب تقلص طول الجسم المتحرك بسرعة قريبة من الضوء', [80, 100], ([pct, len]) => {
    const v = Math.min(99.99, Math.max(0.1, pct)) / 100;
    const contracted = len * Math.sqrt(1 - v * v);
    return [
      { icon: '📏', label: 'الطول الأصلي', value: `${len} متر` },
      { icon: '⚡', label: 'الطول الظاهري بالحركة', value: `${contracted.toFixed(3)} متر` }
    ];
  }, 'انكماش_الطول <نسبة_السرعة%> <الطول_بالمتر>'],
  ['سرعة_الضوء', 'حساب الزمن اللازم للضوء لقطع مسافة بالكيلومتر', [384400], ([km]) => {
    const sec = km / 299792.458;
    return [
      { icon: '🌌', label: 'المسافة', value: `${km.toLocaleString('en-US')} كم` },
      { icon: '💡', label: 'زمن رحلة الضوء', value: sec < 60 ? `${sec.toFixed(4)} ثانية` : `${(sec / 60).toFixed(3)} دقيقة` }
    ];
  }, 'سرعة_الضوء <المسافة_كم>'],
  ['طاقة_النسبية', 'حساب الطاقة الكتلية حسب معادلة أينشتاين E=mc² (بالكيلوجرام)', [0.001], ([kg]) => {
    const c = 299792458;
    const joules = kg * c * c;
    return [
      { icon: '⚖️', label: 'الكتلة', value: `${kg} كجم` },
      { icon: '💥', label: 'الطاقة المكافئة', value: `${joules.toExponential(3)} جول` },
      { icon: '⚡', label: 'تكافئ طن TNT', value: `${(joules / 4.184e9).toExponential(2)} طن` }
    ];
  }, 'طاقة_النسبية <الكتلة_كجم>'],
  ['الزمن_عند_الثقب_الأسود', 'حساب تباطؤ الساعة قرب أفق حدث ثقب أسود', [1.5], ([ratio]) => {
    const r = Math.max(1.01, ratio);
    const factor = Math.sqrt(1 - 1 / r);
    return [
      { icon: '🕳️', label: 'البعد عن أفق الحدث', value: `${r}× نصف قطر شوارزشيلد` },
      { icon: '⌚', label: 'ساعة واحدة هناك تساوي', value: `${(1 / factor).toFixed(3)} ساعة في الفضاء البعيد` }
    ];
  }, 'الزمن_عند_الثقب_الأسود <نسبة_الابتعاد>'],
  ['مسافة_بالسنوات_الضوئية', 'تحويل السنوات الضوئية إلى كيلومترات وترليونات الكيلومترات', [4.24], ([ly]) => [
    { icon: '✨', label: 'السنوات الضوئية', value: `${ly} سنة ضوئية` },
    { icon: '🚀', label: 'المسافة بالكيلومتر', value: `${(ly * 9.461e12).toExponential(3)} كم` },
    { icon: '🛰️', label: 'بوحدات AU', value: `${Math.round(ly * 63241).toLocaleString('en-US')} AU` }
  ], 'مسافة_بالسنوات_الضوئية <سنوات>'],
  ['زمن_الانتقال_للمريخ', 'حساب مدة رحلة افتراضية إلى المريخ حسب سرعة المركبة (كم/ساعة)', [40000], ([spd]) => {
    const dist = 225000000;
    const hrs = dist / Math.max(100, spd);
    return [
      { icon: '🔴', label: 'متوسط بعد المريخ', value: '225 مليون كم' },
      { icon: '🛸', label: 'السرعة', value: `${spd.toLocaleString('en-US')} كم/س` },
      { icon: '🗓️', label: 'مدة الرحلة', value: `${(hrs / 24).toFixed(1)} يوم` }
    ];
  }, 'زمن_الانتقال_للمريخ <السرعة_كم_س>'],
  ['سفر_بأقرب_نجم', 'الزمن اللازم للوصول إلى بروكسيما سنتوري بسرعة مركبتك (% من الضوء)', [10], ([pct]) => {
    const yrs = 4.24 / Math.max(0.01, Math.min(100, pct) / 100);
    return [
      { icon: '🌟', label: 'النجم الهدف', value: 'بروكسيما سنتوري (4.24 سنة ضوئية)' },
      { icon: '⏳', label: 'مدة الوصول', value: `${yrs.toFixed(1)} سنة أرضية` }
    ];
  }, 'سفر_بأقرب_نجم <نسبة_سرعة_الضوء%>'],
  ['عمر_الشمس_المتبقي', 'تقدير المرحلة العمرية الحالية للشمس والمتبقي قبل العملاق الأحمر', [], () => [
    { icon: '☀️', label: 'العمر الحالي', value: '4.6 مليار سنة' },
    { icon: '🔥', label: 'المتبقي في النسق الأساسي', value: '≈ 5.0 مليار سنة' },
    { icon: '📊', label: 'اكتمال عمرها الهيدروجيني', value: progressBar(46, 96, 10) }
  ], 'عمر_الشمس_المتبقي'],
  ['سرعة_الهروب_الزمني', 'حساب سرعة الإفلات من جاذبية كوكب بكتلته ونصف قطره بالنسبة للأرض', [1, 1], ([mRatio, rRatio]) => {
    const v = 11.186 * Math.sqrt(Math.max(0.01, mRatio) / Math.max(0.01, rRatio));
    return [
      { icon: '🪐', label: 'نسبة الكتلة / القطر', value: `${mRatio}M / ${rRatio}R` },
      { icon: '🚀', label: 'سرعة الإفلات المطلوبة', value: `${v.toFixed(2)} كم/ث (${Math.round(v * 3600).toLocaleString('en-US')} كم/س)` }
    ];
  }, 'سرعة_الهروب_الزمني <كتلة_نسبية> <قطر_نسبي>']
];

for (const [cmd, desc, defs, calc, usage] of RELATIVITY_CMDS) {
  add(cmd, desc, async (m, ctx) => {
    const vals = parseNumbers(ctx, defs);
    await sendInteractiveCard(m, ctx, {
      title: desc.split('(')[0].trim(),
      badge: '🌌',
      fields: calc(vals),
      theme: 'cyber'
    });
  }, [usage]);
}

// ── 3. Sleep, Life-Weeks & Productivity Architects ──
add('مخطط_دورة_النوم', 'حساب أفضل أوقات الاستيقاظ بناءً على دورات النوم (90 دقيقة لكل دورة)', async (m, ctx) => {
  const [h, min] = parseNumbers(ctx, [23, 0]);
  const baseMin = ((h % 24) * 60) + (min % 60) + 15; // 15 min to fall asleep
  const cycles = [4, 5, 6].map((c) => {
    const total = (baseMin + c * 90) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return { icon: '⏰', label: `${c} دورات (${(c * 1.5).toFixed(1)} ساعة)`, value: `الاستيقاظ الساعة ${hh}:${mm}` };
  });
  await sendInteractiveCard(m, ctx, {
    title: 'مهندس دورات النوم',
    subtitle: `بفرض النوم الساعة ${String(h % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')} (+15د للاستغراق)`,
    badge: '😴',
    fields: cycles,
    tip: 'الاستيقاظ بين الدورات يمنع خمول الصباح ويجدد التركيز.',
    theme: 'royal'
  });
}, ['مخطط_دورة_النوم <ساعة> <دقيقة>']);

add('وقت_الاستيقاظ_المثالي', 'احسب متى تنام إذا أردت الاستيقاظ في ساعة محددة بكامل نشاطك', async (m, ctx) => {
  const [h, min] = parseNumbers(ctx, [7, 0]);
  const target = ((h % 24) * 60) + (min % 60);
  const fields = [6, 5, 4].map((c) => {
    const start = (target - c * 90 - 15 + 1440 * 3) % 1440;
    const hh = String(Math.floor(start / 60)).padStart(2, '0');
    const mm = String(start % 60).padStart(2, '0');
    return { icon: '🌙', label: `للحصول على ${c} دورات`, value: `ادخل السرير ${hh}:${mm}` };
  });
  await sendInteractiveCard(m, ctx, { title: 'موعد النوم المثالي', badge: '🛏️', fields, theme: 'royal' });
}, ['وقت_الاستيقاظ_المثالي <ساعة> <دقيقة>']);

add('خريطة_الأسابيع_بالعمر', 'تصور عمرك بالأسابيع والأشهر مقارنة بمتوسط 80 سنة (4160 أسبوعاً)', async (m, ctx) => {
  const [age] = parseNumbers(ctx, [22]);
  const safeAge = Math.max(1, Math.min(110, age));
  const totalWeeks = 80 * 52;
  const livedWeeks = Math.round(safeAge * 52);
  const leftWeeks = Math.max(0, totalWeeks - livedWeeks);
  await sendInteractiveCard(m, ctx, {
    title: 'خريطة حياتك بالأسابيع',
    badge: '🗓️',
    fields: [
      { icon: '🎂', label: 'العمر المدخل', value: `${safeAge} سنة` },
      { icon: '✅', label: 'الأسابيع المنقضية', value: `${livedWeeks.toLocaleString('en-US')} أسبوع` },
      { icon: '⏳', label: 'متبقي في مقياس 80 سنة', value: `${leftWeeks.toLocaleString('en-US')} أسبوع` },
      { icon: '📊', label: 'مؤشر المرحلة', value: progressBar(livedWeeks, totalWeeks, 12) }
    ],
    tip: 'كل مربع أسبوع هو فرصة لإنجاز لا يُنسى.',
    theme: 'crimson'
  });
}, ['خريطة_الأسابيع_بالعمر <العمر>']);

const PRODUCTIVITY_CALCULATORS = [
  ['موعد_النوم_الصحي', 'تقييم عدد ساعات نومك وهل يوافق التوصية الطبية', [7], ([hrs]) => [
    { icon: '🛌', label: 'ساعات نومك', value: `${hrs} ساعة` },
    { icon: '🩺', label: 'التقييم الطبي', value: hrs >= 7 && hrs <= 9 ? 'مثالي للبالغين ✅' : hrs < 7 ? 'نقص نوم — يعيق التركيز ⚠️' : 'نوم زائد عن المتوسط ℹ️' }
  ], 'موعد_النوم_الصحي <ساعات>'],
  ['كفاءة_نومي', 'حساب نسبة كفاءة النوم من الوقت الفعلي على السرير', [7, 8], ([asleep, inBed]) => {
    const eff = Math.min(100, Math.round((asleep / Math.max(0.5, inBed)) * 100));
    return [
      { icon: '📈', label: 'كفاءة النوم', value: progressBar(eff, 100, 10) },
      { icon: '💡', label: 'التصنيف', value: eff >= 85 ? 'ممتازة 🌟' : 'تحتاج تقليل السهر بالهاتف 📱' }
    ];
  }, 'كفاءة_نومي <ساعات_النوم> <ساعات_السرير>'],
  ['عد_تنازلي_للعمر', 'حساب كم ثانية ودقيقة وساعة عشت حتى الآن تقريباً', [20], ([age]) => {
    const days = Math.round(age * 365.25);
    return [
      { icon: '📅', label: 'الأيام التقريبية', value: days.toLocaleString('en-US') },
      { icon: '⏰', label: 'الساعات التقريبية', value: (days * 24).toLocaleString('en-US') },
      { icon: '💓', label: 'دقات القلب التقديرية', value: `${Math.round(days * 24 * 60 * 72 / 1e6)} مليون نبضة` }
    ];
  }, 'عد_تنازلي_للعمر <العمر>'],
  ['متبقي_على_التقاعد', 'حساب السنوات والشهور المتبقية على عمر التقاعد (60 أو كما تحدد)', [25, 60], ([age, ret]) => {
    const diff = Math.max(0, ret - age);
    return [
      { icon: '🏁', label: 'سنوات العمل المتبقية', value: `${diff} سنة (${Math.round(diff * 12)} شهراً)` },
      { icon: '📊', label: 'مسار الرحلة المهنية', value: progressBar(Math.max(0, age - 20), Math.max(1, ret - 20), 10) }
    ];
  }, 'متبقي_على_التقاعد <عمرك> <سن_التقاعد>'],
  ['ميزانية_وقتي', 'توزيع 24 ساعة في اليوم بين النوم والعمل والتطوير والراحة', [8, 8], ([sleep, work]) => {
    const free = Math.max(0, 24 - sleep - work);
    return [
      { icon: '😴', label: 'النوم', value: `${sleep} ساعة` },
      { icon: '💼', label: 'العمل/الدراسة', value: `${work} ساعة` },
      { icon: '✨', label: 'الوقت الحر للتطوير والراحة', value: `${free} ساعة (${Math.round((free / 24) * 100)}%)` }
    ];
  }, 'ميزانية_وقتي <ساعات_النوم> <ساعات_العمل>'],
  ['ضريبة_التأجيل', 'حساب عدد الساعات الضائعة سنوياً بسبب التسويف اليومي بالدقائق', [45], ([minPerDay]) => {
    const hrsYear = (minPerDay * 365) / 60;
    return [
      { icon: '📱', label: 'التأجيل اليومي', value: `${minPerDay} دقيقة` },
      { icon: '⚠️', label: 'الفاقد السنوي', value: `${Math.round(hrsYear)} ساعة (≈ ${(hrsYear / 24).toFixed(1)} يوماً كاملاً!)` }
    ];
  }, 'ضريبة_التأجيل <دقائق_يومياً>'],
  ['ربح_العادة_السنوي', 'أثر التحسن البسيط بمقدار 1% يومياً أو القراءة اليومية خلال عام', [15], ([min]) => {
    const hrs = (min * 365) / 60;
    const pages = Math.round((min * 365) / 2);
    return [
      { icon: '📚', label: 'قراءة يومية', value: `${min} دقيقة` },
      { icon: '🏆', label: 'الحصاد بعد سنة', value: `${Math.round(hrs)} ساعة ≈ ${pages.toLocaleString('en-US')} صفحة (≈ ${Math.max(1, Math.round(pages / 220))} كتاباً!)` }
    ];
  }, 'ربح_العادة_السنوي <دقائق_يومياً>'],
  ['ساعات_الإتقان_العشرة_آلاف', 'كم سنة تحتاج لإتقان مهارة (10,000 ساعة) بعدد ساعاتك اليومي', [2], ([hrsDay]) => {
    const safe = Math.max(0.25, hrsDay);
    const days = Math.ceil(10000 / safe);
    return [
      { icon: '🎯', label: 'الممارسة اليومية', value: `${safe} ساعة` },
      { icon: '🗓️', label: 'للوصول لـ 20 ساعة (البداية القوية)', value: `${Math.ceil(20 / safe)} يوم` },
      { icon: '👑', label: 'للوصول لـ 10,000 ساعة (الإتقان)', value: `${(days / 365.25).toFixed(1)} سنة` }
    ];
  }, 'ساعات_الإتقان_العشرة_آلاف <ساعات_يومياً>'],
  ['دقائق_المطالعة', 'حساب الوقت اللازم لإنهاء كتاب بعدد صفحاته وسرعة قراءتك', [300, 30], ([pages, perDay]) => {
    const days = Math.ceil(Math.max(1, pages) / Math.max(1, perDay));
    return [
      { icon: '📖', label: 'صفحات الكتاب', value: `${pages} صفحة` },
      { icon: '📅', label: 'المدة لإنهائه', value: `${days} يوم بمعدل ${perDay} صفحة/يوم` }
    ];
  }, 'دقائق_المطالعة <صفحات_الكتاب> <صفحات_اليوم>'],
  ['مقياس_تشتت_اليوم', 'احسب أثر كل مقاطعة على تركيزك (كل مقاطعة تكلف ~23 دقيقة استرجاع)', [8], ([interruptions]) => {
    const lostMin = interruptions * 23;
    return [
      { icon: '🔔', label: 'عدد المقاطعات/الإشعارات', value: String(interruptions) },
      { icon: '🧠', label: 'زمن استرجاع التركيز المهدور', value: `${(lostMin / 60).toFixed(1)} ساعة` }
    ];
  }, 'مقياس_تشتت_اليوم <عدد_المقاطعات>'],
  ['مؤشر_الإنتاجية_البيولوجي', 'تقدير ساعة ذروة التركيز الذهني حسب وقت استيقاظك', [7], ([wakeHr]) => [
    { icon: '🌅', label: 'الاستيقاظ', value: `${wakeHr % 24}:00` },
    { icon: '🔥', label: 'ذروة التركيز التحليلي', value: `${(wakeHr + 2) % 24}:00 — ${(wakeHr + 5) % 24}:00` },
    { icon: '🌙', label: 'فترة الإبداع الحر', value: `${(wakeHr + 10) % 24}:00 — ${(wakeHr + 12) % 24}:00` }
  ], 'مؤشر_الإنتاجية_البيولوجي <ساعة_الاستيقاظ>'],
  ['طاقة_الساعة_البيولوجية', 'معرفة حالة الساعة البيولوجية حسب الساعة الحالية (0-23)', [new Date().getHours()], ([hr]) => {
    const h = ((Math.round(hr) % 24) + 24) % 24;
    const state = h < 6 ? 'ترميم الخلايا والنوم العميق 🌙' : h < 12 ? 'أعلى يقظة ذهنية والكورتيزول الصباحي ☀️' : h < 17 ? 'أفضل تنسيق عضلي وحركي ⚡' : h < 21 ? 'انخفاض الحرارة وبداية إفراز الميلاتونين 🌆' : 'تهيئة الجسم للراحة 🛌';
    return [
      { icon: '🕒', label: 'الساعة المختارة', value: `${String(h).padStart(2, '0')}:00` },
      { icon: '🧬', label: 'الحالة الحيوية', value: state }
    ];
  }, 'طاقة_الساعة_البيولوجية <الساعة>'],
  ['جدول_بومودورو_ذكي', 'تقسيم وقت مذاكرتك المتاح إلى جلسات بومودورو واستراحات', [120], ([mins]) => {
    const sessions = Math.max(1, Math.floor(mins / 30));
    return [
      { icon: '🍅', label: 'الوقت المتاح', value: `${mins} دقيقة` },
      { icon: '🔁', label: 'عدد الجلسات المقترحة', value: `${sessions} جلسة (25د عمل + 5د راحة لكل جلسة)` }
    ];
  }, 'جدول_بومودورو_ذكي <الدقائق>']
];

for (const [cmd, desc, defs, calc, usage] of PRODUCTIVITY_CALCULATORS) {
  add(cmd, desc, async (m, ctx) => {
    const vals = parseNumbers(ctx, defs);
    await sendInteractiveCard(m, ctx, { title: desc.split('(')[0].trim(), badge: '⏱️', fields: calc(vals), theme: 'royal' });
  }, [usage]);
}

// ── 4. World Clocks, Timezones & Solar Phases ──
const WORLD_CLOCKS = [
  ['توقيت_غرينتش', 'الوقت الحالي في توقيت غرينتش العالمي UTC', 'UTC', '🇬🇧'],
  ['توقيت_القاهرة', 'الوقت الحالي في القاهرة', 'Africa/Cairo', '🇪🇬'],
  ['توقيت_الرياض', 'الوقت الحالي في الرياض', 'Asia/Riyadh', '🇸🇦'],
  ['توقيت_دبي', 'الوقت الحالي في دبي', 'Asia/Dubai', '🇦🇪'],
  ['توقيت_طوكيو', 'الوقت الحالي في طوكيو', 'Asia/Tokyo', '🇯🇵'],
  ['توقيت_نيويورك', 'الوقت الحالي في نيويورك', 'America/New_York', '🇺🇸'],
  ['توقيت_لندن', 'الوقت الحالي في لندن', 'Europe/London', '🇬🇧'],
  ['توقيت_باريس', 'الوقت الحالي في باريس', 'Europe/Paris', '🇫🇷'],
  ['توقيت_إسطنبول', 'الوقت الحالي في إسطنبول', 'Europe/Istanbul', '🇹🇷'],
  ['توقيت_كوالالمبور', 'الوقت الحالي في كوالالمبور', 'Asia/Kuala_Lumpur', '🇲🇾'],
  ['توقيت_الدار_البيضاء', 'الوقت الحالي في الدار البيضاء', 'Africa/Casablanca', '🇲🇦'],
  ['توقيت_بغداد', 'الوقت الحالي في بغداد', 'Asia/Baghdad', '🇮🇶'],
  ['توقيت_عمان_الأردن', 'الوقت الحالي في عمّان', 'Asia/Amman', '🇯🇴'],
  ['توقيت_الكويت', 'الوقت الحالي في الكويت', 'Asia/Kuwait', '🇰🇼'],
  ['توقيت_سنغافورة', 'الوقت الحالي في سنغافورة', 'Asia/Singapore', '🇸🇬'],
  ['توقيت_سيدني', 'الوقت الحالي في سيدني', 'Australia/Sydney', '🇦🇺']
];

for (const [cmd, desc, tz, flag] of WORLD_CLOCKS) {
  add(cmd, desc, async (m, ctx) => {
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('ar-EG', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
    const dateStr = new Intl.DateTimeFormat('ar-EG', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
    await sendInteractiveCard(m, ctx, {
      title: `${flag} ${desc.replace('الوقت الحالي في ', 'ساعة ')}`,
      badge: '🌍',
      fields: [
        { icon: '🕒', label: 'الوقت الآن', value: timeStr },
        { icon: '📅', label: 'التاريخ', value: dateStr },
        { icon: '🌐', label: 'المنطقة الزمنية', value: tz }
      ],
      theme: 'cyber'
    });
  }, [cmd], 'info');
}

add('فرق_التوقيت', 'مقارنة الوقت الحالي مباشرة بين أهم 6 عواصم عالمية', async (m, ctx) => {
  const now = new Date();
  const zones = [['القاهرة', 'Africa/Cairo'], ['الرياض', 'Asia/Riyadh'], ['دبي', 'Asia/Dubai'], ['لندن', 'Europe/London'], ['نيويورك', 'America/New_York'], ['طوكيو', 'Asia/Tokyo']];
  const fields = zones.map(([name, tz]) => ({
    icon: '🕒',
    label: name,
    value: new Intl.DateTimeFormat('ar-EG', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(now)
  }));
  await sendInteractiveCard(m, ctx, { title: 'الساعة العالمية المقارنة', badge: '🗺️', fields, theme: 'cyber' });
});

// ── 5. Calendar, Seasons & Historical Eras (Rich Guides + Calculations) ──
const CALENDAR_TOOLS = [
  ['كم_مضى_من_السنة', 'حساب الأيام المنقضية والمتبقية من السنة الميلادية الحالية', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const dayOfYear = Math.floor((now - start) / 86400000) + 1;
    const totalDays = Math.round((end - start) / 86400000);
    return [
      { icon: '📆', label: 'اليوم رقم', value: `${dayOfYear} من ${totalDays}` },
      { icon: '📊', label: 'نسبة انقضاء العام', value: progressBar(dayOfYear, totalDays, 12) },
      { icon: '⏳', label: 'المتبقي لنهاية العام', value: `${totalDays - dayOfYear} يوم` }
    ];
  }],
  ['نسبة_السنة_الحالية', 'مؤشر التقدم الدقيق لعامنا الحالي بالساعات والأيام', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).getTime();
    const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
    const pct = ((now.getTime() - start) / (end - start)) * 100;
    return [
      { icon: '⚡', label: 'اكتمال العام', value: `${pct.toFixed(4)}%` },
      { icon: '📊', label: 'شريط السنة', value: progressBar(pct, 100, 12) }
    ];
  }],
  ['رقم_الأسبوع_في_السنة', 'معرفة رقم الأسبوع الحالي من أصل 52 أسبوعاً', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
    return [
      { icon: '🗓️', label: 'الأسبوع رقم', value: `${week} من 52` },
      { icon: '📊', label: 'التقدم', value: progressBar(week, 52, 10) }
    ];
  }],
  ['تحقق_سنة_كبيسة', 'التحقق إن كانت السنة المدخلة كبيسة (366 يوماً) أم بسيطة', (ctx) => {
    const [yr] = parseNumbers(ctx, [new Date().getFullYear()]);
    const y = Math.round(yr);
    const leap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return [
      { icon: '📅', label: 'السنة', value: String(y) },
      { icon: '🔍', label: 'النتيجة', value: leap ? 'سنة كبيسة (366 يوماً — فبراير 29 يوماً) ✅' : 'سنة بسيطة (365 يوماً)' }
    ];
  }],
  ['يوم_الأسبوع_لتاريخ', 'معرفة اسم اليوم لأي تاريخ بصيغة YYYY-MM-DD', (ctx) => {
    const raw = String(ctx.text || '').trim() || new Date().toISOString().slice(0, 10);
    const d = new Date(raw);
    if (isNaN(d.getTime())) return [{ icon: '❌', label: 'تنبيه', value: 'أدخل تاريخاً مثل: 2026-11-19' }];
    return [
      { icon: '📅', label: 'التاريخ', value: raw },
      { icon: '✨', label: 'يوافق يوم', value: d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
    ];
  }],
  ['تحويل_سنة_هجري_ميلادي', 'تحويل تقريبي من السنة الهجرية إلى الميلادية', (ctx) => {
    const [h] = parseNumbers(ctx, [1448]);
    const g = Math.round((h * 0.970224) + 621.577);
    return [
      { icon: '🌙', label: 'السنة الهجرية', value: `${h} هـ` },
      { icon: '☀️', label: 'توافق تقريباً', value: `${g} م` }
    ];
  }],
  ['تحويل_سنة_ميلادي_هجري', 'تحويل تقريبي من السنة الميلادية إلى الهجرية', (ctx) => {
    const [g] = parseNumbers(ctx, [new Date().getFullYear()]);
    const h = Math.round((g - 621.577) / 0.970224);
    return [
      { icon: '☀️', label: 'السنة الميلادية', value: `${g} م` },
      { icon: '🌙', label: 'توافق تقريباً', value: `${h} هـ` }
    ];
  }],
  ['توقيت_فلكي_جوليان', 'حساب رقم اليوم الجولياني Julian Day المستخدم في الفلك', () => {
    const jd = (Date.now() / 86400000) + 2440587.5;
    return [
      { icon: '🔭', label: 'Julian Day', value: jd.toFixed(5) },
      { icon: 'ℹ️', label: 'الاستخدام', value: 'مرجع فلكي متصل لحساب مدارات الكواكب والكسوف' }
    ];
  }],
  ['أيام_الشهر_الميلادي', 'معرفة عدد أيام شهر معين في سنة محددة', (ctx) => {
    const now = new Date();
    const [mo, yr] = parseNumbers(ctx, [now.getMonth() + 1, now.getFullYear()]);
    const mClamped = Math.max(1, Math.min(12, Math.round(mo)));
    const days = new Date(Math.round(yr), mClamped, 0).getDate();
    return [
      { icon: '🗓️', label: 'الشهر / السنة', value: `${mClamped} / ${Math.round(yr)}` },
      { icon: '🔢', label: 'عدد الأيام', value: `${days} يوماً` }
    ];
  }],
  ['كم_باقي_لرمضان_التقريبي', 'عرض التاريخ الهجري التقريبي الحالي من تقويم النظام', () => {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    return [
      { icon: '🌙', label: 'التاريخ الهجري اليوم', value: hijri },
      { icon: '✨', label: 'رسالة روحانية', value: 'اغتنم أيامك بالذكر والطاعات قبل مواسم الخيرات.' }
    ];
  }]
];

for (const [cmd, desc, fn] of CALENDAR_TOOLS) {
  add(cmd, desc, async (m, ctx) => {
    await sendInteractiveCard(m, ctx, { title: desc.split('(')[0].trim(), badge: '📅', fields: fn(ctx), theme: 'emerald' });
  }, [cmd], 'info');
}

// ── 6. 30 Deep Productivity Frameworks, Solar Angles & Historical Time Capsules ──
const TIME_KNOWLEDGE = [
  ['قاعدة_الدقيقتين', 'قاعدة الإنتاجية الذهبية للأعمال الصغيرة', 'أي مهمة تستغرق أقل من دقيقتين أنجزها فوراً بدلاً من تأجيلها وتراكمها في قائمتك.', 'إنجاز'],
  ['مصفوفة_أيزنهاور', 'تصنيف المهام حسب الأهمية والاستعجال', 'قسّم مهامك لأربعة مربعات: (1) مهم وعاجل: افعله الآن، (2) مهم غير عاجل: خطط له، (3) عاجل غير مهم: فوّضه، (4) غير مهم وغير عاجل: احذفه.', 'تخطيط'],
  ['تقنية_أكل_الضفدع', 'البدء بأصعب مهمة في بداية الصباح', 'اختر أهم وأصعب مهمة في يومك وأنجزها أولاً قبل فتح الرسائل؛ سيبدو باقي اليوم سهلاً للغاية.', 'إرادة'],
  ['كتلة_العمل_العميق', 'تخصيص ساعات متصلة بلا أي تشتيت', 'أغلق الإشعارات 90 دقيقة متواصلة لعمل معرفي عالي القيمة يضاعف إنتاجك أربع مرات.', 'تركيز'],
  ['استراحة_ميكرو', 'استراحات مصغرة كل 25-30 دقيقة', 'انهض وحرك كتفيك واشرب رشفة ماء لمدة دقيقتين للحفاظ على تدفق الدم وتقليل إجهاد الرقبة.', 'صحة'],
  ['قاعدة_التسعين_دقيقة', 'العمل وفق دورة اليقظة فوق اليومية (Ultradian Rhythm)', 'ينتج الدماغ أعلى تركيز لمدة 90 دقيقة، ثم يحتاج 20 دقيقة راحة حقيقية ليشحن طاقته.', 'علوم الأعصاب'],
  ['منحنى_إيبينغهاوس', 'تفسير نسيان المعلومات الجديدة وكيف نهزمه', 'ننسى ~70% من المعلومات الجديدة خلال 24 ساعة ما لم نراجعها عبر المراجعة المتباعدة.', 'تعلم'],
  ['مراجعة_متباعدة', 'جدول مراجعة المعلومات للحفظ طويل الأمد', 'راجع المعلومة بعد: يوم 1 ⬅️ يوم 3 ⬅️ يوم 7 ⬅️ يوم 14 ⬅️ يوم 30 لتثبيتها في الذاكرة الدائمة.', 'ذاكرة'],
  ['قاعدة_الثمانين_عشرين', 'مبدأ باريتو في استثمار الوقت', '80% من نتائجك المهمة تأتي من 20% فقط من أنشطتك. حدّد تلك الـ20% وضاعف وقتها.', 'استراتيجية'],
  ['خطة_تسعين_يوم', 'تحويل الأهداف السنوية الكبيرة إلى سباقات ربع سنوية', 'السنة طويلة ومخادعة؛ قسّم هدفك إلى خطة واضحة من 12 أسبوعاً بمؤشر قياس أسبوعي.', 'أهداف'],
  ['قاعدة_الأربع_ساعات_عمق', 'حد الإبداع المعرفي اليومي للخبراء', 'أكبر المفكرين والمبرمجين ينتجون ذروة إبداعهم في 4 ساعات عمل عميق حقيقية يومياً.', 'إبداع'],
  ['شروق_وهمي_فلكي', 'ظاهرة انكسار الضوء عند الأفق', 'تُرى الشمس قبل شروقها الهندسي بنحو دقيقتين بسبب انكسار أشعتها في الغلاف الجوي.', 'فلك'],
  ['طول_النهار_الموسمي', 'لماذا يتغير طول النهار بين الشتاء والصيف؟', 'بسبب ميل محور الأرض بزاوية 23.44 درجة أثناء دورانها حول الشمس، مما يغير مسار الشمس الظاهري.', 'فلك'],
  ['ذروة_الشمس', 'تحديد وقت الزوال الشمسي الحقيقي', 'عند منتصف المسافة الزمنية بين الشروق والغروب تتعامد الشمس على خط الطول ويكون الظل أقصر ما يمكن.', 'توقيت'],
  ['اتجاه_الظل', 'معرفة الاتجاهات التقريبية من ظل عمود رأسي', 'في نصف الكرة الشمالي يميل ظل الظهيرة نحو الشمال، ويمكن تتبع شرق-غرب بتحديد نقطتي الظل بفارق 15 دقيقة.', 'ملاحة'],
  ['ساعة_ذهبية', 'أجمل ساعة للتصوير الفوتوغرافي بالضوء الطبيعي', 'أول ساعة بعد الشروق وآخر ساعة قبل الغروب حيث يكون الضوء دافئاً وناعم الظلال.', 'تصوير'],
  ['ساعة_زرقاء', 'فترة السكون اللوني بين الغروب والظلام', 'تمتد 20-30 دقيقة بعد الغروب وتتلون فيها السماء بزرقة عميقة مثالية لتصوير المدن.', 'تصوير'],
  ['فجر_كاذب_وصادق', 'الفرق البصري بين الفجر الكاذب والفجر الصادق', 'الفجر الكاذب ضوء عمودي مخروطي يظهر ثم يختفي، بينما الصادق خيط أبيض أفقي ينتشر على طول الأفق.', 'فلك'],
  ['ربيع_اعتدال', 'يوم تساوي الليل والنهار ربيعاً (20-21 مارس)', 'تتعامد الشمس على خط الاستواء فيتساوى الليل والنهار تقريباً في جميع أنحاء الأرض.', 'مواسم'],
  ['انقلاب_صيفي', 'أطول نهار في نصف الكرة الشمالي (21 يونيو)', 'تصل الشمس لأقصى ارتفاع شمالاً عند مدار السرطان فيكون النهار أطول ما يكون.', 'مواسم'],
  ['انقلاب_شتوي', 'أطول ليل في نصف الكرة الشمالي (21 ديسمبر)', 'تتعامد الشمس على مدار الجدي فتصل أدنى ارتفاع لها في سماء الشمال.', 'مواسم'],
  ['اعتدال_خريفي', 'تساوي الليل والنهار وبداية الخريف (22-23 سبتمبر)', 'تعبر الشمس خط الاستواء جنوباً معلنةً اعتدال الحرارة وتراجع ساعات النهار شمالاً.', 'مواسم'],
  ['دورة_ميلانكوفيتش', 'دورات تغير مناخ الأرض عبر عشرات آلاف السنين', 'تغيرات بطيئة في إهليجية مدار الأرض وميل محورها وتمايله تفسر العصور الجليدية التاريخية.', 'جيولوجيا'],
  ['عصر_الديناصورات', 'الحقبة الوسطى (قبل 252 إلى 66 مليون سنة)', 'امتد عبر العصر الترياسي والجوراسي والطباشيري وانتهى بسقوط كويكب تشيكشولوب.', 'تاريخ الزمن'],
  ['العصر_الحجري', 'أطول حقبة في تاريخ البشرية المبكر', 'اعتمد الإنسان فيه على الأدوات الصوانية واكتشف إشعال النار ثم بدأ الزراعة في نهايته.', 'حضارات'],
  ['العصر_البرونزي', 'ثورة صهر النحاس والقصدير (نحو 3300 ق.م)', 'ظهرت فيه أوائل الكتابات المسمارية والهيروغليفية والمدن المنظمة في العراق ومصر.', 'حضارات'],
  ['عصر_النهضة', 'انطلاقة العلوم والفنون في أوروبا (القرن 14-17)', 'أعاد إحياء المنهج التجريبي والطباعة والفنون ووضع أسس الثورة العلمية الحديثة.', 'تاريخ'],
  ['الثورة_الصناعية', 'التحول من العمل اليدوي إلى الآلات البخارية (1760م)', 'ضاعفت الإنتاج وسرّعت المواصلات والاتصالات وأعادت تشكيل المدن الحديثة.', 'تاريخ'],
  ['عصر_الفضاء', 'بداية استكشاف الفضاء بإطلاق سبوتنيك (1957م)', 'فتح الطريق للأقمار الصناعية وهبوط الإنسان على القمر وإطلاق التلسكوبات المدارية.', 'علوم'],
  ['عصر_الذكاء_الاصطناعي', 'التحول الرقمي المعاصر بالشبكات العصبية', 'أتمتة الفهم والتحليل وتوليد المعرفة بوتيرة متسارعة في الطب والبرمجة والتعليم.', 'مستقبل']
];

for (const [cmd, subtitle, body, tag] of TIME_KNOWLEDGE) {
  add(cmd, subtitle, async (m, ctx) => {
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle,
      badge: '🕰️',
      body,
      fields: [{ icon: '🏷️', label: 'التصنيف الزمني', value: tag }],
      theme: 'royal'
    });
  }, [cmd], 'info');
}

// ── 7. Remaining Unique Chrono & Era Interactive Tools ──
const GENERATIONS_AND_ERAS = [
  ['جيل_ألفا', 'مواليد 2010–2024: جيل الشاشات الذكية والذكاء التفاعلي'],
  ['جيل_زد', 'مواليد 1997–2009: جيل الإنترنت السريع والمحتوى القصير'],
  ['جيل_الألفية', 'مواليد 1981–1996: الجيل الذي شهد التحول من الورق للرقمية'],
  ['مقارنة_الأجيال', 'تحليل جيلك وتاريخك التقني بناءً على سنة ميلادك'],
  ['بصمة_الزمن', 'حساب رقمك الزمني الخاص انطلاقاً من تاريخ اليوم واسمك'],
  ['خط_حياتي', 'تصور النسب المئوية لمراحل حياتك التعليمية والمهنية'],
  ['حاسبة_اللحظات', 'تقدير عدد ساعات التنفس والأحلام والخطوات في عمر معين'],
  ['خطة_المهارة', 'بناء خطة 30 يوماً متدرجة لتعلم أي مهارة تكتبها'],
  ['ميزان_الأولويات', 'ترتيب مهمتين أو ثلاث مهمات بتوصية واضحة حسب الأثر'],
  ['تذكير_الماء_الذكي', 'جدول شرب الماء الموزع على ساعات يقظتك بالملليلتر'],
  ['إيقاف_التسويف', 'خطوات عملية فورية لكسر جمود البدء خلال 5 دقائق'],
  ['مؤشر_التسويف', 'اختبار سريع لتحديد سبب تأجيلك (خوف/ملل/غموض) وعلاجه'],
  ['وعد_الغد', 'توليد بطاقة تعهد لخطوة واحدة واضحة صباح الغد'],
  ['تقييم_أسبوعي', 'أسئلة المراجعة الأسبوعية الخمسة لمضاعفة وعيك بإنجازك'],
  ['دفتر_الإنجاز', 'تسجيل إنجاز يومي في قاعدة بياناتك وكسب +35 XP'],
  ['سلسلة_عادة', 'إطلاق سلسلة عادة يومية جديدة في ملفك الشخصي'],
  ['إنجاز_عادة', 'تسجيل يوم جديد في سلسلتك وزيادة الـ Streak'],
  ['سجل_عاداتي', 'عرض تقدمك في سلسلة عاداتك اليومية'],
  ['تبدل_الفصول', 'عرض الفصل الفلكي الحالي ونسبة الاقتراب من الفصل التالي'],
  ['عد_تنازلي_مخصص', 'حساب الفرق بالأيام والساعات لأي تاريخ مستقبلي تدخله'],
  ['تحدي_التركيز_العميق', 'بدء تحدي تركيز 45 دقيقة وتوثيق نيتك الآن']
];

for (const [cmd, desc] of GENERATIONS_AND_ERAS) {
  add(cmd, desc, async (m, ctx) => {
    const input = String(ctx.text || '').trim();
    const u = ensureDbUser(m.sender);

    if (cmd === 'مقارنة_الأجيال') {
      const [yr] = parseNumbers(ctx, [2002]);
      const gen = yr >= 2010 ? 'جيل ألفا (Alpha)' : yr >= 1997 ? 'جيل زد (Gen Z)' : yr >= 1981 ? 'جيل الألفية (Millennials)' : yr >= 1965 ? 'جيل إكس (Gen X)' : 'جيل الرواد';
      return sendInteractiveCard(m, ctx, { title: 'مقارنة الأجيال', badge: '👥', fields: [{ icon: '📅', label: 'سنة الميلاد', value: String(Math.round(yr)) }, { icon: '🏷️', label: 'التصنيف الجيلي', value: gen }], theme: 'royal' });
    }
    if (cmd === 'دفتر_الإنجاز') {
      if (!Array.isArray(u.achievementsLog)) u.achievementsLog = [];
      const item = input || 'إتمام جلسة تعلم مثمرة';
      u.achievementsLog.push({ item, at: Date.now() });
      awardUser(m.sender, 35, 35);
      return sendInteractiveCard(m, ctx, { title: 'تم تدوين الإنجاز!', badge: '📓', body: `✅ "${item}"\nإجمالي إنجازاتك المسجلة: ${u.achievementsLog.length}`, tip: '+35 🪙 | +35 XP', theme: 'emerald' });
    }
    if (cmd === 'سلسلة_عادة') {
      u.habit = { name: input || 'القراءة 15 دقيقة', streak: 1, lastAt: Date.now() };
      return sendInteractiveCard(m, ctx, { title: 'تم تفعيل سلسلة العادة', badge: '🔥', body: `العادة: *${u.habit.name}*\nالسلسلة الحالية: 1 يوم`, theme: 'royal', buttons: [makeQuickButton('✅ أنجزت اليوم', 'إنجاز_عادة')] });
    }
    if (cmd === 'إنجاز_عادة') {
      if (!u.habit) u.habit = { name: 'العادة اليومية', streak: 0, lastAt: 0 };
      u.habit.streak += 1;
      u.habit.lastAt = Date.now();
      awardUser(m.sender, 25, 25);
      return sendInteractiveCard(m, ctx, { title: 'استمرار السلسلة!', badge: '🔥', body: `العادة: *${u.habit.name}*\nالسلسلة وصلت إلى: *${u.habit.streak}* يوم!`, theme: 'royal' });
    }
    if (cmd === 'سجل_عاداتي') {
      const h = u.habit;
      return sendInteractiveCard(m, ctx, { title: 'ملف العادات', badge: '📊', body: h ? `العادة النشطة: *${h.name}*\nالسلسلة: ${h.streak} يوم` : 'لم تبدأ عادة بعد. اكتب `.سلسلة_عادة اسم_العادة`', theme: 'cyber' });
    }
    if (cmd === 'عد_تنازلي_مخصص') {
      const targetStr = input || `${new Date().getFullYear() + 1}-01-01`;
      const target = new Date(targetStr);
      if (isNaN(target.getTime())) return m.reply('📌 اكتب التاريخ بصيغة YYYY-MM-DD مثل: `.عد_تنازلي_مخصص 2027-01-01`');
      const diff = target.getTime() - Date.now();
      return sendInteractiveCard(m, ctx, { title: 'العد التنازلي للموعد', badge: '⏳', fields: [{ icon: '🎯', label: 'التاريخ المستهدف', value: targetStr }, { icon: '⏱️', label: 'الزمن المتبقي', value: diff > 0 ? formatDurationAr(diff) : 'تم بلوغ هذا التاريخ بالفعل! ✅' }], theme: 'royal' });
    }
    if (cmd === 'تبدل_الفصول') {
      const mo = new Date().getMonth() + 1;
      const season = mo >= 3 && mo <= 5 ? 'الربيع 🌸' : mo >= 6 && mo <= 8 ? 'الصيف ☀️' : mo >= 9 && mo <= 11 ? 'الخريف 🍂' : 'الشتاء ❄️';
      return sendInteractiveCard(m, ctx, { title: 'الموسم الفلكي الحالي', badge: '🌍', fields: [{ icon: '🧭', label: 'نصف الكرة الشمالي', value: season }], theme: 'emerald' });
    }
    if (cmd === 'حاسبة_اللحظات') {
      const [age] = parseNumbers(ctx, [20]);
      const days = Math.round(age * 365.25);
      return sendInteractiveCard(m, ctx, { title: 'أرقام مدهشة في رحلة حياتك', badge: '✨', fields: [{ icon: '🌬️', label: 'أنفاس تقديرية', value: `${Math.round(days * 22000 / 1e6)} مليون نفس` }, { icon: '👣', label: 'خطوات تقديرية', value: `${Math.round(days * 6000 / 1e6)} مليون خطوة` }, { icon: '🌙', label: 'أحلام تقديرية', value: `${(days * 4).toLocaleString('en-US')} حلم` }], theme: 'royal' });
    }

    const extra = seededPick([
      'ابدأ بقاعدة الـ5 دقائق: اقنع نفسك بالعمل لـ5 دقائق فقط فينكسر الحاجز النفسي فوراً.',
      'اجعل كل مهمة كبيرة مكونة من 3 خطوات مصغرة لا تستغرق كل منها أكثر من 15 دقيقة.',
      'احذف 3 مشتتات قبل بدء جلستك، وكافئ نفسك بعد إتمامها.'
    ], cmd + input);
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: desc,
      badge: '⏳',
      body: input ? `🎯 التطبيق على: *${input}*\n${extra}` : extra,
      theme: 'royal'
    });
  }, [cmd]);
}

// ── 8. Interactive Chrono Poll & HTML Widget ──
add('استطلاع_وقت_الإنتاجية', 'إنشاء استطلاع رأي حول أكثر وقت تكون فيه قمة إنتاجيتك', async (m, ctx) => {
  await sendInteractivePoll(m, ctx, {
    name: 'في أي فترة من اليوم تبلغ ذروة تركيزك وإنتاجيتك؟',
    values: ['🌅 الفجر والصباح الباكر', '☀️ الظهيرة', '🌆 المساء', '🌙 هدوء منتصف الليل'],
    selectableCount: 1
  });
}, ['استطلاع_وقت_الإنتاجية'], 'native');

add('ودجت_العد_التنازلي', 'فتح ودجت HTML تفاعلي يراقب تقدم السنة واليوم والتركيز', async (m, ctx) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now - start) / 86400000) + 1;
  const html = makeSimpleHtmlWidget('⏳ لوحة كرونوس للزمن', '#38bdf8', [
    ['اليوم في السنة', `${day} / 365`],
    ['نسبة العام', `${((day / 365) * 100).toFixed(1)}%`],
    ['ساعتك الحالية', now.toLocaleTimeString('ar-EG')],
    ['التوقيت العالمي', now.toISOString().slice(11, 19)]
  ]);
  await sendInteractiveWidget(m, ctx, { title: 'لوحة كرونوس للزمن', html, fallbackText: `اليوم ${day} من 365` });
}, ['ودجت_العد_التنازلي'], 'native');

export default handlers;
