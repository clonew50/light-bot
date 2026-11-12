// ─── plugins/download/fb.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - تحميل فيديوهات الفيسبوك
// المصدر: FDownloader v3 (https://v3.fdownloader.net/api/ajaxSearch) — يقبل POST فقط.
// ملاحظة (todo 24): نقطة التحقق القديمة (userverify) ترجع 404/403
//                    و ajaxSearch ما عادش يقبل بدون خطوة التحقق، لذلك:
//                    - نحاول سحب التوكنات من الصفحة الرئيسية (خطوة اختيارية، فشلها ما يوقفش الأمر)
//                    - نستدعي ajaxSearch مباشرة ونحلل الصفحة المرجعة
//                    - أي فشل (تعذر الاتصال / حماية / محتوى غير مفهوم) = رسالة عربية واضحة بدل كراش.
// كل طلب HTTP له مهلة + حد أقصى للحجم + try/catch.

import cheerio from 'cheerio';

const FDL_SEARCH = 'https://v3.fdownloader.net/api/ajaxSearch';
const FDL_HOME = 'https://fdownloader.net/id';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ─── حدود الأمان ───
const TIMEOUT_MS = 20000;                 // مهلة الاتصال الافتراضية
const MAX_BODY_BYTES = 2 * 1024 * 1024;   // أقصى حجم لصفحة النتائج (2 ميغابايت)
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // أقصى حجم لفيديو الفيسبوك (100 ميغابايت)

class UpstreamError extends Error {
    constructor(kind, message) {
        super(message || kind);
        this.kind = kind; // timeout | network | protected | http | parse | empty | toolarge
    }
}

const timeoutMs = () => {
    const raw = Number(process.env.DOWNLOAD_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 100 ? Math.min(raw, 120000) : TIMEOUT_MS;
};

const isHtml = (text) => /^\s*</.test(String(text || ''));

const isChallenge = (text) =>
    /just a moment|cf-browser-verification|challenge-platform|checking your browser|browser verification|attention required|captcha|enable javascript and cookies/i.test(
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

// يفحص حجم الملف عبر Range request بدون تنزيله (سقف صغير جداً)
async function probeSize(url) {
    let res;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs(), 10000));
    try {
        res = await fetch(url, {
            headers: { Range: 'bytes=0-0', 'User-Agent': UA },
            signal: controller.signal,
            redirect: 'follow'
        });
        const range = res?.headers && typeof res.headers.get === 'function' ? res.headers.get('content-range') : '';
        const match = /\/(\d+)\s*$/.exec(String(range || ''));
        if (match) return Number(match[1]);
        const len = Number(res?.headers?.get?.('content-length') || 0) || 0;
        return len > 0 ? len : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        try { await res?.body?.cancel?.(); } catch {}
    }
}

function upstreamMessage(kind) {
    if (kind === 'protected') {
        return '❌ *المصدر محمي حالياً*\n\n🛡️ أمر تحميل الفيسبوك غير متاح مؤقتاً لأن المصدر يحمي نفسه، حاول لاحقاً.';
    }
    if (kind === 'empty') {
        return '❌ *لا يوجد فيديو متاح للتحميل*\n\n🔗 تأكد أن الرابط فيديو فيسبوك صحيح.';
    }
    if (kind === 'toolarge') {
        return '❌ *الملف كبير جداً*\n\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.';
    }
    if (kind === 'http') {
        return '❌ *تعذر الاتصال بالمصدر*\n\n⚠️ المصدر غير متاح حالياً، حاول بعد قليل.';
    }
    return '❌ *تعذر الاتصال بالمصدر*\n\n⏳ أمر تحميل الفيسبوك غير متاح مؤقتاً، حاول مرة أخرى.';
}

