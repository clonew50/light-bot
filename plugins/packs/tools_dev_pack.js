/**
 * plugins/packs/tools_dev_pack.js — حزمة الأدوات والمطورين والمحولات (190+ أمر)
 */
import crypto from 'node:crypto';
import { formatCard, progressBar, sendInteractiveCard, makeCopyButton, makeQuickButton } from '../../system/interactiveUI.js';

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
  h.category = 'tools';
  h.usePrefix = true;
  handlers.push(h);
};

// ── 1. 60 Unit Converters ──
const CONVERTERS = [
  ['كم_لميل', 'كيلومتر → ميل', (x) => x * 0.621371, 'كم', 'ميل'],
  ['ميل_لكم', 'ميل → كيلومتر', (x) => x / 0.621371, 'ميل', 'كم'],
  ['متر_لقدم', 'متر → قدم', (x) => x * 3.28084, 'م', 'قدم'],
  ['قدم_لمتر', 'قدم → متر', (x) => x / 3.28084, 'قدم', 'م'],
  ['انش_لسم', 'إنش → سنتيمتر', (x) => x * 2.54, 'إنش', 'سم'],
  ['سم_لانش', 'سنتيمتر → إنش', (x) => x / 2.54, 'سم', 'إنش'],
  ['ياردة_لمتر', 'ياردة → متر', (x) => x * 0.9144, 'ياردة', 'م'],
  ['متر_لياردة', 'متر → ياردة', (x) => x / 0.9144, 'م', 'ياردة'],
  ['ميل_بحري_لكم', 'ميل بحري → كيلومتر', (x) => x * 1.852, 'ميل بحري', 'كم'],
  ['سم_لمم', 'سنتيمتر → ملليمتر', (x) => x * 10, 'سم', 'مم'],
  ['كيلو_لباوند', 'كيلوجرام → باوند', (x) => x * 2.20462, 'كجم', 'باوند'],
  ['باوند_لكيلو', 'باوند → كيلوجرام', (x) => x / 2.20462, 'باوند', 'كجم'],
  ['جرام_لاونصة', 'جرام → أونصة', (x) => x / 28.3495, 'جم', 'أونصة'],
  ['اونصة_لجرام', 'أونصة → جرام', (x) => x * 28.3495, 'أونصة', 'جم'],
  ['طن_لكيلو', 'طن → كيلوجرام', (x) => x * 1000, 'طن', 'كجم'],
  ['قيراط_لجرام', 'قيراط → جرام', (x) => x * 0.2, 'قيراط', 'جم'],
  ['سيلزيوس_لفهرنهايت', 'سيلزيوس → فهرنهايت', (x) => x * 9 / 5 + 32, '°C', '°F'],
  ['فهرنهايت_لسيلزيوس', 'فهرنهايت → سيلزيوس', (x) => (x - 32) * 5 / 9, '°F', '°C'],
  ['سيلزيوس_لكلفن', 'سيلزيوس → كلفن', (x) => x + 273.15, '°C', 'K'],
  ['كلفن_لسيلزيوس', 'كلفن → سيلزيوس', (x) => x - 273.15, 'K', '°C'],
  ['فهرنهايت_لكلفن', 'فهرنهايت → كلفن', (x) => (x - 32) * 5 / 9 + 273.15, '°F', 'K'],
  ['كمس_لميلس', 'كم/س → ميل/س', (x) => x * 0.621371, 'كم/س', 'ميل/س'],
  ['ميلس_لكمس', 'ميل/س → كم/س', (x) => x / 0.621371, 'ميل/س', 'كم/س'],
  ['مترث_لكمس', 'م/ث → كم/س', (x) => x * 3.6, 'م/ث', 'كم/س'],
  ['كمس_لمترث', 'كم/س → م/ث', (x) => x / 3.6, 'كم/س', 'م/ث'],
  ['عقدة_لكمس', 'عقدة → كم/س', (x) => x * 1.852, 'عقدة', 'كم/س'],
  ['بايت_لكيلوبايت', 'بايت → كيلوبايت', (x) => x / 1024, 'B', 'KB'],
  ['كيلو_لميجا_بيانات', 'كيلوبايت → ميجابايت', (x) => x / 1024, 'KB', 'MB'],
  ['ميجا_لجيجا', 'ميجابايت → جيجابايت', (x) => x / 1024, 'MB', 'GB'],
  ['جيجا_لميجا', 'جيجابايت → ميجابايت', (x) => x * 1024, 'GB', 'MB'],
  ['تيرا_لجيجا', 'تيرابايت → جيجابايت', (x) => x * 1024, 'TB', 'GB'],
  ['بت_لبايت', 'بت → بايت', (x) => x / 8, 'bit', 'Byte'],
  ['ميجابت_لميجابايت', 'Mbps → MB/s', (x) => x / 8, 'Mbps', 'MB/s'],
  ['ساعة_لثانية', 'ساعة → ثانية', (x) => x * 3600, 'ساعة', 'ثانية'],
  ['يوم_لساعة', 'يوم → ساعة', (x) => x * 24, 'يوم', 'ساعة'],
  ['اسبوع_لساعة', 'أسبوع → ساعة', (x) => x * 168, 'أسبوع', 'ساعة'],
  ['سنة_ليوم', 'سنة → يوم', (x) => x * 365.25, 'سنة', 'يوم'],
  ['دقيقة_لمللي', 'دقيقة → مللي ثانية', (x) => x * 60000, 'دقيقة', 'ms'],
  ['هكتار_لفدان', 'هكتار → فدان', (x) => x * 2.38095, 'هكتار', 'فدان'],
  ['فدان_لمتر', 'فدان → متر مربع', (x) => x * 4200.83, 'فدان', 'م²'],
  ['لتر_لجالون', 'لتر → جالون أمريكي', (x) => x * 0.264172, 'لتر', 'جالون'],
  ['جالون_للتر', 'جالون أمريكي → لتر', (x) => x / 0.264172, 'جالون', 'لتر'],
  ['لتر_لمل', 'لتر → ملليلتر', (x) => x * 1000, 'لتر', 'مل'],
  ['جول_لكالوري', 'جول → سعرة حرارية', (x) => x / 4.184, 'J', 'cal'],
  ['كالوري_لجول', 'سعرة → جول', (x) => x * 4.184, 'cal', 'J'],
  ['وات_لحصان', 'كيلوواط → حصان', (x) => x * 1.34102, 'kW', 'HP'],
  ['حصان_لوات', 'حصان → كيلوواط', (x) => x / 1.34102, 'HP', 'kW'],
  ['بار_لpsi', 'بار → PSI', (x) => x * 14.5038, 'bar', 'PSI'],
  ['psi_لبار', 'PSI → بار', (x) => x / 14.5038, 'PSI', 'bar'],
  ['درجة_لراديان', 'درجة → راديان', (x) => (x * Math.PI) / 180, '°', 'rad'],
  ['راديان_لدرجة', 'راديان → درجة', (x) => (x * 180) / Math.PI, 'rad', '°'],
  ['كيلوواط_ساعة_لجول', 'kWh → ميجاجول', (x) => x * 3.6, 'kWh', 'MJ'],
  ['بوصة_لمم', 'بوصة → ملليمتر', (x) => x * 25.4, 'in', 'mm'],
  ['مم_لبوصة', 'ملليمتر → بوصة', (x) => x / 25.4, 'mm', 'in'],
  ['مترمربع_لقدم', 'متر² → قدم²', (x) => x * 10.7639, 'م²', 'قدم²'],
  ['قدممربع_لمتر', 'قدم² → متر²', (x) => x / 10.7639, 'قدم²', 'م²'],
  ['مترمكعب_للتر', 'متر³ → لتر', (x) => x * 1000, 'م³', 'لتر'],
  ['كوب_لمل', 'كوب معياري → ملليلتر', (x) => x * 240, 'كوب', 'مل'],
  ['ملعقة_لمل', 'ملعقة كبيرة → ملليلتر', (x) => x * 15, 'ملعقة', 'مل'],
  ['اوقية_لجرام', 'أوقية ذهب → جرام', (x) => x * 31.1035, 'أوقية', 'جم']
];

