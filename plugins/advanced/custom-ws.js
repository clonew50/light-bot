/*
  ═══════════════════════════════════════════
  🔧 وظائف مخصصة — Custom WebSocket Callbacks
  الأمر: .تصحيح_الويب_سوكيت (تفعيل/تعطيل سجل التصحيح)
  .مراقبة_إطار <tag> [attr:value] [content_tag]
  .إطارات_خام (عرض آخر الإطارات المستلمة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    // تفعيل/تعطيل سجل التصحيح
    if (['تصحيح_الويب_سوكيت', 'debug_ws', 'websocket_debug'].includes(command)) {
      const current = global.wsDebugEnabled ?? false
      const newValue = !current
      global.wsDebugEnabled = newValue

      if (newValue) {
        // تعيين مسجل تصحيح
        conn.ws.on('communication', (node) => {
          if (!global.wsDebugEnabled) return
          console.log('[WS DEBUG]', JSON.stringify(node, null, 2))
        })
        m.reply('🔧 تم تفعيل سجل تصحيح WebSocket — سيظهر في الكونسول')
      } else {
        m.reply('🔧 تم تعطيل سجل تصحيح WebSocket')
      }
      return
    }

    // مراقبة إطارات محددة
    if (['مراقبة_إطار', 'watch_frame', 'cb_frame'].includes(command)) {
      if (!text) {
        return m.reply(
          '🔍 الاستخدام: .مراقبة_إطار <tag> [attr:value] [content_tag]\n' +
          'أمثلة:\n' +
          '.مراقبة_إطار message\n' +
          '.مراقبة_إطار ib\n' +
          '.مراقبة_إطار edge_routing,id:abc123\n' +
          '.مراقبة_إطار edge_routing,id:abc123,routing_info'
        )
      }

      const parts = text.split(',')
      const tag = parts[0].trim()
      let filter = `CB:${tag}`

      if (parts[1]?.includes(':')) {
        const [attr, value] = parts[1].split(':')
        filter += `,${attr.trim()}:${value.trim()}`
      }
      if (parts[2]) {
        filter += `,${parts[2].trim()}`
      }

      // إزالة المعالج السابق إن وجد
      if (global.customFrameHandlers?.[filter]) {
        conn.ws.off(filter, global.customFrameHandlers[filter])
      }

      if (!global.customFrameHandlers) global.customFrameHandlers = {}

      const handler = (node) => {
        console.log(`[CUSTOM CB: ${filter}]`, JSON.stringify(node, null, 2))
        m.reply(`📥 تم التقاط إطار مخصص: ${filter}`)
      }

      conn.ws.on(filter, handler)
      global.customFrameHandlers[filter] = handler

      m.reply(`✅ تم تسجيل مراقبة للإطار: ${filter}`)
      return
    }

    // عرض الإطارات الخام الحديثة (يتطلب تفعيل التصحيح)
    if (['إطارات_خام', 'raw_frames', 'ws_frames'].includes(command)) {
      if (!global.wsDebugEnabled) {
        return m.reply('⚠️ سجل التصحيح غير مفعل. استخدم .تصحيح_الويب_سوكيت أولاً')
      }
      m.reply('ℹ️ الإطارات تظهر في كونسول الخادم. هذا الأمر للتذكير فقط.')
      return
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('custom-ws:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = ['تصحيح_الويب_سوكيت', 'debug_ws', 'websocket_debug', 'مراقبة_إطار', 'watch_frame', 'cb_frame', 'إطارات_خام', 'raw_frames', 'ws_frames']
handler.usage = [
  'تصحيح_الويب_سوكيت (تبديل)',
  'مراقبة_إطار message',
  'مراقبة_إطار ib',
  'مراقبة_إطار edge_routing,id:abc123,routing_info',
  'إطارات_خام'
]
handler.category = 'advanced'
handler.description = 'تفعيل سجل تصحيح WebSocket، تسجيل معالجات مخصصة لإطارات محددة (CB: callbacks)'
export default handler