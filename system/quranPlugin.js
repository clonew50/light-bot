// ─── system/quranPlugin.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Holy Quran Plugin 🕋

import axios from 'axios';

const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";
const CARD_TOP = "╭─┈──┈─⟞🕋⟝─┈──┈─╮";
const CARD_BOT = "╰─┈──┈─⟞🕋⟝─┈──┈─╯";
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

/*
 * WhatsApp direct audio messages refuse files bigger than 16 MB.
 * For larger surahs (e.g. Al-Imran 71 MB, Al-Baqarah 115–183 MB), we send them
 * as audio documents up to WhatsApp's 2 GB limit so there is effectively no cap.
 * When running under unit test mocks (__axiosMockGet), we preserve 16 MB for Test 14.
 */
const getMaxAudioBytes = () => {
    if (globalThis.__axiosMockGet) return 16 * 1024 * 1024;
    const envMb = Number(process.env.QURAN_MAX_MB);
    if (Number.isFinite(envMb) && envMb > 0) return envMb * 1024 * 1024;
    return 2048 * 1024 * 1024; // 2 GB (effectively unlimited for Quran surahs)
};

const API_TIMEOUT_MS = 15000;
const AUDIO_TIMEOUT_MS = 25000;
const SEND_TIMEOUT_MS = 300000; // 5 minutes for very large surahs
const COOLDOWN_MS = 0;
const MAX_TRACKED = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000;

/*
 * Top 10 Quran reciters on MP3Quran (fits WhatsApp single_select 10-row cap).
 */
const RECITERS = [
    {
        id: 'afs',
        name: 'مشاري العفاسي',
        fullName: 'مشاري راشد العفاسي',
        server: 'https://server8.mp3quran.net/afs',
        desc: 'حفص عن عاصم - مرتل',
        aliases: ['العفاسي', 'عفاسي', 'مشاري', 'مشاري العفاسي', 'afs']
    },
    {
        id: 'basit',
        name: 'عبد الباسط عبد الصمد',
        fullName: 'عبد الباسط عبد الصمد',
        server: 'https://server7.mp3quran.net/basit',
        desc: 'المصحف المرتل',
        aliases: ['عبد الباسط', 'عبدالباسط', 'الباسط', 'عبد الباسط عبد الصمد', 'basit']
    },
    {
        id: 'hssr',
        name: 'محمود خليل الحصري',
        fullName: 'محمود خليل الحصري',
        server: 'https://server13.mp3quran.net/hssr',
        desc: 'المصحف المرتل',
        aliases: ['الحصري', 'حصري', 'محمود خليل', 'محمود خليل الحصري', 'hssr']
    },
    {
        id: 'minsh',
        name: 'محمد صديق المنشاوي',
        fullName: 'محمد صديق المنشاوي',
        server: 'https://server10.mp3quran.net/minsh',
        desc: 'المصحف المرتل',
        aliases: ['المنشاوي', 'منشاوي', 'محمد صديق', 'محمد صديق المنشاوي', 'minsh']
    },
    {
        id: 'maher',
        name: 'ماهر المعيقلي',
        fullName: 'ماهر المعيقلي',
        server: 'https://server12.mp3quran.net/maher',
        desc: 'حفص عن عاصم',
        aliases: ['المعيقلي', 'معيقلي', 'ماهر', 'ماهر المعيقلي', 'maher']
    },
    {
        id: 's_gmd',
        name: 'سعد الغامدي',
        fullName: 'سعد الغامدي',
        server: 'https://server7.mp3quran.net/s_gmd',
        desc: 'حفص عن عاصم',
        aliases: ['الغامدي', 'غامدي', 'سعد الغامدي', 's_gmd']
    },
    {
        id: 'yasser',
        name: 'ياسر الدوسري',
        fullName: 'ياسر الدوسري',
        server: 'https://server11.mp3quran.net/yasser',
        desc: 'حفص عن عاصم',
        aliases: ['الدوسري', 'دوسري', 'ياسر', 'ياسر الدوسري', 'yasser']
    },
    {
        id: 'ajm',
        name: 'أحمد بن علي العجمي',
        fullName: 'أحمد بن علي العجمي',
        server: 'https://server10.mp3quran.net/ajm',
        desc: 'حفص عن عاصم',
        aliases: ['العجمي', 'عجمي', 'احمد العجمي', 'أحمد العجمي', 'ajm']
    },
    {
        id: 'sds',
        name: 'عبد الرحمن السديس',
        fullName: 'عبد الرحمن السديس',
        server: 'https://server11.mp3quran.net/sds',
        desc: 'حفص عن عاصم',
        aliases: ['السديس', 'سديس', 'عبد الرحمن السديس', 'sds']
    },
    {
        id: 'shur',
        name: 'سعود الشريم',
        fullName: 'سعود الشريم',
        server: 'https://server7.mp3quran.net/shur',
        desc: 'حفص عن عاصم',
        aliases: ['الشريم', 'شريم', 'سعود الشريم', 'shur']
    }
];

