/*
  ═══════════════════════════════════════════
  💬 إدارة المحادثات — Chat Management
  الأمر: .أرشفة | .إلغاء_أرشفة | .كتم <مدة> | .إلغاء_كتم
  .غير_مقروء | .حذف_محادثة | .تثبيت_محادثة | .إلغاء_تثبيت_محادثة
  .نجمة (رد) | .إلغاء_نجمة (رد)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    const jid = m.chat
    let lastMsg = m.quoted || m

    // دالة مساعدة لجلب آخر رسالة
    const getLastMessage = async () => {
      if (m.quoted) return m.quoted
      // يمكن تحسين ذلك بجلب آخر رسالة من التخزين
      return m
    }

    switch (command) {
      case 'أرشفة':
      case 'archive':
      case 'archive_chat': {
        const last = await getLastMessage()
        await conn.chatModify({ archive: true, lastMessages: [last] }, jid)
        m.reply('📦 تم أرشفة المحادثة')
        break
      }

      case 'إلغاء_أرشفة':
      case 'الغاء_أرشفة':
      case 'unarchive':
      case 'unarchive_chat': {
        const last = await getLastMessage()
        await conn.chatModify({ archive: false, lastMessages: [last] }, jid)
        m.reply('📤 تم إلغاء أرشفة المحادثة')
        break
      }

      case 'كتم':
      case 'mute':
      case 'mute_chat': {
        const durationMap = {
          '8س': 8 * 60 * 60 * 1000,
          '8h': 8 * 60 * 60 * 1000,
          'أسبوع': 7 * 24 * 60 * 60 * 1000,
          '7أ': 7 * 24 * 60 * 60 * 1000,
          '1س': 3600000,
          '1h': 3600000,
          '30د': 30 * 60 * 1000,
          '30m': 30 * 60 * 1000
        }
        const durationText = text.trim() || '8س'
        const ms = durationMap[durationText] || 8 * 60 * 60 * 1000
        await conn.chatModify({ mute: ms }, jid)
        m.reply(`🔇 تم كتم المحادثة لمدة ${durationText}`)
        break
      }

      case 'إلغاء_كتم':
      case 'الغاء_كتم':
      case 'unmute':
      case 'unmute_chat': {
        await conn.chatModify({ mute: null }, jid)
        m.reply('🔊 تم إلغاء كتم المحادثة')
        break
      }

      case 'غير_مقروء':
      case 'unread':
      case 'mark_unread': {
        const last = await getLastMessage()
        await conn.chatModify({ markRead: false, lastMessages: [last] }, jid)
        m.reply('📬 تم وضع علامة غير مقروء')
        break
      }

      case 'حذف_محادثة':
      case 'delete_chat':
      case 'clear_chat': {
        const last = await getLastMessage()
        await conn.chatModify({
          delete: true,
          lastMessages: [{
            key: last.key,
            messageTimestamp: last.messageTimestamp
          }]
        }, jid)
        m.reply('🗑️ تم حذف المحادثة من القائمة')
        break
      }

      case 'تثبيت_محادثة':
      case 'pin_chat':
      case 'pin': {
        await conn.chatModify({ pin: true }, jid)
        m.reply('📌 تم تثبيت المحادثة')
        break
      }

      case 'إلغاء_تثبيت_محادثة':
      case 'الغاء_تثبيت_محادثة':
      case 'unpin_chat':
      case 'unpin': {
        await conn.chatModify({ pin: false }, jid)
        m.reply('📌 تم إلغاء تثبيت المحادثة')
        break
      }

      case 'نجمة':
      case 'star':
      case 'star_message': {
        if (!m.quoted) return m.reply('📎 رد على الرسالة لوضع نجمة')
        await conn.chatModify({
          star: {
            messages: [{ id: m.quoted.key.id, fromMe: m.quoted.key.fromMe }],
            star: true
          }
        }, jid)
        m.reply('⭐ تم إضافة نجمة للرسالة')
        break
      }

      case 'إلغاء_نجمة':
      case 'الغاء_نجمة':
      case 'unstar':
      case 'unstar_message': {
        if (!m.quoted) return m.reply('📎 رد على الرسالة لإزالة النجمة')
        await conn.chatModify({
          star: {
            messages: [{ id: m.quoted.key.id, fromMe: m.quoted.key.fromMe }],
            star: false
          }
        }, jid)
        m.reply('⭐ تم إزالة النجمة من الرسالة')
        break
      }

      default:
        m.reply('❌ أمر غير معروف')
    }
  } catch (e) {
    console.error('chat-management:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = [
  'أرشفة_محادثة', 'archive_chat', 'archive_conv',
  'إلغاء_أرشفة_محادثة', 'unarchive_chat', 'unarchive_conv',
  'كتم_محادثة', 'mute_chat', 'mute_conv',
  'إلغاء_كتم_محادثة', 'unmute_chat', 'unmute_conv',
  'غير_مقروء_محادثة', 'unread_chat', 'mark_unread_conv',
  'حذف_محادثة', 'delete_chat', 'clear_chat',
  'تثبيت_محادثة', 'pin_chat', 'pin_conv',
  'إلغاء_تثبيت_محادثة', 'unpin_chat', 'unpin_conv',
  'نجمة_رسالة', 'star_msg', 'star_message',
  'إلغاء_نجمة_رسالة', 'unstar_msg', 'unstar_message'
]
handler.usage = [
  'أرشفة',
  'إلغاء_أرشفة',
  'كتم 8س',
  'كتم أسبوع',
  'إلغاء_كتم',
  'غير_مقروء',
  'حذف_محادثة',
  'تثبيت_محادثة',
  'إلغاء_تثبيت_محادثة',
  'نجمة (رد)',
  'إلغاء_نجمة (رد)'
]
handler.category = 'chat'
handler.description = 'إدارة المحادثات: أرشفة، كتم، غير مقروء، حذف، تثبيت، نجمة الرسائل'
export default handler