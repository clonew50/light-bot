/*
  ═══════════════════════════════════════════
  🎫 مولد JWT — خوارزميات ومطالبات تفاعلية
  الأمر: .jwt / .توكن <بيانات>
  ═══════════════════════════════════════════
*/
import crypto from 'crypto'
const ALGORITHMS = [
  { id: 'HS256', name: 'HS256', desc: 'HMAC SHA-256 (مفتاح مشترك)', emoji: '🔐' },
  { id: 'HS384', name: 'HS384', desc: 'HMAC SHA-384', emoji: '🔐' },
  { id: 'HS512', name: 'HS512', desc: 'HMAC SHA-512', emoji: '🔐' },
]

const userAlgo = new Map()
const userSecret = new Map()
const userClaims = new Map()

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = input.length % 4
  if (pad) input += '='.repeat(4 - pad)
  return Buffer.from(input, 'base64').toString()
}

function signHS256(header, payload, secret) {
  const data = `${header}.${payload}`
  return base64url(crypto.createHmac('sha256', secret).update(data).digest())
}

function signHS384(header, payload, secret) {
  const data = `${header}.${payload}`
  return base64url(crypto.createHmac('sha384', secret).update(data).digest())
}

function signHS512(header, payload, secret) {
  const data = `${header}.${payload}`
  return base64url(crypto.createHmac('sha512', secret).update(data).digest())
}

function signJWT(claims, secret, algo) {
  const header = { alg: algo, typ: 'JWT' }
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(claims))

  let signature
  switch (algo) {
    case 'HS384': signature = signHS384(headerB64, payloadB64, secret); break
    case 'HS512': signature = signHS512(headerB64, payloadB64, secret); break
    default: signature = signHS256(headerB64, payloadB64, secret)
  }
  return `${headerB64}.${payloadB64}.${signature}`
}

function verifyJWT(token, secret, algo) {
  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false, error: 'Invalid format' }
  const [, payloadB64, signature] = parts
  try {
    const expected = signJWT(JSON.parse(base64urlDecode(payloadB64)), secret, algo).split('.')[2]
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!valid) return { valid: false, error: 'Invalid signature' }
    const payload = JSON.parse(base64urlDecode(payloadB64))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return { valid: false, error: 'Token expired', payload }
    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'Invalid payload' }
  }
}

function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return {
      header: JSON.parse(base64urlDecode(parts[0])),
      payload: JSON.parse(base64urlDecode(parts[1])),
      signature: parts[2]
    }
  } catch {
    return null
  }
}

