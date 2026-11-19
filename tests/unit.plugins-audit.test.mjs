/**
 * tests/unit.plugins-audit.test.mjs — Comprehensive verification for audited AI, media,
 * tools, search, download, logo, sticker, and game plugins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const loadMod = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);

const aiService = await loadMod('system/aiService.js');
const mediaService = await loadMod('system/mediaService.js');

function makeHarness(overrides = {}) {
  const sent = [];
  const replies = [];
  const reacts = [];
  const sender = overrides.sender || '201000000001@s.whatsapp.net';
  const chat = overrides.chat || '201000000001@g.us';

  const m = {
    chat,
    sender,
    pushName: 'Tester',
    isGroup: chat.endsWith('@g.us'),
    key: { id: 'MSG-1' },
    mentionedJid: [],
    quoted: overrides.quoted || null,
    reply: async (text) => {
      replies.push(String(text));
      return { key: { id: `R-${replies.length}` } };
    },
    react: async (emoji) => {
      reacts.push(emoji);
      return { key: { id: 'REACT' } };
    }
  };

  const conn = {
    sendMessage: async (jid, content, opts) => {
      sent.push({ jid, content, opts });
      return { key: { id: `S-${sent.length}` } };
    },
    sendButtonNormal: async (jid, content, opts) => {
      sent.push({ jid, content, opts, buttonNormal: true });
      return { key: { id: `BN-${sent.length}` } };
    },
    sendCarousel: async (jid, content, opts) => {
      sent.push({ jid, content, opts, carousel: true });
      return { key: { id: `CR-${sent.length}` } };
    },
    groupMetadata: async () => ({
      participants: [{ id: sender }, { id: '201000000002@s.whatsapp.net' }]
    })
  };

  return { m, conn, sent, replies, reacts };
}

function makeSilentWavBuffer(durationSec = 0.25, sampleRate = 8000) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 4000);
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}

/* ── 1. system/aiService.js ── */

test('aiService.askAI rejects empty prompt and recovers from dead markers / HTTP 500 to valid text', async () => {
  const emptyRes = await aiService.askAI({ prompt: '   ' });
  assert.equal(emptyRes.ok, false);

  let calls = 0;
  const mockFetch = async (url) => {
    calls++;
    if (String(url).includes('pollinations.ai/openai')) {
      return { ok: false, status: 500, text: async () => 'upstream error' };
    }
    if (String(url).includes('text.pollinations.ai/')) {
      return { ok: true, status: 200, text: async () => 'Pollinations Legacy Text API is deprecated' };
    }
    if (String(url).includes('gen.pollinations.ai')) {
      return { ok: true, status: 200, text: async () => 'هذا رد ذكاء اصطناعي صحيح وسليم 100%' };
    }
    return { ok: false, status: 404, text: async () => '' };
  };

  const res = await aiService.askAI({
    prompt: 'ما هي عاصمة مصر؟',
    fetchImpl: mockFetch,
    timeoutMs: 5000
  });
  assert.equal(res.ok, true);
  assert.match(res.text, /رد ذكاء اصطناعي/);
  assert.equal(res.provider, 'gen-pollinations');
  assert.ok(calls >= 3);
});

test('aiService.generateAIImage converts valid PNG fallback from AI Horde into valid JPEG buffer', async () => {
  const samplePng = await sharp({
    create: { width: 128, height: 128, channels: 3, background: { r: 30, g: 144, b: 255 } }
  }).png().toBuffer();
  const base64Png = `data:image/png;base64,${samplePng.toString('base64')}`;

  const mockFetch = async (url) => {
    const sUrl = String(url);
    if (sUrl.includes('image.pollinations.ai')) {
      return { ok: false, status: 402, arrayBuffer: async () => Buffer.from('quota') };
    }
    if (sUrl.includes('stablehorde.net/api/v2/generate/async')) {
      return { ok: true, status: 202, json: async () => ({ id: 'job-123' }) };
    }
    if (sUrl.includes('stablehorde.net/api/v2/generate/status/job-123')) {
      return { ok: true, status: 200, json: async () => ({ done: true, generations: [{ img: base64Png }] }) };
    }
    return { ok: false, status: 404 };
  };

  const res = await aiService.generateAIImage({
    prompt: 'golden desert sunset',
    width: 512,
    height: 512,
    fetchImpl: mockFetch,
    timeoutMs: 10_000
  });

  assert.equal(res.ok, true);
  assert.ok(Buffer.isBuffer(res.buffer));
  assert.equal(aiService.isValidImageBuffer(res.buffer), true);
  assert.deepEqual([...res.buffer.subarray(0, 3)], [0xff, 0xd8, 0xff], 'normalized image must be valid JPEG');
});

