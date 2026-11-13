/**
 * tests/unit.task-24.test.mjs — todo 24, ATTEMPT 3: the MangaDex image-page validator
 * ==========================================================================================
 * Attempt 2 shipped the five repaired download plugins, but the verifier found one defect:
 * plugins/download/مانهوا.js `fetchBuffer()` accepted an HTTP 200 HTML body (or an EMPTY
 * body) as an "image page" and the plugin then sent a BROKEN/EMPTY ZIP whose page_001.jpg
 * contained `<html>error</html>`.
 *
 * Attempt 3 fixes exactly that:
 *   - fetchBuffer() now VALIDATES before accepting: status must be 200, Content-Type must
 *     start with image/ (or be absent-but-with-magic-bytes), the body must be non-empty and
 *     start with a real image magic (JPEG FF D8 FF / PNG 89 50 4E 47 / GIF 47 49 46 38 /
 *     WebP RIFF....WEBP);
 *   - any failure throws the Arabic error `❌ تعذر تحميل الصورة: <reason>` and the broken
 *     page is NEVER added to the ZIP;
 *   - if ZERO pages succeed, the Arabic "temporarily unavailable" message is sent instead
 *     of an empty ZIP;
 *   - the other four repaired plugins (apk/tطبيق -> Aptoide, fb -> v3 ajaxSearch, tiktok)
 *     still load and their repaired paths still return usable data.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const DL = path.join(repoRoot, 'plugins', 'download');

// The plugins read this at call time -> the timeout cases stay fast.
process.env.DOWNLOAD_TIMEOUT_MS = '400';

const load = (file) => import(pathToFileURL(path.join(DL, file)).href);

const apkPlugin = (await load('apk.js')).default;
const applyPlugin = (await load('#U062a#U0637#U0628#U064a#U0642.js')).default;
const fbPlugin = (await load('fb.js')).default;
const manhwaModule = await load('#U0645#U0627#U0646#U0647#U0648#U0627.js');
const manhwaPlugin = manhwaModule.default;
const fetchBuffer = manhwaModule.fetchBuffer;
const tiktokPlugin = (await load('tiktok.js')).default;

const FILES = {
  apk: 'apk.js',
  apply: '#U062a#U0637#U0628#U064a#U0642.js',
  fb: 'fb.js',
  manhwa: '#U0645#U0627#U0646#U0647#U0648#U0627.js',
  tiktok: 'tiktok.js'
};

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const realFetch = globalThis.fetch;

function headersGet(lower) {
  return (key) => lower[String(key).toLowerCase()] ?? null;
}

function mockResponse({ status = 200, body = '', headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: headersGet(lower) },
    text: async () => body
  };
}

// A response whose body arrives as real BYTES (binary image magic cannot survive a utf8 text() round-trip).
function binaryResponse({ status = 200, bytes = new Uint8Array(0), headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v]));
  const copy = Uint8Array.from(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: headersGet(lower) },
    body: new ReadableStream({
      start(controller) {
        if (copy.length) controller.enqueue(copy);
        controller.close();
      }
    })
  };
}

function installFetch(handler) {
  globalThis.fetch = async (url, opts) => handler(String(url), opts ?? {});
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

after(() => restoreFetch());

function harness() {
  const sent = [];
  const replies = [];
  const m = {
    chat: 'test@s.whatsapp.net',
    sender: 'test@s.whatsapp.net',
    pushName: 'Tester',
    key: { id: 'KEY' },
    reply: async (text) => {
      replies.push(String(text));
      return { key: { id: 'RID' } };
    },
    react: async () => ({ key: { id: 'XID' } })
  };
  const conn = {
    sendMessage: async (chat, content, opts) => {
      sent.push({ chat, content, opts });
      return { key: { id: 'SID' } };
    },
    sendButtonNormal: async (chat, content, opts) => {
      sent.push({ chat, content, opts });
      return { key: { id: 'BID' } };
    }
  };
  return { m, conn, sent, replies };
}

const allText = (h) =>
  [
    ...h.replies,
    ...h.sent.map((s) => s.content?.text ?? s.content?.caption ?? '')
  ].join('\n');

const HANG = () => new Promise(() => {}); // never settles -> the timeout must fire

const HTML_ERROR_PAGE = '<html><body>error: verification required</body></html>';

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0xff, 0xd9
]);
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d
]);
const WEBP_BYTES = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);

const AT_HOME_JSON = JSON.stringify({
  result: 'ok',
  baseUrl: 'https://uploads.example.org',
  chapter: { hash: 'abc123hash', data: ['p1.jpg', 'p2.jpg'], dataSaver: [] }
});

const APTOIDE_JSON = JSON.stringify({
  info: { status: 'OK' },
  datalist: {
    total: 1,
    count: 1,
    list: [
      {
        id: 77384523,
        name: 'Instagram',
        package: 'com.instagram.android',
        size: 160182324,
        icon: 'https://pool.img.aptoide.com/x_icon.png',
        updated: '2026-11-12 02:40:17',
        file: {
          vername: '452.1.0.53.64',
          filesize: 160182324,
          path_alt: 'https://pool.apk.aptoide.com/store/com-instagram-android.apk'
        }
      }
    ]
  }
});

const FDL_RESULT_HTML = `<!doctype html><html><body>
<table class="table"><tbody>
<tr><td><span class="video-quality">HD</span></td><td><a class="download-link-fb" href="https://cdn.fdownloader.net/dl/video.mp4">download</a></td></tr>
</tbody></table></body></html>`;

const FDL_HOME_HTML = `<!doctype html><html><body>
<input type="hidden" name="k_token" value="TOKEN123"><input type="hidden" name="k_exp" value="EXP456">
<input type="hidden" name="cftoken" value="CF789"></body></html>`;

const SSSTIK_HTML = `<!doctype html><html><body>
<h2>Some Author</h2><div class="maintext">A nice description</div>
<a id="hd_download" href="https://tikcdn.io/ssstik/123?st=hd">HD</a>
<a class="download_link without_watermark" href="https://tikcdn.io/ssstik/123?st=sd">download</a>
<a class="download_link music" href="https://tikcdn.io/music/456">audio</a>
</body></html>`;

const MANGA_CHALLENGE_HTML = `<!doctype html><html lang="en"><head>
<title>MangaDex - Browser verification...</title></head>
<body><noscript>Please enable JavaScript and cookies to continue to MangaDex.</noscript></body></html>`;

const atHomeFetch = (pageResolver) =>
  async (url) => {
    if (url.includes('at-home/server')) return mockResponse({ status: 200, body: AT_HOME_JSON });
    return pageResolver(url);
  };

/* ------------------------------------------------------------------ *
 * 1. fetchBuffer() — the image validator (attempt-3 core defect)
 * ------------------------------------------------------------------ */

