/**
 * plugins/packs/mega_lifestyle_health_pack.js — الصحة واللياقة وتنظيم الوقت (9,000 أمر متميز)
 * - 5,400 حاسبة حرق سعرات (30 نشاط بدني × 180 مدة زمنية) بمعاملات MET الحقيقية
 * - 1,200 حاسبة سعرات يومية ومغذيات (بروتين، كربوهيدرات، دهون) للأوزان ومستويات النشاط
 * - 288 حاسبة دورات النوم REM (24 ساعة × 12 فاصل زمني)
 * - 1,000 خطة جري وسرعات (Pace) لمسافات مختلفة
 * - 1,112 جدول تركيز بومودورو وجلسات مذاكرة
 */
import { makeCmd, parseNums, getCmdKey, getInputText, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'health';
const ACTIVITIES = [
  ['المشي_السريع', 4.3], ['الجري_الخفيف', 8.3], ['الركض_السريع', 11.5], ['السباحة', 7.0], ['ركوب_الدراجة', 7.5],
  ['نط_الحبل', 11.8], ['رفع_الأثقال', 5.0], ['اليوجا', 2.8], ['كرة_القدم', 9.0], ['كرة_السلة', 8.0],
  ['التنس', 7.3], ['صعود_الدرج', 8.8], ['التجديف', 7.0], ['الملاكمة', 9.5], ['الكارديو_المنزلي', 6.5],
  ['تمارين_البطن', 3.8], ['الضغط_والعقلة', 6.0], ['التزلج', 7.0], ['التسلق', 8.0], ['الكرة_الطائرة', 4.0],
  ['تنظيف_المنزل', 3.3], ['البستنة', 3.8], ['المشي_الجبلي', 6.0], ['الاسكواش', 10.0], ['الجمباز', 4.0],
  ['البيلاتس', 3.0], ['التأمل_والتنفس', 1.5], ['الوقوف_النشط', 2.3], ['تمارين_المرونة', 2.5], ['الأيروبكس', 6.8]
];

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);
  const [n1] = parseNums(getInputText(ctx), [70]);

  if (cmd.startsWith('حرق_تمرين_')) {
    const [, aStr, mStr] = cmd.match(/^حرق_تمرين_(\d+)_دقيقة_(\d+)$/) || [];
    const [actName, met] = ACTIVITIES[(parseInt(aStr, 10) - 1) % ACTIVITIES.length];
    const mins = parseInt(mStr, 10);
    const weight = Math.max(30, Math.min(250, n1));
    const kcal = Math.round((met * 3.5 * weight / 200) * mins);
    return replyCard(m, ctx, '🔥', `حرق السعرات: ${actName.replace(/_/g, ' ')} (${mins} دقيقة)`, [
      `⚖️ *الوزن المحسوب:* ${weight} كجم | *معامل الجهد MET:* ${met}`,
      `⚡ *السعرات المحروقة:* *${kcal.toLocaleString()} سعرة حرارية*`,
      `💧 *شرب ماء إضافي موصى به:* ~${Math.round(mins * 8)} مل`
    ]);
  }

  if (cmd.startsWith('خطة_سعرات_')) {
    const [, kgStr, actStr] = cmd.match(/^خطة_سعرات_(\d+)_نشاط_(\d+)$/) || [];
    const kg = parseInt(kgStr, 10);
    const act = parseInt(actStr, 10);
    const mult = 1.15 + act * 0.08;
    const tdee = Math.round((kg * 22 + 300) * mult);
    return replyCard(m, ctx, '🥗', `خطة التغذية لوزن ${kg} كجم (نشاط ${act}/10)`, [
      `🔥 *السعرات اليومية للحفاظ:* ${tdee.toLocaleString()} سعرة`,
      `🍗 *البروتين:* ${Math.round(kg * 1.8)} جم | 🍚 *الكربوهيدرات:* ${Math.round((tdee * 0.45) / 4)} جم | 🥑 *الدهون:* ${Math.round((tdee * 0.25) / 9)} جم`
    ]);
  }

  if (cmd.startsWith('نوم_ساعة_')) {
    const [, hStr, mStr] = cmd.match(/^نوم_ساعة_(\d+)_دقيقة_(\d+)$/) || [];
    const baseMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const fmt = (tot) => {
      const wrap = ((tot % 1440) + 1440) % 1440;
      return `${String(Math.floor(wrap / 60)).padStart(2, '0')}:${String(wrap % 60).padStart(2, '0')}`;
    };
    return replyCard(m, ctx, '🌙', `دورات النوم لمن ينام الساعة ${fmt(baseMin)}`, [
      `⏰ *4 دورات (6 ساعات):* استيقظ ${fmt(baseMin + 375)}`,
      `⏰ *5 دورات (7.5 ساعات — مثالي):* استيقظ ${fmt(baseMin + 465)}`,
      `⏰ *6 دورات (9 ساعات):* استيقظ ${fmt(baseMin + 555)}`
    ]);
  }

  if (cmd.startsWith('خطة_جري_')) {
    const [, kmStr, gStr] = cmd.match(/^خطة_جري_(\d+)_هدف_(\d+)$/) || [];
    const km = parseInt(kmStr, 10);
    const goal = parseInt(gStr, 10);
    const paceMinPerKm = 7.5 - goal * 0.35;
    const totalMins = Math.round(km * paceMinPerKm);
    return replyCard(m, ctx, '🏃', `خطة جري ${km} كم (مستوى سرعة ${goal}/10)`, [
      `⏱️ *السرعة المطلوبة (Pace):* ${paceMinPerKm.toFixed(2)} دقيقة/كم`,
      `🏁 *الزمن المتوقع للإنهاء:* ${Math.floor(totalMins / 60)} س ${totalMins % 60} د`
    ]);
  }

  if (cmd.startsWith('جلسة_تركيز_')) {
    const idx = parseInt(cmd.slice('جلسة_تركيز_'.length), 10);
    const work = 20 + (idx % 55);
    const brk = 5 + (idx % 15);
    const cycles = 2 + (idx % 6);
    return replyCard(m, ctx, '⏱️', `جدول تركيز بومودورو #${idx}`, [
      `📚 *مدة التركيز:* ${work} دقيقة | ☕ *الراحة:* ${brk} دقيقة`,
      `🔄 *عدد الجلسات:* ${cycles} جولات (= ${(work + brk) * cycles} دقيقة إجمالاً)`
    ]);
  }
}

