/**
 * plugins/packs/mega_games_rpg_pack.js — مغامرات RPG والزنزانات والأسلحة والنرد (11,000 أمر متميز)
 * - 5,000 غارة زنزانة عبر 500 طابق × 10 عنصر/عالم (تحديث حقيقي للخبرة والعملات في global.db)
 * - 2,000 معركة زعيم بطوابق متدرجة الصعوبة والمكافآت
 * - 1,500 رحلة تنقيب عن كنوز وأحجار كريمة
 * - 1,500 حدادة وصناعة أسلحة ودروع بخصائص قتالية فريدة
 * - 1,000 نرد متعدد الأوجه (من D2 إلى D1001) بإحصاءات حرجة
 */
import { makeCmd, parseNums, getCmdKey, getInputText, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'rpg';
const REALMS = ['النار', 'الجليد', 'الظلال', 'الرعد', 'الصحراء', 'الأعماق', 'الغابة', 'النجوم', 'الحمم', 'الكرستال'];
const DROPS = ['سيف أسطوري', 'تاج بلوري', 'درع تنين', 'تميمة الحكمة', 'حجر القمر', 'صولجان الرعد', 'خاتم الخلود', 'درع النجم'];

function ensureUser(m) {
  global.db = global.db || { users: {}, groups: {} };
  global.db.users = global.db.users || {};
  const id = m?.sender || 'tester@s.whatsapp.net';
  if (!global.db.users[id]) global.db.users[id] = { money: 500, exp: 0, rpgPower: 10, rpgWins: 0 };
  const u = global.db.users[id];
  u.money = Number(u.money) || 0;
  u.exp = Number(u.exp) || 0;
  u.rpgPower = Number(u.rpgPower) || 10;
  u.rpgWins = Number(u.rpgWins) || 0;
  return u;
}

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);
  const user = ensureUser(m);
  const [n1] = parseNums(getInputText(ctx), [1]);

  if (cmd.startsWith('زنزانة_بطل_')) {
    const [, fStr, rStr] = cmd.match(/^زنزانة_بطل_(\d+)_عالم_(\d+)$/) || [];
    const floor = parseInt(fStr, 10);
    const realmId = parseInt(rStr, 10);
    const realm = REALMS[(realmId - 1) % REALMS.length];
    const roll = Math.floor(Math.random() * 100) + Math.min(40, Math.floor(user.rpgPower / 5));
    const win = roll >= 20;
    const goldGain = win ? 50 + floor * 2 + realmId * 15 : 15;
    const expGain = win ? 30 + floor + realmId * 5 : 10;
    user.money += goldGain;
    user.exp += expGain;
    if (win) user.rpgWins += 1;
    return replyCard(m, ctx, '⚔️', `زنزانة طابق ${floor} — عالم ${realm}`, [
      win ? `🏆 *انتصار ساحق!* (رمية القوة: ${roll})` : `🛡️ *اشتباك متكافئ!* (رمية القوة: ${roll})`,
      `💰 *المكافأة:* +${goldGain.toLocaleString()} عملة | ✨ +${expGain} XP`,
      `🎒 *الغنيمة:* ${DROPS[(floor + realmId) % DROPS.length]} | رصيدك: ${user.money.toLocaleString()}`
    ]);
  }

  if (cmd.startsWith('زعيم_طابق_')) {
    const boss = parseInt(cmd.slice('زعيم_طابق_'.length), 10);
    const hp = 200 + boss * 45;
    const dmg = Math.round(user.rpgPower * 8 + Math.random() * 350);
    const goldGain = 120 + boss * 3;
    const expGain = 80 + boss;
    user.money += goldGain;
    user.exp += expGain;
    user.rpgPower += 1;
    return replyCard(m, ctx, '🐉', `معركة الزعيم الأسطوري #${boss}`, [
      `❤️ *صحة الزعيم:* ${hp.toLocaleString()} | ⚔️ *ضرر ضربتك:* ${dmg.toLocaleString()}`,
      `💰 *غنائم المعركة:* +${goldGain.toLocaleString()} عملة | ✨ +${expGain} XP`,
      `💪 *قوتك القتالية ارتفعت إلى:* ${user.rpgPower}`
    ]);
  }

  if (cmd.startsWith('كنز_كهف_')) {
    const cave = parseInt(cmd.slice('كنز_كهف_'.length), 10);
    const goldGain = 80 + ((cave * 17) % 420);
    user.money += goldGain;
    user.exp += 25;
    return replyCard(m, ctx, '💎', `استكشاف كهف الكنز #${cave}`, [
      `🪙 *اكتشفت صندوقاً يحتوي على:* +${goldGain} عملة ذهبية!`,
      `🏺 *القطعة النادرة:* ${DROPS[cave % DROPS.length]}`
    ]);
  }

  if (cmd.startsWith('حداد_سلاح_')) {
    const id = parseInt(cmd.slice('حداد_سلاح_'.length), 10);
    const atk = 35 + (id % 180);
    const crit = 5 + (id % 35);
    user.exp += 20;
    user.rpgPower += 1;
    return replyCard(m, ctx, '⚒️', `الحدادة — سلاح متطور #${id}`, [
      `🗡️ *الهجوم:* +${atk} | 💥 *الضربة الحرجة:* ${crit}%`,
      `✨ اكتسبت +20 XP ومستوى حِرفة جديد!`
    ]);
  }

  if (cmd.startsWith('نرد_اوجه_')) {
    const sides = parseInt(cmd.slice('نرد_اوجه_'.length), 10);
    const rollsCount = Math.max(1, Math.min(10, Math.trunc(n1)));
    const rolls = Array.from({ length: rollsCount }, () => 1 + Math.floor(Math.random() * sides));
    const sum = rolls.reduce((a, b) => a + b, 0);
    return replyCard(m, ctx, '🎲', `نرد D${sides} (${rollsCount} رمية)`, [
      `🎯 *النتائج:* ${rolls.join(' , ')}`,
      `📊 *المجموع:* *${sum}*${rolls.includes(sides) ? ' 🔥 (ضربة حاسمة MAX!)' : ''}`
    ]);
  }
}

const cmds = [];
for (let f = 1; f <= 500; f++) {
  for (let r = 1; r <= 10; r++) {
    cmds.push(makeCmd(`زنزانة_بطل_${f}_عالم_${r}`, `اقتحام زنزانة الطابق ${f} في عالم ${REALMS[r - 1]}`, CAT, execute));
  }
}
for (let b = 1; b <= 2000; b++) cmds.push(makeCmd(`زعيم_طابق_${b}`, `مواجهة الزعيم الأسطوري رقم ${b}`, CAT, execute));
for (let k = 1; k <= 1500; k++) cmds.push(makeCmd(`كنز_كهف_${k}`, `تنقيب عن الذهب والأحجار في الكهف ${k}`, CAT, execute));
for (let w = 1; w <= 1500; w++) cmds.push(makeCmd(`حداد_سلاح_${w}`, `صياغة وتطوير السلاح القتالي رقم ${w}`, CAT, execute));
for (let s = 2; s <= 1001; s++) cmds.push(makeCmd(`نرد_اوجه_${s}`, `رمي نرد عشوائي من ${s} وجه`, CAT, execute, '[عدد_الرميات]'));

export default cmds;
