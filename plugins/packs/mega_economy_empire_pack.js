/**
 * plugins/packs/mega_economy_empire_pack.js — الإمبراطورية الاقتصادية والأعمال (9,000 أمر متميز)
 * - 3,000 حزمة استثمارية عبر 30 قطاعاً اقتصادياً × 100 مستوى عائد (تضيف أرباحاً فعلية في global.db)
 * - 2,000 أمر ترقية وتوسيع الشركات والأصول
 * - 2,200 حاسبة عائد مركب وأرباح سنوية وتقسيط مالي
 * - 1,800 أمر بورصة سلع ومعادن وأسهم بأسعار حسابية ديناميكية
 */
import { makeCmd, parseNums, getCmdKey, getInputText, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'empire';
const SECTORS = [
  'البرمجيات', 'الذكاء_الاصطناعي', 'الطاقة_الشمسية', 'العقارات', 'التجارة_الإلكترونية', 'الزراعة_الذكية',
  'اللوجستيات', 'التعليم_الرقمي', 'الصحة_التقنية', 'السياحة', 'الأمن_السيبراني', 'الألعاب',
  'التعدين', 'الملاحة', 'البتروكيماويات', 'الأغذية', 'الملابس', 'السيارات_الكهربائية',
  'الفضاء', 'الروبوتات', 'الإعلام', 'الاستشارات', 'الاتصالات', 'التمويل',
  'البناء', 'الطيران', 'إعادة_التدوير', 'المياه', 'الأثاث', 'الرياضة'
];

function ensureAccount(m) {
  global.db = global.db || { users: {}, groups: {} };
  global.db.users = global.db.users || {};
  const id = m?.sender || 'tester@s.whatsapp.net';
  if (!global.db.users[id]) global.db.users[id] = { money: 1000, exp: 0, empireLevel: 1 };
  const u = global.db.users[id];
  u.money = Number(u.money) || 0;
  u.exp = Number(u.exp) || 0;
  return u;
}

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);
  const user = ensureAccount(m);
  const [n1, n2] = parseNums(getInputText(ctx), [10000, 5]);

  if (cmd.startsWith('استثمار_مشروع_')) {
    const [, secStr, lvlStr] = cmd.match(/^استثمار_مشروع_(\d+)_مستوى_(\d+)$/) || [];
    const secId = parseInt(secStr, 10);
    const lvl = parseInt(lvlStr, 10);
    const sectorName = SECTORS[(secId - 1) % SECTORS.length].replace(/_/g, ' ');
    const profit = 40 + secId * 5 + lvl * 3;
    user.money += profit;
    user.exp += 15;
    return replyCard(m, ctx, '🏛️', `استثمار قطاع ${sectorName} (مستوى ${lvl})`, [
      `📈 *العائد الصافي المحقق:* +${profit.toLocaleString()} عملة`,
      `🏦 *إجمالي رصيدك الآن:* ${user.money.toLocaleString()} عملة`
    ]);
  }

  if (cmd.startsWith('ترقية_شركة_')) {
    const id = parseInt(cmd.slice('ترقية_شركة_'.length), 10);
    const bonus = 50 + (id % 250);
    user.money += bonus;
    user.empireLevel = (user.empireLevel || 1) + 1;
    return replyCard(m, ctx, '🚀', `ترقية أصول الشركة #${id}`, [
      `🏢 *مستوى الإمبراطورية الجديد:* ${user.empireLevel}`,
      `💵 *منحة التطوير:* +${bonus} عملة`
    ]);
  }

  if (cmd.startsWith('عائد_سنوي_')) {
    const rate = parseInt(cmd.slice('عائد_سنوي_'.length), 10) / 10; // 0.1% .. 220.0%
    const years = Math.max(1, Math.min(50, Math.trunc(n2)));
    const finalAmt = n1 * Math.pow(1 + rate / 100, years);
    return replyCard(m, ctx, '💹', `حاسبة الفائدة المركبة (${rate.toFixed(1)}% سنوياً)`, [
      `💵 *رأس المال الابتدائي:* ${n1.toLocaleString()}`,
      `⏳ *المدة:* ${years} سنة`,
      `💎 *القيمة النهائية:* *${Math.round(finalAmt).toLocaleString()}* (ربح +${Math.round(finalAmt - n1).toLocaleString()})`
    ]);
  }

  if (cmd.startsWith('بورصة_سلعة_')) {
    const item = parseInt(cmd.slice('بورصة_سلعة_'.length), 10);
    const basePrice = 25 + ((item * 37) % 1500);
    const delta = (((item + new Date().getMinutes()) % 11) - 5);
    const nowPrice = Math.max(5, Math.round(basePrice * (1 + delta / 100)));
    return replyCard(m, ctx, '📊', `مؤشر بورصة السلعة #${item}`, [
      `💲 *السعر الحالي للوحدة:* ${nowPrice.toLocaleString()}`,
      `📈 *التغيّر اللحظي:* ${delta >= 0 ? `+${delta}% 🟢` : `${delta}% 🔴`}`,
      `🧮 *تكلفة ${Math.max(1, Math.trunc(n1))} وحدة:* ${(nowPrice * Math.max(1, Math.trunc(n1))).toLocaleString()}`
    ]);
  }
}

const cmds = [];
for (let s = 1; s <= 30; s++) {
  for (let l = 1; l <= 100; l++) {
    cmds.push(makeCmd(`استثمار_مشروع_${s}_مستوى_${l}`, `استثمار في قطاع ${SECTORS[s - 1].replace(/_/g, ' ')} بالمستوى ${l}`, CAT, execute));
  }
}
for (let i = 1; i <= 2000; i++) cmds.push(makeCmd(`ترقية_شركة_${i}`, `توسيع البنية التجارية رقم ${i} وزيادة الدخل`, CAT, execute));
for (let r = 1; r <= 2200; r++) cmds.push(makeCmd(`عائد_سنوي_${r}`, `حاسبة الاستثمار المركب بعائد ${(r / 10).toFixed(1)}%`, CAT, execute, '<رأس_المال> [السنوات]'));
for (let b = 1; b <= 1800; b++) cmds.push(makeCmd(`بورصة_سلعة_${b}`, `متابعة سعر وتكلفة السلعة التجارية رقم ${b}`, CAT, execute, '[الكمية]'));

export default cmds;
