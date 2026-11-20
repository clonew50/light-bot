/*
  ═══════════════════════════════════════════
  💬 إرسال رسائل نصية — Text Messages
  الأمر: .نص <نص> | .نص رد <نص> (للاقتباس)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, isOwner }) => {
  try {
    if (!text) return m.reply('📝 اكتب النص المراد إرساله:\n.نص مرحباً بالجميع\n.نص رد رد على هذه الرسالة')

    const isReply = text.startsWith('رد ')
    const messageText = isReply ? text.slice(3).trim() : text

    if (!messageText) return m.reply('❌ النص فارغ')

    const options = {}
    if (isReply && m.quoted) {
      options.quoted = m.quoted
    }

    await conn.sendMessage(m.chat, { text: messageText }, options)
  } catch (e) {
    console.error('send-text:', e)
    m.reply('❌ فشل إرسال الرسالة')
  }
}

handler.command = ['ارسال_نص', 'send_text', 'sendtext', 'text']
handler.usage = ['نص مرحباً', 'نص رد هذا رد مقتبس']
handler.category = 'messaging'
handler.description = 'إرسال رسائل نصية مع دعم الاقتباس'
export default handler