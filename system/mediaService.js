/*
 * system/mediaService.js — Resilient shared media, logo, voice, GIF, upload, & scraper services
 * ==============================================================================================
 * Replaces broken third-party endpoints (auralix-api 403, emam-api 402, tenor 403, engez 404,
 * nekos.best missing-UA 403, ssstik 403) with working multi-provider fallbacks + local sharp/ffmpeg.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import * as ruhend from 'ruhend-scraper';

const execFileAsync = promisify(execFile);
const APP_UA = 'LightBot/1.0 (https://github.com/clonew50/light-bot)';
const BUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ── 1. Anime GIFs (nekos.best with proper App UA -> otakugifs.xyz fallback) ── */
export async function fetchAnimeGif(reaction, fetchImpl = fetch) {
  const clean = String(reaction || 'hug').toLowerCase().trim();
  const errors = [];

  try {
    const res = await fetchImpl(`https://nekos.best/api/v2/${encodeURIComponent(clean)}`, {
      headers: { 'User-Agent': APP_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });
    if (res.ok) {
      const data = await res.json();
      const first = data?.results?.[0];
      if (first?.url) {
        return { url: first.url, anime_name: first.anime_name || 'Anime', source: 'nekos.best' };
      }
    }
    errors.push(`nekos.best HTTP ${res.status}`);
  } catch (e) {
    errors.push(`nekos.best: ${e?.message || e}`);
  }

  try {
    const res = await fetchImpl(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(clean)}`, {
      headers: { 'User-Agent': APP_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.url) {
        return { url: data.url, anime_name: 'Anime Reaction', source: 'otakugifs' };
      }
    }
    errors.push(`otakugifs HTTP ${res.status}`);
  } catch (e) {
    errors.push(`otakugifs: ${e?.message || e}`);
  }

  throw new Error(`تعذر جلب الأنيمي GIF (${errors.join(' | ')})`);
}

/* ── 2. TextPro Local Graphic Logos via Sharp + SVG ── */
const LOGO_THEMES = {
  deepsea: { bg1: '#021124', bg2: '#004e89', c1: '#48cae4', c2: '#caf0f8', glow: '#00b4d8', stroke: '#03045e', badge: '🌊 DEEP SEA' },
  horror: { bg1: '#0a0000', bg2: '#3b0000', c1: '#ff2a2a', c2: '#ff8585', glow: '#d90429', stroke: '#000000', badge: '🩸 HORROR' },
  pink: { bg1: '#2d0320', bg2: '#7a0b52', c1: '#ff85c0', c2: '#ffd6e7', glow: '#ff4d94', stroke: '#4d0032', badge: '🌸 SAKURA' },
  candy: { bg1: '#2b0f3a', bg2: '#8b2f8e', c1: '#ff99c8', c2: '#fcf6bd', glow: '#a9def9', stroke: '#4a004e', badge: '🍬 CANDY' },
  christmas: { bg1: '#072415', bg2: '#14532d', c1: '#fef08a', c2: '#ffffff', glow: '#ef4444', stroke: '#991b1b', badge: '🎄 HOLIDAY' },
  luxury: { bg1: '#0d0d0d', bg2: '#1c1810', c1: '#ffd700', c2: '#fff3b0', glow: '#d4af37', stroke: '#4a3500', badge: '👑 LUXURY GOLD' },
  sky: { bg1: '#0c4a6e', bg2: '#38bdf8', c1: '#ffffff', c2: '#e0f2fe', glow: '#7dd3fc', stroke: '#0369a1', badge: '☁️ SKYLINE' },
  steel: { bg1: '#18181b', bg2: '#3f3f46', c1: '#f4f4f5', c2: '#94a3b8', glow: '#cbd5e1', stroke: '#09090b', badge: '⚙️ TITANIUM STEEL' },
  glue: { bg1: '#0f172a', bg2: '#1e293b', c1: '#e2e8f0', c2: '#38bdf8', glow: '#ffffff', stroke: '#0284c7', badge: '💧 GLOSSY 3D' },
  fabric: { bg1: '#271a14', bg2: '#5c3d2e', c1: '#f5ebe0', c2: '#e3d5ca', glow: '#d5bdaf', stroke: '#1d110b', badge: '🧵 WOVEN' },
  transformer: { bg1: '#050816', bg2: '#1d2d50', c1: '#00f5d4', c2: '#e2e8f0', glow: '#ef233c', stroke: '#0f172a', badge: '🤖 CYBER MECH' },
  toxic: { bg1: '#081404', bg2: '#1a3c0c', c1: '#aacc00', c2: '#d4ff33', glow: '#55a630', stroke: '#051002', badge: '☣️ TOXIC' },
  ancient: { bg1: '#1c1610', bg2: '#433422', c1: '#e6ccb2', c2: '#b08968', glow: '#7f5539', stroke: '#100c08', badge: '🏛️ ANCIENT STONE' },
  thunder: { bg1: '#06071a', bg2: '#231942', c1: '#fde047', c2: '#e0aaff', glow: '#9d4edd', stroke: '#10002b', badge: '⚡ THUNDERBOLT' },
  graphy: { bg1: '#111827', bg2: '#311042', c1: '#ff595e', c2: '#8ac926', glow: '#1982c4', stroke: '#000000', badge: '🌈 PRISM' },
  neon: { bg1: '#05010d', bg2: '#120329', c1: '#00f5d4', c2: '#f15bb5', glow: '#00bbf9', stroke: '#1a0033', badge: '💡 NEON GLOW' },
  frozen: { bg1: '#061826', bg2: '#0f4c75', c1: '#e0fbfc', c2: '#98c1d9', glow: '#3fc1c9', stroke: '#003554', badge: '❄️ FROZEN ICE' },
  naruto: { bg1: '#120902', bg2: '#3d1c02', c1: '#ff7b00', c2: '#ffd000', glow: '#ff4800', stroke: '#000000', badge: '🍥 SHINOBI STYLE' },
  pokemon: { bg1: '#091540', bg2: '#1e3a8a', c1: '#ffcb05', c2: '#ffea75', glow: '#3b82f6', stroke: '#1d4ed8', badge: '⚡ POCKET STYLE' },
  batman: { bg1: '#050505', bg2: '#1a1a1a', c1: '#facc15', c2: '#fef08a', glow: '#eab308', stroke: '#000000', badge: '🦇 GOTHAM KNIGHT' },
  engraved: { bg1: '#1f2421', bg2: '#495057', c1: '#dee2e6', c2: '#adb5bd', glow: '#ced4da', stroke: '#0b090a', badge: '🪨 CARVED RELIEF' }
};

export async function renderTextProLogo(effect, rawText) {
  const theme = LOGO_THEMES[effect] || LOGO_THEMES.neon;
  const label = String(rawText || 'LIGHT').trim().slice(0, 42);
  const safeText = xmlEscape(label);
  const len = label.length;
  const fontSize = len <= 6 ? 104 : len <= 12 ? 78 : len <= 20 ? 54 : len <= 30 ? 40 : 32;

  const isRainbow = effect === 'graphy';
  const stops = isRainbow
    ? `<stop offset="0%" stop-color="#ff595e"/><stop offset="25%" stop-color="#ffca3a"/><stop offset="55%" stop-color="#8ac926"/><stop offset="80%" stop-color="#1982c4"/><stop offset="100%" stop-color="#6a4c93"/>`
    : `<stop offset="0%" stop-color="${theme.c2}"/><stop offset="50%" stop-color="${theme.c1}"/><stop offset="100%" stop-color="${theme.glow}"/>`;

  const svg = `<svg width="900" height="450" viewBox="0 0 900 450" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bg1}"/>
        <stop offset="100%" stop-color="${theme.bg2}"/>
      </linearGradient>
      <linearGradient id="txtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        ${stops}
      </linearGradient>
      <radialGradient id="halo" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${theme.glow}" stop-opacity="0.40"/>
        <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="${theme.glow}" flood-opacity="0.75"/>
      </filter>
    </defs>
    <rect width="900" height="450" fill="url(#bg)"/>
    <ellipse cx="450" cy="225" rx="410" ry="180" fill="url(#halo)"/>
    <rect x="24" y="24" width="852" height="402" rx="28" fill="none" stroke="${theme.glow}" stroke-opacity="0.45" stroke-width="3"/>
    <rect x="38" y="38" width="824" height="374" rx="20" fill="none" stroke="${theme.c1}" stroke-opacity="0.18" stroke-width="1.5"/>
    <circle cx="95" cy="95" r="4" fill="${theme.c1}" opacity="0.6"/>
    <circle cx="805" cy="95" r="4" fill="${theme.c1}" opacity="0.6"/>
    <circle cx="95" cy="355" r="4" fill="${theme.c1}" opacity="0.6"/>
    <circle cx="805" cy="355" r="4" fill="${theme.c1}" opacity="0.6"/>
    <text x="450" y="92" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4" fill="${theme.c2}" opacity="0.85">${xmlEscape(theme.badge)}</text>
    <text x="450" y="245" text-anchor="middle" dominant-baseline="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="url(#txtGrad)" stroke="${theme.stroke}" stroke-width="4" paint-order="stroke" filter="url(#shadow)">${safeText}</text>
    <text x="450" y="385" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" font-weight="600" letter-spacing="3" fill="${theme.c1}" opacity="0.65">LIGHT BOT STUDIO</text>
  </svg>`;

  return await sharp(Buffer.from(svg)).png({ quality: 92 }).toBuffer();
}

export async function renderColorSwatch(hex, rgb, hsl) {
  const safeHex = xmlEscape(hex);
  const safeRgb = xmlEscape(rgb);
  const safeHsl = xmlEscape(hsl);
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const fg = luminance > 0.55 ? '#111827' : '#ffffff';

  const svg = `<svg width="420" height="420" viewBox="0 0 420 420" xmlns="http://www.w3.org/2000/svg">
    <rect width="420" height="420" rx="28" fill="${safeHex}"/>
    <rect x="24" y="290" width="372" height="106" rx="18" fill="#000000" fill-opacity="0.35"/>
    <text x="210" y="175" text-anchor="middle" font-family="DejaVu Sans, monospace" font-size="52" font-weight="900" fill="${fg}">${safeHex.toUpperCase()}</text>
    <text x="210" y="334" text-anchor="middle" font-family="DejaVu Sans, monospace" font-size="20" font-weight="700" fill="#ffffff">${safeRgb}</text>
    <text x="210" y="368" text-anchor="middle" font-family="DejaVu Sans, monospace" font-size="18" fill="#e2e8f0">${safeHsl}</text>
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/* ── 3. Reliable Media Upload Chain (uguu.se -> qu.ax -> catbox) ── */
export async function uploadMediaBuffer(buffer) {
  const info = (await fileTypeFromBuffer(buffer)) || { ext: 'bin', mime: 'application/octet-stream' };
  const filename = `${Date.now()}.${info.ext}`;
  const errors = [];

  try {
    const form = new FormData();
    form.append('files[]', buffer, { filename, contentType: info.mime });
    const { data } = await axios.post('https://uguu.se/upload.php', form, {
      headers: { ...form.getHeaders(), 'User-Agent': BUA },
      timeout: 45_000,
      maxBodyLength: Infinity
    });
    const url = data?.files?.[0]?.url;
    if (url && /^https?:\/\//i.test(url)) return url;
    errors.push('uguu: missing url');
  } catch (e) {
    errors.push(`uguu: ${e?.message || e}`);
  }

  try {
    const form = new FormData();
    form.append('files[]', buffer, { filename, contentType: info.mime });
    const { data } = await axios.post('https://qu.ax/upload.php', form, {
      headers: { ...form.getHeaders(), 'User-Agent': BUA },
      timeout: 45_000,
      maxBodyLength: Infinity
    });
    const url = data?.files?.[0]?.url;
    if (url && /^https?:\/\//i.test(url)) return url;
    errors.push('qu.ax: missing url');
  } catch (e) {
    errors.push(`qu.ax: ${e?.message || e}`);
  }

  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename, contentType: info.mime });
    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: { ...form.getHeaders(), 'User-Agent': APP_UA },
      timeout: 45_000,
      maxBodyLength: Infinity
    });
    const txt = String(data || '').trim();
    if (/^https?:\/\/.*catbox/i.test(txt)) return txt;
    errors.push('catbox: unexpected body');
  } catch (e) {
    errors.push(`catbox: ${e?.message || e}`);
  }

  throw new Error(`فشل رفع الملف (${errors.join(' | ')})`);
}

