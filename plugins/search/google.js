/*
  ═══════════════════════════════════════════
  🔍 بحث جوجل — نتائج تفاعلية
  الأمر: .google / .جوجل <استعلام>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const query = text?.replace(/^(جوجل|google|search)\s*/i, '').trim()
    if (!query) {
      return conn.sendMessage(m.chat, {
        text: `🔍 *بحث جوجل*\\n\\nاكتب استعلامك بعد الأمر:\\n\`${usedPrefix}google كيفية برمجة بوت واتساب\``,
        footer: 'LIGHT BOT • Search',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🔍 بحث', id: `${usedPrefix}google ` } },
          { name: 'quick_reply', params: { display_text: '🌐 ويكي', id: `${usedPrefix}wiki ` } },
          { name: 'quick_reply', params: { display_text: '🐙 غيتهب', id: `${usedPrefix}github ` } }
        ]
      }, { quoted: m })
    }

    await m.react('🔍')

    // استخدام DuckDuckGo HTML scrape أو API بديل
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const { data } = await axios.get(url, { timeout: 10000 })

    let results = []
    if (data.Abstract) results.push({ title: 'ملخص', text: data.Abstract, url: data.AbstractURL })
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 5).forEach(t => {
        if (t.Text) results.push({ title: 'نتيجة', text: t.Text, url: t.FirstURL })
      })
    }

    if (!results.length) {
      return m.reply(`🔍 *لا توجد نتائج لـ:* ${query}\\n\\nجرب كلمات مختلفة`)
    }

    let msg = `🔍 *نتائج البحث عن:* ${query}\\n\\n`
    results.forEach((r, i) => {
      msg += `${i + 1}. *${r.title}*\\n${r.text.slice(0, 200)}\\n🔗 ${r.url}\\n\\n`
    })

    await m.reply(msg)
    await m.react('✅')

  } catch (e) {
    console.error('google:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل البحث')
  }
}

handler.command = ['google', 'جوجل', 'search', 'بحث']
handler.usage = ['google <استعلام>', 'جوجل <كلمات مفتاحية>']
handler.category = 'search'
export default handler