// يحاول سحب توكنات النموذج من الصفحة الرئيسية (أفضل-م возмож) — الفشل لا يوقف الأمر
async function harvestTokens() {
    try {
        const { res, text: html } = await fetchBody(FDL_HOME, {
            headers: { 'User-Agent': UA, Accept: 'text/html' },
            timeout: Math.min(timeoutMs(), 12000)
        });
        const status = Number(res?.status || 0);
        const ok = res?.ok === undefined ? status === 0 || status < 400 : !!res.ok;
        if (!ok || isChallenge(html)) return {};
        const $ = cheerio.load(html);
        const value = (name) => $('input[name="' + name + '"]').attr('value') || '';
        return {
            k_token: value('k_token'),
            k_exp: value('k_exp'),
            cftoken: value('cftoken') || $('meta[name="csrf-token"]').attr('content') || ''
        };
    } catch {
        return {};
    }
}

// يستخرج روابط الجودات من صفحة النتائج
function parseDownloads(html) {
    const $ = cheerio.load(html || '');
    const downloads = [];

    $('table.table tbody tr').each((_, el) => {
        const quality = $(el).find('.video-quality').text().trim();
        const url = $(el).find('a.download-link-fb').attr('href');
        if (url) downloads.push({ quality: quality || 'HD', url });
    });

    if (!downloads.length) {
        $('a.download-link-fb').each((_, el) => {
            const url = $(el).attr('href');
            if (url) downloads.push({ quality: $(el).text().trim() || 'HD', url });
        });
    }

    return downloads;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  const url = String(text || '').trim();

  if (!url) {
    await m.reply(`*ضع رابط الفيديو من الفيس بوت بعد الامر*\n\nمثال:\n/${command} https://www.facebook.com/reel/xxxxxx`);
    return;
  }

  try { await m.react('💙'); } catch {}

  try {
    const tokens = await harvestTokens();

    const body = new URLSearchParams({
      q: url,
      lang: 'id',
      web: 'fdownloader.net',
      v: 'v2',
      w: '',
      k_exp: tokens.k_exp || '',
      k_token: tokens.k_token || '',
      cftoken: tokens.cftoken || ''
    }).toString();

    const { res, text: html } = await fetchBody(FDL_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'User-Agent': UA,
        'Referer': FDL_HOME,
        'Origin': 'https://fdownloader.net',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body
    });

    const status = Number(res?.status || 0);
    const ok = res?.ok === undefined ? status === 0 || status < 400 : !!res.ok;

    if (!ok) {
      if (isChallenge(html)) throw new UpstreamError('protected', 'صفحة تحقق من Cloudflare');
      throw new UpstreamError('http', `HTTP ${status}`);
    }

    if (isChallenge(html)) throw new UpstreamError('protected', 'صفحة تحقق من Cloudflare');

    const downloads = parseDownloads(html);

    if (!downloads.length) {
      // صفحة النتائج الحقيقية فيها جدول — لو ما فيه روابط، الفيديو غير متاح.
      // بدون جدول = صفحة حماية/خطأ، نعطي رسالة "المصدر محمي حالياً".
      const $ = cheerio.load(html || '');
      const hasResultsTable = $('table.table').length > 0;
      throw new UpstreamError(hasResultsTable ? 'empty' : 'protected', 'ما في روابط تحميل');
    }

    const link = downloads[0].url;

    if (!/^https?:\/\//i.test(link)) throw new UpstreamError('protected', 'رابط غير صالح');

    const size = await probeSize(link);
    if (size && size > MAX_VIDEO_BYTES) {
      await m.reply('❌ *الملف كبير جداً*\n\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.');
      try { await m.react('❌'); } catch {}
      return;
    }

    const caption = `> *تم بواسطة ~ ${m.pushName}*`;

    await conn.sendMessage(m.chat, {
      video: { url: link },
      caption
    }, { quoted: m });

    try { await m.react('✅'); } catch {}

  } catch (e) {
    console.error('[fb]', e?.kind || '', e?.message || e);
    try { await m.react('❌'); } catch {}
    try { await m.reply(upstreamMessage(e?.kind)); } catch {}
  }
};

handler.usage = ["فيس"]
handler.category = "downloads";
handler.command = /^(فيس|فيسبوك|fb|fbdl|facebook)$/i;

export default handler;
