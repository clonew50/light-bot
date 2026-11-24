let handler = async (m, { conn, text }) => {
  let teks = text || "Sedang mikir..."
  
  // 1. دير typing باش يبان كيكتب
  await conn.sendPresenceUpdate('composing', m.chat)
  
  // 2. الطريقة الجديدة - خدامة بعد التحديث
  let msg = await conn.relayMessage(m.chat, {
    extendedTextMessage: {
      text: teks,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363410933636228@newsletter",
          newsletterName: "GOJO-AI • Thinking",
          serverMessageId: 1
        },
        // هادي هي اللي كتخليها تبان كـ AI
        businessMessageForwardInfo: {
          businessOwnerJid: m.chat
        },
        externalAdReply: {
          title: "Thinking...",
          body: teks,
          thumbnailUrl: "",
          sourceUrl: "",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }
  }, {})

  // 3. باش ماتختافيش - نخليوها typing كل 3 ثواني
  let loop = setInterval(() => {
    conn.sendPresenceUpdate('composing', m.chat)
  }, 3000)

  // من مور 15 ثانية نوقفو ال typing ونعدلو الرسالة لجواب حقيقي
  setTimeout(async () => {
    clearInterval(loop)
    await conn.sendPresenceUpdate('paused', m.chat)
    // تقدر هنا تعدلها لجواب
    // await conn.relayMessage(m.chat, { protocolMessage: { key: msg, type: 14, editedMessage: { conversation: "✅ Selesai mikir: " + teks } } }, {})
  }, 15000)

  return msg
}

handler.command = ['think','mikir','fakethink']
handler.tags = ['fun']
export default handler