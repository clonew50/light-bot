/**
 * tests/unit.task-20.test.mjs — todo 20: sticker annotation + self-deleting message
 * ==========================================================================================
 * Drives plugins/native/annotate.js and plugins/native/vanish.js with a FAKE client
 * (no bot boot, no network, no real media).
 * Asserts:
 *   - annotate: sticker bytes go through the bot's OWN upload helper; the annotation
 *     message carries MessageAssociation type 11 pointing at the sticker the bot just sent;
 *     no foreign mediaKey / fileSha256 / directPath / mmg.whatsapp.net anywhere.
 *   - vanish: exactly one send followed by exactly one delete for that message id,
 *     and the delete key is always fromMe with the bot's own message id.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const annotate = (await import(pathToFileURL(path.join(repoRoot, 'plugins/native/annotate.js')).href)).default;
const vanish = (await import(pathToFileURL(path.join(repoRoot, 'plugins/native/vanish.js')).href)).default;

const CHAT = 'test@s.whatsapp.net';
const mkMsg = (over = {}) => ({
  chat: CHAT,
  sender: 'user@s.whatsapp.net',
  reply: async () => {},
  ...over
});

const IMAGE = Buffer.from('image-bytes');
const STICKER = Buffer.from('sticker-bytes-from-bot');
const OWN_URL = 'https://bot-own.catbox.moe/sticker.webp';

function annotateCtx({ uploadImpl, sendImpl } = {}) {
  const rec = { uploaded: [], created: [], sent: [], relayed: [], replies: [] };
  const conn = {
    user: { id: '111:1@s.whatsapp.net' },
    config: { info: { nameBot: 'BOT-TEST', nameChannel: 'CHAN-TEST' } },
    sendMessage: sendImpl || (async (chat, payload) => {
      rec.sent.push({ chat, payload });
      if (payload.sticker) return { key: { remoteJid: chat, fromMe: true, id: 'STK-1' } };
      return undefined;
    }),
    relayMessage: async (chat, message) => rec.relayed.push({ chat, message })
  };
  const ctx = {
    conn,
    bot: { config: { info: { nameBot: 'BOT-TEST', nameChannel: 'CHAN-TEST' } } },
    text: 'تعليق على الصورة',
    args: ['تعليق', 'على', 'الصورة'],
    createSticker: async (input, opts) => { rec.created.push({ input, opts }); return STICKER; },
    upload: uploadImpl || (async (buf) => { rec.uploaded.push(buf); return OWN_URL; }),
    buildMessage: (chat, content) => ({ key: { remoteJid: chat, fromMe: true, id: 'ANN-1' }, message: content })
  };
  const m = mkMsg({
    reply: async (t) => rec.replies.push(String(t)),
    quoted: {
      key: { remoteJid: CHAT, fromMe: false, id: 'Q-1' },
      msg: { mimetype: 'image/png' },
      download: async () => IMAGE
    }
  });
  return { ctx, m, rec };
}

/* ── annotate ─────────────────────────────────────────────────────────── */
test('annotate uploads its own sticker bytes and associates a type 11 annotation', async () => {
  const { ctx, m, rec } = annotateCtx();
  await annotate(m, ctx);

  assert.equal(rec.created.length, 1, 'createSticker called once');
  assert.equal(rec.created[0].input.toString(), 'image-bytes');
  assert.equal(rec.uploaded.length, 1, 'the bot upload helper is the only uploader');
  assert.equal(rec.uploaded[0].toString(), 'sticker-bytes-from-bot');

  assert.equal(rec.sent.length, 1, 'one sticker message');
  assert.equal(rec.sent[0].payload.sticker, OWN_URL, 'sticker media is the bot own upload');

  assert.equal(rec.relayed.length, 1, 'one annotation message');
  const ann = rec.relayed[0].message;
  assert.equal(ann.conversation, 'تعليق على الصورة');
  const assoc = ann.messageContextInfo?.messageAssociation;
  assert.ok(assoc, 'messageContextInfo.messageAssociation present');
  assert.equal(assoc.associationType, 11);
  assert.deepEqual(assoc.parentMessageKey, { remoteJid: CHAT, fromMe: true, id: 'STK-1' });
});

test('annotate never references foreign sticker media', async () => {
  const { ctx, m, rec } = annotateCtx();
  await annotate(m, ctx);
  const blob = JSON.stringify({ sent: rec.sent, relayed: rec.relayed, uploaded: rec.uploaded.map(String) });
  for (const bad of ['mediaKey', 'fileSha256', 'directPath', 'mmg.whatsapp.net', 'messageSecret']) {
    assert.ok(!blob.includes(bad), `must not contain ${bad}`);
  }
});