/* ── 4. Local FFmpeg Voice Changer (30 distinct audio effects, zero dead external APIs) ── */
const VOICE_FILTERS = {
  1: 'asetrate=44100*1.45,aresample=44100,atempo=0.92',
  2: 'asetrate=44100*0.68,aresample=44100,atempo=1.08',
  3: 'afftfilt=real=hypot(re\\,im)*sin(0):imag=hypot(re\\,im)*cos(0):win_size=512:overlap=0.75',
  4: 'aecho=0.8:0.88:220:0.45',
  5: 'highpass=f=350,lowpass=f=2400,acompressor',
  6: 'highpass=f=500,lowpass=f=1800,acrusher=bits=6:mode=log',
  7: 'asetrate=44100*1.75,aresample=44100',
  8: 'asetrate=44100*0.58,aresample=44100,bass=g=12',
  9: 'lowpass=f=500,aecho=0.6:0.4:60:0.3',
  10: 'atempo=1.45',
  11: 'atempo=0.72',
  12: 'bass=g=16:f=110:w=0.6',
  13: 'treble=g=12:f=3000',
  14: 'vibrato=f=6:d=0.6',
  15: 'flanger=delay=4:depth=6:speed=1.5',
  16: 'chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3',
  17: 'tremolo=f=8:d=0.7',
  18: 'aphaser=type=t:speed=1.5:decay=0.6',
  19: 'aecho=0.8:0.9:60|120:0.5|0.35',
  20: 'areverse',
  21: 'asetrate=44100*1.25,aresample=44100,vibrato=f=8:d=0.4',
  22: 'asetrate=44100*0.8,aresample=44100,aecho=0.8:0.8:120:0.4',
  23: 'highpass=f=450,lowpass=f=2200,aecho=0.5:0.5:30:0.2,volume=1.8',
  24: 'asetrate=44100*1.15,aresample=44100,atempo=0.88,chorus=0.6:0.9:55:0.4:0.25:2',
  25: 'asetrate=44100*0.75,aresample=44100,vibrato=f=3:d=0.5,lowpass=f=1800',
  26: 'aecho=0.8:0.85:40|80|160:0.45|0.35|0.25',
  27: 'acrusher=level_in=1:level_out=1:bits=4:mode=log:aa=1',
  28: 'asetrate=44100*1.6,aresample=44100,atempo=0.85',
  29: 'asetrate=44100*0.62,aresample=44100,bass=g=10,aecho=0.7:0.8:90:0.35',
  30: 'atempo=1.25,bass=g=8,treble=g=6'
};

