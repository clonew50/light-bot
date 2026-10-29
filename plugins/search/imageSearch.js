import axios from 'axios';

const EMAM = 'https://www.emam-api.web.id';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MENU_IMAGE = 'https://qu.ax/x/pVZSb.jpg';

const FOOTER = '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻';

const NEWSLETTER = {
    name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
    jid: '120363405545946827@newsletter'
};

const MAX_IMAGES = 10;
const MAX_COUNT = 50;
const MAX_BYTES = 15 * 1024 * 1024;
const MENU_TIMEOUT = 180000;

if (!global.imageMenus) global.imageMenus = {};

const SOURCES = {
    bing: { cat: 'engines', cmd: 'صور-بينج', needle: 'Bing', title: '🔵 Bing', desc: 'محرك بحث Bing' },
    yandex: { cat: 'engines', cmd: 'صور-يانдекс', needle: 'Yandex', title: '🔴 Yandex', desc: 'محرك بحث Yandex' },
    naver: { cat: 'engines', cmd: 'صور-نافر', needle: 'Naver', title: '🟢 Naver', desc: 'محرك بحث Naver' },
    so360: { cat: 'engines', cmd: 'صور-360', needle: '360', title: '🟠 360 (So.com)', desc: 'محرك بحث 360' },
    seznam: { cat: 'engines', cmd: 'صور-سيزنام', needle: 'Seznam', title: '🟣 Seznam', desc: 'محرك بحث Seznam' },

    pinterest: { cat: 'stock', cmd: 'صور-بين', needle: 'Pinterest', title: '📌 Pinterest', desc: 'صور من Pinterest' },
    unsplash: { cat: 'stock', cmd: 'صور-انسبلاش', needle: 'Unsplash', title: '🌸 Unsplash', desc: 'صور احترافية مجانية' },
    openverse: { cat: 'stock', cmd: 'صور-اوف', needle: 'Openverse', title: '🎨 Openverse', desc: 'صور حرة المصدر' },
    wikimedia: { cat: 'stock', cmd: 'صور-ويكي', needle: 'Wikimedia', title: '📚 Wikimedia', desc: 'صور من ويكيميديا' },
    flickr: { cat: 'stock', cmd: 'صور-فليكر', needle: 'Flickr', title: '📷 Flickr', desc: 'صور من Flickr' },
    pixnio: { cat: 'stock', cmd: 'صور-بيكسنو', needle: 'Pixnio', title: '🖼️ Pixnio', desc: 'صور مجانية من Pixnio' },
    picsart: { cat: 'stock', cmd: 'صور-بيكسارت', needle: 'Picsart', title: '🧩 Picsart', desc: 'ملصقات من Picsart' },

    wallhaven: { cat: 'walls', cmd: 'صور-وول', needle: 'Wallhaven', title: '🧱 Wallhaven', desc: 'خلفيات من Wallhaven' },
    alphacoders: { cat: 'walls', cmd: 'صور-الفا', needle: 'AlphaCoders', title: '🖥️ AlphaCoders', desc: 'خلفيات HD من AlphaCoders' },
    wallpapercave: { cat: 'walls', cmd: 'صور-والبيبر', needle: 'WallpaperCave', title: '🕳️ WallpaperCave', desc: 'خلفيات من WallpaperCave' },

    artstation: { cat: 'art', cmd: 'صور-ارت', needle: 'ArtStation', title: '🎭 ArtStation', desc: 'أعمال فنية من ArtStation' },
    safebooru: { cat: 'art', cmd: 'صور-سيفي', needle: 'Safebooru', title: '🈶 Safebooru', desc: 'صور أنمي من Safebooru' },
    yandere: { cat: 'art', cmd: 'صور-ياندر', needle: 'yande.re', title: '🌺 yande.re', desc: 'صور أنمي من yande.re' },

    gif: { cat: 'gif', cmd: 'صور-جيف', needle: 'GIF', title: '🎞️ GIF (Tenor/Giphy)', desc: 'صور متحركة GIF', max: 6 }
};

