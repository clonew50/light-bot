/*
  ═══════════════════════════════════════════
  🎁 مكافأة يومية — سلسلة، مكافآت متصاعدة
  الأمر: .daily / .يومي / .مكافأة
  ═══════════════════════════════════════════
*/

const DAILY_BASE = 500
const STREAK_BONUS = 50 // مكافأة إضافية لكل يوم متتالٍ
const MAX_STREAK_BONUS = 2000
const WEEKLY_BONUS_DAY = 7 // يوم 7 = مكافأة أسبوعية
const MONTHLY_BONUS_DAY = 30 // يوم 30 = مكافأة شهرية

const handler = async (m, { conn, text, args, usedPrefix, sender }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()

    // تهيئة قاعدة البيانات
    if (!global.db) global.db = { users: {} }
    if (!global.db.users[sender]) {
      global.db.users[sender] = { balance: 1000, bank: 0, xp: 0, cookies: 0, daily: { lastClaim: 0, streak: 0, totalClaimed: 0 } }
    }
    const user = global.db.users[sender]
    if (!user.daily) user.daily = { lastClaim: 0, streak: 0, totalClaimed: 0 }

    const lastClaim = user.daily.lastClaim || 0
    const streak = user.daily.streak || 0
    const isNewDay = now - lastClaim >= 86400000 // 24 ساعة
    const isSameDay = now - lastClaim < 86400000

    // عرض حالة اليومية
    if (subCmd === 'حالة' || subCmd === 'status' || subCmd === 'info') {
      const hoursLeft = isSameDay ? Math.ceil((86400000 - (now - lastClaim)) / 3600000) : 0
      return m.reply(
        `🎁 *حالة المكافأة اليومية:*\\n\\n` +
        `${isNewDay ? '✅ متاحة الآن!' : `⏳ متاحة خلال ${hoursLeft} ساعة`}\\n` +
        `🔥 *السلسلة الحالية:* ${streak} يوم${streak > 0 ? ' 🔥' : ''}\\n` +
        `📊 *إجمالي المستلم:* ${(user.daily.totalClaimed || 0).toLocaleString()} عملة\\n` +
        `💰 *المكافأة الأساسية:* ${DAILY_BASE} عملة\\n` +
        `📈 *مكافأة السلسلة:* +${Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS)} عملة/يوم\\n` +
        `🎉 *مكافأة أسبوعية (يوم 7):* +${DAILY_BASE * 2} عملة\\n` +
        `🏆 *مكافأة شهرية (يوم 30):* +${DAILY_BASE * 5} عملة`
      )
    }

    // مكافأة أسبوعية/شهرية
    if (subCmd === 'أسبوعية' || subCmd === 'weekly') {
      if (streak < 7) return m.reply(`❌ تحتاج 7 أيام متتالية للسلسلة الأسبوعية (الحالي: ${streak})`)
      // يمكن إضافة منطق المكافأة الأسبوعية هنا
      return m.reply('🎉 *مكافأة أسبوعية!* (الميزة قيد التطوير)')
    }

    if (subCmd === 'شهرية' || subCmd === 'monthly') {
      if (streak < 30) return m.reply(`❌ تحتاج 30 يوم متتالي للمكافأة الشهرية (الحالي: ${streak})`)
      return m.reply('🏆 *مكافأة شهرية!* (الميزة قيد التطوير)')
    }

    // استلام المكافأة
    if (!subCmd || subCmd === 'استلام' || subCmd === 'claim') {
      if (isSameDay) {
        const hoursLeft = Math.ceil((86400000 - (now - lastClaim)) / 3600000)
        return conn.sendMessage(m.chat, {
          text: `⏳ *المكافأة مستلمة بالفعل!*\\n\\n` +
            `🔄 متاحة خلال: ${hoursLeft} ساعة\\n` +
            `🔥 السلسلة الحالية: ${streak} يوم\\n` +
            `💰 رصيدك: ${user.balance.toLocaleString()} عملة`,
          footer: 'LIGHT BOT • Daily',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🎁 حالة', id: `${usedPrefix}daily حالة` } },
            { name: 'quick_reply', params: { display_text: '💰 رصيد', id: `${usedPrefix}profile` } }
          ]
        }, { quoted: m })
      }

      // حساب المكافأة
      const newStreak = isNewDay && lastClaim > 0 && (now - lastClaim < 172800000) ? streak + 1 : 1
      const streakBonus = Math.min(newStreak * STREAK_BONUS, MAX_STREAK_BONUS)
      let reward = DAILY_BASE + streakBonus
      let bonusText = ''

      // مكافآت خاصة
      if (newStreak % WEEKLY_BONUS_DAY === 0) {
        reward += DAILY_BASE * 2
        bonusText += `\\n🎉 *مكافأة أسبوعية:* +${(DAILY_BASE * 2).toLocaleString()} عملة!`
      }
      if (newStreak % MONTHLY_BONUS_DAY === 0) {
        reward += DAILY_BASE * 5
        bonusText += `\\n🏆 *مكافأة شهرية:* +${(DAILY_BASE * 5).toLocaleString()} عملة!`
      }

      // XP و Cookies إضافية
      const xpGain = 50 + Math.floor(newStreak / 2)
      const cookiesGain = Math.min(5, Math.floor(newStreak / 3))

      // تحديث البيانات
      user.balance += reward
      user.xp = (user.xp || 0) + xpGain
      user.cookies = (user.cookies || 0) + cookiesGain
      user.daily.lastClaim = now
      user.daily.streak = newStreak
      user.daily.totalClaimed = (user.daily.totalClaimed || 0) + reward

      await m.react('🎁')

      const streakEmoji = newStreak >= 30 ? '🏆' : newStreak >= 7 ? '🎉' : newStreak >= 3 ? '🔥' : '📅'
      await conn.sendMessage(m.chat, {
        text: `🎁 *تم استلام المكافأة اليومية!*\\n\\n` +
          `💰 *المكافأة:* +${reward.toLocaleString()} عملة\\n` +
          `📊 *التفصيل:* ${DAILY_BASE} (أساسية) + ${streakBonus.toLocaleString()} (سلسلة ${newStreak} يوم)${bonusText}\\n` +
          `✨ *XP:* +${xpGain} | 🍪 *كوكيز:* +${cookiesGain}\\n\\n` +
          `${streakEmoji} *السلسلة:* ${newStreak} يوم متتالي\\n` +
          `💵 *رصيدك الجديد:* ${user.balance.toLocaleString()} عملة`,
        footer: 'LIGHT BOT • Daily Reward',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎁 حالة', id: `${usedPrefix}daily حالة` } },
          { name: 'quick_reply', params: { display_text: '💰 رصيد', id: `${usedPrefix}profile` } },
          { name: 'quick_reply', params: { display_text: '🏦 بنكي', id: `${usedPrefix}bank` } }
        ],
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m })
      return
    }

    // ريست السلسلة (للاختبار)
    if (subCmd === 'ريست' || subCmd === 'reset') {
      user.daily.streak = 0
      user.daily.lastClaim = 0
      return m.reply('🔄 تم إعادة تعيين السلسلة اليومية')
    }

  } catch (e) {
    console.error('daily:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['daily', 'يومي', 'مكافأة', 'dailyreward']
handler.usage = ['daily', 'daily حالة', 'daily أسبوعية', 'daily شهرية', 'daily ريست']
handler.category = 'bank'
export default handler