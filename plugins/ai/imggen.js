/*
  ═══════════════════════════════════════════
  🎨 توليد صور AI — نماذج وأحجام تفاعلية
  الأمر: .imggen / .توليد / .صورة
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const MODELS = [
  { id: 'flux', name: '🌊 Flux', desc: 'أحدث، جودة عالية، مفتوح المصدر', emoji: '🌊' },
  { id: 'dalle3', name: '🎨 DALL-E 3', desc: 'دقة تفوق، فهم نصوص معقد', emoji: '🎨' },
  { id: 'sdxl', name: '🖌️ SDXL', desc: 'مفتوح، قابل للتخصيص', emoji: '🖌️' },
  { id: 'midjourney', name: '🎭 Midjourney v6', desc: 'فني، سينمائي', emoji: '🎭' },
]

const SIZES = [
  { id: '1024x1024', name: '📐 مربع (1:1)', emoji: '📐' },
  { id: '1024x1792', name: '📱 عمودي (9:16)', emoji: '📱' },
  { id: '1792x1024', name: '🖥️ أفقي (16:9)', emoji: '🖥️' },
  { id: '512x512', name: '⚡ سريع (512)', emoji: '⚡' },
]

const cooldown = new Map()
const COOLDOWN_MS = 10000
const userModel = new Map()
const userSize = new Map()

const POLLINATIONS = 'https://image.pollinations.ai/prompt/'

function buildModelButtons() {
  return MODELS.map(m => ({
    name: 'quick_reply',
    params: { display_text: `${m.emoji} ${m.name}`, id: `.imggen نموذج ${m.id}` }
  }))
}

function buildSizeButtons() {
  return SIZES.map(s => ({
    name: 'quick_reply',
    params: { display_text: `${s.emoji} ${s.name}`, id: `.imggen حجم ${s.id}` }
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

    // اختيار النموذج
    if (subCmd === 'نموذج' || subCmd === 'model') {
      const modelId = args[1]
      if (!modelId) {
        return conn.sendMessage(m.chat, {
          text: '🎨 *اختر نموذج التوليد:*',
          footer: 'LIGHT BOT • Image Gen',
          buttons: buildModelButtons()
        }, { quoted: m })
      }
      const model = MODELS.find(m => m.id === modelId)
      if (!model) return m.reply('❌ نموذج غير موجود')
      userModel.set(m.sender, modelId)
      return m.reply(`${model.emoji} *تم اختيار:* ${model.name}`)
    }

    // اختيار الحجم
    if (subCmd === 'حجم' || subCmd === 'size') {
      const sizeId = args[1]
      if (!sizeId) {
        return conn.sendMessage(m.chat, {
          text: '📐 *اختر حجم الصورة:*',
          footer: 'LIGHT BOT • Image Gen',
          buttons: buildSizeButtons()
        }, { quoted: m })
      }
      const size = SIZES.find(s => s.id === sizeId)
      if (!size) return m.reply('❌ حجم غير موجود')
      userSize.set(m.sender, sizeId)
      return m.reply(`${size.emoji} *تم اختيار:* ${size.name}`)
    }

    // الإعدادات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const model = MODELS.find(m => m.id === userModel.get(m.sender)) || MODELS[0]
      const size = SIZES.find(s => s.id === userSize.get(m.sender)) || SIZES[0]
      return m.reply(
        `⚙️ *إعدادات التوليد الحالية:*\n\n` +
        `${model.emoji} *النموذج:* ${model.name}\n` +
        `${size.emoji} *الحجم:* ${size.name}\n\n` +
        `استخدم: \`.imggen نموذج <اسم>\` أو \`.imggen حجم <مقاس>\``
      )
    }

    // توليد صورة
    const prompt = text?.trim()
    if (!prompt) {
      return conn.sendMessage(m.chat, {
        text: `🎨 *توليد صور AI*\n\n` +
          `اكتب وصف الصورة بعد الأمر:\n` +
          `\`${usedPrefix}imggen قطة تلبس بدلة فضاء\`\n\n` +
          `الإعدادات الحالية: ${(userModel.get(m.sender) ? MODELS.find(m => m.id === userModel.get(m.sender))?.name : 'Flux')} • ${(userSize.get(m.sender) ? SIZES.find(s => s.id === userSize.get(m.sender))?.name : 'مربع (1:1)')}`,
        footer: 'LIGHT BOT • Image Gen',
        buttons: [
          ...buildModelButtons().slice(0, 2),
          ...buildSizeButtons().slice(0, 2),
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}imggen إعدادات` } }
        ]
      }, { quoted: m })
    }

    cooldown.set(m.sender, now)
    await m.react('🎨')

    const modelId = userModel.get(m.sender) || 'flux'
    const sizeId = userSize.get(m.sender) || '1024x1024'
    const [w, h] = sizeId.split('x').map(Number)

    const url = `${POLLINATIONS}${encodeURIComponent(prompt)}?model=${modelId}&width=${w}&height=${h}&nologo=true&enhance=true`
    const { data: imgBuffer } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })

    await conn.sendMessage(m.chat, {
      image: Buffer.from(imgBuffer),
      caption: `🎨 *${prompt}*\n\n${MODELS.find(m => m.id === modelId)?.emoji} ${MODELS.find(m => m.id === modelId)?.name} • ${SIZES.find(s => s.id === sizeId)?.name}`,
      contextInfo: {
        mentionedJid: [m.sender],
        externalAdReply: {
          title: 'LIGHT BOT • AI Image',
          body: prompt.slice(0, 50),
          thumbnailUrl: url,
          sourceUrl: url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('imggen:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل توليد الصورة، جرب وصف أبسط أو نموذج آخر')
  }
}

handler.command = ['imggen', 'توليد', 'صورة', 'imagegen']
handler.usage = ['imggen <وصف>', 'imggen نموذج <flux|dalle3|sdxl|midjourney>', 'imggen حجم <1024x1024|1024x1792|1792x1024|512x512>', 'imggen إعدادات']
handler.category = 'ai'
handler.cooldown = 10
export default handler