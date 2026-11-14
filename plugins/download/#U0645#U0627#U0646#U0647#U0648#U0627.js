// ─── plugins/download/مانهوا.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Manhwa Plugin 📚
// Data source: MangaDex public API ( https://api.mangadex.org )
// ملاحظة (todo 24): MangaDex صار يرد بصفحة تحقق (Browser verification) بدل JSON
//                    في بعض الحالات → نكتشف الصفحة ونرد برسالة "المصدر محمي حالياً"
//                    بدل ما يرمي خطأ parse من المعالج.
//                    كل الطلبات لها مهلة + حد أقصى للحجم + try/catch + رسائل عربية واضحة.

import JSZip from 'jszip';
import { Buffer } from 'buffer';

const API = 'https://api.mangadex.org';
const UPLOADS = 'https://uploads.mangadex.org';
const DEFAULT_IMAGE = 'https://mangadex.org/img/avatar.png';
const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";
const UA = 'LIGHT-BOT-MangaDex/1.0 (WhatsApp Bot)';

const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica'];

// ─── حدود الأمان ───
const TIMEOUT_MS = 20000;                    // مهلة الاتصال الافتراضية
const MAX_BODY_BYTES = 2 * 1024 * 1024;      // أقصى حجم لاستجابة JSON (2 ميغابايت)
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;    // أقصى حجم لصورة صفحة واحدة (12 ميغابايت)
const MAX_PAGES = 200;                       // أقصى عدد صفحات في الفصل الواحد
const MAX_ZIP_BYTES = 80 * 1024 * 1024;      // أقصى حجم للملف ZIP (80 ميغابايت)

class UpstreamError extends Error {
    constructor(kind, message) {
        super(message || kind);
        this.kind = kind; // timeout | network | protected | http | parse | toolarge
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const timeoutMs = () => {
    const raw = Number(process.env.DOWNLOAD_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 100 ? Math.min(raw, 120000) : TIMEOUT_MS;
};

const isHtml = (text) => /^\s*</.test(String(text || ''));

const isChallenge = (text) =>
    /just a moment|cf-browser-verification|challenge-platform|checking your browser|browser verification|attention required|captcha|enable javascript and cookies|proof of work/i.test(
        String(text || '')
    );

async function readCapped(res, cap) {
    const declared = Number(
        (res?.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null) || 0
    ) || 0;
    if (declared > cap) throw new UpstreamError('toolarge', 'الاستجابة أكبر من الحد المسموح');

    const body = res?.body;
    if (body && typeof body.getReader === 'function') {
        const reader = body.getReader();
        const chunks = [];
        let total = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = Buffer.from(value);
                total += chunk.length;
                if (total > cap) throw new UpstreamError('toolarge', 'الاستجابة أكبر من الحد المسموح');
                chunks.push(chunk);
            }
        } finally {
            try { await reader.cancel(); } catch {}
        }
        return Buffer.concat(chunks);
    }

    const raw = typeof res?.text === 'function' ? await res.text() : '';
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw ?? ''), 'utf8');
    if (buf.length > cap) throw new UpstreamError('toolarge', 'الاستجابة أكبر من الحد المسموح');
    return buf;
}

// طلب HTTP مع مهلة صارمة: لو المصدر ما ردش، ينتهي الطلب بعد المهلة بدل ما نعلق للأبد
async function fetchBody(url, options = {}) {
    const timeout = options.timeout ?? timeoutMs();
    const cap = options.maxBytes ?? MAX_BODY_BYTES;
    const controller = new AbortController();
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new UpstreamError('timeout', 'انتهت مهلة الاتصال بالمصدر'));
        }, timeout);
    });

    const request = fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    request.catch(() => {}); // أي رفض متأخر بعد انتهاء المهلة ما يقدرش يصير unhandled rejection

    try {
        const res = await Promise.race([request, timeoutPromise]);
        const buffer = await Promise.race([readCapped(res, cap), timeoutPromise]);
        return { res, buffer, text: buffer.toString('utf8') };
    } catch (e) {
        if (e instanceof UpstreamError) throw e;
        if (e?.name === 'AbortError') throw new UpstreamError('timeout', 'انتهت مهلة الاتصال بالمصدر');
        if (e instanceof TypeError && /fetch failed/i.test(e?.message || '')) {
            throw new UpstreamError('network', 'تعذر الاتصال بالمصدر');
        }
        throw new UpstreamError('network', e?.message || 'خطأ أثناء الاتصال');
    } finally {
        clearTimeout(timer);
    }
}