function buildAlgoButtons(usedPrefix = '.') {
  return ALGORITHMS.map(a => ({
    name: 'quick_reply',
    params: { display_text: `${a.emoji} ${a.name}`, id: `${usedPrefix}jwt خوارزمية ${a.id}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    for (const map of [userAlgo, userSecret, userClaims]) {
      if (map.size > 2000) map.delete(map.keys().next().value)
    }

    const subCmd = args[0]?.toLowerCase()
    const claims = userClaims.get(m.sender) || {}

    if (subCmd === 'خوارزمية' || subCmd === 'algo' || subCmd === 'algorithm') {
      const algo = args[1]?.toUpperCase()
      if (!algo || !ALGORITHMS.find(a => a.id === algo)) {
        return conn.sendMessage(m.chat, {
          text: '🎫 *اختر خوارزمية التوقيع:*',
          footer: 'LIGHT BOT • JWT Generator',
          buttons: buildAlgoButtons(usedPrefix)
        }, { quoted: m })
      }
      userAlgo.set(m.sender, algo)
      return m.reply(`${ALGORITHMS.find(a => a.id === algo)?.emoji} *تم اختيار:* ${algo}`)
    }

    if (subCmd === 'مفتاح' || subCmd === 'secret' || subCmd === 'key') {
      const secret = args.slice(1).join(' ')
      if (!secret) return m.reply('❌ أدخل المفتاح: `.jwt مفتاح my-secret-key`')
      userSecret.set(m.sender, secret)
      return m.reply(`🔐 *تم تعيين المفتاح السري* (${secret.length} حرف)`)
    }

    if (subCmd === 'مطالبة' || subCmd === 'claim' || subCmd === 'add') {
      const key = args[1]
      const value = args.slice(2).join(' ')
      if (!key) return m.reply('❌ الاستخدام: `.jwt مطالبة sub user123`')
      let parsed = value
      if (value === 'true') parsed = true
      else if (value === 'false') parsed = false
      else if (/^\d+$/.test(value)) parsed = parseInt(value)
      else if (/^\d*\.\d+$/.test(value)) parsed = parseFloat(value)
      else if (value.startsWith('{') || value.startsWith('[')) {
        try { parsed = JSON.parse(value) } catch {}
      }
      claims[key] = parsed
      userClaims.set(m.sender, claims)
      return m.reply(`✅ *مطالبة مضافة:* \`${key}\` = \`${JSON.stringify(parsed)}\``)
    }

    if (subCmd === 'احذف' || subCmd === 'remove' || subCmd === 'del') {
      const key = args[1]
      if (!key || !(key in claims)) return m.reply('❌ مطالبة غير موجودة')
      delete claims[key]
      userClaims.set(m.sender, claims)
      return m.reply(`🗑️ *تم حذف:* ${key}`)
    }

    if (subCmd === 'مسح' || subCmd === 'clear') {
      userClaims.set(m.sender, {})
      return m.reply('🗑️ *تم مسح جميع المطالبات*')
    }

    if (subCmd === 'انقضاء' || subCmd === 'exp' || subCmd === 'expiry') {
      const minutes = parseInt(args[1])
      if (isNaN(minutes) || minutes < 1) return m.reply('❌ دقائق غير صالحة')
      claims.exp = Math.floor(Date.now() / 1000) + minutes * 60
      userClaims.set(m.sender, claims)
      return m.reply(`⏰ *انقضاء مضاف:* ${minutes} دقيقة من الآن`)
    }

    if (subCmd === 'اصدار' || subCmd === 'iat' || subCmd === 'issued') {
      claims.iat = Math.floor(Date.now() / 1000)
      userClaims.set(m.sender, claims)
      return m.reply(`📅 *وقت الإصدار مضاف:* الآن`)
    }

    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const algo = userAlgo.get(m.sender) || 'HS256'
      const secret = userSecret.get(m.sender) ? '✅ مضبوط' : '❌ غير مضبوط'
      return m.reply(
        `⚙️ *إعدادات JWT:*\n\n` +
        `🔐 خوارزمية: ${algo}\n` +
        `🔑 مفتاح: ${secret}\n` +
        `📋 مطالبات: ${Object.keys(claims).length}\n` +
        `${Object.entries(claims).map(([k, v]) => `  • ${k}: ${JSON.stringify(v)}`).join('\n') || '  (فارغ)'}`
      )
    }

    if (subCmd === 'تحقق' || subCmd === 'verify' || subCmd === 'validate') {
      const token = args[1] || text?.replace(/^(تحقق|verify|validate)\s*/i, '').trim() || m.quoted?.text
      if (!token) return m.reply('❌ أدخل JWT للتحقق')
      const secret = userSecret.get(m.sender)
      if (!secret) return m.reply('❌ اضبط المفتاح أولاً: `.jwt مفتاح سرك`')
      const algo = userAlgo.get(m.sender) || 'HS256'
      const result = verifyJWT(token, secret, algo)
      const decoded = decodeJWT(token)
      if (!result.valid) {
        await m.react('❌')
        return m.reply(
          `❌ *غير صحيح:* ${result.error}\n\n` +
          (decoded ? `Header: \`${JSON.stringify(decoded.header)}\`\nPayload: \`${JSON.stringify(decoded.payload)}\`` : '')
        )
      }
      await m.react('✅')
      return m.reply(
        `✅ *JWT صحيح!*\n\n` +
        `Header: \`${JSON.stringify(decoded.header)}\`\n` +
        `Payload: \`${JSON.stringify(result.payload)}\``
      )
    }

    if (subCmd === 'فك' || subCmd === 'decode') {
      const token = args[1] || text?.replace(/^(فك|decode)\s*/i, '').trim() || m.quoted?.text
      if (!token) return m.reply('❌ أدخل JWT')
      const decoded = decodeJWT(token)
      if (!decoded) return m.reply('❌ JWT غير صالح')
      await m.react('🔓')
      return m.reply(
        `🔓 *JWT مفكوك (بدون تحقق):*\n\n` +
        `Header: \`${JSON.stringify(decoded.header, null, 2)}\`\n` +
        `Payload: \`${JSON.stringify(decoded.payload, null, 2)}\``
      )
    }

    if (subCmd === 'توليد' || subCmd === 'generate' || subCmd === 'create' || !subCmd) {
      const secret = userSecret.get(m.sender)
      if (!secret) {
        return conn.sendMessage(m.chat, {
          text: `🎫 *مولد JWT*\n\n` +
            `اضبط المفتاح السري أولاً:\n` +
            `\`.jwt مفتاح your-secret-key\`\n\n` +
            `ثم أضف مطالبات:\n` +
            `\`.jwt مطالبة sub user123\`\n` +
            `\`.jwt مطالبة role admin\`\n` +
            `\`.jwt انقضاء 60\` (دقيقة)`,
          footer: 'LIGHT BOT • JWT Generator',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🔐 خوارزمية', id: `${usedPrefix}jwt خوارزمية` } },
            { name: 'quick_reply', params: { display_text: '🔑 مفتاح', id: `${usedPrefix}jwt مفتاح ` } },
            { name: 'quick_reply', params: { display_text: '➕ مطالبة', id: `${usedPrefix}jwt مطالبة ` } },
            { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}jwt إعدادات` } }
          ]
        }, { quoted: m })
      }

      const algo = userAlgo.get(m.sender) || 'HS256'
      const token = signJWT(claims, secret, algo)
      await m.react('🎫')

      return conn.sendMessage(m.chat, {
        text: `🎫 *JWT مُولد (${ALGORITHMS.find(a => a.id === algo)?.name}):*\n\n\`${token}\`\n\n` +
          `Payload: \`${JSON.stringify(claims)}\``,
        footer: 'LIGHT BOT • JWT Generator',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📋 نسخ', id: `${usedPrefix}jwt نسخ ${token}` } },
          { name: 'quick_reply', params: { display_text: '🔍 تحقق', id: `${usedPrefix}jwt تحقق ${token}` } },
          { name: 'quick_reply', params: { display_text: '🔓 فك', id: `${usedPrefix}jwt فك ${token}` } },
          { name: 'quick_reply', params: { display_text: '🗑️ مسح مطالبات', id: `${usedPrefix}jwt مسح` } }
        ],
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const value = args.slice(1).join(' ')
      if (!value) return m.reply('❌ لا توجد قيمة')
      return m.reply(`📋 *تم النسخ:*\n\`${value}\``)
    }

  } catch (e) {
    console.error('jwt:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['jwt', 'توكن', 'token']
handler.usage = ['jwt توليد', 'jwt خوارزمية <HS256|HS384|HS512>', 'jwt مفتاح <سر>', 'jwt مطالبة <مفتاح> <قيمة>', 'jwt انقضاء <دقائق>', 'jwt تحقق <token>', 'jwt فك <token>', 'jwt إعدادات']
handler.category = 'tools'
export default handler