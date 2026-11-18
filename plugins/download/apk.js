// ─── plugins/download/apk.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - بحث وتحميل تطبيقات APK
// المصدر: Aptoide API العامة (https://ws75.aptoide.com/api/7/...)
// ملاحظة (todo 24): واجهة APKPure v2 القديمة ترجع 404 لكل طلب، لذلك تم استبدالها
//                    بمصدر Aptoide الذي يعمل، مع الحفاظ على نفس شكل الرسالة.
// كل طلب HTTP هنا له: مهلة زمنية + حد أقصى لحجم الاستجابة + try/catch + رسالة عربية واضحة.

const APTOIDE_SEARCH = 'https://ws75.aptoide.com/api/7/apps/search/query=';
const APTOIDE_LIMIT = 5;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ─── حدود الأمان ───
const TIMEOUT_MS = 20000;          // مهلة الاتصال الافتراضية
const MAX_BODY_BYTES = 2 * 1024 * 1024;   // أقصى حجم لاستجابة الـ API (2 ميغابايت)
const MAX_APK_BYTES = 300 * 1024 * 1024;  // أقصى حجم لملف APK المسموح إرساله (300 ميغابايت)

// خطأ مخصّص يميّز نوع الفشل حتى نختار الرسالة العربية المناسبة
class UpstreamError extends Error {
    constructor(kind, message) {
        super(message || kind);
        this.kind = kind; // timeout | network | protected | http | parse | empty | toolarge | invalid
    }
}

const timeoutMs = () => {
    const raw = Number(process.env.DOWNLOAD_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 100 ? Math.min(raw, 120000) : TIMEOUT_MS;
};

const isHtml = (text) => /^\s*</.test(String(text || ''));

const isChallenge = (text) =>
    /just a moment|cf-browser-verification|challenge-platform|checking your browser|browser verification|attention required|captcha/i.test(
        String(text || '')
    );

// يقرأ جسم الاستجابة مع سقف حجم لا يتجاوز الحد المسموح
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

// يحوّل نص الاستجابة إلى JSON، ويكتشف صفحات التحقق (HTML) بدل رمي خطأ parse
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

// رسالة عربية موحّدة لكل حالات الفشل
function upstreamMessage(kind) {
    if (kind === 'protected') {
        return '❌ *المصدر محمي حالياً*\n\n🛡️ أمر التحميل غير متاح مؤقتاً لأن المصدر يحمي نفسه، حاول لاحقاً.';
    }
    if (kind === 'toolarge') {
        return '❌ *الملف كبير جداً*\n\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.';
    }
    if (kind === 'invalid') {
        return '❌ *تعذر الاتصال بالمصدر*\n\n⚠️ رابط التحميل غير صالح، تم إيقاف التحميل.';
    }
    if (kind === 'http') {
        return '❌ *تعذر الاتصال بالمصدر*\n\n⚠️ المصدر غير متاح حالياً، حاول بعد قليل.';
    }
    return '❌ *تعذر الاتصال بالمصدر*\n\n⏳ أمر التحميل غير متاح مؤقتاً، حاول مرة أخرى.';
}

// لا نرسل إلا روابط https من نطاق Aptoide
function isAllowedLink(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        const host = u.hostname.toLowerCase();
        return host === 'aptoide.com' || host.endsWith('.aptoide.com');
    } catch {
        return false;
    }
}

const formatSize = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(2)} MB`;

const handler = async (m, { conn, text, command }) => {

    const query = String(text || '').trim();

    if (!query) {
        await conn.sendMessage(m.chat, {
            text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n⚠️ *يرجى كتابة اسم التطبيق للبحث عنه.* \n\n_طريقة الاستعمال:_\n.${command} Instagram`
        }, { quoted: m });
        return;
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: "📥", key: m.key } });

        // 1. البحث عن التطبيق في Aptoide
        const url = `${APTOIDE_SEARCH}${encodeURIComponent(query)}/limit=${APTOIDE_LIMIT}`;
        const { res, text: body } = await fetchBody(url, {
            headers: { 'User-Agent': UA, Accept: 'application/json' }
        });

        const status = Number(res?.status || 0);
        const ok = res?.ok === undefined ? status === 0 || status < 400 : !!res.ok;
        if (!ok) {
            if (isChallenge(body)) throw new UpstreamError('protected', 'صفحة تحقق');
            throw new UpstreamError('http', `HTTP ${status}`);
        }

        const data = parseJson(body);
        const list = data?.datalist?.list;

        if (!Array.isArray(list) || !list.length) {
            await conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n❌ *لم يتم العثور على التطبيق، تأكد من الاسم.*`
            }, { quoted: m });
            await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
            return;
        }

        const app = list[0];
        const fileInfo = app.file || {};

        const appName = app.name || app.uname || query;
        const appPackage = app.package || 'غير معروف';
        const appIcon = app.icon || '';
        const appVersion = fileInfo.vername || 'محدث';
        const appSize = Number(fileInfo.filesize || app.size || 0);
        const apkLink = fileInfo.path_alt || fileInfo.path || '';

        // 2. التحقق من الرابط والحجم قبل أي إرسال
        if (!apkLink || !isAllowedLink(apkLink)) {
            throw new UpstreamError('invalid', 'رابط تحميل غير صالح');
        }

        if (appSize > MAX_APK_BYTES) {
            await conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n❌ *حجم التطبيق كبير جداً (${formatSize(appSize)})، الحد المسموح ${formatSize(MAX_APK_BYTES)}.*`
            }, { quoted: m });
            await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
            return;
        }

        // 3. صياغة النص بأسلوب زخارف لايت بوت الشهير (نفس الشكل السابق)
        const caption = `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢
┃ *📱 ┇ مـعـلـومـات الـتـطـبـيـق (Aptoide)*
❐═━━━═╊⊰🩸⊱╉═━━━═❐

🌟 *┇ الـاســم:* ${appName}
📦 *┇ الـحـزمــة:* ${appPackage}
🕒 *┇ الـاصــدار:* ${appVersion}
💪 *┇ الـحـجــم:* ${formatSize(appSize)}

❐═━━━═╊⊰🩸⊱╉═━━━═❐
⏳ *جاري إرسال ملف الـ APK، يرجى الانتظار...*`;

        // 4. إرسال الأيقونة كصورة عادية جداً مع النص
        if (appIcon) {
            await conn.sendMessage(m.chat, {
                image: { url: appIcon },
                caption: caption
            }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
        }

        // تأخير بسيط لمدة ثانيتين للتأكد من إرسال الصورة أولاً دون تجميد البوت
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. إرسال ملف الـ APK
        await conn.sendMessage(m.chat, {
            document: { url: apkLink },
            fileName: `${appName}.apk`,
            mimetype: 'application/vnd.android.package-archive'
        }, { quoted: m });

        await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error('[apk]', e?.kind || '', e?.message || e);
        try { await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } }); } catch {}
        try {
            await conn.sendMessage(m.chat, { text: upstreamMessage(e?.kind) }, { quoted: m });
        } catch {}
    }
};

// إعدادات الأمر الخاصة بك بالملي
handler.usage = ['apk <اسم التطبيق>']; 
handler.category = 'downloads';
handler.command = ['apk']; 
handler.limit = true;

export default handler;
