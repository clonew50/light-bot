/*
  ═══════════════════════════════════════════
  📞 المكالمات — Calls
  الأمر: .رفض_المكالمات (تفعيل/تعطيل الرفض التلقائي)
  .حالة_المكالمات (عرض الإعداد)
  البوت يرفض المكالمات الواردة تلقائياً عند التفعيل
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    // تفعيل/تعطيل الرفض التلقائي
    if (['رفض_المكالمات', 'auto_reject_calls', 'reject_calls'].includes(command)) {
      const current = global.autoRejectCalls ?? false
      const newValue = !current
      global.autoRejectCalls = newValue

      if (newValue) {
        // تسجيل معالج المكالمات
        if (!global.callHandlerRegistered) {
          conn.ev.on('call', async (calls) => {
            if (!global.autoRejectCalls) return
            for (const call of calls) {
              if (call.status === 'offer') {
                try {
                  await conn.rejectCall(call.id, call.from)
                  console.log(`📞 تم رفض مكالمة من ${call.from}`)
                } catch (e) {
                  console.error('رفض المكالمة فشل:', e)
                }
              }
            }
          })
          global.callHandlerRegistered = true
        }
        m.reply('📞 تم تفعيل الرفض التلقائي للمكالمات الواردة')
      } else {
        m.reply('📞 تم تعطيل الرفض التلقائي للمكالمات')
      }
      return
    }

    // عرض الحالة
    if (['حالة_المكالمات', 'calls_status'].includes(command)) {
      const status = global.autoRejectCalls ? '✅ مفعل' : '❌ معطل'
      m.reply(`📞 *حالة رفض المكالمات:* ${status}\n\nعند التفعيل، يتم رفض جميع المكالمات الواردة تلقائياً.`)
      return
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('calls:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = ['رفض_المكالمات', 'auto_reject_calls', 'reject_calls', 'حالة_المكالمات', 'calls_status']
handler.usage = ['رفض_المكالمات (تبديل)', 'حالة_المكالمات']
handler.category = 'advanced'
handler.description = 'تفعيل/تعطيل الرفض التلقائي للمكالمات الواردة، عرض الحالة'
export default handler