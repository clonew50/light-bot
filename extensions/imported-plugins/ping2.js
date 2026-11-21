let handler = async (m, { conn }) => {
  const startedAt = Date.now()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const elapsed = Math.max(1, Date.now() - startedAt)

  await conn.sendMessage(m.chat, {
    text: `✅ *PING 2*\n\n• Response: ${elapsed} ms\n• User: @${m.sender.split('@')[0]}`,
    mentions: [m.sender],
  }, { quoted: m })
}

handler.usage = ['ping2']
handler.category = 'main'
handler.command = /^(ping2)$/i
handler.customPrefix = /./
export default handler