test('annotate replies in Arabic and sends nothing when the upload helper rejects', async () => {
  const { ctx, m, rec } = annotateCtx({ uploadImpl: async () => { throw new Error('catbox down'); } });
  await annotate(m, ctx);
  assert.equal(rec.uploaded.length, 0);
  assert.equal(rec.sent.length, 0);
  assert.equal(rec.relayed.length, 0);
  assert.match(rec.replies.join('\n'), /حصلت مشكلة|فشل|تعذّر/);
});

test('annotate without a quoted image replies in Arabic and sends nothing', async () => {
  const { ctx, rec } = annotateCtx();
  await annotate(mkMsg({ chat: 't20-ann-3@s.whatsapp.net', reply: async (t) => rec.replies.push(String(t)) }), ctx);
  assert.equal(rec.sent.length, 0);
  assert.equal(rec.relayed.length, 0);
  assert.match(rec.replies.join('\n'), /رد على صورة/);
});

test('annotate without annotation text replies in Arabic and sends nothing', async () => {
  const { ctx, m, rec } = annotateCtx();
  await annotate(m, { ...ctx, text: '', args: [] });
  assert.equal(rec.created.length, 0);
  assert.equal(rec.sent.length, 0);
  assert.match(rec.replies.join('\n'), /نص التعليق/);
});

test('annotate leaves no temp files behind in tmp/', async () => {
  const tmpDir = path.join(repoRoot, 'tmp');
  let before = [];
  try { before = readdirSync(tmpDir); } catch { before = []; }
  const { ctx, m } = annotateCtx();
  await annotate(m, ctx);
  let after = [];
  try { after = readdirSync(tmpDir); } catch { after = []; }
  assert.deepEqual(after, before, 'plugin must not create temp files in tmp/');
});

test('annotate registration metadata is intact', () => {
  assert.deepEqual(annotate.command, ['ستكر', 'annotate']);
  assert.equal(annotate.category, 'sticker');
  assert.equal(typeof annotate, 'function');
});

/* ── vanish ───────────────────────────────────────────────────────────── */
function vanishConn({ sendImpl } = {}) {
  const calls = [];
  const conn = {
    sendMessage: sendImpl || (async (chat, payload) => {
      calls.push({ chat, payload });
      if (payload.delete) return undefined;
      return { key: { remoteJid: chat, fromMe: true, id: 'VAN-1' } };
    })
  };
  return { conn, calls };
}

test('vanish sends one text then deletes exactly that message id', async () => {
  const { conn, calls } = vanishConn();
  const m = mkMsg({ chat: 't20-van-1@s.whatsapp.net' });
  const key = await vanish(m, { conn, text: 'هختفي', vanishDelayMs: 20 });
  assert.equal(calls.length, 2, 'exactly one send + one delete');
  assert.equal(calls[0].payload.text, 'هختفي');
  assert.equal('delete' in calls[0].payload, false);
  assert.deepEqual(calls[1].payload, { delete: { remoteJid: 't20-van-1@s.whatsapp.net', fromMe: true, id: 'VAN-1' } });
  assert.equal(calls.filter((c) => c.payload.delete).length, 1, 'one delete call only');
  assert.deepEqual(key, { remoteJid: 't20-van-1@s.whatsapp.net', fromMe: true, id: 'VAN-1' });
});

test('vanish never deletes when the send returns no key', async () => {
  const replies = [];
  const { conn, calls } = vanishConn({
    sendImpl: async (chat, payload) => { calls.push({ chat, payload }); return undefined; }
  });
  const m = mkMsg({ chat: 't20-van-2@s.whatsapp.net', reply: async (t) => replies.push(String(t)) });
  await vanish(m, { conn, text: 'x', vanishDelayMs: 5 });
  assert.equal(calls.length, 1, 'no delete without an own message id');
  assert.match(replies.join('\n'), /تعذّر إرسال الرسالة/);
});

test('vanish sends no delete when the send throws', async () => {
  const replies = [];
  const { conn, calls } = vanishConn({
    sendImpl: async () => { throw new Error('socket closed'); }
  });
  const m = mkMsg({ chat: 't20-van-3@s.whatsapp.net', reply: async (t) => replies.push(String(t)) });
  await vanish(m, { conn, text: 'x', vanishDelayMs: 5 });
  assert.equal(calls.length, 0);
  assert.match(replies.join('\n'), /حصلت مشكلة/);
});

test('vanish falls back to the default text when none is given', async () => {
  const { conn, calls } = vanishConn();
  await vanish(mkMsg({ chat: 't20-van-4@s.whatsapp.net' }), { conn, text: '', args: [], vanishDelayMs: 5 });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].payload.text.length > 0);
});

test('vanish registration metadata is intact', () => {
  assert.deepEqual(vanish.command, ['اختفاء', 'vanish']);
  assert.equal(vanish.category, 'tools');
  assert.equal(typeof vanish, 'function');
});