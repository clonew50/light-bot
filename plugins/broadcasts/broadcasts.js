/*
  ═══════════════════════════════════════════
  📢 القوائم الإذاعية والقصص — Broadcasts & Stories
  الأمر: .إذاعة <نص> | .إذاعة_صورة <رابط> [شرح]
  .إذاعة_فيديو <رابط> [شرح] | .قصة <نص> | .قصة_صورة <رابط> [شرح]
  .قوائم_إذاعة | .معلومات_إذاعة <JID>
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (command === 'قوائم_إذاعة' || command === 'broadcast_lists') {
      // لا توجد دالة مباشرة في Baileys، نحتاج لتخزين القوائم محلياً
      return m.reply('📋 القوائم الإذاعية يجب إنشاؤها من تطبيق واتساب أولاً.\nاستخدم .معلومات_إذاعة <JID> لعرض معلومات قائمة محددة.')
    }

    if (command === 'معلومات_إذاعة' || command === 'broadcast_info') {
      if (!text) return m.reply('🔍 الاستخدام: .معلومات_إذاعة <JID_القائمة>')
      const jid = text.trim()
      if (!jid.endsWith('@broadcast')) return m.reply('❌ JID غير صالح، يجب أن ينتهي بـ @broadcast')
      try {
        const info = await conn.getBroadcastListInfo(jid)
        m.reply(`📋 *معلومات القائمة الإذاعية:*\n📛 الاسم: ${info.name}\n👥 المستلمون: ${info.recipients?.length || 0}`)
      } catch (e) {
        m.reply('❌ فشل جلب معلومات القائمة')
      }
      return
    }

    // إرسال لقائمة إذاعية
    if (['إذاعة', 'broadcast', 'إذاعة_نص'].includes(command)) {
      if (!text) return m.reply('📢 الاستخدام: .إذاعة <JID_القائمة> | <نص>')
      const [jid, ...msgParts] = text.split('|').map(s => s.trim())
      if (!jid || !msgParts.length) return m.reply('❌ التنسيق: .إذاعة JID | نص الرسالة')
      if (!jid.endsWith('@broadcast')) return m.reply('❌ JID يجب أن ينتهي بـ @broadcast')
      await conn.sendMessage(jid, { text: msgParts.join('|') })
      return m.reply('✅ تم إرسال الرسالة للقائمة الإذاعية')
    }

    // إرسال وسائط لقائمة إذاعية
    const mediaCommands = {
      'إذاعة_صورة': { type: 'image', field: 'image' },
      'إذاعة_فيديو': { type: 'video', field: 'video' },
      'إذاعة_مستند': { type: 'document', field: 'document' }
    }

    if (mediaCommands[command]) {
      const { field } = mediaCommands[command]
      if (!text) return m.reply(`📎 الاستخدام: .${command} <JID> | <رابط/مسار> [شرح]`)
      const [jid, mediaSource, ...captionParts] = text.split('|').map(s => s.trim())
      if (!jid || !mediaSource) return m.reply('❌ التنسيق: JID | رابط/مسار [شرح]')
      if (!jid.endsWith('@broadcast')) return m.reply('❌ JID يجب أن ينتهي بـ @broadcast')

      const media = { url: mediaSource }
      const caption = captionParts.join('|')
      await conn.sendMessage(jid, { [field]: media, caption })
      return m.reply('✅ تم إرسال الوسائط للقائمة الإذاعية')
    }

    // القصص (Status)
    const statusJid = 'status@broadcast'
    const statusJidList = text?.split('|')[0]?.trim() // يمكن تمرير قائمة JIDs

    if (['قصة', 'story', 'status_text'].includes(command)) {
      const msgText = text?.split('|').slice(1).join('|')?.trim() || text
      if (!msgText) return m.reply('📱 الاستخدام: .قصة [JID1,JID2|]نص القصة')
      await conn.sendMessage(statusJid, { text: msgText }, { broadcast: true, statusJidList: statusJidList?.split(',') })
      return m.reply('✅ تم نشر القصة النصية')
    }

    if (['قصة_صورة', 'story_image', 'status_image'].includes(command)) {
      if (!text) return m.reply('📷 الاستخدام: .قصة_صورة [JID1,JID2|]رابط [شرح]')
      const parts = text.split('|').map(s => s.trim())
      const mediaSource = parts[0]
      const caption = parts[1] || ''
      await conn.sendMessage(statusJid, { image: { url: mediaSource }, caption }, { broadcast: true, statusJidList: statusJidList?.split(',') })
      return m.reply('✅ تم نشر القصة بالصورة')
    }

    if (['قصة_فيديو', 'story_video', 'status_video'].includes(command)) {
      if (!text) return m.reply('🎬 الاستخدام: .قصة_فيديو [JID1,JID2|]رابط [شرح]')
      const parts = text.split('|').map(s => s.trim())
      const mediaSource = parts[0]
      const caption = parts[1] || ''
      await conn.sendMessage(statusJid, { video: { url: mediaSource }, caption }, { broadcast: true, statusJidList: statusJidList?.split(',') })
      return m.reply('✅ تم نشر القصة بالفيديو')
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('broadcasts:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = [
  'إذاعة', 'broadcast', 'إذاعة_نص',
  'إذاعة_صورة', 'broadcast_image',
  'إذاعة_فيديو', 'broadcast_video',
  'إذاعة_مستند', 'broadcast_document',
  'قصة', 'story', 'status_text',
  'قصة_صورة', 'story_image', 'status_image',
  'قصة_فيديو', 'story_video', 'status_video',
  'قوائم_إذاعة', 'broadcast_lists',
  'معلومات_إذاعة', 'broadcast_info'
]
handler.usage = [
  'إذاعة JID_قائمة | نص الرسالة',
  'إذاعة_صورة JID | رابط | شرح',
  'قصة نص القصة',
  'قصة JID1,JID2| نص القصة (لمستلمين محددين)',
  'قصة_صورة رابط | شرح',
  'قوائم_إذاعة',
  'معلومات_إذاعة JID_قائمة'
]
handler.category = 'broadcasts'
handler.description = 'إرسال رسائل ووسائط للقوائم الإذاعية، ونشر قصص (Status) مع دعم المستلمين المحددين'
export default handler