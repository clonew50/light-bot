/**
 * tests/unit.task-19.test.mjs — todo 19: AI rich cards (text / code / table / LaTeX)
 * ==========================================================================================
 * Drives plugins/meta/*.js with a FAKE client (no bot boot, no network).
 * Asserts the exact section payloads the framework accepts:
 *   type 2 -> {type, text}
 *   type 5 -> {type, codeMetadata:{language, code}}
 *   type 4 -> {type, tableMetadata:{title, rows:[{isHeading, items}]}}
 * and that no section carries undefined / extra keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const load = (p) => import(pathToFileURL(path.join(repoRoot, p)).href);
const metatextMod = await load('plugins/meta/metatext.js');
const metacode = (await load('plugins/meta/metacode.js')).default;
const latex = (await load('plugins/meta/latex.js')).default;
const metatable = (await load('plugins/meta/metatable.js')).default;

const metaText = metatextMod.default[0];
const metaThinking = metatextMod.default[1];

const CHAT = 'test@s.whatsapp.net';
const mkMsg = (over = {}) => ({ chat: CHAT, sender: 'user@s.whatsapp.net', reply: async () => {}, ...over });

function recConn(over = {}) {
  const calls = { ai: [], send: [], relay: [] };
  const conn = {
    sendAiMessage: async (chat, sections) => calls.ai.push({ chat, sections }),
    sendMessage: async (chat, payload) => calls.send.push({ chat, payload }),
    relayMessage: async (chat, message) => calls.relay.push({ chat, message }),
    ...over
  };
  return { conn, calls };
}

const decodeUnified = (content) =>
  JSON.parse(Buffer.from(content.botForwardedMessage.message.richResponseMessage.unifiedResponse.data, 'base64').toString());

/* ── metatext ─────────────────────────────────────────────────────────── */
test('metaText sends sendAiMessage with one exact {type:2,text} section', async () => {
  const { conn, calls } = recConn();
  await metaText(mkMsg({ chat: 't19-text-1@s.whatsapp.net' }), { conn, args: ['مرحبا', 'بكم'], text: 'مرحبا بكم' });
  assert.equal(calls.ai.length, 1);
  assert.equal(calls.ai[0].sections.length, 1);
  const s = calls.ai[0].sections[0];
  assert.deepEqual(Object.keys(s).sort(), ['text', 'type']);
  assert.equal(s.type, 2);
  assert.equal(s.text, 'مرحبا بكم');
  assert.equal(calls.relay.length, 0, 'no raw relay when sendAiMessage exists');
});

test('metaText without sendAiMessage falls back to the raw richResponse', async () => {
  const { conn, calls } = recConn({ sendAiMessage: undefined });
  await metaText(mkMsg({ chat: 't19-text-2@s.whatsapp.net' }), { conn, args: ['fallback'], text: 'fallback' });
  assert.equal(calls.relay.length, 1);
  assert.equal(decodeUnified(calls.relay[0].message).sections[0].view_model.primitive.title, 'fallback');
});

test('metaThinking uses the raw in-progress protocol, not sendAiMessage', async () => {
  const { conn, calls } = recConn();
  await metaThinking(mkMsg({ chat: 't19-text-3@s.whatsapp.net' }), { conn, args: ['بيفكر'], text: 'بيفكر' });
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.relay.length, 1);
  const p = decodeUnified(calls.relay[0].message).sections[0].view_model.primitive;
  assert.equal(p.__typename, 'GenAIBotProgressStatusPrimitive');
  assert.equal(p.is_in_progress, true);
  assert.equal(p.title, 'بيفكر');
});

test('metaText empty body replies in Arabic and sends no card', async () => {
  const { conn, calls } = recConn();
  const m = mkMsg({ chat: 't19-text-4@s.whatsapp.net' });
  await metaText(m, { conn, args: [], text: '' });
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.send.length, 1);
  assert.match(calls.send[0].payload.text, /اكتب النص/);
});

