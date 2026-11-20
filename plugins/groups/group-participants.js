/*
  ═══════════════════════════════════════════
  👥 إدارة المشاركين — Group Participants
  الأمر: .إضافة | .إزالة | .ترقية | .تنزيل
  (في مجموعة، يجب الرد على رسالة العضو أو ذكر الأرقام)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.isGroup) return m.reply('👥 هذا الأمر يعمل في المجموعات فقط')

    const actionMap = {
      'إضافة': 'add',
      'add': 'add',
      'إزالة': 'remove',
      'remove': 'remove',
      'طرد': 'remove',
      'kick': 'remove',
      'ترقية': 'promote',
      'promote': 'promote',
      'تنزيل': 'demote',
      'demote': 'demote'
    }

    const action = actionMap[command]
    if (!action) return m.reply('❌ أمر غير معروف')

    let participants = []

    // استخراج الأرقام من النص
    if (text) {
      const numbers = text.match(/\d{8,15}/g) || []
      participants = numbers.map(n => `${n}@s.whatsapp.net`)
    }

    // إذا لم يكن هناك نص، استخدم الرسالة المقتبسة
    if (!participants.length && m.quoted) {
      const sender = m.quoted.key.participant || m.quoted.key.remoteJid
      if (sender) participants = [sender]
    }

    // استخراج من المنشنز
    if (!participants.length && m.mentionedJid?.length) {
      participants = m.mentionedJid
    }

    if (!participants.length) {
      return m.reply('👤 حدد مشاركين:\n- اكتب أرقامهم: .إضافة 201001234567 201009876543\n- أو رد على رسالة أحدهم\n- أو منشنهم')
    }

    // تصفية المشاركين الصالحين
    const validParticipants = participants.filter(p => p.endsWith('@s.whatsapp.net') || p.endsWith('@lid'))
    if (!validParticipants.length) return m.reply('❌ لا توجد مشاركين صالحين')

    await conn.groupParticipantsUpdate(m.chat, validParticipants, action)

    const actionLabels = { add: 'إضافة', remove: 'إزالة', promote: 'ترقية', demote: 'تنزيل' }
    m.reply(`✅ تم ${actionLabels[action]} ${validParticipants.length} مشارك(ين)`)
  } catch (e) {
    console.error('group-participants:', e)
    const isAdminError = e?.message?.includes('not-authorized') || e?.message?.includes('admin')
    m.reply(isAdminError ? '❌ تحتاج صلاحيات مشرف' : '❌ فشل العملية')
  }
}

handler.command = ['اضافة_عضو', 'add_member', 'ازالة_عضو', 'remove_member', 'طرد_عضو', 'kick_member', 'ترقية_عضو', 'promote_member', 'تنزيل_عضو', 'demote_member']
handler.usage = ['إضافة 201001234567', 'إزالة (رد على رسالة)', 'ترقية @عضو', 'تنزيل 201001234567']
handler.category = 'groups'
handler.description = 'إضافة، إزالة، ترقية، أو تنزيل مشاركين في المجموعة (يتطلب صلاحيات مشرف)'
export default handler