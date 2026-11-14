/**
 * tests/unit.task-16.test.mjs — todo 16: native quick-reply menu
 * ==========================================================================================
 * Drives plugins/native/quickmenu.js with a FAKE client (no bot boot, no network).
 * Asserts payload shape/values, never log strings:
 *   - .قائمة  -> sendButtonNormal, all buttons quick_reply, display_text non-empty,
 *                id starts with the bot prefix, <= 10 buttons per message
 *   - >10 commands -> several messages, every chunk <= 10, continuation note
 *   - .قسم <cat> -> only that category's real commands
 *   - .قسم لا_يوجد -> Arabic "القسم غير موجود", zero interactive messages
 *   - no supaimg -> still sends (local PNG buffer), never throws
 *   - registration metadata + command-name collision (menu is owned by menu2.js)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const quickmenu = (await import(pathToFileURL(path.join(repoRoot, 'plugins/native/quickmenu.js')).href)).default;

const INFO = {
  nameBot: 'BOT-TEST',
  nameChannel: 'CHAN-TEST',
  supaimg: ['https://i.supaimg.com/own-1.jpg', 'https://i.supaimg.com/own-2.jpg'],
  urls: { repo: 'https://github.com/clonew50/light-bot' }
};

function makeCtx({ commands, info = INFO, prefix = '.' } = {}) {
  const calls = [];
  const conn = {
    sendButtonNormal: async (chat, payload, quoted) => calls.push({ chat, payload, quoted }),
    sendCarousel: async () => { throw new Error('quickmenu must not call sendCarousel'); }
  };
  const bot = { config: { info, prefix }, getAllCommands: async () => commands.map((c) => ({ ...c })) };
  const replies = [];
  const m = {
    chat: 'test@s.whatsapp.net',
    sender: 'user@s.whatsapp.net',
    reply: async (t) => replies.push(String(t))
  };
  const ctx = { conn, bot, text: '', args: [], command: 'قائمة', usedPrefix: prefix };
  return { calls, replies, ctx, m };
}

const run = (opts, over = {}) => {
  const f = makeCtx(opts);
  return quickmenu(f.m, { ...f.ctx, ...over }).then(() => f);
};

const cmds4 = [
  { command: 'ping', usage: ['ping'], category: 'tools' },
  { command: 'say', usage: ['قول'], category: 'tools' },
  { command: 'anime', usage: ['انمي'], category: 'downloads' },
  { command: 'play', usage: ['تشغيل'], category: 'downloads' },
  { command: 'ban', usage: ['حظر'], category: 'group' },
  { command: 'kick', usage: ['طرد'], category: 'group' },
  { command: 'help', usage: ['مساعدة'], category: 'info' },
  { command: 'ping2', usage: ['بينج'], category: 'info' }
];

test('main menu sends exactly one sendButtonNormal with valid quick_reply buttons', async () => {
  const { calls } = await run({ commands: cmds4 });
  assert.equal(calls.length, 1, 'one interactive message for <=10 categories');
  const p = calls[0].payload;
  assert.ok(p.buttons.length > 0);
  assert.ok(p.buttons.length <= 10);
  for (const b of p.buttons) {
    assert.equal(b.name, 'quick_reply');
    assert.equal(typeof b.params.display_text, 'string');
    assert.ok(b.params.display_text.trim().length > 0, 'display_text non-empty');
    assert.ok(b.params.id.startsWith('.'), `id must start with prefix: ${b.params.id}`);
  }
  assert.ok(p.media, 'media is required by the schema');
  assert.equal(p.mediaType, 'image');
  assert.equal(p.footer, 'CHAN-TEST');
  assert.ok(p.caption.includes('BOT-TEST'), 'caption comes from config.info.nameBot');
});

test('category view lists that category real commands, prefixed', async () => {
  const { calls } = await run({ commands: cmds4 }, { text: 'tools', args: ['tools'], command: 'قسم' });
  assert.equal(calls.length, 1);
  const buttons = calls[0].payload.buttons;
  const ids = buttons.map((b) => b.params.id).sort();
  assert.deepEqual(ids, ['.ping', '.قول']);
});

test('unknown category replies in Arabic and sends no interactive message', async () => {
  const { calls, replies } = await run({ commands: cmds4 }, { text: 'لا_يوجد', args: ['لا_يوجد'], command: 'قسم' });
  assert.equal(calls.length, 0);
  const text = replies.join('\n');
  assert.match(text, /القسم غير موجود/);
});

test('more than 10 commands are split, every message <= 10, continuation note', async () => {
  const many = Array.from({ length: 23 }, (_, i) => ({
    command: 'c' + i,
    usage: ['c' + i],
    category: 'tools'
  }));
  const { calls } = await run({ commands: many }, { text: 'tools', args: ['tools'], command: 'قسم' });
  assert.equal(calls.length, 3);
  const counts = calls.map((c) => c.payload.buttons.length);
  assert.deepEqual(counts, [10, 10, 3]);
  assert.match(calls[0].payload.caption, /أكمل في الرسالة التالية/);
  assert.doesNotMatch(calls[2].payload.caption, /أكمل في الرسالة التالية/);
  const ids = calls.flatMap((c) => c.payload.buttons.map((b) => b.params.id));
  assert.equal(new Set(ids).size, 23);
});

test('missing supaimg still sends using a local image, never throws', async () => {
  const { calls, replies } = await run({ commands: cmds4, info: { ...INFO, supaimg: [], images: [] } });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.media, 'media present');
  assert.ok(Buffer.isBuffer(calls[0].payload.media), 'local PNG buffer fallback');
  assert.equal(replies.length, 0);
});

test('registration metadata and no collision with plugins/menu2.js', () => {
  assert.deepEqual(quickmenu.command, ['قائمة', 'القائمة', 'قسم']);
  assert.ok(quickmenu.command.includes('قائمة'));
  assert.equal(quickmenu.category, 'native');
  assert.equal(quickmenu.group, true);
  assert.equal(quickmenu.private, true);
  assert.ok(Array.isArray(quickmenu.usage) && quickmenu.usage.length > 0);
  // 'menu' already exists in plugins/menu2.js; registering it would shadow it.
  assert.ok(!quickmenu.command.includes('menu'));
});

test('source never uses the legacy conn.sendButton(', () => {
  const src = readFileSync(path.join(repoRoot, 'plugins/native/quickmenu.js'), 'utf8');
  assert.doesNotMatch(src, /conn\.sendButton\s*\(/);
});