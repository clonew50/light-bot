/*
  ═══════════════════════════════════════════
  ⏳ الرسائل المختفية — Disappearing Messages
  الأمر: .مختفي <مدة> | .إيقاف_مختفي
  المدد: 24س، 7أ، 90ي، إيقاف
  .رسالة_مختفي <نص> (يرسل رسالة مختفية واحدة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    const durationMap = {
      'إيقاف': 0,
      'off': 0,
      '0': 0,
      '24س': 86400,
      '24h': 86400,
      'يوم': 86400,
      '7أ': 604800,
      '7d': 604800,
      'أسبوع': 604800,
      '90ي': 7776000,
      '90d': 7776000,
      '3ش': 7776000,
      'شهر3': 7776000
    }

    if (command === 'رسالة_مختفي' || command === 'ephemeral_msg') {
      if (!text) return m.reply('📝 اكتب النص: .رسالة_مختفي هذه رسالة مؤقتة')
      await conn.sendMessage(m.chat, { text }, { ephemeralExpiration: 86400 })
      return m.reply('⏳ تم إرسال رسالة مختفية (24 ساعة)')
    }

    const durationText = text.trim()
    if (!durationText) {
      return m.reply(
        '⏳ الاستخدام:\n' +
        '.مختفي 24س — تفعيل للرسائل الجديدة (24 ساعة)\n' +
        '.مختفي 7أ — أسبوع\n' +
        '.مختفي 90ي — 90 يوم\n' +
        '.مختفي إيقاف — تعطيل\n' +
        '.رسالة_مختفي نص — رسالة واحدة مختفية'
      )
    }

    const ephemeral = durationMap[durationText]
    if (ephemeral === undefined) return m.reply('❌ مدة غير معروفة. المدد: 24س، 7أ، 90ي، إيقاف')

    await conn.sendMessage(m.chat, { disappearingMessagesInChat: ephemeral || false })

    if (ephemeral === 0) {
      m.reply('✅ تم تعطيل الرسائل المختفية في هذه المحادثة')
    } else {
      const label = Object.entries(durationMap).find(([, v]) => v === ephemeral)?.[0] || durationText
      m.reply(`⏳ تم تفعيل الرسائل المختفية لمدة ${label} في هذه المحادثة`)
    }
  } catch (e) {
    console.error('disappearing:', e)
    m.reply('❌ فشل تعديل إعدادات الرسائل المختفية (تحتاج صلاحيات في المجموعات)')
  }
}

handler.command = ['مختفي', 'disappearing', 'إيقاف_مختفي', 'رسالة_مختفي', 'ephemeral_msg']
handler.usage = ['مختفي 24س', 'مختفي 7أ', 'مختفي 90ي', 'مختفي إيقاف', 'رسالة_مختفي نص سري']
handler.category = 'messaging'
handler.description = 'تفعيل/تعطيل الرسائل المختفية في المحادثة أو إرسال رسالة مختفية واحدة'
export default handler