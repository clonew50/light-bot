import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix: _p }) => {
  try {
    let images = [
      "https://files.catbox.moe/x39202.jpeg",
      "https://files.catbox.moe/o33zli.jpeg",
      "https://files.catbox.moe/ffij55.jpeg",
      "https://files.catbox.moe/4s1wse.jpeg"
    ]

    let index = Math.floor(Date.now() / 5000) % images.length
    let imgUrl = images[index]

    // Thumbnail
    let thumbUrl = `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}&w=300&h=300&fit=cover&output=jpg`
    let thumbBuffer = Buffer.alloc(0)
    try {
      let thumbRes = await fetch(thumbUrl, { signal: AbortSignal.timeout(10000) })
      if (thumbRes.ok) thumbBuffer = Buffer.from(await thumbRes.arrayBuffer())
    } catch {}

    let botName = 'Rem Bot 🌺'
    let userName = m.pushName || 'User'
    let senderName = global.db?.data?.users?.[m.sender]?.name || userName

    let teks = `❀.─━━━━🌷━━━━─.❀
   ⌊🌺 | ${botName} | 🌺⌋
❀.─━━━━🌷━━━━─.❀

*👤 User:* ${userName}
*🤖 Bot:* ${botName}

*✨ Welcome*
To see the commands, press the menu button

❀.─━━━━🌷━━━━─.❀
> ${botName}`

    // ================= التوثيق من الكود التاني =================
    const allQuoted = {
      key: { remoteJid: '0@s.whatsapp.net' },
      message: {
        contactMessage: {
          displayName: senderName,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${senderName}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`,
        },
      },
    }

    await conn.sendMessage(m.chat, {
      document: { url: imgUrl },
      mimetype: 'image/jpeg',
      fileName: `${botName}.jpg`,
      fileLength: 1024000,
      jpegThumbnail: thumbBuffer,
      caption: teks,
      footer: botName,
      nativeFlow: [
        {},
        { text: '👑', url: `https://wa.me/212674375708` },
        { text: '🌐', id: `${_p}ping` },
        { text: '🪭', id: `${_p}جميع_الاوامر` }
      ]
    }, { quoted: allQuoted })

  } catch (e) {
    console.log(e)
    m.reply(`❌ Error: ${e.message}`)
  }
}

handler.help = ['اوامر', 'menu']
handler.tags = ['main']
handler.command = /^(اوامر|المهام)$/i
export default handler