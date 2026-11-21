import { performance } from 'perf_hooks'

let handler = async (m, { conn }) => {
  const startedAt = performance.now()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const elapsed = Math.max(1, Math.round(performance.now() - startedAt))

  await conn.sendMessage(m.chat, {
    text: `🧪 *Test*\n\n• Response: ${elapsed} ms\n• User: @${m.sender.split('@')[0]}`,
    mentions: [m.sender],
  }, { quoted: m })
}

handler.usage = ['test']
handler.category = 'info'
handler.command = /^(test|tes)$/i
export default handler