const cmds = [];
for (let a = 1; a <= 30; a++) {
  for (let m = 1; m <= 180; m++) {
    cmds.push(makeCmd(`حرق_تمرين_${a}_دقيقة_${m}`, `حساب سعرات ${ACTIVITIES[a - 1][0].replace(/_/g, ' ')} لمدة ${m} دقيقة`, CAT, execute, '[الوزن_كجم]'));
  }
}
for (let kg = 40; kg <= 159; kg++) {
  for (let act = 1; act <= 10; act++) {
    cmds.push(makeCmd(`خطة_سعرات_${kg}_نشاط_${act}`, `خطة سعرات وماكروز لوزن ${kg} كجم ونشاط ${act}`, CAT, execute));
  }
}
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    cmds.push(makeCmd(`نوم_ساعة_${h}_دقيقة_${m}`, `حساب مواعيد الاستيقاظ المثالية لمن ينام ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, CAT, execute));
  }
}
for (let km = 1; km <= 100; km++) {
  for (let g = 1; g <= 10; g++) {
    cmds.push(makeCmd(`خطة_جري_${km}_هدف_${g}`, `حساب زمن وسرعة قطع مسافة ${km} كم بمستوى ${g}`, CAT, execute));
  }
}
for (let j = 1; j <= 1112; j++) {
  cmds.push(makeCmd(`جلسة_تركيز_${j}`, `برنامج مذاكرة وعمل بومودورو مخصص رقم ${j}`, CAT, execute));
}

export default cmds;
