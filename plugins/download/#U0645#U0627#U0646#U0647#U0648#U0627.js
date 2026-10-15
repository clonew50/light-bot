// ─── plugins/download/مانهوا.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Manhwa Plugin 📚
// Data source: MangaDex public API ( https://api.mangadex.org )

import axios from 'axios';
import JSZip from 'jszip';
import { Buffer } from 'buffer';

const API = 'https://api.mangadex.org';
const UPLOADS = 'https://uploads.mangadex.org';
const DEFAULT_IMAGE = 'https://mangadex.org/img/avatar.png';
const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";
const UA = 'LIGHT-BOT-MangaDex/1.0 (WhatsApp Bot)';

const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function mdGet(path, params = {}) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const { data } = await axios.get(`${API}${path}`, {
                params,
                timeout: 30000,
                headers: { 'User-Agent': UA, 'Accept': 'application/json' }
            });
            return data;
        } catch (e) {
            lastError = e;
            const status = e?.response?.status;
            if (status === 429 || status >= 500) {
                await sleep(1000 * (attempt + 1));
                continue;
            }
            throw e;
        }
    }
    throw lastError;
}

async function fetchBuffer(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': UA }
            });
            return Buffer.from(res.data);
        } catch (e) {
            const status = e?.response?.status;
            if (status === 429 || status >= 500) {
                await sleep(1000 * (attempt + 1));
                continue;
            }
            return null;
        }
    }
    return null;
}

function pickText(map) {
    if (!map || typeof map !== 'object') return '';
    return map.ar || map.en || Object.values(map)[0] || '';
}

function titleOf(manga) {
    const attrs = manga?.attributes || {};
    return pickText(attrs.title) || pickText(attrs.altTitles?.[0]) || 'بدون عنوان';
}

function descOf(manga) {
    const attrs = manga?.attributes || {};
    return pickText(attrs.description);
}

function coverUrl(manga, size = 512) {
    const rel = (manga?.relationships || []).find((r) => r.type === 'cover_art');
    const file = rel?.attributes?.fileName;
    if (!file) return DEFAULT_IMAGE;
    return `${UPLOADS}/covers/${manga.id}/${file}${size ? `.${size}.jpg` : ''}`;
}