test('fetchBuffer: a 200 with an HTML body is REJECTED with the Arabic error (not an "image")', async () => {
  installFetch(async () =>
    mockResponse({ status: 200, body: HTML_ERROR_PAGE, headers: { 'content-type': 'text/html; charset=utf-8' } })
  );
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /^❌ تعذر تحميل الصورة:/);
        assert.match(e.message, /text\/html/);
        assert.equal(e.kind, 'image');
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: a 200 with an EMPTY body is REJECTED even with an image Content-Type', async () => {
  installFetch(async () => binaryResponse({ status: 200, bytes: [], headers: { 'content-type': 'image/jpeg' } }));
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /^❌ تعذر تحميل الصورة:/);
        assert.match(e.message, /فارغة/);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: a 200 with an empty body and NO Content-Type is REJECTED too', async () => {
  installFetch(async () => binaryResponse({ status: 200, bytes: [] }));
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /^❌ تعذر تحميل الصورة:/);
        assert.match(e.message, /فارغة/);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: a 200 with a valid JPEG magic is ACCEPTED and the exact bytes are returned', async () => {
  installFetch(async () => binaryResponse({ status: 200, bytes: JPEG_BYTES, headers: { 'content-type': 'image/jpeg' } }));
  try {
    const buf = await fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg');
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.length, JPEG_BYTES.length);
    assert.deepEqual([...buf.subarray(0, 3)], [0xff, 0xd8, 0xff], 'the JPEG magic must survive intact');
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: magic bytes are accepted WITHOUT a Content-Type header (absent-but-with-magic)', async () => {
  installFetch(async (url) => {
    if (url.endsWith('.jpg')) return binaryResponse({ status: 200, bytes: JPEG_BYTES });
    if (url.endsWith('.png')) return binaryResponse({ status: 200, bytes: PNG_BYTES });
    if (url.endsWith('.webp')) return binaryResponse({ status: 200, bytes: WEBP_BYTES });
    return mockResponse({ status: 404, body: '' });
  });
  try {
    assert.deepEqual([...(await fetchBuffer('https://x/a.jpg')).subarray(0, 4)], [0xff, 0xd8, 0xff, 0xe0]);
    assert.deepEqual([...(await fetchBuffer('https://x/a.png')).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.equal((await fetchBuffer('https://x/a.webp')).toString('latin1', 8, 12), 'WEBP');
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: a 404 is REJECTED with the Arabic error (no silent null, no broken page)', async () => {
  installFetch(async () => mockResponse({ status: 404, body: 'not found' }));
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /^❌ تعذر تحميل الصورة:/);
        assert.match(e.message, /404/);
        assert.equal(e.kind, 'image');
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: an HTML body behind a Lying image Content-Type is REJECTED by the magic check', async () => {
  installFetch(async () => binaryResponse({
    status: 200,
    bytes: Uint8Array.from(Buffer.from(HTML_ERROR_PAGE, 'utf8')),
    headers: { 'content-type': 'image/jpeg' }
  }));
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /بصمة غير معروفة/);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('fetchBuffer: a non-200 HTML status like 403 with a challenge page is REJECTED', async () => {
  installFetch(async () => mockResponse({ status: 403, body: MANGA_CHALLENGE_HTML }));
  try {
    await assert.rejects(
      () => fetchBuffer('https://uploads.example.org/data/abc123hash/p1.jpg'),
      (e) => {
        assert.match(e.message, /403/);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

/* ------------------------------------------------------------------ *
 * 2. the chapter ZIP — broken pages never reach WhatsApp
 * ------------------------------------------------------------------ */

test('chapter ZIP: every page is a 200-HTML body -> ZERO pages, NO zip, Arabic "temporarily unavailable"', async () => {
  const h = harness();
  installFetch(atHomeFetch(() => mockResponse({ status: 200, body: HTML_ERROR_PAGE, headers: { 'content-type': 'text/html' } })));
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'chapterid-1', command: 'تحميل_فصل', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0, 'an empty/broken ZIP must NOT be sent');
  assert.match(allText(h), /غير متاح مؤقتاً/);
  assert.match(allText(h), /تعذر تحميل صفحات الفصل/);
  assert.doesNotMatch(allText(h), /تم تجهيز الفصل بنجاح/);
});

test('chapter ZIP: every page has an EMPTY body -> zero pages, NO zip, Arabic message', async () => {
  const h = harness();
  installFetch(atHomeFetch(() => binaryResponse({ status: 200, bytes: [], headers: { 'content-type': 'image/jpeg' } })));
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'chapterid-1', command: 'تحميل_فصل', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0);
  assert.match(allText(h), /غير متاح مؤقتاً/);
});

test('chapter ZIP: a valid page is kept, a 200-HTML page is dropped, and ONLY page_001 enters the ZIP', async () => {
  const h = harness();
  installFetch(atHomeFetch((url) => {
    if (url.includes('/p1.jpg')) return binaryResponse({ status: 200, bytes: JPEG_BYTES, headers: { 'content-type': 'image/jpeg' } });
    if (url.includes('/p2.jpg')) return mockResponse({ status: 200, body: HTML_ERROR_PAGE, headers: { 'content-type': 'text/html' } });
    return mockResponse({ status: 404, body: '' });
  }));
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'chapterid-1', command: 'تحميل_فصل', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  const docs = h.sent.filter((s) => s.content?.document);
  assert.equal(docs.length, 1, 'exactly one ZIP must be sent');
  const zip = await JSZip.loadAsync(docs[0].content.document);
  assert.deepEqual(Object.keys(zip.files), ['page_001.jpg'], 'only the successfully-fetched page may be in the ZIP');
  const page1 = await zip.file('page_001.jpg').async('nodebuffer');
  assert.deepEqual([...page1.subarray(0, 3)], [0xff, 0xd8, 0xff], 'the kept page must be the real JPEG bytes');
  assert.match(docs[0].content.caption, /الصفحات:\* 1\b/);
  assert.match(docs[0].content.caption, /تم تجهيز الفصل بنجاح/);
});

test('chapter ZIP: hung page fetches fire the timeout and answer the Arabic "تعذر الاتصال" (no hang, no zip)', async () => {
  const h = harness();
  installFetch(atHomeFetch(() => HANG()));
  const started = Date.now();
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'chapterid-1', command: 'تحميل_فصل', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
  assert.match(allText(h), /تعذر الاتصال/);
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0, 'no document may be sent when nothing was fetched');
});

/* ------------------------------------------------------------------ *
 * 3. the other repaired plugins still load and still return usable data
 * ------------------------------------------------------------------ */

test('the five download plugins still load as callable handlers', () => {
  for (const p of [apkPlugin, applyPlugin, fbPlugin, manhwaPlugin, tiktokPlugin]) {
    assert.equal(typeof p, 'function');
    const hasCommand = Array.isArray(p.command) ? p.command.length > 0 : p.command instanceof RegExp;
    assert.ok(hasCommand, 'each plugin still registers its commands');
  }
});

test('apk still returns the real Aptoide apk link', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: APTOIDE_JSON }));
  try {
    await apkPlugin(h.m, { conn: h.conn, text: 'instagram', command: 'apk' });
  } finally {
    restoreFetch();
  }
  const docs = h.sent.filter((s) => s.content?.document);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].content.document.url, 'https://pool.apk.aptoide.com/store/com-instagram-android.apk');
  assert.equal(docs[0].content.fileName, 'Instagram.apk');
});

