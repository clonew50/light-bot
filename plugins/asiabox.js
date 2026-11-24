// plugins/asiabox.js - REM BOT by yono - ASIABOX DRAMA
import axios from 'axios'

const BASE = 'https://asiaboxdrama.com';
const LANG = 'id';
const CREATOR = 'IzzXd';
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, cookie) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const headers = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'id-ID,id;q=0.9' };
      if (cookie) headers.cookie = cookie;
      const res = await axios.get(url, { headers, timeout: 30000 });
      return res.data;
    } catch (e) {
      err = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw err;
}

function flight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = ''; let m;
  while ((m = re.exec(html))) { try { out += JSON.parse('"' + m[1] + '"'); } catch {} }
  return out;
}

function grab(text, key) {
  const res = []; const needle = '"' + key + '":'; let i = text.indexOf(needle);
  while (i!== -1) {
    const s = i + needle.length; const open = text[s];
    if (open === '[' || open === '{') {
      const close = open === '['? ']' : '}';
      let depth = 0, inStr = false, esc = false, j = s;
      for (; j < text.length; j++) {
        const c = text[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close && --depth === 0) break;
      }
      try { res.push(JSON.parse(text.slice(s, j + 1))); } catch {}
    }
    i = text.indexOf(needle, i + needle.length);
  }
  return res;
}

function uniq(arr) {
  const map = new Map();
  for (const x of arr) {
    const k = x && (x.id || x.slug);
    if (k &&!map.has(k)) map.set(k, x);
  }
  return [...map.values()];
}

const item = (e) => ({
  id: e.id, title: e.title, slug: e.slug, image: e.image, episodes: e.episodes_count,
  views: e.views, genres: (e.tags || []).map((t) => t.name), description: e.description,
  url: BASE + '/' + LANG + '/movie/' + e.slug, created_at: e.created_at, updated_at: e.updated_at
});

const watchUrl = (slug, n) => BASE + '/' + LANG + '/watch/' + slug + '/episode/' + n;

function fromHtml(html) {
  const seen = new Set(); const out = [];
  for (const m of html.matchAll(/href="\/id\/(?:movie|episode-list)\/([a-z0-9-]+)"/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ slug: m[1], url: BASE + '/' + LANG + '/movie/' + m[1] });
  }
  return out;
}

function collect(text) {
  const keys = ['movies', 'films', 'dramas', 'items', 'list', 'results', 'data'];
  let out = [];
  for (const k of keys) {
    for (const v of grab(text, k)) {
      if (Array.isArray(v)) out.push(...v);
      else if (v && Array.isArray(v.data)) out.push(...v.data);
      else if (v && v.id && v.slug) out.push(v);
    }
  }
  return uniq(out.filter((o) => o && o.slug));
}

async function listing(url) {
  const html = await get(url); const text = flight(html);
  let data = collect(text).map(item);
  if (!data.length) data = fromHtml(html).map((o) => ({ slug: o.slug, title: o.slug, url: o.url }));
  return {
    source: url,
    pagination: grab(text, 'pagination').find((p) => p && (p.page || p.total)) || null,
    total_item: data.length, data
  };
}

function findFilm(text, slug) {
  for (const key of ['film', 'datafilm', 'data', 'entries']) {
    for (const v of grab(text, key)) {
      const hit = (Array.isArray(v)? v : [v]).find((o) => o && o.slug === slug && o.title);
      if (hit) return hit;
    }
  }
  return null;
}

function findEpisodes(text) {
  const all = grab(text, 'episodes').filter(Array.isArray);
  return all.sort((a, b) => b.length - a.length)[0] || [];
}

async function detail(slug) {
  const text = flight(await get(BASE + '/' + LANG + '/movie/' + slug));
  const film = findFilm(text, slug);
  if (!film) throw new Error('Film tidak ketemu: ' + slug);
  let eps = findEpisodes(text);
  if (!eps.length) {
    const t2 = flight(await get(BASE + '/' + LANG + '/episode-list/' + slug));
    eps = findEpisodes(t2);
  }
  return {
    film: item(film),
    total_episode: eps.length,
    episodes: eps.map((e) => ({...e, watch_url: watchUrl(slug, e.number) }))
  };
}

async function episode(slug, num, id) {
  const cookie = id? 'movie=' + encodeURIComponent(JSON.stringify({ id, slug })) : undefined;
  const text = flight(await get(watchUrl(slug, num), cookie));
  const cur = grab(text, 'currentEpisode')[0] || findEpisodes(text).find((e) => String(e.number) === String(num)) || null;
  const files = cur? [] : [...new Set(text.match(/https?:\/\/[^"\\\s]+?\.(?:mp4|m3u8|vtt|srt|ass)[^"\\\s]*/gi) || [])];
  const direct = cur? null : (text.match(/"video":"([^"]+)"/) || [])[1];
  const video = (cur && cur.video) || direct || files.find((u) => /\.(mp4|m3u8)/i.test(u)) || null;
  const subtitle = (cur && (cur.subtitle || cur.subtitle_url || cur.sub)) || files.find((u) => /\.(vtt|srt|ass)/i.test(u)) || null;
  return { number: Number(num), watch_url: watchUrl(slug, num), video, subtitle, detail: cur };
}

