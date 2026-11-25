import { randomUUID } from 'crypto'

const MAX_IMAGES = 20
const POOL = 50
const MAX_BYTES = 500 * 1024

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'

async function searchPinterest(query) {
  const all = []
  const seen = new Set()
  let bookmark = null
  for (let page = 0; page < 8 && all.length < POOL; page++) {
    const options = { query, scope: 'pins', page_size: 50, ...(bookmark ? { bookmarks: [bookmark] } : {}) }
    const params = new URLSearchParams({
      source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({ options, context: {} }),
      _: String(Date.now())
    })
    const res = await fetch(`https://www.pinterest.com/resource/BaseSearchResource/get/?${params}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js' },
      signal: AbortSignal.timeout(15000)
    })
    const json = await res.json()
    const rr = json?.resource_response
    const results = rr?.data?.results || []
    for (const r of results) {
      const thumb = r.images?.['236x']?.url || r.images?.['474x']?.url || r.images?.orig?.url
      if (!thumb || seen.has(thumb)) continue
      seen.add(thumb)
      all.push({ thumb, full: r.images?.orig?.url || r.images?.['736x']?.url || r.images?.['474x']?.url || thumb, pin: `https://pinterest.com/pin/${r.id}`, title: r.grid_title || r.title || 'Pinterest' })
    }
    bookmark = rr?.bookmark || json?.resource?.options?.bookmarks?.[0]
    if (!results.length || !bookmark || bookmark === '-end-') break
  }
  return all
}

async function toDataUri(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error('img ' + r.status)
  const buf = Buffer.from(await r.arrayBuffer())
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]
  return { uri: `data:${mime};base64,${buf.toString('base64')}`, size: buf.length }
}

async function collectImages(items) {
  const cands = items.slice(0, MAX_IMAGES + 10)
  const settled = await Promise.allSettled(cands.map(x => toDataUri(x.thumb)))
  const out = []
  let total = 0
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    if (out.length >= MAX_IMAGES) return
    if (total + r.value.size > MAX_BYTES) return
    total += r.value.size
    out.push({ ...cands[i], uri: r.value.uri })
  })
  return out
}

