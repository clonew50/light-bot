/*
  ═══════════════════════════════════════════
  🪙 رمي عملة — إحصائيات، أفضل N تفاعلي
  الأمر: .coin / .عملة / .flip
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 2000
const userStats = new Map()

function getStats(sender) {
  if (!userStats.has(sender)) {
    userStats.set(sender, { heads: 0, tails: 0, total: 0, streak: 0, maxStreak: 0, lastResult: null })
  }
  return userStats.get(sender)
}

function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

function formatStats(stats) {
  const pct = stats.total > 0 ? ((stats.heads / stats.total) * 100).toFixed(1) : '0.0'
  return `📊 *إحصائياتك:*\n` +
    `🦅 رأس: ${stats.heads} (${pct}%)\n` +
    `🦅 ذيل: ${stats.tails} (${(100 - pct).toFixed(1)}%)\n` +
    `🔄 إجمالي: ${stats.total}\n` +
    `🔥 *سلسلة حالية:* ${stats.streak}\n` +
    `🏆 *أعلى سلسلة:* ${stats.maxStreak}`
}

function buildButtons() {
  return [
    { name: 'quick_reply', params: { display_text: '🪙 رمي مرة', id: '.coin' } },
    { name: 'quick_reply', params: { display_text: '🔁 أفضل 3', id: '.coin أفضل 3' } },
    { name: 'quick_reply', params: { display_text: '🔁 أفضل 5', id: '.coin أفضل 5' } },
    { name: 'quick_reply', params: { display_text: '📊 إحصائيات', id: '.coin إحصائيات' } },
    { name: 'quick_reply', params: { display_text: '🔄 ريست', id: '.coin ريست' } }
  ]
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const stats = getStats(sender)
    const last = cooldown.get(sender) || 0

    // إحصائيات
    if (subCmd === 'إحصائيات' || subCmd === 'stats' || subCmd === 'احصائيات') {
      return m.reply(formatStats(stats))
    }

    // ريست
    if (subCmd === 'ريست' || subCmd === 'reset' || subCmd === 'مسح') {
      userStats.set(sender, { heads: 0, tails: 0, total: 0, streak: 0, maxStreak: 0, lastResult: null })
      return m.reply('🔄 تم إعادة تعيين الإحصائيات')
    }

    // أفضل N
    if (subCmd === 'أفضل' || subCmd === 'best' || subCmd === 'bo') {
      const n = parseInt(args[1]) || 3
      if (n < 2 || n > 10) return m.reply('❌ عدد الجولات 2-10')

      if (now - last < COOLDOWN_MS * 2) {
        return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS * 2 - (now - last)) / 1000)} ثانية`)
      }
      cooldown.set(sender, now)

      let heads = 0, tails = 0
      const results = []
      for (let i = 0; i < n; i++) {
        const result = flipCoin()
        results.push(result === 'heads' ? '🦅' : '🦅')
        if (result === 'heads') heads++
        else tails++
      }

      const winner = heads > tails ? 'رأس 🦅' : tails > heads ? 'ذيل 🦅' : 'تعادل 🤝'
      await m.react(heads > tails ? '🦅' : '🦅')

      return m.reply(
        `🪙 *أفضل ${n} رمية:*\n\n` +
        results.map((r, i) => `${i + 1}. ${r}`).join(' ') + `\n\n` +
        `🦅 رأس: ${heads} | 🦅 ذيل: ${tails}\n` +
        `🏆 *النتيجة:* ${winner}`
      )
    }

    // رمية واحدة (افتراضي)
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }
    cooldown.set(sender, now)

    const result = flipCoin()
    const isHeads = result === 'heads'

    // تحديث الإحصائيات
    stats.total++
    if (isHeads) stats.heads++
    else stats.tails++

    // تحديث السلسلة
    if (stats.lastResult === result) {
      stats.streak++
    } else {
      stats.streak = 1
    }
    stats.lastResult = result
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)

    await m.react(isHeads ? '🦅' : '🦅')

    return conn.sendMessage(m.chat, {
      text: `🪙 *رمي عملة:*\n\n${isHeads ? '🦅 **رأس (Head)**' : '🦅 **ذيل (Tail)**'}\n\n` +
        `${formatStats(stats)}\n\n` +
        `🔥 *سلسلة ${result === stats.lastResult ? 'مستمرة' : 'جديدة'}:* ${stats.streak}`,
      footer: 'LIGHT BOT • Coin Flip',
      buttons: buildButtons(),
      contextInfo: { mentionedJid: [sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('coin:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['coin', 'عملة', 'flip', 'رمي']
handler.usage = ['coin', 'coin أفضل 3', 'coin أفضل 5', 'coin إحصائيات', 'coin ريست']
handler.category = 'games'
handler.cooldown = 2
export default handler