export async function applyVoiceFilter(inputBuffer, effectNum = 1) {
  const filter = VOICE_FILTERS[Number(effectNum)] || VOICE_FILTERS[1];
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inPath = path.join(TMP_DIR, `vin_${uid}.audio`);
  const outPath = path.join(TMP_DIR, `vout_${uid}.mp3`);

  fs.writeFileSync(inPath, inputBuffer);
  try {
    await execFileAsync(
      'ffmpeg',
      ['-i', inPath, '-vn', '-af', filter, '-c:a', 'libmp3lame', '-b:a', '128k', outPath, '-y'],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
    );
    const outBuf = fs.readFileSync(outPath);
    if (!outBuf.length) throw new Error('ملف الصوت الناتج فارغ');
    return outBuf;
  } finally {
    for (const p of [inPath, outPath]) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
}

/* ── 5. Emoji Kitchen / Dual-Emoji Sticker Compositor ── */
function emojiToHexCodepoints(emoji) {
  return [...String(emoji || '').trim()]
    .map((ch) => ch.codePointAt(0))
    .filter((cp) => cp && cp !== 0xfe0f)
    .map((cp) => cp.toString(16).toLowerCase())
    .join('-');
}

async function fetchEmojiPng(emoji, fetchImpl = fetch) {
  const hex = emojiToHexCodepoints(emoji);
  if (!hex) return null;
  const urls = [
    `https://emoji.aranja.com/static/emoji-data/img-google-136/${hex}.png`,
    `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${hex}.png`
  ];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 100) return buf;
      }
    } catch {}
  }
  return null;
}

