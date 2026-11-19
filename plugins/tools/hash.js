/*
  ═══════════════════════════════════════════
  #️⃣ مولد هاش — خوارزميات متعددة تفاعلية
  الأمر: .hash / .هاش <نص>
  ═══════════════════════════════════════════
*/
import crypto from 'crypto'
import { pruneCooldown } from '../../system/cooldowns.js'

const ALGORITHMS = [
  { id: 'md5', name: 'MD5', desc: '128-bit، سريع، غير آمن', emoji: '🔴' },
  { id: 'sha1', name: 'SHA-1', desc: '160-bit، مهجور', emoji: '🟠' },
  { id: 'sha256', name: 'SHA-256', desc: '256-bit، قياسي', emoji: '🟢' },
  { id: 'sha384', name: 'SHA-384', desc: '384-bit، قوي', emoji: '🔵' },
  { id: 'sha512', name: 'SHA-512', desc: '512-bit، الأقوى', emoji: '🟣' },
  { id: 'sha3-256', name: 'SHA3-256', desc: 'معيار جديد', emoji: '🟢' },
  { id: 'sha3-512', name: 'SHA3-512', desc: 'الأحدث والأقوى', emoji: '🟣' },
  { id: 'ripemd160', name: 'RIPEMD-160', desc: '160-bit، بديل', emoji: '🟡' },
]

const cooldown = new Map()
const COOLDOWN_MS = 3000
const userAlgo = new Map()

function buildAlgoButtons(usedPrefix = '.') {
  return ALGORITHMS.map(a => ({
    name: 'quick_reply',
    params: { display_text: `${a.emoji} ${a.name}`, id: `${usedPrefix}hash خوارزمية ${a.id}` }
  }))
}

function hashText(text, algo) {
  try {
    return crypto.createHash(algo).update(text).digest('hex')
  } catch {
    return null
  }
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }
    pruneCooldown(cooldown, COOLDOWN_MS)
    if (userAlgo.size > 2000) userAlgo.delete(userAlgo.keys().next().value)

    const subCmd = args[0]?.toLowerCase()
    const inputText = (text || '').trim()

    if (subCmd === 'خوارزمية' || subCmd === 'algo' || subCmd === 'algorithm') {
      const algoId = args[1]
      if (!algoId) {
        return conn.sendMessage(m.chat, {
          text: '#️⃣ *اختر خوارزمية الهاش:*',
          footer: 'LIGHT BOT • Hash Generator',
          buttons: buildAlgoButtons(usedPrefix)
        }, { quoted: m })
      }
      const algo = ALGORITHMS.find(a => a.id === algoId)
      if (!algo) return m.reply('❌ خوارزمية غير موجودة')
      userAlgo.set(m.sender, algoId)
      return m.reply(`${algo.emoji} *تم اختيار:* ${algo.name} (${algo.desc})`)
    }

    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const algo = ALGORITHMS.find(a => a.id === userAlgo.get(m.sender)) || ALGORITHMS[2]
      return m.reply(`⚙️ *الخوارزمية الحالية:* ${algo.emoji} ${algo.name}`)
    }

    if (subCmd === 'الكل' || subCmd === 'all') {
      const target = args.slice(1).join(' ').trim() || m.quoted?.text
      if (!target) return m.reply('❌ اكتب نص أو رد على رسالة')
      cooldown.set(m.sender, now)
      await m.react('#️⃣')
      let out = `📋 *هاش لجميع الخوارزميات:*\n\n\`${target.slice(0, 50)}\`\n\n`
      for (const a of ALGORITHMS) {
        const h = hashText(target, a.id)
        out += `${a.emoji} *${a.name}:*\n\`${h}\`\n\n`
      }
      return m.reply(out)
    }

    if (!inputText && !m.quoted?.text && !m.quoted?.msg?.conversation) {
      return conn.sendMessage(m.chat, {
        text: `#️⃣ *مولد هاش*\n\n` +
          `أرسل نص، أو رد على رسالة:\n` +
          `\`${usedPrefix}hash نص للتشفير\`\n\n` +
          `الخوارزمية الحالية: ${(userAlgo.get(m.sender) ? ALGORITHMS.find(a => a.id === userAlgo.get(m.sender))?.name : 'SHA-256')}`,
        footer: 'LIGHT BOT • Hash Generator',
        buttons: [
          ...buildAlgoButtons(usedPrefix).slice(0, 4),
          { name: 'quick_reply', params: { display_text: '📋 الكل', id: `${usedPrefix}hash الكل ` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}hash إعدادات` } }
        ]
      }, { quoted: m })
    }

    const targetText = inputText || m.quoted?.text || m.quoted?.msg?.conversation

    cooldown.set(m.sender, now)
    await m.react('#️⃣')

    const algoId = userAlgo.get(m.sender) || 'sha256'
    const algo = ALGORITHMS.find(a => a.id === algoId) || ALGORITHMS[2]
    const hash = hashText(targetText, algoId)

    if (!hash) {
      return m.reply('❌ خوارزمية غير مدعومة')
    }

    await m.reply(
      `${algo.emoji} *${algo.name} Hash:*\n\n` +
      `\`${hash}\`\n\n` +
      `📝 *النص:* ${targetText.slice(0, 100)}${targetText.length > 100 ? '...' : ''}\n` +
      `📏 *الطول:* ${targetText.length} حرف → ${hash.length} حرف هكس`
    )
    await m.react('✅')

  } catch (e) {
    console.error('hash:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ في التوليد')
  }
}

handler.command = ['hash', 'هاش', 'هاشينغ']
handler.usage = ['hash <نص>', 'hash خوارزمية <md5|sha1|sha256|sha512|...>', 'hash الكل <نص>', 'hash إعدادات']
handler.category = 'tools'
handler.cooldown = 3
export default handler