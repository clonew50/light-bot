// ─── plugins/quran.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Holy Quran Plugin 🕋

import axios from 'axios';

const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";
const QURAN_COVER = 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg';

const SURAH_API = 'https://api.alquran.cloud/v1/surah';
const AUDIO_BASE = 'https://server8.mp3quran.net/afs';

const TOTAL_SURAHS = 114;

/*
 * WhatsApp interactive/list messages accept at most 10 rows per message
 * (all sections combined - Meta's published limit), so the index is paginated:
 * a page carries PAGE_SIZE surah rows + at most 2 navigation rows = 9 rows,
 * one row of headroom under the 10-row cap.
 */
const PAGE_SIZE = 7;
const MAX_ROWS_PER_PAYLOAD = PAGE_SIZE + 2; // 9 rows, under WhatsApp's 10-row cap

/* WhatsApp refuses media bigger than 16 MB - checked before we send. */
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

const API_TIMEOUT_MS = 15000;
const AUDIO_TIMEOUT_MS = 20000;
const SEND_TIMEOUT_MS = 60000;
const COOLDOWN_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const ERR_API = `${HEADER}\n❌ *تعذّر جلب فهرس السور من المصدر.*\n🔄 استنى شوية وجرّب تاني.\n${HEADER}`;
const ERR_API_FORMAT = `${HEADER}\n❌ *رد المصدر مش فهرس سور صالح.*\n🔄 استنى شوية وجرّب تاني.\n${HEADER}`;
const ERR_AUDIO = `${HEADER}\n❌ *تعذّر تحميل صوت السورة من المصدر.*\n🔄 استنى شوية وجرّب تاني.\n${HEADER}`;
const ERR_AUDIO_FORMAT = `${HEADER}\n❌ *الملف اللي رجع من المصدر مش صوت MP3 صالح.*\n🔄 جرّب سورة تانية.\n${HEADER}`;
const ERR_AUDIO_LARGE = (name, mb) => `${HEADER}\n❌ *سورة ${name} كبيرة جداً (${mb} ميجا) وإرسالها كصوت مش ممكن هنا.*\n🔄 جرّب سورة أقصر.\n${HEADER}`;
const ERR_NUMBER = `${HEADER}\n❌ *رقم السورة غير صحيح.*\n📌 الرقم لازم يكون من 1 لـ 114.\n${HEADER}`;
const ERR_NOT_FOUND = `${HEADER}\n❌ *مفيش سورة بالاسم ده.*\n📌 اكتب رقم السورة من 1 لـ 114.\n${HEADER}`;
const ERR_TIMEOUT = `${HEADER}\n❌ *الطلب اتأخر والرد مش وصل.*\n🔄 استنى شوية وجرّب تاني.\n${HEADER}`;

const cleanContext = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

/* an error that carries the Arabic text the user must actually see */
class QuranError extends Error {
    constructor(message, userMessage) {
        super(message);
        this.name = 'QuranError';
        this.userMessage = userMessage;
    }
}

/* timeouts are kept in one mutable object so a test can shorten them */
const timeouts = {
    api: API_TIMEOUT_MS,
    audio: AUDIO_TIMEOUT_MS,
    send: SEND_TIMEOUT_MS
};

/* the surah index is cached: paging through it must not hammer the API */
const surahCache = { data: null, ts: 0 };

/* per-user cooldown: sender -> { index: ts, audio: ts } */
const cooldowns = new Map();

const withTimeout = (promise, ms, label) => {
    let timer;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new QuranError(label, ERR_TIMEOUT)), ms);
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
};

const safeReply = async (m, body) => {
    try {
        await m.reply(body);
    } catch (e) {
        console.log('[quran] reply failed: ' + (e?.message || e));
    }
};

const safeReact = async (m, emoji) => {
    try {
        await m.react(emoji);
    } catch (e) {
        console.log('[quran] react failed: ' + (e?.message || e));
    }
};

