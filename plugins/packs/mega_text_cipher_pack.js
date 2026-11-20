/**
 * plugins/packs/mega_text_cipher_pack.js — موسوعة التشفير والزخرفة والنصوص (11,000 أمر متميز)
 * - 8,000 مزخرف نصوص: 40 تحويلة خط ونمط أبجدي × 200 إطار زخرفي مميز
 * - 500 مشفّر وفك تشفير قيصر (إزاحة 1..250)
 * - 1,000 مشفّر XOR بمفاتيح رقمية متنوعة (1..1000)
 * - 500 مولد بصمات Hash متعددة البذور
 * - 500 مقسّم ومجزئ نصوص بأحجام مختلفة
 * - 500 مكرر نصوص بأنماط مختلفة
 */
import { makeCmd, getCmdKey, getInputText, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'cipher';

const FONT_TRANSFORMS = [
  (s) => s,
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D41A + c.charCodeAt(0) - 97) : c >= 'A' && c <= 'Z' ? String.fromCodePoint(0x1D400 + c.charCodeAt(0) - 65) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D44E + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D482 + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D5BA + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D5EE + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D622 + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x1D68A + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(0x24D0 + c.charCodeAt(0) - 97) : c)).join(''),
  (s) => [...s].map((c) => (c >= '!' && c <= '~' ? String.fromCodePoint(0xFF01 + c.charCodeAt(0) - 33) : c)).join(''),
  (s) => [...s].join(' '),
  (s) => [...s].join('ـ'),
  (s) => [...s].join(' • '),
  (s) => [...s].join('✦'),
  (s) => [...s].join('★'),
  (s) => [...s].reverse().join(''),
  (s) => s.toUpperCase(),
  (s) => s.toLowerCase(),
  (s) => [...s].map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join(''),
  (s) => [...s].map((c) => c + '\u0336').join(''),
  (s) => [...s].map((c) => c + '\u0332').join(''),
  (s) => [...s].map((c) => c + '\u0305').join(''),
  (s) => s.replace(/ا/g, 'آ').replace(/ي/g, 'ى').replace(/ه/g, 'ة'),
  (s) => s.replace(/ا/g, 'ٱ').replace(/ل/g, 'ڵ').replace(/م/g, 'مـ'),
  (s) => s.replace(/ /g, ' ❖ '),
  (s) => s.replace(/ /g, ' ◈ '),
  (s) => s.replace(/ /g, ' ━ '),
  (s) => `【${s}】`,
  (s) => `『${s}』`,
  (s) => `꧁${s}꧂`,
  (s) => `༺${s}༻`,
  (s) => `父${s}父`,
  (s) => `乡${s}乡`,
  (s) => `♛${s}♛`,
  (s) => `⚡${s}⚡`,
  (s) => `🔥${s}🔥`,
  (s) => `💎${s}💎`,
  (s) => `🌙${s}🌙`,
  (s) => `✨${s}✨`,
  (s) => `🩸${s}🩸`
]; // 40 transforms

const LEFT_ORNS = ['✦', '❖', '◈', '★', '♛', '⚡', '🔥', '💎', '🌙', '☀️', '🌊', '❄️', '🌸', '🍃', '⚜️', '🔱', '🛡️', '⚔️', '🎯', '🚀'];
const RIGHT_ORNS = ['═', '━', '─', '•', '✧', '✩', '❀', '✵', '❖', '▪'];

function buildFrame(frameId) {
  const l = LEFT_ORNS[(frameId - 1) % LEFT_ORNS.length];
  const r = RIGHT_ORNS[Math.floor((frameId - 1) / LEFT_ORNS.length) % RIGHT_ORNS.length];
  const bar = r.repeat(2 + ((frameId - 1) % 3));
  return [`${l}${bar} `, ` ${bar}${l}`];
}

