import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix }) => {

let images = [
  "https://files.catbox.moe/x39202.jpeg",
  "https://files.catbox.moe/o33zli.jpeg",
  "https://files.catbox.moe/ffij55.jpeg",
  "https://files.catbox.moe/4s1wse.jpeg"
]

// منع تكرار نفس الصورة
global.lastMenuImg = global.lastMenuImg || -1
let index
do {
  index = Math.floor(Math.random() * images.length)
} while (index === global.lastMenuImg && images.length > 1)
global.lastMenuImg = index

let baseImg = images[index]
// رابط فريد باش واتساب ما يديرش cache
let imgUrl = `${baseImg}?v=${Date.now()}`

let allCommands = Object.values(global.plugins || {})
.filter(v => v.usage && v.category)
.map(v => v.usage)
.flat()
.map(cmd => `›🎀‹ ${usedPrefix}${cmd}`)
.join('\n')

let teks = `𑁍𓂃.─ִ╾ׄ──ִ─ִ╾ ࣪🌷.─ִ╾ׄ──ִ─ִ╾ ࣪𓂃𑁍
⌊🌺╎الــمــهــام كــامــلــه ╎🌺⌉
𑁍𓂃.─ִ╾ׄ──ִ─ִ╾ ࣪🌷.─ִ╾ׄ──ִ─ִ╾ ࣪𓂃𑁍
${allCommands}
𑁍𓂃.─ִ╾ׄ─ִ──ִ╾ ࣪🌷.─ִ╾ׄ──ִ─ִ╾ ࣪𓂃𑁍
> Rem Bot 🌺`

let thumbBuffer = await (await fetch(baseImg)).buffer()

await conn.sendMessage(m.chat, { react: { text: '🌺', key: m.key } })

await conn.sendMessage(m.chat, {
  text: teks,
  contextInfo: {
    externalAdReply: {
      title: "𝐑𝐞𝐦 𝐁𝐨𝐭 🌺 | المهام كامله",
      body: "𝙰 𝚜𝚒𝚖𝚙𝚕𝚎 𝚋𝚘𝚝 𝚏𝚘𝚛 𝚏𝚞𝚗 𝚊𝚗𝚍 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚜",
      mediaType: 1,
      previewType: 0,
      thumbnail: thumbBuffer,
      sourceUrl: imgUrl,
      mediaUrl: imgUrl,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  }
}, { quoted: m })

}

handler.usage = ['جميع_الاوامر']
handler.category = 'main'
handler.command = /^(جميع_الاوامر)$/i

export default handler