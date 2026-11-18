import axios from 'axios';
import { execFile } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── bounds ────────────────────────────────────────────────────────────────────
const REQUEST_TIMEOUT = 25000;
const MEDIA_SEND_CAP = 16 * 1024 * 1024;
const DOCUMENT_SEND_CAP = 1900 * 1024 * 1024;
const YTDLP_TIMEOUT = 120000;

// ── innertube clients ─────────────────────────────────────────────────────────
// Public keys that ship inside youtube.com pages — no API key needed. Verified
// 2026-11-15: ANDROID 20.10.38 returns full adaptive formats with direct URLs,
// IOS 20.10.4 is a reliable second client. WEB/TV clients trip bot checks.
const INNERTUBE_CLIENTS = [
  {
    name: 'ANDROID',
    version: '20.10.38',
    key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'
  },
  {
    name: 'IOS',
    version: '20.10.4',
    key: 'AIzaSyB-63vPrdThhKuerbB2N_l7KwwmDjCyT_4',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X;)'
  }
];

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player';
// yt-dlp fallback: prefer a single muxed file, otherwise let yt-dlp merge.
const YT_DLP_FALLBACK_FORMATS = {
  audio: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best',
  video: 'best[height<=720][ext=mp4]/18/22/best[ext=mp4]/best'
};

// Free public Piped instances (no key, no login). Ordered by reliability:
// verified 2026-11-18: wireway/private.coffee/ducks.party respond with streams.
const PIPED_INSTANCES = [
  'https://pipedapi.wireway.ch',
  'https://api.piped.private.coffee',
  'https://pipedapi.ducks.party',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.reallyaweso.me'
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://vid.puffyan.us'
];

const LOADER_API = 'https://loader.to/ajax/download.php';
const LOADER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  Referer: 'https://loader.to/'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── helpers ───────────────────────────────────────────────────────────────────

const withTimeout = async (promise, message) => {
  let handle;
  const timer = new Promise((_, reject) => {
    handle = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(handle);
  }
};

const fetchJson = async (url, options = {}) => {
  try {
    const { data } = await withTimeout(
      axios.get(url, { ...options, timeout: REQUEST_TIMEOUT, headers: { ...LOADER_HEADERS, ...(options.headers || {}) } }),
      'انتهت مهلة الاتصال بسيرفر التحميل'
    );
    return data;
  } catch (error) {
    if (error?.message?.startsWith('انتهت')) throw error;
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
      throw new Error('انتهت مهلة الاتصال بسيرفر التحميل');
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|502|503|504/i.test(String(error?.message))) {
      throw new Error('تعذر الاتصال بسيرفر التحميل، جرب تاني بعد شوية');
    }
    throw error;
  }
};