// ===== REM BOT HANDLER =====
let handler = async (m, { conn, args, usedPrefix, command }) => {
  const subCmd = args[0]? args[0].toLowerCase() : '';
  const query = args.slice(1).join(' ');

  if (!subCmd) {
    return await conn.reply(m.chat,
      `🎬 *ASIABOX DRAMA SCRAPER* 🎬\n\n`+
      `Gunakan perintah:\n`+
      `*${usedPrefix + command} search [judul]* - Cari drama/film\n`+
      `*${usedPrefix + command} detail [slug]* - Info detail drama\n`+
      `*${usedPrefix + command} eps [slug] [nomor]* - Download langsung videonya\n`, m
    );
  }

  try {
    if (subCmd === 'search' || subCmd === 's') {
      if (!query) return await conn.reply(m.chat, '⚠️ Masukkan judul drama!', m);
      await conn.reply(m.chat, '⏳ _Mencari drama di Asiabox..._', m);
      const q = new URLSearchParams({ drama: query, page: '1' });
      const res = await listing(BASE + '/' + LANG + '/search?' + q.toString());
      if (!res.data ||!res.data.length) return await conn.reply(m.chat, '❌ Drama tidak ditemukan.', m);
      let text = `🔍 *HASIL PENCARIAN:* "${query}"\n\n`;
      res.data.slice(0, 8).forEach((s, i) => {
        text += `${i + 1}. *${s.title}*\n 🆔 Slug: ${s.slug}\n 🔗 Detail: *${usedPrefix + command} detail ${s.slug}*\n\n`;
      });
      text += `_Creator: ${CREATOR}_`;
      if (res.data[0].image) {
        await conn.sendMessage(m.chat, { image: { url: res.data[0].image }, caption: text }, { quoted: m });
      } else {
        await conn.reply(m.chat, text, m);
      }
    }
    else if (subCmd === 'detail' || subCmd === 'd') {
      if (!query) return await conn.reply(m.chat, `⚠️ Masukkan slug drama! Contoh: *${usedPrefix + command} detail the-judge-from-hell*`, m);
      await conn.reply(m.chat, '⏳ _Mengambil detail drama..._', m);
      const res = await detail(query);
      const film = res.film;
      let text = `🎬 *DETAIL DRAMA* 🎬\n\n📌 *Judul:* ${film.title}\n🎭 *Genre:* ${film.genres? film.genres.join(', ') : '-'}\n📺 *Total Episode:* ${res.total_episode}\n\n💡 *Cara Download:*\nKetik *${usedPrefix + command} eps ${film.slug} 1*\n\n_Creator: ${CREATOR}_`;
      if (film.image) {
        await conn.sendMessage(m.chat, { image: { url: film.image }, caption: text }, { quoted: m });
      } else {
        await conn.reply(m.chat, text, m);
      }
    }
    else if (subCmd === 'eps' || subCmd === 'e') {
      const slug = args[1];
      const epsNum = args[2];
      if (!slug ||!epsNum) return await conn.reply(m.chat, `⚠️ Format salah! Gunakan: *${usedPrefix + command} eps [slug] [nomor]*`, m);

      await conn.reply(m.chat, `⏳ _Mengambil link episode ${epsNum}..._`, m);
      let id; try { id = (await detail(slug)).film.id; } catch (e) {}
      const res = await episode(slug, epsNum, id);

      if (!res.video) return await conn.reply(m.chat, '❌ Link video tidak ditemukan.', m);

      if (res.video.includes('.m3u8')) {
          return await conn.reply(m.chat, `⚠️ Video berformat streaming (.m3u8) tidak bisa dikirim langsung ke WhatsApp.\n\nSilakan tonton manual lewat link ini:\n${res.video}${res.subtitle? `\n\n📝 *Subtitle:* ${res.subtitle}` : ''}`, m);
      }

      await conn.reply(m.chat, '🚀 _Link MP4 ditemukan! Sedang mendownload dan mengirim video..._', m);

      try {
          const vidRes = await axios.get(res.video, { responseType: 'arraybuffer', timeout: 0 });
          const vidBuffer = Buffer.from(vidRes.data);

          await conn.sendMessage(m.chat, {
              document: vidBuffer,
              mimetype: 'video/mp4',
              fileName: `${slug}-Eps-${epsNum}.mp4`,
              caption: `🎬 *${slug}* - Episode ${epsNum}`
          }, { quoted: m });
      } catch (err) {
          await conn.reply(m.chat, `⚠️ Gagal mengirim video karena ukuran terlalu besar.\n\nDownload manual:\n${res.video}`, m);
      }
    }
  } catch (error) {
    console.error('[AsiaBox Error]:', error);
    await conn.reply(m.chat, '⚠️ Terjadi kesalahan: ' + error.message, m);
  }
}

handler.help = ['asiabox']
handler.tags = ['search']
handler.command = /^(asiabox|drakor|drama|abox)$/i

export default handler