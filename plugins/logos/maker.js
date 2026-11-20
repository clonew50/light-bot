/*
  ═══════════════════════════════════════════
  🎨 صانع اللوجو — أنماط، ألوان، خطوط
  الأمر: .logo / .لوجو / .شعار <نص>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const STYLES = [
  { id: 'neon', name: '💡 نيون', desc: 'أضواء نيون ساطعة', emoji: '💡', params: 'neon, glowing, vibrant colors, dark background' },
  { id: '3d', name: '🎮 ثلاثي الأبعاد', desc: 'شعار 3D واقعي', emoji: '🎮', params: '3d, realistic, depth, shadows, cinematic lighting' },
  { id: 'minimal', name: '⚪ مينيمال', desc: 'بسيط، نظيف، عصري', emoji: '⚪', params: 'minimalist, clean, flat design, simple, modern' },
  { id: 'gradient', name: '🌈 تدرج', desc: 'ألوان متدرجة جميلة', emoji: '🌈', params: 'gradient, colorful, smooth transitions, modern' },
  { id: 'retro', name: '📼 ريترو', desc: 'أسلوب الثمانينات/التسعينات', emoji: '📼', params: 'retro, vaporwave, 80s, 90s, synthwave, scanlines' },
  { id: 'luxury', name: '💎 فاخر', desc: 'ذهبي، فضي، أنيق', emoji: '💎', params: 'luxury, gold, silver, elegant, premium, metallic' },
  { id: 'tech', name: '🤖 تقني', desc: 'مستقبلي، سايبربانك', emoji: '🤖', params: 'futuristic, cyberpunk, tech, neon blue, holographic' },
  { id: 'handwritten', name: '✍️ بخط اليد', desc: 'خط يد طبيعي، فني', emoji: '✍️', params: 'handwritten, calligraphy, artistic, brush strokes' },
]

const userStyle = new Map()

function buildStyleButtons() {
  return STYLES.map(s => ({
    name: 'quick_reply',
    params: { display_text: `${s.emoji} ${s.name}`, id: `.logo نمط ${s.id}` }
  }))
}

const POLLINATIONS = 'https://image.pollinations.ai/prompt/'

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const prompt = text?.replace(/^(لوجو|logo|شعار)\s*/i, '').trim()

    // اختيار النمط
    if (subCmd === 'نمط' || subCmd === 'style') {
      const styleId = args[1]
      if (!styleId) {
        return conn.sendMessage(m.chat, {
          text: '🎨 *اختر نمط اللوجو:*',
          footer: 'LIGHT BOT • Logo Maker',
          buttons: STYLES.map(s => ({
            name: 'quick_reply',
            params: { display_text: `${s.emoji} ${s.name}`, id: `.logo نمط ${s.id}` }
          }))
        }, { quoted: m })
      }
      const style = STYLES.find(s => s.id === styleId)
      if (!style) return m.reply('❌ نمط غير موجود')
      userStyle.set(m.sender, styleId)
      return m.reply(`${style.emoji} *تم اختيار:* ${style.name}`)
    }

    // النمط الحالي
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const style = STYLES.find(s => s.id === userStyle.get(m.sender)) || STYLES[0]
      return m.reply(`⚙️ *النمط الحالي:* ${style.emoji} ${style.name}`)
    }

    // قائمة الأنماط
    if (subCmd === 'أنماط' || subCmd === 'styles' || subCmd === 'list') {
      let msg = '🎨 *أنماط اللوجو المتاحة:*\\n\\n'
      STYLES.forEach(s => {
        msg += `${s.emoji} *${s.name}* — ${s.desc}\\n`
      })
      return m.reply(msg)
    }

    // إنشاء لوجو
    if (!prompt) {
      const currentStyle = STYLES.find(s => s.id === userStyle.get(m.sender)) || STYLES[0]
      return conn.sendMessage(m.chat, {
        text: `🎨 *صانع اللوجو*\\n\\n` +
          `اكتب النص للشعار:\\n\`${usedPrefix}logo نص الشعار\`\\n\\n` +
          `النمط الحالي: ${currentStyle.emoji} ${currentStyle.name}`,
        footer: 'LIGHT BOT • Logo Maker',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎨 نمط', id: `${usedPrefix}logo نمط` } },
          { name: 'quick_reply', params: { display_text: '📋 أنماط', id: `${usedPrefix}logo أنماط` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}logo إعدادات` } }
        ]
      }, { quoted: m })
    }

    if (prompt.length > 50) {
      return m.reply('❌ النص طويل جداً (الحد 50 حرف للشعار)')
    }

    await m.react('🎨')

    const styleId = userStyle.get(m.sender) || 'neon'
    const style = STYLES.find(s => s.id === styleId) || STYLES[0]

    const fullPrompt = `logo design, "${prompt}", ${style.params}, professional, high quality, 4k, vector style`
    const url = `${POLLINATIONS}${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&enhance=true`

    const { data: imgBuffer } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })

    await conn.sendMessage(m.chat, {
      image: Buffer.from(imgBuffer),
      caption: `🎨 *لوجو: ${prompt}*\\n\\n${style.emoji} النمط: ${style.name}\\n📐 1024x1024`,
      contextInfo: {
        mentionedJid: [m.sender],
        externalAdReply: { title: 'LIGHT BOT • Logo', body: prompt, thumbnailUrl: url, sourceUrl: url, mediaType: 1, renderLargerThumbnail: true }
      }
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('logo:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل إنشاء اللوجو، جرب نص أقصر')
  }
}

handler.command = ['logo', 'لوجو', 'شعار', 'logomaker']
handler.usage = ['logo <نص>', 'logo نمط <neon|3d|minimal|gradient|retro|luxury|tech|handwritten>', 'logo أنماط', 'logo إعدادات']
handler.category = 'logos'
export default handler