export async function createEmojiMixPng(emo1, emo2, fetchImpl = fetch) {
  const [b1, b2] = await Promise.all([fetchEmojiPng(emo1, fetchImpl), fetchEmojiPng(emo2, fetchImpl)]);
  if (!b1 && !b2) {
    throw new Error('تعذر تحميل الإيموجي المطلوبة');
  }
  const canvas = sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  });
  const layers = [];
  if (b1 && b2) {
    const base1 = await sharp(b1).resize(330, 330, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const base2 = await sharp(b2).resize(270, 270, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    layers.push({ input: base1, left: 40, top: 60 });
    layers.push({ input: base2, left: 205, top: 195 });
  } else {
    const only = await sharp(b1 || b2).resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    layers.push({ input: only, left: 46, top: 46 });
  }
  return await canvas.composite(layers).png().toBuffer();
}

/* ── 6. Pinterest & Image Search via Bing + Openverse ── */
export async function searchPinterestImages(query, count = 12, fetchImpl = fetch) {
  const q = String(query || '').trim();
  if (!q) return [];
  const results = [];
  const seen = new Set();

  for (const searchQ of [`site:pinterest.com ${q}`, `${q} aesthetic`]) {
    if (results.length >= count) break;
    try {
      const url = `https://www.bing.com/images/async?q=${encodeURIComponent(searchQ)}&first=0&count=25&mmasync=1`;
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': BUA, 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(12_000)
      });
      if (!res.ok) continue;
      const html = await res.text();
      const re = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const imgUrl = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
        if (!seen.has(imgUrl) && /\.(jpe?g|png|webp)(\?|$)/i.test(imgUrl)) {
          seen.add(imgUrl);
          results.push({
            url: imgUrl,
            pinUrl: imgUrl,
            title: `${q} #${results.length + 1}`,
            owner: imgUrl.includes('pinimg.com') ? 'Pinterest' : 'Bing Images'
          });
          if (results.length >= count) break;
        }
      }
    } catch {}
  }

  if (results.length < 3) {
    try {
      const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${count}`;
      const res = await fetchImpl(ovUrl, { headers: { 'User-Agent': APP_UA }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const data = await res.json();
        for (const item of data?.results || []) {
          if (item?.url && !seen.has(item.url)) {
            seen.add(item.url);
            results.push({
              url: item.url,
              pinUrl: item.foreign_landing_url || item.url,
              title: item.title || `${q} #${results.length + 1}`,
              owner: item.creator || 'Openverse'
            });
          }
        }
      }
    } catch {}
  }

  return results;
}

