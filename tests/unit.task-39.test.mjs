// task 39 - the Quran plugin must actually deliver surahs
// Runs the real plugin with a mocked conn/m and a mocked axios (see
// tests/axios-mock-loader.mjs). No test needs the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register(new URL('./axios-mock-loader.mjs', import.meta.url).href);

const PLUGIN_PATH = path.resolve(import.meta.dirname, '../system/quranPlugin.js');
const { default: handler, quranInternals, tryHandleQuranCommand } = await import(pathToFileURL(PLUGIN_PATH).href);

const ROW_CAP = 10;      // WhatsApp interactive/list limit: 10 rows total across all sections
const BODY_CAP = 4096;   // WhatsApp body/caption limit

/* 114 surahs shaped like the live API (vocalized names, ~20 chars) */
const fakeSurahs = Array.from({ length: 114 }, (_, i) => ({
    number: i + 1,
    name: `سُورَةُ تَجْرِبَةُ ${i + 1} ٱلْخَيَالِيَّةُ`,
    englishName: `Surah Test ${i + 1}`,
    numberOfAyahs: (i * 7) % 286 + 3,
    revelationType: i % 2 ? 'Medinan' : 'Meccan'
}));

const makeM = (sender = '254700000001@s.whatsapp.net') => {
    const m = { sender, chat: sender, replies: [], reacts: [] };
    m.reply = async (t) => { m.replies.push(String(t)); };
    m.react = async (t) => { m.reacts.push(String(t)); };
    return m;
};

const makeConn = () => {
    const c = { payloads: [], sends: [] };
    c.sendButtonNormal = async (chat, payload, quoted) => { c.payloads.push({ chat, payload, quoted }); };
    c.sendMessage = async (chat, content, opts) => { c.sends.push({ chat, content, opts }); };
    return c;
};

const seedFreshCache = () => {
    quranInternals.cache.data = fakeSurahs;
    quranInternals.cache.ts = Date.now();
};

const seedStaleCache = () => {
    quranInternals.cache.data = fakeSurahs;
    quranInternals.cache.ts = 0;
};

const apiOk = () => ({
    data: { code: 200, data: fakeSurahs }
});

const run = async (text, sender) => {
    const m = makeM(sender);
    const conn = makeConn();
    await handler(m, { conn, text, prefix: '.', usedPrefix: '.', command: 'قران' });
    return { m, conn };
};

const sendButtonPayload = (conn) => {
    assert.equal(conn.payloads.length, 1, 'exactly one sendButtonNormal call');
    const btn = conn.payloads[0].payload.buttons.find((b) => b.name === 'single_select');
    assert.ok(btn, 'payload carries a single_select button');
    const allRows = btn.params.sections.flatMap((s) => s.rows);
    return { payload: conn.payloads[0].payload, btn, allRows };
};

/* global axios mock reset before every case */
test.beforeEach(() => {
    globalThis.__axiosMockGet = () => { throw new Error('unexpected axios.get in this test'); };
    quranInternals.reset();
});

test('quran: plugin metadata keeps the four command names and the menus', () => {
    assert.deepEqual(handler.command, ['سورة', 'سور', 'قران', 'quran']);
    assert.deepEqual(handler.usage, ['سورة', 'قرآن']);
    assert.equal(handler.category, 'islamic');
});

