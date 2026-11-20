/*
  ═══════════════════════════════════════════
  🎬 ملصق متحرك — من فيديو/GIF
  الأمر: .anim / .متحرك (رد على فيديو/GIF)
  ═══════════════════════════════════════════
*/

const MAX_DURATION = 10 // ثانية

const handler = async (m, { conn, text, args, usedPrefix, isOwner }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()

    // إعدادات
    if (subCmd === 'إعدادات' || subCmd === 'settings') {
      return m.reply(
        `⚙️ *إعدادات الملصقات المتحركة:*\\n\\n` +
        `⏱️ الحد الأقصى للمدة: ${MAX_DURATION} ثانية\\n` +
        `📏 الحجم الأقصى: 512x512\\n` +
        `🎬 التنسيقات المدعومة: MP4, WebM, GIF\\n` +
        `🔄 معدل الإطارات: 15 FPS\\n\\n` +
        `ملاحظة: الملصقات الطويلة قد تفشل في الإرسال`
      )
    }

    // التحقق من وجود ميديا
    const msg = m.quoted?.msg || m
    const mediaType = msg.message?.videoMessage || msg.message?.gifMessage || msg.message?.documentMessage

    if (!mediaType) {
      return conn.sendMessage(m.chat, {
        text: `🎬 *ملصق متحرك*\\n\\n` +
          `رد على فيديو/GIF/ملف فيديو بكتابة:\\n\`${usedPrefix}anim\`\\n\\n` +
          `المتطلبات:\\n` +
          `• مدة ≤ ${MAX_DURATION} ثانية\\n` +
          `• حجم ≤ 512x512\\n` +
          `• تنسيق: MP4/WebM/GIF`,
        footer: 'LIGHT BOT • Sticker',
        buttons: [
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}anim إعدادات` } }
        ]
      }, { quoted: m })
    }

    // التحقق من المدة
    const duration = mediaType.seconds || 0
    if (duration > MAX_DURATION) {
      return m.reply(`❌ الفيديو طويل جداً (${duration}ث). الحد الأقصى ${MAX_DURATION} ثانية`)
    }

    await m.react('🎬')

    // تحميل الوسائط
    const buffer = await conn.downloadMediaMessage(msg)

    // إرسال كملصق متحرك
    await conn.sendMessage(m.chat, {
      sticker: buffer,
      isAnimated: true,
      mimetype: 'video/webm' // أو 'image/gif' للـ GIF
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('animated:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل إنشاء الملصق المتحرك. تأكد من أن الفيديو ≤ 10 ثواني و ≤ 512x512')
  }
}

handler.command = ['anim', 'متحرك', 'animated', 'stickeranim']
handler.usage = ['anim (رد على فيديو/GIF)', 'anim إعدادات']
handler.category = 'sticker'
export default handler