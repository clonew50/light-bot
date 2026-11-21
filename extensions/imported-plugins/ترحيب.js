import fetch from 'node-fetch'
import { createWelcomeImage } from '../lib/welcome-image.js'

const BOT = 'LIGHT BOT'

async function getBuffer(url) {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

let handler = async (m, { conn, command, args, usedPrefix }) => {
  if (command === 'welcome') {
    const chat = global.db.groups[m.chat] ||= {}
    if (args[0] === 'on') {
      chat.welcome = true
      return m.reply(`✅ *Welcome ON - ${BOT}*\nSekarang setiap ada yang masuk akan disambut`)
    }
    if (args[0] === 'off') {
      chat.welcome = false
      return m.reply(`❌ *Welcome OFF - ${BOT}*`)
    }
    return m.reply(`*Cara pakai:*\n${usedPrefix}welcome on = aktifkan\n${usedPrefix}welcome off = matikan\n${usedPrefix}one = test welcome\n\nStatus: ${chat.welcome ? 'ON ✅' : 'OFF ❌'}`)
  }

  if (command === 'one') {
    await conn.sendMessage(m.chat, { react: { text: '🔥', key: m.key } })
    const who = m.mentionedJid?.[0] || m.sender
    const image = await makeWelcome(conn, who)
    await conn.sendMessage(m.chat, {
      image,
      caption: `🚀 *TEST WELCOME - ${BOT}*\n\n👋 Selamat datang @${who.split('@')[0]}!\n\n© ${BOT}`,
      mentions: [who],
    }, { quoted: m })
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  }
}

handler.usage = ['welcome', 'one']
handler.category = 'group'
handler.command = /^(welcome|one|testwelcome)$/i
handler.group = true
handler.admin = true

async function makeWelcome(conn, who) {
  const jidNumber = who.split('@')[0]
  let profileUrl = null

  try {
    profileUrl = await conn.profilePictureUrl(who, 'image')
  } catch {}

  const avatar = await getBuffer(profileUrl).catch(() => null)
  return createWelcomeImage({
    avatar,
    number: jidNumber,
    title: 'WELCOME TO GROUP',
    brand: BOT,
  })
}

handler.before = async function (m, { conn }) {
  if (!m.messageStubType) return
  if (!global.db?.groups) return

  const chat = global.db.groups[m.chat]
  if (!chat?.welcome) return

  if (m.messageStubType == 27 || m.messageStubType == 32) {
    for (const who of m.messageStubParameters || []) {
      try {
        const image = await makeWelcome(conn, who)
        await conn.sendMessage(m.chat, {
          image,
          caption: `🚀 *WELCOME - ${BOT}*\n\n👋 Halo @${who.split('@')[0]}!\nSelamat datang di grup!\nSemoga betah ya kak!\n\n© ${BOT}`,
          mentions: [who],
        })
      } catch (error) {
        console.log('WELCOME ERROR:', error)
      }
    }
  }
}

export default handler