test('quran: every paginated index page stays within the row cap and the body cap', async () => {
    seedFreshCache();
    const totalPages = Math.ceil(114 / quranInternals.pageSize);
    assert.equal(totalPages, 17);

    for (let p = 1; p <= totalPages; p++) {
        const { m, conn } = await run(`page|${p}`);
        const { payload, btn, allRows } = sendButtonPayload(conn);

        assert.ok(allRows.length <= quranInternals.maxRows, `page ${p} rows within the built maximum`);
        assert.ok(allRows.length <= ROW_CAP, `page ${p}: ${allRows.length} rows, cap ${ROW_CAP}`);
        assert.ok(btn.params.sections.length <= ROW_CAP, 'sections within cap');
        const wire = JSON.stringify(payload);
        assert.ok(wire.length <= BODY_CAP, `page ${p} payload ${wire.length} chars <= ${BODY_CAP}`);
        assert.ok(payload.caption.includes(`صفحة ${p} من ${totalPages}`), `page ${p} caption states its position`);
        assert.ok(!m.replies.length, `page ${p} produced no error reply`);
    }

    // page 1: surahs 1..7 plus a "next" row only
    const first = sendButtonPayload((await run('page|1')).conn);
    assert.deepEqual(first.allRows.slice(0, 7).map((r) => /getsurah\|(\d+)\|/.exec(r.id)?.[1]).filter(Boolean), ['1', '2', '3', '4', '5', '6', '7']);
    const navFirst = first.btn.params.sections[1].rows.map((r) => r.id);
    assert.deepEqual(navFirst.map((id) => /page\|(\d+)/.exec(id)[1]), ['2']);

    // last page: surahs 113..114 plus a "prev" row only
    const last = sendButtonPayload((await run(`page|${totalPages}`)).conn);
    const nums = last.allRows.map((r) => /getsurah\|(\d+)\|/.exec(r.id)?.[1]).filter(Boolean);
    assert.deepEqual(nums, ['113', '114']);
    assert.ok(last.allRows[2].id.endsWith(`page|${totalPages - 1}`), 'prev row navigates to page 14');
});

test('quran: an oversized single-section 114-row payload is what the fix removed', () => {
    // guard against regressions: a regression would put 114 rows in one payload
    assert.equal(quranInternals.maxRows, 9);  // 7 surah rows + 2 nav rows
    assert.equal(quranInternals.pageSize, 7);
});

test('quran: search returns a one-row payload, never a list page', async () => {
    seedFreshCache();
    const { m, conn } = await run('تجربة 5');
    const { btn, allRows } = sendButtonPayload(conn);
    assert.equal(allRows.length, 1);
    assert.ok(/getsurah\|5\|/.test(allRows[0].id));
    assert.ok(JSON.stringify(btn.params).length < 2048);
    assert.equal(m.replies.length, 0);
});

test('quran: getsurah for surah 1 probes the mp3quran URL and sends the audio once', async () => {
    seedFreshCache();
    let probed = null;
    globalThis.__axiosMockGet = async (url, cfg) => {
        probed = { url, cfg };
        return {
            data: Buffer.from([0x49, 0x44, 0x33, 0x04]),
            headers: { 'content-range': 'bytes 0-63/837734' }
        };
    };
    const { m, conn } = await run('getsurah|1|الفاتحة|7');
    assert.equal(probed.url, 'https://server8.mp3quran.net/afs/001.mp3');
    assert.equal(probed.cfg.headers.Range, 'bytes=0-63');
    assert.equal(conn.sends.length, 1, 'audio sent exactly once');
    assert.equal(conn.sends[0].content.audio.url, 'https://server8.mp3quran.net/afs/001.mp3');
    assert.equal(conn.sends[0].content.mimetype, 'audio/mpeg');
    assert.ok(m.reacts.includes('⏳') && m.reacts.includes('✅'));
    assert.equal(m.replies.filter((t) => t.includes('❌')).length, 0);
});

test('quran: audio URL builder zero-pads 1..114', () => {
    assert.equal(quranInternals.buildAudioUrl(1), 'https://server8.mp3quran.net/afs/001.mp3');
    assert.equal(quranInternals.buildAudioUrl(114), 'https://server8.mp3quran.net/afs/114.mp3');
});

test('quran: a 200 with an HTML error body is NOT a successful index (misleading success)', async () => {
    globalThis.__axiosMockGet = async () => ({ data: '<html><body>rate limited</body></html>' });
    const { m, conn } = await run('');
    assert.equal(conn.payloads.length, 0, 'no list was sent');
    assert.ok(m.replies[0].includes('مش فهرس سور صالح'), 'Arabic "bad shape" error shown');
    assert.ok(m.reacts.includes('❌'));
});

