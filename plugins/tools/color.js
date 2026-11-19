/*
  ═══════════════════════════════════════════
  🎨 مولد ألوان عشوائية — صور ألوان حقيقية + باليت
  الأمر: .color / .لون / .الوان
  ═══════════════════════════════════════════
*/
import sharp from 'sharp'
import { pruneCooldown } from '../../system/cooldowns.js'
import { renderColorSwatch } from '../../system/mediaService.js'

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

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function generatePalette(count = 5) {
  const base = randomColor()
  const palette = []
  const baseH = rgbToHsl(base.r, base.g, base.b).h
  for (let i = 0; i < count; i++) {
    const hue = (baseH + i * Math.round(360 / count)) % 360
    const rgb = hslToRgb(hue, 72, 52)
    palette.push(rgb)
  }
  return palette
}

function formatColor(r, g, b) {
  const hex = rgbToHex(r, g, b)
  const hsl = rgbToHsl(r, g, b)
  return { hex, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }
}

async function renderPaletteImage(colors) {
  const cols = colors.map((c, i) => {
    const { hex } = formatColor(c.r, c.g, c.b)
    const x = i * 180
    return `<rect x="${x}" y="0" width="180" height="320" fill="${hex}"/>` +
      `<rect x="${x + 15}" y="250" width="150" height="46" rx="10" fill="#000000" fill-opacity="0.45"/>` +
      `<text x="${x + 90}" y="280" text-anchor="middle" font-family="DejaVu Sans, monospace" font-size="22" font-weight="700" fill="#ffffff">${hex.toUpperCase()}</text>`
  }).join('')
  const svg = `<svg width="${colors.length * 180}" height="320" xmlns="http://www.w3.org/2000/svg">${cols}</svg>`
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

const handler = async (m, { conn, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }
    pruneCooldown(cooldown, COOLDOWN_MS)

    const subCmd = args[0]?.toLowerCase()

    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const value = args.slice(1).join(' ')
      if (!value) return m.reply('❌ لا توجد قيمة للنسخ')
      return m.reply(`📋 *تم النسخ:*\n\`${value}\`\n\n(اضغط مطولاً على النص للنسخ)`)
    }

    if (subCmd === 'واحد' || subCmd === 'single' || subCmd === 'واحدة') {
      cooldown.set(m.sender, now)
      const color = randomColor()
      const { hex, rgb, hsl } = formatColor(color.r, color.g, color.b)
      const img = await renderColorSwatch(hex, rgb, hsl)
      await m.react('🎨')
      return conn.sendMessage(m.chat, {
        image: img,
        caption: `🎨 *لون عشوائي*\n\n${hex}\n${rgb}\n${hsl}`,
        footer: 'LIGHT BOT • Color',
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    if (subCmd === 'باليت' || subCmd === 'palette') {
      cooldown.set(m.sender, now)
      const palette = generatePalette(5)
      const img = await renderPaletteImage(palette)
      await m.react('🎨')
      const summary = palette.map((c, i) => {
        const f = formatColor(c.r, c.g, c.b)
        return `${i + 1}. \`${f.hex.toUpperCase()}\` — ${f.rgb}`
      }).join('\n')
      return conn.sendMessage(m.chat, {
        image: img,
        caption: `🎨 *باليت متناسق (5 ألوان):*\n\n${summary}`,
        footer: 'LIGHT BOT • Color Palette',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎨 باليت جديد', id: `${usedPrefix}color باليت` } },
          { name: 'quick_reply', params: { display_text: '🌈 تدرج', id: `${usedPrefix}color تدرج` } }
        ]
      }, { quoted: m })
    }

    if (subCmd === 'تدرج' || subCmd === 'gradient') {
      cooldown.set(m.sender, now)
      const c1 = randomColor()
      const c2 = randomColor()
      const { hex: h1 } = formatColor(c1.r, c1.g, c1.b)
      const { hex: h2 } = formatColor(c2.r, c2.g, c2.b)
      await m.react('🌈')
      return m.reply(
        `🌈 *تدرج عشوائي:*\n\n` +
        `▰▰▰▰▰▰▰▰▰▰\n` +
        `من: ${h1}\n` +
        `إلى: ${h2}\n\n` +
        `CSS: \`linear-gradient(90deg, ${h1}, ${h2})\``
      )
    }

    cooldown.set(m.sender, now)
    await m.react('🎨')
    const color = randomColor()
    const { hex, rgb, hsl } = formatColor(color.r, color.g, color.b)
    const img = await renderColorSwatch(hex, rgb, hsl)

    return conn.sendMessage(m.chat, {
      image: img,
      caption: `🎨 *لون عشوائي*\n\n${hex}\n${rgb}\n${hsl}`,
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