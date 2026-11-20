/*
  ═══════════════════════════════════════════
  ➡️ إعادة التوجيه — Forward Messages
  الأمر: .توجيه <رقم/مجموعة> (رد على رسالة)
  .توجيه_متعدد <رقم1> | <رقم2> | ... (رد على رسالة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.quoted) return m.reply('📎 رد على الرسالة المراد إعادة توجيهها')

    const msg = m.quoted

    if (command === 'توجيه_متعدد' || command === 'forward_multi') {
      if (!text) return m.reply('📤 الاستخدام: .توجيه_متعدد 201001234567 | 201009876543 | group_jid')
      const targets = text.split('|').map(t => t.trim()).filter(Boolean)

      for (const target of targets) {
        let jid = target
        if (!jid.includes('@') && /^\d{8,15}$/.test(jid)) {
          jid = `${jid}@s.whatsapp.net`
        }
        try {
          await conn.sendMessage(jid, { forward: msg })
        } catch (e) {
          console.error(`Forward to ${jid} failed:`, e)
        }
      }
      return m.reply(`✅ تم إعادة التوجيه إلى ${targets.length} وجهة`)
    }

    // توجيه واحد
    if (!text) return m.reply('📤 الاستخدام: .توجيه <رقم/مجموعة/JID> (رد على رسالة)')
    let jid = text.trim()
    if (!jid.includes('@') && /^\d{8,15}$/.test(jid)) {
      jid = `${jid}@s.whatsapp.net`
    }

    await conn.sendMessage(jid, { forward: msg })
    m.reply(`✅ تم إعادة توجيه الرسالة إلى ${jid}`)
  } catch (e) {
    console.error('forward:', e)
    m.reply('❌ فشل إعادة التوجيه')
  }
}

handler.command = ['توجيه', 'forward', 'توجيه_متعدد', 'forward_multi']
handler.usage = ['توجيه 201001234567 (رد)', 'توجيه group_jid (رد)', 'توجيه_متعدد 201001234567 | 201009876543 (رد)']
handler.category = 'messaging'
handler.description = 'إعادة توجيه الرسائل لجهة واحدة أو عدة جهات'
export default handler