/* strips the vocal marks so "الفاتحة" finds "سُورَةُ ٱلْفَاتِحَةِ" */
const normalizeArabic = (value) => String(value ?? '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/* a row id travels through the framework as plain text - keep it one line */
const cleanName = (value) => String(value ?? '')
    .replace(/[\\/|:*?"<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isFreshCache = () => Boolean(surahCache.data) && (Date.now() - surahCache.ts) < CACHE_TTL_MS;

const cooldownLeft = (sender, slot) => {
    const rec = cooldowns.get(sender);
    if (!rec) return 0;
    const left = COOLDOWN_MS - (Date.now() - (rec[slot] || 0));
    return left > 0 ? left : 0;
};

const markCooldown = (sender, slot) => {
    const rec = cooldowns.get(sender) || {};
    rec[slot] = Date.now();
    cooldowns.set(sender, rec);
};

const isMp3 = (buf) => {
    if (!buf || buf.length < 3) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;   // ID3
    return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;                      // MPEG frame sync
};

/*
 * the surah index - the response is validated, a 200 that carries an HTML body
 * (or a truncated list) is an error and never a "successful" index.
 */
const fetchSurahs = async () => {
    const res = await withTimeout(
        axios.get(SURAH_API, {
            timeout: timeouts.api,
            responseType: 'json',
            headers: { Accept: 'application/json' }
        }),
        timeouts.api + 2000,
        'API_TIMEOUT'
    );

    const body = res?.data;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new QuranError('API_BAD_SHAPE', ERR_API_FORMAT);
    }
    if (body.code !== 200 || !Array.isArray(body.data)) {
        throw new QuranError('API_BAD_SHAPE', ERR_API_FORMAT);
    }

    const surahs = body.data
        .filter((s) => s && Number.isInteger(Number(s.number)))
        .map((s) => ({
            number: Number(s.number),
            name: String(s.name ?? '').trim(),
            englishName: String(s.englishName ?? '').trim(),
            numberOfAyahs: Number(s.numberOfAyahs ?? 0),
            revelationType: String(s.revelationType ?? '')
        }))
        .filter((s) => s.number >= 1 && s.number <= TOTAL_SURAHS)
        .sort((a, b) => a.number - b.number);

    if (surahs.length !== TOTAL_SURAHS) {
        throw new QuranError('API_BAD_COUNT', ERR_API_FORMAT);
    }
    return surahs;
};

const getSurahs = async () => {
    if (isFreshCache()) return surahCache.data;
    const surahs = await fetchSurahs();
    surahCache.data = surahs;
    surahCache.ts = Date.now();
    return surahs;
};

/*
 * the audio source is probed before we send anything: a range request reads the
 * first bytes only, so we know it is real MP3 and know the real size.
 */
const probeAudio = async (url) => {
    const res = await withTimeout(
        axios.get(url, {
            timeout: timeouts.audio,
            responseType: 'arraybuffer',
            headers: { Range: 'bytes=0-63' },
            maxContentLength: 2 * 1024 * 1024,
            maxRedirects: 5,
            validateStatus: (status) => status === 200 || status === 206
        }),
        timeouts.audio + 2000,
        'AUDIO_TIMEOUT'
    );

    const bytes = Buffer.from(res?.data ?? []);
    const headers = res?.headers ?? {};
    const range = headers['content-range'];
    const total = range ? Number(String(range).split('/')[1]) : Number(headers['content-length'] ?? 0);
    return { bytes, total: Number.isFinite(total) ? total : 0 };
};

const buildAudioUrl = (surahNumber) => `${AUDIO_BASE}/${String(surahNumber).padStart(3, '0')}.mp3`;

const findSurah = (surahs, query) => {
    const q = String(query ?? '').trim();
    if (!q) return null;

    if (/^\d+$/.test(q)) {
        const number = Number(q);
        if (number < 1 || number > TOTAL_SURAHS) {
            throw new QuranError('SURAH_NUMBER_OUT_OF_RANGE', ERR_NUMBER);
        }
        return surahs.find((s) => s.number === number) || null;
    }

    const needle = normalizeArabic(q);
    if (!needle) return null;
    return surahs.find((s) => normalizeArabic(s.name) === needle)
        || surahs.find((s) => normalizeArabic(s.englishName) === needle)
        || surahs.find((s) => normalizeArabic(s.name).includes(needle))
        || surahs.find((s) => normalizeArabic(s.englishName).includes(needle))
        || null;
};

const surahRow = (prefix, command, surah) => ({
    title: `🕋 ${surah.number}. سورة ${surah.name}`,
    description: `عدد الآيات: ${surah.numberOfAyahs} | ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
    id: `${prefix}${command} getsurah|${surah.number}|${cleanName(surah.name)}|${surah.numberOfAyahs}`
});

const sendPage = async (m, conn, prefix, command, page, surahs) => {
    const list = surahs || await getSurahs();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    let current = Number(page);
    if (!Number.isInteger(current) || current < 1) current = 1;
    if (current > totalPages) current = totalPages;

    const start = (current - 1) * PAGE_SIZE;
    const rows = list.slice(start, start + PAGE_SIZE).map((s) => surahRow(prefix, command, s));

    const nav = [];
    if (current > 1) {
        nav.push({
            title: '◀️ الصفحة السابقة',
            description: `صفحة ${current - 1} من ${totalPages}`,
            id: `${prefix}${command} page|${current - 1}`
        });
    }
    if (current < totalPages) {
        nav.push({
            title: 'الصفحة التالية ▶️',
            description: `صفحة ${current + 1} من ${totalPages}`,
            id: `${prefix}${command} page|${current + 1}`
        });
    }

    const sections = [{ title: 'اختر السورة 📚', rows }];
    if (nav.length) sections.push({ title: 'التنقل بين الصفحات 🔄', rows: nav });

    const caption = `${HEADER}\n🕋 *المصحف الصوتي الكامل*\n\n` +
        `*_اختر السورة التي تريد تحميلها من القائمة 👇_*\n` +
        `*_القارئ: مشاري العفاسي 🎙️_*\n` +
        `📄 *صفحة ${current} من ${totalPages}*\n${HEADER}`;

    await conn.sendButtonNormal(m.chat, {
        media: { url: QURAN_COVER },
        mediaType: 'image',
        caption: caption,
        buttons: [{
            name: 'single_select',
            params: {
                title: '🍥 فهرس السور',
                sections: sections
            }
        }],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
};

const sendSearchResult = async (m, conn, prefix, command, surah) => {
    const rows = [{
        title: `سورة ${surah.name}`,
        description: `رقمها: ${surah.number} | آياتها: ${surah.numberOfAyahs}`,
        id: `${prefix}${command} getsurah|${surah.number}|${cleanName(surah.name)}|${surah.numberOfAyahs}`
    }];

    const sections = [{ title: 'النتائج 🕋', rows }];
    const caption = `${HEADER}\n🔍 *تم العثور على سورة:* ${surah.name} 🕌\n${HEADER}`;

    await conn.sendButtonNormal(m.chat, {
        media: { url: QURAN_COVER },
        mediaType: 'image',
        caption: caption,
        buttons: [{
            name: 'single_select',
            params: {
                title: '🍥 اضغط للتحميل',
                sections: sections
            }
        }],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
};

const sendSurah = async (m, conn, surahNumber, surahName, ayahsCount) => {
    const sender = m.sender || m.chat || 'unknown';

    const left = cooldownLeft(sender, 'audio');
    if (left > 0) {
        return safeReply(m, `⏳ استنى ${Math.ceil(left / 1000)} ثانية تانية قبل تحميل سورة تانية`);
    }
    markCooldown(sender, 'audio');

    await safeReact(m, '⏳');
    await safeReply(m, `${HEADER}\n🎙️ *جاري تحميل سورة:* ${surahName}\n📊 *عدد الآيات:* ${ayahsCount}\n📖 *القارئ:* مشاري العفاسي\n${HEADER}`);

    const audioUrl = buildAudioUrl(surahNumber);

    let probe;
    try {
        probe = await probeAudio(audioUrl);
    } catch (e) {
        if (e instanceof QuranError && e.userMessage) throw e;
        console.log('[quran] audio probe failed: ' + (e?.message || e));
        throw new QuranError('AUDIO_PROBE_FAILED', ERR_AUDIO);
    }

    if (!isMp3(probe.bytes)) throw new QuranError('AUDIO_NOT_MP3', ERR_AUDIO_FORMAT);
    if (probe.total > MAX_AUDIO_BYTES) {
        throw new QuranError('AUDIO_TOO_LARGE', ERR_AUDIO_LARGE(surahName, Math.round(probe.total / (1024 * 1024))));
    }

    try {
        await withTimeout(
            conn.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `سورة_${surahName}.mp3`,
                contextInfo: cleanContext(m.sender)
            }, { quoted: m }),
            timeouts.send,
            'SEND_TIMEOUT'
        );
    } catch (e) {
        if (e instanceof QuranError && e.userMessage) throw e;
        console.log('[quran] audio send failed: ' + (e?.message || e));
        throw new QuranError('AUDIO_SEND_FAILED', ERR_AUDIO);
    }

    await safeReact(m, '✅');
};

const handler = async (m, { conn, text, prefix, usedPrefix, command }) => {
    const pfx = (typeof prefix === 'string' && prefix) || (typeof usedPrefix === 'string' && usedPrefix) || '.';
    const cmd = (typeof command === 'string' && command) || 'قران';
    const raw = String(text ?? '').trim();
    const parts = raw ? raw.split('|') : [];
    const kind = (parts[0] || '').trim().toLowerCase();
    const sender = m.sender || m.chat || 'unknown';

    try {
        /* ─── المرحلة 2: تحميل وإرسال السورة ─── */
        if (kind === 'getsurah') {
            const surahNumber = Number(String(parts[1] ?? '').trim());
            if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > TOTAL_SURAHS) {
                return safeReply(m, ERR_NUMBER);
            }
            const surahName = cleanName(parts[2] || String(surahNumber));
            const ayahsCount = Number(parts[3]) || 0;
            return await sendSurah(m, conn, surahNumber, surahName, ayahsCount);
        }

        /* ─── المرحلة 1: الفهرس (صفحات) والبحث ─── */
        if (kind === 'page') {
            if (!isFreshCache()) {
                const left = cooldownLeft(sender, 'index');
                if (left > 0) {
                    return safeReply(m, `⏳ استنى ${Math.ceil(left / 1000)} ثانية تانية قبل طلب سورة جديدة`);
                }
                markCooldown(sender, 'index');
            }
            await safeReact(m, '🕋');
            return await sendPage(m, conn, pfx, cmd, String(parts[1] ?? '1').trim(), null);
        }

        const left = cooldownLeft(sender, 'index');
        if (left > 0) {
            return safeReply(m, `⏳ استنى ${Math.ceil(left / 1000)} ثانية تانية قبل طلب سورة جديدة`);
        }
        markCooldown(sender, 'index');

        await safeReact(m, '🕋');
        const surahs = await getSurahs();

        if (raw) {
            const found = findSurah(surahs, raw);
            if (!found) return safeReply(m, ERR_NOT_FOUND);
            return await sendSearchResult(m, conn, pfx, cmd, found);
        }

        return await sendPage(m, conn, pfx, cmd, 1, surahs);
    } catch (e) {
        console.log('[quran] ' + (e?.message || e));
        await safeReact(m, '❌');
        return safeReply(m, e?.userMessage || ERR_API);
    }
};

handler.usage = ["سورة", "قرآن"];
handler.category = "islamic";
handler.command = ["سورة", "سور", "قران", "quran"];

export const quranInternals = {
    timeouts,
    cache: surahCache,
    cooldowns,
    pageSize: PAGE_SIZE,
    maxRows: MAX_ROWS_PER_PAYLOAD,
    totalSurahs: TOTAL_SURAHS,
    cooldownMs: COOLDOWN_MS,
    cacheTtlMs: CACHE_TTL_MS,
    apiUrl: SURAH_API,
    audioBase: AUDIO_BASE,
    cover: QURAN_COVER,
    /* testable seams - the same functions the handler runs */
    fetchSurahs,
    getSurahs,
    probeAudio,
    buildAudioUrl,
    findSurah,
    withTimeout,
    isMp3,
    reset() {
        surahCache.data = null;
        surahCache.ts = 0;
        cooldowns.clear();
    }
};

export default handler;
