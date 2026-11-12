/**
 * tests/unit.task-24.test.mjs — todo 24: "Repair or retire the dead download commands"
 * ==========================================================================================
 * The four download sources were dead:
 *   - plugins/download/apk.js        APKPure v2 API -> 404      (now Aptoide ws75.aptoide.com)
 *   - plugins/download/fb.js:56      fdownloader userverify -> 404/403 (now v3 ajaxSearch POST)
 *   - plugins/download/مانهوا.js     MangaDex -> bot-verification HTML instead of JSON
 *   - plugins/download/تطبيق.js      document send with no size cap / timeout
 *   - plugins/download/tiktok.js:54  unguarded ssstik call
 *
 * These cases assert the VALUE (not the presence of a log line):
 *  - "download guards": every one of the five plugins turns a HUNG fetch into the Arabic
 *    "تعذر الاتصال" message (and never hangs), and an HTML body (200 + error page) into the
 *    Arabic "محمي حالياً" message instead of a JSON parse error thrown out of the handler
 *  - happy paths assert the DATA that reaches WhatsApp (apk link / video url / manga title)
 *  - malformed input never crashes a handler
 *  - a static scan proves the dead endpoints are gone and every guarded file kept its
 *    timeout + size cap + Arabic messages
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const manhwaPlugin = (await load('#U0645#U0627#U0646#U0647#U0648#U0627.js')).default;
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

function mockResponse({ status = 200, body = '', headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => lower[String(key).toLowerCase()] ?? null },
    text: async () => body
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

const CHALLENGE_HTML = `<!doctype html><html><head><title>Just a moment...</title></head>
<body><div id="challenge">Checking your browser before accessing.</div></body></html>`;

const MANGA_CHALLENGE_HTML = `<!doctype html><html lang="en"><head>
<title>MangaDex - Browser verification...</title></head>
<body><noscript>Please enable JavaScript and cookies to continue to MangaDex.</noscript></body></html>`;

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

const MANGA_JSON = JSON.stringify({
  result: 'ok',
  response: 'collection',
  data: [
    {
      id: 'ade0306c-f4b6-4890-9edb-1ddf04df2039',
      type: 'manga',
      attributes: {
        title: { en: 'Solo Leveling' },
        status: 'ongoing',
        year: 2018,
        availableTranslatedLanguages: ['ar', 'en'],
        description: { en: 'A hunter becomes the strongest.' }
      },
      relationships: [{ type: 'cover_art', attributes: { fileName: 'cover.jpg' } }]
    }
  ]
});

const FDL_RESULT_HTML = `<!doctype html><html><body>
<div class="detail"><h3>Facebook Video</h3><p>00:30</p><div class="thumbnail"><img src="https://cdn.fdownloader.net/t.jpg"></div></div>
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

/* ------------------------------------------------------------------ *
 * 1. "download guards" — a hung fetch must become an Arabic message
 * ------------------------------------------------------------------ */

async function runHung(run) {
  const h = harness();
  installFetch(HANG);
  const started = Date.now();
  try {
    await run(h);
  } finally {
    restoreFetch();
  }
  return { h, elapsed: Date.now() - started };
}

test('download guards: apk — a hung fetch becomes the Arabic "تعذر الاتصال" message', async () => {
  const { h, elapsed } = await runHung((hh) =>
    apkPlugin(hh.m, { conn: hh.conn, text: 'instagram', command: 'apk' })
  );
  assert.match(allText(h), /تعذر الاتصال/);
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0, 'no broken file may be sent');
});

test('download guards: تطبيق — a hung fetch becomes the Arabic "تعذر الاتصال" message', async () => {
  const { h, elapsed } = await runHung((hh) =>
    applyPlugin(hh.m, { conn: hh.conn, text: 'instagram', command: 'تطبيق' })
  );
  assert.match(allText(h), /تعذر الاتصال/);
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0, 'no broken file may be sent');
});

test('download guards: fb — a hung fetch becomes the Arabic "تعذر الاتصال" message', async () => {
  const { h, elapsed } = await runHung((hh) =>
    fbPlugin(hh.m, { conn: hh.conn, text: 'https://fb.watch/x', command: 'fb', usedPrefix: '.' })
  );
  assert.match(allText(h), /تعذر الاتصال/);
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
  assert.equal(h.sent.filter((s) => s.content?.video).length, 0, 'no broken file may be sent');
});

