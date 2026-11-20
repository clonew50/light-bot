/*
  ═══════════════════════════════════════════
  🆔 مولد UUID — إصدارات متعددة تفاعلية
  الأمر: .uuid / .يوييد / .معرّف
  ═══════════════════════════════════════════
*/
import crypto from 'crypto'
const VERSIONS = [
  { id: 'v1', name: 'v1 (وقت + MAC)', desc: 'بناء على الوقت وعنوان MAC', emoji: '⏰' },
  { id: 'v4', name: 'v4 (عشوائي)', desc: 'عشوائي تشفيرياً، الأكثر استخداماً', emoji: '🎲' },
  { id: 'v7', name: 'v7 (وقت Unix)', desc: 'Timestamp + عشوائي، قابل للترتيب', emoji: '📅' },
  { id: 'nil', name: 'Nil UUID', desc: 'أصفار فقط (00000000-...)', emoji: '🟢' },
  { id: 'max', name: 'Max UUID', desc: 'قيم قصوى (ffffffff-...)', emoji: '🔴' },
]

const userVersion = new Map()

function generateV1() {
  const now = Date.now()
  const timeLow = (now & 0xffffffff).toString(16).padStart(8, '0')
  const timeMid = ((now >> 32) & 0xffff).toString(16).padStart(4, '0')
  const timeHi = (((now >> 48) & 0x0fff) | 0x1000).toString(16).padStart(4, '0')
  const clockSeq = (crypto.randomBytes(2).readUInt16BE(0) | 0x8000).toString(16).padStart(4, '0')
  const node = crypto.randomBytes(6).toString('hex')
  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`
}

function generateV4() {
  return crypto.randomUUID()
}

function generateV7() {
  const now = Date.now()
  const timeMs = now.toString(16).padStart(12, '0')
  const rand = crypto.randomBytes(10).toString('hex')
  const variant = ((parseInt(rand.slice(0, 1), 16) & 0x3) | 0x8).toString(16)
  return `${timeMs.slice(0, 8)}-${timeMs.slice(8, 12)}-7${rand.slice(1, 4)}-${variant}${rand.slice(4, 7)}-${rand.slice(7, 19)}`
}

function generateNil() {
  return '00000000-0000-0000-0000-000000000000'
}

function generateMax() {
  return 'ffffffff-ffff-ffff-ffff-ffffffffffff'
}

function generate(version) {
  switch (version) {
    case 'v1': return generateV1()
    case 'v4': return generateV4()
    case 'v7': return generateV7()
    case 'nil': return generateNil()
    case 'max': return generateMax()
    default: return generateV4()
  }
}

function buildVersionButtons(usedPrefix = '.') {
  return VERSIONS.map(v => ({
    name: 'quick_reply',
    params: { display_text: `${v.emoji} ${v.name}`, id: `${usedPrefix}uuid اصدار ${v.id}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    if (userVersion.size > 2000) userVersion.delete(userVersion.keys().next().value)

    const subCmd = args[0]?.toLowerCase()

    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const val = args.slice(1).join(' ').trim()
      if (!val) return m.reply('❌ لا توجد قيمة للنسخ')
      return m.reply(`📋 *تم النسخ:*\n\`${val}\``)
    }

    if (subCmd === 'اصدار' || subCmd === 'version' || subCmd === 'إصدار') {
      const ver = args[1]
      if (!ver) {
        return conn.sendMessage(m.chat, {
          text: '🆔 *اختر إصدار UUID:*',
          footer: 'LIGHT BOT • UUID Generator',
          buttons: buildVersionButtons(usedPrefix)
        }, { quoted: m })
      }
      const v = VERSIONS.find(x => x.id === ver)
      if (!v) return m.reply('❌ إصدار غير موجود')
      userVersion.set(m.sender, ver)
      return m.reply(`${v.emoji} *تم اختيار:* ${v.name}`)
    }

    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const v = VERSIONS.find(x => x.id === userVersion.get(m.sender)) || VERSIONS[1]
      return m.reply(`⚙️ *الإصدار الحالي:* ${v.emoji} ${v.name}`)
    }

    if (subCmd === 'كمية' || subCmd === 'count' || subCmd === 'عدد') {
      const count = Math.min(Math.max(parseInt(args[1]) || 1, 1), 50)
      const ver = userVersion.get(m.sender) || 'v4'
      const uuids = Array.from({ length: count }, () => generate(ver))
      await m.react('🆔')
      return m.reply(`🆔 *${count} UUID (${ver.toUpperCase()}):*\n\n` + uuids.map((u, i) => `${i + 1}. \`${u}\``).join('\n'))
    }

    if (subCmd === 'تحقق' || subCmd === 'validate' || subCmd === 'check') {
      const uuid = args[1] || text?.replace(/^(تحقق|validate|check)\s*/i, '').trim()
      if (!uuid) return m.reply('❌ أدخل UUID للتحقق')
      const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const valid = regex.test(uuid)
      const version = valid ? parseInt(uuid.charAt(14), 16) : null
      await m.react(valid ? '✅' : '❌')
      return m.reply(
        `${valid ? '✅' : '❌'} *${valid ? 'صحيح' : 'غير صحيح'}*\n` +
        `UUID: \`${uuid}\`\n` +
        `${valid ? `الإصدار: v${version}` : ''}`
      )
    }

    const ver = userVersion.get(m.sender) || 'v4'
    const uuid = generate(ver)
    const v = VERSIONS.find(x => x.id === ver)

    await m.react('🆔')
    return conn.sendMessage(m.chat, {
      text: `🆔 *UUID مُولد (${v?.name || 'v4'}):*\n\n\`${uuid}\``,
      footer: 'LIGHT BOT • UUID Generator',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🆔 آخر', id: `${usedPrefix}uuid` } },
        { name: 'quick_reply', params: { display_text: '📦 كمية (10)', id: `${usedPrefix}uuid كمية 10` } },
        { name: 'quick_reply', params: { display_text: '🔍 تحقق', id: `${usedPrefix}uuid تحقق ${uuid}` } },
        { name: 'quick_reply', params: { display_text: '📋 نسخ', id: `${usedPrefix}uuid نسخ ${uuid}` } }
      ],
      contextInfo: { mentionedJid: [m.sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('uuid:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['uuid', 'يوييد', 'معرّف', 'guid']
handler.usage = ['uuid', 'uuid اصدار <v1|v4|v7|nil|max>', 'uuid كمية <عدد>', 'uuid تحقق <uuid>', 'uuid إعدادات']
handler.category = 'tools'
export default handler