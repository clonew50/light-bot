/*
  ═══════════════════════════════════════════
  🎨 توليد صور متقدم — إعدادات تفصيلية
  الأمر: .imagine / .تخيل / .توليد-متقدم
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const MODELS = [
  { id: 'flux', name: 'Flux', desc: 'أحدث، جودة عالية', emoji: '🌊' },
  { id: 'flux-realism', name: 'Flux Realism', desc: 'صور واقعية فوتوغرافية', emoji: '📸' },
  { id: 'flux-anime', name: 'Flux Anime', desc: 'رسوم أنمي/مانجا', emoji: '🎌' },
  { id: 'sdxl', name: 'SDXL', desc: 'مفتوح المصدر، قابل للتخصيص', emoji: '🖌️' },
  { id: 'dalle3', name: 'DALL-E 3', desc: 'دقة عالية، فهم نصوص', emoji: '🎨' },
  { id: 'midjourney', name: 'Midjourney v6', desc: 'فني، سينمائي', emoji: '🎭' },
]

const ASPECT_RATIOS = [
  { id: '1:1', name: 'مربع (1:1)', w: 1024, h: 1024, emoji: '📐' },
  { id: '16:9', name: 'أفقي (16:9)', w: 1792, h: 1024, emoji: '🖥️' },
  { id: '9:16', name: 'عمودي (9:16)', w: 1024, h: 1792, emoji: '📱' },
  { id: '4:3', name: 'كلاسيكي (4:3)', w: 1024, h: 768, emoji: '📺' },
  { id: '3:4', name: 'بورتريه (3:4)', w: 768, h: 1024, emoji: '🖼️' },
  { id: '21:9', name: 'سينمائي (21:9)', w: 1920, h: 824, emoji: '🎬' },
]

const STYLES = [
  { id: 'none', name: 'بدون أسلوب', emoji: '⚪' },
  { id: 'photorealistic', name: 'فوتوغرافي', emoji: '📸' },
  { id: 'cinematic', name: 'سينمائي', emoji: '🎬' },
  { id: 'anime', name: 'أنمي', emoji: '🎌' },
  { id: 'digital-art', name: 'فن رقمي', emoji: '🎨' },
  { id: 'oil-painting', name: 'رسم زيتي', emoji: '🖼️' },
  { id: 'watercolor', name: 'ألوان مائية', emoji: '💧' },
  { id: 'sketch', name: 'رسم تخطيطي', emoji: '✏️' },
  { id: '3d-render', name: 'ثلاثي الأبعاد', emoji: '🎮' },
  { id: 'pixel-art', name: 'بكسل آرت', emoji: '🕹️' },
  { id: 'cyberpunk', name: 'سايبربانك', emoji: '🌆' },
  { id: 'fantasy', name: 'فانتازي', emoji: '🏰' },
]

const cooldown = new Map()
const COOLDOWN_MS = 15000
const userSettings = new Map()

const POLLINATIONS = 'https://image.pollinations.ai/prompt/'

function getSettings(sender) {
  if (!userSettings.has(sender)) {
    userSettings.set(sender, {
      model: 'flux',
      ratio: '1:1',
      style: 'none',
      negative: '',
      seed: -1,
      steps: 30,
      cfg: 7
    })
  }
  return userSettings.get(sender)
}

function buildModelButtons() {
  return MODELS.map(m => ({
    name: 'quick_reply',
    params: { display_text: `${m.emoji} ${m.name}`, id: `.imagine نموذج ${m.id}` }
  }))
}

function buildRatioButtons() {
  return ASPECT_RATIOS.map(r => ({
    name: 'quick_reply',
    params: { display_text: `${r.emoji} ${r.name}`, id: `.imagine نسبة ${r.id}` }
  }))
}

function buildStyleButtons() {
  return STYLES.map(s => ({
    name: 'quick_reply',
    params: { display_text: `${s.emoji} ${s.name}`, id: `.imagine أسلوب ${s.id}` }
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
    const settings = getSettings(m.sender)
    const prompt = text?.replace(/^(تخيل|imagine|توليد-متقدم)\s*/i, '').trim()

    // إعدادات سريعة
    if (subCmd === 'نموذج' || subCmd === 'model') {
      const id = args[1]
      if (!id) return conn.sendMessage(m.chat, { text: '🎨 اختر النموذج:', footer: 'LIGHT BOT • Imagine', buttons: MODELS.map(m => ({ name: 'quick_reply', params: { display_text: `${m.emoji} ${m.name}`, id: `.imagine نموذج ${m.id}` })) }), { quoted: m })
      const mdl = MODELS.find(x => x.id === id)
      if (!mdl) return m.reply('❌ نموذج غير موجود')
      settings.model = id
      return m.reply(`${mdl.emoji} تم اختيار: ${mdl.name}`)
    }

    if (subCmd === 'نسبة' || subCmd === 'ratio' || subCmd === 'أبعاد') {
      const id = args[1]
      if (!id) return conn.sendMessage(m.chat, { text: '📐 اختر النسبة:', footer: 'LIGHT BOT • Imagine', buttons: ASPECT_RATIOS.map(r => ({ name: 'quick_reply', params: { display_text: `${r.emoji} ${r.name}`, id: `.imagine نسبة ${r.id}` })) }), { quoted: m })
      const ratio = ASPECT_RATIOS.find(x => x.id === id)
      if (!ratio) return m.reply('❌ نسبة غير موجودة')
      settings.ratio = id
      return m.reply(`${ratio.emoji} تم اختيار: ${ratio.name}`)
    }

    if (subCmd === 'أسلوب' || subCmd === 'style') {
      const id = args[1]
      if (!id) return conn.sendMessage(m.chat, { text: '🎨 اختر الأسلوب:', footer: 'LIGHT BOT • Imagine', buttons: STYLES.map(s => ({ name: 'quick_reply', params: { display_text: `${s.emoji} ${s.name}`, id: `.imagine أسلوب ${s.id}` })) }), { quoted: m })
      const style = STYLES.find(x => x.id === id)
      if (!style) return m.reply('❌ أسلوب غير موجود')
      settings.style = id
      return m.reply(`${style.emoji} تم اختيار: ${style.name}`)
    }

    if (subCmd === 'سلبي' || subCmd === 'negative') {
      const neg = args.slice(1).join(' ')
      settings.negative = neg || ''
      return m.reply(neg ? `🚫 السلبي: ${neg}` : '🚫 تم مسح الوصف السلبي')
    }

    if (subCmd === 'بذرة' || subCmd === 'seed') {
      const seed = parseInt(args[1])
      if (isNaN(seed)) return m.reply('❌ بذرة غير صالحة')
      settings.seed = seed
      return m.reply(`🌰 البذرة: ${seed}`)
    }

    if (subCmd === 'خطوات' || subCmd === 'steps') {
      const steps = parseInt(args[1])
      if (isNaN(steps) || steps < 10 || steps > 100) return m.reply('❌ خطوات 10-100')
      settings.steps = steps
      return m.reply(`👣 الخطوات: ${steps}`)
    }

    if (subCmd === 'توجيه' || subCmd === 'cfg') {
      const cfg = parseFloat(args[1])
      if (isNaN(cfg) || cfg < 1 || cfg > 20) return m.reply('❌ CFG 1-20')
      settings.cfg = cfg
      return m.reply(`⚙️ CFG: ${cfg}`)
    }

    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const mdl = MODELS.find(x => x.id === settings.model)
      const ratio = ASPECT_RATIOS.find(x => x.id === settings.ratio)
      const style = STYLES.find(x => x.id === settings.style)
      return m.reply(
        `⚙️ *إعدادات Imagine:*\n\n` +
        `${mdl.emoji} *النموذج:* ${mdl.name}\n` +
        `${ratio.emoji} *النسبة:* ${ratio.name} (${ratio.w}x${ratio.h})\n` +
        `${style.emoji} *الأسلوب:* ${style.name}\n` +
        `${settings.negative ? `🚫 *السلبي:* ${settings.negative}\n` : ''}` +
        `${settings.seed !== -1 ? `🌰 *البذرة:* ${settings.seed}\n` : ''}` +
        `👣 *الخطوات:* ${settings.steps} | ⚙️ *CFG:* ${settings.cfg}`
      )
    }

    if (subCmd === 'ريست' || subCmd === 'reset') {
      userSettings.delete(m.sender)
      return m.reply('🔄 تم إعادة الإعدادات للافتراضي')
    }

    // توليد
    if (!prompt) {
      return conn.sendMessage(m.chat, {
        text: `🎨 *توليد صور متقدم (Imagine)*\n\n` +
          `اكتب الوصف بعد الأمر:\n` +
          `\`${usedPrefix}imagine قطة فضاء ببدلة لامعة\`\n\n` +
          `الإعدادات الحالية جاهزة، أو عدلها بالأزرار:`,
        footer: 'LIGHT BOT • Imagine',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎨 نموذج', id: `${usedPrefix}imagine نموذج` } },
          { name: 'quick_reply', params: { display_text: '📐 نسبة', id: `${usedPrefix}imagine نسبة` } },
          { name: 'quick_reply', params: { display_text: '🎨 أسلوب', id: `${usedPrefix}imagine أسلوب` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}imagine إعدادات` } }
        ]
      }, { quoted: m })
    }

    cooldown.set(m.sender, now)
    await m.react('🎨')

    const ratio = ASPECT_RATIOS.find(x => x.id === settings.ratio)
    const style = STYLES.find(x => x.id === settings.style)
    const model = MODELS.find(x => x.id === settings.model)

    let fullPrompt = prompt
    if (style.id !== 'none') fullPrompt += `, ${style.name} style`
    if (settings.negative) fullPrompt += ` --neg "${settings.negative}"`

    const url = `${POLLINATIONS}${encodeURIComponent(fullPrompt)}` +
      `?model=${settings.model}` +
      `&width=${ratio.w}` +
      `&height=${ratio.h}` +
      `&nologo=true` +
      `&enhance=true` +
      `${settings.seed !== -1 ? `&seed=${settings.seed}` : ''}` +
      `&steps=${settings.steps}` +
      `&cfg=${settings.cfg}`

    const { data: imgBuffer } = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 })

    await conn.sendMessage(m.chat, {
      image: Buffer.from(imgBuffer),
      caption: `🎨 *${prompt}*\n\n${model.emoji} ${model.name} • ${ratio.emoji} ${ratio.name} • ${style.emoji} ${style.name}`,
      contextInfo: {
        mentionedJid: [m.sender],
        externalAdReply: { title: 'LIGHT BOT • Imagine', body: prompt.slice(0, 50), thumbnailUrl: url, sourceUrl: url, mediaType: 1, renderLargerThumbnail: true }
      }
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('imagine:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل التوليد، جرب وصف أبسط أو نموذج آخر')
  }
}

handler.command = ['imagine', 'تخيل', 'توليد-متقدم', 'imagine-adv']
handler.usage = ['imagine <وصف>', 'imagine نموذج <flux|sdxl|dalle3|...>', 'imagine نسبة <1:1|16:9|9:16|...>', 'imagine أسلوب <photorealistic|anime|...>', 'imagine سلبي <ما لا تريد>', 'imagine بذرة <رقم>', 'imagine خطوات <10-100>', 'imagine توجيه <1-20>', 'imagine إعدادات', 'imagine ريست']
handler.category = 'ai'
handler.cooldown = 15
export default handler