test('تطبيق still returns the real Aptoide apk link', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: APTOIDE_JSON }));
  try {
    await applyPlugin(h.m, { conn: h.conn, text: 'instagram', command: 'تطبيق' });
  } finally {
    restoreFetch();
  }
  const docs = h.sent.filter((s) => s.content?.document);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].content.document.url, 'https://pool.apk.aptoide.com/store/com-instagram-android.apk');
});

test('fb still returns the real video url from the v3 ajaxSearch payload', async () => {
  const h = harness();
  installFetch(async (url) => {
    if (url.includes('ajaxSearch')) return mockResponse({ status: 200, body: FDL_RESULT_HTML });
    if (url.includes('fdownloader.net/id')) return mockResponse({ status: 200, body: FDL_HOME_HTML });
    if (url.includes('cdn.fdownloader.net')) {
      return mockResponse({ status: 206, body: '', headers: { 'content-range': 'bytes 0-0/1234567' } });
    }
    return mockResponse({ status: 404, body: '' });
  });
  try {
    await fbPlugin(h.m, { conn: h.conn, text: 'https://fb.watch/x', command: 'fb', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  const videos = h.sent.filter((s) => s.content?.video);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].content.video.url, 'https://cdn.fdownloader.net/dl/video.mp4');
});

test('tiktok still returns the real video and audio urls from the ssstik payload', async () => {
  const h = harness();
  installFetch(async (url) => {
    if (url.includes('ssstik.io')) return mockResponse({ status: 200, body: SSSTIK_HTML });
    if (url.includes('tikcdn.io')) {
      return mockResponse({ status: 206, body: '', headers: { 'content-range': 'bytes 0-0/2953029' } });
    }
    return mockResponse({ status: 404, body: '' });
  });
  try {
    await tiktokPlugin(h.m, { conn: h.conn, text: 'https://www.tiktok.com/@u/video/1', command: 'تيك' });
  } finally {
    restoreFetch();
  }
  const videos = h.sent.filter((s) => s.content?.video);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].content.video.url, 'https://tikcdn.io/ssstik/123?st=sd');
  const audios = h.sent.filter((s) => s.content?.audio);
  assert.equal(audios.length, 1);
  assert.equal(audios[0].content.audio.url, 'https://tikcdn.io/music/456');
});