/* ── 7. Spotify oEmbed + YouTube Search/Resolve ── */
export async function resolveSpotifyTrack(spotifyUrl, fetchImpl = fetch) {
  const res = await fetchImpl(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {
    headers: { 'User-Agent': BUA },
    signal: AbortSignal.timeout(12_000)
  });
  if (!res.ok) throw new Error(`Spotify oEmbed HTTP ${res.status}`);
  const oembed = await res.json();
  const title = String(oembed?.title || '').trim();
  if (!title) throw new Error('تعذر قراءة بيانات أغنية سبوتيفاي');

  const ytRes = await ruhend.ytsearch(title);
  const videos = ytRes?.video || ytRes?.results || ytRes?.data || [];
  const first = Array.isArray(videos) ? videos[0] : null;
  if (!first?.videoId && !first?.url) throw new Error('لم يتم العثور على مطابقة يوتيوب للأغنية');

  const videoId = first.videoId || (first.url.match(/[?&]v=([A-Za-z0-9_-]{11})/) || [])[1];
  return {
    name: title,
    thumbnail: oembed.thumbnail_url || first.thumbnail || '',
    videoId,
    youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : first.url
  };
}

/* ── 8. TikTok Downloader via ruhend.ttdl / tikwm ── */
export async function downloadTikTokViaRuhend(url) {
  const data = await ruhend.ttdl(url);
  const videoUrl = data?.video || data?.nowm || data?.hdplay || data?.play;
  const audioUrl = data?.music || data?.audio;
  if (!videoUrl && !audioUrl) throw new Error('ruhend ttdl مرجعش رابط فيديو');
  return {
    author: data?.author || '',
    description: data?.title || '',
    videoUrl,
    audioUrl
  };
}

/* ── 9. YouTube Search Helper ── */
export async function searchYouTubeEdits(query, limit = 5) {
  const res = await ruhend.ytsearch(query);
  const raw = res?.video || res?.results || res?.data || [];
  return (Array.isArray(raw) ? raw : []).slice(0, limit).map((v) => ({
    title: v.title || 'YouTube Video',
    id: v.videoId || '',
    url: v.url || (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : ''),
    thumbnail: v.thumbnail || '',
    duration: v.duration?.timestamp || v.timestamp || '',
    author: v.authorName || v.author || ''
  }));
}

export default {
  fetchAnimeGif,
  renderTextProLogo,
  renderColorSwatch,
  uploadMediaBuffer,
  applyVoiceFilter,
  createEmojiMixPng,
  searchPinterestImages,
  resolveSpotifyTrack,
  downloadTikTokViaRuhend,
  searchYouTubeEdits
};
