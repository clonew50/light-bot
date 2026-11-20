/*
  ═══════════════════════════════════════════
  🎰 ماكينة قمار — خطوط دفع، جوائز، عملة افتراضية
  الأمر: .slots / .سلوت / .قمار
  ═══════════════════════════════════════════
*/

const userBalance = new Map()
const userStats = new Map()

const SYMBOLS = [
  { emoji: '🍒', name: 'كرز', weight: 30, payout: { 2: 2, 3: 5 } },
  { emoji: '🍋', name: 'ليمون', weight: 25, payout: { 2: 3, 3: 8 } },
  { emoji: '🍊', name: 'برتقال', weight: 20, payout: { 2: 4, 3: 12 } },
  { emoji: '🍇', name: 'عنب', weight: 15, payout: { 2: 6, 3: 20 } },
  { emoji: '🔔', name: 'جرس', weight: 8, payout: { 2: 10, 3: 50 } },
  { emoji: '⭐', name: 'نجمة', weight: 5, payout: { 2: 20, 3: 100 } },
  { emoji: '💎', name: 'ماس', weight: 3, payout: { 2: 50, 3: 500 } },
  { emoji: '7️⃣', name: 'سبعة', weight: 2, payout: { 3: 1000 } }, // جاكبوت فقط 3
]

// بناء مصفوفة موزونة
const WEIGHTED = SYMBOLS.flatMap(s => Array(s.weight).fill(s))

function getBalance(sender) {
  if (!userBalance.has(sender)) userBalance.set(sender, 1000) // رصيد ابتدائي
  return userBalance.get(sender)
}

function setBalance(sender, amount) {
  userBalance.set(sender, Math.max(0, amount))
}

function getStats(sender) {
  if (!userStats.has(sender)) userStats.set(sender, { spins: 0, won: 0, lost: 0, biggestWin: 0, jackpots: 0 })
  return userStats.get(sender)
}

function formatStats(stats) {
  return (
    `📊 *إحصائياتك:*\n` +
    `🎰 دورات: ${stats.spins}\n` +
    `✅ فاز: ${stats.won} | ❌ خسر: ${stats.lost}\n` +
    `🏆 أكبر ربح: ${stats.biggestWin} | 🎁 جاكبوت: ${stats.jackpots}`
  )
}

function spin() {
  return [WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)], WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)], WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)]]
}

function checkWin(reels, bet) {
  const [r1, r2, r3] = reels
  let win = 0
  let winType = ''

  // ثلاثة متطابقين
  if (r1.emoji === r2.emoji && r2.emoji === r3.emoji) {
    const payout = r1.payout[3] || 0
    win = bet * payout
    winType = payout >= 500 ? '💰 **JACKPOT!**' : '🎉 **ثلاثة متطابقين!**'
  }
  // اثنان متطابقان (الأولان أو الأخيران)
  else if (r1.emoji === r2.emoji || r2.emoji === r3.emoji) {
    const pair = r1.emoji === r2.emoji ? r1 : r2
    const payout = pair.payout[2] || 0
    win = bet * payout
    winType = '✨ **زوج متطابق!**'
  }
  // رموز خاصة: جرس + جرس + أي = مكافأة صغيرة
  else if ((r1.emoji === '🔔' && r2.emoji === '🔔') || (r2.emoji === '🔔' && r3.emoji === '🔔')) {
    win = bet * 2
    winType = '🔔 **جرسين!**'
  }

  return { win, winType }
}

function formatReels(reels) {
  return `| ${reels[0].emoji} | ${reels[1].emoji} | ${reels[2].emoji} |`
}

