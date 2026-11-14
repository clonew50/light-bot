/**
 * tests/unit.task-18.test.mjs — todo 18: single_select + CTA button surfaces
 * ==========================================================================================
 * Fake client only. Asserts real NFM parameter shapes and values:
 *   - names are inside the framework enum (quick_reply/cta_url/cta_call/
 *     cta_copy/single_select/call_permission_request)
 *   - single_select params.display_title non-empty, sections[].rows[].id prefixed,
 *     <= 10 rows per section
 *   - cta_url url === client.config.info.urls.repo
 *   - cta_copy copy_code non-empty and bot-generated (no foreign promo)
 *   - cta_call only when a support number is configured
 *   - empty config.info.urls -> Arabic reply, zero interactive messages
 *   - no params string contains 201066826750 or is.gd
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const buttons = (await import(pathToFileURL(path.join(repoRoot, 'plugins/native/buttons.js')).href)).default;

const REPO = 'https://github.com/clonew50/light-bot';
const ALLOWED = new Set([
  'quick_reply',
  'cta_url',
  'cta_call',
  'cta_copy',
  'single_select',
  'call_permission_request'
]);

function makeCtx({ commands, info }) {
  const calls = [];
  const conn = {
    sendButtonNormal: async (chat, payload, quoted) => calls.push({ chat, payload, quoted }),
    sendCarousel: async () => { throw new Error('buttons must not call sendCarousel'); }
  };
  const bot = { config: { info, prefix: '.' }, getAllCommands: async () => commands.map((c) => ({ ...c })) };
  const replies = [];
  const m = { chat: 'test@s.whatsapp.net', sender: 'user@s.whatsapp.net', reply: async (t) => replies.push(String(t)) };
  return { calls, replies, m, ctx: { conn, bot, text: '', args: [], command: 'اختر', usedPrefix: '.' } };
}

const run = async (commands, info) => {
  const f = makeCtx({ commands, info });
  await buttons(f.m, f.ctx);
  return f;
};

const cmds = [
  ...Array.from({ length: 13 }, (_, i) => ({ command: 't' + i, usage: ['t' + i], category: 'tools' })),
  ...Array.from({ length: 3 }, (_, i) => ({ command: 'a' + i, usage: ['a' + i], category: 'downloads' }))
];

const baseInfo = (over = {}) => ({
  nameBot: 'BOT-TEST',
  nameChannel: 'CHAN-TEST',
  supaimg: ['https://i.supaimg.com/own-1.jpg'],
  urls: { repo: REPO },
  ...over
});

test('one native message, only allowed names, valid single_select shape', async () => {
  const { calls } = await run(cmds, baseInfo());
  assert.equal(calls.length, 1);
  const p = calls[0].payload;
  assert.ok(p.buttons.length >= 3);
  for (const b of p.buttons) assert.ok(ALLOWED.has(b.name), `bad name ${b.name}`);

  const ss = p.buttons.find((b) => b.name === 'single_select');
  assert.ok(ss, 'single_select present');
  assert.equal(typeof ss.params.display_title, 'string');
  assert.ok(ss.params.display_title.trim().length > 0);
  assert.ok(Array.isArray(ss.params.sections) && ss.params.sections.length > 0);
  for (const s of ss.params.sections) {
    assert.ok(s.title && s.highlight_label);
    assert.ok(s.rows.length >= 1 && s.rows.length <= 10, `rows=${s.rows.length}`);
    for (const r of s.rows) {
      assert.ok(r.id.startsWith('.'), `row id must be prefixed: ${r.id}`);
      assert.ok(r.title.trim().length > 0);
    }
  }
});

test('cta_url points at the bot own repository url', async () => {
  const { calls } = await run(cmds, baseInfo());
  const url = calls[0].payload.buttons.find((b) => b.name === 'cta_url');
  assert.ok(url);
  assert.equal(url.params.url, REPO);
  assert.equal(url.params.display_text.trim().length > 0, true);
});

test('cta_copy carries a bot-generated copyable text, no foreign promo', async () => {
  const { calls } = await run(cmds, baseInfo());
  const copy = calls[0].payload.buttons.find((b) => b.name === 'cta_copy');
  assert.ok(copy);
  assert.ok(copy.params.copy_code.includes(REPO));
  assert.ok(!copy.params.copy_code.includes('201066826750'));
  assert.ok(!copy.params.copy_code.includes('is.gd'));
});

test('cta_call appears only when a support number is configured', async () => {
  const without = await run(cmds, baseInfo());
  assert.equal(without.calls[0].payload.buttons.some((b) => b.name === 'cta_call'), false);

  const withPhone = await run(cmds, baseInfo({ supportNumber: '+201000000000' }));
  const call = withPhone.calls[0].payload.buttons.find((b) => b.name === 'cta_call');
  assert.ok(call, 'cta_call present when configured');
  assert.equal(call.params.phone_number, '+201000000000');
  assert.ok(call.params.display_text.trim().length > 0);
});

test('empty config.info.urls -> Arabic reply and zero interactive messages', async () => {
  const { calls, replies } = await run(cmds, baseInfo({ urls: {} }));
  assert.equal(calls.length, 0);
  assert.match(replies.join('\n'), /مستودع البوت/);
});

test('no params string contains a foreign id or shortener', async () => {
  const { calls } = await run(cmds, baseInfo({ supportNumber: '201000000000' }));
  const flat = JSON.stringify(calls[0].payload.buttons);
  assert.ok(!flat.includes('201066826750'));
  assert.ok(!flat.includes('is.gd'));
  assert.ok(!flat.includes('120363411834515372'));
});

test('source never uses the legacy conn.sendButton(', () => {
  const src = readFileSync(path.join(repoRoot, 'plugins/native/buttons.js'), 'utf8');
  assert.doesNotMatch(src, /conn\.sendButton\s*\(/);
});