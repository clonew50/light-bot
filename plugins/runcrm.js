// plugins/runcrm.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs')
const path = require('path')

let handler = async (m, { satanic, text, command, prefix, isCreator }) => {
const from = m.chat

if (!isCreator) {
return m.reply('❌ This feature is for the owner only~ 🌸')
}

if (!m.quoted) {
return m.reply(
`⚠️ *How to use:*\n\n` +
`Reply to the *relay.js* file that was created, then send *${prefix}${command}*\n\n` +
`📌 Example: Reply to the relay.js file then type ${prefix}runcrm`
)
}

const quotedMsg = m.quoted

const isDocument = quotedMsg.mimetype === 'application/javascript' ||
quotedMsg.fileName === 'relay.js' ||
quotedMsg.documentMessage ||
quotedMsg.msg?.documentMessage

if (!isDocument) {
return m.reply(
`❌ Not a valid file!\n\n` +
`📌 Reply to the *relay.js* file sent by the bot`
)
}

try {
const media = await satanic.downloadMediaMessage(m.quoted)
if (!media) {
return m.reply('❌ Failed to download file')
}

const fileContent = media.toString('utf8')
let crmData

try {
const tempFile = path.join(process.cwd(), 'temp', `crm_${Date.now()}.js`)

if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true })
}

fs.writeFileSync(tempFile, fileContent)

const loadedData = require(tempFile)
crmData = loadedData

fs.unlinkSync(tempFile)

} catch (e) {
return m.reply(`❌ Failed to parse CRM:\n${e.message}`)
}

if (!crmData || !crmData.payload) {
return m.reply('❌ Invalid CRM or empty payload')
}

const payload = crmData.payload

if (payload.hasButtons && payload.buttonData) {
const buttonMsg = {
text: payload.buttonData.contentText || payload.text || '',
footer: payload.buttonData.footerText || '',
buttons: payload.buttonData.buttons || [],
headerType: payload.buttonData.headerType || 6
}
if (payload.locationData) {
buttonMsg.location = payload.locationData
}
await satanic.sendMessage(from, buttonMsg, {
quoted: m
})
} else if (payload.rawMessage && Object.keys(payload.rawMessage).length > 0) {
await satanic.sendMessage(from, payload.rawMessage, {
quoted: m
})
} else if (payload.text) {
await satanic.sendMessage(from, { text: payload.text }, { quoted: m })
} else {
return m.reply('❌ No content to send from the CRM')
}

await satanic.sendMessage(from, {
react: {
text: '✅',
key: m.key
}
})

let infoText = `✅ *CRM successfully executed*\n\n`
infoText += `📅 Created: ${crmData.createdAt || 'Unknown'}\n`
infoText += `👤 Creator: ${crmData.creator || 'Unknown'}\n`
infoText += `📝 Type: ${payload.type || 'Unknown'}\n`
infoText += `🔘 Button: ${payload.hasButtons ? '✅ Yes' : '❌ No'}\n`
if (payload.hasLocation) {
infoText += `📍 Location: ✅ Yes\n`
}

await satanic.sendMessage(from, {
text: infoText
}, { quoted: m })

} catch (e) {
console.error('RUNCRM ERROR:', e)
return m.reply(
'❌ Failed to run CRM.\n\n' +
(e?.message || String(e))
)
}
}

handler.help = ['runcrm']
handler.tags = ['owner']
handler.command = /^(runcrm)$/i
handler.owner = true

export default handler