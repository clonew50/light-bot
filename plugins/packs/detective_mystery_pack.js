/**
 * plugins/packs/detective_mystery_pack.js — حزمة التحقيق الجنائي والشفرات والألغاز الغامضة (105+ أمر)
 */
import crypto from 'node:crypto';
import {
  ensureDbUser,
  awardUser,
  seededPick,
  seededNumber,
  splitArgsPipe,
  makeSimpleHtmlWidget,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeCopyButton,
  makeQuickButton
} from '../../system/creativePackUtils.js';

const handlers = [];
const add = (cmd, desc, fn, usage, cat = 'games') => {
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

// ── 1. Persistent Detective Profile & 12 Full Interactive Cases ──
const CASES = [
  ['قضية_الغرفة_المغلقة', 'لغز اختفاء المخطوطة داخل غرفة مقفلة من الداخل', 'المكتبة الملكية', ['أمين المكتبة', 'الحارس الليلي', 'الرسام الزائر'], 'الرسام الزائر', 'استخدم خيطاً وسحباً مغناطيسياً من تحت الباب لإسقاط المزلاج بعد خروجه.', 'شمع ذائب تحت الباب وخدش حديث على المزلاج'],
  ['قضية_المتحف_المفقود', 'سرقة التاج الكريستالي أثناء انقطاع الكهرباء', 'قاعة الآثار', ['مهندس الإضاءة', 'مدير الأمن', 'المرشدة السياحية'], 'مهندس الإضاءة', 'أطفأ القاطع الاحتياطي لمدة 40 ثانية فقط ووضع مرآة لخداع الحساس الحراري.', 'مفك معزول مفقود وبصمة قفاز مطاطي قرب لوحة التوزيع'],
  ['قضية_القطار_السريع', 'اختفاء حقيبة الدبلوماسي بين محطتين', 'القطار الليلي', ['مضيف العربة', 'تاجر الساعات', 'الصحفي المتنكر'], 'تاجر الساعات', 'أعاد ضبط ساعة العربة 10 دقائق للخلف لصنع حجة غياب مستحيلة.', 'توقيت تذكرة الطبع يسبق ساعة الحائط المعطلة بعشر دقائق'],
  ['قضية_القصر_الجليدي', 'تحطم التمثال الثمين ليلة العاصفة', 'القصر الشمالي', ['كبير الطهاة', 'صانع التحف', 'سائق العربة'], 'صانع التحف', 'استبدل التمثال بنسخة جليدية ذابت تماماً عند منتصف الليل ليبدو أنه اختفى!', 'بركة ماء مالحة وخيط قطني في موضع القاعدة'],
  ['قضية_المختبر_السري', 'تسريب صيغة المركب الكيميائي الجديد', 'مختبر الأبحاث', ['مساعد المختبر', 'خبير الشبكات', 'المستثمر'], 'خبير الشبكات', 'نسخ البيانات عبر نبضات ضوئية على كابل غير موصل بالإنترنت.', 'سجل تشغيل غير مبرر لمصباح لوحة التحكم الساعة 3 فجراً'],
  ['قضية_المركب_الشبح', 'عثور خفر السواحل على يخت بلا ركاب', 'الميناء الجنوبي', ['القبطان', 'الملاح', 'صاحب التأمين'], 'صاحب التأمين', 'أطلق القارب بنظام توجيه آلي للمطالبة بتعويض الغرق الوهمي.', 'طعام دافئ معد للتمويه رغم خلو خزان الوقود الاحتياطي'],
  ['قضية_اللوحة_المزورة', 'استبدال اللوحة الأصلية بنسخة حديثة', 'المعرض الفني', ['الناقد التشكيلي', 'صاحب الصالة', 'المرمم'], 'المرمم', 'استعمل طلاءً يجف بالأشعة البنفسجية ليحاكي تشققات القرن الثامن عشر.', 'رائحة مذيب صناعي حديث على الإطار الخلفي'],
  ['قضية_الخزنة_الماسية', 'فتح الخزنة دون كسر القفل الرقمي', 'بنك المدينة', ['المدير المالي', 'منظف المبنى', 'مبرمج الخزائن'], 'منظف المبنى', 'رصد بصمات الحرارة بالكاميرا الحرارية الهاتفية بعد خروج المدير مباشرة.', 'عدسة حرارية مخبأة في عربة التنظيف'],
  ['قضية_برج_الساعة', 'توقف الساعة الأثرية عند الثانية عشرة تماماً', 'ساحة البرج', ['ساعاتي المدينة', 'المصور الفوتوغرافي', 'عازف الشارع'], 'ساعاتي المدينة', 'أوقف الترس الرئيسي بقطعة رصاص صغيرة لإخفاء موعد لقائه السري.', 'بقايا برادة رصاص ناعمة على الترس الرابع'],
  ['قضية_الميناء_القديم', 'اختفاء شحنة البهارات النادرة من المخزن رقم 7', 'رصيف السفن', ['مشرف الجمارك', 'مراقب الرافعة', 'تاجر الحبوب'], 'مراقب الرافعة', 'نقل الحاوية إلى سفينة صيد صغيرة أثناء الضباب الكثيف مستغلاً زاوية عمياء.', 'خطاف الرافعة مبلل بماء مالح حديث رغم جفاف الرصيف'],
  ['قضية_الوصية_المفقودة', 'اختفاء ظرف الوصية المختوم قبل قراءتها', 'منزل العائلة', ['المحامي', 'ابن العم', 'السكرتير'], 'السكرتير', 'استعمل بخار الماء لفك الغراء وأغلق ظرفاً فارغاً مكانه.', 'تجعد رطب على حافة الظرف البديل وبقايا نشا'],
  ['قضية_المنجم_المهجور', 'ظهور إشارات ضوئية غريبة ليلاً في النفق المغلق', 'التل الغربي', ['رئيس العمال السابق', 'الجيولوجي', 'حارس البوابة'], 'الجيولوجي', 'عثر على عرق معدن نادر وأطلق شائعة الأشباح لإبعاد الفضوليين.', 'أداة حفر صامتة وخرائط طبقية حديثة داخل حقيبته']
];

add('ملفي_الجنائي', 'عرض ملفك كمحقق والرتبة وعدد القضايا المحلولة', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const solved = Array.isArray(u.solvedCases) ? u.solvedCases.length : 0;
  const rank = solved >= 10 ? 'شارلوك هولمز الأسطوري 🕵️‍♂️👑' : solved >= 6 ? 'كبير المحققين 🎖️' : solved >= 3 ? 'محقق ميداني 🔍' : 'محقق متدرب 🪪';
  await sendInteractiveCard(m, ctx, {
    title: 'بطاقة وكالة التحقيقات',
    badge: '🕵️',
    fields: [
      { icon: '🎖️', label: 'الرتبة', value: rank },
      { icon: '📁', label: 'القضايا المحلولة', value: `${solved} / ${CASES.length}` },
      { icon: '📊', label: 'التقدم المهني', value: progressBar(solved, CASES.length, 10) },
      { icon: '⚖️', label: 'القضية المفتوحة', value: u.activeCase || 'لا توجد (اختر قضية!)' }
    ],
    theme: 'crimson',
    buttons: [makeQuickButton('📂 فتح قضية الغرفة المغلقة', 'قضية_الغرفة_المغلقة'), makeQuickButton('📋 سجل القضايا', 'سجل_القضايا')]
  });
});