/* ------------------------------------------------------------------ *
 * 4. adversarial probes
 * ------------------------------------------------------------------ */

test('malformed_input: a garbage manga query answers in Arabic instead of crashing', async () => {
  const h = harness();
  installFetch(async (url) => {
    if (url.includes('/manga?')) {
      return mockResponse({ status: 200, body: JSON.stringify({ result: 'ok', data: [] }) });
    }
    return mockResponse({ status: 404, body: '{}' });
  });
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: '!!!@@@### زقزقة', command: 'مانهوا', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /لم يتم العثور على نتائج/);
});

test('misleading_success_output: a MangaDex challenge page is still answered "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: MANGA_CHALLENGE_HTML }));
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'solo leveling', command: 'مانهوا', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.equal(h.sent.filter((s) => s.content?.buttons).length, 0);
});

/* ------------------------------------------------------------------ *
 * 5. static invariants
 * ------------------------------------------------------------------ */

const read = (file) => readFileSync(path.join(DL, file), 'utf8');

test('static: fetchBuffer validates status, Content-Type and image magic before accepting', () => {
  const src = read(FILES.manhwa);
  assert.match(src, /imageRejectionReason/, 'the validator must exist');
  assert.match(src, /startsWith\('image\/'\)/, 'Content-Type must start with image/');
  assert.match(src, /buf\[0\] === 0xff && buf\[1\] === 0xd8 && buf\[2\] === 0xff/, 'JPEG magic FF D8 FF');
  assert.match(src, /0x89 && buf\[1\] === 0x50 && buf\[2\] === 0x4e && buf\[3\] === 0x47/, 'PNG magic 89 50 4E 47');
  assert.match(src, /0x47 && buf\[1\] === 0x49 && buf\[2\] === 0x46 && buf\[3\] === 0x38/, 'GIF magic 47 49 46 38');
  assert.match(src, /'RIFF'/, 'WebP RIFF');
  assert.match(src, /'WEBP'/, 'WebP WEBP');
  assert.match(src, /تعذر تحميل الصورة:/, 'the Arabic refusal error');
  assert.match(src, /status !== 200/, 'status must be exactly 200');
  assert.match(src, /غير متاح مؤقتاً/, 'the zero-pages Arabic unavailable message');
  // every HTTP call keeps its guards
  assert.match(src, /AbortController/, 'timeout via AbortController');
  assert.match(src, /MAX_IMAGE_BYTES/, 'size cap on image bodies');
  assert.match(src, /MAX_ZIP_BYTES/, 'size cap on the ZIP');
});

test('static: no download command was deleted — every command name still resolves to a handler', () => {
  const commands = {
    'مانهوا': FILES.manhwa,
    'عرض_مانهوا': FILES.manhwa,
    'تحميل_فصل': FILES.manhwa,
    'apk': FILES.apk,
    'fb': FILES.fb,
    'تيك': FILES.tiktok,
    'تطبيق': FILES.apply
  };
  for (const [cmd, file] of Object.entries(commands)) {
    const src = read(file);
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(src, new RegExp(escaped), `command "${cmd}" must still be registered`);
    assert.match(src, /export default/, `${file} must still export its handler`);
  }
});