const extractVideoId = (value) => {
  const input = String(value || '').trim();
  const rawMatch = input.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (rawMatch) return rawMatch[1];

  const rawId = input.match(/^[A-Za-z0-9_-]{11}$/);
  if (rawId) return rawId[0];

  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let id = parsed.searchParams.get('v') || '';

    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (!id) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const markerIndex = parts.findIndex((part) => ['shorts', 'embed', 'live', 'v'].includes(part));
        if (markerIndex >= 0) id = parts[markerIndex + 1] || '';
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

const getMetadata = async (videoId) => {
  const fallback = {
    title: 'فيديو YouTube',
    author: 'YouTube',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const data = await fetchJson(oembedUrl);
    return {
      title: data?.title || fallback.title,
      author: data?.author_name || fallback.author,
      thumbnail: data?.thumbnail_url || fallback.thumbnail
    };
  } catch {
    return fallback;
  }
};

const estimateBytes = (format, durationSeconds) => {
  const declared = Number(format?.contentLength || 0);
  if (declared > 0) return declared;
  const bitrate = Number(format?.bitrate || 0);
  const seconds = Number(durationSeconds || 0);
  if (bitrate > 0 && seconds > 0) return Math.round((bitrate * seconds) / 8);
  return Number.POSITIVE_INFINITY;
};

const extensionFromMime = (mimeType, fallback = 'bin') => {
  const value = String(mimeType || '').toLowerCase();
  if (value.startsWith('audio/mp4') || value.startsWith('audio/m4a')) return 'm4a';
  if (value.startsWith('audio/webm')) return 'webm';
  if (value.startsWith('audio/mpeg')) return 'mp3';
  if (value.startsWith('audio/')) return 'm4a';
  if (value.startsWith('video/mp4')) return 'mp4';
  if (value.startsWith('video/webm')) return 'webm';
  return fallback;
};

const baseMime = (mimeType) => String(mimeType || '').split(';')[0].trim() || 'application/octet-stream';

// ── provider 1: youtube innertube (no API key) ────────────────────────────────

const playabilityError = (playabilityStatus) => {
  const status = String(playabilityStatus?.status || '');
  const reason = String(playabilityStatus?.reason || '');
  const isAge = status === 'AGE_VERIFICATION_REQUIRED' || /confirm your age|age.?restricted|age.?verification/i.test(reason);
  const isBotCheck = /confirm you (?:are|are not) a bot|not a bot|bot check|unusual traffic/i.test(reason)
    || (status === 'LOGIN_REQUIRED' && !isAge && !/private/i.test(reason));
  const isGone = status === 'ERROR' || /unavailable|removed|private|blocked|region|not available|no longer supported/i.test(reason);

  const message = isAge
    ? 'الفيديو محمي أو مقيّد بالعمر، مينفعش نحمّله من السيرفر'
    : isBotCheck
      ? 'يوتيوب رفض الطلب من السيرفر الأساسي (فحص البوت)، بنجرّب السيرفرات البديلة'
      : isGone
        ? 'الفيديو مش متاح (محذوف، خاص، أو ممنوع في المنطقة)'
        : status === 'LOGIN_REQUIRED'
          ? 'الفيديو محمي أو مقيّد بالعمر، مينفعش نحمّله من السيرفر'
          : reason || 'الفيديو مش متاح على يوتيوب';

  const error = new Error(message);
  // Age/private/removed/region errors are final — a proxy can't fix them.
  // Bot checks are transport-level: let the proxy providers try next.
  error.definitive = isAge || isGone;
  error.soft = isBotCheck;
  return error;
};

const requestPlayer = async (videoId, client) => {
  const { data } = await withTimeout(
    axios.post(
      `${PLAYER_URL}?key=${client.key}`,
      {
        videoId,
        context: {
          client: {
            clientName: client.name,
            clientVersion: client.version,
            hl: 'ar',
            gl: 'EG'
          }
        },
        contentCheckOk: true,
        racyCheckOk: true
      },
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'Accept-Language': 'ar-EG,ar;q=0.9'
        }
      }
    ),
    'انتهت مهلة الاتصال بيوتيوب'
  );
  return data;
};

const fetchViaInnertube = async (videoId) => {
  let lastError = new Error('تعذر جلب بيانات الفيديو من يوتيوب');
  let definitiveError = null;

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const data = await requestPlayer(videoId, client);
      const playability = data?.playabilityStatus;
      const details = data?.videoDetails;

      if (playability?.status === 'OK' && details) {
        const muxed = (data?.streamingData?.formatStreams || []).filter((f) => f?.url);
        const adaptive = (data?.streamingData?.adaptiveFormats || []).filter((f) => f?.url);
        if (muxed.length || adaptive.length) {
          return {
            source: 'innertube',
            title: details.title || '',
            author: details.author || '',
            thumbnail: details.thumbnail?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            durationSeconds: Number(details.lengthSeconds) || 0,
            muxed,
            adaptive
          };
        }
        lastError = new Error('الفيديو متاح بس مالقيناش روابط تحميل مفتوحة');
      } else if (playability) {
        const error = playabilityError(playability);
        if (error.definitive && !definitiveError) definitiveError = error;
        lastError = error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // A real age/private/removed verdict wins over a later transport hiccup, so
  // we don't fall through to proxies for a video that can never be fetched.
  throw definitiveError || lastError;
};

// ── provider 2: yt-dlp binary (optional) ──────────────────────────────────────

const findYtDlp = () => {
  if (process.env.YTDLP_BIN) return process.env.YTDLP_BIN;
  const names = process.platform === 'win32' ? ['yt-dlp.exe', 'yt-dlp'] : ['yt-dlp', 'youtube-dl'];
  const separator = process.platform === 'win32' ? ';' : ':';
  for (const dir of (process.env.PATH || '').split(separator)) {
    if (!dir) continue;
    for (const name of names) {
      try {
        const candidate = `${dir.replace(/[\\/]$/, '')}/${name}`;
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // not here, try the next candidate
      }
    }
  }
  return null;
};

const fetchViaYtDlp = async (videoId, isAudio) => {
  const binary = findYtDlp();
  if (!binary) throw new Error('yt-dlp غير متاح');

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const { stdout } = await execFileAsync(
      binary,
      ['--no-warnings', '--no-playlist', '-f', YTDLP_FALLBACK_FORMATS[isAudio ? 'audio' : 'video'], '-g', videoUrl],
      { timeout: YTDLP_TIMEOUT, maxBuffer: 4 * 1024 * 1024 }
    );
    const url = String(stdout || '').trim().split('\n').filter(Boolean)[0];
    if (!url) throw new Error('yt-dlp مرجعش رابط');
    return { source: 'yt-dlp', url };
  } catch (error) {
    throw new Error(error?.code === 'ETIMEDOUT' ? 'انتهت مهلة yt-dlp' : `yt-dlp فشل: ${error?.message || 'خطأ غير معروف'}`);
  }
};

