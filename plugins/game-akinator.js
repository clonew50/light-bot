//ig@elyas_tzy
//furqan x elyas
//roughly that's the watermark, don't delete it, don't overwrite it damn
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Akinator } = require('@aqul/akinator-api')
let handler = async (m, { conn }) => {
let id = m.chat
if (!conn.akinator) conn.akinator = new Map()
if (conn.akinator.has(id)) {
return m.reply('🎯 The Akinator game is already running in this chat.\nPress the *Give Up* button to stop.')
}
try {
const api = new Akinator({
region: 'id',
childMode: true
})
await api.start()
conn.akinator.set(id, api)
const progress = Math.round(api.progress)
await conn.sendButton(m.chat, {
image: { url: 'https://raw.githubusercontent.com/Furqan-si/file-random/main/CD1D1464333.jpeg' },
body: `🎩 *Akinator*\nThink of someone/an anime character or anything and I will guess it\n\n${api.question}\n\n📊 Progress : ${progress}%`,
footer: "Choose an answer:",
buttons: [
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Yes", id: "1" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "No", id: "2" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Don't know", id: "3" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Maybe", id: "4" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Maybe not", id: "5" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🚪 Give Up", id: "nyerah" }) }
]
}, { quoted: m }) 
} catch (e) { 
  console.error(e)
m.reply('❌ Failed to start Akinator.')
}

}

handler.before = async function (m) {

let id = m.chat

if (!this.akinator || !this.akinator.has(id)) return
if (!m.text) return

const session = this.akinator.get(id)
if (!session || session.processing) return

session.processing = true
const api = session

if (/nyerah/i.test(m.text)) {
this.akinator.delete(id)
session.processing = false
return m.reply('🚪 Akinator game stopped.')
}

const answerMap = {
'1': 0,
'2': 1,
'3': 2,
'4': 3,
'5': 4,
'ya': 0,
'tidak': 1,
'tidak tahu': 2,
'mungkin': 3,
'mungkin tidak': 4
}

let answer = answerMap[m.text.toLowerCase().trim()]

if (answer === undefined) {
session.processing = false
return
}

try {

await api.answer(answer)

if (api.isWin) {

let caption = `🎉 *Akinator guessed correctly!*\n\n`
caption += `👤 *${api.sugestion_name}*\n`

if (api.sugestion_desc) caption += `${api.sugestion_desc}\n`

await this.sendButton(m.chat, {
image: { url: api.sugestion_photo },
body: caption,
footer: "Game over",
buttons: [
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Play Again",
id: ".akinator"
})
}
]
}, { quoted: m })

this.akinator.delete(id)

} else {

const progress = Math.round(api.progress)

await this.sendButton(m.chat, {
body: `🎩 *Akinator*\n\n${api.question}\n\n📊 Progress : ${progress}%`,
footer: "Choose an answer:",
buttons: [
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Yes", id: "1" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "No", id: "2" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Don't know", id: "3" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Maybe", id: "4" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Maybe not", id: "5" }) },
{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🚪 Give Up", id: "nyerah" }) }
]
}, { quoted: m })

}

} catch (e) {

console.error(e)
m.reply('❌ An error occurred. Game stopped.')
this.akinator.delete(id)

}

session.processing = false

}

handler.help = ['akinator','aki']
handler.tags = ['game']
handler.command = /^(akinator|aki)$/i
handler.limit = true

export default handler
