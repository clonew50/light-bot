/*
  ═══════════════════════════════════════════
  👥 إنشاء المجموعات — Group Create
  الأمر: .مجموعة_جديدة <اسم> | <رقم1> | <رقم2> | ...
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text }) => {
  try {
    if (!text) return m.reply('👥 الاستخدام: .مجموعة_جديدة اسم_المجموعة | 201001234567 | 201009876543')

    const parts = text.split('|').map(p => p.trim())
    const subject = parts[0]
    const participants = parts.slice(1).map(p => {
      const clean = p.replace(/[^0-9]/g, '')
      return clean.endsWith('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`
    }).filter(p => /^\d{8,15}@s\.whatsapp\.net$/.test(p))

    if (!subject) return m.reply('❌ اسم المجموعة مطلوب')
    if (!participants.length) return m.reply('❌ أضف مشارك واحد على الأقل')

    const result = await conn.groupCreate(subject, participants)
    await conn.sendMessage(result.gid, { text: `🎉 مرحباً! تم إنشاء مجموعة "${subject}"` })

    m.reply(`✅ تم إنشاء المجموعة: ${subject}\n🆔 المعرف: ${result.gid}`)
  } catch (e) {
    console.error('group-create:', e)
    m.reply('❌ فشل إنشاء المجموعة')
  }
}

handler.command = ['مجموعة_جديدة', 'group_create', 'create_group']
handler.usage = ['مجموعة_جديدة أصدقاء | 201001234567 | 201009876543']
handler.category = 'groups'
handler.description = 'إنشاء مجموعة جديدة مع مشاركين محددين'
export default handler