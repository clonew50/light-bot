/*
  ═══════════════════════════════════════════
  🚫 الحظر — Block/Unblock Users
  الأمر: .حظر <رقم> | .إلغاء_حظر <رقم> | .قائمة_المحظورين
  (يمكن الرد على رسالة أو منشن المستخدم)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    const actionMap = {
      'حظر': 'block',
      'block': 'block',
      'إلغاء_حظر': 'unblock',
      'الغاء_حظر': 'unblock',
      'unblock': 'unblock'
    }

    const action = actionMap[command]
    if (action) {
      let target = null

      // من النص
      if (text) {
        const numbers = text.match(/\d{8,15}/g)
        if (numbers?.length) target = `${numbers[0]}@s.whatsapp.net`
      }

      // من الرسالة المقتبسة
      if (!target && m.quoted) {
        target = m.quoted.key.participant || m.quoted.key.remoteJid
      }

      // من المنشنز
      if (!target && m.mentionedJid?.length) {
        target = m.mentionedJid[0]
      }

      if (!target) return m.reply('👤 حدد مستخدم: .حظر 201001234567 أو رد على رسالته أو منشن')

      await conn.updateBlockStatus(target, action)
      m.reply(`✅ تم ${action === 'block' ? 'حظر' : 'إلغاء حظر'} المستخدم`)
      return
    }

    // قائمة المحظورين
    if (['قائمة_المحظورين', 'blocklist', 'block_list', 'fetch_blocklist'].includes(command)) {
      const blocklist = await conn.fetchBlocklist()
      if (!blocklist?.length) return m.reply('📭 قائمة المحظورين فارغة')
      let msg = `🚫 *قائمة المحظورين (${blocklist.length}):*\n\n`
      for (const jid of blocklist) {
        msg += `• ${jid}\n`
      }
      m.reply(msg)
    }
  } catch (e) {
    console.error('block:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = ['حظر_الBloc', 'block_user', 'إلغاء_حظر_الBlock', 'unblock_user', 'قائمة_المحظورين', 'blocklist', 'block_list', 'fetch_blocklist']
handler.usage = ['حظر 201001234567', 'إلغاء_حظر (رد على رسالة)', 'قائمة_المحظورين']
handler.category = 'privacy'
handler.description = 'حظر/إلغاء حظر المستخدمين، عرض قائمة المحظورين'
export default handler