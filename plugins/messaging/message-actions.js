/*
  ═══════════════════════════════════════════
  ✏️ إجراءات الرسائل — Message Actions
  الأمر: .حذف_للجميع (رد) | .تعديل <نص_جديد> (رد)
  .مقروء (رد) | .كتابة | .تسجيل | .متاح | .غير_متاح
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    // حذف للجميع (يجب الرد على رسالة)
    if (['حذف_للجميع', 'delete_for_everyone', 'delete_all'].includes(command)) {
      if (!m.quoted) return m.reply('📎 رد على الرسالة المراد حذفها للجميع')
      await conn.sendMessage(m.chat, { delete: m.quoted.key })
      return m.reply('🗑️ تم حذف الرسالة للجميع')
    }

    // تعديل رسالة (يجب الرد على رسالة)
    if (['تعديل', 'edit', 'تعديل_رسالة'].includes(command)) {
      if (!m.quoted) return m.reply('📎 رد على الرسالة المراد تعديلها')
      if (!text) return m.reply('✏️ الاستخدام: .تعديل النص_الجديد')
      await conn.sendMessage(m.chat, { text, edit: m.quoted.key })
      return m.reply('✏️ تم تعديل الرسالة')
    }

    // علامة مقروء
    if (['مقروء', 'mark_read', 'read'].includes(command)) {
      if (!m.quoted) return m.reply('📎 رد على الرسالة لوضع علامة مقروء')
      await conn.readMessages([m.quoted.key])
      return m.reply('✅ تم وضع علامة مقروء')
    }

    // بث الحضور (موجود في presence.js لكن نضيف اختصارات هنا)
    const presenceMap = {
      'كتابة': 'composing',
      'composing': 'composing',
      'تسجيل': 'recording',
      'recording': 'recording',
      'متاح': 'available',
      'available': 'available',
      'غير_متاح': 'unavailable',
      'unavailable': 'unavailable'
    }

    if (presenceMap[command]) {
      await conn.sendPresenceUpdate(presenceMap[command], m.chat)
      return m.reply(`✅ تم بث: ${command}`)
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('message-actions:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = [
  'حذف_للجميع', 'delete_for_everyone', 'delete_all',
  'تعديل_رسالة', 'edit_msg', 'edit_message',
  'مقروء_رسالة', 'mark_read_msg', 'read_msg',
  'كتابة_حالة', 'composing_status',
  'تسجيل_حالة', 'recording_status',
  'متاح_حالة', 'available_status',
  'غير_متاح_حالة', 'unavailable_status'
]
handler.usage = [
  'حذف_للجميع (رد على رسالة)',
  'تعديل نص جديد (رد على رسالة)',
  'مقروء (رد على رسالة)',
  'كتابة', 'تسجيل', 'متاح', 'غير_متاح'
]
handler.category = 'messaging'
handler.description = 'حذف الرسائل للجميع، تعديل الرسائل، علامة مقروء، بث حالة الحضور'
export default handler