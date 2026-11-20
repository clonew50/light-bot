/*
  ═══════════════════════════════════════════
  📌 تثبيت الرسائل — Pin Messages
  الأمر: .تثبيت [مدة] | .إلغاء_تثبيت
  (يجب الرد على رسالة)
  المدد: 24س، 7أ، 30ي (افتراضي: 24 ساعة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.quoted) return m.reply('📎 يجب الرد على رسالة لتثبيتها/إلغاء تثبيتها')

    const key = m.quoted.key

    if (command === 'إلغاء_تثبيت' || command === 'الغاء_تثبيت' || command === 'unpin') {
      await conn.sendMessage(m.chat, { pin: { type: 0, time: 0, key } })
      return m.reply('✅ تم إلغاء تثبيت الرسالة')
    }

    const durationMap = {
      '24س': 86400,
      '24h': 86400,
      'يوم': 86400,
      '7أ': 604800,
      '7d': 604800,
      'أسبوع': 604800,
      '30ي': 2592000,
      '30d': 2592000,
      'شهر': 2592000
    }

    const durationText = text.trim().toLowerCase()
    const time = durationMap[durationText] || 86400

    await conn.sendMessage(m.chat, { pin: { type: 1, time, key } })
    const durationLabel = Object.entries(durationMap).find(([, v]) => v === time)?.[0] || '24 ساعة'
    m.reply(`📌 تم تثبيت الرسالة لمدة ${durationLabel}`)
  } catch (e) {
    console.error('pins:', e)
    m.reply('❌ فشل تثبيت الرسالة (تحتاج صلاحيات مشرف في المجموعات)')
  }
}

handler.command = ['تثبيت', 'pin', 'إلغاء_تثبيت', 'الغاء_تثبيت', 'unpin']
handler.usage = ['تثبيت', 'تثبيت 7أ', 'تثبيت 30ي', 'إلغاء_تثبيت']
handler.category = 'messaging'
handler.description = 'تثبيت أو إلغاء تثبيت الرسائل في المحادثة (يتطلب صلاحيات مشرف في المجموعات)'
export default handler