/*
  ═══════════════════════════════════════════
  🎨 مولد ألوان عشوائية — كاروسيل تفاعلي
  الأمر: .color / .لون / .الوان
  ═══════════════════════════════════════════
*/
const cooldown = new Map()
const COOLDOWN_MS = 2000

function randomColor() {
  const r = Math.floor(Math.random() * 256)
  const g = Math.floor(Math.random() * 256)
  const b = Math.floor(Math.random() * 256)
  return { r, g, b }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function generatePalette(count = 5) {
  const base = randomColor()
  const palette = []
  for (let i = 0; i < count; i++) {
    const hue = (rgbToHsl(base.r, base.g, base.b).h + i * (360 / count)) % 360
    const hsl = { h: hue, s: 70, l: 50 }
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l)
    palette.push(rgb)
  }
  return palette
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function formatColor(r, g, b) {
  const hex = rgbToHex(r, g, b)
  const hsl = rgbToHsl(r, g, b)
  return { hex, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }
}

function buildColorCard(color, index) {
  const { hex, rgb, hsl } = formatColor(color.r, color.g, color.b)
  return {
    header: { type: 'text', text: `🎨 لون #${index + 1}` },
    body: { text: `${hex}\\n${rgb}\\n${hsl}` },
    footer: { text: 'LIGHT BOT • Color Generator' },
    buttons: [
      { type: 'quick_reply', name: 'quick_reply', params: { display_text: '📋 نسخ HEX', id: `.color نسخ ${hex}` } },
      { type: 'quick_reply', name: 'quick_reply', params: { display_text: '📋 نسخ RGB', id: `.color نسخ ${rgb}` } }
    ]
  }
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()

    // نسخ قيمة
    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const value = args.slice(1).join(' ')
      if (!value) return m.reply('❌ لا توجد قيمة للنسخ')
      return m.reply(`📋 *تم النسخ:*\\n\`${value}\`\\n\\n(اضغط مطولاً على النص للنسخ)`)
    }

    // لون واحد
    if (subCmd === 'واحد' || subCmd === 'single' || subCmd === 'واحدة') {
      cooldown.set(m.sender, now)
      const color = randomColor()
      const { hex, rgb, hsl } = formatColor(color.r, color.g, color.b)
      await m.react('🎨')
      return conn.sendMessage(m.chat, {
        image: { url: `https://via.placeholder.com/300x300/${hex.slice(1)}/ffffff?text=${encodeURIComponent(hex)}` },
        caption: `🎨 *لون عشوائي*\\n\\n${hex}\\n${rgb}\\n${hsl}`,
        footer: 'LIGHT BOT • Color',
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    // باليت
    if (subCmd === 'باليت' || subCmd === 'palette') {
      cooldown.set(m.sender, now)
      const palette = generatePalette(5)
      await m.react('🎨')
      const cards = palette.map((c, i) => buildColorCard(c, i))
      return conn.sendMessage(m.chat, {
        carousel: { cards }
      }, { quoted: m })
    }

    // تدرج
    if (subCmd === 'تدرج' || subCmd === 'gradient') {
      cooldown.set(m.sender, now)
      const c1 = randomColor()
      const c2 = randomColor()
      const { hex: h1 } = formatColor(c1.r, c1.g, c1.b)
      const { hex: h2 } = formatColor(c2.r, c2.g, c2.b)
      await m.react('🌈')
      return m.reply(
        `🌈 *تدرج عشوائي:*\\n\\n` +
        `▰▰▰▰▰▰▰▰▰▰\\n` +
        `من: ${h1}\\n` +
        `إلى: ${h2}\\n\\n` +
        `CSS: \`linear-gradient(90deg, ${h1}, ${h2})\``
      )
    }

    // عرض عشوائي سريع (افتراضي)
    cooldown.set(m.sender, now)
    await m.react('🎨')
    const color = randomColor()
    const { hex, rgb, hsl } = formatColor(color.r, color.g, color.b)

    return conn.sendMessage(m.chat, {
      image: { url: `https://via.placeholder.com/300x300/${hex.slice(1)}/ffffff?text=${encodeURIComponent(hex)}` },
      caption: `🎨 *لون عشوائي*\\n\\n${hex}\\n${rgb}\\n${hsl}`,
      footer: 'LIGHT BOT • Color Generator',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🎨 آخر', id: `${usedPrefix}color` } },
        { name: 'quick_reply', params: { display_text: '🎨 باليت (5)', id: `${usedPrefix}color باليت` } },
        { name: 'quick_reply', params: { display_text: '🌈 تدرج', id: `${usedPrefix}color تدرج` } },
        { name: 'quick_reply', params: { display_text: '📋 نسخ HEX', id: `${usedPrefix}color نسخ ${hex}` } }
      ],
      contextInfo: { mentionedJid: [m.sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('color:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['color', 'لون', 'الوان', 'randomcolor']
handler.usage = ['color', 'color واحد', 'color باليت', 'color تدرج']
handler.category = 'tools'
handler.cooldown = 2
export default handler