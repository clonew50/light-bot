/*
  ═══════════════════════════════════════════
  🔗 مختصر روابط — خدمات متعددة تفاعلية
  الأمر: .short / .قصير / .مختصر <رابط>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const SERVICES = [
  { id: 'tinyurl', name: '🔗 TinyURL', api: 'https://tinyurl.com/api-create.php?url=', emoji: '🔗' },
  { id: 'isgd', name: '⚡ is.gd', api: 'https://is.gd/create.php?format=simple&url=', emoji: '⚡' },
  { id: 'vgd', name: '📎 v.gd', api: 'https://v.gd/create.php?format=simple&url=', emoji: '📎' },
  { id: 'clck', name: '🖱️ clck.ru', api: 'https://clck.ru/--?url=', emoji: '🖱️' },
]

const cooldown = new Map()
const COOLDOWN_MS = 5000
const userService = new Map()

function buildServiceList() {
  return SERVICES.map(s => ({
    title: `${s.emoji} ${s.name}`,
    description: `اختصار عبر ${s.name}`,
    id: `.short خدمة ${s.id}`
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const url = text?.replace(/^(قصير|short|مختصر)\s*/i, '').trim()

    // اختيار الخدمة
    if (subCmd === 'خدمة' || subCmd === 'service') {
      const svcId = args[1]
      if (!svcId) {
        const sections = [{ title: '🔗 اختر خدمة الاختصار', rows: buildServiceList() }]
        return conn.sendMessage(m.chat, {
          text: '🔗 *اختر خدمة مختصر الروابط:*',
          footer: 'LIGHT BOT • URL Shortener',
          buttons: [{ name: 'single_select', params: { title: 'الخدمات', sections } }],
          mentions: [m.sender]
        }, { quoted: m })
      }
      const svc = SERVICES.find(s => s.id === svcId)
      if (!svc) return m.reply('❌ خدمة غير موجودة')
      userService.set(m.sender, svcId)
      return m.reply(`${svc.emoji} *تم اختيار:* ${svc.name}`)
    }

    // الخدمات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const svc = SERVICES.find(s => s.id === userService.get(m.sender)) || SERVICES[0]
      return m.reply(`⚙️ *الخدمة الحالية:* ${svc.emoji} ${svc.name}`)
    }

    // تحقق من وجود رابط
    if (!url) {
      return conn.sendMessage(m.chat, {
        text: `🔗 *مختصر روابط*\\n\\n` +
          `أرسل رابط للاختصار:\\n` +
          `\`${usedPrefix}short https://example.com/very/long/url\`\\n\\n` +
          `الخدمة الحالية: ${(userService.get(m.sender) ? SERVICES.find(s => s.id === userService.get(m.sender))?.name : 'TinyURL')}`,
        footer: 'LIGHT BOT • URL Shortener',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🔗 خدمة', id: `${usedPrefix}short خدمة` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}short إعدادات` } }
        ]
      }, { quoted: m })
    }

    // التحقق من صحة الرابط
    if (!/^https?:\/\/.+/.test(url)) {
      return m.reply('❌ رابط غير صالح، يجب أن يبدأ بـ http:// أو https://')
    }

    cooldown.set(m.sender, now)
    await m.react('🔗')

    const svcId = userService.get(m.sender) || 'tinyurl'
    const svc = SERVICES.find(s => s.id === svcId) || SERVICES[0]

    try {
      const { data } = await axios.get(svc.api + encodeURIComponent(url), { timeout: 15000 })
      const shortUrl = data.trim()

      if (!shortUrl || shortUrl === url || shortUrl.includes('Error')) {
        throw new Error('Service returned error')
      }

      await m.reply(
        `${svc.emoji} *تم الاختصار بنجاح!*\\n\\n` +
        `📎 *الأصلي:* ${url}\\n` +
        `✂️ *المختصر:* ${shortUrl}\\n\\n` +
        `📊 *الخدمة:* ${svc.name}`
      )
      await m.react('✅')
    } catch (e) {
      // محاولة خدمة بديلة
      const fallback = SERVICES.find(s => s.id !== svcId)
      if (fallback) {
        try {
          const { data } = await axios.get(fallback.api + encodeURIComponent(url), { timeout: 15000 })
          const shortUrl = data.trim()
          await m.reply(
            `⚠️ ${svc.name} فشل، تم استخدام ${fallback.name}\\n\\n` +
            `✂️ *المختصر:* ${shortUrl}`
          )
          await m.react('✅')
        } catch {
          throw e
        }
      } else {
        throw e
      }
    }

  } catch (e) {
    console.error('short:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل الاختصار، جرب خدمة أخرى أو رابط مختلف')
  }
}

handler.command = ['short', 'قصير', 'مختصر', 'urlshort']
handler.usage = ['short <رابط>', 'short خدمة <tinyurl|isgd|vgd|clck>', 'short إعدادات']
handler.category = 'tools'
handler.cooldown = 5
export default handler