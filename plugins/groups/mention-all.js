/*
  ═══════════════════════════════════════════
  📣 منشن الجميع — Mention All / Tag All
  الأمر: .منشن_الجميع <نص> | .منشن_المشرفين <نص>
  .قائمة_الأعضاء
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.isGroup) return m.reply('👥 هذا الأمر يعمل في المجموعات فقط')

    const metadata = await conn.groupMetadata(m.chat)
    const participants = metadata.participants || []

    if (command === 'قائمة_الأعضاء' || command === 'members_list') {
      let msg = `👥 *أعضاء المجموعة (${participants.length}):*\n\n`
      for (const p of participants) {
        const admin = p.admin ? ` [${p.admin}]` : ''
        msg += `• @${p.id.split('@')[0]}${admin}\n`
      }
      await conn.sendMessage(m.chat, { text: msg, mentions: participants.map(p => p.id) })
      return
    }

    if (!text) return m.reply('📣 الاستخدام: .منشن_الجميع نص الرسالة\n.منشن_المشرفين نص الرسالة')

    let targetParticipants
    if (command === 'منشن_المشرفين' || command === 'mention_admins') {
      targetParticipants = participants.filter(p => p.admin).map(p => p.id)
      if (!targetParticipants.length) return m.reply('❌ لا يوجد مشرفون في المجموعة')
    } else {
      targetParticipants = participants.map(p => p.id)
    }

    const mentionsText = targetParticipants.map(id => `@${id.split('@')[0]}`).join(' ')
    const fullText = `${text}\n\n${mentionsText}`

    await conn.sendMessage(m.chat, {
      text: fullText,
      mentions: targetParticipants
    })
  } catch (e) {
    console.error('mention-all:', e)
    m.reply('❌ فشل المنشن')
  }
}

handler.command = ['منشن_الجميع', 'mention_all', 'tag_all', 'منشن_المشرفين', 'mention_admins', 'قائمة_الأعضاء', 'members_list']
handler.usage = ['منشن_الجميع إعلان مهم', 'منشن_المشرفين يحتاج قرار', 'قائمة_الأعضاء']
handler.category = 'groups'
handler.description = 'منشن جميع الأعضاء أو المشرفين فقط، عرض قائمة الأعضاء'
export default handler