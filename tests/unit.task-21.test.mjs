/**
 * tests/unit.task-21.test.mjs — todo 21: gated experimental protocol set
 * ======================================================================
 * Fake client only (no bot boot). Asserts:
 *   - flag unset / "0"  -> NO interactive message, an Arabic reply, zero sends
 *   - flag = "1"        -> exactly ONE interactive message with exactly one
 *                          button whose name is inside the framework enum
 *   - the shipped source never contains cta_pix_code_copy / payment_info / mpm
 *   - the plugin source never uses the legacy conn.sendButton(
 *   - no foreign key / group jid / mediaKey triple is embedded
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const mod = await import(pathToFileURL(path.join(repoRoot, 'plugins/native/experimental.js')).href);
const experimental = mod.default;

/** Strip // comments so prose mentions never count as shipped patterns. */
function stripComments(src) {
  let out = '';
  let inStr = null; // ', ", `
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; continue; }
    out += c;
  }
  return out;
}

const ALLOWED = new Set([
  'quick_reply',
  'cta_url',
  'cta_call',
  'cta_copy',
  'single_select',
  'call_permission_request'
]);

const info = {
  nameBot: 'BOT-TEST',
  nameChannel: 'CHAN-TEST',
  supaimg: ['https://i.supaimg.com/own-1.jpg'],
  urls: { repo: 'https://github.com/clonew50/light-bot' }
};

function makeCtx() {
  const calls = [];
  const conn = {
    sendButtonNormal: async (chat, payload, quoted) => calls.push({ chat, payload, quoted }),
    sendMessage: async (...a) => { throw new Error('sendMessage must not be used here'); }
  };
  const bot = { config: { info, prefix: '.' }, getAllCommands: async () => [] };
  const replies = [];
  const m = { chat: 'test@s.whatsapp.net', sender: 'u@s.whatsapp.net', reply: async (t) => replies.push(String(t)) };
  return { calls, replies, m, ctx: { conn, bot, text: '', args: [], command: 'تجربة', usedPrefix: '.' } };
}

async function run() {
  const f = makeCtx();
  await experimental(f.m, f.ctx);
  return f;
}

test('metadata: usage / command / category present', () => {
  assert.deepEqual(experimental.usage, ['تجربة']);
  assert.ok(experimental.command.includes('تجربة'));
  assert.equal(experimental.category, 'native');
});

test('flag unset -> no interactive message, Arabic reply, zero sends', async () => {
  const prev = process.env.EXPERIMENTAL_PROTOCOLS;
  delete process.env.EXPERIMENTAL_PROTOCOLS;
  try {
    const { calls, replies } = await run();
    assert.equal(calls.length, 0);
    const body = replies.join('\n');
    assert.match(body, /غير مفعّلة/);
    assert.match(body, /EXPERIMENTAL_PROTOCOLS=1/);
  } finally {
    if (prev === undefined) delete process.env.EXPERIMENTAL_PROTOCOLS;
    else process.env.EXPERIMENTAL_PROTOCOLS = prev;
  }
});

test('flag "0" -> treated as off', async () => {
  const prev = process.env.EXPERIMENTAL_PROTOCOLS;
  process.env.EXPERIMENTAL_PROTOCOLS = '0';
  try {
    const { calls, replies } = await run();
    assert.equal(calls.length, 0);
    assert.match(replies.join('\n'), /غير مفعّلة/);
  } finally {
    if (prev === undefined) delete process.env.EXPERIMENTAL_PROTOCOLS;
    else process.env.EXPERIMENTAL_PROTOCOLS = prev;
  }
});

test('flag "1" -> exactly one native message with one in-enum button', async () => {
  const prev = process.env.EXPERIMENTAL_PROTOCOLS;
  process.env.EXPERIMENTAL_PROTOCOLS = '1';
  try {
    const { calls } = await run();
    assert.equal(calls.length, 1);
    const p = calls[0].payload;
    assert.ok(p.buttons && p.buttons.length === 1);
    assert.equal(p.buttons[0].name, 'call_permission_request');
    assert.ok(ALLOWED.has(p.buttons[0].name));
    assert.ok(p.buttons[0].params.display_text.trim().length > 0);
    assert.ok(p.buttons[0].params.id.startsWith('.'));
    // caption must be non-empty and carry no foreign payload
    assert.ok(p.caption.trim().length > 0);
  } finally {
    if (prev === undefined) delete process.env.EXPERIMENTAL_PROTOCOLS;
    else process.env.EXPERIMENTAL_PROTOCOLS = prev;
  }
});

test('experimental source carries no invalid button name and no legacy sendButton', () => {
  const src = readFileSync(path.join(repoRoot, 'plugins/native/experimental.js'), 'utf8');
  // The header documents the rejected names in backticks; ensure they are only
  // present as prose, never as an actual emitted name in code.
  const codeOnly = src.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of ['cta_pix_code_copy', 'payment_info']) {
    assert.ok(!codeOnly.includes(bad), `invalid name in code: ${bad}`);
  }
  assert.doesNotMatch(src, /conn\.sendButton\s*\(/);
});

test('repo scan: no shipped plugin source contains a group jid / mmg host / messageSecret / invalid names', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const root = path.join(repoRoot, 'plugins');
  const files = walk(root).filter((p) => /\.(js|cjs|mjs)$/.test(p));
  const forbiddens = [
    { re: /mmg\.whatsapp\.net/, label: 'mmg.whatsapp.net' },
    { re: /messageSecret/i, label: 'messageSecret' },
    { re: /cta_pix_code_copy/, label: 'cta_pix_code_copy' },
    { re: /\bpayment_info\b/, label: 'payment_info' },
    { re: /@g\.us/, label: 'group jid suffix @g.us' },
    { re: /\bmpm\b/i, label: 'mpm' }
  ];
  const hits = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const { re, label } of forbiddens) {
      if (re.test(src)) hits.push(`${path.relative(repoRoot, f)}: ${label}`);
    }
  }
  assert.deepEqual(hits, [], `forbidden patterns found:\n${hits.join('\n')}`);
});