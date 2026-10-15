const LOADER_API = 'https://loader.to/ajax/download.php';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  Referer: 'https://loader.to/'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options = {}, timeout = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...HEADERS,
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`استجابة غير صالحة من سيرفر التحميل (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(data?.message || `سيرفر التحميل رجّع خطأ ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بسيرفر التحميل');
    }
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      throw new Error('تعذر الاتصال بسيرفر التحميل، جرب تاني بعد شوية');
    }
    throw error;
  } finally {
    clearTimeout(timer);
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
    const data = await fetchJson(oembedUrl, {}, 10000);
    return {
      title: data.title || fallback.title,
      author: data.author_name || fallback.author,
      thumbnail: data.thumbnail_url || fallback.thumbnail
    };
  } catch {
    return fallback;
  }
};

const getDownload = async (videoUrl, isAudio) => {
  const formats = isAudio ? ['mp3'] : ['720', '1080', '480', '360'];
  let lastError = new Error('لم يتم تجهيز رابط التحميل');

  for (const format of formats) {
    const endpoint = `${LOADER_API}?format=${encodeURIComponent(format)}&url=${encodeURIComponent(videoUrl)}`;
    const start = await fetchJson(endpoint);
    const immediateUrl = start?.download_url || start?.url;

    if (immediateUrl) {
      return { url: immediateUrl, title: start.title || '', format };
    }

    if (!start?.progress_url) {
      lastError = new Error(start?.message || `سيرفر التحميل لا يدعم الجودة ${format}`);
      continue;
    }

    let lastMessage = start.text || 'جاري تجهيز الملف';

    for (let attempt = 0; attempt < 45; attempt++) {
      await sleep(2000);

      try {
        const progress = await fetchJson(start.progress_url, {}, 12000);
        const downloadUrl = progress?.download_url || progress?.url;
        if (downloadUrl) {
          return { url: downloadUrl, title: progress.title || start.title || '', format };
        }

        if (progress?.text) lastMessage = progress.text;
        if (progress?.message && /error|fail|invalid|private/i.test(progress.message)) {
          throw new Error(progress.message);
        }
      } catch (error) {
        lastError = error;
        if (/error|fail|invalid|private/i.test(error.message || '')) break;
      }
    }

    lastError = new Error(`انتهت مهلة التحضير (${lastMessage})`);
  }

  throw lastError;
};

const safeFileName = (title, extension) => {
  const clean = String(title || 'youtube')
    .replace(/[\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${clean || 'youtube'}.${extension}`;
};

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

    const media = await getDownload(videoUrl, isAudio);
    const filename = safeFileName(media.title || metadata.title, isAudio ? 'mp3' : 'mp4');

    if (isAudio) {
      await conn.sendMessage(m.chat, {
        audio: { url: media.url },
        mimetype: 'audio/mpeg',
        fileName: filename
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, {
        video: { url: media.url },
        mimetype: 'video/mp4',
        caption: `*${metadata.title}*`,
        fileName: filename
      }, { quoted: m });
    }
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