/* ── metacode ─────────────────────────────────────────────────────────── */
test('metacode sends one exact {type:5, codeMetadata:{language,code}} section', async () => {
  const { conn, calls } = recConn();
  await metacode(mkMsg({ chat: 't19-code-1@s.whatsapp.net' }), { conn, text: 'js console.log("hi")' });
  assert.equal(calls.ai.length, 1);
  const s = calls.ai[0].sections[0];
  assert.deepEqual(Object.keys(s).sort(), ['codeMetadata', 'type']);
  assert.equal(s.type, 5);
  assert.deepEqual(Object.keys(s.codeMetadata).sort(), ['code', 'language']);
  assert.equal(s.codeMetadata.language, 'js');
  assert.equal(s.codeMetadata.code, 'console.log("hi")');
  assert.equal(calls.send.length, 0, 'no markdown fallback when sendAiMessage works');
});

test('metacode defaults the language and rejects an empty code block', async () => {
  const { conn, calls } = recConn();
  await metacode(mkMsg({ chat: 't19-code-2@s.whatsapp.net' }), { conn, text: '' });
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.send.length, 1);
  assert.match(calls.send[0].payload.text, /الاستخدام/);
});

/* ── latex ────────────────────────────────────────────────────────────── */
const png = (w, h) => {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

test('latex sends the rendered PNG plus a native GenAILatexItem section', async () => {
  const { conn, calls } = recConn();
  const fetchImpl = async () => ({ ok: true, status: 200, arrayBuffer: async () => png(300, 120).buffer.slice(0) });
  await latex(mkMsg({ chat: 't19-latex-1@s.whatsapp.net' }), {
    conn,
    args: ['e^{i\\pi} = -1'],
    text: 'e^{i\\pi} = -1',
    fetchImpl
  });
  assert.equal(calls.send.length, 1, 'rendered image message');
  assert.equal(calls.send[0].payload.image.url, 'https://latex.codecogs.com/png.image?%5Cdpi%7B200%7D%5Cbg_black%5Ccolor%7B333333%7D%20' + encodeURIComponent('e^{i\\pi} = -1'));
  assert.match(calls.send[0].payload.caption, /e\^\{i/);

  assert.equal(calls.relay.length, 1, 'native latex section');
  const unified = decodeUnified(calls.relay[0].message);
  const prim = unified.sections[0].view_model.primitive;
  assert.equal(prim.__typename, 'GenAIMarkdownTextUXPrimitive');
  const ent = prim.inline_entities[0];
  assert.equal(ent.metadata.__typename, 'GenAILatexItem');
  assert.equal(ent.metadata.latex_expression, 'e^{i\\pi} = -1');
  assert.equal(ent.metadata.latex_image.width, 300);
  assert.equal(ent.metadata.latex_image.height, 120);
});

test('latex with no relay falls back to a type 2 AI card plus the image', async () => {
  const { conn, calls } = recConn({ relayMessage: undefined });
  const fetchImpl = async () => ({ ok: true, status: 200, arrayBuffer: async () => png(10, 10).buffer.slice(0) });
  await latex(mkMsg({ chat: 't19-latex-2@s.whatsapp.net' }), { conn, args: ['x^2'], text: 'x^2', fetchImpl });
  assert.equal(calls.send.length, 1);
  assert.equal(calls.ai.length, 1);
  assert.deepEqual(calls.ai[0].sections, [{ type: 2, text: 'x^2' }]);
});

test('latex render failure replies in Arabic and never sends an empty AI card', async () => {
  const replies = [];
  const { conn, calls } = recConn();
  const fetchImpl = async () => { throw new Error('network down'); };
  await latex(mkMsg({ chat: 't19-latex-3@s.whatsapp.net', reply: async (t) => replies.push(String(t)) }), {
    conn,
    args: ['\\frac{a}{'],
    text: '\\frac{a}{',
    fetchImpl
  });
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.relay.length, 0);
  assert.equal(calls.send.length, 0);
  assert.match(replies.join('\n'), /فشل رسم المعادلة/);
});

test('latex treats a non-PNG body as an invalid formula', async () => {
  const replies = [];
  const { conn, calls } = recConn();
  const fetchImpl = async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from('<html>error</html>').buffer.slice(0) });
  await latex(mkMsg({ chat: 't19-latex-4@s.whatsapp.net', reply: async (t) => replies.push(String(t)) }), {
    conn,
    args: ['???'],
    text: '???',
    fetchImpl
  });
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.relay.length, 0);
  assert.match(replies.join('\n'), /فشل رسم المعادلة/);
});

