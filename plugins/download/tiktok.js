// ─── plugins/download/tiktok.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - تحميل فيديوهات تيك توك
// المصدر: SSTik (https://ssstik.io/abc?url=dl) — POST.
// ملاحظة (todo 24): الطلب القديم كان بدون مهلة ولا حد حجم ولا التقاط أخطاء،
//                    فأي تعثر في الشبكة كان يرمي خطأ من المعالج.
//                    الآن: مهلة + حد حجم + try/catch + رسالة عربية واضحة + رفض الملفات الضخمة.

import cheerio from 'cheerio';
import { downloadTikTokViaRuhend } from '../../system/mediaService.js';

const SSSTIK = 'https://ssstik.io/abc?url=dl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ─── حدود الأمان ───
const TIMEOUT_MS = 20000;                 // مهلة الاتصال الافتراضية
const MAX_BODY_BYTES = 2 * 1024 * 1024;   // أقصى حجم لصفحة النتائج (2 ميغابايت)
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // أقصى حجم لفيديو تيك توك (100 ميغابايت)

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
        return '❌ *المصدر محمي حالياً*\n\n🛡️ أمر تحميل تيك توك غير متاح مؤقتاً لأن المصدر يحمي نفسه، حاول لاحقاً.';
    }
    if (kind === 'empty') {
        return '❌ *لم يتم العثور على فيديو*\n\n🔗 تأكد أن الرابط فيديو تيك توك صحيح.';
    }
    if (kind === 'toolarge') {
        return '❌ *الملف كبير جداً*\n\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.';
    }
    if (kind === 'http') {
        return '❌ *تعذر الاتصال بالمصدر*\n\n⚠️ المصدر غير متاح حالياً، حاول بعد قليل.';
    }
    return '❌ *تعذر الاتصال بالمصدر*\n\n⏳ أمر تحميل تيك توك غير متاح مؤقتاً، حاول مرة أخرى.';
}

const ff = async (m, { text, conn }) => {
  if (!text) return m.reply("*❌: حط رابط الفيديو بعد الأمر*");

  try {
    let videoData;
    try {
      videoData = await downloadTikTok(text);
    } catch (primaryErr) {
      try {
        videoData = await downloadTikTokViaRuhend(text);
      } catch {
        throw primaryErr;
      }
    }

    if (!videoData.videoUrl && !videoData.audioUrl) {
      throw new UpstreamError('empty', 'ما في روابط تحميل');
    }

    if (videoData.videoUrl) {
      const size = await probeSize(videoData.videoUrl);
      if (size && size > MAX_VIDEO_BYTES) {
        await m.reply('❌ *الملف كبير جداً*\n\n⚠️ الحجم يتجاوز الحد المسموح، تم إيقاف التحميل.');
        return;
      }
      await conn.sendMessage(m.chat, { video: { url: videoData.videoUrl }, caption: `🟢 ${videoData.description || "no description"}` });
    }

    if (videoData.audioUrl) {
      await conn.sendMessage(m.chat, { audio: { url: videoData.audioUrl }, mimetype: 'audio/mpeg' });
    }

  } catch (error) {
    console.error('[tiktok]', error?.kind || '', error?.message || error);
    try { await m.reply(upstreamMessage(error?.kind)); } catch {}
  }
};
ff.usage = ["تيك"]
ff.category = "downloads";
ff.command = ["تيك", "tiktok", "tt"];
export default ff;


async function downloadTikTok(url) {
  const data = new URLSearchParams({
    'id': String(url || ''),
    'locale': 'en',
    'tt': Math.random().toString(16).slice(2, 18),
  }).toString();

  const { res, text: html } = await fetchBody(SSSTIK, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html'
    },
    body: data
  });

  const status = Number(res?.status || 0);
  const ok = res?.ok === undefined ? status === 0 || status < 400 : !!res.ok;
  if (!ok) {
    if (isChallenge(html)) throw new UpstreamError('protected', 'صفحة تحقق');
    throw new UpstreamError('http', `HTTP ${status}`);
  }

  if (isChallenge(html)) throw new UpstreamError('protected', 'صفحة تحقق');

  const $ = cheerio.load(html || '');

  const videoUrl = $('a[href*="tikcdn.io"]:not(#hd_download)').first().attr('href');
  const audioUrl = $('.download_link.music').attr('href');

  if (!videoUrl && !audioUrl) {
    // صفحة بدون روابط: إمّا صفحة حماية (Cloudflare) أو نتيجة فارغة
    throw new UpstreamError(isHtml(html) && !/download_link|tikcdn/.test(html) ? 'protected' : 'empty', 'ما في روابط تحميل');
  }

  return {
    author: $('h2').first().text().trim(),
    description: $('.maintext').text().trim(),
    videoUrl,
    audioUrl,
    hdVideo: $('#hd_download').attr('href')
  };
}
