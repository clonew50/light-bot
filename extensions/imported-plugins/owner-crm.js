// plugins/crm.js
import fs from 'fs'
import path from 'path'
import { generateWAMessageFromContent } from '@whiskeysockets/baileys'

function unwrap(content) {
if (!content || typeof content !== 'object') return content
if (content.ephemeralMessage?.message) return unwrap(content.ephemeralMessage.message)
if (content.viewOnceMessage?.message) return unwrap(content.viewOnceMessage.message)
if (content.viewOnceMessageV2?.message) return unwrap(content.viewOnceMessageV2.message)
if (content.viewOnceMessageV2Extension?.message) return unwrap(content.viewOnceMessageV2Extension.message)
if (content.documentWithCaptionMessage?.message) return unwrap(content.documentWithCaptionMessage.message)
return content
}

function normalizeForRelay(rawContent) {
const content = unwrap(rawContent)
if (typeof content?.conversation === 'string') {
const { conversation, ...rest } = content
return { ...rest, extendedTextMessage: { text: conversation } }
}
return content
}

function toJsLiteral(value, indent = 2, seen = new WeakSet(), depth = 0) {
if (value === null) return 'null'
if (value === undefined) return 'undefined'
if (typeof value === 'string') return JSON.stringify(value)
if (typeof value === 'number' || typeof value === 'boolean') return String(value)
if (typeof value === 'bigint') return value.toString()
if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
return JSON.stringify(Buffer.from(value).toString('base64'))
}
if (typeof value !== 'object') return JSON.stringify(value)
if (depth > 40) return '"[MaxDepth]"'
if (seen.has(value)) return '"[Circular]"'
seen.add(value)
const pad = ' '.repeat(indent)
const padClose = ' '.repeat(Math.max(indent - 2, 0))
let result
if (Array.isArray(value)) {
if (!value.length) {
result = '[]'
} else {
const items = value.map((v) => pad + toJsLiteral(v, indent + 2, seen, depth + 1))
result = `[\n${items.join(',\n')}\n${padClose}]`
}
} else {
const keys = Object.keys(value).filter((k) => typeof value[k] !== 'function' && value[k] !== undefined)
if (!keys.length) {
result = '{}'
} else {
const lines = keys.map((k) => {
const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
return `${pad}${keyStr}: ${toJsLiteral(value[k], indent + 2, seen, depth + 1)}`
})
result = `{\n${lines.join(',\n')}\n${padClose}}`
}
}
seen.delete(value)
return result
}

const FRAMEWORK_DECORATED_KEYS = new Set([
'mtype', 'id', 'chat', 'isBaileys', 'sender', 'fromMe', 'mentionedJid',
'fakeObj', 'delete', 'copyNForward', 'download', 'key', 'participant',
'text', 'body', 'name', 'pushName', 'viewonce', 'download1',
])

function stripFrameworkProps(content) {
if (!content || typeof content !== 'object') return content
const out = {}
for (const k of Object.keys(content)) {
if (FRAMEWORK_DECORATED_KEYS.has(k)) continue
if (typeof content[k] === 'function') continue
out[k] = content[k]
}
return out
}

function buildReadableSendCode(content) {
try {
const clean = stripFrameworkProps(content)
return `satanic.relayMessage(\n  m.chat,\n  ${toJsLiteral(clean)},\n  {}\n)`
} catch (err) {
return `// Gagal generate relay_code: ${err?.message || err}`
}
}

function typeNameFromContent(content) {
const clean = stripFrameworkProps(content)
const key = Object.keys(clean)[0] || 'UnknownMessage'
return key.charAt(0).toUpperCase() + key.slice(1)
}

function buildRelayCodeFile(rawQuotedContent) {
const dir = path.join(process.cwd(), 'debug')
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true })
}
const typeName = typeNameFromContent(rawQuotedContent)
const filename = `${typeName}.js`
const filepath = path.join(dir, filename)
const code = buildReadableSendCode(rawQuotedContent)
fs.writeFileSync(filepath, code, 'utf-8')
return { filepath, filename }
}

