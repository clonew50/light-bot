/**
 * tests/unit.task-17.test.mjs — todo 17: native carousel of categories
 * ==========================================================================================
 * Fake client only (no boot). Asserts payload values:
 *   - one sendCarousel, 2 <= cards <= 6
 *   - every card has imageUrl|mediaUrl from the bot's own config
 *   - bodyText non-empty, footerText = bot name
 *   - 2-3 quick_reply buttons with real prefixed command ids
 *   - empty supaimg -> Arabic reply, zero carousel, no throw
 *   - < 2 categories -> Arabic reply, zero carousel
 *   - source carries no foreign group id / dev number / promo host
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const carousel = (await import(pathToFileURL(path.join(repoRoot, 'plugins/native/carousel.js')).href)).default;

const INFO = {
  nameBot: 'BOT-TEST',
  nameChannel: 'CHAN-TEST',
  supaimg: ['https://i.supaimg.com/own-1.jpg', 'https://i.supaimg.com/own-2.jpg'],
  urls: { repo: 'https://github.com/clonew50/light-bot' }
};

function makeCtx(commands, info = INFO) {
  const calls = [];
  const conn = {
    sendCarousel: async (chat, payload, quoted) => calls.push({ chat, payload, quoted }),
    sendButtonNormal: async () => { throw new Error('carousel must not call sendButtonNormal'); }
  };
  const bot = { config: { info, prefix: '.' }, getAllCommands: async () => commands.map((c) => ({ ...c })) };
  const replies = [];
  const m = { chat: 'test@s.whatsapp.net', sender: 'user@s.whatsapp.net', reply: async (t) => replies.push(String(t)) };
  return { calls, replies, m, ctx: { conn, bot, text: '', args: [], command: 'عجلة', usedPrefix: '.' } };
}

const run = async (commands, info) => {
  const f = makeCtx(commands, info);
  await carousel(f.m, f.ctx);
  return f;
};

const cmds = [
  { command: 'ping', usage: ['ping'], category: 'tools' },
  { command: 'say', usage: ['قول'], category: 'tools' },
  { command: 'anime', usage: ['انمي'], category: 'downloads' },
  { command: 'play', usage: ['تشغيل'], category: 'downloads' },
  { command: 'ban', usage: ['حظر'], category: 'group' },
  { command: 'kick', usage: ['طرد'], category: 'group' },
  { command: 'help', usage: ['مساعدة'], category: 'info' },
  { command: 'ping2', usage: ['بينج'], category: 'info' }
];

test('sends one carousel with 2..6 valid cards', async () => {
  const { calls } = await run(cmds);
  assert.equal(calls.length, 1);
  const p = calls[0].payload;
  assert.ok(p.cards.length >= 2 && p.cards.length <= 6, `cards=${p.cards.length}`);
  assert.equal(p.cards.length, 4, 'one card per category');
  assert.ok(p.headerText && p.headerText.length > 0);
  assert.equal(p.globalFooterText, 'CHAN-TEST');

  const ownImages = new Set(INFO.supaimg);
  for (const card of p.cards) {
    const media = card.imageUrl || card.mediaUrl;
    assert.ok(media, 'every card needs imageUrl or mediaUrl');
    assert.ok(ownImages.has(media), `card media must be the bot own url: ${media}`);
    assert.ok(typeof card.bodyText === 'string' && card.bodyText.trim().length > 0);
    assert.equal(card.footerText, 'BOT-TEST');
    assert.ok(card.buttons.length >= 2 && card.buttons.length <= 3, `buttons=${card.buttons.length}`);
    for (const b of card.buttons) {
      assert.equal(b.name, 'quick_reply');
      assert.ok(b.params.display_text.trim().length > 0);
      assert.ok(b.params.id.startsWith('.'), `id must be prefixed: ${b.params.id}`);
    }
  }
});

test('never exceeds the framework card limit (<=6) and never drops below 2', async () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((k) => [
    { command: k + '1', usage: [k + '1'], category: k },
    { command: k + '2', usage: [k + '2'], category: k }
  ]);
  const { calls } = await run(many);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.cards.length <= 6);
  assert.ok(calls[0].payload.cards.length >= 2);
});

test('empty supaimg -> Arabic reply, zero carousel, never throws', async () => {
  const { calls, replies } = await run(cmds, { ...INFO, supaimg: [], images: [] });
  assert.equal(calls.length, 0);
  assert.match(replies.join('\n'), /لا توجد صور/);
});

test('fewer than two categories -> Arabic reply, zero carousel', async () => {
  const { calls, replies } = await run([{ command: 'ping', usage: ['ping'], category: 'tools' }]);
  assert.equal(calls.length, 0);
  assert.match(replies.join('\n'), /أقسام كافية/);
});

test('a one-command category still yields two buttons', async () => {
  const { calls } = await run([
    { command: 'ping', usage: ['ping'], category: 'tools' },
    { command: 'anime', usage: ['انمي'], category: 'downloads' }
  ]);
  assert.equal(calls.length, 1);
  const card = calls[0].payload.cards.find((c) => c.bodyText.includes('الأدوات'));
  assert.equal(card.buttons.length, 2);
});

test('source has no foreign group id, dev number or promo host', () => {
  const src = readFileSync(path.join(repoRoot, 'plugins/native/carousel.js'), 'utf8');
  assert.doesNotMatch(src, /120363411834515372/);
  assert.doesNotMatch(src, /201066826750/);
  assert.doesNotMatch(src, /is\.gd/);
  assert.doesNotMatch(src, /conn\.sendButton\s*\(/);
});