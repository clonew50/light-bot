/*
  ═══════════════════════════════════════════
  ⬇️ تحميل الوسائط — Media Download
  الأمر: .تحميل (رد على صورة/فيديو/صوت/مستند)
  .تحميل_رابط <رابط> (تحميل من رابط مباشر)
  ═══════════════════════════════════════════
*/
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

const handler = async (m, { conn, text, command }) => {
  try {
    // تحميل من رسالة مقتبسة
    if (['تحميل', 'download', 'save_media'].includes(command)) {
      if (!m.quoted || !m.quoted.message) return m.reply('📎 رد على رسالة تحتوي على وسائط (صورة، فيديو، صوت، مستند)')

      const msg = m.quoted
      const messageType = Object.keys(msg.message)[0]

      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
      if (!mediaTypes.includes(messageType)) {
        return m.reply('❌ نوع الوسائط غير مدعوم للتحميل')
      }

      m.reply('⬇️ جاري التحميل...')

      const stream = await downloadMediaMessage(msg, 'stream', {}, {
        reuploadRequest: conn.updateMediaMessage
      })

      const extMap = {
        imageMessage: 'jpg',
        videoMessage: 'mp4',
        audioMessage: 'ogg',
        documentMessage: msg.message.documentMessage?.fileName?.split('.').pop() || 'bin',
        stickerMessage: 'webp'
      }

      const ext = extMap[messageType] || 'bin'
      const fileName = `media_${Date.now()}.${ext}`
      const filePath = path.join('/tmp', fileName)

      const writeStream = fs.createWriteStream(filePath)
      stream.pipe(writeStream)

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      const stats = fs.statSync(filePath)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

      // إرسال الملف كمستند
      await conn.sendMessage(m.chat, {
        document: { url: filePath },
        fileName,
        caption: `⬇️ تم التحميل: ${fileName} (${sizeMB} MB)`
      })

      // تنظيف
      fs.unlinkSync(filePath)
      return
    }

    // تحميل من رابط مباشر
    if (['تحميل_رابط', 'download_url'].includes(command)) {
      if (!text) return m.reply('🔗 الاستخدام: .تحميل_رابط <رابط_مباشر> [اسم_الملف]')
      const parts = text.split(' ')
      const url = parts[0]
      const fileName = parts[1] || `download_${Date.now()}`

      m.reply('⬇️ جاري التحميل من الرابط...')

      const response = await axios.get(url, { responseType: 'stream' })
      const filePath = path.join('/tmp', fileName)

      const writer = fs.createWriteStream(filePath)
      response.data.pipe(writer)

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      const stats = fs.statSync(filePath)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

      await conn.sendMessage(m.chat, {
        document: { url: filePath },
        fileName,
        caption: `⬇️ تم التحميل من الرابط: ${fileName} (${sizeMB} MB)`
      })

      fs.unlinkSync(filePath)
      return
    }

    m.reply('❌ أمر غير معروف')
  } catch (e) {
    console.error('media-download:', e)
    m.reply('❌ فشل التحميل')
  }
}

handler.command = ['تحميل', 'download', 'save_media', 'تحميل_رابط', 'download_url']
handler.usage = ['تحميل (رد على وسائط)', 'تحميل_رابط https://example.com/file.pdf اسم_الملف.pdf']
handler.category = 'messaging'
handler.description = 'تحميل الوسائط من الرسائل المقتبسة أو من روابط مباشرة'
export default handler