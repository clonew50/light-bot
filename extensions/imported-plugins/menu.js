// menu3 / اوامر3 — قائمة أوامر بسيطة وموثوقة.
// بتعرض كل الأوامر مجمّعة بالأقسام، مع أزرار سريعة لكل قسم.
// الاستخدام: .menu3  |  .menu3 all  |  .menu3 <القسم>

const CAT_LABELS = {
  downloads: ['التحميل', '📂'],
  group: ['المجموعات', '🛡️'],
  sticker: ['الملصقات', '🃏'],
  owner: ['المطورين', '👑'],
  tools: ['الأدوات', '⚙️'],
  search: ['البحث', '🔍'],
  admin: ['الأدمن', '⚔️'],
  games: ['الألعاب', '🎮'],
  gif: ['الجيف', '🖼️'],
  bank: ['البنك', '💳'],
  ai: ['الذكاء الاصطناعي', '🤖'],
  sub: ['البوتات الفرعية', '⛓️'],
  subs: ['الاشتراكات', '📡'],
  info: ['معلومات البوت', '📜'],
  nicknames: ['الألقاب', '🏷️'],
  logos: ['اللوجوهات', '🎨'],
  voices: ['الأصوات', '🎙️'],
  islamic: ['الإسلاميات', '🕌'],
  guild: ['النقابات', '🏰'],
  other: ['أخرى', '🔮']
};
const CAT_ORDER = Object.keys(CAT_LABELS);
const HIDDEN = new Set(['native']); // قسم مخفي من القائمة
const MAX_PER_CAT = 60; // حد أقصى للأوامر المعروضة لكل قسم (حماية من الفيضان)
const labelOf = (k) => CAT_LABELS[k] || [k, '📁'];
const usagesOf = (c) =>
  (Array.isArray(c?.usage) ? c.usage : [c?.usage]).filter((u) => typeof u === 'string' && u.trim());

// الأوامر القادمة من ميجا-باكس المولّدة (plugins/packs/) — بتستبعد من القائمة
// لأنها >100k أمر وتتسبب في رسالة ضخمة؛ نفس منطق refreshPluginRegistry.
const isPackCommand = (c) =>
  /(^|[\\/])plugins[\\/]packs[\\/]/i.test(String(c?.__filePath || c?.file || ''));

// تجميع الأوامر من الـ registry الحي، أو من global.plugins كبديل.
async function gatherCommands(bot) {
  let commands = [];
  try {
    commands = (await bot?.getAllCommands?.()) || [];
  } catch {
    commands = [];
  }
  // استبعاد الباكس المولّدة من القائمة (تفضل شغالة بالنداء المباشر لكن مش بتتسرد).
  commands = commands.filter((c) => !isPackCommand(c));
  if (!commands.length) {
    const reg = global.plugins || {};
    for (const p of Object.values(reg)) {
      if (!p || p.disabled) continue;
      const usages = Array.isArray(p.usage) ? p.usage : p.usage ? [p.usage] : [];
      if (!usages.length) continue;
      commands.push({ category: p.category || 'other', usage: usages });
    }
  }
  return commands;
}

function groupCommands(commands) {
  const byCat = new Map();
  for (const c of commands) {
    if (c?.hidden) continue;
    const usages = usagesOf(c);
    if (!usages.length) continue;
    const key = c.category || 'other';
    if (HIDDEN.has(key)) continue;
    if (!byCat.has(key)) byCat.set(key, []);
    const bucket = byCat.get(key);
    for (const u of usages) if (!bucket.includes(u)) bucket.push(u);
  }
  const ordered = [];
  for (const k of CAT_ORDER) if (byCat.has(k)) ordered.push(k);
  for (const k of byCat.keys()) if (!ordered.includes(k)) ordered.push(k);
  return { byCat, ordered };
}

async function send(conn, m, text, buttons) {
  if (buttons && buttons.length && typeof conn?.sendButtonNormal === 'function') {
    try {
      return await conn.sendButtonNormal(m.chat, { text, caption: text, buttons }, m);
    } catch {
      // نسقط للبديل
    }
  }
  if (typeof conn?.sendMessage === 'function') {
    try {
      const payload = buttons && buttons.length ? { text, buttons } : { text };
      return await conn.sendMessage(m.chat, payload, { quoted: m });
    } catch {
      // نسقط للبديل
    }
  }
  if (typeof m?.reply === 'function') return m.reply(text);
  return null;
}

const handler = async (m, { conn, usedPrefix = '.', args = [], bot }) => {
  const prefix = usedPrefix || '.';
  const { byCat, ordered } = groupCommands(await gatherCommands(bot));
  const total = ordered.reduce((n, k) => n + byCat.get(k).length, 0);

  if (!total) {
    return send(conn, m, '❌ لا توجد أوامر مسجّلة لعرضها حالياً.');
  }

  const sub = String(args[0] || '').trim().toLowerCase();

  // ── .menu3 all — كل الأوامر كنص (محدودة لكل قسم) ──
  if (sub === 'all' || sub === 'الكل') {
    const lines = ordered.map((k) => {
      const [label, emoji] = labelOf(k);
      const all = byCat.get(k);
      const shown = all.slice(0, MAX_PER_CAT).map((u) => `• ${prefix}${u}`).join('\n');
      const more = all.length > MAX_PER_CAT ? `\n… وأخرى ${all.length - MAX_PER_CAT} أمر` : '';
      return `*${emoji} ${label} (${all.length})*\n${shown}${more}`;
    });
    return send(conn, m, `📜 *كل الأوامر (${total})*\n\n${lines.join('\n\n')}`);
  }

  // ── .menu3 <القسم> — أوامر قسم محدد ──
  if (sub) {
    const found = ordered.find((k) => k.toLowerCase() === sub || String(labelOf(k)[0]) === sub);
    if (!found) {
      return send(conn, m, `❌ قسم غير موجود: ${args[0]}\nاكتب ${prefix}menu3 أو ${prefix}menu3 all`);
    }
    const [label, emoji] = labelOf(found);
    const all = byCat.get(found);
    const shown = all.slice(0, MAX_PER_CAT).map((u) => `• ${prefix}${u}`).join('\n');
    const more = all.length > MAX_PER_CAT ? `\n… وأخرى ${all.length - MAX_PER_CAT} أمر` : '';
    return send(conn, m, `*${emoji} ${label} (${all.length})*\n\n${shown}${more}`);
  }

  // ── .menu3 — نظرة عامة + أزرار الأقسام ──
  const overview = ordered
    .map((k) => {
      const [label, emoji] = labelOf(k);
      return `${emoji} *${label}* — ${byCat.get(k).length}`;
    })
    .join('\n');

  const text =
    `📜 *قائمة الأوامر*\n` +
    `الإجمالي: ${total} أمر في ${ordered.length} أقسام\n\n` +
    `${overview}\n\n` +
    `👇 اختر قسماً، أو اكتب ${prefix}menu3 all لعرض الكل`;

  const buttons = ordered.slice(0, 10).map((k) => {
    const [label, emoji] = labelOf(k);
    return {
      name: 'quick_reply',
      params: { display_text: `${emoji} ${label}`.slice(0, 40), id: `${prefix}menu3 ${k}` }
    };
  });

  return send(conn, m, text, buttons);
};

handler.usage = ['menu3', 'menu3 all', 'menu3 <قسم>'];
handler.command = ['menu3', 'اوامر3', 'أوامر3'];
handler.category = 'info';
handler.aliases = ['اوامر3', 'أوامر3'];
export default handler;