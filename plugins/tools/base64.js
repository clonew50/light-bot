/*
  ═══════════════════════════════════════════
  🔐 Base64 تشفير/فك — نص وملفات تفاعلي
  الأمر: .base64 / .بيس64 <نص>
  ═══════════════════════════════════════════
*/
function encode(text) {
  return Buffer.from(text, 'utf-8').toString('base64')
}

function decode(base64) {
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

function encodeUrl(text) {
  return Buffer.from(text, 'utf-8').toString('base64url')
}

function decodeUrl(base64url) {
  try {
    return Buffer.from(base64url, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}

function buildButtons(usedPrefix = '.') {
  return [
    { name: 'quick_reply', params: { display_text: '🔒 تشفير', id: `${usedPrefix}base64 تشفير ` } },
    { name: 'quick_reply', params: { display_text: '🔓 فك', id: `${usedPrefix}base64 فك ` } },
    { name: 'quick_reply', params: { display_text: '🔗 URL-safe', id: `${usedPrefix}base64 url ` } },
    { name: 'quick_reply', params: { display_text: '📁 ملف', id: `${usedPrefix}base64 ملف` } }
  ]
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const restText = args.slice(1).join(' ').trim()
    const input = (text || '').trim()
    const quotedText = m.quoted?.text || m.quoted?.msg?.conversation

    if (subCmd === 'تشفير' || subCmd === 'encode' || subCmd === 'encrypt') {
      const target = restText || quotedText
      if (!target) return m.reply('❌ اكتب نص للتشفير أو رد على رسالة')
      const encoded = encode(target)
      await m.react('🔒')
      return conn.sendMessage(m.chat, {
        text: `🔒 *تم التشفير (Base64):*\n\n\`${encoded}\`\n\n📏 ${target.length} حرف → ${encoded.length} حرف`,
        footer: 'LIGHT BOT • Base64',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📋 نسخ', id: `${usedPrefix}base64 نسخ ${encoded}` } },
          { name: 'quick_reply', params: { display_text: '🔓 فك التشفير', id: `${usedPrefix}base64 فك ${encoded}` } },
          { name: 'quick_reply', params: { display_text: '🔗 URL-safe', id: `${usedPrefix}base64 url ${encoded}` } }
        ],
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    if (subCmd === 'فك' || subCmd === 'decode' || subCmd === 'decrypt') {
      const target = restText || quotedText
      if (!target) return m.reply('❌ اكتب Base64 لفك التشفير أو رد على رسالة')
      const decoded = decode(target)
      if (decoded === null) return m.reply('❌ Base64 غير صالح')
      await m.react('🔓')
      return conn.sendMessage(m.chat, {
        text: `🔓 *تم فك التشفير:*\n\n\`${decoded}\`\n\n📏 ${target.length} حرف → ${decoded.length} حرف`,
        footer: 'LIGHT BOT • Base64',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📋 نسخ', id: `${usedPrefix}base64 نسخ ${decoded}` } },
          { name: 'quick_reply', params: { display_text: '🔒 إعادة تشفير', id: `${usedPrefix}base64 تشفير ${decoded}` } }
        ],
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    if (subCmd === 'url' || subCmd === 'urlsafe') {
      const target = restText || quotedText
      if (!target) return m.reply('❌ اكتب نص')
      const isEncoded = /^[A-Za-z0-9_-]+$/.test(target) && target.length >= 4 && target.length % 4 === 0
      if (isEncoded && !target.includes(' ') && !target.includes('\n')) {
        const result = decodeUrl(target)
        if (result === null) return m.reply('❌ Base64URL غير صالح')
        await m.react('🔓')
        return m.reply(`🔗 *URL-safe Decoded:*\n\n\`${result}\``)
      }
      const result = encodeUrl(target)
      await m.react('🔒')
      return m.reply(`🔗 *URL-safe Encoded:*\n\n\`${result}\`\n\n(بدون + / =، آمن للروابط)`)
    }

    if (subCmd === 'ملف' || subCmd === 'file') {
      const q = m.quoted
      const mime = q ? ((q.msg || q).mimetype || '') : ''
      if (!q || !mime) {
        return m.reply('❌ رد على صورة/ملف/فيديو/صوت لتحويله لـ Base64')
      }
      await m.react('⏳')
      try {
        const buffer = await q.download()
        const b64 = buffer.toString('base64')
        await m.react('📁')
        return m.reply(
          `📁 *ملف → Base64:*\n\n` +
          `📏 الحجم: ${(buffer.length / 1024).toFixed(1)} KB\n` +
          `📝 Base64 الطول: ${b64.length} حرف\n\n` +
          `\`${b64.slice(0, 120)}...\``
        )
      } catch {
        return m.reply('❌ فشل تحميل الملف')
      }
    }

    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const value = restText
      if (!value) return m.reply('❌ لا توجد قيمة')
      return m.reply(`📋 *تم النسخ:*\n\`${value}\``)
    }

    const target = input || quotedText
    if (target) {
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(target) && target.length >= 4 && target.length % 4 === 0
      const decoded = isBase64 ? decode(target) : null
      await m.react('🔐')
      return conn.sendMessage(m.chat, {
        text: `🔐 *Base64 Tool*\n\n` +
          `النص: \`${target.slice(0, 50)}${target.length > 50 ? '...' : ''}\`\n` +
          `${decoded ? `🔍 يبدو مشفراً، فك؟` : '🔒 تشفير؟'}`,
        footer: 'LIGHT BOT • Base64',
        buttons: [
          { name: 'quick_reply', params: { display_text: decoded ? '🔓 فك' : '🔒 تشفير', id: `${usedPrefix}base64 ${decoded ? 'فك' : 'تشفير'} ${target}` } },
          { name: 'quick_reply', params: { display_text: '🔗 URL-safe', id: `${usedPrefix}base64 url ${target}` } },
          { name: 'quick_reply', params: { display_text: '📁 ملف', id: `${usedPrefix}base64 ملف` } }
        ],
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    return conn.sendMessage(m.chat, {
      text: `🔐 *Base64 تشفير/فك*\n\nأرسل نص، أو رد على رسالة/ملف`,
      footer: 'LIGHT BOT • Base64',
      buttons: buildButtons(usedPrefix)
    }, { quoted: m })

  } catch (e) {
    console.error('base64:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['base64', 'بيس64', 'باز64', 'b64']
handler.usage = ['base64 <نص>', 'base64 تشفير <نص>', 'base64 فك <base64>', 'base64 url <نص>', 'base64 ملف (رد على ميديا)']
handler.category = 'tools'
export default handler