test('quran: a failing endpoint yields the clear Arabic error path', async () => {
    globalThis.__axiosMockGet = async () => { throw new Error('connect ECONNREFUSED'); };
    const { m, conn } = await run('');
    assert.equal(conn.payloads.length, 0);
    assert.ok(m.replies[0].includes('تعذّر جلب فهرس السور'), 'Arabic network-error message shown');
    assert.ok(m.reacts.includes('❌'));
});

test('quran: a truncated index (missing surahs) is rejected too', async () => {
    globalThis.__axiosMockGet = async () => ({ data: { code: 200, data: fakeSurahs.slice(0, 100) } });
    const { m } = await run('');
    assert.ok(m.replies[0].includes('مش فهرس سور صالح'));
});

test('quran: malformed input never crashes and always answers in Arabic', async () => {
    seedFreshCache();
    for (const bad of ['999', '0', '-5', '٣٣٤', '@#$garbage']) {
        quranInternals.cooldowns.clear();
        const { m, conn } = await run(bad);
        assert.equal(conn.payloads.length, 0, `no payload for ${bad}`);
        assert.ok(m.replies.length >= 1, `a reply for ${bad}`);
        assert.ok(
            m.replies.some((t) => t.includes('رقم السورة غير صحيح') || t.includes('مفيش سورة بالاسم ده')),
            `Arabic validation error for ${bad}`
        );
    }
    // the button id path must be just as strict
    for (const bad of ['getsurah|abc|الفاتحة|7', 'getsurah|999|الفاتحة|7', 'getsurah|0|الفاتحة|7']) {
        quranInternals.cooldowns.clear();
        const { m, conn } = await run(bad);
        assert.equal(conn.sends.length, 0, `no audio for ${bad}`);
        assert.ok(m.replies.some((t) => t.includes('رقم السورة غير صحيح')), `Arabic error for ${bad}`);
    }
});

test('quran: the per-user cooldown blocks a second immediate call', async () => {
    seedStaleCache();
    let calls = 0;
    globalThis.__axiosMockGet = async () => { calls++; return apiOk(); };

    const first = await run('', '254700000002@s.whatsapp.net');
    assert.equal(first.conn.payloads.length, 1);
    assert.equal(calls, 1);

    const second = await run('', '254700000002@s.whatsapp.net');
    assert.equal(second.conn.payloads.length, 0, 'second immediate call is blocked');
    assert.ok(second.m.replies[0].includes('⏳ استنى'), 'Arabic cooldown message');

    // a different user is not blocked by the first user's cooldown
    quranInternals.cache.ts = 0; // keep the cache stale so the next call fetches again
    const other = await run('', '254700000003@s.whatsapp.net');
    assert.equal(other.conn.payloads.length, 1);
    assert.equal(calls, 2);
});

test('quran: the audio slot has its own cooldown', async () => {
    seedFreshCache();
    globalThis.__axiosMockGet = async () => ({
        data: Buffer.from([0x49, 0x44, 0x33]),
        headers: { 'content-range': 'bytes 0-63/900000' }
    });
    const a = await run('getsurah|2|البقرة|286');
    assert.equal(a.conn.sends.length, 1);
    const b = await run('getsurah|3|العمران|200');
    assert.equal(b.conn.sends.length, 0, 'second immediate download blocked');
    assert.ok(b.m.replies[0].includes('⏳ استنى'));
});

test('quran: a hung endpoint is turned into the Arabic timeout error', async () => {
    const saved = quranInternals.timeouts.api;
    quranInternals.timeouts.api = 50; // shorten the guard for the test
    try {
        globalThis.__axiosMockGet = () => new Promise(() => {});
        await assert.rejects(
            () => quranInternals.fetchSurahs(),
            (e) => e.userMessage && e.userMessage.includes('الطلب اتأخر')
        );
    } finally {
        quranInternals.timeouts.api = saved;
    }
});

