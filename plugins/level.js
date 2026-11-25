// ============================================
// © 2026 YONO BOT - All Rights Reserved
// Original Code By YONO BOT
// No Copy / Re-upload Without Permission
// ============================================

import fetch from 'node-fetch'
import { generateWAMessageContent } from 'baileys'

// FUNCTION THAT RETURNS CODE - SAME AS BEFORE
function buildLevelCode({ name, role, level, exp, nextExp, need, persen, imageUrl }) {
  return {
    version: "v0.9",
    createSurface: {
      surfaceId: "yono-level-v1",
      catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
      components: [
        { id: "root", component: "Column", justify: "center", align: "center", children: ["topImage", "titleLevel", "userName", "line1", "detailBox", "line2", "channelBtn", "footerText"] },
        // IMAGE ON TOP
        { id: "topImage", component: "Image", url: imageUrl, variant: "header", fit: "cover" },
        { id: "titleLevel", component: "Text", text: `LEVEL ${level}`, variant: "h1" },
        { id: "userName", component: "Text", text: `${name} - ${role}`, variant: "caption" },
        { id: "line1", component: "Divider", axis: "horizontal" },
        { id: "detailBox", component: "Text", text: `Level : ${level}\nExp : ${exp} / ${nextExp}\nProgress : ${persen}%\nNeed : ${need} more exp to level up`, variant: "body" },
        { id: "line2", component: "Divider", axis: "horizontal" },
        { id: "channelBtn", component: "Button", child: "channelBtnText", variant: "primary", action: { call: "openUrl", args: { url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" } } },
        { id: "channelBtnText", component: "Text", text: "Official Channel", variant: "body" },
        { id: "footerText", component: "Text", text: "© YONO BOT - Keep active to level up!", variant: "caption" }
      ]
    }
  }
}

let handler = async (m, { conn }) => {
  const user = global.db?.data?.users?.[m.sender] || {}
  
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

  // 1. CALL THE FUNCTION THAT RETURNS CODE
  const uiData = buildLevelCode({ name, role, level, exp, nextExp, need, persen, imageUrl })

  // 2. THIS IS THE KEY SO THE IMAGE SURELY APPEARS - UPLOAD IMAGE TO WHATSAPP FIRST
  let headerImage = null
  try {
    const res = await fetch(imageUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    const { imageMessage } = await generateWAMessageContent({ image: buffer }, { upload: conn.waUploadToServer })
    headerImage = imageMessage
  } catch (e) {
    console.log('Failed to load image:', e.message)
  }

  // 3. SEND WITH HEADER IMAGE - THIS MAKES THE IMAGE APPEAR ON TOP
  await conn.relayMessage(m.chat, {
    interactiveMessage: {
      header: {
        title: "LEVEL INFO",
        subtitle: `${name} - ${role}`,
        hasMediaAttachment: true,
        imageMessage: headerImage
      },
      // DESCRIPTION WITHOUT EMOJI
      body: { text: `${name} - ${role}\nLevel ${level} - ${exp} / ${nextExp} Exp\nProgress ${persen}% - Need ${need} more exp\nMoney ${money} - Limit ${limit}\n\nClick to see full detail` },
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

handler.help = ['level']
handler.tags = ['main']
handler.command = /^(level|lvl|rank)$/i

export default handler