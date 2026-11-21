// plugins/pptag.js - REM BOT - PRIVATE TAG 1 ORANG = 1 GAMBAR - FIXED 300x300
import baileys from '@whiskeysockets/baileys'
import fetch from 'node-fetch'
import crypto from 'crypto'

let sharp
try { sharp = (await import('sharp')).default } catch { sharp = null }

const fallbackPP = 'https://files.catbox.moe/96cm7n.jpeg'

async function getPPBuffer(jid, conn) {
  try {
    let url = await conn.profilePictureUrl(jid, 'image')
    let res = await fetch(url)
    if (!res.ok) throw new Error('fetch fail')
    let buf = Buffer.from(await res.arrayBuffer())
    if (sharp) {
      try {
        buf = await sharp(buf).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
      } catch {}
    }
    return buf
  } catch {
    try {
      let res = await fetch(fallbackPP)
      if (!res.ok) throw new Error('fallback fetch fail')
      let buf = Buffer.from(await res.arrayBuffer())
      if (sharp) {
        try {
          buf = await sharp(buf).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
        } catch {}
      }
      return buf
    } catch {
      return null
    }
  }
}

async function sendPrivateImage(conn, jid, imageBuffer, targetJid, caption, messageId) {
  try {
    const { imageMessage } = await baileys.prepareWAMessageMedia(
      { image: imageBuffer },
      { upload: conn.waUploadToServer }
    )

    const content = {
      imageMessage: {
        ...imageMessage,
        caption,
        jpegThumbnail: imageBuffer.slice(0, 20000),
        contextInfo: {
          mentionedJid: [targetJid],
          participant: targetJid,
        }
      }
    }

    const waMsg = await baileys.generateWAMessageFromContent(jid, content, {
      userJid: conn.user.id,
    })

    if (messageId) waMsg.key.id = messageId + targetJid.split('@')[0]

    await conn.relayMessage(jid, waMsg.message, {
      messageId: waMsg.key.id,
      additionalNodes: [
        {
          tag: 'participants',
          attrs: {},
          content: [
            { tag: 'to', attrs: { jid: targetJid }, content: undefined }
          ]
        }
      ]
    })
    return true
  } catch (e) {
    console.log('private fail', targetJid, e.message)
    try {
      await conn.sendMessage(jid, {
        image: imageBuffer,
        caption,
        mentions: [targetJid]
      })
      return true
    } catch { return false }
  }
}

let handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ Group only!')

  const jid = m.chat
  const groupMeta = await conn.groupMetadata(jid)
  const botNum = conn.user.id.split('@')[0].split(':')[0]
  const participants = groupMeta.participants.filter(
    p => p.id.split('@')[0].split(':')[0] !== botNum
  )

  if (!participants.length) return m.reply('❌ Tidak ada member')

  const messageId = crypto.randomBytes(12).toString('hex').toUpperCase()
  await conn.sendMessage(jid, { text: `⏳ Siap kirim ${participants.length} private images...\n> 300x300 fixed` }, { quoted: m })

  let sukses = 0
  for (let p of participants) {
    let buf = await getPPBuffer(p.id, conn)
    if (!buf) continue

    let ok = await sendPrivateImage(
      conn,
      jid,
      buf,
      p.id,
      `gambar disini sesuai dengan foto profilmu\n> _hanya kamu yang dapat melihat pesan ini._\n@${p.id.split('@')[0]}`,
      messageId
    )
    if (ok) sukses++
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  await m.reply(`✅ Selesai! ${sukses}/${participants.length} - Masing-masing lihat fotonya sendiri`)
}

handler.usage = ['pptag']
handler.category = 'group'
handler.command = /^(pptag|ppprivate|privatepp)$/i
handler.group = true
handler.admin = true

export default handler