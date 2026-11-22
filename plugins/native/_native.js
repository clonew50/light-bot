// ─── plugins/native/_native.js ───
// Shared helpers for the native interactive surfaces (todo 16/17/18).
//
// This file is deliberately NOT a plugin: it exports several named functions and
// no default/handler, so meowsab's loader (normalizeObject: a single function
// export becomes a command) ignores it. It is a library only.
//
// Everything here is derived from the bot's own registry / config. No foreign
// JID, CDN URL, promo code or mediaKey is ever referenced.

/* Category metadata: key (handler.category) -> [arabic label, emoji]. */
export const CAT_META = {
  downloads:  ['التحميل', '📂'],
  group:      ['المجموعات', '🛡️'],
  sticker:    ['الملصقات', '🃏'],
  owner:      ['المطورين', '👑'],
  tools:      ['الأدوات', '⚙️'],
  search:     ['البحث', '🔍'],
  admin:      ['الأدمن', '⚔️'],
  games:      ['الألعاب', '🎮'],
  gif:        ['الجيف', '🖼️'],
  bank:       ['البنك', '💳'],
  ai:         ['الذكاء الاصطناعي', '🤖'],
  sub:        ['البوتات الفرعية', '⛓️'],
  subs:       ['الاشتراكات', '📡'],
  info:       ['معلومات البوت', '📜'],
  nicknames:  ['الألقاب', '🏷️'],
  logos:      ['اللوجوهات', '🎨'],
  voices:     ['الأصوات', '🎙️'],
  islamic:    ['الإسلاميات', '🕌'],
  guild:      ['النقابات', '🏰'],
  other:      ['أخرى', '🔮']
};

const CAT_ORDER = Object.keys(CAT_META);

// أقسام مخفية من القوائم (مش بتتعرض كقسم للمستخدم).
const HIDDEN_CATEGORIES = new Set(['native']);

export const metaOf = (key) => CAT_META[key] || [key, '📁'];

export const usagesOf = (c) =>
  (Array.isArray(c?.usage) ? c.usage : [c?.usage]).filter((u) => typeof u === 'string' && u.trim());

/** Bot prefix: explicit ctx prefix wins, then client config, then '.'. */
export function resolvePrefix(ctx, info) {
  const explicit = ctx?.usedPrefix;
  if (typeof explicit === 'string' && explicit) return explicit;
  const cfg = ctx?.conn?.config?.prefix ?? ctx?.bot?.config?.prefix ?? info?.prefix ?? '.';
  const first = Array.isArray(cfg) ? cfg[0] : cfg;
  return typeof first === 'string' && first ? first : '.';
}

/** The bot's own config.info (never a hardcoded brand block). */
export function infoOf(ctx) {
  return ctx?.bot?.config?.info || ctx?.conn?.config?.info || {};
}

/** Every http(s) image URL the operator configured, in order. */
export function resolveImages(info) {
  const raw = [];
  const push = (v) => {
    if (Array.isArray(v)) raw.push(...v);
    else if (typeof v === 'string' && v.trim()) raw.push(v.trim());
  };
  push(info?.supaimg);
  push(info?.images);
  push(info?.image);
  return raw.filter((u) => /^https?:\/\//i.test(u));
}

// 1×1 transparent PNG, used only when the operator configured no image at all.
// `media` is required by the sendButtonNormal schema, so a Buffer is the honest
// local fallback (no foreign CDN, no third-party asset).
export const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export function mediaFor(images, index = 0) {
  if (images.length) return { url: images[index % images.length] };
  return FALLBACK_PNG;
}

/** Normalize a command string so button ids always start with the bot prefix. */
export function withPrefix(id, prefix) {
  const clean = String(id ?? '').trim();
  if (!clean) return prefix;
  return clean.startsWith(prefix) ? clean : prefix + clean;
}

/** One WhatsApp native quick_reply button. */
export function quickReply(id, label, prefix) {
  const full = withPrefix(id, prefix);
  const text = String(label ?? '').trim() || full;
  return { name: 'quick_reply', params: { display_text: text.slice(0, 40), id: full } };
}

/** Split into WhatsApp-sized chunks (10 buttons max per interactive message). */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Live registry -> ordered categories.
 * Returns [{ key, label, emoji, commands: string[] }].
 * Hidden plugins and plugins without a usage string are skipped.
 */
export async function collectCategories(bot) {
  let commands = [];
  try {
    commands = (await bot?.getAllCommands?.()) || [];
  } catch {
    commands = [];
  }

  const byCat = new Map();
  for (const c of commands) {
    if (!c || c.hidden) continue;
    const usages = usagesOf(c).map((u) => u.trim()).filter(Boolean);
    if (!usages.length) continue;
    const key = typeof c.category === 'string' && c.category ? c.category : 'other';
    if (HIDDEN_CATEGORIES.has(key)) continue;
    if (!byCat.has(key)) byCat.set(key, []);
    const bucket = byCat.get(key);
    for (const u of usages) if (!bucket.includes(u)) bucket.push(u);
  }

  const ordered = [];
  for (const k of CAT_ORDER) if (byCat.has(k)) ordered.push(k);
  for (const k of byCat.keys()) if (!ordered.includes(k)) ordered.push(k);

  return ordered.map((key) => {
    const [label, emoji] = metaOf(key);
    return { key, label, emoji, commands: byCat.get(key) };
  });
}

/** Arabic one-line reply that never throws when m.reply is missing (mocked runs). */
export async function say(m, text) {
  try {
    if (typeof m?.reply === 'function') return await m.reply(text);
  } catch {
    /* a mock without reply must not break the handler */
  }
  return undefined;
}

/** Trim a value for a card/body field, always non-empty. */
export function nonEmpty(value, fallback = '') {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s || fallback;
}