test('aiService persona and model setters persist in memory', () => {
  const jid = 'test-persist@s.whatsapp.net';
  aiService.setUserPersonaId(jid, 'coder');
  aiService.setUserAiModel(jid, 'openai-large');
  assert.equal(aiService.getUserPersonaId(jid), 'coder');
  assert.equal(aiService.getUserAiModel(jid), 'openai-large');
});

/* ── 2. system/mediaService.js ── */

test('mediaService.renderTextProLogo & renderColorSwatch generate valid PNG images', async () => {
  const logoBuf = await mediaService.renderTextProLogo('neon', 'LIGHT بوت');
  assert.ok(Buffer.isBuffer(logoBuf) && logoBuf.length > 1000);
  assert.deepEqual([...logoBuf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  const swatchBuf = await mediaService.renderColorSwatch('#ff5733', 'rgb(255, 87, 51)', 'hsl(11, 100%, 60%)');
  assert.ok(Buffer.isBuffer(swatchBuf) && swatchBuf.length > 500);
  assert.deepEqual([...swatchBuf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('mediaService.fetchAnimeGif falls back cleanly from nekos.best 403 to otakugifs', async () => {
  const mockFetch = async (url) => {
    if (String(url).includes('nekos.best')) {
      return { ok: false, status: 403 };
    }
    if (String(url).includes('otakugifs.xyz')) {
      return { ok: true, status: 200, json: async () => ({ url: 'https://cdn.otakugifs.xyz/gifs/hug/sample.gif' }) };
    }
    return { ok: false, status: 404 };
  };
  const gif = await mediaService.fetchAnimeGif('hug', mockFetch);
  assert.equal(gif.source, 'otakugifs');
  assert.match(gif.url, /sample\.gif$/);
});

test('mediaService.applyVoiceFilter processes synthesized WAV via local ffmpeg to MP3', async () => {
  const wav = makeSilentWavBuffer();
  const mp3 = await mediaService.applyVoiceFilter(wav, 1);
  assert.ok(Buffer.isBuffer(mp3) && mp3.length > 200);
  const isMp3 =
    (mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33) || // ID3
    (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0);             // MPEG frame sync
  assert.equal(isMp3, true, 'output must be valid MP3 audio');
});

/* ── 3. Repaired Plugin Handler Smoke & Logic Checks ── */

test('repaired AI plugins handle missing inputs cleanly without throwing', async () => {
  const files = [
    'plugins/ai/chat.js',
    'plugins/ai/codex.js',
    'plugins/ai/summarize.js',
    'plugins/ai/translate.js',
    'plugins/ai/persona.js',
    'plugins/ai/history.js',
    'plugins/ai/imagen.js',
    'plugins/ai/imagine.js',
    'plugins/ai/imggen.js',
    'plugins/ai/ErenAi.js',
    'plugins/ai/ItachiAi.js',
    'plugins/ai/LuffyAi.js',
    'plugins/ai/MarinAi.js',
    'plugins/ai/MikasaAi.js',
    'plugins/ai/PomniAi.js'
  ];
  for (const rel of files) {
    const mod = await loadMod(rel);
    assert.equal(typeof mod.default, 'function', `${rel}: default export must be function`);
    assert.ok(Array.isArray(mod.default.command) && mod.default.command.length > 0, `${rel}: command list`);
    assert.ok(Array.isArray(mod.default.usage) && mod.default.usage.length > 0, `${rel}: usage list`);
    assert.ok(mod.default.category, `${rel}: category`);

    const h = makeHarness({ sender: `audit-${rel}@s.whatsapp.net` });
    await mod.default(h.m, { conn: h.conn, text: '', args: [], command: mod.default.command[0], usedPrefix: '.', prefix: '.' });
    assert.ok(h.replies.length + h.sent.length >= 1, `${rel}: should answer cleanly when invoked with empty args`);
  }
});

test('tools & games bug fixes: base64 strip, color swatch, editImage sharp filter, pick, slots, wordle 5-letter, coin', async () => {
  // base64 encodes payload without keeping subcommand word "تشفير"
  const b64Mod = await loadMod('plugins/tools/base64.js');
  const bh = makeHarness({ sender: 'b64-user@s.whatsapp.net' });
  await b64Mod.default(bh.m, { conn: bh.conn, text: 'تشفير hello', args: ['تشفير', 'hello'], usedPrefix: '.' });
  assert.match(bh.sent[0].content.text, /aGVsbG8=/, 'must encode "hello" cleanly without prefix');

  // color generates PNG swatch & palette PNG without literal \\n
  const colorMod = await loadMod('plugins/tools/color.js');
  const ch = makeHarness({ sender: 'color-user@s.whatsapp.net' });
  await colorMod.default(ch.m, { conn: ch.conn, text: 'باليت', args: ['باليت'], usedPrefix: '.' });
  assert.ok(Buffer.isBuffer(ch.sent[0].content.image));
  assert.doesNotMatch(ch.sent[0].content.caption, /\\n/);

  // editImage applies local sharp grayscale filter cleanly
  const editMod = await loadMod('plugins/tools/editImage.js');
  const samplePng = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 50, b: 50 } }
  }).png().toBuffer();
  const eh = makeHarness({
    quoted: { mimetype: 'image/png', download: async () => samplePng }
  });
  await editMod.default(eh.m, { conn: eh.conn, text: 'رمادي', args: ['رمادي'] });
  assert.ok(Buffer.isBuffer(eh.sent[0].content.image));
  assert.match(eh.sent[0].content.caption, /أبيض وأسود/);

  // slots رصيد no longer throws ReferenceError: formatStats is not defined
  const slotsMod = await loadMod('plugins/game/slots.js');
  const sh = makeHarness({ sender: 'slots-user@s.whatsapp.net' });
  await slotsMod.default(sh.m, { conn: sh.conn, text: 'رصيد', args: ['رصيد'], usedPrefix: '.' });
  assert.match(sh.replies[0], /رصيدك:\* 1000/);

  // coin no longer outputs duplicate hawk emoji for tails or claims عملة
  const coinMod = await loadMod('plugins/game/coin.js');
  assert.equal(coinMod.default.command.includes('عملة'), false);
  const coh = makeHarness({ sender: 'coin-user@s.whatsapp.net' });
  await coinMod.default(coh.m, { conn: coh.conn, text: '', args: [], usedPrefix: '.' });
  assert.match(coh.sent[0].content.text, /رمي عملة/);

  // wordle starts cleanly and has strictly 5-letter answer
  const wordleMod = await loadMod('plugins/game/wordle.js');
  const wh = makeHarness({ chat: 'wordle-group@g.us', sender: 'wordle-user@s.whatsapp.net' });
  await wordleMod.default(wh.m, { conn: wh.conn, text: '', args: [], usedPrefix: '.' });
  assert.equal([...global.gameWordle['wordle-group@g.us'].answer].length, 5);
  delete global.gameWordle['wordle-group@g.us'];

  // sticker/maker & sticker/h check text sticker plugin compiles and responds cleanly on missing args
  const makerMod = await loadMod('plugins/sticker/maker.js');
  const mh = makeHarness({ sender: 'maker-user@s.whatsapp.net' });
  await makerMod.default(mh.m, { conn: mh.conn, text: '', usedPrefix: '.', command: 'ستيكر-نص' });
  assert.ok(mh.replies.length >= 1);
});

test('viewonce reveal handler (كشف / عرض) handles missing quote, non-media, direct image, and viewOnceMessageV2', async () => {
  const viewMod = await loadMod('plugins/عرض.js');
  for (const cmd of ['كشف', 'reveal', 'كشف-صوره', 'كشف-فيديو', 'عرض']) {
    assert.ok(viewMod.default.command.includes(cmd), `command list should include ${cmd}`);
  }

  // 1) Missing quoted message
  const h1 = makeHarness();
  await viewMod.default(h1.m, { conn: h1.conn });
  assert.match(h1.sent[0].content.text, /قم بالرد على الصورة أو الفيديو/);
  assert.match(h1.sent[0].content.text, /𝙎𝙊𝙉𝙂 𝘽𝙊𝙏/);

  // 2) Unsupported non-media quote
  const h2 = makeHarness({ quoted: { mediaType: 'audio', text: 'voice' } });
  await viewMod.default(h2.m, { conn: h2.conn });
  assert.match(h2.sent[0].content.text, /الرجاء الرد على صورة أو فيديو فقط/);

  // 3) Direct image quote with working download()
  const imgBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const h3 = makeHarness({
    quoted: {
      mediaType: 'image',
      download: async () => imgBuf
    }
  });
  await viewMod.default(h3.m, { conn: h3.conn });
  assert.equal(h3.sent[0].content.react.text, '⏳');
  assert.deepEqual(h3.sent[1].content.image, imgBuf);
  assert.match(h3.sent[1].content.caption, /تم فتح الصورة المعمول لعرض لمرة واحدة/);
  assert.equal(h3.sent[2].content.react.text, '✅');

  // 4) Wrapped viewOnceMessageV2 video where m.quoted.mediaType is viewOnceV2
  const vidBuf = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]);
  const h4 = makeHarness({
    quoted: {
      mediaType: 'viewOnceV2',
      message: {
        message: {
          videoMessage: { mimetype: 'video/mp4', url: 'https://example.com/v' }
        }
      },
      download: async () => vidBuf
    }
  });
  await viewMod.default(h4.m, { conn: h4.conn });
  assert.deepEqual(h4.sent[1].content.video, vidBuf);
  assert.match(h4.sent[1].content.caption, /تم فتح الفيديو المعمول لعرض لمرة واحدة/);
});