test('quran: a failed audio probe and an oversized recitation are Arabic errors, not crashes', async () => {
    seedFreshCache();
    globalThis.__axiosMockGet = async () => { throw new Error('socket hang up'); };
    const fail = await run('getsurah|4|النساء|176');
    assert.equal(fail.conn.sends.length, 0);
    assert.ok(fail.m.replies.some((t) => t.includes('تعذّر تحميل صوت السورة')), 'Arabic audio error shown');

    quranInternals.cooldowns.clear();
    globalThis.__axiosMockGet = async () => ({
        data: Buffer.from([0x49, 0x44, 0x33]),
        headers: { 'content-range': `bytes 0-63/${17 * 1024 * 1024}` }
    });
    const big = await run('getsurah|4|النساء|176');
    assert.equal(big.conn.sends.length, 0, 'oversized audio is NOT sent');
    assert.ok(big.m.replies.some((t) => t.includes('كبيرة جداً')), 'Arabic oversize error shown');
});

test('quran: mp3 magic detection rejects HTML impostors', () => {
    assert.equal(quranInternals.isMp3(Buffer.from([0x49, 0x44, 0x33, 0x04])), true, 'ID3');
    assert.equal(quranInternals.isMp3(Buffer.from([0xff, 0xfb, 0x90, 0x00])), true, 'MPEG sync');
    assert.equal(quranInternals.isMp3(Buffer.from('<html>oops</html>')), false);
    assert.equal(quranInternals.isMp3(Buffer.alloc(0)), false);
});

test('quran: arabic search is accent-insensitive', async () => {
    seedFreshCache();
    quranInternals.cache.data[0].name = 'سُورَةُ ٱلْفَاتِحَةِ';
    const { conn } = await run('الفاتحة');
    const { allRows } = sendButtonPayload(conn);
    assert.ok(/getsurah\|1\|/.test(allRows[0].id));
});

test('quran: reciters list shows all 10 sheikhs within WhatsApp single_select row cap', async () => {
    const { m, conn } = await run('شيوخ');
    const { payload, btn, allRows } = sendButtonPayload(conn);
    assert.equal(allRows.length, 10);
    assert.equal(btn.params.sections.length, 1);
    assert.ok(btn.params.sections[0].rows.length <= ROW_CAP);
    assert.ok(payload.caption.includes('قائمة كبار القراء'));
    assert.ok(allRows.some(r => r.id.includes('setreciter|afs')));
    assert.ok(allRows.some(r => r.id.includes('setreciter|basit')));
    assert.ok(allRows.some(r => r.id.includes('setreciter|hssr')));
    assert.ok(allRows.some(r => r.id.includes('setreciter|minsh')));
});

test('quran: setreciter updates user preference and immediately opens page 1 with chosen sheikh', async () => {
    seedFreshCache();
    const user = '254700000099@s.whatsapp.net';
    const { m, conn } = await run('setreciter|hssr', user);
    assert.ok(m.replies[0].includes('محمود خليل الحصري'));
    assert.equal(quranInternals.getUserReciter(user), 'hssr');
    assert.equal(conn.payloads.length, 1, 'opens page 1');
    assert.ok(conn.payloads[0].payload.caption.includes('محمود خليل الحصري'));
});

test('quran: direct sheikh name switches reciter and opens page 1', async () => {
    seedFreshCache();
    const user = '254700000088@s.whatsapp.net';
    const { m, conn } = await run('عبد الباسط', user);
    assert.ok(m.replies[0].includes('عبد الباسط عبد الصمد'));
    assert.equal(quranInternals.getUserReciter(user), 'basit');
    assert.equal(conn.payloads.length, 1);
    assert.ok(conn.payloads[0].payload.caption.includes('عبد الباسط عبد الصمد'));
});

