// ============================================
// © 2026 YONO BOT - All Rights Reserved
// Original Code By YONO BOT
// Dilarang Copy / Re-upload Tanpa Izin
// ============================================

import fetch from 'node-fetch'
import { generateWAMessageContent } from '@whiskeysockets/baileys'

// FUNGSI YANG RETURN CODE - SAMA MACAM TADI
function buildLevelCode({ name, role, level, exp, nextExp, need, persen, imageUrl }) {
  return {
    version: "v0.9",
    createSurface: {
      surfaceId: "yono-level-v1",
      catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
      components: [
        { id: "root", component: "Column", justify: "center", align: "center", children: ["topImage", "titleLevel", "userName", "line1", "detailBox", "line2", "channelBtn", "footerText"] },
        // GAMBAR DI ATAS
        { id: "topImage", component: "Image", url: imageUrl, variant: "header", fit: "cover" },
        { id: "titleLevel", component: "Text", text: `LEVEL ${level}`, variant: "h1" },
        { id: "userName", component: "Text", text: `${name} - ${role}`, variant: "caption" },
        { id: "line1", component: "Divider", axis: "horizontal" },
        { id: "detailBox", component: "Text", text: `Level : ${level}\nExp : ${exp} / ${nextExp}\nProgress : ${persen}%\nKurang : ${need} exp lagi untuk naik level`, variant: "body" },
        { id: "line2", component: "Divider", axis: "horizontal" },
        { id: "channelBtn", component: "Button", child: "channelBtnText", variant: "primary", action: { call: "openUrl", args: { url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" } } },
        { id: "channelBtnText", component: "Text", text: "Official Channel", variant: "body" },
        { id: "footerText", component: "Text", text: "© YONO BOT - Terus aktif untuk naik level!", variant: "caption" }
      ]
    }
  }
}

let handler = async (m, { conn }) => {
  const user = global.db?.users?.[m.sender] || {}

  const level = user.level || 0
  const exp = user.exp || 0
  const role = user.role || 'Beginner'
  const name = m.pushName || 'User'
  const money = user.money || 0
  const limit = user.limit || 0

  const nextExp = Math.pow(level + 1, 2) * 100
  const need = Math.max(nextExp - exp, 0)
  const persen = Math.floor((exp / nextExp) * 100)

  const imageUrl = 'https://cdn.zass.in/B8oGADAjNI.jpg'

  // 1. PANGGIL FUNGSI YANG RETURN CODE
  const uiData = buildLevelCode({ name, role, level, exp, nextExp, need, persen, imageUrl })

  // 2. INI KUNCINYA BIAR GAMBAR PASTI MUNCUL - UPLOAD GAMBAR KE WHATSAPP DULU
  let headerImage = null
  try {
    const res = await fetch(imageUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    const { imageMessage } = await generateWAMessageContent({ image: buffer }, { upload: conn.waUploadToServer })
    headerImage = imageMessage
  } catch (e) {
    console.log('Gagal load gambar:', e.message)
  }

  // 3. KIRIM DENGAN HEADER IMAGE - INI YANG BIKIN GAMBAR MUNCUL DI ATAS
  await conn.relayMessage(m.chat, {
    interactiveMessage: {
      header: {
        title: "LEVEL INFO",
        subtitle: `${name} - ${role}`,
        hasMediaAttachment: true,
        imageMessage: headerImage
      },
      // DESKRIPSI TANPA EMOJI
      body: { text: `${name} - ${role}\nLevel ${level} - ${exp} / ${nextExp} Exp\nProgress ${persen}% - Kurang ${need} exp lagi\nMoney ${money} - Limit ${limit}\n\nKlik untuk lihat detail lengkap` },
      footer: { text: "© YONO BOT" },
      nativeFlowMessage: {},
      bloksWidget: {
        uuid: "yono-level-v1",
        type: "im_a2ui",
        data: JSON.stringify(uiData),
        fallback: `LEVEL ${level} | ${name} | Exp ${exp}/${nextExp}`
      }
    }
  }, {})
}

handler.usage = ['level']
handler.category = 'main'
handler.command = /^(level|lvl|rank)$/i

export default handler