// ── provider 3: piped API instances ───────────────────────────────────────────

const fetchViaPiped = async (videoId) => {
  let lastError = new Error('مفيش instance من Piped ردّ');

  for (const base of PIPED_INSTANCES) {
    try {
      const data = await fetchJson(`${base}/streams/${videoId}`);
      // Piped mixes progressive and video-only streams; keep only real muxed
      // (videoOnly !== true) and drop the LBRY placeholder (itag -1).
      const muxed = (data?.videoStreams || [])
        .filter((f) => f?.url && f.videoOnly !== true && f.itag !== -1)
        .map((f) => ({ ...f, mimeType: f.mimeType || f.type }));
      const adaptive = (data?.audioStreams || []).filter((f) => f?.url).map((f) => ({ ...f, mimeType: f.mimeType || f.type }));
      if (muxed.length || adaptive.length) {
        return {
          source: 'piped',
          title: data?.title || '',
          author: data?.uploaderName || '',
          thumbnail: data?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          durationSeconds: Number(data?.duration) || 0,
          muxed,
          adaptive
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError;
};

// ── provider 4: invidious instances ───────────────────────────────────────────

const fetchViaInvidious = async (videoId) => {
  let lastError = new Error('مفيش instance من Invidious ردّ');

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${base}/api/v1/videos/${videoId}`);
      const muxed = (data?.formatStreams || []).filter((f) => f?.url).map((f) => ({ ...f, mimeType: f.mimeType || f.type }));
      const adaptive = (data?.adaptiveFormats || []).filter((f) => f?.url).map((f) => ({ ...f, mimeType: f.mimeType || f.type }));
      if (muxed.length || adaptive.length) {
        return {
          source: 'invidious',
          title: data?.title || '',
          author: data?.author || '',
          thumbnail: (data?.videoThumbnails || []).slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          durationSeconds: Number(data?.lengthSeconds) || 0,
          muxed,
          adaptive
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError;
};

// ── provider 5: loader.to (kept as last resort) ───────────────────────────────

const fetchViaLoader = async (videoId, isAudio) => {
  const formats = isAudio ? ['mp3'] : ['720', '1080', '480', '360'];
  let lastError = new Error('سيرفر التحميل الاحتياطي مرجعش رابط');
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // loader.to answers with { success, progress_url, download_url }.
  // `url` is only the watch URL, so don't treat it as a download link.
  const looksLikeDownload = (value) => {
    const v = String(value || '');
    if (!v) return false;
    if (/youtube\.com\/watch|youtu\.be\//i.test(v)) return false;
    return /^https?:\/\//i.test(v) && /\.(mp4|mp3|m4a|webm|3gp)(\?|$)/i.test(v) || /\/download\//i.test(v);
  };

  for (const format of formats) {
    const endpoint = `${LOADER_API}?format=${encodeURIComponent(format)}&url=${encodeURIComponent(watchUrl)}`;

    try {
      const start = await fetchJson(endpoint);
      if (start?.success === false || start?.success === 0) {
        lastError = new Error(start?.message || 'سيرفر التحميل رفض الفيديو');
        continue;
      }

      const immediateUrl = start?.download_url || (looksLikeDownload(start?.url) ? start.url : null);
      if (immediateUrl) {
        return { source: 'loader.to', url: immediateUrl, mimeType: isAudio ? 'audio/mpeg' : 'video/mp4' };
      }

      if (start?.progress_url) {
        for (let attempt = 0; attempt < 40; attempt++) {
          await sleep(2000);
          const progress = await fetchJson(start.progress_url);
          const downloadUrl = progress?.download_url || (looksLikeDownload(progress?.url) ? progress.url : null);
          if (downloadUrl) {
            return { source: 'loader.to', url: downloadUrl, mimeType: isAudio ? 'audio/mpeg' : 'video/mp4' };
          }
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError;
};

// ── media selection ───────────────────────────────────────────────────────────

const chooseFromStreams = (info, isAudio) => {
  const durationSeconds = info.durationSeconds || 0;

  if (isAudio) {
    const pool = info.adaptive.filter((f) => /^audio\//.test(String(f.mimeType || '')));
    const best = pool.find((f) => String(f.mimeType).startsWith('audio/mp4')) || pool[0];
    if (!best) return null;
    const size = estimateBytes(best, durationSeconds);
    if (size > DOCUMENT_SEND_CAP) return null;
    return {
      url: best.url,
      mimeType: baseMime(best.mimeType),
      fileNameExt: extensionFromMime(best.mimeType, 'm4a'),
      kind: size <= MEDIA_SEND_CAP ? 'audio' : 'document',
      size,
      quality: String(best.audioQuality || best.bitrate || '')
    };
  }

  const muxed = info.muxed
    .filter((f) => /^video\/mp4/.test(String(f.mimeType || '')) && f.url)
    .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0));

  if (!muxed.length) return null;

  const fitting = muxed.find((f) => estimateBytes(f, durationSeconds) <= MEDIA_SEND_CAP);
  if (fitting) {
    return {
      url: fitting.url,
      mimeType: baseMime(fitting.mimeType),
      fileNameExt: extensionFromMime(fitting.mimeType, 'mp4'),
      kind: 'video',
      size: estimateBytes(fitting, durationSeconds),
      quality: `${fitting.height || '?'}p`
    };
  }

  const bestQuality = muxed[0];
  if (estimateBytes(bestQuality, durationSeconds) > DOCUMENT_SEND_CAP) return null;

  return {
    url: bestQuality.url,
    mimeType: baseMime(bestQuality.mimeType),
    fileNameExt: extensionFromMime(bestQuality.mimeType, 'mp4'),
    kind: 'document',
    size: estimateBytes(bestQuality, durationSeconds),
    quality: `${bestQuality.height || '?'}p`
  };
};

const chooseFromYtDlp = (result, isAudio) => {
  const url = result.url;
  let extension = 'mp4';
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
    if (match) extension = match[1].toLowerCase();
  } catch {
    // keep default
  }

  const mimeType = isAudio
    ? (extension === 'webm' ? 'audio/webm' : 'audio/mp4')
    : (extension === 'webm' ? 'video/webm' : 'video/mp4');

  return {
    url,
    mimeType,
    fileNameExt: extensionFromMime(mimeType, extension),
    kind: isAudio ? 'audio' : 'video',
    size: Number.POSITIVE_INFINITY,
    quality: 'yt-dlp'
  };
};

const getDownload = async (videoId, isAudio) => {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const attempts = [
    () => fetchViaInnertube(videoId),
    () => fetchViaYtDlp(videoId, isAudio),
    () => fetchViaPiped(videoId),
    () => fetchViaInvidious(videoId),
    () => fetchViaLoader(videoId, isAudio)
  ];

  let lastError = new Error('تعذر تجهيز رابط التحميل');
  let softError = null;

  for (const attempt of attempts) {
    try {
      const info = await attempt();

      if (info?.source === 'yt-dlp') {
        return chooseFromYtDlp(info, isAudio);
      }
      if (info?.source === 'loader.to') {
        return {
          url: info.url,
          mimeType: info.mimeType,
          fileNameExt: extensionFromMime(info.mimeType, isAudio ? 'mp3' : 'mp4'),
          kind: isAudio ? 'audio' : 'video',
          size: Number.POSITIVE_INFINITY,
          quality: 'loader.to'
        };
      }

      const chosen = chooseFromStreams(info, isAudio);
      if (chosen) {
        return { ...chosen, source: info.source, title: info.title || '' };
      }
      lastError = new Error(isAudio ? 'مالقيناش ملف صوتي نظيف للفيديو ده' : 'الفيديو كبير جداً على السيرفر، جرب صوت بدل الفيديو');
    } catch (error) {
      if (error?.definitive) throw error;
      // Bot-check/login errors are not fatal: remember them and keep trying the
      // free proxy providers below.
      if (error?.soft && !softError) softError = error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // If every provider failed and YouTube only ever complained about a bot
  // check, surface that reason instead of a generic transport error.
  throw softError || lastError;
};

const safeFileName = (title, extension) => {
  const clean = String(title || 'youtube')
    .replace(/[\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${clean || 'youtube'}.${extension}`;
};

const kindLabel = (kind, isAudio) => (isAudio ? 'صوت' : kind === 'document' ? 'ملف فيديو' : 'فيديو');

// ── command handler ───────────────────────────────────────────────────────────

const handler = async (m, { conn, command, args }) => {
  try {
    const text = args?.join(' ').trim() || '';
    if (!text) return m.reply('*ضع رابط يوتيوب بعد الأمر ❌*');

    const videoId = extractVideoId(text);
    if (!videoId) {
      return m.reply('*❌ الرابط غير صحيح، استخدم رابط فيديو من يوتيوب*');
    }

    const isAudio = command === 'يوت_اغنيه' || command === 'ytmp3';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const metadata = await getMetadata(videoId);
    const type = isAudio ? 'صوت' : 'فيديو';

    const caption = `*YouTube | يوتيوب ${type}*\n\n` +
      `╭───────────────╮\n` +
      `▸ العنوان: ${metadata.title}\n` +
      `▸ القناة: ${metadata.author}\n` +
      `╰───────────────╯\n` +
      `> جاري التجهيز والتحميل...`;

    await conn.sendMessage(m.chat, {
      image: { url: metadata.thumbnail },
      caption,
      contextInfo: {
        mentionedJid: [m.sender],
        externalAdReply: {
          title: metadata.title,
          body: metadata.author,
          thumbnailUrl: metadata.thumbnail,
          sourceUrl: videoUrl,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m });

    const media = await getDownload(videoId, isAudio);
    const filename = safeFileName(media.title || metadata.title, media.fileNameExt);
    const label = kindLabel(media.kind, isAudio);
    const caption2 = media.kind === 'document'
      ? `*${metadata.title}*\n\n_${label} — الحجم كبير فاتبعتلك كملف_`
      : `*${metadata.title}*`;

    const payload = media.kind === 'document'
      ? { document: { url: media.url }, mimetype: media.mimeType, fileName: filename, caption: caption2 }
      : media.kind === 'audio'
        ? { audio: { url: media.url }, mimetype: media.mimeType, fileName: filename }
        : { video: { url: media.url }, mimetype: media.mimeType, caption: caption2, fileName: filename };

    await conn.sendMessage(m.chat, payload, { quoted: m });

    console.log(`[yt] ${videoId} ${media.source || 'stream'} ${media.kind} ${media.quality || ''} ${media.size === Number.POSITIVE_INFINITY ? '' : `${Math.round(media.size / 1024 / 1024)}MB`}`.trim());
  } catch (error) {
    console.error('YouTube downloader:', error);
    const message = error?.message || 'حدث خطأ غير متوقع';
    await m.reply(`❌ ${message}\n\nجرب تاني بعد شوية، أو جرب فيديو تاني.`);
  }
};

handler.command = ['يوت_اغنيه', 'ytmp3', 'يوتيوب', 'يوت_فيديو', 'ytmp4', 'yt'];
handler.usage = ['يوتيوب <رابط>', 'يوت_اغنيه <رابط>'];
handler.category = 'downloads';
export default handler;