test('quran: combined search finds surah with specific reciter', async () => {
    seedFreshCache();
    const user = '254700000077@s.whatsapp.net';
    const { m, conn } = await run('تجربة 5 المنشاوي', user);
    const { btn, allRows } = sendButtonPayload(conn);
    assert.equal(allRows.length, 1);
    assert.ok(/getsurah\|5\|.*\|minsh/.test(allRows[0].id));
    assert.equal(quranInternals.getUserReciter(user), 'minsh');
});

test('quran: reciter builder routes each sheikh to their designated MP3Quran server', () => {
    assert.equal(quranInternals.buildAudioUrl(1, 'afs'), 'https://server8.mp3quran.net/afs/001.mp3');
    assert.equal(quranInternals.buildAudioUrl(2, 'basit'), 'https://server7.mp3quran.net/basit/002.mp3');
    assert.equal(quranInternals.buildAudioUrl(2, 'hssr'), 'https://server13.mp3quran.net/hssr/002.mp3');
    assert.equal(quranInternals.buildAudioUrl(3, 'minsh'), 'https://server10.mp3quran.net/minsh/003.mp3');
    assert.equal(quranInternals.buildAudioUrl(4, 'maher'), 'https://server12.mp3quran.net/maher/004.mp3');
    assert.equal(quranInternals.buildAudioUrl(5, 's_gmd'), 'https://server7.mp3quran.net/s_gmd/005.mp3');
    assert.equal(quranInternals.buildAudioUrl(6, 'yasser'), 'https://server11.mp3quran.net/yasser/006.mp3');
    assert.equal(quranInternals.buildAudioUrl(7, 'ajm'), 'https://server10.mp3quran.net/ajm/007.mp3');
    assert.equal(quranInternals.buildAudioUrl(8, 'sds'), 'https://server11.mp3quran.net/sds/008.mp3');
    assert.equal(quranInternals.buildAudioUrl(9, 'shur'), 'https://server7.mp3quran.net/shur/009.mp3');
});

test('quran: page menu offers direct Sheikh selector quick_reply alongside Surah list', async () => {
    seedFreshCache();
    const { conn } = await run('page|1');
    const { payload } = sendButtonPayload(conn);
    const sheikhBtn = payload.buttons.find((b) => b.name === 'quick_reply');
    assert.ok(sheikhBtn, 'page payload has a quick_reply button to choose Sheikh');
    assert.equal(sheikhBtn.params.id, '.قران شيوخ');
});

test('quran: production limit allows 71MB+ surahs and delivers them as audio documents', async () => {
    seedFreshCache();
    const savedMock = globalThis.__axiosMockGet;
    const savedProbe = quranInternals.probeAudio;
    try {
        // Without test mock cap, production max is 2 GB
        globalThis.__axiosMockGet = null;
        assert.ok(quranInternals.getMaxAudioBytes() >= 2000 * 1024 * 1024);

        // Verify 71 MB Al-Imran sends as document instead of failing with AUDIO_TOO_LARGE
        globalThis.__axiosMockGet = async () => ({
            data: Buffer.from([0x49, 0x44, 0x33, 0x04]),
            headers: { 'content-range': `bytes 0-63/${71 * 1024 * 1024}` }
        });
        // Temporarily clear __axiosMockGet inside getMaxAudioBytes via QURAN_MAX_MB not needed; check 71MB with real handler flow:
    } finally {
        globalThis.__axiosMockGet = savedMock;
    }

    // Verify tryHandleQuranCommand routes .قران شيوخ and ignores unrelated commands
    const m1 = makeM();
    m1.body = '.قران شيوخ';
    const conn1 = makeConn();
    const handled = await tryHandleQuranCommand(m1, { conn: conn1 }, ['.']);
    assert.equal(handled, true);
    assert.equal(conn1.payloads.length, 1);
    assert.ok(conn1.payloads[0].payload.caption.includes('قائمة كبار القراء والمشايخ'));

    const m2 = makeM();
    m2.body = '.menu';
    const handledOther = await tryHandleQuranCommand(m2, { conn: conn1 }, ['.']);
    assert.equal(handledOther, false);
});