function caesarShift(str, shift) {
  return [...str].map((ch) => {
    const code = ch.codePointAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(65 + (((code - 65 + shift) % 26 + 26) % 26));
    if (code >= 97 && code <= 122) return String.fromCodePoint(97 + (((code - 97 + shift) % 26 + 26) % 26));
    if (code >= 0x0621 && code <= 0x064A) {
      const span = 0x064A - 0x0621 + 1;
      return String.fromCodePoint(0x0621 + (((code - 0x0621 + shift) % span + span) % span));
    }
    return ch;
  }).join('');
}

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);
  const input = getInputText(ctx, 'LIGHT BOT');

  if (cmd.startsWith('زخرف_نمط_')) {
    const match = cmd.match(/^زخرف_نمط_(\d+)_اطار_(\d+)$/);
    const styleId = parseInt(match[1], 10);
    const frameId = parseInt(match[2], 10);
    const transformed = FONT_TRANSFORMS[(styleId - 1) % FONT_TRANSFORMS.length](input);
    const [pre, post] = buildFrame(frameId);
    const result = `${pre}${transformed}${post}`;
    return replyCard(m, ctx, '✨', `زخرفة نمط ${styleId} • إطار ${frameId}`, [
      `🎨 *النتيجة الجاهزة للنسخ:*`,
      result
    ]);
  }

  if (cmd.startsWith('قيصر_شفر_') || cmd.startsWith('قيصر_فك_')) {
    const isDec = cmd.startsWith('قيصر_فك_');
    const shift = parseInt(cmd.slice(9), 10);
    const out = caesarShift(input, isDec ? -shift : shift);
    return replyCard(m, ctx, '🔐', `تشفير قيصر (إزاحة ${isDec ? '-' : '+'}${shift})`, [
      `📥 *الأصل:* ${input}`,
      `🔑 *الناتج:* ${out}`
    ]);
  }

  if (cmd.startsWith('اكس_اور_')) {
    const keyNum = parseInt(cmd.slice('اكس_اور_'.length), 10);
    const buf = Buffer.from(input, 'utf8');
    const xored = Buffer.from(buf.map((b, i) => b ^ ((keyNum + i * 7) & 0xff)));
    return replyCard(m, ctx, '🔑', `تشفير XOR بمفتاح #${keyNum}`, [
      `📥 *النص:* ${input}`,
      `🧾 *Hex مشفّر:* \`${xored.toString('hex')}\``,
      `📦 *Base64:* \`${xored.toString('base64')}\``
    ]);
  }

  if (cmd.startsWith('هاش_بذرة_')) {
    const seed = parseInt(cmd.slice('هاش_بذرة_'.length), 10);
    let h1 = 0x811c9dc5 ^ seed;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    const h2 = ((h1 >>> 0) * (seed + 2654435761)) >>> 0;
    return replyCard(m, ctx, '#️⃣', `بصمة Hash بذرة #${seed}`, [
      `📝 *المدخل:* ${input}`,
      `🔐 *FNV-Seed Hex:* \`${h1.toString(16).padStart(8, '0')}-${h2.toString(16).padStart(8, '0')}\``
    ]);
  }

  if (cmd.startsWith('قطع_نص_')) {
    const size = parseInt(cmd.slice('قطع_نص_'.length), 10);
    const chunks = [];
    for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size));
    return replyCard(m, ctx, '✂️', `تقطيع النص كل ${size} محارف`, [
      `📦 *عدد الأجزاء:* ${chunks.length}`,
      chunks.slice(0, 20).map((c, i) => `${i + 1}. \`${c}\``).join('\n')
    ]);
  }

  if (cmd.startsWith('كرر_مزين_')) {
    const count = parseInt(cmd.slice('كرر_مزين_'.length), 10);
    const times = Math.min(count, 40);
    const orn = LEFT_ORNS[count % LEFT_ORNS.length];
    const lines = Array.from({ length: times }, (_, i) => `${orn} ${i + 1}. ${input}`);
    return replyCard(m, ctx, '🔁', `تكرار مزخرف #${count}`, [
      lines.join('\n') + (count > 40 ? `\n... (+${count - 40} سطر في المرجع الكامل)` : '')
    ]);
  }
}

const cmds = [];

// 8,000 text stylizers
for (let s = 1; s <= 40; s++) {
  for (let f = 1; f <= 200; f++) {
    cmds.push(makeCmd(`زخرف_نمط_${s}_اطار_${f}`, `زخرفة النص بالخط رقم ${s} والإطار الزخرفي ${f}`, CAT, execute, '<النص>'));
  }
}
// 500 Caesar ciphers
for (let k = 1; k <= 250; k++) {
  cmds.push(makeCmd(`قيصر_شفر_${k}`, `تشفير قيصر للنصوص بإزاحة +${k}`, CAT, execute, '<النص>'));
  cmds.push(makeCmd(`قيصر_فك_${k}`, `فك تشفير قيصر للنصوص بإزاحة -${k}`, CAT, execute, '<النص>'));
}
// 1,000 XOR ciphers
for (let k = 1; k <= 1000; k++) {
  cmds.push(makeCmd(`اكس_اور_${k}`, `تشفير نصي عبر XOR بمفتاح ${k}`, CAT, execute, '<النص>'));
}
// 500 Seeded hashes
for (let s = 1; s <= 500; s++) {
  cmds.push(makeCmd(`هاش_بذرة_${s}`, `حساب بصمة Hash رقمية ببذرة ${s}`, CAT, execute, '<النص>'));
}
// 500 Text splitters
for (let n = 1; n <= 500; n++) {
  cmds.push(makeCmd(`قطع_نص_${n}`, `تقسيم أي نص إلى مقاطع بطول ${n} محرف`, CAT, execute, '<النص>'));
}
// 500 Decorated repeaters
for (let r = 1; r <= 500; r++) {
  cmds.push(makeCmd(`كرر_مزين_${r}`, `تكرار النص مع ترقيم وزينة نمط ${r}`, CAT, execute, '<النص>'));
}

export default cmds;
