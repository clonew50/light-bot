/*
  ═══════════════════════════════════════════
  📖 ويكيبيديا — مقالات مختصرة تفاعلية
  الأمر: .wiki / .ويكي <موضوع>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const LANGUAGES = ['ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'zh', 'ja']
const userLang = new Map()

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const query = text?.replace(/^(ويكي|wiki)\s*/i, '').trim()

    // اختيار اللغة
    if (subCmd === 'لغة' || subCmd === 'lang') {
      const lang = args[1]
      if (!lang || !LANGUAGES.includes(lang)) {
        return conn.sendMessage(m.chat, {
          text: '📖 *اختر لغة ويكيبيديا:*',
          footer: 'LIGHT BOT • Wikipedia',
          buttons: LANGUAGES.map(l => ({
            name: 'quick_reply',
            params: { display_text: l.toUpperCase(), id: `.wiki لغة ${l}` }
          }))
        }, { quoted: m })
      }
      userLang.set(m.sender, lang)
      return m.reply(`📖 *تم تعيين اللغة:* ${lang.toUpperCase()}`)
    }

    if (!query) {
      const currentLang = userLang.get(m.sender) || 'ar'
      return conn.sendMessage(m.chat, {
        text: `📖 *ويكيبيديا* (اللغة: ${currentLang.toUpperCase()})\\n\\nاكتب موضوع للبحث:\\n\`${usedPrefix}wiki الذكاء الاصطناعي\`\\n\`${usedPrefix}wiki مصر\``,
        footer: 'LIGHT BOT • Wikipedia',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📖 بحث', id: `${usedPrefix}wiki ` } },
          { name: 'quick_reply', params: { display_text: '🌐 لغة', id: `${usedPrefix}wiki لغة` } },
          { name: 'quick_reply', params: { display_text: '🎲 عشوائي', id: `${usedPrefix}wiki عشوائي` } }
        ]
      }, { quoted: m })
    }

    // مقال عشوائي
    if (query === 'عشوائي' || query === 'random') {
      await m.react('🎲')
      const lang = userLang.get(m.sender) || 'ar'
      const { data } = await axios.get(`https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`, { timeout: 10000 })
      return sendArticle(m, conn, data, lang)
    }

    await m.react('📖')

    const lang = userLang.get(m.sender) || 'ar'
    // بحث أولاً
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`
    const { data: searchData } = await axios.get(searchUrl, { timeout: 10000 })

    if (!searchData.query?.search?.length) {
      return m.reply(`🔍 *لا توجد نتائج لـ:* ${query}`)
    }

    const pageId = searchData.query.search[0].pageid
    // جلب الملخص
    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${pageId}`
    const { data } = await axios.get(summaryUrl, { timeout: 10000 })

    return sendArticle(m, conn, data, lang)

  } catch (e) {
    console.error('wiki:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل جلب المقالة')
  }
}

async function sendArticle(m, conn, data, lang) {
  const title = data.title || 'بدون عنوان'
  const extract = data.extract || 'لا يوجد ملخص'
  const url = data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
  const image = data.thumbnail?.source

  const msg = `📖 *${title}*\\n\\n${extract.slice(0, 500)}${extract.length > 500 ? '...' : ''}\\n\\n🔗 اقرأ المزيد: ${url}`

  if (image) {
    await conn.sendMessage(m.chat, {
      image: { url: image },
      caption: msg,
      contextInfo: { mentionedJid: [m.sender], externalAdReply: { title: 'Wikipedia', body: title, thumbnailUrl: image, sourceUrl: url, mediaType: 1 } }
    }, { quoted: m })
  } else {
    await m.reply(msg)
  }
  await m.react('✅')
}

handler.command = ['wiki', 'ويكي', 'wikipedia']
handler.usage = ['wiki <موضوع>', 'wiki لغة <ar|en|fr|...>', 'wiki عشوائي']
handler.category = 'search'
export default handler