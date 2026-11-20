/*
  ═══════════════════════════════════════════
  🔒 إعدادات الخصوصية — Privacy Settings
  الأمر: .خصوصية (عرض) | .أخر_ظهور <قيمة> | .أونلاين <قيمة>
  .صورة_الملف <قيمة> | .الحالة <قيمة> | .قراءة <قيمة>
  .مجموعات <قيمة> | .مختفي_افتراضي <مدة>
  القيم: الجميع، جهات_الاتصال، جهات_عدا، لا_أحد، مطابقة_الأخير
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    const valueMap = {
      'الجميع': 'all',
      'all': 'all',
      'جهات_الاتصال': 'contacts',
      'contacts': 'contacts',
      'جهات_عدا': 'contact_blacklist',
      'contact_blacklist': 'contact_blacklist',
      'لا_أحد': 'none',
      'none': 'none',
      'مطابقة_الأخير': 'match_last_seen',
      'match_last_seen': 'match_last_seen'
    }

    const durationMap = {
      'إيقاف': 0, 'off': 0, '0': 0,
      '24س': 86400, '24h': 86400, 'يوم': 86400,
      '7أ': 604800, '7d': 604800, 'أسبوع': 604800,
      '90ي': 7776000, '90d': 7776000, '3ش': 7776000
    }

    if (command === 'خصوصية' || command === 'privacy' || command === 'fetch_privacy') {
      const settings = await conn.fetchPrivacySettings(true)
      let msg = `🔒 *إعدادات الخصوصية الحالية:*\n\n`
      msg += `👁️ آخر ظهور: ${settings.lastSeen || 'غير معروف'}\n`
      msg += `🟢 الأونلاين: ${settings.online || 'غير معروف'}\n`
      msg += `🖼️ صورة الملف: ${settings.profilePicture || 'غير معروف'}\n`
      msg += `📱 الحالة: ${settings.status || 'غير معروف'}\n`
      msg += `✅ قراءة الرسائل: ${settings.readReceipts || 'غير معروف'}\n`
      msg += `👥 إضافة للمجموعات: ${settings.groupsAdd || 'غير معروف'}\n`
      msg += `⏳ مختفي افتراضي: ${settings.defaultDisappearingMode ? `${settings.defaultDisappearingMode / 86400} يوم` : 'معطل'}`
      return m.reply(msg)
    }

    const valueText = text.trim()
    const mappedValue = valueMap[valueText]
    const mappedDuration = durationMap[valueText]

    if (!mappedValue && mappedDuration === undefined) {
      return m.reply(
        '🔒 الاستخدام:\n' +
        '.أخر_ظهور الجميع | جهات_الاتصال | جهات_عدا | لا_أحد\n' +
        '.أونلاين الجميع | مطابقة_الأخير\n' +
        '.صورة_الملف الجميع | جهات_الاتصال | جهات_عدا | لا_أحد\n' +
        '.الحالة الجميع | جهات_الاتصال | جهات_عدا | لا_أحد\n' +
        '.قراءة الجميع | لا_أحد\n' +
        '.مجموعات الجميع | جهات_الاتصال | جهات_عدا\n' +
        '.مختفي_افتراضي 24س | 7أ | 90ي | إيقاف\n' +
        '.خصوصية (عرض الإعدادات الحالية)'
      )
    }

    switch (command) {
      case 'أخر_ظهور':
      case 'last_seen':
      case 'update_last_seen_privacy':
        await conn.updateLastSeenPrivacy(mappedValue)
        m.reply(`✅ تم تحديث آخر ظهور: ${valueText}`)
        break

      case 'أونلاين':
      case 'online':
      case 'update_online_privacy':
        await conn.updateOnlinePrivacy(mappedValue)
        m.reply(`✅ تم تحديث الأونلاين: ${valueText}`)
        break

      case 'صورة_الملف':
      case 'profile_picture':
      case 'update_profile_picture_privacy':
        await conn.updateProfilePicturePrivacy(mappedValue)
        m.reply(`✅ تم تحديث صورة الملف: ${valueText}`)
        break

      case 'الحالة':
      case 'status':
      case 'update_status_privacy':
        await conn.updateStatusPrivacy(mappedValue)
        m.reply(`✅ تم تحديث الحالة: ${valueText}`)
        break

      case 'قراءة':
      case 'read_receipts':
      case 'update_read_receipts_privacy':
        await conn.updateReadReceiptsPrivacy(mappedValue)
        m.reply(`✅ تم تحديث قراءة الرسائل: ${valueText}`)
        break

      case 'مجموعات':
      case 'groups':
      case 'groups_add':
      case 'update_groups_add_privacy':
        await conn.updateGroupsAddPrivacy(mappedValue)
        m.reply(`✅ تم تحديث إضافة للمجموعات: ${valueText}`)
        break

      case 'مختفي_افتراضي':
      case 'default_disappearing':
      case 'update_default_disappearing_mode':
        await conn.updateDefaultDisappearingMode(mappedDuration)
        m.reply(mappedDuration === 0 ? '✅ تم تعطيل الرسائل المختفية افتراضياً' : `⏳ تم تعيين الرسائل المختفية افتراضياً: ${valueText}`)
        break

      default:
        m.reply('❌ أمر غير معروف')
    }
  } catch (e) {
    console.error('privacy-settings:', e)
    m.reply('❌ فشل تحديث إعدادات الخصوصية')
  }
}

handler.command = [
  'خصوصية', 'privacy', 'fetch_privacy',
  'أخر_ظهور', 'last_seen', 'update_last_seen_privacy',
  'أونلاين', 'online', 'update_online_privacy',
  'خصوصية_صورة_الملف', 'privacy_profile_picture', 'update_profile_picture_privacy',
  'الحالة', 'status', 'update_status_privacy',
  'قراءة', 'read_receipts', 'update_read_receipts_privacy',
  'مجموعات', 'groups', 'groups_add', 'update_groups_add_privacy',
  'مختفي_افتراضي', 'default_disappearing', 'update_default_disappearing_mode'
]
handler.usage = [
  'خصوصية',
  'أخر_ظهور الجميع',
  'أونلاين مطابقة_الأخير',
  'صورة_الملف جهات_الاتصال',
  'الحالة لا_أحد',
  'قراءة لا_أحد',
  'مجموعات جهات_عدا',
  'مختفي_افتراضي 7أ'
]
handler.category = 'privacy'
handler.description = 'عرض وتحديث جميع إعدادات الخصوصية: آخر ظهور، أونلاين، صورة الملف، الحالة، قراءة الرسائل، إضافة للمجموعات، مختفي افتراضي'
export default handler