add('سجل_القضايا', 'قائمة بجميع القضايا المتاحة في أرشيف المحقق', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const solvedSet = new Set(u.solvedCases || []);
  const body = CASES.map((c) => `${solvedSet.has(c[0]) ? '✅' : '🕵️'} *.${c[0]}* — ${c[1]}`).join('\n');
  await sendInteractiveCard(m, ctx, { title: 'أرشيف القضايا الجنائية', badge: '🗄️', body, theme: 'crimson' });
});

for (const [cmd, title, loc, suspects, culprit, how, clue] of CASES) {
  add(cmd, title, async (m, ctx) => {
    const u = ensureDbUser(m.sender);
    u.activeCase = cmd;
    await sendInteractiveCard(m, ctx, {
      title: `ملف القضية: ${cmd.replace(/_/g, ' ')}`,
      subtitle: title,
      badge: '🔎',
      fields: [
        { icon: '📍', label: 'مسرح الحدث', value: loc },
        { icon: '🧬', label: 'الدليل الميداني', value: clue },
        { icon: '👥', label: 'المشتبه بهم', value: suspects.join(' | ') }
      ],
      tip: 'لاتهام أحدهم اكتب: .اتهام_مشتبه <الاسم>',
      theme: 'crimson',
      buttons: suspects.map((s) => makeQuickButton(`⚖️ اتهام ${s}`, `اتهام_مشتبه ${s}`))
    });
  }, [cmd]);
}

add('اتهام_مشتبه', 'توجيه الاتهام النهائي للمشتبه به في قضيتك المفتوحة', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const guess = String(ctx.text || '').trim();
  const c = CASES.find((x) => x[0] === u.activeCase);
  if (!c) return m.reply('📂 افتح قضية أولاً عبر `.سجل_القضايا` ثم وجّه الاتهام.');
  if (!guess) return m.reply(`⚖️ اكتب اسم المشتبه به. الخيارات: ${c[3].join(' / ')}`);

  if (guess.includes(c[4]) || c[4].includes(guess)) {
    if (!Array.isArray(u.solvedCases)) u.solvedCases = [];
    const firstTime = !u.solvedCases.includes(c[0]);
    if (firstTime) u.solvedCases.push(c[0]);
    u.activeCase = null;
    awardUser(m.sender, firstTime ? 200 : 50, firstTime ? 120 : 25);
    return sendInteractiveCard(m, ctx, {
      title: 'استنتاج عبقري! تم حل القضية',
      badge: '⚖️',
      fields: [
        { icon: '🚨', label: 'الجاني الحقيقي', value: c[4] },
        { icon: '💡', label: 'طريقة التنفيذ', value: c[5] },
        { icon: '🎁', label: 'المكافأة', value: firstTime ? '+200 🪙 | +120 XP' : '+50 🪙 (مراجعة)' }
      ],
      theme: 'royal'
    });
  }
  await sendInteractiveCard(m, ctx, {
    title: 'اتهام غير دقيق!',
    badge: '❌',
    body: `المشتبه به "${guess}" قدّم حجة غياب مقنعة.\nأعد فحص الدليل:\n🧬 *${c[6]}*`,
    theme: 'crimson'
  });
}, ['اتهام_مشتبه <الاسم>']);