const CATEGORIES = [
    { key: 'engines', needle: 'محركات البحث', title: '🔎 محركات البحث', desc: 'Bing • Yandex • Naver • 360 • Seznam' },
    { key: 'stock', needle: 'صور عامة', title: '🌄 صور عامة ومخزون', desc: 'Pinterest • Unsplash • Openverse • Wikimedia • Flickr • Pixnio • Picsart' },
    { key: 'walls', needle: 'خلفيات', title: '🧱 خلفيات', desc: 'Wallhaven • AlphaCoders • WallpaperCave' },
    { key: 'art', needle: 'فن ورسومات', title: '🎨 فن ورسومات', desc: 'ArtStation • Safebooru • yande.re' },
    { key: 'gif', needle: 'متحركة', title: '🎞️ صور متحركة', desc: 'GIF من Tenor و Giphy' }
];

const CMD_MAP = { 'صور': null };
for (const key of Object.keys(SOURCES)) CMD_MAP[SOURCES[key].cmd] = key;

const OFF_WORDS = ['off', 'ايقاف', 'إيقاف', 'تعطيل', 'غلق', 'اغلاق', 'إغلاق', 'اقفال', '0', 'no', 'لا'];
const ON_WORDS = ['on', 'تشغيل', 'تفعيل', 'فتح', '1', 'yes', 'نعم'];

function cleanImageMenus() {
    const now = Date.now();
    for (const key of Object.keys(global.imageMenus)) {
        if (now - global.imageMenus[key].time > MENU_TIMEOUT) delete global.imageMenus[key];
    }
}

function idOf(m) {
    return m.isGroup ? m.chat : m.sender;
}

function isSafeOff(m) {
    const db = global.db;
    if (!db || !db.data) return false;
    const box = m.isGroup ? db.data.groups : db.data.users;
    const rec = box ? box[idOf(m)] : null;
    return !!(rec && rec.nosafe);
}

function setSafeOff(m, off) {
    const db = global.db;
    if (!db) return;
    try {
        const box = m.isGroup ? db.groups : db.users;
        box[idOf(m)].nosafe = off ? true : false;
    } catch (e) {}
}

function getImgCount(m) {
    const db = global.db;
    if (!db) return MAX_IMAGES;
    const box = m.isGroup ? db.groups : db.users;
    const rec = box ? box[idOf(m)] : null;
    const n = rec ? Number(rec.imgcount) : NaN;
    return n >= 1 && n <= MAX_COUNT ? n : MAX_IMAGES;
}

function setImgCount(m, n) {
    const db = global.db;
    if (!db) return;
    try {
        const box = m.isGroup ? db.groups : db.users;
        box[idOf(m)].imgcount = n;
    } catch (e) {}
}

function resetImgCount(m) {
    const db = global.db;
    if (!db) return;
    try {
        const box = m.isGroup ? db.groups : db.users;
        delete box[idOf(m)].imgcount;
    } catch (e) {}
}

function parseCount(raw) {
    const found = (raw || '').match(/(?:^|\s)(\d{1,2})\s*$/);
    if (!found) return { q: raw, count: null };
    const n = parseInt(found[1], 10);
    const rest = raw.slice(0, found.index).trim();
    if (n >= 1 && n <= MAX_COUNT && rest) return { q: rest, count: n };
    return { q: raw, count: null };
}

function effCount(m, count) {
    return count || getImgCount(m);
}

const uniq = (a) => [...new Set((a || []).filter(Boolean))];

function decodeBingUrl(u) {
    return u.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
}