test('download guards: مانهوا — a hung fetch becomes the Arabic "تعذر الاتصال" message', async () => {
  const { h, elapsed } = await runHung((hh) =>
    manhwaPlugin(hh.m, { conn: hh.conn, text: 'solo leveling', command: 'مانهوا', usedPrefix: '.' })
  );
  assert.match(allText(h), /تعذر الاتصال/);
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
});

test('download guards: tiktok — a hung fetch becomes the Arabic "تعذر الاتصال" message', async () => {
  const { h, elapsed } = await runHung((hh) =>
    tiktokPlugin(hh.m, { conn: hh.conn, text: 'https://www.tiktok.com/@u/video/1', command: 'تيك' })
  );
  assert.match(allText(h), /تعذر الاتصال/);
  assert.ok(elapsed < 15000, `the handler must not hang (took ${elapsed}ms)`);
  assert.equal(h.sent.filter((s) => s.content?.video).length, 0, 'no broken file may be sent');
});

/* ------------------------------------------------------------------ *
 * 2. "download guards" — a 200 with an HTML error body is NOT success
 * ------------------------------------------------------------------ */

test('download guards: apk — an HTML body instead of JSON becomes "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: CHALLENGE_HTML }));
  try {
    await apkPlugin(h.m, { conn: h.conn, text: 'instagram', command: 'apk' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.doesNotMatch(allText(h), /JSON|Unexpected token/i);
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0);
});

test('download guards: تطبيق — an HTML body instead of JSON becomes "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: CHALLENGE_HTML }));
  try {
    await applyPlugin(h.m, { conn: h.conn, text: 'instagram', command: 'تطبيق' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.equal(h.sent.filter((s) => s.content?.document).length, 0);
});

test('download guards: fb — an HTML challenge page becomes "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: CHALLENGE_HTML }));
  try {
    await fbPlugin(h.m, { conn: h.conn, text: 'https://fb.watch/x', command: 'fb', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.equal(h.sent.filter((s) => s.content?.video).length, 0);
});

test('download guards: مانهوا — the MangaDex verification page becomes "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: MANGA_CHALLENGE_HTML }));
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'solo leveling', command: 'مانهوا', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.equal(h.sent.filter((s) => s.content?.buttons).length, 0, 'no menu may be sent for a protected source');
});

test('download guards: tiktok — an HTML challenge page becomes "المصدر محمي حالياً"', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: CHALLENGE_HTML }));
  try {
    await tiktokPlugin(h.m, { conn: h.conn, text: 'https://www.tiktok.com/@u/video/1', command: 'تيك' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً/);
  assert.equal(h.sent.filter((s) => s.content?.video).length, 0);
});

/* ------------------------------------------------------------------ *
 * 3. happy paths — the DATA must reach WhatsApp
 * ------------------------------------------------------------------ */

test('download guards: apk — a live-shaped Aptoide payload produces the real apk link', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: APTOIDE_JSON }));
  try {
    await apkPlugin(h.m, { conn: h.conn, text: 'instagram', command: 'apk' });
  } finally {
    restoreFetch();
  }
  const docs = h.sent.filter((s) => s.content?.document);
  assert.equal(docs.length, 1, 'exactly one apk must be sent');
  assert.equal(docs[0].content.document.url, 'https://pool.apk.aptoide.com/store/com-instagram-android.apk');
  assert.equal(docs[0].content.fileName, 'Instagram.apk');
  const caption = h.sent.map((s) => s.content?.caption ?? '').join('\n');
  assert.match(caption, /Instagram/);
  assert.match(caption, /com\.instagram\.android/);
  assert.match(caption, /452\.1\.0\.53\.64/);
});

test('download guards: تطبيق — a live-shaped Aptoide payload produces the real apk link', async () => {
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
  const caption = h.sent.map((s) => s.content?.caption ?? '').join('\n');
  assert.match(caption, /com\.instagram\.android/);
});

test('download guards: fb — the v3 ajaxSearch payload produces the real video url', async () => {
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
  assert.equal(videos.length, 1, 'exactly one video must be sent');
  assert.equal(videos[0].content.video.url, 'https://cdn.fdownloader.net/dl/video.mp4');
  assert.match(videos[0].content.caption, /Tester/);
});