// يحوّل نص الاستجابة إلى JSON ويكتشف صفحات التحقق (HTML) بدل رمي خطأ parse
function parseJson(body) {
    const trimmed = String(body || '').trim();
    if (!trimmed) throw new UpstreamError('parse', 'استجابة فارغة');
    if (isHtml(trimmed) || isChallenge(trimmed)) {
        throw new UpstreamError('protected', 'المصدر رجع صفحة تحقق بدل JSON');
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        throw new UpstreamError('parse', 'استجابة غير صالحة من المصدر');
    }
}

// رسالة عربية موحّدة لكل أنواع الفشل
function errorText(e, fallback) {
    const kind = e?.kind;
    if (kind === 'protected') {
        return `${HEADER}\n❌ *المصدر محمي حالياً*\n🛡️ أمر المانهوا غير متاح مؤقتاً لأن المصدر يحمي نفسه، حاول لاحقاً.\n${HEADER}`;
    }
    if (kind === 'image') {
        return e?.message || '❌ تعذر تحميل الصورة';
    }
    if (kind === 'timeout' || kind === 'network' || kind === 'http') {
        return `${HEADER}\n❌ *تعذر الاتصال بالمصدر*\n⏳ أمر المانهوا غير متاح مؤقتاً، حاول مرة أخرى.\n${HEADER}`;
    }
    if (kind === 'toolarge') {
        return `${HEADER}\n❌ *الملف كبير جداً*\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.\n${HEADER}`;
    }
    return `${HEADER}\n${fallback}\n${HEADER}`;
}

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

async function mdGet(path, params = {}) {
    const url = new URL(`${API}${path}`);
    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            for (const item of value) url.searchParams.append(key, String(item));
        } else {
            url.searchParams.append(key, String(value));
        }
    }

    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const { res, text: body } = await fetchBody(url.toString(), {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' }
            });

            const status = Number(res?.status || 0);
            const ok = res?.ok === undefined ? status === 0 || status < 400 : !!res.ok;

            if (!ok) {
                if (isChallenge(body)) throw new UpstreamError('protected', 'صفحة تحقق');
                const err = new UpstreamError('http', `HTTP ${status}`);
                err.status = status;
                if (status === 429 || status >= 500) {
                    lastError = err;
                    await sleep(1000 * (attempt + 1));
                    continue;
                }
                throw err;
            }

            return parseJson(body);
        } catch (e) {
            lastError = e;
            // صفحات التحقق ما تنفعش معها إعادة محاولة
            if (e?.kind === 'protected') throw e;
            const status = e?.status;
            if (status === 429 || status >= 500) {
                await sleep(1000 * (attempt + 1));
                continue;
            }
            throw e;
        }
    }
    throw lastError;
}

// فحص بصمة الصورة: هل البايتات الأولى فعلاً بصمة صورة معروفة؟ (todo 24 attempt 3)
function looksLikeImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length === 0) return false;
    // JPEG: FF D8 FF
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    // GIF: 47 49 46 38
    if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
    // WebP: RIFF ???? WEBP
    if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return true;
    return false;
}

// سبب رفض استجابة صورة: يجب 200 + image/* (أو بلا Content-Type مع بصمة صالحة) + جسم غير فارغ بصورة حقيقية
function imageRejectionReason(res, buffer) {
    const status = Number(res?.status || 0);
    if (status !== 200) return `HTTP ${status} ليس 200`;
    const ctype = String(
        (typeof res?.headers?.get === 'function' ? res.headers.get('content-type') : null) || ''
    ).trim().toLowerCase();
    if (ctype && !ctype.startsWith('image/')) return `نوع المحتوى ${ctype} ليس صورة`;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return 'الاستجابة فارغة';
    if (!looksLikeImage(buffer)) return 'المحتوى ليس صورة (بصمة غير معروفة)';
    return null;
}

