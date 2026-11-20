/*
  ═══════════════════════════════════════════
  👁️ الحضور — Presence
  الأمر: .حضور <حالة> | .اشتراك_حضور
  الحالات: متاح، غير_متاح، يكتب، يسجل، متوقف
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    const presenceMap = {
      'متاح': 'available',
      'available': 'available',
      'غير_متاح': 'unavailable',
      'unavailable': 'unavailable',
      'يكتب': 'composing',
      'composing': 'composing',
      'يسجل': 'recording',
      'recording': 'recording',
      'متوقف': 'paused',
      'paused': 'paused'
    }

    if (command === 'اشتراك_حضور' || command === 'presence_subscribe') {
      await conn.presenceSubscribe(m.chat)
      return m.reply('✅ تم الاشتراك في تحديثات الحضور لهذه المحادثة')
    }

    const presenceText = text.trim()
    const presence = presenceMap[presenceText]

    if (!presence) {
      return m.reply(
        '👁️ الاستخدام:\n' +
        '.حضور متاح — تظهر متصلاً\n' +
        '.حضور غير_متاح — تظهر غير متصل (تصل إشعارات للهاتف)\n' +
        '.حضور يكتب — تظهر "يكتب..."\n' +
        '.حضور يسجل — تظهر "يسجل صوت..."\n' +
        '.حضور متوقف — تظهر "توقف عن الكتابة"\n' +
        '.اشتراك_حضور — تفعيل استقبال تحديثات الحضور'
      )
    }

    await conn.sendPresenceUpdate(presence, m.chat)
    m.reply(`✅ تم بث حالة الحضور: ${presenceText}`)
  } catch (e) {
    console.error('presence:', e)
    m.reply('❌ فشل تحديث الحضور')
  }
}

handler.command = ['حضور', 'presence', 'presence_update', 'اشتراك_حضور', 'presence_subscribe']
handler.usage = ['حضور متاح', 'حضور يكتب', 'حضور يسجل', 'حضور غير_متاح', 'اشتراك_حضور']
handler.category = 'presence'
handler.description = 'بث حالة الحضور (متاح، يكتب، يسجل، غير متاح) والاشتراك في تحديثات الحضور'
export default handler