test('download guards: مانهوا — a MangaDex payload produces the real manga title', async () => {
  const h = harness();
  installFetch(async (url) => {
    if (url.includes('/manga?')) return mockResponse({ status: 200, body: MANGA_JSON });
    return mockResponse({ status: 404, body: '{}' });
  });
  try {
    await manhwaPlugin(h.m, { conn: h.conn, text: 'solo leveling', command: 'مانهوا', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  const menus = h.sent.filter((s) => s.content?.buttons);
  assert.equal(menus.length, 1, 'the chapter menu must be sent');
  assert.match(menus[0].content.caption, /تم العثور على:\* 1 نتيجة/);
  const rows = menus[0].content.buttons[0].params.sections[0].rows;
  assert.equal(rows.length, 1);
  assert.match(rows[0].title, /Solo Leveling/);
  assert.match(rows[0].id, /عرض_مانهوا ade0306c-f4b6-4890-9edb-1ddf04df2039/);
});

test('download guards: tiktok — an ssstik payload produces the real video url', async () => {
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
  assert.match(videos[0].content.caption, /A nice description/);
  const audios = h.sent.filter((s) => s.content?.audio);
  assert.equal(audios.length, 1);
  assert.equal(audios[0].content.audio.url, 'https://tikcdn.io/music/456');
});

/* ------------------------------------------------------------------ *
 * 4. malformed input must never crash a handler
 * ------------------------------------------------------------------ */

test('download guards: a garbage query answers in Arabic instead of crashing', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: JSON.stringify({ datalist: { list: [] } }) }));
  try {
    await apkPlugin(h.m, { conn: h.conn, text: '!!!@@@### زقزقة', command: 'apk' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /لم يتم العثور على التطبيق/);
});

test('download guards: an empty query asks for the usage instead of calling the network', async () => {
  const h = harness();
  let called = false;
  installFetch(async () => {
    called = true;
    return mockResponse({ status: 200, body: APTOIDE_JSON });
  });
  try {
    await apkPlugin(h.m, { conn: h.conn, text: '   ', command: 'apk' });
  } finally {
    restoreFetch();
  }
  assert.equal(called, false, 'no request may be sent without a query');
  assert.match(allText(h), /يرجى كتابة اسم التطبيق/);
});

test('download guards: a malformed facebook link answers in Arabic instead of crashing', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: '<html><body>not a result page</body></html>' }));
  try {
    await fbPlugin(h.m, { conn: h.conn, text: 'لست رابطاً', command: 'fb', usedPrefix: '.' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً|تعذر الاتصال/);
  assert.equal(h.sent.filter((s) => s.content?.video).length, 0);
});

test('download guards: a malformed tiktok link answers in Arabic instead of crashing', async () => {
  const h = harness();
  installFetch(async () => mockResponse({ status: 200, body: '<html><body>nothing here</body></html>' }));
  try {
    await tiktokPlugin(h.m, { conn: h.conn, text: 'لست رابطاً', command: 'تيك' });
  } finally {
    restoreFetch();
  }
  assert.match(allText(h), /محمي حالياً|تعذر الاتصال|لم يتم العثور/);
});

/* ------------------------------------------------------------------ *
 * 5. static invariants — the dead endpoints are gone, the guards are there
 * ------------------------------------------------------------------ */

const read = (file) => readFileSync(path.join(DL, file), 'utf8');

test('download guards: the dead endpoints are gone from the five plugins', () => {
  assert.doesNotMatch(read(FILES.apk), /apkpure\.com/i, 'APKPure v2 (404) must be gone');
  assert.doesNotMatch(read(FILES.fb), /api\/userverify/i, 'fdownloader userverify (404) must be gone');
  assert.doesNotMatch(read(FILES.fb), /axios/i, 'no unguarded HTTP client may be left');
  assert.doesNotMatch(read(FILES.tiktok), /axios/i);
  assert.doesNotMatch(read(FILES.apply), /axios/i);
});

test('download guards: every guarded plugin keeps a timeout, a size cap and the Arabic messages', () => {
  for (const [name, file] of Object.entries(FILES)) {
    const src = read(file);
    assert.match(src, /AbortController/, `${name}: must abort the request after a timeout`);
    assert.match(src, /MAX_[A-Z_]*BYTES/, `${name}: must keep a size cap`);
    assert.match(src, /تعذر الاتصال/, `${name}: must report "تعذر الاتصال"`);
    assert.match(src, /محمي حالياً/, `${name}: must report "محمي حالياً"`);
    assert.match(src, /catch/, `${name}: must catch the upstream failures`);
  }
});

test('download guards: the repaired sources are the verified-alive endpoints', () => {
  assert.match(read(FILES.apk), /ws75\.aptoide\.com/);
  assert.match(read(FILES.apply), /ws75\.aptoide\.com/);
  assert.match(read(FILES.fb), /v3\.fdownloader\.net\/api\/ajaxSearch/);
  assert.match(read(FILES.manhwa), /api\.mangadex\.org/);
});