// جلب صورة صفحة مع تحقق صارم: أي استجابة ليست صورة حقيقية (HTML / فارغة / بصمة غريبة / ليس 200)
// ترمي خطأ عربي — الصورة المكسورة لا تدخل الـ ZIP أبداً (todo 24 attempt 3)
async function fetchBuffer(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { res, buffer } = await fetchBody(url, {
                headers: { 'User-Agent': UA },
                maxBytes: MAX_IMAGE_BYTES,
                timeout: Math.min(timeoutMs(), 60000)
            });

            const status = Number(res?.status || 0);
            if (status === 429 || status >= 500) {
                await sleep(1000 * (attempt + 1));
                continue;
            }

            const reason = imageRejectionReason(res, buffer);
            if (reason) {
                throw new UpstreamError('image', `❌ تعذر تحميل الصورة: ${reason}`);
            }

            return buffer;
        } catch (e) {
            if (e?.kind === 'image' || e?.kind === 'timeout' || e?.kind === 'network') throw e;
            if (e?.kind === 'toolarge') {
                throw new UpstreamError('image', '❌ تعذر تحميل الصورة: الحجم يتجاوز الحد المسموح');
            }
            const status = e?.status;
            if (status === 429 || status >= 500) {
                await sleep(1000 * (attempt + 1));
                continue;
            }
            throw new UpstreamError('image', `❌ تعذر تحميل الصورة: ${e?.message || 'خطأ غير معروف'}`);
        }
    }
    throw new UpstreamError('image', '❌ تعذر تحميل الصورة: انتهت محاولات إعادة المحاولة');
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
            console.log('Manhwa search error:', e?.kind || '', e?.message || e);
            await m.reply(errorText(e, '❌ *حدث خطأ أثناء البحث*'));
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
            console.log('Manhwa info error:', e?.kind || '', e?.message || e);
            await m.reply(errorText(e, '❌ *تعذر جلب تفاصيل المانهوا*'));
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
                try {
                    const probe = await fetchBuffer(`${baseUrl}/data-saver/${hash}/${saverFiles[0]}`);
                    if (!probe) useSaver = false;
                } catch {
                    useSaver = false;
                }
            }

            const files = (useSaver ? saverFiles : dataFiles).slice(0, MAX_PAGES);
            const folder = useSaver ? 'data-saver' : 'data';

            const zip = new JSZip();
            let pagesAdded = 0;
            let totalBytes = 0;
            let lastPageError = null;

            for (let i = 0; i < files.length; i++) {
                let buf = null;
                try {
                    buf = await fetchBuffer(`${baseUrl}/${folder}/${hash}/${files[i]}`);
                } catch (pageErr) {
                    // الصفحة المكسورة (HTML / فارغة / ليست صورة / خطأ شبكة) لا تدخل الـ ZIP أبداً
                    lastPageError = pageErr;
                    console.log('Manhwa page skipped:', files[i], pageErr?.message || pageErr);
                }
                if (buf) {
                    totalBytes += buf.length;
                    if (totalBytes > MAX_ZIP_BYTES) {
                        return m.reply(errorText({ kind: 'toolarge' }, '❌ *الملف كبير جداً*'));
                    }
                    const ext = (files[i].split('.').pop() || 'jpg').split('?')[0];
                    zip.file(`page_${String(i + 1).padStart(3, '0')}.${ext}`, buf);
                    pagesAdded++;
                }
                if (i < files.length - 1) await sleep(150);
            }

            if (pagesAdded === 0) {
                const kind = lastPageError?.kind;
                if (kind === 'timeout' || kind === 'network' || kind === 'http' || kind === 'toolarge') {
                    return m.reply(errorText(lastPageError, '❌ *تعذر تجهيز الفصل*'));
                }
                return m.reply(
                    `${HEADER}\n❌ *الأمر غير متاح مؤقتاً*\n⏳ تعذر تحميل صفحات الفصل من المصدر، حاول مرة أخرى لاحقاً.\n${HEADER}`
                );
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
            console.log('Manhwa download error:', e?.kind || '', e?.message || e);
            await m.reply(errorText(e, '❌ *تعذر تجهيز الفصل*'));
        }
        return;
    }
};

handler.usage = ["مانهوا", "عرض_مانهوا", "تحميل_فصل"];
handler.category = "downloads";
handler.command = ["مانهوا", "manhwa", "عرض_مانهوا", "manga_info", "تحميل_فصل", "zip"];

// مُصدَّر للاختبارات الوحدوية فقط (tests/unit.task-24.test.mjs)
export { fetchBuffer };

export default handler;