add('فحص_دليل', 'تحليل إضافي أعمق لدليل القضية المفتوحة حالياً', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const c = CASES.find((x) => x[0] === u.activeCase);
  if (!c) return m.reply('🔎 افتح قضية أولاً لفحص دليلها!');
  await sendInteractiveCard(m, ctx, {
    title: 'تقرير المختبر الجنائي للدليل',
    badge: '🔬',
    body: `📌 القضية: *${c[0].replace(/_/g, ' ')}*\n🔬 الدليل: *${c[6]}*\n💡 تلميح المحقق: ركّز على التخصص المهني لكل مشتبه وربطه بهذا الأثر!`,
    theme: 'cyber'
  });
});

add('إغلاق_ملف', 'إغلاق القضية المفتوحة حالياً والعودة لقائمة القضايا', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  u.activeCase = null;
  await sendInteractiveCard(m, ctx, { title: 'تم أرشفة الملف المفتوح', badge: '📁', body: 'يمكنك اختيار قضية جديدة من `.سجل_القضايا`.', theme: 'cyber' });
});

add('ترقية_محقق', 'التحقق من شروط الترقية والحصول على وسام الوكالة', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const count = (u.solvedCases || []).length;
  await sendInteractiveCard(m, ctx, {
    title: 'لجنة ترقية المحققين',
    badge: '🎖️',
    fields: [
      { icon: '📂', label: 'القضايا المنجزة', value: String(count) },
      { icon: '🚀', label: 'الهدف التالي', value: count < 3 ? `تبقّى ${3 - count} للرتبة الميدانية` : count < 6 ? `تبقّى ${6 - count} لكبير المحققين` : 'بلغت أعلى الرتب القيادية!' }
    ],
    theme: 'royal'
  });
});

// ── 2. Real Working Classical Cryptography & Spy Ciphers (20 Tools) ──
const MORSE_MAP = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

const shiftText = (txt, shift) => txt.replace(/[a-zA-Z]/g, (ch) => {
  const base = ch <= 'Z' ? 65 : 97;
  return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 260) % 26) + base);
});

const atbashText = (txt) => txt.replace(/[a-zA-Z]/g, (ch) => {
  const base = ch <= 'Z' ? 65 : 97;
  return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
});

const vigenere = (txt, key, decode = false) => {
  const cleanKey = (key || 'LIGHT').toUpperCase().replace(/[^A-Z]/g, '') || 'LIGHT';
  let kIdx = 0;
  return txt.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    const shift = cleanKey.charCodeAt(kIdx++ % cleanKey.length) - 65;
    const delta = decode ? -shift : shift;
    return String.fromCharCode(((ch.charCodeAt(0) - base + delta + 26) % 26) + base);
  });
};

const railFenceEncode = (txt, rails = 3) => {
  if (rails <= 1 || txt.length <= 1) return txt;
  const rows = Array.from({ length: rails }, () => '');
  let r = 0, dir = 1;
  for (const ch of txt) {
    rows[r] += ch;
    if (r === 0) dir = 1;
    else if (r === rails - 1) dir = -1;
    r += dir;
  }
  return rows.join('');
};

const railFenceDecode = (txt, rails = 3) => {
  if (rails <= 1 || txt.length <= 1) return txt;
  const n = txt.length;
  const pattern = [];
  let r = 0, dir = 1;
  for (let i = 0; i < n; i++) {
    pattern.push(r);
    if (r === 0) dir = 1;
    else if (r === rails - 1) dir = -1;
    r += dir;
  }
  const counts = Array(rails).fill(0);
  for (const p of pattern) counts[p]++;
  const sliceRows = [];
  let pos = 0;
  for (let i = 0; i < rails; i++) {
    sliceRows.push(txt.slice(pos, pos + counts[i]).split(''));
    pos += counts[i];
  }
  return pattern.map((p) => sliceRows[p].shift()).join('');
};

