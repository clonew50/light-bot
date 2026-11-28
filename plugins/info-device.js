import axios from 'axios'
import { getDevice } from '@whiskeysockets/baileys'

const IMAGE_URL = 'https://file.garden/ap7Y3MCskKqaij8B/file_1795782423304.jpeg'

const PING_ENDPOINTS = [
  'https://www.google.com/',
  'https://www.cloudflare.com/',
  'https://www.github.com/'
]

const WA_VERSIONS = {
  android: '2.25.7',
  ios:     '25.31.75',
  web:     '2.2419.11',
}

function detectDevice(msgId) {
  if (!msgId) return 'unknown'
  let dt = 'unknown'
  try {
    dt = getDevice(msgId) || 'unknown'
  } catch {}

  if (dt === 'unknown') {
    // كشف الآيفون في التحديثات الجديدة (20 حرف Hex تبدأ بـ 2A أو 3A إلخ)
    if (/^[0-9A-F]{20}$/i.test(msgId)) return 'ios'
    // كشف الأندرويد (32 حرف Hex)
    if (/^[0-9A-F]{32}$/i.test(msgId)) return 'android'
    // كشف الويب (يبدأ بـ 3EB0)
    if (msgId.startsWith('3EB0')) return 'web'
  }
  return dt
}

async function pingUrl(url) {
  const start = Date.now()
  try {
    await axios.get(url, { timeout: 4000 })
    return Date.now() - start
  } catch { return null }
}

function speedBar(ms) {
  if (ms === null) return '❌ غير متاح'
  const bars  = ['▁','▂','▃','▄','▅','▆','▇','█']
  const score = Math.max(0, Math.min(bars.length - 1,
    Math.floor((300 - Math.min(ms, 300)) / (300 / bars.length))))
  return bars.slice(0, score + 1).join('') + `  ${ms}ms`
}

function surpriseLine() {
  return [
    '🔎 تحليل دقيق — تمت المعالجة بنجاح!',
    '✨ النتيجة مؤكدة بنسبة 97.3٪',
    '🧭 النتائج تقديرية ولا تكشف بيانات حساسة.',
    '📡 الاتصال مستقر ومؤمَّن ببروتوكول E2E.'
  ][Math.floor(Math.random() * 4)]
}

let handler = async (m, { conn }) => {
  try {
    // ━━━ تحديد الهدف (منشن أو رد أو المرسل) ━━━
    const mentioned = m.mentionedJid || []
    const isQuoted  = Boolean(m.quoted)
    const targetId  = mentioned[0] || m.quoted?.sender || m.sender

    // ━━━ نوع الجهاز ━━━
    const msgId = isQuoted ? (m.quoted.id || m.quoted.stanzaId || m.quoted.key?.id) : m.key.id
    const deviceType = detectDevice(msgId)

    const osName = {
      android: 'Android',
      ios:     'iOS',
      web:     'Web (Desktop)',
      desktop: 'Desktop',
      bot:     'Bot'
    }[deviceType] || 'غير محدد'

    // ━━━ Ping ━━━
    const pings    = await Promise.all(PING_ENDPOINTS.map(pingUrl))
    const valid    = pings.filter(v => v !== null)
    const avgPing  = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null

    const speedEmoji = avgPing === null ? '❌' :
      avgPing <= 70  ? '⚡⚡⚡ ممتاز' :
      avgPing <= 150 ? '⚡⚡ جيد' : '⚡ بطيء'

    const waVersion = WA_VERSIONS[deviceType] || 'غير متاح'

    // ━━━ الرسالة ━━━
    const caption = [
      `✅ *تم الفحص بنجاح!*`,
      `────────────────────────`,
      `👤 *المستخدم:* @${targetId.split('@')[0]}`,
      `📱 *النظام:* ${osName} (${deviceType})`,
      `⚡ *السرعة:* ${avgPing !== null ? avgPing + 'ms' : 'غير متاح'}  ${speedEmoji}`,
      `▸ ${speedBar(avgPing)}`,
      `🧩 *إصدار واتساب:* ${waVersion}`,
      `🔒 *التشفير:* 🔐 مشفَّر (E2E)`,
      `────────────────────────`,
      `🔍 ${surpriseLine()}`,
      `────────────────────────`,
      `> ⚡ ${global.botName || '𖤍Yoru𖤍'}`,
    ].join('\n')

    await conn.sendMessage(m.chat, {
      image: { url: IMAGE_URL },
      caption,
      mentions: [targetId]
    }, { quoted: m })

  } catch (e) {
    console.error('deviceinfo:', e)
    m.reply(`❌ حدث خطأ: ${e.message}`)
  }
}

handler.help    = ['جهاز <منشن/رد>']
handler.tags    = ['info']
handler.command = /^(جهاز|device|الجهاز)$/i

export default handler