function shuffle(a) {
  a = [...a]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const cache = new Map()
const TTL = 30 * 60 * 1000
const keyOf = m => `${m.chat}:${m.sender}`
function saveCache(m, items) {
  const now = Date.now()
  for (const [k, v] of cache) if (now - v.at > TTL) cache.delete(k)
  cache.set(keyOf(m), { at: now, items: items.map(x => ({ full: x.full, title: x.title })) })
}

async function downloadPin(m, conn, text, usedPrefix) {
  const n = parseInt((text || '').trim(), 10)
  const entry = cache.get(keyOf(m))
  if (!entry || Date.now() - entry.at > TTL) {
    return conn.sendMessage(m.chat, { text: `❌ Search first using ${usedPrefix}pinterest <keyword>, then type the image number.\nExample: ${usedPrefix}pinterest anime` }, { quoted: m })
  }
  if (!n || n < 1 || n > entry.items.length) {
    return conn.sendMessage(m.chat, { text: `❌ Enter a number from 1 to ${entry.items.length}.\nExample: ${usedPrefix}unduh 2` }, { quoted: m })
  }
  const it = entry.items[n - 1]
  await conn.sendMessage(m.chat, { react: { text: '⌛', key: m.key } })
  try {
    const r = await fetch(it.full, { headers: { 'User-Agent': UA, 'Referer': 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error('img ' + r.status)
    const buf = Buffer.from(await r.arrayBuffer())
    await conn.sendMessage(m.chat, { image: buf, caption: `*${it.title}*\n\n乂 _• by YONO_` }, { quoted: m })
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '❌ Failed to download the image, try another number.' }, { quoted: m })
  }
}

function buildHtml(query, items, hint) {
  const list = JSON.stringify(items).replace(/</g, '\\u003c')
  return `<style>
*{box-sizing:border-box} body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#fff}
.wrap{width:100%;max-width:620px;margin:auto;padding:14px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden}
.head{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.head small{display:block;font-size:10px;letter-spacing:2px;color:#888}.head b{font-size:18px}
.stage{position:relative;background:#000;aspect-ratio:1/1}.stage img{width:100%;height:100%;display:block;object-fit:contain;background:#000}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.55);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.nav.prev{left:12px}.nav.next{right:12px}
.bottom{padding:10px 18px;display:flex;justify-content:space-between}.counter{font-size:12px;color:#999}.hint{font-size:12px;color:#00a884}
</style>
<div class="wrap"><div class="card">
<div class="head"><small>PINTEREST • YONO</small><b>${esc(query)}</b></div>
<div class="stage"><img id="img" src=""><div class="nav prev" id="prev">&lsaquo;</div><div class="nav next" id="next">&rsaquo;</div></div>
<div class="bottom"><span class="counter" id="counter"></span><span class="hint">${esc(hint)}</span></div>
</div></div>
<script>
const items = ${list}; let idx=0; const img=document.getElementById('img'); const counter=document.getElementById('counter');
function render(){ img.src=items[idx].img; counter.textContent=(idx+1)+' / '+items.length; }
document.getElementById('prev').addEventListener('click',()=>{ idx=(idx-1+items.length)%items.length; render(); });
document.getElementById('next').addEventListener('click',()=>{ idx=(idx+1)%items.length; render(); }); render();
</script>`
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (/^(pindl|unduh|download)$/i.test(command)) return downloadPin(m, conn, text, usedPrefix)
  const query = (text || '').trim()
  if (!query) return conn.sendMessage(m.chat, { text: `*乂 Pinterest - Yono Dev*\n\nWrite a search keyword.\n\nExample:\n${usedPrefix}pinterest anime aesthetic\n${usedPrefix}pinterest cute cats\n\n> Developer: YONO` }, { quoted: m })

  await conn.sendMessage(m.chat, { react: { text: '⌛', key: m.key } })
  try {
    const found = shuffle(await searchPinterest(query))
    const items = found.length ? await collectImages(found) : []
    if (!items.length) {
      await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return conn.sendMessage(m.chat, { text: '❌ No results for this search. Try another keyword.' }, { quoted: m })
    }
    saveCache(m, items)
    const data = {
      response_id: randomUUID(),
      sections: [
        { __typename: 'GenAIUnifiedResponseSection', view_model: { primitives: [`Query: ${query}`, `Results: ${found.length}`, `Displayed: ${items.length}`, `Bot: YONO`].map(t => ({ prompt_text: t, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' })), __typename: 'GenAIHScrollLayoutViewModel' } },
        { view_model: { primitive: { sources: items.map((x, i) => ({ source_type: 'THIRD_PARTY', source_display_name: `${i + 1} • ${x.title}`.slice(0, 90), source_subtitle: 'YONO', source_url: x.pin, favicon: { url: 'https://www.pinterest.com/favicon.ico', mime_type: 'image/jpeg', width: 16, height: 16 } })) , __typename: 'GenAISearchResultPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } },
        { view_model: { primitive: { payload: buildHtml(query, items.map(x => ({ img: x.uri })), `Type: ${usedPrefix}unduh number | YONO`), url: 'https://www.pinterest.com', trusted_sources: ['pinterest.com'], __typename: 'GenAIaeacdsnwHtmlPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }
      ]
    }
    await conn.relayMessage(m.chat, {
      messageContextInfo: { deviceListMetadataVersion: 2, botMetadata: { messageDisclaimerText: 'Pinterest • YONO', richResponseSourcesMetadata: {} } },
      botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages: [{ messageType: 2, messageText: '[ CANNOT_LOAD_HTML ]' }], contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4, stanzaId: m.key.id, participant: m.sender, quotedType: 0, quotedMessage: { extendedTextMessage: { text: `${usedPrefix}${command} ${query}`, previewType: 0 } } }, unifiedResponse: { data: Buffer.from(JSON.stringify(data), 'utf8').toString('base64') } } } }
    }, {})
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: '❌ An error occurred, try again later.\n_YONO_' }, { quoted: m })
  }
}

handler.help = ['pinterest <keyword>']
handler.tags = ['search']
handler.command = /^(pinterest|pin|pindl|unduh|download)$/i
export default handler