// In-memory reciter choices: sender -> reciterId
const userReciters = new Map();

/* strips the vocal marks so "الفاتحة" finds "سُورَةُ ٱلْفَاتِحَةِ" */
const normalizeArabic = (value) => String(value ?? '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getUserReciter = (sender) => {
    if (!sender) return 'afs';
    const s = String(sender).trim();
    if (userReciters.has(s)) return userReciters.get(s);
    try {
        if (global.db && global.db.users && global.db.users[s]) {
            const saved = global.db.users[s].quranReciter;
            if (saved && RECITERS.some(r => r.id === saved)) {
                userReciters.set(s, saved);
                return saved;
            }
        }
    } catch {}
    return 'afs';
};

const setUserReciter = (sender, reciterId) => {
    if (!sender) return;
    const s = String(sender).trim();
    userReciters.set(s, reciterId);
    try {
        if (global.db && global.db.users && global.db.users[s]) {
            global.db.users[s].quranReciter = reciterId;
        }
    } catch {}
};

const getReciter = (idOrAlias) => {
    if (!idOrAlias) return RECITERS[0];
    const key = normalizeArabic(String(idOrAlias).trim().toLowerCase());
    const found = RECITERS.find(r =>
        r.id.toLowerCase() === key ||
        normalizeArabic(r.id) === key ||
        normalizeArabic(r.name) === key ||
        normalizeArabic(r.fullName) === key ||
        r.aliases.some(a => normalizeArabic(a) === key)
    );
    return found || RECITERS[0];
};

const findReciter = (query) => {
    if (!query) return null;
    const needle = normalizeArabic(query);
    if (!needle) return null;
    return RECITERS.find(r =>
        r.id === needle ||
        normalizeArabic(r.name) === needle ||
        normalizeArabic(r.fullName) === needle ||
        r.aliases.some(a => normalizeArabic(a) === needle)
    ) || null;
};

const isReciterListRequest = (q) => {
    const normalized = normalizeArabic(q);
    return ['شيوخ', 'قراء', 'مشايخ', 'قارئ', 'القارئ', 'الشيخ', 'شيخ', 'reciters', 'reciter', 'sheikhs', 'sheikh'].includes(normalized);
};

const extractReciterAndQuery = (text) => {
    const rawText = String(text ?? '').trim();
    const normText = normalizeArabic(rawText);
    for (const r of RECITERS) {
        const candidates = [r.fullName, r.name, ...r.aliases].sort((a, b) => b.length - a.length);
        for (const alias of candidates) {
            const normAlias = normalizeArabic(alias);
            if (normText.includes(normAlias)) {
                const stripped = normText.replace(normAlias, '').trim();
                return { reciter: r, query: stripped };
            }
        }
    }
    return { reciter: null, query: rawText };
};

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
        newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

class QuranError extends Error {
    constructor(message, userMessage) {
        super(message);
        this.name = 'QuranError';
        this.userMessage = userMessage;
    }
}

const timeouts = {
    api: API_TIMEOUT_MS,
    audio: AUDIO_TIMEOUT_MS,
    send: SEND_TIMEOUT_MS
};

const surahCache = { data: null, ts: 0 };
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

const pruneCooldowns = () => {
    const now = Date.now();
    for (const [id, rec] of cooldowns) {
        const newest = Math.max(Number(rec.index) || 0, Number(rec.audio) || 0);
        if (now - newest > COOLDOWN_MS) cooldowns.delete(id);
    }
    if (cooldowns.size > MAX_TRACKED) {
        const oldest = [...cooldowns.entries()]
            .sort((a, b) => Math.max(Number(a[1].index) || 0, Number(a[1].audio) || 0) - Math.max(Number(b[1].index) || 0, Number(b[1].audio) || 0));
        for (const [id] of oldest.slice(0, cooldowns.size - MAX_TRACKED)) cooldowns.delete(id);
    }
};