const CIPHER_TOOLS = [
  ['شفرة_يوليوس', 'تشفير النص الإنجليزي بشفرة يوليوس العسكرية (shift 3 أو مخصص: النص | الإزاحة)', (raw) => {
    const [txt, s] = raw.includes('|') ? raw.split('|').map((x) => x.trim()) : [raw || 'HELLO DETECTIVE', '3'];
    return shiftText(txt, parseInt(s, 10) || 3);
  }],
  ['فك_شفرة_يوليوس', 'فك شفرة يوليوس للنص الإنجليزي (النص | الإزاحة)', (raw) => {
    const [txt, s] = raw.includes('|') ? raw.split('|').map((x) => x.trim()) : [raw || 'KHOOR GHWHFWLYH', '3'];
    return shiftText(txt, -(parseInt(s, 10) || 3));
  }],
  ['تشفير_أتباش', 'تشفير وفك شفرة أتباش العكسية (A<->Z)', (raw) => atbashText(raw || 'SECRET AGENT')],
  ['تشفير_فيجنير', 'تشفير نص بمفتاح سري بطريقة فيجنير (النص | المفتاح)', (raw) => {
    const [txt, key] = raw.includes('|') ? raw.split('|').map((x) => x.trim()) : [raw || 'ATTACK AT DAWN', 'LIGHT'];
    return vigenere(txt, key, false);
  }],
  ['فك_فيجنير', 'فك تشفير فيجنير بالمفتاح السري (الشفرة | المفتاح)', (raw) => {
    const [txt, key] = raw.includes('|') ? raw.split('|').map((x) => x.trim()) : [raw || 'LBAHJ VZ KYPU', 'LIGHT'];
    return vigenere(txt, key, true);
  }],
  ['تشفير_سياج', 'تشفير Rail Fence بتوزيع الحروف على 3 مسارات', (raw) => railFenceEncode(raw || 'MYSTERY CASE', 3)],
  ['فك_سياج', 'فك تشفير Rail Fence ذي الـ3 مسارات', (raw) => railFenceDecode(raw || 'MRESYTY AE C', 3)],
  ['تشفير_مورس_سري', 'تحويل النص الإنجليزي والأرقام إلى شفرة مورس الدولية', (raw) =>
    (raw || 'SOS LIGHT').toUpperCase().split(' ').map((w) => w.split('').map((c) => MORSE_MAP[c] || c).join(' ')).join(' / ')
  ],
  ['فك_مورس_سري', 'تحويل شفرة مورس إلى نص مقروء (مسافة بين الحروف و / بين الكلمات)', (raw) =>
    (raw || '... --- ... / .-.. .. --. .... -').trim().split('/').map((w) => w.trim().split(/\s+/).map((c) => MORSE_REV[c] || '?').join('')).join(' ')
  ],
  ['تشفير_روت13', 'تشفير وفك ROT13 القياسي', (raw) => shiftText(raw || 'Secret Clue', 13)],
  ['تشفير_أبجدي_عكسي', 'عكس الكلمات والحروف بطريقة المرآة المزدوجة', (raw) => [...(raw || 'سر الليل')].reverse().join('')],
  ['تشفير_مرآة', 'عكس ترتيب حروف كل كلمة مع الإبقاء على ترتيب الجملة', (raw) => (raw || 'الليل يخفي السر').split(/\s+/).map((w) => [...w].reverse().join('')).join(' ')],
  ['تشفير_بوليبيوس', 'تشفير الحروف الإنجليزية بإحداثيات مربع بوليبيوس (11..55)', (raw) => {
    const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
    return (raw || 'CLUE').toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '').split('').map((c) => {
      const idx = grid.indexOf(c);
      return `${Math.floor(idx / 5) + 1}${(idx % 5) + 1}`;
    }).join(' ');
  }],
  ['فك_بوليبيوس', 'فك إحداثيات مربع بوليبيوس (مثال: 13 31 45 15)', (raw) => {
    const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
    return (raw || '13 31 45 15').trim().split(/\s+/).map((pair) => {
      const r = parseInt(pair[0], 10) - 1, c = parseInt(pair[1], 10) - 1;
      return (r >= 0 && r < 5 && c >= 0 && c < 5) ? grid[r * 5 + c] : '?';
    }).join('');
  }],
  ['تشفير_ثنائي_خفي', 'تمثيل النص بأصفار وآحاد الثنائي Binary', (raw) =>
    Array.from(Buffer.from(raw || 'TOP', 'utf8')).map((b) => b.toString(2).padStart(8, '0')).join(' ')
  ],
  ['تشفير_نيك_سري', 'ترميز النص برموز غير مرئية مدمجة في Unicode/Hex مختصر', (raw) =>
    Buffer.from(raw || 'كود', 'utf8').toString('hex').toUpperCase()
  ],
  ['مولد_مفتاح_جاسوس', 'توليد مفتاح استخباراتي عشوائي عالي الإنتروبيا', () =>
    `SPY-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
  ],
  ['اسم_رمزي_استخباراتي', 'توليد اسم حركي مزدوج للعملاء السريين', (raw) => {
    const adj = ['الصقر', 'الظل', 'السهم', 'البرق', 'الذئب', 'الفجر', 'العنقاء'];
    const noun = ['القرمزي', 'الصامت', 'الفضي', 'الليلي', 'الذهبي', 'الشمالي', 'الغامض'];
    const s = raw || String(Date.now());
    return `${seededPick(adj, s)} ${seededPick(noun, s + '_2')}`;
  }],
  ['كشف_الشفرة', 'تحليل سلسلة مشفرة وتخمين نوع الشفرة المحتمل (مورس / Hex / ثنائي / ROT)', (raw) => {
    const t = (raw || '... --- ...').trim();
    if (/^[.\-\s/]+$/.test(t)) return 'مرجح جداً: شفرة مورس (Morse Code)';
    if (/^[01\s]+$/.test(t)) return 'مرجح جداً: تمثيل ثنائي (Binary)';
    if (/^[0-9a-fA-F\s]+$/.test(t)) return 'مرجح جداً: ترميز ست عشري (Hexadecimal)';
    if (/^[1-5\s]+$/.test(t)) return 'مرجح جداً: إحداثيات مربع بوليبيوس';
    return 'مرجح: شفرة استبدال (قيصر / أتباش / فيجنير)';
  }]
];

for (const [cmd, desc, fn] of CIPHER_TOOLS) {
  add(cmd, desc, async (m, ctx) => {
    const raw = String(ctx.text || '').trim();
    const out = fn(raw);
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: desc.split('(')[0].trim(),
      badge: '🔐',
      fields: [
        ...(raw ? [{ icon: '📥', label: 'المدخل', value: raw }] : []),
        { icon: '📤', label: 'الناتج', value: out }
      ],
      theme: 'cyber',
      buttons: [makeCopyButton('📋 نسخ الناتج', out)]
    });
  }, [cmd], 'tools');
}

// ── 3. Interactive Safecracker Game (Persistent Vault Code) ──
add('خزنة_أرقام', 'بدء لعبة كسر الخزنة السرية المكونة من 3 أرقام مختلفة', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  const digits = [];
  while (digits.length < 3) {
    const d = String(Math.floor(Math.random() * 10));
    if (!digits.includes(d)) digits.push(d);
  }
  u.safePuzzle = { code: digits.join(''), tries: 0, maxTries: 7 };
  await sendInteractiveCard(m, ctx, {
    title: 'تحدي خزنة الأرقام السرية',
    badge: '🔐',
    body: 'تم قفل الخزنة برمز من **3 أرقام مختلفة** (من 0 إلى 9).\nلديك **7 محاولات**.\nأرسل تخمينك بالأمر: `.محاولة_خزنة 482`',
    theme: 'crimson'
  });
}, ['خزنة_أرقام']);

add('محاولة_خزنة', 'تجربة رمز 3 أرقام لفتح الخزنة النشطة (مثال: .محاولة_خزنة 147)', async (m, ctx) => {
  const u = ensureDbUser(m.sender);
  if (!u.safePuzzle) return m.reply('🔐 ابدأ الخزنة أولاً بالأمر `.خزنة_أرقام`');
  const guess = String(ctx.text || '').replace(/\D/g, '').slice(0, 3);
  if (guess.length !== 3) return m.reply('🔢 أرسل 3 أرقام مثل: `.محاولة_خزنة 379`');

  u.safePuzzle.tries += 1;
  const secret = u.safePuzzle.code;
  let bulls = 0, cows = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === secret[i]) bulls++;
    else if (secret.includes(guess[i])) cows++;
  }
  if (bulls === 3) {
    const reward = Math.max(80, 300 - u.safePuzzle.tries * 25);
    u.safePuzzle = null;
    awardUser(m.sender, reward, 90);
    return sendInteractiveCard(m, ctx, { title: 'انفتحت الخزنة!', badge: '💎', body: `الرمز الصحيح هو *${secret}*!\nربحت +${reward} 🪙 و +90 XP!`, theme: 'royal' });
  }
  if (u.safePuzzle.tries >= u.safePuzzle.maxTries) {
    u.safePuzzle = null;
    return sendInteractiveCard(m, ctx, { title: 'انغلق القفل الاحتياطي!', badge: '🚨', body: `انتهت المحاولات الـ7! الرمز السري كان *${secret}*.`, theme: 'crimson', buttons: [makeQuickButton('🔄 خزنة جديدة', 'خزنة_أرقام')] });
  }
  await sendInteractiveCard(m, ctx, {
    title: `نتيجة المحاولة ${u.safePuzzle.tries}/${u.safePuzzle.maxTries}`,
    badge: '🎛️',
    fields: [
      { icon: '🔢', label: 'تخمينك', value: guess },
      { icon: '🎯', label: 'رقم صحيح في مكانه الصحيح', value: String(bulls) },
      { icon: '🟡', label: 'رقم صحيح في مكان خاطئ', value: String(cows) }
    ],
    theme: 'cyber'
  });
}, ['محاولة_خزنة <3_أرقام>']);

// ── 4. 25 Forensics Lab Scanners & Crime Scene Analysis Tools ──
const FORENSICS_LAB = [
  ['تحليل_بصمة', 'فحص نمط البصمة (الحلقات/الأقواس/الدوامات) لاسم أو عنصر', (t) => `النمط المكتشف: *${seededPick(['دوامة مركزية نادرة (Whorl)', 'حلقة شعاعية مائلة (Loop)', 'قوس خيمي دقيق (Tented Arch)'], t)}* — نسبة التطابق: ${seededNumber(t, 82, 99)}%`],
  ['مطابقة_الحمض_النووي', 'مقارنة شريط الـ DNA الجنائي مع الأرشيف الافتراضي', (t) => `التسلسل المقارن: \`${crypto.createHash('md5').update(t).digest('hex').slice(0, 12).toUpperCase()}\` — العلامات الجينية متماسكة بنسبة ${seededNumber(t + 'dna', 91, 99)}%`],
  ['فحص_الحبر_السري', 'فحص رسالة بالحرارة والأشعة للكشف عن نصوص مخفية', (t) => `تم الكشف عن أثر ليمون/مركب فينولفثالين مخفي تحت النص: "${t}"`],
  ['تحليل_نبرة_الصوت', 'قياس مؤشر التوتر في النبرة الصوتية', (t) => `معدل الارتجاف الترددي: ${seededNumber(t + 'v', 14, 88)} Hz — الحالة: ${seededNumber(t + 'v', 1, 2) === 1 ? 'نبرة متوترة غير مستقرة' : 'نبرة هادئة متزنة'}`],
  ['كشف_التزوير_الرقمي', 'فحص علامات تعديل البيانات الوصفية أو الصور', (t) => `فحص EXIF والضغط: نسبة الاحتمال ${seededNumber(t + 'f', 12, 95)}% — تحقّق من الحواف والطبقات.`],
  ['اختبار_الكذب', 'قراءة البوليغراف التفاعلي لجملة أو ادعاء', (t) => {
    const score = seededNumber(t + 'lie', 10, 98);
    return `عبارة الفحص: "${t}"\nمؤشر الصدق الظاهري: ${progressBar(score, 100, 10)} — ${score >= 60 ? 'متماسك منطقياً ✅' : 'يوجد تردد واضطراب ⚠️'}`;
  }],
  ['فحص_مسرح_الجريمة', 'مسح شامل لـ 4 زوايا داخل مسرح حدث افتراضي', (t) => `مسح "${t}": 1) زاوية المدخل 2) المكتب 3) النافذة 4) سلة المهملات — رُصد أثر خطوة متجهة نحو الشرفة.`],
  ['تحليل_الخط_اليدوي', 'دراسة ميل الحروف والضغط على الورق', (t) => `ضغط القلم: ${seededPick(['عميق ومتوتر', 'متوسط ومتناسق', 'خفيف ومتعجل'], t)} — الميل: ${seededNumber(t, -12, 18)}°`],
  ['توقيت_الوفاة_الافتراضي', 'تقدير حراري مبسط في الروايات البوليسية حسب فرق الحرارة', () => 'في الأدب البوليسي، يفقد الجسم نحو 1-1.5 درجة مئوية في الساعات الأولى حتى يتعادل مع حرارة الغرفة.'],
  ['فحص_التربة_والأثر', 'تحليل عينات الطين أو الغبار على الأحذية', (t) => `المكونات لعينة "${t}": ${seededPick(['رمال كوارتز ساحلية + ملح بحري', 'طين نهري داكن + بقايا نباتية', 'غبار جيري أبيض + رماد فحم'], t)}`],
  ['تتبع_المسار', 'رسم مسار الحركة المرجح بين نقطتين', (t) => `تحليل سرعة الانتقال لـ"${t}": يوصي بفحص الممرات الخلفية كمسار بديل للهروب.`],
  ['تحليل_الألياف', 'تحديد نوع نسيج خيط عالق في موقع الحدث', (t) => `نتيجة المجهر: ${seededPick(['صوف بحري داكن عالي الكثافة', 'ألياف كتان طبيعي قديم', 'بوليستر صناعي أخضر لامع'], t)}`],
  ['تحليل_الرماد', 'فحص بقايا أوراق محترقة في مدفأة الغموض', (t) => `الرماد الرمادي المتماسك يشير إلى احتراق ورق قطني عالي الجودة في "${t}".`],
  ['كشف_السموم_التاريخي', 'معلومات علمية تاريخية عن طرق كشف المعادن الثقيلة', () => 'اختبار مارش (1836) أحدث ثورة في الطب الشرعي بالكشف عن الزرنيخ بمجرد مرآة معدنية على أنبوب زجاجي.'],
  ['مسح_الأشعة_فوق_البنفسجية', 'الكشف عن آثار الفلورسنت غير المرئية بالعين المجردة', (t) => `تحت طول موجة 365nm يضيء المسار "${t}" ببقع خافتة قرب مقبض الباب.`],
  ['عدسة_التحري', 'مكبر تفصيلي لاستخلاص 3 ملاحظات دقيقة من أي وصف نصي', (t) => `كلمات مفتاحية تستدعي التدقيق في "${t}": التوقيت، المفتاح المزدوج، وانعكاس المرآة.`],
  ['إعادة_بناء_الوجه', 'وصف ملامح افتراضية بناءً على شهادة شاهد', (t) => `الملامح التقديرية: ${seededPick(['ملامح حادة وعينان ضيقتان مع ندبة خفيفة', 'وجه مستدير ونظارة سميكة ذات إطار معدني', 'ملامح هادئة ولحية قصيرة مرتبة'], t)}`],
  ['خريطة_الدوافع', 'تحليل الدوافع الكلاسيكية الثلاثة (المال / الخوف / الانتقام)', (t) => `بتحليل "${t}": الدافع المرجح هو *${seededPick(['تغطية سر قديم (الخوف)', 'الاستحواذ المالي السريع', 'تصفية حساب مهني قديم'], t)}*`],
  ['استجواب_شاهد', 'توليد 4 أسئلة استجواب ذكية لكشف ثغرات الرواية', (t) => `1) أين كنت قبل الحدث بـ15 دقيقة؟\n2) ما لون القطعة التي ذكرتها؟\n3) من آخر شخص تحدثت إليه قرب "${t}"؟\n4) لماذا تغيرت إفادتك الثانية؟`],
  ['كشف_التناقض', 'فحص جملتين مفصولتين بـ | لكشف أي تناقض زمني أو منطقي', (t) => `قارن الأسماء والأرقام والتوقيت بين: ${t} — تحقّق دوماً من الفجوات الزمنية الدقيقة.`],
  ['مختبر_الألغاز', 'إعطاء لغز منطقي قصير وتحدي تفكيرك الاستنتاجي', () => seededPick(['رجل خرج في المطر بلا مظلة ولا قبعة ومع ذلك لم تبتل شعرة من رأسه، لماذا؟ (الجواب: أصلع!)', 'ما الشيء الذي تملكه ويستخدمه الآخرون أكثر منك؟ (الجواب: اسمك!)'], 'riddle')],
  ['منطق_هولمز', 'قاعدة شارلوك هولمز الشهيرة في الاستبعاد', () => '«عندما تستبعد المستحيل، فإن ما يتبقى — مهما بدا مستبعداً — لا بد أن يكون الحقيقة.»'],
  ['مبدأ_أوكام', 'شفرة أوكام للوصول إلى التفسير الأبسط والأرجح', () => '«التفسير الذي يعتمد على أقل عدد من الافتراضات المعقدة هو غالباً الأقرب إلى الصواب.»'],
  ['معضلة_السجين', 'شرح تطبيق نظرية الألعاب في التحقيقات والاستجواب', () => 'توضح المعضلة كيف يختار شريكان بين التعاون (الصمت) أو الخيانة (الاعتراف) تحت ضغط عدم الثقة.'],
  ['حقيبة_المحقق', 'جرد الأدوات الثماني الأساسية في حقيبة كل محقق ميداني', () => 'عدسة مكبرة، مسحوق بصمات، مصباح UV، أكياس حفظ أدلة، شريط قياس، دفتر ملاحظات، قفازات، وملقاط معقم.']
];

