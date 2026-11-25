import axios from 'axios'
import * as cheerio from 'cheerio'

class DouyinSearch {
  constructor() {
    this.baseURL = 'https://so.douyin.com/'
    this.defaultParams = {
      search_entrance: 'aweme',
      enter_method: 'normal_search',
      innerWidth: '431',
      innerHeight: '814',
      reloadNavStart: String(Date.now()),
      is_no_width_reload: '1',
      keyword: '',
    }
    this.cookies = {}
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'id-ID,id;q=0.9',
        referer: 'https://so.douyin.com/',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      },
    })

    this.api.interceptors.response.use((res) => {
      const setCookies = res.headers['set-cookie']
      if (setCookies) {
        setCookies.forEach((c) => {
          const [name, value] = c.split(';')[0].split('=')
          if (name && value) this.cookies[name] = value
        })
      }
      return res
    })

    this.api.interceptors.request.use((config) => {
      if (Object.keys(this.cookies).length) {
        config.headers['Cookie'] = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      }
      return config
    })
  }

  async initialize() {
    try {
      await this.api.get('/')
      return true
    } catch {
      return false
    }
  }

  async search({ query }) {
    await this.initialize()
    const params = {...this.defaultParams, keyword: query, reloadNavStart: String(Date.now()) }
    const res = await this.api.get('s', { params })
    const $ = cheerio.load(res.data)

    let scriptWithData = ''
    $('script').each((_, el) => {
      const text = $(el).html()
      if (text && text.includes('let data =') && text.includes('"business_data":')) {
        scriptWithData = text
      }
    })

    if (!scriptWithData) throw new Error('Douyin data not found (Douyin block)')

    const match = scriptWithData.match(/let\s+data\s*=\s*(\{[\s\S]+?\});/)
    if (!match) throw new Error('Failed to parse Douyin data')

    let fullData
    try {
      fullData = new Function(`${match[0]}; return data`)()
    } catch (e) {
      throw new Error('Failed eval: ' + e.message)
    }

    const awemeInfos = fullData?.business_data?.map((entry) => entry?.data?.aweme_info).filter(Boolean) || []
    return awemeInfos
  }
}

let handler = async (m, { conn, satanic, text, prefix, command, usedPrefix }) => {
  const client = conn || satanic
  const _prefix = usedPrefix || prefix
  if (!text) return m.reply(`Example: ${_prefix + command} keyword\nExample: ${_prefix + command} anime dance`)

  await client.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const douyin = new DouyinSearch()
    const results = await douyin.search({ query: text })

    if (!results ||!results.length) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return m.reply('Not found.')
    }

    const first = results[0]
    const videoUrl = first.video?.play_addr?.url_list?.[0]
    const caption = `${first.desc || 'No description'}\nhttps://www.douyin.com/video/${first.aweme_id}\n\n👤 @${first.author?.nickname || ''}`

    if (!videoUrl) {
      await client.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
      return m.reply('Video not available.')
    }

    await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    await client.sendMessage(m.chat, {
      video: { url: videoUrl },
      caption: caption
    }, { quoted: m })

  } catch (err) {
    console.error('Douyin Error:', err)
    await client.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
    m.reply('Failed to fetch data:\n' + err.message)
  }
}

handler.help = ['douyinsearch <query>']
handler.tags = ['download', 'search']
handler.command = /^(douyinsearch|douyin|searchdouyin)$/i
handler.limit = true

export default handler