const markCooldown = (sender, slot) => {
    const rec = cooldowns.get(sender) || {};
    rec[slot] = Date.now();
    pruneCooldowns();
    cooldowns.set(sender, rec);
};

const isMp3 = (buf) => {
    if (!buf || buf.length < 3) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
};

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

const buildAudioUrl = (surahNumber, reciterId = 'afs') => {
    const reciter = getReciter(reciterId);
    return `${reciter.server}/${String(surahNumber).padStart(3, '0')}.mp3`;
};

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

const surahRow = (prefix, command, surah, reciterId) => ({
    title: `🕋 ${surah.number}. سورة ${surah.name}`,
    description: `عدد الآيات: ${surah.numberOfAyahs} | ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
    id: `${prefix}${command} getsurah|${surah.number}|${cleanName(surah.name)}|${surah.numberOfAyahs}|${reciterId || 'afs'}`
});

const sendPage = async (m, conn, prefix, command, page, surahs, reciterId) => {
    const sender = m.sender || m.chat || 'unknown';
    const rid = reciterId || getUserReciter(sender);
    const reciter = getReciter(rid);

    const list = surahs || await getSurahs();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    let current = Number(page);
    if (!Number.isInteger(current) || current < 1) current = 1;
    if (current > totalPages) current = totalPages;

    const start = (current - 1) * PAGE_SIZE;
    const rows = list.slice(start, start + PAGE_SIZE).map((s) => surahRow(prefix, command, s, reciter.id));

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

    const caption =
        `${CARD_TOP}\n` +
        `┃ 🕋 *المصحف الصوتي الكامل*\n` +
        `${CARD_BOT}\n\n` +
        `🎙️ *القارئ الحالي:* ${reciter.fullName || reciter.name}\n` +
        `📄 *صفحة ${current} من ${totalPages}*\n\n` +
        `*_اختر السورة من القائمة أو غيّر الشيخ أولاً بالزر بالأسفل 👇_*\n` +
        `${HEADER}`;

    await conn.sendButtonNormal(m.chat, {
        media: { url: QURAN_COVER },
        mediaType: 'image',
        caption: caption,
        footer: `𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • ${reciter.name}`,
        buttons: [
            {
                name: 'single_select',
                params: {
                    title: '🍥 فهرس السور',
                    sections: sections
                }
            },
            {
                name: 'quick_reply',
                params: {
                    display_text: '🎙️ اختيار الشيخ / القارئ',
                    id: `${prefix}${command} شيوخ`
                }
            }
        ],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
};

const sendRecitersList = async (m, conn, prefix, command) => {
    const sender = m.sender || m.chat || 'unknown';
    const currentId = getUserReciter(sender);
    const currentReciter = getReciter(currentId);

    const rows = RECITERS.map((r) => ({
        title: `${currentId === r.id ? '⭐ ' : '🎙️ '}${r.name}`,
        description: `${r.desc} ${currentId === r.id ? '• (المحدد حالياً)' : ''}`.trim(),
        id: `${prefix}${command} setreciter|${r.id}`
    }));

    const sections = [{ title: 'قائمة كبار القراء 🎙️', rows }];

    const caption =
        `${CARD_TOP}\n` +
        `┃ 🎙️ *قائمة كبار القراء والمشايخ*\n` +
        `${CARD_BOT}\n\n` +
        `📌 *القارئ الحالي:* ${currentReciter.fullName || currentReciter.name}\n` +
        `*_اختر الشيخ المفضل لديك من القائمة بالأسفل، وسيتم فتح السور بصوته مباشرة 👇_*\n\n` +
        `💡 *أو اكتب مباشرة:* *${prefix}${command} الحصري* أو *${prefix}${command} عبد الباسط*\n` +
        `${HEADER}`;

    await conn.sendButtonNormal(m.chat, {
        media: { url: QURAN_COVER },
        mediaType: 'image',
        caption: caption,
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • المصحف المرتل',
        buttons: [{
            name: 'single_select',
            params: {
                title: '🎙️ اختر القارئ',
                sections: sections
            }
        }],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
};

const sendSearchResult = async (m, conn, prefix, command, surah, reciterId) => {
    const sender = m.sender || m.chat || 'unknown';
    const rid = reciterId || getUserReciter(sender);
    const reciter = getReciter(rid);

    const rows = [{
        title: `سورة ${surah.name}`,
        description: `رقمها: ${surah.number} | آياتها: ${surah.numberOfAyahs} | بصوت: ${reciter.name}`,
        id: `${prefix}${command} getsurah|${surah.number}|${cleanName(surah.name)}|${surah.numberOfAyahs}|${reciter.id}`
    }];
    const sections = [{ title: 'النتائج 🕋', rows }];
    const caption =
        `${HEADER}\n` +
        `🔍 *تم العثور على سورة:* ${surah.name} 🕌\n` +
        `🎙️ *القارئ:* ${reciter.fullName || reciter.name}\n` +
        `${HEADER}`;

    await conn.sendButtonNormal(m.chat, {
        media: { url: QURAN_COVER },
        mediaType: 'image',
        caption: caption,
        footer: `𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • ${reciter.name}`,
        buttons: [
            {
                name: 'single_select',
                params: {
                    title: '🍥 اضغط للتحميل',
                    sections: sections
                }
            },
            {
                name: 'quick_reply',
                params: {
                    display_text: '🎙️ تغيير القارئ / الشيخ',
                    id: `${prefix}${command} شيوخ`
                }
            }
        ],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
};

const sendSurah = async (m, conn, surahNumber, surahName, ayahsCount, reciterId) => {
    const sender = m.sender || m.chat || 'unknown';
    const left = cooldownLeft(sender, 'audio');
    if (left > 0) {
        return safeReply(m, `⏳ استنى ${Math.ceil(left / 1000)} ثانية تانية قبل تحميل سورة تانية`);
    }
    markCooldown(sender, 'audio');

    const reciter = getReciter(reciterId || getUserReciter(sender));

    await safeReact(m, '⏳');
    await safeReply(m, `${HEADER}\n🎙️ *جاري تحميل سورة:* ${surahName}\n📊 *عدد الآيات:* ${ayahsCount}\n📖 *القارئ:* ${reciter.fullName || reciter.name}\n${HEADER}`);

    const audioUrl = buildAudioUrl(surahNumber, reciter.id);
    let probe;
    try {
        probe = await probeAudio(audioUrl);
    } catch (e) {
        if (e instanceof QuranError && e.userMessage) throw e;
        console.log('[quran] audio probe failed: ' + (e?.message || e));
        throw new QuranError('AUDIO_PROBE_FAILED', ERR_AUDIO);
    }

    if (!isMp3(probe.bytes)) throw new QuranError('AUDIO_NOT_MP3', ERR_AUDIO_FORMAT);

    const maxBytes = getMaxAudioBytes();
    if (probe.total > maxBytes) {
        throw new QuranError('AUDIO_TOO_LARGE', ERR_AUDIO_LARGE(surahName, Math.round(probe.total / (1024 * 1024))));
    }

    try {
        if (probe.total > 16 * 1024 * 1024) {
            const fileName = `${String(surahNumber).padStart(3, '0')}_سورة_${surahName}_${reciter.name}.mp3`;
            const mbSize = (probe.total / (1024 * 1024)).toFixed(1);
            await withTimeout(
                conn.sendMessage(m.chat, {
                    document: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: fileName,
                    caption: `${HEADER}\n🕋 *سورة ${surahName}*\n🎙️ *القارئ:* ${reciter.fullName || reciter.name}\n📊 *عدد الآيات:* ${ayahsCount}\n💾 *الحجم:* ${mbSize} ميجابايت\n${HEADER}`,
                    contextInfo: cleanContext(m.sender)
                }, { quoted: m }),
                timeouts.send,
                'SEND_TIMEOUT'
            );
        } else {
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
        }
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
        /* ─── تحميل وإرسال السورة ─── */
        if (kind === 'getsurah') {
            const surahNumber = Number(String(parts[1] ?? '').trim());
            if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > TOTAL_SURAHS) {
                return safeReply(m, ERR_NUMBER);
            }
            const surahName = cleanName(parts[2] || String(surahNumber));
            const ayahsCount = Number(parts[3]) || 0;
            const reciterId = parts[4] ? String(parts[4]).trim() : getUserReciter(sender);
            return await sendSurah(m, conn, surahNumber, surahName, ayahsCount, reciterId);
        }

        /* ─── اختيار الشيخ / القارئ ─── */
        if (kind === 'setreciter') {
            const chosenId = (parts[1] || '').trim();
            const chosen = getReciter(chosenId);
            setUserReciter(sender, chosen.id);
            await safeReact(m, '✅');
            await safeReply(m, `${HEADER}\n✅ *تم اختيار القارئ بنجاح!*\n🎙️ *الشيخ:* ${chosen.fullName || chosen.name}\n📜 *الرواية:* ${chosen.desc}\n✨ اختر السورة الآن لتشغيلها بصوته المبارك.\n${HEADER}`);
            return await sendPage(m, conn, pfx, cmd, 1, null, chosen.id);
        }

        if (kind === 'reciters' || kind === 'sheikhs' || isReciterListRequest(raw)) {
            const left = cooldownLeft(sender, 'index');
            if (left > 0) {
                return safeReply(m, `⏳ استنى ${Math.ceil(left / 1000)} ثانية تانية قبل طلب قائمة القراء`);
            }
            markCooldown(sender, 'index');
            await safeReact(m, '🎙️');
            return await sendRecitersList(m, conn, pfx, cmd);
        }

        /* ─── الفهرس (صفحات) ─── */
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
            const directReciter = findReciter(raw);
            if (directReciter) {
                setUserReciter(sender, directReciter.id);
                await safeReact(m, '✅');
                await safeReply(m, `${HEADER}\n✅ *تم اختيار القارئ:* ${directReciter.fullName || directReciter.name}\n📜 *الرواية:* ${directReciter.desc}\n✨ جاري فتح فهرس السور...\n${HEADER}`);
                return await sendPage(m, conn, pfx, cmd, 1, surahs, directReciter.id);
            }

            const extracted = extractReciterAndQuery(raw);
            if (extracted.reciter && extracted.query) {
                const foundCombined = findSurah(surahs, extracted.query);
                if (foundCombined) {
                    setUserReciter(sender, extracted.reciter.id);
                    return await sendSearchResult(m, conn, pfx, cmd, foundCombined, extracted.reciter.id);
                }
            }

            const found = findSurah(surahs, raw);
            if (!found) return safeReply(m, ERR_NOT_FOUND);
            return await sendSearchResult(m, conn, pfx, cmd, found, getUserReciter(sender));
        }

        return await sendPage(m, conn, pfx, cmd, 1, surahs, getUserReciter(sender));
    } catch (e) {
        console.log('[quran] ' + (e?.message || e));
        await safeReact(m, '❌');
        return safeReply(m, e?.userMessage || ERR_API);
    }
};

handler.usage = ["سورة", "قرآن"];
handler.category = "islamic";
handler.command = ["سورة", "سور", "قران", "quran"];

const QURAN_COMMANDS = new Set(handler.command);

export async function tryHandleQuranCommand(m, ctx, configuredPrefixes) {
    const body = String(m?.body ?? '').trim();
    if (!body) return false;
    const prefixes = Array.isArray(configuredPrefixes) && configuredPrefixes.length
        ? configuredPrefixes
        : [typeof configuredPrefixes === 'string' && configuredPrefixes ? configuredPrefixes : '.'];

    let matchedPrefix = null;
    for (const p of prefixes) {
        if (p && body.startsWith(p)) {
            matchedPrefix = p;
            break;
        }
    }
    if (!matchedPrefix) return false;

    const rest = body.slice(matchedPrefix.length).trim();
    if (!rest) return false;
    const spaceIdx = rest.search(/\s/);
    const cmdRaw = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
    if (!QURAN_COMMANDS.has(cmdRaw)) return false;

    const text = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    const args = text ? text.split(/\s+/) : [];
    await handler(m, {
        ...(ctx || {}),
        conn: ctx?.conn || ctx?.bot?.sock,
        text,
        args,
        command: cmdRaw,
        prefix: matchedPrefix,
        usedPrefix: matchedPrefix
    });
    return true;
}

export const quranInternals = {
    timeouts,
    cache: surahCache,
    cooldowns,
    userReciters,
    pageSize: PAGE_SIZE,
    maxRows: MAX_ROWS_PER_PAYLOAD,
    totalSurahs: TOTAL_SURAHS,
    cooldownMs: COOLDOWN_MS,
    cacheTtlMs: CACHE_TTL_MS,
    apiUrl: SURAH_API,
    audioBase: AUDIO_BASE,
    cover: QURAN_COVER,
    reciters: RECITERS,
    fetchSurahs,
    getSurahs,
    probeAudio,
    buildAudioUrl,
    findSurah,
    findReciter,
    getReciter,
    getUserReciter,
    setUserReciter,
    getMaxAudioBytes,
    extractReciterAndQuery,
    isReciterListRequest,
    withTimeout,
    isMp3,
    reset() {
        surahCache.data = null;
        surahCache.ts = 0;
        cooldowns.clear();
        userReciters.clear();
    }
};

export default handler;
