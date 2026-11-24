import axios from 'axios';

const BASE = 'https://insget.net';
const UA = 'Mozilla/5.0 (Linux; Android 15; RMX3930 Build/AP3A.240905.015.A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36';
const MAX_ITEMS = 5;
const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/\S+/i;

function createJar() {
  const jar = { locale: 'en' };
  return {
    update(res) {
      for (const c of res.headers['set-cookie'] || []) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
    get: (k) => jar[k]
  };
}

async function call(jar, method, path, { form, xhr = false, binary = false } = {}) {
  const headers = {
    'User-Agent': UA,
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Cookie: jar.header(),
    Referer: `${BASE}/nl`
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers.Origin = BASE;
    const xsrf = jar.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    if (xhr) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers.Accept = 'application/json, text/javascript, */*; q=0.01';
    } else {
      headers.Accept = 'text/html,application/xhtml+xml,*/*;q=0.8';
    }
  }

  const res = await axios({
    method,
    url: BASE + path,
    headers,
    data: form ? new URLSearchParams(form).toString() : undefined,
    responseType: binary ? 'arraybuffer' : 'text',
    timeout: 60000,
    maxContentLength: 80 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
    validateStatus: () => true
  });
  jar.update(res);
  return res;
}

function parseItems(html) {
  const items = [];
  const forms = html.split(/<form[^>]+name="media-download-/).slice(1);
  for (const f of forms) {
    const token = /name="_token"\s+value="([^"]*)"/.exec(f)?.[1];
    const username = /name="username"\s+value="([^"]*)"/.exec(f)?.[1] || '';
    const opts = [...f.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g)]
      .map((x) => ({ value: x[1], label: x[2].trim() }));
    if (token && opts.length) items.push({ token, username, opts });
  }
  return items;
}

function pickBest(opts) {
  const num = (o) => parseInt((o.label.match(/\d+/) || [0])[0], 10);
  const byNum = [...opts].sort((a, b) => num(b) - num(a))[0];
  if (num(byNum) > 0) return byNum;
  return opts.find((o) => /hq|hd/i.test(o.label)) || opts[0];
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const url = (text || '').trim().split(/\s+/)[0];

  if (!IG_REGEX.test(url)) {
    return conn.sendMessage(m.chat, {
      text: `╮───━ 〘 CARA PENGGUNAAN 〙 ━──►
*┃╻💡╹↵ Ketik:* \`${usedPrefix + command} link instagram\`
*┃╻📌╹↵ Contoh:* \`${usedPrefix + command} https://www.instagram.com/reel/xxx\`
╰─────━─━───━───►`
    }, { quoted: m });
  }

  await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

  try {
    const jar = createJar();

    const page = await call(jar, 'GET', '/nl');
    if (page.status >= 400) throw new Error(`Situs mengembalikan ${page.status} (mungkin Cloudflare)`);
    const csrf =
      /name="csrf-token"\s+content="([^"]+)"/.exec(page.data)?.[1] ||
      /name="_token"\s+value="([^"]+)"/.exec(page.data)?.[1];

    const form = { url };
    if (csrf) form._token = csrf;
    const r = await call(jar, 'POST', '/fetch', { form, xhr: true });

    let json;
    try {
      json = JSON.parse(r.data);
    } catch {
      throw new Error(`Respon /fetch bukan JSON (status ${r.status})`);
    }
    if (!json.status) throw new Error(json.message || 'Link tidak didukung atau akun private');

    const items = parseItems(json.data || '');
    if (!items.length) throw new Error('Tidak ada media di link ini');

    let sent = 0;
    let lastErr = 'Download gagal';

    for (const it of items.slice(0, MAX_ITEMS)) {
      const opt = pickBest(it.opts);
      const d = await call(jar, 'POST', '/media-download', {
        binary: true,
        form: { _token: it.token, action_type: 'download', username: it.username, url: opt.value }
      });

      const type = String(d.headers['content-type'] || '');
      if (d.status !== 200 || !/^(video|image)\//.test(type)) {
        lastErr = `media-download mengembalikan ${d.status} (${type || 'tanpa tipe'})`;
        continue;
      }

      const buf = Buffer.from(d.data);
      if (type.startsWith('video/')) {
        await conn.sendMessage(m.chat, { video: buf, mimetype: 'video/mp4', caption: '✅ Berhasil di download' }, { quoted: m });
      } else {
        await conn.sendMessage(m.chat, { image: buf, caption: '✅ Berhasil di download' }, { quoted: m });
      }
      sent++;
    }

    if (!sent) throw new Error(lastErr);
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

  } catch (err) {
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
    await conn.sendMessage(m.chat, {
      text: `╮───━ 〘 ERROR 〙 ━──►
*┃╻❌╹↵ ${err.message}*
─────━─━───━───►`
    }, { quoted: m });
  }
}

handler.help = ['insta <link>', 'ig <link>'];
handler.tags = ['downloader'];
handler.command = ['insta', 'ig', 'instagram'];

export default handler;