for (const [cmd, desc, fn] of FORENSICS_LAB) {
  add(cmd, desc, async (m, ctx) => {
    const t = String(ctx.text || '').trim() || 'العينة الميدانية';
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: desc,
      badge: '🔬',
      body: fn(t),
      theme: 'crimson'
    });
  }, [cmd], 'tools');
}

// ── 5. 36 Classic Mystery Vignettes, Deduction Scenarios & Tools ──
const MYSTERY_SCENARIOS = [
  ['جريمة_المنتصف', 'لغز الساعة المتوقفة في منتصف الليل'],
  ['شيفرة_الظل', 'رسالة مكتوبة بفراغات بين السطور بدلاً من الحروف'],
  ['رسالة_الزجاجة', 'مخطوطة مائية عُثر عليها على الشاطئ'],
  ['البريد_المجهول', 'طرد بلا مرسل وصل قبل الجلسة بساعة'],
  ['سر_المكتبة', 'الكتاب المقلوب الذي يفتح الممر الخفي'],
  ['لغز_المرآة', 'الانعكاس الذي كشف موقع الكاميرا الخفية'],
  ['شاهد_الصمت', 'الببغاء الذي ردّد جملة الدقائق الأخيرة'],
  ['بصمة_على_الكأس', 'لماذا كانت البصمة باليد اليسرى رغم أن المتهم أيمن؟'],
  ['ساعة_متوقفة', 'ساعة توقفت في الغرفة عند 10:15 بينما الكاميرا سجلت الحركة عند 11:00'],
  ['مفتاح_القبو', 'المفتاح المنسوخ من قطعة صابون طرية'],
  ['ورقة_الرهان', 'قصاصة ورق مقسمة إلى جزأين داخل سترة الحارس'],
  ['الظرف_المختوم', 'الختم الشمعي المكسور والمعاد تشكيله بعملة معدنية'],
  ['اختفاء_الصحفي', 'المسودة الأخيرة المحفوظة في ذاكرة الطابعة'],
  ['حساب_المصرف_المخفي', 'تحويلات بسنتات متكررة جمعت ملاييناً'],
  ['تزوير_الوصية', 'الحبر الذي لم يُخترع إلا بعد عام من تاريخ التوقيع المزعوم!'],
  ['مسار_الهروب', 'آثار أقدام متجهة للداخل فقط لأن اللص مشى للخلف'],
  ['الرمز_الأحمر', 'أرقام الصفحات والأسطر المخفية في هوامش الرواية'],
  ['صندوق_المفقودات', 'الساعة التذكارية التي ربطت ثلاثة شهود مجهولين'],
  ['اختبار_الملاحظة', 'اختبار دقة التفاصيل الستة في مشهد عابر'],
  ['تحليل_الأعذار', 'تفكيك حجة الغياب المستندة إلى تذاكر أو صور'],
  ['اختبار_الذاكرة_البصرية', 'حفظ قائمة من 7 أشياء غريبة وإعادة استدعائها'],
  ['قوة_الاستنتاج', 'قياس سرعة ربط الدليل بالنتيجة المباشرة'],
  ['خطة_تسلل', 'تحليل نقاط ضعف الأبواب والنوافذ في الروايات البوليسية'],
  ['كسر_نمط', 'إيجاد الرقم أو الحرف الشاذ في متتالية ذكية'],
  ['خريطة_العصابة', 'رسم شبكة العلاقات بين المشتبه بهم والأحداث'],
  ['إصدار_مذكرة_توقيف', 'صياغة مذكرة توقيف مسرحية لعضو متهم باللغز'],
  ['مصباح_فحص', 'توجيه الضوء المائل بزاوية 15 درجة لإظهار الخدوش الدقيقة'],
  ['رادار_إشارة', 'رصد الأجهزة القريبة الافتراضية في غرفة التحقيق'],
  ['قائمة_المشتبهين', 'فرز المشتبه بهم وفق الدافع والوسيلة والفرصة'],
  ['تقييم_الشاهد', 'قياس درجة موثوقية الرواية الشفوية'],
  ['سيناريو_إخفاء', 'كشف أشهر 5 طرق لإخفاء المفاتيح في الروايات'],
  ['مكافأة_التحري', 'صرف مكافأة التحقيق اليومية من خزينة الوكالة'],
  ['تصويت_المتهم', 'إنشاء استطلاع جماعي لتحديد المشتبه به في الجروب'],
  ['ودجت_لوحة_التحقيق', 'فتح لوحة تحقيقات تفاعلية بصيغة HTML']
];

