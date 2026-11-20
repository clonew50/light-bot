/*
  ═══════════════════════════════════════════
  👤 تحديث الملف الشخصي — Profile Update
  الأمر: .حالتي <نص> | .اسمي <اسم> | .صوري <رابط/مسار>
  .حذف_صوري
  ═══════════════════════════════════════════
*/
import fs from 'fs'

const handler = async (m, { conn, text, command }) => {
  try {
    // تحديث الحالة (النص تحت الاسم)
    if (['حالتي', 'my_status', 'update_status', 'status_text'].includes(command)) {
      if (!text) return m.reply('📝 الاستخدام: .حالتي النص_الجديد')
      await conn.updateProfileStatus(text)
      return m.reply(`✅ تم تحديث الحالة إلى: ${text}`)
    }

    // تحديث الاسم
    if (['اسمي', 'my_name', 'update_name', 'profile_name'].includes(command)) {
      if (!text) return m.reply('👤 الاستخدام: .اسمي الاسم_الجديد')
      await conn.updateProfileName(text)
      return m.reply(`✅ تم تحديث الاسم إلى: ${text}`)
    }

    // تحديث صورة الملف الشخصي
    if (['صوري', 'my_picture', 'update_picture', 'profile_picture'].includes(command)) {
      if (!text) return m.reply('🖼️ الاستخدام: .صوري <رابط/مسار_الملف>')
      const mediaSource = text.trim()

      let media = {}
      if (fs.existsSync(mediaSource)) {
        media = { url: mediaSource }
      } else if (mediaSource.startsWith('http')) {
        media = { url: mediaSource }
      } else {
        return m.reply('❌ الملف غير موجود والرابط غير صالح')
      }

      // استخدام JID البوت نفسه
      const botJid = conn.user?.id || m.key?.remoteJid
      if (!botJid) return m.reply('❌ تعذر معرفة JID البوت')

      await conn.updateProfilePicture(botJid, media)
      return m.reply('✅ تم تحديث صورة الملف الشخصي')
    }

    // حذف صورة الملف الشخصي
    if (['حذف_صوري', 'remove_picture', 'delete_profile_picture'].includes(command)) {
      const botJid = conn.user?.id || m.key?.remoteJid
      if (!botJid) return m.reply('❌ تعذر معرفة JID البوت')
      await conn.removeProfilePicture(botJid)
      return m.reply('🗑️ تم حذف صورة الملف الشخصي')
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('profile-update:', e)
    m.reply('❌ فشل تحديث الملف الشخصي')
  }
}

handler.command = [
  'حالتي_البوت', 'my_status_bot', 'update_status_bot',
  'اسمي_البوت', 'my_name_bot', 'update_name_bot', 'profile_name_bot',
  'صوري_البوت', 'my_picture_bot', 'update_picture_bot', 'profile_picture_bot',
  'حذف_صوري_البوت', 'remove_picture_bot', 'delete_profile_picture_bot'
]
handler.usage = [
  'حالتي متاح للتوظيف',
  'اسمي أحمد محمد',
  'صوري https://example.com/photo.jpg',
  'صوري ./photo.jpg',
  'حذف_صوري'
]
handler.category = 'user'
handler.description = 'تحديث الحالة النصية، الاسم، صورة الملف الشخصي، وحذف الصورة'
export default handler