// plugins/runcrm.js
function parseCrmPayload(source) {
  const text = String(source || '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Payload CRM tidak berisi objek JSON')
  }
  return JSON.parse(text.slice(start, end + 1))
}

let handler = async (m, { satanic, text, command, prefix, isCreator }) => {
const from = m.chat

if (!isCreator) {
return m.reply('❌ Fitur khusus owner/pemilik saja ya kak~ 🌸')
}

if (!m.quoted) {
return m.reply(
`⚠️ *Cara penggunaan:*\n\n` +
`Reply ke file *relay.js* yang sudah dibuat, lalu kirim *${prefix}${command}*\n\n` +
`📌 Contoh: Reply file relay.js lalu ketik ${prefix}runcrm`
)
}

const quotedMsg = m.quoted

const isDocument = quotedMsg.mimetype === 'application/javascript' ||
quotedMsg.fileName === 'relay.js' ||
quotedMsg.documentMessage ||
quotedMsg.msg?.documentMessage

if (!isDocument) {
return m.reply(
`❌ Bukan file yang valid!\n\n` +
`📌 Reply ke file *relay.js* yang dikirim bot`
)
}

try {
const media = await satanic.downloadMediaMessage(m.quoted)
if (!media) {
return m.reply('❌ Gagal mendownload file')
}

const fileContent = media.toString('utf8')
let crmData

try {
crmData = parseCrmPayload(fileContent)
} catch (e) {
return m.reply(`❌ Gagal parsing CRM:\n${e.message}`)
}

if (!crmData || !crmData.payload) {
return m.reply('❌ CRM tidak valid atau payload kosong')
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
return m.reply('❌ Tidak ada konten yang bisa dikirim dari CRM')
}

await satanic.sendMessage(from, {
react: {
text: '✅',
key: m.key
}
})

let infoText = `✅ *CRM berhasil dijalankan*\n\n`
infoText += `📅 Dibuat: ${crmData.createdAt || 'Tidak diketahui'}\n`
infoText += `👤 Creator: ${crmData.creator || 'Tidak diketahui'}\n`
infoText += `📝 Tipe: ${payload.type || 'Tidak diketahui'}\n`
infoText += `🔘 Button: ${payload.hasButtons ? '✅ Ada' : '❌ Tidak'}\n`
if (payload.hasLocation) {
infoText += `📍 Location: ✅ Ada\n`
}

await satanic.sendMessage(from, {
text: infoText
}, { quoted: m })

} catch (e) {
console.error('RUNCRM ERROR:', e)
return m.reply(
'❌ Gagal menjalankan CRM.\n\n' +
(e?.message || String(e))
)
}
}

handler.usage = ['runcrm']
handler.category = 'owner'
handler.command = /^(runcrm)$/i
handler.owner = true

export default handler