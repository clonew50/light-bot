/**
 * system/megaPackHelper.js
 * -------------------------------------------------------------------
 * مساعد خفيف الوزن لحزم الأوامر الكبرى (100,000+ أمر متميز)
 * يوفّر بناء كائنات أوامر منخفضة استهلاك الذاكرة + أدوات تحليل النصوص والأرقام.
 */

const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

export function toLatinDigits(str) {
  return String(str || '').replace(/[٠-٩]/g, (d) => AR_DIGITS[d] || d);
}

export function parseNums(text, defaults = [10]) {
  const clean = toLatinDigits(text);
  const found = clean.match(/-?\d+(?:\.\d+)?/g);
  if (!found || !found.length) return [...defaults];
  return defaults.map((d, i) => {
    const v = parseFloat(found[i]);
    return Number.isFinite(v) ? v : d;
  });
}

export function getCmdKey(m, ctx) {
  return String(ctx?.command || m?.command || '').trim().toLowerCase();
}

export function getInputText(ctx, fallback = '') {
  const t = String(ctx?.text || '').trim();
  return t || fallback;
}

export function makeCmd(trigger, description, category, execute, usageSuffix = '') {
  return {
    command: [trigger],
    usage: [usageSuffix ? `${trigger} ${usageSuffix}` : trigger],
    description,
    category,
    usePrefix: true,
    execute
  };
}

export async function replyCard(m, ctx, icon, title, lines, footer = 'LIGHT BOT') {
  const body = `${icon} *${title}*\n\n${lines.join('\n')}\n\n_${footer}_`;
  if (typeof m?.reply === 'function') {
    await m.reply(body);
    return;
  }
  await ctx?.conn?.sendMessage?.(m.chat, { text: body }, { quoted: m });
}