async function searchBing(q, safeOff) {
    const { data } = await axios.get('https://www.bing.com/images/async', {
        params: { q, count: 35, first: 0, mmasync: 1, adlt: safeOff ? 'off' : 'strict', safeSearch: safeOff ? 'Off' : 'Strict' },
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
        responseType: 'text',
        timeout: 25000
    });
    const out = [];
    const re = /murl&quot;:&quot;(.*?)&quot;/g;
    let m;
    while ((m = re.exec(String(data))) !== null) {
        const u = decodeBingUrl(m[1]);
        if (/^https?:\/\//i.test(u)) out.push(u);
    }
    return out;
}

async function searchYandex(q) {
    const { data } = await axios.get('https://yandex.com/images/search', {
        params: { text: q },
        headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.9' },
        responseType: 'text',
        timeout: 25000
    });
    const h = String(data).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    return [...h.matchAll(/"origUrl":"(.*?)"/g)].map((x) => x[1]);
}

async function searchNaver(q) {
    const res = await fetch('https://search.naver.com/search.naver?' + new URLSearchParams({ where: 'image', query: q }), {
        headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' }
    });
    const h = (await res.text()).replace(/\\u0026/g, '&');
    return [...h.matchAll(/https:\/\/search\.pstatic\.net\/sunny\/\?src=[^"'\\]+/g)].map((x) => x[0]);
}

async function search360(q) {
    const { data } = await axios.get('https://image.so.com/j', {
        params: { q, src: 'srp', correct: q, sn: 0, pn: 30 },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.list || []).map((x) => x.img && x.img.replace(/^http:/, 'https:'));
}

async function searchSeznam(q) {
    const { data } = await axios.get('https://search.seznam.cz/', {
        params: { q, t: 'images' },
        headers: { 'User-Agent': UA, 'Accept-Language': 'cs,en;q=0.8' },
        responseType: 'text',
        timeout: 25000
    });
    return [...String(data).matchAll(/https:\/\/d\d+-a\.sdn\.cz\/[^"'\\ ]+?\.(?:jpg|jpeg|png|webp)/g)].map((x) => x[0]);
}

async function searchUnsplash(q) {
    const { data } = await axios.get(`${EMAM}/home/sections/Search/api/Unsplash/search`, {
        params: { text: q },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.images || []).map((u) => (u ? (u.includes('?') ? `${u}&w=1080&q=70&fm=jpg` : u) : null));
}

async function searchOpenverse(q) {
    const { data } = await axios.get('https://api.openverse.org/v1/images/', {
        params: { q, page_size: 20 },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.results || []).map((r) => r.url);
}

async function searchWikimedia(q) {
    const { data } = await axios.get('https://commons.wikimedia.org/w/api.php', {
        params: { action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: 6, gsrlimit: 20, prop: 'imageinfo', iiprop: 'url', iiurlwidth: 1024, format: 'json' },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    const pages = data?.query?.pages || {};
    return Object.values(pages).map((p) => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url);
}

async function searchFlickr(q) {
    const { data } = await axios.get('https://www.flickr.com/services/feeds/photos_public.gne', {
        params: { tags: q, format: 'json', nojsoncallback: 1 },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.items || []).map((i) => i.media?.m?.replace(/_m\.jpg$/, '_b.jpg'));
}

async function searchPixnio(q) {
    const { data } = await axios.get('https://pixnio.com/', {
        params: { s: q },
        headers: { 'User-Agent': UA },
        responseType: 'text',
        timeout: 25000
    });
    return [...String(data).matchAll(/https:\/\/pixnio\.com\/free-images\/[^"'\\ ]+?\.(?:jpg|jpeg|png|webp)/g)].map((x) => x[0]);
}

async function searchPicsart(q) {
    const { data } = await axios.get(`${EMAM}/home/sections/Search/api/api/picsart/stickers`, {
        params: { q },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    const out = [];
    for (const card of data?.response || []) {
        for (const item of card?.data || []) {
            if (item?.url) out.push(item.url);
        }
    }
    return out;
}

async function searchWallhaven(q, safeOff) {
    const { data } = await axios.get('https://wallhaven.cc/api/v1/search', {
        params: { q, purity: safeOff ? '111' : '100' },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.data || []).map((x) => x.thumbs?.large || x.path);
}

async function searchAlphacoders(q) {
    const { data } = await axios.get('https://wall.alphacoders.com/search.php', {
        params: { search: q },
        headers: { 'User-Agent': UA },
        responseType: 'text',
        timeout: 25000
    });
    return [...String(data).matchAll(/https:\/\/images\d*\.alphacoders\.com\/[^"'\\ ]+?\.(?:jpg|jpeg|png|webp)/g)].map((x) => x[0]);
}

async function searchWallpapercave(q) {
    const { data } = await axios.get('https://www.wallpapercave.com/search', {
        params: { q },
        headers: { 'User-Agent': UA },
        responseType: 'text',
        timeout: 25000
    });
    return [...String(data).matchAll(/https:\/\/wallpapercave\.com\/wpt\/wp\d+\.jpg/g)].map((x) => x[0]);
}

async function searchArtstation(q) {
    const { data } = await axios.get('https://www.artstation.com/api/v2/search/projects.json', {
        params: { query: q, page: 1, per_page: 20 },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.data || []).map((x) => x.cover_url || x.asset_image_url || x.smaller_square_cover_url);
}

async function searchSafebooru(q) {
    const { data } = await axios.get('https://safebooru.org/index.php', {
        params: { page: 'dapi', s: 'post', q: 'index', tags: q, json: 1, limit: 20 },
        headers: { 'User-Agent': UA },
        responseType: 'text',
        timeout: 25000
    });
    try {
        return JSON.parse(data).map((x) => x.file_url);
    } catch (e) {
        return [];
    }
}

async function searchYandere(q) {
    const { data } = await axios.get('https://yande.re/post.json', {
        params: { tags: q, limit: 20 },
        headers: { 'User-Agent': UA },
        responseType: 'text',
        timeout: 25000
    });
    try {
        const arr = JSON.parse(data);
        if (arr.length) return arr.map((x) => x.sample_url || x.file_url);
    } catch (e) {}
    const alt = q.replace(/s$/, '');
    if (alt !== q) {
        try {
            const { data: d2 } = await axios.get('https://yande.re/post.json', {
                params: { tags: alt, limit: 20 },
                headers: { 'User-Agent': UA },
                responseType: 'text',
                timeout: 25000
            });
            return JSON.parse(d2).map((x) => x.sample_url || x.file_url);
        } catch (e) {}
    }
    return [];
}

async function searchPinterest(q) {
    const { data } = await axios.get(`${EMAM}/home/sections/Search/api/api/pinterest/image`, {
        params: { q },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    const arr = Array.isArray(data) ? data : data?.data || [];
    return arr.map((x) => x?.url);
}

async function searchGif(q) {
    const { data } = await axios.get('https://engez.a7a.online/api/v1/tools/gif-search', {
        params: { q },
        headers: { 'User-Agent': UA },
        timeout: 25000
    });
    return (data?.results || []).map((x) => x.url);
}

const RUNNERS = {
    bing: searchBing,
    yandex: searchYandex,
    naver: searchNaver,
    so360: search360,
    seznam: searchSeznam,
    unsplash: searchUnsplash,
    openverse: searchOpenverse,
    wikimedia: searchWikimedia,
    flickr: searchFlickr,
    pixnio: searchPixnio,
    picsart: searchPicsart,
    wallhaven: searchWallhaven,
    alphacoders: searchAlphacoders,
    wallpapercave: searchWallpapercave,
    artstation: searchArtstation,
    safebooru: searchSafebooru,
    yandere: searchYandere,
    pinterest: searchPinterest,
    gif: searchGif
};

async function searchSource(key, q, safeOff) {
    const runner = RUNNERS[key];
    if (!runner) return [];

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const r = uniq(await runner(q, safeOff));
            if (r.length) return r;
        } catch (e) {}
        await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return [];
}

async function fetchImage(url) {
    const origin = (() => {
        try {
            return new URL(url).origin + '/';
        } catch (e) {
            return '';
        }
    })();

    const { data, headers } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 25000,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        headers: { 'User-Agent': UA, Referer: origin, Accept: 'image/*,*/*;q=0.8' }
    });

    const type = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) return null;

    const buffer = Buffer.from(data);
    if (!buffer.length || buffer.length > MAX_BYTES) return null;

    return { buffer, mimetype: type };
}

async function collectImages(urls, limit) {
    const out = [];
    let bytes = 0;
    let idx = 0;

    async function worker() {
        while (idx < urls.length && out.length < limit && bytes < 60 * 1024 * 1024) {
            const url = urls[idx++];
            let img = null;
            try {
                img = await fetchImage(url);
            } catch (e) {
                img = null;
            }
            if (img) {
                out.push(img);
                bytes += img.buffer.length;
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
    return out.slice(0, limit);
}

async function sendImages(m, conn, urls, source, input, count) {
    const safeLabel = isSafeOff(m) ? '🔓 معطّل' : '🔒 مفعّل';
    const limit = Math.max(1, Math.min(effCount(m, count), source.max || MAX_COUNT));

    const images = await collectImages(urls, limit);
    let sent = 0;

    for (const img of images) {
        if (sent >= limit) break;

        const content = { image: img.buffer, mimetype: img.mimetype };
        const options = {};

        if (sent === 0) {
            content.caption = `📸 *${source.title}*\n🔎 البحث عن: _${input}_\n🔢 عدد النتائج: ${limit}\n${safeLabel} البحث الآمن\n\n${FOOTER}`;
            options.quoted = m;
        }

        try {
            await conn.sendMessage(m.chat, content, options);
            sent++;
        } catch (e) {}
    }

    return sent;
}

async function runImage(m, conn, key, input, count) {
    const source = SOURCES[key] || SOURCES.bing;
    const safeOff = isSafeOff(m);

    if (m.react) {
        try {
            await m.react('🔍');
        } catch (e) {}
    }

    let urls = [];
    try {
        urls = await searchSource(key, input, safeOff);
    } catch (e) {
        urls = [];
    }

    if (!urls.length) {
        if (m.react) {
            try {
                await m.react('❌');
            } catch (e) {}
        }
        return conn.sendMessage(m.chat, { text: `⚠️ لا توجد نتائج لـ *${input}*\n${source.title}` }, { quoted: m });
    }

    const sent = await sendImages(m, conn, urls, source, input, count);

    if (!sent) {
        if (m.react) {
            try {
                await m.react('❌');
            } catch (e) {}
        }
        return conn.sendMessage(m.chat, { text: '❌ فشل تحميل الصور، جرّب كلمة أخرى.' }, { quoted: m });
    }

    if (m.react) {
        try {
            await m.react('✅');
        } catch (e) {}
    }
}

async function sendMenu(m, conn, pfx, input, catKey, stage, count) {
    cleanImageMenus();
    global.imageMenus[`${m.chat}:${m.sender}`] = { input, stage, cat: catKey || null, pfx, count: count || null, time: Date.now() };

    const want = effCount(m, count);
    let rows;
    let caption;
    let title;

    if (stage === 'category') {
        rows = CATEGORIES.map((c) => ({ title: c.title, description: c.desc, id: c.title }));
        caption = `*اختر مصدر الصور للنص:* _${input}_\n🔢 عدد النتائج: ${want}\n\n${CATEGORIES.map((c) => c.title).join('\n')}`;
        title = 'اختر المصدر 📜';
    } else {
        const cat = CATEGORIES.find((c) => c.key === catKey) || CATEGORIES[0];
        const keys = Object.keys(SOURCES).filter((k) => SOURCES[k].cat === cat.key);
        rows = keys.map((k) => ({ title: SOURCES[k].title, description: SOURCES[k].desc, id: SOURCES[k].title }));
        caption = `*${cat.title}*\nاختر المحرك للنص: _${input}_\n🔢 عدد النتائج: ${want}\n\n${keys.map((k) => `${SOURCES[k].title} ← ${pfx}${SOURCES[k].cmd} ${input}`).join('\n')}`;
        title = cat.title;
    }

    const content = {
        media: { url: MENU_IMAGE },
        mediaType: 'image',
        caption,
        footer: '❖ اختر من القائمة:',
        buttons: [{ name: 'single_select', params: { title, sections: [{ title, rows }] } }],
        mentions: [m.sender],
        newsletter: NEWSLETTER
    };

    try {
        return await conn.sendButtonNormal(m.chat, content, m);
    } catch (e) {
        return conn.sendMessage(m.chat, { text: caption }, { quoted: m });
    }
}

let handler = async (m, { conn, args, prefix, usedPrefix, command }) => {
    const pfx = prefix || usedPrefix || '.';
    const raw = args.join(' ').trim();

    if (command === 'امان' || command === 'بحث-امن') {
        const word = (args[0] || '').trim().toLowerCase();
        let off;

        if (OFF_WORDS.includes(word)) off = true;
        else if (ON_WORDS.includes(word)) off = false;
        else off = !isSafeOff(m);

        setSafeOff(m, off);

        return conn.sendMessage(m.chat, { text: off ? '🔓 تم تعطيل البحث الآمن.' : '🔒 تم تفعيل البحث الآمن.' }, { quoted: m });
    }

    if (command === 'عدد' || command === 'عدد-صور') {
        const word = raw.toLowerCase();
        const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);

        if (['افتراضي', 'إفتراضي', 'default', 'reset', '0'].includes(word)) {
            resetImgCount(m);
            return conn.sendMessage(m.chat, { text: `♻️ تم إرجاع عدد النتائج الافتراضي (*${MAX_IMAGES}*).` }, { quoted: m });
        }

        if (!n) {
            return conn.sendMessage(
                m.chat,
                { text: `🔢 عدد نتائج البحث الحالي: *${getImgCount(m)}*\n\nلتغييره اكتب:\n${pfx}عدد 5\nأو أضف الرقم بعد البحث: ${pfx}صور قطة 5\nلإرجاع الافتراضي: ${pfx}عدد افتراضي` },
                { quoted: m }
            );
        }

        if (n < 1 || n > MAX_COUNT) {
            return conn.sendMessage(m.chat, { text: `❌ اختر رقمًا من 1 إلى ${MAX_COUNT}.` }, { quoted: m });
        }

        setImgCount(m, n);
        return conn.sendMessage(m.chat, { text: `✅ تم ضبط عدد نتائج البحث على *${n}*.` }, { quoted: m });
    }

    const { q: input, count } = parseCount(raw);

    if (command === 'صور') {
        if (!input) return conn.sendMessage(m.chat, { text: `✧ اكتب مثلًا:\n${pfx}صور قطة\nأو حدّد العدد: ${pfx}صور قطة 5` }, { quoted: m });
        return sendMenu(m, conn, pfx, input, null, 'category', count);
    }

    const key = CMD_MAP[command];
    if (key) {
        if (!input) return conn.sendMessage(m.chat, { text: '❌ اكتب كلمة البحث.' }, { quoted: m });
        cleanImageMenus();
        delete global.imageMenus[`${m.chat}:${m.sender}`];
        return runImage(m, conn, key, input, count);
    }
};

handler.before = async (m, { conn }) => {
    cleanImageMenus();

    const key = `${m.chat}:${m.sender}`;
    const pending = global.imageMenus[key];
    if (!pending) return false;

    const text = `${m.text || ''} ${m.body || ''}`.trim();
    if (!text) return false;

    const pfx = pending.pfx || '.';
    const hit = (needles) => needles.filter(Boolean).some((n) => text.includes(n));

    if (pending.stage === 'category') {
        const cat = CATEGORIES.find((c) => hit([c.needle, c.title, `${pfx}صور-${c.key}`, `صور-${c.key}`]));
        if (!cat) return false;
        delete global.imageMenus[key];
        try {
            await sendMenu(m, conn, pfx, pending.input, cat.key, 'source', pending.count);
        } catch (e) {
            await conn.sendMessage(m.chat, { text: `❌ فشل العرض: ${e.message}` }, { quoted: m });
        }
        return true;
    }

    const cat = CATEGORIES.find((c) => c.key === pending.cat);
    const keys = cat ? Object.keys(SOURCES).filter((k) => SOURCES[k].cat === cat.key) : Object.keys(SOURCES);
    const sourceKey = keys.find((k) => hit([SOURCES[k].needle, SOURCES[k].title, SOURCES[k].cmd, `${pfx}${SOURCES[k].cmd}`]));
    if (!sourceKey) return false;

    delete global.imageMenus[key];

    try {
        await runImage(m, conn, sourceKey, pending.input, pending.count);
    } catch (e) {
        await conn.sendMessage(m.chat, { text: `❌ فشل البحث: ${e.message}` }, { quoted: m });
    }

    return true;
};

handler.command = ['صور', ...Object.keys(CMD_MAP).filter((c) => c !== 'صور'), 'امان', 'بحث-امن', 'عدد', 'عدد-صور'];

handler.help = ['صور <نص>', 'عدد <رقم>', 'امان on|off'];

handler.category = 'search';

export default handler;
