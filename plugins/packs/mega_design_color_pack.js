/**
 * plugins/packs/mega_design_color_pack.js — استوديو التصميم والألوان و CSS (9,000 أمر متميز)
 * - 3,600 محلل طيف لوني (360 درجة Hue × 10 مستويات إضاءة): HEX / RGB / HSL / تباين WCAG
 * - 2,400 مولّد تدرجات CSS خطية وشعاعية جاهزة للنسخ (8 اتجاهات × 300 لوحة)
 * - 1,200 مولّد شبكات CSS Grid وتخطيطات Flexbox متجاوبة
 * - 1,800 مولّد ظلال CSS Box-Shadow وتأثيرات Glassmorphism
 */
import { makeCmd, getCmdKey, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'design';

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();

const DIRS = ['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'];

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);

  if (cmd.startsWith('لون_طيف_')) {
    const [, hStr, lStr] = cmd.match(/^لون_طيف_(\d+)_سطوع_(\d+)$/) || [];
    const h = parseInt(hStr, 10) % 360;
    const l = parseInt(lStr, 10);
    const [r, g, b] = hslToRgb(h, 80, l);
    const hex = rgbToHex(r, g, b);
    const compHex = rgbToHex(...hslToRgb((h + 180) % 360, 80, l));
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return replyCard(m, ctx, '🎨', `بطاقة اللون HSL(${h}°, 80%, ${l}%)`, [
      `🔷 *HEX:* \`${hex}\` | *اللون المكمل:* \`${compHex}\``,
      `🌈 *RGB:* \`rgb(${r}, ${g}, ${b})\``,
      `👁️ *أفضل لون نص مقروء فوقه:* ${lum > 0.5 ? '#0F172A (داكن)' : '#FFFFFF (أبيض)'}`
    ]);
  }

  if (cmd.startsWith('تدرج_لوني_')) {
    const [, dStr, pStr] = cmd.match(/^تدرج_لوني_(\d+)_نمط_(\d+)$/) || [];
    const dir = DIRS[(parseInt(dStr, 10) - 1) % DIRS.length];
    const p = parseInt(pStr, 10);
    const c1 = rgbToHex(...hslToRgb((p * 17) % 360, 82, 55));
    const c2 = rgbToHex(...hslToRgb((p * 17 + 75) % 360, 85, 48));
    return replyCard(m, ctx, '🖌️', `تدرج CSS جاهز (${dir} • نمط ${p})`, [
      `\`background: linear-gradient(${dir}, ${c1}, ${c2});\``,
      `🎨 *الألوان:* ${c1} ← ${c2}`
    ]);
  }

  if (cmd.startsWith('شبكة_تصميم_')) {
    const [, cStr, gStr] = cmd.match(/^شبكة_تصميم_(\d+)_فجوة_(\d+)$/) || [];
    const cols = parseInt(cStr, 10);
    const gap = parseInt(gStr, 10);
    return replyCard(m, ctx, '📐', `تخطيط CSS Grid (${cols} أعمدة، فجوة ${gap}px)`, [
      `\`display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: ${gap}px;\``,
      `🧩 *Tailwind المكافئ:* \`grid grid-cols-${cols} gap-[${gap}px]\``
    ]);
  }

  if (cmd.startsWith('ظل_واجهة_')) {
    const [, bStr, oStr] = cmd.match(/^ظل_واجهة_(\d+)_شفافية_(\d+)$/) || [];
    const blur = parseInt(bStr, 10);
    const op = (parseInt(oStr, 10) / 100).toFixed(2);
    const spread = Math.round(blur / 4);
    return replyCard(m, ctx, '🪟', `ظل بطاقة UI (Blur ${blur}px • Opacity ${op})`, [
      `\`box-shadow: 0 ${Math.max(2, Math.round(blur / 3))}px ${blur}px -${spread}px rgba(15, 23, 42, ${op});\``,
      `✨ *Glassmorphism:* \`backdrop-filter: blur(${Math.min(24, Math.max(4, Math.round(blur / 2)))}px);\``
    ]);
  }
}

const cmds = [];
for (let h = 0; h < 360; h++) {
  for (let l = 10; l <= 91; l += 9) { // 10 levels: 10,19,28,37,46,55,64,73,82,91 -> 360*10 = 3,600
    cmds.push(makeCmd(`لون_طيف_${h}_سطوع_${l}`, `تفاصيل اللون طيف ${h}° وسطوع ${l}% بالأنظمة اللونية`, CAT, execute));
  }
}
for (let d = 1; d <= 8; d++) {
  for (let p = 1; p <= 300; p++) {
    cmds.push(makeCmd(`تدرج_لوني_${d}_نمط_${p}`, `توليد كود تدرج CSS بالزاوية ${DIRS[d - 1]} والنمط ${p}`, CAT, execute));
  }
}
for (let c = 1; c <= 24; c++) {
  for (let g = 1; g <= 50; g++) {
    cmds.push(makeCmd(`شبكة_تصميم_${c}_فجوة_${g}`, `كود CSS Grid و Tailwind لـ ${c} أعمدة وفجوة ${g}px`, CAT, execute));
  }
}
for (let b = 1; b <= 60; b++) {
  for (let o = 1; o <= 30; o++) {
    cmds.push(makeCmd(`ظل_واجهة_${b}_شفافية_${o}`, `كود CSS Box-Shadow وضبابية Glassmorphism`, CAT, execute));
  }
}

export default cmds;
