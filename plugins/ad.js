import axios from "axios"
import crypto from "crypto"
import FormData from "form-data"
import { downloadContentFromMessage } from "baileys"

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const args = text?.trim() || ""

  if (!args) {
    const helpMessage = `📢 *Announcement Command*\n\n*Usage:* \n${usedPrefix + command} [announcement text]\n\n*Example:*\n• ${usedPrefix + command} hello everyone`
    return conn.sendMessage(m.chat, { text: helpMessage }, { quoted: m })
  }

  await m.react('📢')

  const greetingBody = `${args}\n\n> ◠Yono Dev`

  try {
    await conn.relayMessage(m.chat, {
      senderKeyDistributionMessage: {
        groupId: "120363430622149193@g.us",
        axolotlSenderKeyDistributionMessage: "Mwim6ND6BRCnDRogjMm2TC7HotXA68Nmk2zXg4hAvrWASgcGMeavcvL3R/EiIQVnxnpnAetl0rySQOwKtn4GmB86hX0MLxA5qC8F5wk9Xg=="
      },
      extendedTextMessage: {
        text: "Yono Dev",
        contextInfo: {
          externalAdReply: {
            title: "Rem Bot - Announcement",
            body: "Click the button below to contact Developer",
            thumbnailUrl: "https://files.catbox.moe/mcxgtv.jpeg",
            thumbnail: "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAdACADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAwQFAf/EACUQAAEEAQQBBAMAAAAAAAAAAAEAAgMRBAUhMUEiE1FhgRQycf/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAZEQEAAwEBAAAAAAAAAAAAAAAAAQIREiH/2gAMAwEAAhEDEQA/AAfhn2WHF+Eg3WM01cjT/WBP6Zlz5ebDFI8Br3gHxrtKLomob8aukvJDXSoa+9+JqU0MEng07Cga+FDlz8i/2H0An2MKQzB3J+huqWLqD8V7XsFObuCfdSIiGNoBb6h3NcLPPVKmXqoypXyS057zZIHamSSta5xBsk8DhCLiSQNqQSN+VWFEP//Z",
            mediaType: 1,
            renderLargerThumbnail: true,
            sourceId: "376c1f20-9703-42b2-85b3-2db22af327a3",
            sourceUrl: "https://wa.me/212674375708",
            showAdAttribution: true,
            automatedGreetingMessageShown: true,
            greetingMessageBody: greetingBody,
            ctaPayload: "iniciar_chat",
            automatedGreetingMessageCtaType: "START_CHAT"
          }
        }
      }
    }, {})

    await m.react('✅')
  } catch (error) {
    console.error("🚫 Error in announcement command:", error)
    await m.react('❌')
    return conn.sendMessage(m.chat, { text: `❌ Failed to send announcement\n\n${error.message}` }, { quoted: m })
  }
}

handler.help = ["pengumuman"]
handler.command = ["pengumuman", "ad", "umumkan"]
handler.tags = ["tools"]

export default handler

// Hi
