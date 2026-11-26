// plugins/google.js - Alya Bot | Google News + neat HTML
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    let text = args.join(' ').trim()
    if (!text) return conn.reply(m.chat, `❌ Enter query!\nExample: *${usedPrefix + command} national team news*`, m)

    await conn.reply(m.chat, `🔍 _Searching news: ${text}_`, m)

    try {
        const q = encodeURIComponent(text)
        const url = `https://www.google.com/search?q=${q}&hl=id&gl=ID&tbm=nws`

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'id-ID,id;q=0.9'
            },
            timeout: 15000
        })

        const $ = cheerio.load(data)
        const results = []

        $('div.SoaBEf, div.MjjYud').each((_, el) => {
            let title = $(el).find('div.n0jPhd, div.mCBkyc, h3').first().text().trim()
            let link = $(el).find('a').first().attr('href') || ''
            if (link.startsWith('/url?q=')) {
                link = decodeURIComponent(link.split('/url?q=')[1].split('&')[0])
            }
            let snippet = $(el).find('.GI74Re,.VwiC3b,.Y3v8qd').first().text().trim()
            let source = $(el).find('.MgUUmf span').first().text().trim()
            let time = $(el).find('.hvbAAd span').first().text().trim()

            if (title && link.startsWith('http')) {
                results.push({ title, link, snippet, source, time })
            }
        })

        if (!results.length) return conn.reply(m.chat, `❌ No results for *${text}*`, m)

        const items = results.slice(0, 10)

        // 1. Send neat text
        let caption = `🔎 *GOOGLE NEWS - ${text}*\n\n`
        items.forEach((r, i) => {
            caption += `*${i+1}. ${r.title}*\n`
            caption += `${r.link}\n`
            caption += `_${r.source} ${r.time ? '• ' + r.time : ''}_\n\n`
        })
        await conn.reply(m.chat, caption, m)

        // 2. Create neat HTML
        const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${text}</title>
<style>
body{font-family:Inter,sans-serif;background:#f0f2f5;margin:0;padding:16px}
.wrap{max-width:800px;margin:auto}.head{background:#fff;padding:20px;border-radius:16px;margin-bottom:12px;box-shadow:0 4px 12px rgba(0,0,0,.05)}
.card{background:#fff;padding:16px;border-radius:14px;margin:10px 0;border-right:4px solid #4285F4;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.card a{color:#1a73e8;font-weight:700;text-decoration:none;font-size:17px}
.card p{color:#555;margin:8px 0}.meta{font-size:12px;color:#888}
</style></head><body><div class="wrap">
<div class="head"><h2>🔎 ${text}</h2><small>${items.length} news • ${new Date().toLocaleString('id-ID')}</small></div>
${items.map(r => `<div class="card"><a href="${r.link}" target="_blank">${r.title}</a><p>${r.snippet || ''}</p><div class="meta">📰 ${r.source || ''} • ${r.time || ''}</div></div>`).join('')}
</div></body></html>`

        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
        const filePath = path.join(tmpDir, `google_${Date.now()}.html`)
        fs.writeFileSync(filePath, html)

        await conn.sendFile(m.chat, filePath, `Google-${text}.html`, `📄 HTML file for *${text}*`, m)

        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 30000)

    } catch (e) {
        console.error(e)
        await conn.reply(m.chat, `❌ Failed: ${e.message}`, m)
    }
}

handler.help = ['google <query>']
handler.tags = ['search']
handler.command = /^(google|gnews)$/i
handler.limit = true
export default handler