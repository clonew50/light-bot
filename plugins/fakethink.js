let handler = async (m, { conn, text }) => {
  let teks = text || "Thinking..."
  
  // 1. Show typing so it looks like it's typing
  await conn.sendPresenceUpdate('composing', m.chat)
  
  // 2. The new method - works after the update
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
        // This is what makes it look like AI
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

  // 3. So you don't worry - keep it typing every 3 seconds
  let loop = setInterval(() => {
    conn.sendPresenceUpdate('composing', m.chat)
  }, 3000)

  // After 15 seconds stop the typing and change the message to a real answer
  setTimeout(async () => {
    clearInterval(loop)
    await conn.sendPresenceUpdate('paused', m.chat)
    // You can change it here to an answer
    // await conn.relayMessage(m.chat, { protocolMessage: { key: msg, type: 14, editedMessage: { conversation: "✅ Done thinking: " + teks } } }, {})
  }, 15000)

  return msg
}

handler.command = ['think','mikir','fakethink']
handler.tags = ['fun']
export default handler