// Unit tests for todo 44 — YouTube downloader (plugins/download/yt.js).
// The providers run inside isolated child processes (node --import
// tests/axios-mock-loader44.mjs) so the axios mock never touches the network
// and can't leak into the aggregator's other lanes.
//
// Covered here:
//  1. innertube (no API key) is the primary provider: ANDROID client first, the
//     public key rides in the URL, videoId + contentCheckOk ride in the body.
//  2. audio: audio/mp4 (itag 140-class) is preferred; ≤16MB → audio message,
//     larger → document (audio/mp4 + .m4a file name).
//  3. video: muxed progressive ≤16MB → video message; larger → document.
//  4. playability failures map to Arabic messages and are not masked by later
//     transport errors; IOS client is tried when ANDROID trips the bot check.
//  5. the thumbnail card still sends when every provider fails; the final reply
//     keeps the operator's exact error format.
//  6. static guarantees: no shell:true, bounded timeouts, loader.to is last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO_ID = '4GUYdhBViRc';

// ── isolated child runner ─────────────────────────────────────────────────────

function runYtScenario(scenario, { command = 'يوتيوب', text = `https://youtu.be/${VIDEO_ID}` } = {}) {
  const script = `
    const log = console.log; const err = console.error;
    console.log = () => {}; console.error = () => {};
    process.env.YTDLP_BIN = '';
    process.env.PATH = '';
    globalThis.__ytScenario = ${JSON.stringify(scenario)};
    const { default: handler } = await import('./plugins/download/yt.js');
    const replies = [], sends = [];
    const m = {
      chat: 'g@g.us', sender: 'u@s.whatsapp.net',
      reply: async (t) => { replies.push(t); }
    };
    const conn = {
      sendMessage: async (chat, payload) => { sends.push({ chat, payload }); }
    };
    const t0 = Date.now();
    await handler(m, { conn, command: ${JSON.stringify(command)}, args: ${JSON.stringify(text.split(' '))} });
    const out = { replies, sends, posts: globalThis.__ytCalls.post, gets: globalThis.__ytCalls.get, ms: Date.now() - t0, mock: !!globalThis.__MOCK44_ACTIVE };
    process.stdout.write('@@RESULT@@' + JSON.stringify(out));
  `;
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [
      '--input-type=module',
      '--import', './tests/axios-mock-loader44.mjs',
      '--eval', script,
    ], { cwd: repoRoot, encoding: 'utf8' });
  } catch (e) {
    console.error('DBG: child threw', e.status, String(e.stderr).slice(0, 600));
    throw new Error(`child failed (${e.status}): ${e.stderr || e.message}`);
  }
  const line = stdout.split('\n').find((l) => l.startsWith('@@RESULT@@'));
  assert.ok(line, `the child must report its result (stdout: ${stdout.slice(0, 400)})`);
  return JSON.parse(line.slice('@@RESULT@@'.length));
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const oembedOk = {
  data: {
    title: 'تربون سهرة العاب الرعب اليوم',
    author_name: 'قناة الالعاب',
    thumbnail_url: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`
  }
};

const streamUrl = (itag) => `https://rr${itag}.googlevideo.com/videoplayback?itag=${itag}&range=0-`;

const itag18 = (contentLength, height = 360) => ({
  itag: 18,
  mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
  url: streamUrl(18),
  height,
  bitrate: 480_000,
  contentLength
});

const itag140 = (contentLength) => ({
  itag: 140,
  mimeType: 'audio/mp4; codecs="mp4a.40.2"',
  url: streamUrl(140),
  audioQuality: 'AUDIO_QUALITY_MEDIUM',
  bitrate: 129_000,
  contentLength
});

const itag251 = {
  itag: 251,
  mimeType: 'audio/webm; codecs="opus"',
  url: streamUrl(251),
  audioQuality: 'AUDIO_QUALITY_HIGH',
  bitrate: 130_000
};

const playerOk = {
  data: {
    playabilityStatus: { status: 'OK' },
    videoDetails: {
      title: 'تربون سهرة العاب الرعب اليوم',
      author: 'قناة الالعاب',
      lengthSeconds: '6138',
      thumbnail: { url: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg` }
    },
    streamingData: {
      formatStreams: [itag18(367_000_000)],
      adaptiveFormats: [itag140(99_000_000), itag251]
    }
  }
};

const failRest = () => ({ others: { reject: 'down' } });

// ── 1. innertube is the primary provider ──────────────────────────────────────

test('video: innertube ANDROID client is used with the public key and no API key', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: playerOk,
    ...failRest()
  });

  assert.equal(r.posts.length, 1, 'the first POST is the youtubei player call');
  assert.match(r.posts[0].url, /youtubei\/v1\/player\?key=AIzaSy/, 'the public youtube key rides in the URL');
  assert.equal(r.posts[0].client, 'ANDROID');
  assert.equal(r.posts[0].body.videoId, VIDEO_ID);
  assert.equal(r.posts[0].body.contentCheckOk, true);
  assert.equal(r.posts[0].body.racyCheckOk, true);
  assert.equal(r.posts[0].body.context.client.clientVersion, '20.10.38');

  const card = r.sends[0];
  assert.ok(card.payload.image, 'the thumbnail card is sent first');
  assert.match(card.payload.caption, /تربون سهرة العاب الرعب اليوم/);
  assert.match(card.payload.caption, /جاري التجهيز والتحميل/);

  const media = r.sends[1];
  assert.ok(media.payload.document, 'a 102-minute video must travel as a document');
  assert.equal(media.payload.mimetype, 'video/mp4');
  assert.match(media.payload.fileName, /\.mp4$/);
  assert.ok(String(media.payload.document.url).includes('itag=18'));
});

test('video: a small muxed file is sent as a video message', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: {
      data: {
        ...playerOk.data,
        videoDetails: { ...playerOk.data.videoDetails, lengthSeconds: '120' },
        streamingData: {
          formatStreams: [itag18(8_000_000)],
          adaptiveFormats: [itag140(2_000_000), itag251]
        }
      }
    }
  });

  const media = r.sends[1];
  assert.ok(media.payload.video, '≤16MB goes as a video message');
  assert.equal(media.payload.mimetype, 'video/mp4');
  assert.ok(!media.payload.document);
});

// ── 2. audio selection ────────────────────────────────────────────────────────

test('audio: audio/mp4 (itag 140-class) is preferred over opus webm', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: playerOk
  }, { command: 'يوت_اغنيه' });

  const media = r.sends[1];
  assert.ok(media.payload.document, 'a 99MB audio file travels as a document');
  assert.ok(!media.payload.audio, 'audio messages have a 16MB ceiling');
  assert.equal(media.payload.mimetype, 'audio/mp4');
  assert.match(media.payload.fileName, /\.m4a$/);
  assert.ok(String(media.payload.document.url).includes('itag=140'), 'the itag-140 stream is the chosen source');
});

test('audio: a small audio file is sent as an audio message', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: {
      data: {
        ...playerOk.data,
        videoDetails: { ...playerOk.data.videoDetails, lengthSeconds: '120' },
        streamingData: {
          formatStreams: [itag18(8_000_000)],
          adaptiveFormats: [itag140(3_000_000), itag251]
        }
      }
    }
  }, { command: 'ytmp3' });

  const media = r.sends[1];
  assert.ok(media.payload.audio, '≤16MB goes as an audio message');
  assert.ok(!media.payload.document, 'audio messages must not use the document field');
  assert.equal(media.payload.mimetype, 'audio/mp4');
});

// ── 3. client fallback and playability mapping ────────────────────────────────

test('video: IOS client is tried when ANDROID trips the bot check', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: {
      byClient: {
        ANDROID: { data: { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you are not a bot' } } },
        IOS: { data: playerOk.data }
      }
    }
  });

  assert.equal(r.posts.length, 2, 'both innertube clients were tried');
  assert.equal(r.posts[0].client, 'ANDROID');
  assert.equal(r.posts[1].client, 'IOS');
  const media = r.sends[1];
  assert.ok(media.payload.document, 'the video was fetched through the IOS client');
  assert.deepEqual(r.replies, [], 'no error reply on a successful fallback');
});

test('video: a definitively unavailable video fails fast with the Arabic message', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: {
      byClient: {
        ANDROID: { data: { playabilityStatus: { status: 'ERROR', reason: 'Video unavailable' } } },
        IOS: { data: { playabilityStatus: { status: 'ERROR', reason: 'Video unavailable' } } }
      }
    }
  });

  assert.equal(r.posts.length, 2, 'the bot check error is per-client, both were tried');
  assert.equal(r.replies.length, 1, 'exactly one error reply');
  assert.match(r.replies[0], /^❌ الفيديو مش متاح \(محذوف، خاص، أو ممنوع في المنطقة\)/);
  assert.match(r.replies[0], /جرب تاني بعد شوية، أو جرب فيديو تاني\.$/);
});

test('video: an age-gated video reports the age restriction, not a network error', () => {
  const r = runYtScenario({
    oembed: oembedOk,
    player: {
      byClient: {
        ANDROID: { data: { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm your age' } } },
        IOS: { data: { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm your age' } } }
      }
    }
  });

  assert.match(r.replies[0], /^❌ الفيديو محمي أو مقيّد بالعمر/);
});

// ── 4. metadata fallbacks ─────────────────────────────────────────────────────

test('video: a failed oembed still sends the card and then the Arabic retry error', () => {
  const r = runYtScenario({
    oembed: { reject: 'oembed down' },
    player: { byClient: { ANDROID: { reject: 'boom' }, IOS: { reject: 'boom' } } },
    ...failRest()
  });

  const card = r.sends[0];
  assert.ok(card.payload.image, 'the card is sent with the fallback thumbnail');
  assert.match(card.payload.caption, /▸ العنوان: فيديو YouTube/);
  assert.equal(r.replies.length, 1);
  assert.match(r.replies[0], /^❌ /);
  assert.match(r.replies[0], /جرب تاني بعد شوية، أو جرب فيديو تاني\.$/);
});

// ── 5. argument handling ──────────────────────────────────────────────────────

test('command: a bare id and a watch URL both resolve; garbage is rejected in Arabic', () => {
  const ok = runYtScenario({ oembed: oembedOk, player: playerOk }, { text: VIDEO_ID });
  assert.ok(ok.sends[1], 'a bare 11-char id must work');

  const watch = runYtScenario({ oembed: oembedOk, player: playerOk }, { text: `https://www.youtube.com/watch?v=${VIDEO_ID}&t=10s` });
  assert.equal(watch.posts[0].body.videoId, VIDEO_ID);

  const bad = runYtScenario({ oembed: oembedOk, player: playerOk }, { text: 'https://example.com/notyoutube' });
  assert.match(bad.replies[0], /الرابط غير صحيح/);
});

// ── 6. static guarantees ──────────────────────────────────────────────────────

test('static: the plugin never spawns a shell, bounds every timeout and prefers innertube', () => {
  const src = readFileSync(join(repoRoot, 'plugins', 'download', 'yt.js'), 'utf8');
  assert.ok(!/shell\s*:\s*true/.test(src), 'no plugin may enable a shell');
  assert.match(src, /REQUEST_TIMEOUT = 25000/, 'timeouts must be bounded');
  assert.match(src, /execFileAsync/, 'the optional yt-dlp path must use execFile (no shell)');
  assert.ok(!/\bexec\(|\bspawn\(/.test(src), 'no raw exec/spawn');
  const loaderIndex = src.indexOf('LOADER_API');
  const innertubeIndex = src.indexOf('INNERTUBE_CLIENTS');
  assert.ok(innertubeIndex > -1 && loaderIndex > -1);
  assert.ok(innertubeIndex < loaderIndex, 'loader.to must be the last resort, declared after innertube');
  assert.match(src, /contentCheckOk: true/);
});

test('static: the repo test suite has a lane for todo 44 and the aggregator auto-loads it', () => {
  const files = readdirSync(join(repoRoot, 'tests')).filter((f) => /^unit\.task-\d+\.test\.mjs$/.test(f));
  assert.ok(files.includes('unit.task-44.test.mjs'), 'tests/unit.task-44.test.mjs must exist');
  const aggregator = readFileSync(join(repoRoot, 'tests', 'unit.test.mjs'), 'utf8');
  assert.match(aggregator, /unit\\\.task-\\d\+\\\.test\\\.mjs/, 'the aggregator must import every lane file');
});