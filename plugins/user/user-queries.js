/*
  ═══════════════════════════════════════════
  🔍 استعلامات المستخدم — User Queries
  الأمر: .على_واتساب <رقم> | .حالة_واتساب <رقم>
  .صورة_الملف <رقم> [عالية] | .ملف_أعمال <رقم>
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    // التحقق من وجود رقم على واتساب
    if (['على_واتساب', 'on_whatsapp', 'check_number'].includes(command)) {
      if (!text) return m.reply('🔍 الاستخدام: .على_واتساب 201001234567')
      const phone = text.replace(/[^0-9]/g, '')
      if (!/^\d{8,15}$/.test(phone)) return m.reply('❌ رقم غير صالح')

      const [result] = await conn.onWhatsApp(`${phone}@s.whatsapp.net`)
      if (result.exists) {
        m.reply(`✅ الرقم موجود على واتساب\n🆔 JID: ${result.jid}`)
      } else {
        m.reply('❌ الرقم غير مسجل على واتساب')
      }
      return
    }

    // جلب حالة المستخدم (النص تحت الاسم)
    if (['حالة_واتساب', 'fetch_status', 'user_status'].includes(command)) {
      let target = text?.replace(/[^0-9]/g, '')
      if (!target && m.quoted) {
        target = (m.quoted.key.participant || m.quoted.key.remoteJid || '').split('@')[0]
      }
      if (!target && m.mentionedJid?.length) {
        target = m.mentionedJid[0].split('@')[0]
      }
      if (!target) return m.reply('👤 حدد مستخدم: .حالة_واتساب 201001234567 أو رد/منشن')

      const jid = `${target}@s.whatsapp.net`
      const status = await conn.fetchStatus(jid)
      m.reply(`📝 *حالة ${target}:*\n${status || '(فارغة)'}`)
      return
    }

    // جلب صورة الملف الشخصي
    if (['صورة_الملف', 'profile_picture', 'pp', 'avatar'].includes(command)) {
      let target = text?.replace(/[^0-9]/g, '')
      const highRes = text?.includes('عالية') || text?.includes('high')
      if (!target && m.quoted) {
        target = (m.quoted.key.participant || m.quoted.key.remoteJid || '').split('@')[0]
      }
      if (!target && m.mentionedJid?.length) {
        target = m.mentionedJid[0].split('@')[0]
      }
      if (!target) return m.reply('👤 حدد مستخدم: .صورة_الملف 201001234567 [عالية] أو رد/منشن')

      const jid = `${target}@s.whatsapp.net`
      const url = await conn.profilePictureUrl(jid, highRes ? 'image' : 'preview')
      if (url) {
        await conn.sendMessage(m.chat, { image: { url }, caption: `🖼️ صورة ${target} (${highRes ? 'عالية الدقة' : 'مصغرة'})` })
      } else {
        m.reply('❌ لا توجد صورة ملف شخصي أو مخفية بالخصوصية')
      }
      return
    }

    // جلب ملف الأعمال
    if (['ملف_أعمال', 'business_profile', 'biz_profile'].includes(command)) {
      let target = text?.replace(/[^0-9]/g, '')
      if (!target && m.quoted) {
        target = (m.quoted.key.participant || m.quoted.key.remoteJid || '').split('@')[0]
      }
      if (!target && m.mentionedJid?.length) {
        target = m.mentionedJid[0].split('@')[0]
      }
      if (!target) return m.reply('🏢 حدد رقم أعمال: .ملف_أعمال 201001234567 أو رد/منشن')

      const jid = `${target}@s.whatsapp.net`
      const profile = await conn.getBusinessProfile(jid)
      if (profile) {
        let msg = `🏢 *ملف الأعمال:*\n`
        msg += `📛 الاسم: ${profile.wid || '—'}\n`
        msg += `📝 الوصف: ${profile.description || '—'}\n`
        msg += `🏷️ الفئة: ${profile.category || '—'}\n`
        if (profile.email) msg += `📧 الإيميل: ${profile.email}\n`
        if (profile.website) msg += `🌐 الموقع: ${profile.website}\n`
        if (profile.address) msg += `📍 العنوان: ${profile.address}\n`
        if (profile.vertical) msg += `📊 المجال: ${profile.vertical}\n`
        m.reply(msg)
      } else {
        m.reply('❌ ليس حساب أعمال أو لا يوجد ملف عام')
      }
      return
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('user-queries:', e)
    m.reply('❌ فشل الاستعلام')
  }
}

handler.command = [
  'على_واتساب', 'on_whatsapp', 'check_number',
  'حالة_واتساب', 'fetch_status', 'user_status',
  'صورة_ملف_شخص', 'profile_picture_user', 'pp_user', 'avatar_user',
  'ملف_أعمال', 'business_profile', 'biz_profile'
]
handler.usage = [
  'على_واتساب 201001234567',
  'حالة_واتساب 201001234567',
  'صورة_الملف 201001234567',
  'صورة_الملف 201001234567 عالية',
  'ملف_أعمال 201001234567'
]
handler.category = 'user'
handler.description = 'التحقق من وجود رقم على واتساب، جلب الحالة النصية، صورة الملف الشخصي، وملف الأعمال'
export default handler