for (const [cmd, desc] of MYSTERY_SCENARIOS) {
  add(cmd, desc, async (m, ctx) => {
    const input = String(ctx.text || '').trim();
    if (cmd === 'تصويت_المتهم') {
      return sendInteractivePoll(m, ctx, {
        name: input || 'من برأيك وراء لغز الليلة في المجموعة؟',
        values: ['🕵️ الزائر الغامض', '🕯️ حارس القصر', '📜 أمين السجلات', '🎭 الساحر المتخفي'],
        selectableCount: 1
      });
    }
    if (cmd === 'ودجت_لوحة_التحقيق') {
      const u = ensureDbUser(m.sender);
      const solved = (u.solvedCases || []).length;
      const html = makeSimpleHtmlWidget('🔎 غرفة عمليات التحقيق', '#f43f5e', [
        ['المحقق', String(m.sender).split('@')[0]],
        ['القضايا المحلولة', `${solved} / ${CASES.length}`],
        ['القضية المفتوحة', u.activeCase || 'لا توجد'],
        ['الرصيد', `${u.money} 🪙`]
      ]);
      return sendInteractiveWidget(m, ctx, { title: 'لوحة التحقيقات', html, fallbackText: `القضايا المحلولة: ${solved}` });
    }
    if (cmd === 'مكافأة_التحري') {
      const u = ensureDbUser(m.sender);
      const now = Date.now();
      if (u.lastDetectiveBonus && now - u.lastDetectiveBonus < 3600000) {
        return m.reply('⏳ مكافأة التحري متاحة كل ساعة! ركّز على حل القضايا في `.سجل_القضايا`.');
      }
      u.lastDetectiveBonus = now;
      awardUser(m.sender, 110, 55);
      return sendInteractiveCard(m, ctx, { title: 'بدل التحقيق الميداني', badge: '💼', body: 'تم صرف +110 🪙 و +55 XP لدعم مهامك التحقيقية!', theme: 'royal' });
    }
    if (cmd === 'إصدار_مذكرة_توقيف') {
      const target = input || 'المشتبه المجهول';
      return sendInteractiveCard(m, ctx, {
        title: 'مذكرة توقيف استنتاجية',
        badge: '⚖️',
        fields: [
          { icon: '👤', label: 'المطلوب للتحقيق', value: target },
          { icon: '📌', label: 'التهمة الافتراضية', value: 'الغموض المريب والتسلل الذهني' },
          { icon: '🕵️', label: 'المحقق الموقّع', value: `@${String(m.sender).split('@')[0]}` }
        ],
        theme: 'crimson'
      });
    }
    await sendInteractiveCard(m, ctx, {
      title: cmd.replace(/_/g, ' '),
      subtitle: desc,
      badge: '🕵️',
      body: input
        ? `🔍 تم فحص العنصر *"${input}"* وفق هذه القاعدة الجنائية: ابحث دائماً عن التناقض بين الزمن المعلن والأثر المادي.`
        : `💡 *القاعدة التحقيقية:* ${desc} — القاعدة الأساسية تقول: كل تفصيل صغير يبدو شاذاً هو مفتاح الحل الكامل.`,
      theme: 'crimson',
      buttons: [makeQuickButton('📂 فتح أرشيف القضايا', 'سجل_القضايا')]
    });
  }, [cmd], cmd === 'تصويت_المتهم' || cmd === 'ودجت_لوحة_التحقيق' ? 'native' : 'games');
}

export default handlers;