let handler = async (m, { satanic, text, command, prefix, isCreator }) => {
const from = m.chat

if (!isCreator) {
return m.reply('❌ Fitur khusus owner/pemilik saja ya kak~ 🌸')
}

if (!m.quoted) {
return m.reply(
`⚠️ *Cara penggunaan:*\n\n` +
`Reply pesan yang mau di-relay, lalu kirim *${prefix}${command}*\n\n` +
`📌 Contoh: Reply pesan button/list/location lalu ketik ${prefix}crm\n\n` +
`📌 Mode:\n` +
`• ${prefix}crm - Mode JSON (file relay.js)\n` +
`• ${prefix}crm2 - Mode JS (file ${typeNameFromContent}.js)`
)
}

function crmHasViewOnce(obj, visited = new WeakSet()) {
if (!obj || typeof obj !== 'object') return false
if (visited.has(obj)) return false
visited.add(obj)
if (
obj.viewOnceMessage ||
obj.viewOnceMessageV2 ||
obj.viewOnceMessageV2Extension
) {
return true
}
for (const value of Object.values(obj)) {
if (crmHasViewOnce(value, visited)) {
return true
}
}
return false
}

if (crmHasViewOnce(m.quoted)) {
return m.reply('❌ Pesan view-once tidak bisa disimpan.')
}

try {
const quotedMsg = m.quoted
const rawQuoted = quotedMsg.message || quotedMsg.msg || m.msg?.contextInfo?.quotedMessage

if (!rawQuoted || typeof rawQuoted !== 'object' || !Object.keys(rawQuoted).length) {
return m.reply('❌ Tidak ada pesan yang bisa di-relay.')
}

const unwrapped = unwrap(rawQuoted)

if (!unwrapped || typeof unwrapped !== 'object' || !Object.keys(unwrapped).length) {
return m.reply('❌ Jenis pesan ini belum didukung untuk di-relay.')
}

let fullData = {}
let messageType = 'unknown'
let hasButtons = false
let buttonData = null
let locationData = null

if (quotedMsg.quoted) {
fullData = quotedMsg.quoted
messageType = fullData.mtype || 'unknown'
if (fullData.buttonsMessage) {
hasButtons = true
buttonData = fullData.buttonsMessage
if (buttonData.locationMessage) {
locationData = buttonData.locationMessage
}
}
} else if (quotedMsg.message) {
fullData = quotedMsg.message
const keys = Object.keys(fullData)
if (keys.length > 0) {
messageType = keys[0]
if (messageType === 'buttonsMessage') {
hasButtons = true
buttonData = fullData[messageType]
if (buttonData.locationMessage) {
locationData = buttonData.locationMessage
}
}
}
} else if (quotedMsg.msg) {
fullData = quotedMsg.msg
const keys = Object.keys(fullData)
if (keys.length > 0) {
messageType = keys[0]
if (messageType === 'buttonsMessage') {
hasButtons = true
buttonData = fullData[messageType]
if (buttonData.locationMessage) {
locationData = buttonData.locationMessage
}
}
}
}

const isCrm2 = command === 'crm2'

if (isCrm2) {
const relayContent = normalizeForRelay(rawQuoted)
const relayMsg = generateWAMessageFromContent(m.chat, relayContent, {
userJid: satanic.user.id,
quoted: m,
})
await satanic.relayMessage(relayMsg.key.remoteJid, relayMsg.message, {
messageId: relayMsg.key.id,
})
const { filepath, filename } = buildRelayCodeFile(unwrapped)
await satanic.sendMessage(
m.chat,
{
document: fs.readFileSync(filepath),
fileName: filename,
mimetype: 'text/javascript',
caption: `✅ *Relay berhasil (CRM2)*\n\n📄 ${filename}\n📝 Tipe: ${typeNameFromContent(unwrapped)}`
},
{ quoted: m }
)
} else {
const crmPayload = {
key: quotedMsg.key || {},
sender: quotedMsg.sender || m.sender,
timestamp: quotedMsg.timestamp || Date.now(),
text: quotedMsg.text || quotedMsg.body || '',
caption: quotedMsg.caption || '',
type: messageType,
hasButtons: hasButtons,
hasLocation: !!locationData,
fullData: fullData,
buttonData: buttonData,
locationData: locationData,
rawMessage: fullData
}

const crmData = {
type: 'satanic-crm-relay',
version: 2,
createdAt: new Date().toISOString(),
creator: global.config?.botname || 'Rinn MD',
payload: crmPayload
}

const crmCode = `module.exports = ${JSON.stringify(crmData, null, 2)};\n`

let infoText = `✅ *CRM berhasil dibuat (JSON)*\n\n`
infoText += `📝 Tipe: ${messageType}\n`
infoText += `🔘 Button: ${hasButtons ? '✅ Ada' : '❌ Tidak'}\n`
if (locationData) {
infoText += `📍 Location: ${locationData.name || 'Ada'}\n`
}
infoText += `📅 Waktu: ${crmData.createdAt}\n\n`
infoText += `Reply file ini lalu kirim:\n`
infoText += `*${prefix}runcrm*`

await satanic.sendMessage(
m.chat,
{
document: Buffer.from(crmCode),
mimetype: 'application/javascript',
fileName: 'relay.js',
caption: infoText
},
{ quoted: m }
)
}

await satanic.sendMessage(from, {
react: {
text: '✅',
key: m.key
}
})

} catch (e) {
console.error('CRM ERROR:', e)
try {
if (typeof global.sendAdminLog === 'function') {
await global.sendAdminLog(
satanic,
'crm',
m.sender?.split('@')[0] || m.sender,
e
)
}
} catch {}
return m.reply(
'❌ Gagal membuat CRM.\n\n' +
(e?.message || String(e))
)
}
}

handler.usage = ['crm', 'crm2']
handler.category = 'owner'
handler.command = /^(crm|crm2)$/i
handler.owner = true

export default handler