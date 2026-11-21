import fetch from 'node-fetch'
import { createWelcomeImage } from '../lib/welcome-image.js'

const BOT = 'LIGHT BOT'

async function getBuffer(url) {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

let handler = async (m, { conn, command }) => {
  if (command !== 'one') return

  await conn.sendMessage(m.chat, { react: { text: '🔥', key: m.key } })

  try {
    const who = m.mentionedJid?.[0] || m.sender
    const number = who.split('@')[0]
    let profileUrl = null

    try {
      profileUrl = await conn.profilePictureUrl(who, 'image')
    } catch {}

    const avatar = await getBuffer(profileUrl).catch(() => null)
    const image = await createWelcomeImage({
      avatar,
      number,
      title: 'WELCOME TO GROUP',
      brand: BOT,
    })

    await conn.sendMessage(m.chat, {
      image,
      caption: `🚀 *WELCOME - ${BOT}*\n\n> 👋 Selamat datang @${number}!\n> 📞 Nomor: +${number}\n> 🎉 Semoga betah di grup!\n\n© ${BOT}`,
      mentions: [who],
    }, { quoted: m })

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (error) {
    console.log(error)
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    m.reply(`❌ Error: ${error.message}`)
  }
}

handler.usage = ['one']
handler.category = 'group'
handler.command = /^(one|welcome|testwelcome)$/i
handler.group = true
export default handler
