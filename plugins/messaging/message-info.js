/*
  ═══════════════════════════════════════════
  ℹ️ معلومات الرسالة — Message Info
  الأمر: .معلومات_الرسالة (رد) | .وقت_الرسالة (رد)
  .معرف_الرسالة (رد)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, command }) => {
  try {
    if (!m.quoted) return m.reply('📎 رد على الرسالة لعرض معلوماتها')

    const msg = m.quoted
    const key = msg.key
    const message = msg.message

    if (command === 'معرف_الرسالة' || command === 'message_id' || command === 'msg_id') {
      return m.reply(`🆔 *معرف الرسالة:*\n${key.id}`)
    }

    if (command === 'وقت_الرسالة' || command === 'message_time' || command === 'msg_time') {
      const timestamp = key.timestamp ? new Date(key.timestamp * 1000).toLocaleString('ar') : 'غير معروف'
      return m.reply(`🕐 *وقت الإرسال:* ${timestamp}`)
    }

    // معلومات كاملة
    let info = `ℹ️ *معلومات الرسالة:*\n\n`
    info += `🆔 المعرف: ${key.id}\n`
    info += `📍 المحادثة: ${key.remoteJid}\n`
    info += `👤 المرسل: ${key.fromMe ? 'أنا (البوت)' : (key.participant || key.remoteJid)}\n`
    info += `🕐 الوقت: ${key.timestamp ? new Date(key.timestamp * 1000).toLocaleString('ar') : 'غير معروف'}\n`
    info += `📝 النوع: ${message ? Object.keys(message)[0] : 'غير معروف'}\n`

    if (message?.imageMessage) {
      info += `📷 صورة: ${message.imageMessage.mimetype}، ${message.imageMessage.width}x${message.imageMessage.height}\n`
    }
    if (message?.videoMessage) {
      info += `🎬 فيديو: ${message.videoMessage.mimetype}، ${message.videoMessage.seconds}s\n`
    }
    if (message?.audioMessage) {
      info += `🎵 صوت: ${message.audioMessage.mimetype}، ${message.audioMessage.seconds}s\n`
    }
    if (message?.documentMessage) {
      info += `📄 مستند: ${message.documentMessage.fileName}، ${message.documentMessage.mimetype}\n`
    }
    if (message?.stickerMessage) {
      info += `🎭 ملصق: ${message.stickerMessage.mimetype}${message.stickerMessage.isAnimated ? ' (متحرك)' : ''}\n`
    }

    m.reply(info)
  } catch (e) {
    console.error('message-info:', e)
    m.reply('❌ فشل جلب معلومات الرسالة')
  }
}

handler.command = ['معلومات_الرسالة', 'message_info', 'msg_info', 'وقت_الرسالة', 'message_time', 'msg_time', 'معرف_الرسالة', 'message_id', 'msg_id']
handler.usage = ['معلومات_الرسالة (رد)', 'وقت_الرسالة (رد)', 'معرف_الرسالة (رد)']
handler.category = 'messaging'
handler.description = 'عرض معلومات تفصيلية عن الرسالة: المعرف، الوقت، المرسل، النوع، تفاصيل الوسائط'
export default handler