function statusAr(status) {
    return {
        ongoing: 'مستمر',
        completed: 'مكتمل',
        hiatus: 'متوقف مؤقتاً',
        cancelled: 'ملغي'
    }[status] || 'غير معروف';
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function searchManga(query, isPopular) {
    const params = {
        limit: 20,
        'includes[]': ['cover_art'],
        'contentRating[]': CONTENT_RATINGS,
        'hasAvailableChapters': 'true'
    };

    if (isPopular) {
        params['order[followedCount]'] = 'desc';
    } else {
        params.title = query;
        params['order[relevance]'] = 'desc';
    }

    const data = await mdGet('/manga', params);
    return Array.isArray(data?.data) ? data.data : [];
}

async function getChapters(mangaId) {
    const baseParams = {
        'includes[]': ['scanlation_group'],
        limit: 500,
        'order[chapter]': 'asc'
    };

    for (const lang of ['ar', 'en']) {
        const data = await mdGet(`/manga/${mangaId}/feed`, {
            ...baseParams,
            'translatedLanguage[]': [lang]
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        if (list.length) return list;
    }

    const data = await mdGet(`/manga/${mangaId}/feed`, baseParams);
    return Array.isArray(data?.data) ? data.data : [];
}

function chapterLabel(ch) {
    const a = ch.attributes || {};
    const num = a.chapter ? `فصل ${a.chapter}` : 'فصل';
    let label = num;
    if (a.title) label += ` - ${a.title}`;
    if (a.volume) label = `مجلد ${a.volume} | ${label}`;
    return label.slice(0, 90);
}

const handler = async (m, { conn, text, command, usedPrefix }) => {
    const prefix = usedPrefix || '.';
    const input = (text || '').trim();

    // 1️⃣ بحث / عرض أشهر المانهوا
    if (/^(مانهوا|manhwa)$/i.test(command)) {
        try {
            await m.react('🔍').catch(() => {});

            const isPopular = input === '';
            const results = await searchManga(isPopular ? '' : input, isPopular);

            if (!results.length) {
                return m.reply(`${HEADER}\n❌ *لم يتم العثور على نتائج*${input ? `\n🔍 ${input}` : ''}\n${HEADER}`);
            }

            const cover = coverUrl(randomItem(results));
            const rows = shuffleArray(results).slice(0, 20).map((manga) => ({
                title: titleOf(manga).slice(0, 60),
                description: `📊 ${statusAr(manga.attributes?.status)} | 🌐 ${(manga.attributes?.availableTranslatedLanguages || []).length} لغة`,
                id: `${prefix}عرض_مانهوا ${manga.id}`
            }));

            const titleText = isPopular ? '🏆 *أشهر المانهوات المتاحة*' : `🔍 *نتائج البحث عن:* ${input}`;
            const subText = isPopular ? '📚 *اختر من القائمة لعرض الفصول*' : `📚 *تم العثور على:* ${results.length} نتيجة`;
            const caption = `${HEADER}\n${titleText}\n${subText}\n${HEADER}`;

            const sections = [{
                title: isPopular ? '🏆 الأكثر شهرة' : '🔍 نتائج البحث',
                rows
            }];

            await conn.sendButtonNormal(m.chat, {
                media: { url: cover },
                mediaType: 'image',
                caption,
                buttons: [{
                    name: "single_select",
                    params: {
                        title: "📚 اختر المانهوا",
                        sections
                    }
                }],
                mentions: [m.sender],
                contextInfo: cleanContext(m.sender)
            }, m);
        } catch (e) {
            console.log('Manhwa search error:', e?.message || e);
            await m.reply(`${HEADER}\n❌ *حدث خطأ أثناء البحث*\n${HEADER}`);
        }
        return;
    }

    // 2️⃣ عرض تفاصيل المانهوا
    if (/^(عرض_مانهوا|manga_info)$/i.test(command)) {
        if (!input) {
            return m.reply(`${HEADER}\n📌 *ضع معرف المانهوا بعد الأمر*\n${HEADER}`);
        }

        try {
            await m.react('📖').catch(() => {});

            const mangaId = input.split(/\s+/)[0].split('/').filter(Boolean).pop();
            const data = await mdGet(`/manga/${mangaId}`, { 'includes[]': ['cover_art'] });
            const manga = data?.data;
            if (!manga) {
                return m.reply(`${HEADER}\n❌ *لم يتم العثور على المانهوا*\n${HEADER}`);
            }

            const title = titleOf(manga);
            const attrs = manga.attributes || {};
            const coverImg = coverUrl(manga);
            const synopsis = descOf(manga);

            const chapters = await getChapters(mangaId);
            if (!chapters.length) {
                return m.reply(`${HEADER}\n⚠️ *لا توجد فصول متاحة حالياً لهذه المانهوا.*\n${HEADER}`);
            }

            const seen = new Set();
            const unique = [];
            for (const ch of chapters) {
                const key = ch.attributes?.chapter || ch.id;
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(ch);
            }

            const infoText = `${HEADER}\n📚 *${title}*\n\n` +
                `📊 *الحالة:* ${statusAr(attrs.status)}\n` +
                `📅 *السنة:* ${attrs.year || 'غير معروف'}\n` +
                `🌐 *اللغات:* ${(attrs.availableTranslatedLanguages || []).slice(0, 6).join(', ') || 'غير معروف'}\n` +
                `📚 *عدد الفصول:* ${unique.length}\n\n` +
                `📖 *القصة:*\n${synopsis ? synopsis.slice(0, 250) + (synopsis.length > 250 ? '...' : '') : 'لا يوجد وصف'}\n${HEADER}`;

            const CHAPTERS_PER_SECTION = 50;
            const sections = [];
            for (let i = 0; i < unique.length; i += CHAPTERS_PER_SECTION) {
                const chunk = unique.slice(i, i + CHAPTERS_PER_SECTION);
                sections.push({
                    title: `📖 الفصول ${i + 1} - ${Math.min(i + CHAPTERS_PER_SECTION, unique.length)}`,
                    rows: chunk.map((ch) => ({
                        title: chapterLabel(ch).slice(0, 60),
                        description: `📥 اضغط للتحميل ZIP`,
                        id: `${prefix}تحميل_فصل ${ch.id}`
                    }))
                });
            }

            await conn.sendButtonNormal(m.chat, {
                media: { url: coverImg },
                mediaType: 'image',
                caption: infoText,
                buttons: [{
                    name: "single_select",
                    params: {
                        title: `📖 قائمة الفصول (${unique.length})`,
                        sections
                    }
                }],
                mentions: [m.sender],
                contextInfo: cleanContext(m.sender)
            }, m);
        } catch (e) {
            console.log('Manhwa info error:', e?.message || e);
            await m.reply(`${HEADER}\n❌ *تعذر جلب تفاصيل المانهوا*\n${HEADER}`);
        }
        return;
    }

    // 3️⃣ تحميل الفصل كملف ZIP
    if (/^(تحميل_فصل|zip)$/i.test(command)) {
        if (!input) {
            return m.reply(`${HEADER}\n📌 *ضع معرف الفصل بعد الأمر*\n${HEADER}`);
        }

        try {
            await m.react('📦').catch(() => {});

            const chapterId = input.split(/\s+/)[0].split('/').filter(Boolean).pop();
            const at = await mdGet(`/at-home/server/${chapterId}`);
            const baseUrl = at?.baseUrl;
            const hash = at?.chapter?.hash;
            const saverFiles = at?.chapter?.dataSaver || [];
            const dataFiles = at?.chapter?.data || [];

            if (!baseUrl || !hash || (!saverFiles.length && !dataFiles.length)) {
                return m.reply(`${HEADER}\n❌ *لم يتم العثور على صور الفصل*\n${HEADER}`);
            }

            let useSaver = saverFiles.length > 0;
            if (useSaver) {
                const probe = await fetchBuffer(`${baseUrl}/data-saver/${hash}/${saverFiles[0]}`);
                if (!probe) useSaver = false;
            }

            const files = useSaver ? saverFiles : dataFiles;
            const folder = useSaver ? 'data-saver' : 'data';

            const zip = new JSZip();
            let pagesAdded = 0;

            for (let i = 0; i < files.length; i++) {
                const buf = await fetchBuffer(`${baseUrl}/${folder}/${hash}/${files[i]}`);
                if (buf) {
                    const ext = (files[i].split('.').pop() || 'jpg').split('?')[0];
                    zip.file(`page_${String(i + 1).padStart(3, '0')}.${ext}`, buf);
                    pagesAdded++;
                }
                if (i < files.length - 1) await sleep(150);
            }

            if (pagesAdded === 0) {
                return m.reply(`${HEADER}\n❌ *فشل تحميل صفحات الفصل*\n${HEADER}`);
            }

            const fileBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

            await conn.sendMessage(m.chat, {
                document: fileBuffer,
                mimetype: 'application/zip',
                fileName: `Chapter_${Date.now()}.zip`,
                caption: `${HEADER}\n📦 *تم تجهيز الفصل بنجاح!*\n\n📄 *الصفحات:* ${pagesAdded}\n📁 *الحجم:* ${fileSizeMB} MB\n${HEADER}`,
                contextInfo: cleanContext(m.sender)
            }, { quoted: m });
        } catch (e) {
            console.log('Manhwa download error:', e?.message || e);
            await m.reply(`${HEADER}\n❌ *تعذر تجهيز الفصل*\n${HEADER}`);
        }
        return;
    }
};

handler.usage = ["مانهوا", "عرض_مانهوا", "تحميل_فصل"];
handler.category = "downloads";
handler.command = ["مانهوا", "manhwa", "عرض_مانهوا", "manga_info", "تحميل_فصل", "zip"];

export default handler;