function buildBetButtons(balance) {
  let bets = [10, 25, 50, 100, 250, 500].filter(b => b <= balance)
  if (bets.length === 0) bets = [10]
  return bets.map(b => ({
    name: 'quick_reply',
    params: { display_text: `💰 ${b}`, id: `.slots رهان ${b}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const balance = getBalance(sender)
    const stats = getStats(sender)
    for (const map of [userBalance, userStats]) {
      if (map.size > 2000) map.delete(map.keys().next().value)
    }

    // رصيد
    if (subCmd === 'رصيد' || subCmd === 'balance' || subCmd === 'فلوس') {
      return m.reply(`💰 *رصيدك:* ${balance} عملة\n\n${formatStats(stats)}`)
    }

    // إحصائيات
    if (subCmd === 'إحصائيات' || subCmd === 'stats') {
      return m.reply(
        `📊 *إحصائيات الكازينو:*\n` +
        `🎰 دورات: ${stats.spins}\n` +
        `✅ فاز: ${stats.won}\n` +
        `❌ خسر: ${stats.lost}\n` +
        `💰 أكبر ربح: ${stats.biggestWin}\n` +
        `🎁 جاكبوت: ${stats.jackpots}\n` +
        `💵 رصيد حالي: ${balance}`
      )
    }

    // ريست
    if (subCmd === 'ريست' || subCmd === 'reset') {
      userBalance.set(sender, 1000)
      userStats.set(sender, { spins: 0, won: 0, lost: 0, biggestWin: 0, jackpots: 0 })
      return m.reply('🔄 تم إعادة التعيين: 1000 عملة ابتدائية')
    }

    // مكافأة يومية
    if (subCmd === 'يومي' || subCmd === 'daily') {
      const bonus = 500
      setBalance(sender, balance + bonus)
      return m.reply(`🎁 *مكافأة يومية!*\n+${bonus} عملة\n💰 الرصيد الجديد: ${balance + bonus}`)
    }

    // اختيار الرهان
    if (subCmd === 'رهان' || subCmd === 'bet') {
      const amount = parseInt(args[1])
      if (!amount || amount < 10) return m.reply('❌ الحد الأدنى 10 عملات')
      if (amount > balance) return m.reply(`❌ رصيد غير كافي (${balance})`)
      return m.reply(`💰 *تم تعيين الرهان:* ${amount} عملة\nاضغط دور للعب`)
    }

    // دوران
    if (subCmd === 'دور' || subCmd === 'spin' || !subCmd) {
      const bet = args[1] ? parseInt(args[1]) : 50
      if (isNaN(bet) || bet < 10) return m.reply('❌ رهان غير صالح (الحد الأدنى 10)')
      if (bet > balance) return m.reply(`❌ رصيد غير كافي! رصيدك: ${balance} عملة`)


      // خصم الرهان
      setBalance(sender, balance - bet)
      stats.spins++

      // أنيميشن بسيطة
      await m.react('🎰')
      const anim = ['🎰 | 🔄 | 🔄 |', '🎰 | 🍒 | 🔄 |', '🎰 | 🍒 | 🍋 |']
      let msg = await conn.sendMessage(m.chat, { text: `🎰 *تدور...*\n\n${anim[0]}\n\n💰 الرهان: ${bet}` }, { quoted: m })
      await new Promise(r => setTimeout(r, 500))
      await conn.sendMessage(m.chat, { text: `🎰 *تدور...*\n\n${anim[1]}\n\n💰 الرهان: ${bet}` }, { quoted: m })
      await new Promise(r => setTimeout(r, 500))

      // نتيجة حقيقية
      const reels = spin()
      const { win, winType } = checkWin(reels, bet)

      // تحديث الرصيد والإحصائيات
      const newBalance = getBalance(sender) + win
      setBalance(sender, newBalance)
      if (win > 0) {
        stats.won++
        stats.biggestWin = Math.max(stats.biggestWin, win)
        if (winType.includes('JACKPOT')) stats.jackpots++
      } else {
        stats.lost++
      }

      const resultText = win > 0
        ? `${winType}\n💰 *ربحت:* ${win} عملة!`
        : '💥 *لم تفز هذه المرة*'

      await m.react(win > 0 ? '🎉' : '💥')

      return conn.sendMessage(m.chat, {
        text: `🎰 *النتيجة:*\n\n${formatReels(reels)}\n\n` +
          `${resultText}\n\n` +
          `💰 *الرصيد:* ${newBalance} عملة\n` +
          `🎯 *الرهان:* ${bet} | *العائد:* ${win > 0 ? '+' + win : '0'}`,
        footer: 'LIGHT BOT • Slots',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎰 دور مرة أخرى', id: `${usedPrefix}slots دور ${bet}` } },
          { name: 'quick_reply', params: { display_text: '💰 رصيد', id: `${usedPrefix}slots رصيد` } },
          { name: 'quick_reply', params: { display_text: '📊 إحصائيات', id: `${usedPrefix}slots إحصائيات` } },
          { name: 'quick_reply', params: { display_text: '🎁 يومي', id: `${usedPrefix}slots يومي` } }
        ],
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m })
    }

  } catch (e) {
    console.error('slots:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['slots', 'سلوت', 'قمار', 'كازينو', 'slot']
handler.usage = ['slots', 'slots دور [رهان]', 'slots رهان <مبلغ>', 'slots رصيد', 'slots إحصائيات', 'slots يومي', 'slots ريست']
handler.category = 'games'
handler.group = true
export default handler