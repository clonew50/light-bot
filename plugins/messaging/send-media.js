/*
  ═══════════════════════════════════════════
  📷 إرسال الوسائط — Media Messages
  الأمر: .صورة <رابط/مسار> [شرح] | .فيديو <رابط/مسار> [شرح] | .صوت <رابط/مسار>
  .مستند <رابط/مسار> [اسم ملف] | .ملصق <رابط/مسار> | .gif <رابط/مسار> [شرح]
  .مرئية <رابط/مسار> [شرح] | .مؤقتة <رابط/مسار> [شرح] (عرض مرة واحدة)
  ═══════════════════════════════════════════
*/
import fs from 'fs'
import path from 'path'

const handler = async (m, { conn, text, command }) => {
  try {
    const args = text.trim().split(' ')
    if (!args[0]) {
      const usage = {
        صورة: '.صورة <رابط/مسار> [شرح]',
        فيديو: '.فيديو <رابط/مسار> [شرح]',
        صوت: '.صوت <رابط/مسار>',
        مستند: '.مستند <رابط/مسار> [اسم ملف]',
        ملصق: '.ملصق <رابط/مسار>',
        gif: '.gif <رابط/مسار> [شرح]',
        مرئية: '.مرئية <رابط/مسار> [شرح] (فيديو دائري)',
        مؤقتة: '.مؤقتة <رابط/مسار> [شرح] (عرض مرة واحدة)'
      }
      return m.reply(`📎 الاستخدام:\n${Object.entries(usage).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
    }

    const mediaSource = args[0]
    const caption = args.slice(1).join(' ') || ''
    const isViewOnce = command === 'مؤقتة'
    const isVideoNote = command === 'مرئية'

    // التحقق من وجود الملف محلياً أو استخدام الرابط
    let media = {}
    if (fs.existsSync(mediaSource)) {
      media = { url: mediaSource }
    } else if (mediaSource.startsWith('http')) {
      media = { url: mediaSource }
    } else {
      return m.reply('❌ الملف غير موجود والرابط غير صالح')
    }

    let messageContent = {}

    switch (command) {
      case 'صورة':
        messageContent = { image: media, caption }
        break
      case 'فيديو':
        messageContent = { video: media, caption, gifPlayback: false }
        break
      case 'gif':
        messageContent = { video: media, caption, gifPlayback: true }
        break
      case 'صوت':
        messageContent = { audio: media, mimetype: 'audio/ogg; codecs=opus' }
        break
      case 'مستند':
        const fileName = args[1] || path.basename(mediaSource)
        messageContent = { document: media, fileName, caption: args.slice(2).join(' ') }
        break
      case 'ملصق':
        messageContent = { sticker: media }
        break
      case 'مرئية':
        messageContent = { video: media, caption, ptv: true }
        break
      case 'مؤقتة':
        // للصور والفيديو والصوت فقط
        if (media.image || media.video || media.audio) {
          messageContent = { ...media, viewOnce: true, caption }
        } else {
          return m.reply('❌ العرض مرة واحدة يعمل مع الصور والفيديو والصوت فقط')
        }
        break
      default:
        return m.reply('❌ نوع وسائط غير معروف')
    }

    if (isViewOnce && command !== 'مؤقتة') {
      messageContent.viewOnce = true
    }

    await conn.sendMessage(m.chat, messageContent)
  } catch (e) {
    console.error('send-media:', e)
    m.reply('❌ فشل إرسال الوسائط')
  }
}

handler.command = ['ارسال_صورة', 'send_image', 'ارسال_فيديو', 'send_video', 'ارسال_صوت', 'send_audio', 'ارسال_مستند', 'send_document', 'ارسال_ملصق', 'send_sticker', 'send_gif', 'ارسال_مرئية', 'send_vnote', 'ارسال_مؤقتة', 'send_viewonce']
handler.usage = [
  'صورة https://example.com/img.jpg وصف الصورة',
  'فيديو ./video.mp4 وصف الفيديو',
  'gif https://example.com/anim.gif متحرك',
  'مرئية ./circle.mp4 فيديو دائري',
  'مؤقتة https://example.com/secret.jpg صورة مؤقتة'
]
handler.category = 'messaging'
handler.description = 'إرسال جميع أنواع الوسائط: صور، فيديو، صوت، مستندات، ملصقات، GIF، فيديو دائري، عرض مرة واحدة'
export default handler