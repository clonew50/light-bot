import os from 'os'
import { performance } from 'perf_hooks'

let handler = async (m, { conn }) => {
  let old = performance.now()
  await new Promise(a => setTimeout(a, 10))
  let neww = performance.now()
  let speed = (neww - old).toFixed(2)

  let uptimeBot = clockString(process.uptime() * 1000)
  let uptimeServer = clockString(os.uptime() * 1000)
  let totalmem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1)
  let freemem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1)
  let usedmem = (totalmem - freemem).toFixed(1)
  let cpus = os.cpus()[0]?.model || 'Unknown'
  let platform = os.platform()
  let arch = os.arch()
  let nodev = process.version
  let ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(0)
  let heap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)

  let teks = `🏓 Kecepatan Respon: ${speed}ms
⏱️ Uptime Bot: ${uptimeBot}
🌐 Uptime Server: ${uptimeServer}
💻 Sistem: ${platform} • Node ${nodev}
🧬 Kernel: ${os.release()} • ${arch}
🖥️ CPU: ${cpus}
📊 Load: ${os.loadavg().map(v=>v.toFixed(2)).join(' ')}
🧠 RAM Bot: ${ramUsage}MB • Heap: ${heap}MB
🗄️ RAM Server: ${usedmem}GB / ${totalmem}GB
💾 Hak Cipta: ʀᴇᴍ ʙᴏᴛ`

  await conn.relayMessage(m.chat, {
    messageContextInfo: {
      },
    eventMessage: {
      contextInfo: {
        stanzaId: "A5669373629356EA84B023F4EE777C6D",
        participant: "116007855239354@lid",
        expiration: 7776000,
        disappearingMode: { initiator: 0 }
      },
      isCanceled: false,
      name: "ʀᴇᴍ ʙᴏᴛ - SERVER STATUS",
      description: teks,
      location: {
        degreesLatitude: -6.9175,
        degreesLongitude: 107.6191,
        name: "ʀᴇᴍ ʙᴏᴛ Official • Bandung, Indonesia"
      },
      startTime: 1791452985,
      endTime: 1791504000,
      extraGuestsAllowed: true,
      isScheduleCall: false
    }
  }, {
    additionalNodes: [{ tag: "meta", attrs: { event_type: "creation" } }]
  })
}

handler.usage = ['server','m']
handler.category = 'info'
handler.command = /^(server|m|status|stats|stat|infobot)$/i

export default handler

function clockString(ms) {
  let h = isNaN(ms)? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms)? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms)? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}