for (const [cmd, label, fn, fromUnit, toUnit] of CONVERTERS) {
  add(cmd, `تحويل ${label}`, async (m, ctx) => {
    const val = parseFloat(ctx.args?.[0] ?? '1');
    if (isNaN(val)) return m.reply(`📌 اكتب رقماً: ${ctx.usedPrefix || '.'}${cmd} 10`);
    const out = Number(fn(val).toFixed(4));
    await sendInteractiveCard(m, ctx, {
      title: `محول الوحدات — ${label}`,
      badge: '📐',
      fields: [
        { icon: '📥', label: 'المدخل', value: `${val} ${fromUnit}` },
        { icon: '📤', label: 'النتيجة', value: `${out} ${toUnit}` }
      ],
      theme: 'cyber',
      buttons: [makeCopyButton('📋 نسخ النتيجة', String(out))]
    });
  }, [`${cmd} <رقم>`]);
}

// ── 2. 45 Math, Geometry & Finance Calculators ──
const numArgs = (ctx, defs) => defs.map((d, i) => {
  const v = parseFloat(ctx.args?.[i]);
  return Number.isFinite(v) ? v : d;
});

const MATH_TOOLS = [
  ['مساحة_الدائرة', 'مساحة الدائرة (نصف القطر)', [5], ([r]) => `π × ${r}² = ${(Math.PI * r * r).toFixed(3)}`],
  ['محيط_الدائرة', 'محيط الدائرة (نصف القطر)', [5], ([r]) => `2π × ${r} = ${(2 * Math.PI * r).toFixed(3)}`],
  ['مساحة_المثلث', 'مساحة المثلث (قاعدة ارتفاع)', [10, 6], ([b, h]) => `0.5 × ${b} × ${h} = ${(0.5 * b * h).toFixed(3)}`],
  ['مساحة_المستطيل', 'مساحة المستطيل (طول عرض)', [10, 4], ([w, h]) => `${w} × ${h} = ${(w * h).toFixed(3)}`],
  ['محيط_المستطيل', 'محيط المستطيل (طول عرض)', [10, 4], ([w, h]) => `2×(${w}+${h}) = ${(2 * (w + h)).toFixed(3)}`],
  ['مساحة_المربع', 'مساحة المربع (الضلع)', [6], ([s]) => `${s}² = ${(s * s).toFixed(3)}`],
  ['حجم_المكعب', 'حجم المكعب (الضلع)', [4], ([s]) => `${s}³ = ${(s * s * s).toFixed(3)}`],
  ['حجم_الكرة', 'حجم الكرة (نصف القطر)', [3], ([r]) => `(4/3)π×${r}³ = ${((4 / 3) * Math.PI * r ** 3).toFixed(3)}`],
  ['حجم_الاسطوانة', 'حجم الأسطوانة (نصف_القطر ارتفاع)', [3, 10], ([r, h]) => `π×${r}²×${h} = ${(Math.PI * r * r * h).toFixed(3)}`],
  ['حجم_المخروط', 'حجم المخروط (نصف_القطر ارتفاع)', [3, 9], ([r, h]) => `(1/3)π×${r}²×${h} = ${((Math.PI * r * r * h) / 3).toFixed(3)}`],
  ['حجم_الهرم', 'حجم الهرم (مساحة_القاعدة ارتفاع)', [12, 8], ([a, h]) => `(1/3)×${a}×${h} = ${((a * h) / 3).toFixed(3)}`],
  ['وتر_فيثاغورس', 'حساب وتر المثلث القائم (أ ب)', [3, 4], ([a, b]) => `√(${a}²+${b}²) = ${Math.hypot(a, b).toFixed(4)}`],
  ['ميل_المستقيم', 'ميل المستقيم (x1 y1 x2 y2)', [1, 2, 5, 10], ([x1, y1, x2, y2]) => x2 === x1 ? 'غير معرّف (خط رأسي)' : ((y2 - y1) / (x2 - x1)).toFixed(4)],
  ['المسافة_بين_نقطتين', 'المسافة بين نقطتين (x1 y1 x2 y2)', [0, 0, 3, 4], ([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1).toFixed(4)],
  ['جذر_تربيعي', 'الجذر التربيعي لرقم', [144], ([x]) => x < 0 ? 'لا يوجد جذر حقيقي للسالب' : `√${x} = ${Math.sqrt(x).toFixed(5)}`],
  ['جذر_تكعيبي', 'الجذر التكعيبي لرقم', [27], ([x]) => `∛${x} = ${Math.cbrt(x).toFixed(5)}`],
  ['لوغاريتم', 'اللوغاريتم العشري والطبيعي', [100], ([x]) => x <= 0 ? 'يجب أن يكون موجباً' : `log10=${Math.log10(x).toFixed(4)} | ln=${Math.log(x).toFixed(4)}`],
  ['اس_ورقم', 'حساب الأس (الأساس الأس)', [2, 10], ([a, b]) => `${a}^${b} = ${Math.pow(a, b)}`],
  ['نسبة_مئوية', 'حساب نسبة من قيمة (النسبة القيمة)', [20, 500], ([p, v]) => `${p}% من ${v} = ${((p / 100) * v).toFixed(2)}`],
  ['خصم_السعر', 'حساب السعر بعد الخصم (السعر نسبة_الخصم)', [250, 15], ([p, d]) => `بعد خصم ${d}% = ${(p * (1 - d / 100)).toFixed(2)} (توفير ${(p * d / 100).toFixed(2)})`],
  ['ضريبة_القيمة', 'حساب ضريبة القيمة المضافة (المبلغ النسبة)', [100, 14], ([a, t]) => `الضريبة=${(a * t / 100).toFixed(2)} | الإجمالي=${(a * (1 + t / 100)).toFixed(2)}`],
  ['فائدة_بسيطة', 'فائدة بسيطة (المبلغ النسبة السنوات)', [1000, 10, 2], ([p, r, y]) => `العائد=${(p * r * y / 100).toFixed(2)} | الإجمالي=${(p + p * r * y / 100).toFixed(2)}`],
  ['فائدة_مركبة', 'فائدة مركبة (المبلغ النسبة السنوات)', [1000, 10, 5], ([p, r, y]) => { const tot = p * Math.pow(1 + r / 100, y); return `الإجمالي=${tot.toFixed(2)} | الربح=${(tot - p).toFixed(2)}`; }],
  ['تقسيط_شهري', 'قسط شهري بدون فوائد (المبلغ الشهور)', [12000, 12], ([a, m]) => `القسط الشهري = ${(a / Math.max(1, m)).toFixed(2)}`],
  ['تقسيم_الفاتورة', 'تقسيم فاتورة على أشخاص (المبلغ العدد)', [360, 4], ([a, n]) => `نصيب الفرد = ${(a / Math.max(1, n)).toFixed(2)}`],
  ['بقشيش', 'حساب الإكرامية (الفاتورة النسبة)', [200, 10], ([a, p]) => `الإكرامية=${(a * p / 100).toFixed(2)} | الإجمالي=${(a * (1 + p / 100)).toFixed(2)}`],
  ['مؤشر_الكتلة', 'حساب مؤشر كتلة الجسم BMI (الوزن الطول_سم)', [72, 175], ([w, h]) => { const hm = h / 100; const bmi = w / (hm * hm); const st = bmi < 18.5 ? 'نحافة' : bmi < 25 ? 'وزن مثالي' : bmi < 30 ? 'زيادة وزن' : 'سمنة'; return `BMI = ${bmi.toFixed(1)} (${st})`; }],
  ['السعرات_اليومية', 'تقدير السعرات اليومية (الوزن الطول العمر)', [70, 175, 25], ([w, h, a]) => `${Math.round((10 * w + 6.25 * h - 5 * a + 5) * 1.4)} سعرة/يوم (نشاط متوسط)`],
  ['شرب_الماء', 'كمية الماء الموصى بها يومياً (الوزن)', [70], ([w]) => `${(w * 0.033).toFixed(2)} لتر يومياً (~${Math.round(w * 0.033 * 4)} أكواب)`],
  ['الوزن_المثالي', 'تقدير الوزن المثالي (الطول_سم)', [175], ([h]) => `${(h - 100 - (h - 150) / 4).toFixed(1)} كجم تقريباً`],
  ['نبض_التمرين', 'نطاق نبض حرق الدهون (العمر)', [25], ([a]) => { const max = 220 - a; return `الأقصى: ${max} | الحرق (60-75%): ${Math.round(max * 0.6)}-${Math.round(max * 0.75)} نبضة/د`; }],
  ['هامش_الربح', 'حساب هامش الربح (التكلفة البيع)', [80, 120], ([c, s]) => `الربح=${(s - c).toFixed(2)} | الهامش=${(((s - c) / Math.max(1, s)) * 100).toFixed(1)}%`],
  ['معدل_الادخار', 'حساب نسبة الادخار (الدخل المصروف)', [10000, 6500], ([inc, exp]) => `المدخر=${inc - exp} (${(((inc - exp) / Math.max(1, inc)) * 100).toFixed(1)}%)`]
];

for (const [cmd, desc, defs, calc] of MATH_TOOLS) {
  add(cmd, desc, async (m, ctx) => {
    const vals = numArgs(ctx, defs);
    const result = String(calc(vals));
    await sendInteractiveCard(m, ctx, {
      title: desc,
      badge: '🧮',
      fields: [
        { icon: '🔢', label: 'القيم', value: vals.join(' , ') },
        { icon: '✅', label: 'النتيجة', value: result }
      ],
      theme: 'cyber',
      buttons: [makeCopyButton('📋 نسخ النتيجة', result)]
    });
  }, [`${cmd} ${defs.join(' ')}`]);
}

// Factorial, Fibonacci, Primes, Factors, GCD, LCM, Age, Leap year, Countdown, Rate, GPA, Fuel
add('مضروب_العدد', 'حساب مضروب عدد (0..20)', async (m, ctx) => {
  const n = Math.min(20, Math.max(0, parseInt(ctx.args?.[0] ?? '5', 10) || 0));
  let res = 1n;
  for (let i = 2n; i <= BigInt(n); i++) res *= i;
  await sendInteractiveCard(m, ctx, { title: `مضروب ${n}!`, badge: '🔢', body: `${n}! = ${res.toString()}`, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', res.toString())] });
});
add('فيبوناتشي', 'توليد متتالية فيبوناتشي', async (m, ctx) => {
  const n = Math.min(30, Math.max(1, parseInt(ctx.args?.[0] ?? '10', 10) || 10));
  const seq = [0, 1];
  while (seq.length < n) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  const out = seq.slice(0, n).join(' , ');
  await sendInteractiveCard(m, ctx, { title: `متتالية فيبوناتشي (${n})`, badge: '🐚', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('اعداد_اولية', 'الأعداد الأولية حتى رقم معين', async (m, ctx) => {
  const limit = Math.min(300, Math.max(2, parseInt(ctx.args?.[0] ?? '50', 10) || 50));
  const primes = [];
  for (let i = 2; i <= limit; i++) {
    let ok = true;
    for (let j = 2; j * j <= i; j++) if (i % j === 0) { ok = false; break; }
    if (ok) primes.push(i);
  }
  const out = primes.join(' • ');
  await sendInteractiveCard(m, ctx, { title: `الأعداد الأولية حتى ${limit}`, badge: '🔢', body: `${out}\n\nالعدد الكلي: ${primes.length}`, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تحليل_لعوامل', 'تحليل عدد إلى عوامله الأولية', async (m, ctx) => {
  let n = Math.min(1e9, Math.max(2, parseInt(ctx.args?.[0] ?? '84', 10) || 84));
  const orig = n; const f = [];
  for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; }
  if (n > 1) f.push(n);
  const out = `${orig} = ${f.join(' × ')}`;
  await sendInteractiveCard(m, ctx, { title: 'التحليل لعوامل أولية', badge: '➗', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('قاسم_مشترك', 'القاسم المشترك الأكبر لرقمين', async (m, ctx) => {
  const [a0, b0] = numArgs(ctx, [36, 48]);
  let a = Math.abs(Math.trunc(a0)), b = Math.abs(Math.trunc(b0));
  while (b) { [a, b] = [b, a % b]; }
  await m.reply(`🧮 القاسم المشترك الأكبر بين ${a0} و ${b0} = *${a}*`);
});
add('مضاعف_مشترك', 'المضاعف المشترك الأصغر لرقمين', async (m, ctx) => {
  const [a0, b0] = numArgs(ctx, [12, 18]);
  let a = Math.abs(Math.trunc(a0)), b = Math.abs(Math.trunc(b0));
  const g = (x, y) => (y ? g(y, x % y) : x);
  const lcm = a && b ? (a * b) / g(a, b) : 0;
  await m.reply(`🧮 المضاعف المشترك الأصغر بين ${a0} و ${b0} = *${lcm}*`);
});
add('عمر_بالتفصيل', 'حساب العمر الدقيق من تاريخ الميلاد (YYYY-MM-DD)', async (m, ctx) => {
  const raw = ctx.args?.[0] || '2002-05-15';
  const dob = new Date(raw);
  if (isNaN(dob.getTime())) return m.reply('📌 اكتب التاريخ بصيغة YYYY-MM-DD مثال: 2002-05-15');
  const now = new Date();
  const days = Math.floor((now - dob) / 86400000);
  const years = Math.floor(days / 365.25);
  const hours = days * 24;
  await sendInteractiveCard(m, ctx, {
    title: 'حاسبة العمر التفصيلية',
    badge: '🎂',
    fields: [
      { icon: '📅', label: 'التاريخ', value: raw },
      { icon: '🎈', label: 'السنوات', value: `${years} سنة` },
      { icon: '📆', label: 'بالأيام', value: `${days.toLocaleString('en')} يوم` },
      { icon: '⏱️', label: 'بالساعات', value: `${hours.toLocaleString('en')} ساعة` }
    ],
    theme: 'royal'
  });
}, ['عمر_بالتفصيل 2002-05-15']);
add('كم_باقي_السنة', 'العد التنازلي لنهاية السنة الميلادية', async (m, ctx) => {
  const now = new Date();
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const days = Math.ceil((end - now) / 86400000);
  const pct = Math.round(((365 - days) / 365) * 100);
  await sendInteractiveCard(m, ctx, {
    title: `تقدم سنة ${now.getFullYear()}`,
    badge: '⏳',
    fields: [
      { icon: '📅', label: 'الأيام المتبقية', value: `${days} يوم` },
      { icon: '📊', label: 'المنقضي', value: progressBar(pct, 100, 12) }
    ],
    theme: 'cyber'
  });
});
add('سنة_كبيسة', 'فحص هل السنة كبيسة أم لا', async (m, ctx) => {
  const y = parseInt(ctx.args?.[0] ?? String(new Date().getFullYear()), 10) || new Date().getFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  await m.reply(`📅 سنة *${y}* ${leap ? '✅ سنة كبيسة (366 يوماً)' : 'ℹ️ سنة بسيطة (365 يوماً)'}`);
});
add('يوم_في_الاسبوع', 'معرفة اسم اليوم لأي تاريخ', async (m, ctx) => {
  const raw = ctx.args?.[0] || new Date().toISOString().slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return m.reply('📌 مثال: 2026-11-18');
  await m.reply(`📆 تاريخ *${raw}* يوافق يوم *${d.toLocaleDateString('ar-EG', { weekday: 'long' })}*`);
});
add('حاسبة_تقدير', 'تحويل الدرجة إلى تقدير جامعي', async (m, ctx) => {
  const s = Math.min(100, Math.max(0, parseFloat(ctx.args?.[0] ?? '88') || 0));
  const grade = s >= 90 ? 'امتياز (A+)' : s >= 85 ? 'امتياز (A)' : s >= 75 ? 'جيد جداً (B+)' : s >= 65 ? 'جيد (C+)' : s >= 50 ? 'مقبول (D)' : 'راسب (F)';
  await m.reply(`🎓 الدرجة: *${s}%* — التقدير: *${grade}*`);
});
add('توقيت_عالمي', 'عرض التوقيت الحالي في عدة عواصم عالمية', async (m, ctx) => {
  const zones = [['القاهرة', 'Africa/Cairo'], ['الرياض', 'Asia/Riyadh'], ['دبي', 'Asia/Dubai'], ['المغرب', 'Africa/Casablanca'], ['لندن', 'Europe/London'], ['نيويورك', 'America/New_York'], ['طوكيو', 'Asia/Tokyo']];
  const fields = zones.map(([city, tz]) => ({ icon: '🕒', label: city, value: new Date().toLocaleTimeString('ar-EG', { timeZone: tz, hour: '2-digit', minute: '2-digit' }) }));
  await sendInteractiveCard(m, ctx, { title: 'الساعة العالمية', badge: '🌍', fields, theme: 'cyber' });
});

// ── 3. 50 Developer, Encoding & Security Tools ──
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };
const REV_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const textOrDemo = (ctx, fallback = 'LIGHT BOT') => (ctx.text && ctx.text.trim()) || fallback;

add('تشفير_ثنائي', 'تحويل النص إلى Binary', async (m, ctx) => {
  const t = textOrDemo(ctx);
  const out = [...Buffer.from(t, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' ');
  await sendInteractiveCard(m, ctx, { title: 'تحويل إلى ثنائي (Binary)', badge: '💾', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ Binary', out)] });
});
add('فك_ثنائي', 'تحويل Binary إلى نص', async (m, ctx) => {
  const t = textOrDemo(ctx, '01001100 01001001 01000111 01001000 01010100');
  const bytes = t.trim().split(/\s+/).map((b) => parseInt(b, 2)).filter((n) => !isNaN(n));
  const out = Buffer.from(bytes).toString('utf8');
  await sendInteractiveCard(m, ctx, { title: 'فك التشفير الثنائي', badge: '💾', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تشفير_هيكس', 'تحويل النص إلى Hex', async (m, ctx) => {
  const out = Buffer.from(textOrDemo(ctx), 'utf8').toString('hex');
  await sendInteractiveCard(m, ctx, { title: 'تحويل إلى Hex', badge: '🔣', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ Hex', out)] });
});
add('فك_هيكس', 'تحويل Hex إلى نص', async (m, ctx) => {
  const out = Buffer.from(textOrDemo(ctx, '4c49474854').replace(/\s+/g, ''), 'hex').toString('utf8');
  await sendInteractiveCard(m, ctx, { title: 'فك تشفير Hex', badge: '🔣', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تشفير_مورس', 'تحويل النص الإنجليزي إلى شفرة مورس', async (m, ctx) => {
  const out = textOrDemo(ctx).toUpperCase().split('').map((c) => c === ' ' ? '/' : (MORSE[c] || c)).join(' ');
  await sendInteractiveCard(m, ctx, { title: 'شفرة مورس', badge: '📡', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ مورس', out)] });
});
add('فك_مورس', 'فك شفرة مورس إلى نص', async (m, ctx) => {
  const out = textOrDemo(ctx, '.-.. .. --. .... -').split(' ').map((c) => c === '/' ? ' ' : (REV_MORSE[c] || c)).join('');
  await sendInteractiveCard(m, ctx, { title: 'فك شفرة مورس', badge: '📡', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
const caesar = (s, shift) => s.replace(/[a-zA-Z]/g, (ch) => {
  const base = ch <= 'Z' ? 65 : 97;
  return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 260) % 26) + base);
});
add('تشفير_قيصر', 'تشفير قيصر بإزاحة 3 أحرف', async (m, ctx) => {
  const out = caesar(textOrDemo(ctx), 3);
  await sendInteractiveCard(m, ctx, { title: 'تشفير قيصر (+3)', badge: '🏛️', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('فك_قيصر', 'فك تشفير قيصر (-3)', async (m, ctx) => {
  const out = caesar(textOrDemo(ctx, 'OLJKW ERW'), -3);
  await sendInteractiveCard(m, ctx, { title: 'فك تشفير قيصر (-3)', badge: '🏛️', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تشفير_rot13', 'تشفير وفك ROT13', async (m, ctx) => {
  const out = caesar(textOrDemo(ctx), 13);
  await sendInteractiveCard(m, ctx, { title: 'ROT13', badge: '🔐', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تشفير_atbash', 'تشفير Atbash للأحرف الإنجليزية', async (m, ctx) => {
  const out = textOrDemo(ctx).replace(/[a-zA-Z]/g, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b));
  });
  await sendInteractiveCard(m, ctx, { title: 'شفرة Atbash', badge: '🔐', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تشفير_url', 'ترميز النص للروابط URL Encode', async (m, ctx) => {
  const out = encodeURIComponent(textOrDemo(ctx, 'مرحبا بالبوت'));
  await sendInteractiveCard(m, ctx, { title: 'URL Encode', badge: '🔗', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('فك_url', 'فك ترميز الروابط URL Decode', async (m, ctx) => {
  const out = decodeURIComponent(textOrDemo(ctx, '%D9%85%D8%B1%D8%AD%D8%A8%D8%A7'));
  await sendInteractiveCard(m, ctx, { title: 'URL Decode', badge: '🔗', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('هروب_html', 'HTML Escape', async (m, ctx) => {
  const out = textOrDemo(ctx, '<div class="x">Hi</div>').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  await sendInteractiveCard(m, ctx, { title: 'HTML Escape', badge: '🌐', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('فك_html', 'HTML Unescape', async (m, ctx) => {
  const out = textOrDemo(ctx, '&lt;b&gt;Hi&lt;/b&gt;').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  await sendInteractiveCard(m, ctx, { title: 'HTML Unescape', badge: '🌐', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('تنسيق_json', 'تنسيق كود JSON بمسافات مرتبة', async (m, ctx) => {
  const raw = textOrDemo(ctx, '{"bot":"Light","version":2,"interactive":true}');
  const out = JSON.stringify(JSON.parse(raw), null, 2);
  await sendInteractiveCard(m, ctx, { title: 'JSON Formatter', badge: '🧩', body: '```json\n' + out + '\n```', theme: 'cyber', buttons: [makeCopyButton('📋 نسخ JSON', out)] });
});
add('ضغط_json', 'ضغط JSON لسطر واحد', async (m, ctx) => {
  const raw = textOrDemo(ctx, '{ "bot": "Light", "ok": true }');
  const out = JSON.stringify(JSON.parse(raw));
  await sendInteractiveCard(m, ctx, { title: 'JSON Minifier', badge: '🗜️', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('فحص_json', 'التحقق من صحة صيغة JSON', async (m, ctx) => {
  try {
    const parsed = JSON.parse(textOrDemo(ctx, '{"ok":true}'));
    await m.reply(`✅ JSON سليم! النوع: *${Array.isArray(parsed) ? 'Array' : typeof parsed}*`);
  } catch (e) {
    await m.reply(`❌ خطأ في JSON: ${e.message}`);
  }
});
add('اختبار_regex', 'اختبار تعبير نمطي (النمط | النص)', async (m, ctx) => {
  const [pat = '\\d+', sample = 'Order #42 and #99'] = textOrDemo(ctx, '\\d+ | Order #42 and #99').split('|').map((s) => s.trim());
  const matches = sample.match(new RegExp(pat, 'g')) || [];
  await sendInteractiveCard(m, ctx, { title: 'اختبار Regex', badge: '🔍', fields: [{ label: 'النمط', value: `/${pat}/g` }, { label: 'النص', value: sample }, { label: 'التطابقات', value: matches.length ? matches.join(', ') : 'لا يوجد تطابق' }], theme: 'cyber' });
});
add('كود_http', 'شرح رمز حالة HTTP (مثال: 404)', async (m) => {
  const HTTP_CODES = { 200: 'OK — نجاح الطلب', 201: 'Created — تم إنشاء المورد', 204: 'No Content — نجاح بدون محتوى', 301: 'Moved Permanently — تحويل دائم', 302: 'Found — تحويل مؤقت', 400: 'Bad Request — طلب غير صالح', 401: 'Unauthorized — غير مصرح (مطلوب تسجيل دخول)', 403: 'Forbidden — ممنوع الوصول', 404: 'Not Found — غير موجود', 429: 'Too Many Requests — تجاوز حد الطلبات', 500: 'Internal Server Error — خطأ داخلي في الخادم', 502: 'Bad Gateway — بوابة غير صالحة', 503: 'Service Unavailable — الخدمة غير متاحة' };
  const code = parseInt(m.text || '200', 10) || 200;
  await m.reply(`🌐 *HTTP ${code}:* ${HTTP_CODES[code] || 'رمز حالة قياسي في بروتوكول HTTP'}`);
});
add('كود_hex_rgb', 'تحويل لون HEX إلى RGB', async (m, ctx) => {
  const hex = textOrDemo(ctx, '#e11d48').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return m.reply('❌ اكتب كود لون HEX من 6 خانات مثال #e11d48');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const rgb = `rgb(${r}, ${g}, ${b})`;
  await sendInteractiveCard(m, ctx, { title: 'محول الألوان HEX → RGB', badge: '🎨', body: `#${hex.toUpperCase()} ➜ *${rgb}*`, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ RGB', rgb)] });
});
add('توليد_pin', 'توليد رمز PIN عشوائي آمن', async (m, ctx) => {
  const len = Math.min(12, Math.max(4, parseInt(ctx.args?.[0] ?? '6', 10) || 6));
  const pin = Array.from(crypto.randomBytes(len), (b) => b % 10).join('');
  await sendInteractiveCard(m, ctx, { title: 'توليد PIN عشوائي', badge: '🔢', body: `\`${pin}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ PIN', pin), makeQuickButton('🔄 جديد', `توليد_pin ${len}`, ctx.usedPrefix || '.')] });
});
add('توليد_توكين', 'توليد مفتاح عشوائي آمن Hex Token', async (m, ctx) => {
  const tok = crypto.randomBytes(24).toString('hex');
  await sendInteractiveCard(m, ctx, { title: 'توليد Token آمن', badge: '🔑', body: `\`${tok}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ Token', tok)] });
});
add('توليد_ulid', 'توليد معرّف زمني فريد ULID', async (m, ctx) => {
  const t = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const r = crypto.randomBytes(8).toString('hex').toUpperCase();
  const id = `${t}${r}`;
  await sendInteractiveCard(m, ctx, { title: 'توليد ULID', badge: '🆔', body: `\`${id}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ ULID', id)] });
});
add('توليد_ip', 'توليد عنوان IPv4 عشوائي للاختبار', async (m, ctx) => {
  const ip = Array.from({ length: 4 }, () => Math.floor(Math.random() * 254) + 1).join('.');
  await sendInteractiveCard(m, ctx, { title: 'IPv4 عشوائي', badge: '🌐', body: `\`${ip}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ IP', ip)] });
});
add('توليد_mac', 'توليد عنوان MAC عشوائي', async (m, ctx) => {
  const mac = Array.from({ length: 6 }, () => crypto.randomBytes(1)[0].toString(16).padStart(2, '0').toUpperCase()).join(':');
  await sendInteractiveCard(m, ctx, { title: 'MAC Address عشوائي', badge: '🔌', body: `\`${mac}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ MAC', mac)] });
});
add('توليد_slug', 'تحويل عنوان إلى رابط Slug نظيف', async (m, ctx) => {
  const slug = textOrDemo(ctx, 'Hello Light Bot 2026').toLowerCase().trim().replace(/[^\w\u0600-\u06FF\s-]/g, '').replace(/\s+/g, '-');
  await sendInteractiveCard(m, ctx, { title: 'مولد Slug', badge: '🔗', body: `\`${slug}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ Slug', slug)] });
});

const CASE_TRANSFORMS = [
  ['كيس_camel', 'camelCase', (w) => w.map((x, i) => i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join('')],
  ['كيس_pascal', 'PascalCase', (w) => w.map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('')],
  ['كيس_snake', 'snake_case', (w) => w.map((x) => x.toLowerCase()).join('_')],
  ['كيس_kebab', 'kebab-case', (w) => w.map((x) => x.toLowerCase()).join('-')],
  ['كيس_constant', 'CONSTANT_CASE', (w) => w.map((x) => x.toUpperCase()).join('_')]
];
for (const [cmd, label, fn] of CASE_TRANSFORMS) {
  add(cmd, `تحويل النص إلى ${label}`, async (m, ctx) => {
    const words = textOrDemo(ctx, 'light bot interactive').trim().split(/[\s_-]+/).filter(Boolean);
    const out = fn(words);
    await sendInteractiveCard(m, ctx, { title: label, badge: '🔤', body: `\`${out}\``, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
  });
}

add('عداد_كلمات', 'عدّ الكلمات والحروف والأسطر', async (m, ctx) => {
  const t = textOrDemo(ctx, 'لايت بوت أسرع بوت واتساب تفاعلي');
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  const chars = t.length;
  const noSpace = t.replace(/\s+/g, '').length;
  const lines = t.split('\n').length;
  await sendInteractiveCard(m, ctx, { title: 'محلل النصوص', badge: '📊', fields: [{ label: 'الكلمات', value: words }, { label: 'الحروف', value: chars }, { label: 'بدون مسافات', value: noSpace }, { label: 'الأسطر', value: lines }], theme: 'cyber' });
});
add('عداد_حروف', 'عد الحروف في النص', async (m, ctx) => { const t = textOrDemo(ctx); await m.reply(`🔤 عدد الحروف: *${t.length}* (بدون مسافات: *${t.replace(/\s+/g, '').length}*)`); });
add('عداد_اسطر', 'عد الأسطر في النص', async (m, ctx) => { const t = textOrDemo(ctx); await m.reply(`📄 عدد الأسطر: *${t.split('\n').length}*`); });
add('عكس_كلمات', 'عكس ترتيب الكلمات في الجملة', async (m, ctx) => {
  const out = textOrDemo(ctx, 'البوت الذكي لايت').split(/\s+/).reverse().join(' ');
  await sendInteractiveCard(m, ctx, { title: 'عكس الكلمات', badge: '🔄', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('فرز_اسطر', 'ترتيب الكلمات/الأسطر أبجدياً', async (m, ctx) => {
  const items = textOrDemo(ctx, 'تفاح\nبرتقال\nأناناس').split(/\n|,/).map((s) => s.trim()).filter(Boolean).sort();
  const out = items.join('\n');
  await sendInteractiveCard(m, ctx, { title: 'فرز أبجدي', badge: '📑', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('ازالة_المكرر', 'إزالة الكلمات أو الأسطر المكررة', async (m, ctx) => {
  const items = [...new Set(textOrDemo(ctx, 'أحمد علي أحمد سارة علي').split(/\s+/).filter(Boolean))];
  const out = items.join(' ');
  await sendInteractiveCard(m, ctx, { title: 'إزالة التكرار', badge: '🧹', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('ترقيم_الاسطر', 'ترقيم قائمة نصوص تلقائياً', async (m, ctx) => {
  const out = textOrDemo(ctx, 'مهمة أولى\nمهمة ثانية\nمهمة ثالثة').split(/\n|,/).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n');
  await sendInteractiveCard(m, ctx, { title: 'قائمة مرقّمة', badge: '🔢', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', out)] });
});
add('استخراج_روابط', 'استخراج جميع الروابط من نص', async (m, ctx) => {
  const urls = textOrDemo(ctx, 'زر https://example.com أو https://github.com').match(/https?:\/\/[^\s]+/gi) || [];
  await m.reply(urls.length ? `🔗 الروابط المستخرجة:\n${urls.join('\n')}` : '❌ لا توجد روابط في النص');
});
add('استخراج_ايميلات', 'استخراج البريد الإلكتروني من نص', async (m, ctx) => {
  const emails = textOrDemo(ctx, 'contact user@example.com or admin@bot.io').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  await m.reply(emails.length ? `📧 الإيميلات:\n${emails.join('\n')}` : '❌ لا توجد إيميلات في النص');
});
add('استخراج_ارقام', 'استخراج كل الأرقام من نص', async (m, ctx) => {
  const nums = textOrDemo(ctx, 'رقم 15 وسعر 250 وخصم 10').match(/\d+(\.\d+)?/g) || [];
  await m.reply(nums.length ? `🔢 الأرقام: ${nums.join(' , ')}` : '❌ لا توجد أرقام');
});
add('استخراج_هاشتاج', 'استخراج الهاشتاجات من نص', async (m, ctx) => {
  const tags = textOrDemo(ctx, '#برمجة #واتساب #لايت_بوت').match(/#[\w\u0600-\u06FF]+/g) || [];
  await m.reply(tags.length ? `🏷️ الهاشتاجات:\n${tags.join(' ')}` : '❌ لا توجد هاشتاجات');
});
add('فحص_قوة_باسورد', 'تقييم قوة كلمة المرور', async (m, ctx) => {
  const pw = textOrDemo(ctx, 'LightBot@2026!');
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[a-z]/.test(pw)) score += 15;
  if (/\d/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  const label = score >= 80 ? 'قوية جداً 🔒' : score >= 55 ? 'متوسطة 🔓' : 'ضعيفة ⚠️';
  await sendInteractiveCard(m, ctx, { title: 'فاحص قوة كلمة المرور', badge: '🛡️', fields: [{ label: 'التقييم', value: label }, { label: 'المؤشر', value: progressBar(score, 100, 10) }], theme: 'cyber' });
});
add('شرح_cron', 'شرح تعبير Cron الشائع', async (m, ctx) => {
  const expr = textOrDemo(ctx, '*/5 * * * *');
  await sendInteractiveCard(m, ctx, { title: 'محلل Cron', badge: '⏰', body: `التعبير: \`${expr}\`\nالترتيب: دقيقة | ساعة | يوم-الشهر | شهر | يوم-الأسبوع`, tip: 'مثال: 0 9 * * * = يومياً الساعة 9 صباحاً', theme: 'cyber' });
});
add('قناع_نص', 'إخفاء جزء من النص أو الرقم السري', async (m, ctx) => {
  const t = textOrDemo(ctx, '01012345678');
  const masked = t.length <= 4 ? '*'.repeat(t.length) : t.slice(0, 2) + '*'.repeat(t.length - 4) + t.slice(-2);
  await sendInteractiveCard(m, ctx, { title: 'إخفاء البيانات', badge: '🕶️', body: masked, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', masked)] });
});

// ── 4. 40+ Quick Generators & Productivity Helpers ──
const EXTRA_UTILS = [
  ['مؤقت_بومودورو', 'خطة بومودورو جاهزة', () => '🍅 25 دقيقة تركيز تام\n☕ 5 دقائق راحة\n🔁 كرر 4 مرات ثم خذ 20 دقيقة راحة كبرى'],
  ['خطة_يوم', 'قالب خطة يومية منظم', () => '🌅 الفجر: هدف واحد أساسي\n☀️ الظهيرة: إنجاز 3 مهام صغيرة\n🌙 المساء: مراجعة وتقييم اليوم'],
  ['اولويات_ايزنهاور', 'مصفوفة أيزنهاور للأولويات', () => '🔥 عاجل ومهم: نفّذه الآن\n📅 مهم غير عاجل: خطّط له\n🤝 عاجل غير مهم: فوّضه\n🗑️ غير عاجل وغير مهم: احذفه'],
  ['لوحة_الوان', 'توليد لوحة ألوان HEX متناسقة', () => Array.from({ length: 5 }, () => '#' + crypto.randomBytes(3).toString('hex').toUpperCase()).join('  •  ')],
  ['تدرج_لوني', 'توليد تدرج CSS Gradient عشوائي', () => { const c1 = '#' + crypto.randomBytes(3).toString('hex'); const c2 = '#' + crypto.randomBytes(3).toString('hex'); return `linear-gradient(135deg, ${c1}, ${c2})`; }],
  ['رابط_واتساب_مباشر', 'إنشاء رابط wa.me مباشر', (ctx) => { const p = (ctx.args?.[0] || '201000000000').replace(/\D/g, ''); return `https://wa.me/${p}`; }],
  ['رابط_تليجرام', 'إنشاء رابط تليجرام t.me', (ctx) => `https://t.me/${(ctx.args?.[0] || 'lightbot').replace(/^@/, '')}`],
  ['نص_وهمي', 'توليد نص عربي تجريبي Lorem', () => 'هذا نص عربي تجريبي لاختبار التصميم وتنسيق الفقرات في الواجهات والتطبيقات الحديثة بشكل منظم وواضح.'],
  ['قرار_عشوائي', 'مساعد اتخاذ القرار السريع', () => ['✅ نعم، توكل على الله!', '⏳ انتظر وفكّر قليلاً', '🔄 جرّب خياراً بديلاً', '❌ الأفضل التأجيل الآن'][Math.floor(Math.random() * 4)]],
  ['عملة_معدنية_برو', 'رمي عملة احترافية مع إحصائية', () => Math.random() < 0.5 ? '🪙 *ملك (صورة)*' : '🪙 *كتابة*'],
  ['رقم_حظ', 'توليد 6 أرقام عشوائية', () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 99) + 1).join(' - ')],
  ['لون_اليوم', 'اقتراح لون مميز مع الكود', () => { const h = '#' + crypto.randomBytes(3).toString('hex').toUpperCase(); return `🎨 لونك المقترح: *${h}*`; }],
  ['كود_rgb_hex', 'تحويل RGB إلى HEX (مثال: 225 29 72)', (ctx) => { const [r, g, b] = numArgs(ctx, [225, 29, 72]).map((v) => Math.max(0, Math.min(255, Math.round(v)))); return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); }],
  ['تشفير_xor', 'تشفير بسيط XOR للنص مع مفتاح 42', (ctx) => Buffer.from([...Buffer.from(textOrDemo(ctx))].map((b) => b ^ 42)).toString('hex')],
  ['فك_xor', 'فك تشفير XOR', (ctx) => Buffer.from([...Buffer.from(textOrDemo(ctx, '66636d627e'), 'hex')].map((b) => b ^ 42)).toString('utf8')],
  ['تقسيم_نص', 'تقسيم نص على شكل نقاط', (ctx) => textOrDemo(ctx, 'أولاً,ثانياً,ثالثاً').split(/,|،/).map((s) => `▸ ${s.trim()}`).join('\n')],
  ['دمج_اسطر', 'دمج الأسطر في سطر واحد', (ctx) => textOrDemo(ctx, 'سطر1\nسطر2').split(/\n+/).map((s) => s.trim()).join(' | ')],
  ['جدول_ascii', 'عرض عينة من رموز ASCII', () => '33:!  35:#  36:$  37:%  38:&  42:*  64:@  65:A  97:a'],
  ['باركود_ascii', 'توليد شريط باركود نصي', () => '║▌║█║▌│║▌║▌█ 2026-LIGHT'],
  ['تقويم_الشهر', 'عرض معلومات الشهر الحالي', () => { const d = new Date(); return `📅 ${d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })} — اليوم ${d.getDate()}`; }],
  ['فارق_التوقيت', 'فرق التوقيت UTC', () => { const off = -new Date().getTimezoneOffset() / 60; return `🕒 المنطقة الزمنية للخادم: UTC${off >= 0 ? '+' + off : off}`; }],
  ['كم_باقي_رمضان', 'رسالة تذكيرية للمناسبات', () => '🌙 استعد دائماً بالقرآن والصدقة وحسن الخلق قبل كل موسم خير!'],
  ['معدل_تراكمي', 'تحويل معدل من 4 إلى نسبة مئوية', (ctx) => { const g = Math.min(4, Math.max(0, parseFloat(ctx.args?.[0] ?? '3.5') || 3.5)); return `🎓 GPA ${g}/4.0 ≈ *${Math.round((g / 4) * 100)}%*`; }],
  ['تكلفة_وقود', 'حساب تكلفة رحلة (المسافة_كم الاستهلاك_لكل_100 السعر)', (ctx) => { const [d, c, p] = numArgs(ctx, [100, 8, 13.75]); return `⛽ اللترات: ${((d / 100) * c).toFixed(2)} لتر | التكلفة: ${(((d / 100) * c) * p).toFixed(2)}`; }],
  ['مسافة_سفر', 'حساب وقت الوصول (المسافة_كم السرعة)', (ctx) => { const [d, s] = numArgs(ctx, [240, 100]); const h = d / Math.max(1, s); return `🚗 الزمن المتوقع: ${Math.floor(h)} ساعة و ${Math.round((h % 1) * 60)} دقيقة`; }],
  ['سرعة_تحميل_تقديرية', 'زمن تحميل ملف (الحجم_MB السرعة_Mbps)', (ctx) => { const [mb, sp] = numArgs(ctx, [1024, 50]); const sec = (mb * 8) / Math.max(0.1, sp); return `⬇️ الزمن التقريبي: ${sec >= 60 ? (sec / 60).toFixed(1) + ' دقيقة' : sec.toFixed(1) + ' ثانية'}`; }],
  ['استهلاك_كهرباء', 'حساب استهلاك جهاز (الوات الساعات)', (ctx) => { const [w, h] = numArgs(ctx, [1500, 4]); return `⚡ الاستهلاك: ${((w * h) / 1000).toFixed(2)} كيلوواط/ساعة يومياً`; }],
  ['حجم_صورة_تقديري', 'تقدير حجم صورة غير مضغوطة (عرض ارتفاع)', (ctx) => { const [w, h] = numArgs(ctx, [1920, 1080]); return `🖼️ الحجم الخام: ${((w * h * 3) / (1024 * 1024)).toFixed(2)} MB`; }],
  ['ملخص_ارقام', 'حساب المجموع والمتوسط والأكبر والأصغر', (ctx) => { const nums = (ctx.args?.length ? ctx.args : ['10', '20', '35', '15']).map(Number).filter((x) => !isNaN(x)); const sum = nums.reduce((a, b) => a + b, 0); return `∑ المجموع: ${sum} | المتوسط: ${(sum / nums.length).toFixed(2)} | الأعلى: ${Math.max(...nums)} | الأدنى: ${Math.min(...nums)}`; }],
  ['عداد_تقدم', 'رسم شريط تقدم لأي نسبة', (ctx) => progressBar(parseFloat(ctx.args?.[0] ?? '75') || 0, 100, 12)],
  ['بطاقة_تعريف', 'إنشاء بطاقة vCard نصية سريعة', (ctx) => { const name = textOrDemo(ctx, 'لايت بوت'); return `📇 *${name}*\n🤖 مطور وخدمات رقمية\n🌐 متاح عبر واتساب`; }],
  ['قائمة_مهام', 'إنشاء قائمة مهام تفاعلية', (ctx) => textOrDemo(ctx, 'مراجعة الكود,اختبار البوت,تحديث الأوامر').split(/,|،/).map((x) => `☐ ${x.trim()}`).join('\n')],
  ['جدول_مذاكرة', 'توزيع ساعات المذاكرة بذكاء', () => '📚 45د مادة أساسية → 10د راحة → 45د تطبيق عملي → 15د مراجعة'],
  ['صيغة_ملف', 'التعرف على امتداد ملف شائع', (ctx) => { const ext = textOrDemo(ctx, 'json').replace('.', '').toLowerCase(); const map = { json: 'بيانات JSON مهيكلة', js: 'كود JavaScript', mjs: 'وحدة ES Module', png: 'صورة نقطية بدون فقدان', webp: 'صورة ويب حديثة للملصقات', mp4: 'فيديو مضغوط H.264', pdf: 'مستند محمول PDF' }; return `📁 *.${ext}:* ${map[ext] || 'ملف بيانات/نظام'}`; }],
  ['حساب_الوقت', 'جمع دقائق أو ساعات', (ctx) => { const [h, m1, addM] = numArgs(ctx, [10, 30, 95]); const tot = h * 60 + m1 + addM; return `🕒 الناتج: ${Math.floor((tot % 1440) / 60).toString().padStart(2, '0')}:${(tot % 60).toString().padStart(2, '0')}`; }],
  ['فرق_الايام', 'عدد الأيام بين تاريخين', (ctx) => { const [d1 = '2026-01-01', d2 = '2026-12-31'] = ctx.args || []; const diff = Math.abs(new Date(d2) - new Date(d1)) / 86400000; return isNaN(diff) ? '📌 اكتب تاريخين YYYY-MM-DD' : `📆 الفارق: *${Math.round(diff)} يوم*`; }],
  ['مقارنة_نصوص', 'فحص تطابق نصين (نص1 | نص2)', (ctx) => { const [a = 'Light', b = 'Light'] = textOrDemo(ctx, 'Light | light').split('|').map((s) => s.trim()); return a === b ? '✅ النصان متطابقان تماماً' : a.toLowerCase() === b.toLowerCase() ? '🟡 متطابقان مع اختلاف حالة الأحرف' : '❌ النصان مختلفان'; }]
];

for (const [cmd, desc, fn] of EXTRA_UTILS) {
  add(cmd, desc, async (m, ctx) => {
    const res = String(await fn(ctx));
    await sendInteractiveCard(m, ctx, {
      title: desc,
      badge: '⚙️',
      body: res,
      theme: 'cyber',
      buttons: [makeCopyButton('📋 نسخ', res)]
    });
  });
}

export default handlers;
