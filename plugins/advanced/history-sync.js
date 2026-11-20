/*
  ═══════════════════════════════════════════
  📜 مزامنة المحفوظات — History Sync
  الأمر: .سجل_المحادثة <عدد> (رد على رسالة في المحادثة)
  .محفوظات_كاملة (طلب مزامنة كاملة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    // طلب سجل رسائل للمحادثة الحالية
    if (['سجل_المحادثة', 'fetch_history', 'message_history'].includes(command)) {
      if (!m.quoted) return m.reply('📎 رد على رسالة في المحادثة لجلب سجل سابق لها')
      const count = parseInt(text) || 50
      if (count > 50) return m.reply('❌ الحد الأقصى 50 رسالة لكل طلب')

      const oldestMsg = m.quoted
      await conn.fetchMessageHistory(count, oldestMsg.key, oldestMsg.messageTimestamp)
      m.reply(`📜 تم طلب ${count} رسالة سابقة — ستصل عبر حدث messaging-history.set`)
      return
    }

    // طلب مزامنة كاملة (يتطلب إعدادات خاصة في العميل)
    if (['محفوظات_كاملة', 'full_history', 'sync_full_history'].includes(command)) {
      m.reply('ℹ️ المزامنة الكاملة تتطلب إعداد العميل بـ:\n- browser: Browsers.macOS("Desktop")\n- syncFullHistory: true\n\nهذا يتم في إعدادات الاتصال (index.js) وليس بأمر.')
      return
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('history-sync:', e)
    m.reply('❌ فشل طلب المحفوظات')
  }
}

handler.command = ['سجل_المحادثة', 'fetch_history', 'message_history', 'محفوظات_كاملة', 'full_history', 'sync_full_history']
handler.usage = ['سجل_المحادثة 20 (رد على رسالة)', 'محفوظات_كاملة']
handler.category = 'advanced'
handler.description = 'طلب سجل رسائل أقدم للمحادثة الحالية، معلومات عن المزامنة الكاملة'
export default handler