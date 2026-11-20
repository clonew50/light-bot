/*
  ═══════════════════════════════════════════
  ⚙️ إعدادات المجموعة — Group Settings
  الأمر: .اسم_مجموعة <اسم> | .وصف_مجموعة <وصف>
  .مجموعة_مغلقة | .مجموعة_مفتوحة (إرسال الرسائل)
  .إعدادات_مغلقة | .إعدادات_مفتوحة (تغيير الإعدادات)
  .مغادرة | .مغادرة_المجموعة
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.isGroup) return m.reply('👥 هذا الأمر يعمل في المجموعات فقط')
    const jid = m.chat

    switch (command) {
      case 'اسم_مجموعة':
      case 'group_name':
      case 'subject':
        if (!text) return m.reply('📝 الاستخدام: .اسم_مجموعة الاسم_الجديد')
        await conn.groupUpdateSubject(jid, text)
        m.reply(`✅ تم تغيير اسم المجموعة إلى: ${text}`)
        break

      case 'وصف_مجموعة':
      case 'group_desc':
      case 'description':
        if (!text) return m.reply('📝 الاستخدام: .وصف_مجموعة الوصف_الجديد')
        await conn.groupUpdateDescription(jid, text)
        m.reply('✅ تم تحديث وصف المجموعة')
        break

      case 'مجموعة_مغلقة':
      case 'group_closed':
      case 'announcement':
        await conn.groupSettingUpdate(jid, 'announcement')
        m.reply('🔒 تم تقييد الإرسال للمشرفين فقط')
        break

      case 'مجموعة_مفتوحة':
      case 'group_open':
      case 'not_announcement':
        await conn.groupSettingUpdate(jid, 'not_announcement')
        m.reply('🔓 تم السماح للجميع بالإرسال')
        break

      case 'إعدادات_مغلقة':
      case 'settings_locked':
      case 'locked':
        await conn.groupSettingUpdate(jid, 'locked')
        m.reply('🔒 تم قفل إعدادات المجموعة للمشرفين فقط')
        break

      case 'إعدادات_مفتوحة':
      case 'settings_unlocked':
      case 'unlocked':
        await conn.groupSettingUpdate(jid, 'unlocked')
        m.reply('🔓 تم السماح للجميع بتغيير إعدادات المجموعة')
        break

      case 'مغادرة':
      case 'leave_group':
      case 'group_leave':
        await conn.groupLeave(jid)
        m.reply('👋 تم مغادرة المجموعة')
        break

      default:
        m.reply('❌ أمر غير معروف')
    }
  } catch (e) {
    console.error('group-settings:', e)
    const isAdminError = e?.message?.includes('not-authorized') || e?.message?.includes('admin')
    m.reply(isAdminError ? '❌ تحتاج صلاحيات مشرف' : '❌ فشل العملية')
  }
}

handler.command = [
  'اسم_مجموعة', 'group_name', 'subject',
  'وصف_مجموعة', 'group_desc', 'description',
  'مجموعة_مغلقة', 'group_closed', 'announcement',
  'مجموعة_مفتوحة', 'group_open', 'not_announcement',
  'إعدادات_مغلقة', 'settings_locked', 'locked',
  'إعدادات_مفتوحة', 'settings_unlocked', 'unlocked',
  'مغادرة', 'leave_group', 'group_leave'
]
handler.usage = [
  'اسم_مجموعة اسم_جديد',
  'وصف_مجموعة وصف_جديد',
  'مجموعة_مغلقة (مشرفون فقط يرسلون)',
  'مجموعة_مفتوحة (الجميع يرسلون)',
  'إعدادات_مغلقة', 'إعدادات_مفتوحة',
  'مغادرة'
]
handler.category = 'groups'
handler.description = 'إدارة إعدادات المجموعة: الاسم، الوصف، من يمكنه الإرسال، من يغير الإعدادات، مغادرة المجموعة'
export default handler