import axios from "axios"
import crypto from "crypto"
import FormData from "form-data"
import { downloadContentFromMessage } from "baileys"

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const args = text?.trim() || ""

  if (!args) {
    const helpMessage = `📢 *Perintah Iklan - Rem Bot*\n\n*Cara Penggunaan:*\n${usedPrefix + command} [teks iklan]\n\n*Contoh:*\n• ${usedPrefix + command} Halo semua, ada promo menarik hari ini!\n\nDikembangkan oleh Rem Bot`
    return conn.sendMessage(m.chat, { text: helpMessage }, { quoted: m })
  }

  await m.react('📢')

  const greetingBody = `${args}\n\n> ◠⿻ Rem Bot 🎀⃝⃕𝆺𝅥𝆹𝅥`

  try {
    // Trik greeting iklan
    await conn.relayMessage(m.chat, {
      senderKeyDistributionMessage: {
        groupId: "120363430622149193@g.us",
        axolotlSenderKeyDistributionMessage: "Mwim6ND6BRCnDRogjMm2TC7HotXA68Nmk2zXg4hAvrWASgcGMeavcvL3R/EiIQVnxnpnAetl0rySQOwKtn4GmB86hX0MLxA5qC8F5wk9Xg=="
      },
      extendedTextMessage: {
        text: "BERHASIL ✅",
        contextInfo: {
          externalAdReply: {
            thumbnailUrl: "https://athars.space/uploads/fee2fff3.jpg",
            thumbnail: "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAdACADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAwQFAf/EACUQAAEEAQQBBAMAAAAAAAAAAAEAAgMRBAUhMUEiE1FhgRQycf/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAZEQEAAwEBAAAAAAAAAAAAAAAAAQIREiH/2gAMAwEAAhEDEQA/AAfhn2WHF+Eg3WM01cjT/WBP6Zlz5ebDFI8Br3gHxrtKLomob8aukvJDXSoa+9+JqU0MEng07Cga+FDlz8i/2H0An2MKQzB3J+huqWLqD8V7XsFObuCfdSIiGNoBb6h3NcLPPVKmXqoypXyS057zZIHamSSta5xBsk8DhCLiSQNqQSN+VWFEP//Z",
            sourceId: "376c1f20-9703-42b2-85b3-2db22af327a3",
            sourceUrl: "https://whatsapp.com/channel/0029VbBh4ku8aKvPx1m0l822",
            automatedGreetingMessageShown: true,
            greetingMessageBody: greetingBody,
            ctaPayload: "iniciar_chat",
            automatedGreetingMessageCtaType: "START_CHAT"
          }
        }
      }
    }, {})

    // Tombol menuju Developer Rem Bot
    await conn.sendMessage(m.chat, {
      text: `✅ *Iklan berhasil dikirim oleh Rem Bot*\n\nJika ada kendala, hubungi Developer di bawah ini.`,
      footer: "© Rem Bot",
      templateButtons: [
        {
          index: 1,
          urlButton: {
            displayText: "👑 Hubungi Developer",
            url: "https://wa.me/212674375708"
          }
        },
        {
          index: 2,
          quickReplyButton: {
            displayText: "📢 Iklan Baru",
            id: `${usedPrefix}iklan`
          }
        }
      ]
    }, { quoted: m })

    await m.react('✅')
  } catch (error) {
    console.error("🚫 Kesalahan pada perintah iklan:", error)
    await m.react('❌')
    return conn.sendMessage(m.chat, { text: `❌ Gagal mengirim iklan\n\n*Detail:* ${error.message}` }, { quoted: m })
  }
}

handler.help = ["iklan"]
handler.command = ["iklan", "ad", "siaran"]
handler.tags = ["tools"]

export default handler