/* ── metatable (live registry data) ───────────────────────────────────── */
const REGISTRY = [
  { command: 'ping', usage: ['.ping'], category: 'tools' },
  { command: 'say', usage: ['.قول'], category: 'tools' },
  { command: 'anime', usage: ['.انمي'], category: 'downloads' },
  { command: 'ban', usage: ['.حظر'], category: 'group' }
];

function metaCtx(commands) {
  const info = { nameBot: 'BOT-TEST', nameChannel: 'CHAN-TEST', prefix: '.' };
  const bot = { config: { info, prefix: '.' }, getAllCommands: async () => commands.map((c) => ({ ...c })) };
  return { bot, conn: {}, usedPrefix: '.', text: '', args: [] };
}

test('metatable sends one type 4 section built from live registry data', async () => {
  const { conn, calls } = recConn();
  await metatable(mkMsg(), { ...metaCtx(REGISTRY), conn });
  assert.equal(calls.ai.length, 1);
  const s = calls.ai[0].sections[0];
  assert.deepEqual(Object.keys(s).sort(), ['tableMetadata', 'type']);
  assert.equal(s.type, 4);
  const t = s.tableMetadata;
  assert.deepEqual(Object.keys(t).sort(), ['rows', 'title']);
  assert.ok(t.title.includes('BOT-TEST'));
  assert.ok(Array.isArray(t.rows) && t.rows.length > 1);
  assert.equal(t.rows[0].isHeading, true);
  assert.deepEqual(t.rows[0].items, ['القسم', 'عدد الأوامر', 'أول أمر']);
  for (const r of t.rows) {
    assert.equal(typeof r.isHeading, 'boolean');
    assert.ok(Array.isArray(r.items) && r.items.length > 0, 'at least one column');
    for (const cell of r.items) {
      assert.equal(typeof cell, 'string');
      assert.notEqual(cell, 'Example', 'no placeholder row');
    }
  }
  // live data: tools has 2 commands, downloads 1, group 1
  const tools = t.rows.find((r) => r.items[0] === 'الأدوات');
  assert.ok(tools, 'live category label from CAT_META');
  assert.equal(tools.items[1], '2');
  assert.ok(tools.items[2].startsWith('.'));
  const flat = JSON.stringify(t);
  assert.ok(flat.includes('الأدوات') && flat.includes('التحميل') && flat.includes('المجموعات'));
});

test('metatable with an empty registry replies in Arabic and sends nothing', async () => {
  const replies = [];
  const { conn, calls } = recConn();
  const m = mkMsg({ reply: async (t) => replies.push(String(t)) });
  await metatable(m, { ...metaCtx([]), conn });
  assert.equal(calls.ai.length, 0);
  assert.match(replies.join('\n'), /لا توجد بيانات/);
});

test('metatable without sendAiMessage replies in Arabic and sends no card', async () => {
  const replies = [];
  const m = mkMsg({ reply: async (t) => replies.push(String(t)) });
  await metatable(m, { ...metaCtx(REGISTRY), conn: {} });
  assert.match(replies.join('\n'), /غير متاحة/);
});

/* ── registration metadata ────────────────────────────────────────────── */
test('meta plugins keep their commands/categories and are functions', () => {
  assert.deepEqual(metaText.command, ['ميتا', 'metaai']);
  assert.equal(metaText.category, 'ai');
  assert.deepEqual(metaThinking.command, ['ميتا_يفكر', 'ميتايفكر']);
  assert.deepEqual(metacode.command, ['ميتا_كود', 'ميتاكود']);
  assert.deepEqual(latex.command, ['لاتكس', 'latex', 'معادلة']);
  assert.deepEqual(metatable.command, ['جدول', 'table', 'احصائيات']);
  for (const h of [metaText, metaThinking, metacode, latex, metatable]) {
    assert.equal(typeof h, 'function');
    assert.ok(Array.isArray(h.command));
  }
});