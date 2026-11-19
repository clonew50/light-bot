/*
  ═══════════════════════════════════════════
  📿 مسبحة إلكترونية — أذكار بعداد تفاعلي
  الأمر: .tasbih / .مسبحة / .تسبيح
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 1000
const userTasbih = new Map()

const DHIKR = [
  { id: 'subhanallah', text: 'سبحان الله', count: 33, emoji: '📿', reward: 'غُرس له نخلة في الجنة' },
  { id: 'alhamdulillah', text: 'الحمد لله', count: 33, emoji: '📿', reward: 'تملأ الميزان' },
  { id: 'allahuakbar', text: 'الله أكبر', count: 34, emoji: '📿', reward: 'لا إله إلا الله' },
  { id: 'la_ilaha_illa_allah', text: 'لا إله إلا الله', count: 100, emoji: '💚', reward: 'أفضل الذكر' },
  { id: 'astaghfirullah', text: 'أستغفر الله', count: 100, emoji: '🤲', reward: 'مغفرة الذنوب' },
  { id: 'subhanallah_w_bihamdihi', text: 'سبحان الله وبحمده', count: 100, emoji: '🌿', reward: 'حطت خطاياه' },
  { id: 'la_hawla_wala_quwwata', text: 'لا حول ولا قوة إلا بالله', count: 100, emoji: '💪', reward: 'كنز من كنوز الجنة' },
  { id: 'salat_alan_nabi', text: 'اللهم صل على محمد', count: 10, emoji: '🌙', reward: 'عشر حسنات' },
]

function getUserTasbih(sender) {
  if (!userTasbih.has(sender)) {
    userTasbih.set(sender, { current: null, count: 0, total: 0, streak: 0 })
  }
  return userTasbih.get(sender)
}

function buildDhikrButtons() {
  return DHIKR.map(d => ({
    name: 'quick_reply',
    params: { display_text: `${d.emoji} ${d.text} (${d.count})`, id: `.tasbih ${d.id}` }
  }))
}

function buildCounterButtons(dhikrId) {
  return [
    { name: 'quick_reply', params: { display_text: '➕ +1', id: `.tasbih زيادة ${dhikrId}` } },
    { name: 'quick_reply', params: { display_text: '➖ -1', id: `.tasbih نقص ${dhikrId}` } },
    { name: 'quick_reply', params: { display_text: '🔄 ريست', id: `.tasbih ريست ${dhikrId}` } },
    { name: 'quick_reply', params: { display_text: '📊 إحصائيات', id: `.tasbih إحصائيات` } },
    { name: 'quick_reply', params: { display_text: '📿 تغيير', id: `.tasbih تغيير` } }
  ]
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const tasbih = getUserTasbih(m.sender)

    // اختيار ذكر
    if (DHIKR.some(d => d.id === subCmd)) {
      const dhikr = DHIKR.find(d => d.id === subCmd)
      tasbih.current = subCmd
      tasbih.count = 0
      userTasbih.set(m.sender, tasbih)
      cooldown.set(m.sender, now)
      return conn.sendMessage(m.chat, {
        text: `${dhikr.emoji} *${dhikr.text}*\\n\\n` +
          `🎯 *الهدف:* ${dhikr.count}\\n` +
          `📊 *العداد:* ${tasbih.count}/${dhikr.count}\\n` +
          `💎 *الثواب:* ${dhikr.reward}\\n\\n` +
          `اضغط الأزرار للعد:`,
        footer: 'LIGHT BOT • Tasbih',
        buttons: buildCounterButtons(subCmd)
      }, { quoted: m })
    }

    // زيادة
    if (subCmd === 'زيادة' || subCmd === 'up' || subCmd === 'increment') {
      const dhikrId = args[1] || tasbih.current
      if (!dhikrId) return m.reply('❌ اختر ذكراً أولاً')
      const dhikr = DHIKR.find(d => d.id === dhikrId)
      if (!dhikr) return m.reply('❌ ذكر غير موجود')
      tasbih.count++
      tasbih.total++
      userTasbih.set(m.sender, tasbih)
      const progress = Math.min(100, Math.round((tasbih.count / dhikr.count) * 100))
      const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10))
      cooldown.set(m.sender, now)
      return conn.sendMessage(m.chat, {
        text: `${dhikr.emoji} *${dhikr.text}*\\n\\n` +
          `📊 ${tasbih.count}/${dhikr.count} (${progress}%)\\n` +
          `\`${bar}\`\\n\\n` +
          `${tasbih.count >= dhikr.count ? '🎉 *أكملت الذكر!*' : 'استمر...'}`,
        footer: 'LIGHT BOT • Tasbih',
        buttons: buildCounterButtons(dhikrId)
      }, { quoted: m })
    }

    // نقص
    if (subCmd === 'نقص' || subCmd === 'down' || subCmd === 'decrement') {
      const dhikrId = args[1] || tasbih.current
      if (!dhikrId) return m.reply('❌ اختر ذكراً أولاً')
      if (tasbih.count > 0) {
        tasbih.count--
        userTasbih.set(m.sender, tasbih)
      }
      const dhikr = DHIKR.find(d => d.id === dhikrId)
      const progress = Math.min(100, Math.round((tasbih.count / dhikr.count) * 100))
      const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10))
      cooldown.set(m.sender, now)
      return conn.sendMessage(m.chat, {
        text: `${dhikr.emoji} *${dhikr.text}*\\n\\n` +
          `📊 ${tasbih.count}/${dhikr.count} (${progress}%)\\n` +
          `\`${bar}\``,
        footer: 'LIGHT BOT • Tasbih',
        buttons: buildCounterButtons(dhikrId)
      }, { quoted: m })
    }

    // ريست
    if (subCmd === 'ريست' || subCmd === 'reset') {
      const dhikrId = args[1] || tasbih.current
      tasbih.count = 0
      userTasbih.set(m.sender, tasbih)
      if (dhikrId) {
        const dhikr = DHIKR.find(d => d.id === dhikrId)
        return conn.sendMessage(m.chat, {
          text: `${dhikr.emoji} *${dhikr.text}*\\n\\n🔄 *تم إعادة العداد إلى الصفر*`,
          footer: 'LIGHT BOT • Tasbih',
          buttons: buildCounterButtons(dhikrId)
        }, { quoted: m })
      }
      return m.reply('🔄 تم إعادة جميع العدادات')
    }

    // إحصائيات
    if (subCmd === 'إحصائيات' || subCmd === 'stats') {
      return m.reply(
        `📊 *إحصائيات المسبحة:*\\n\\n` +
        `📿 الإجمالي: ${tasbih.total} تسبيحة\\n` +
        `🔥 السلسلة: ${tasbih.streak} يوم\\n` +
        `📌 الحالي: ${tasbih.current ? DHIKR.find(d => d.id === tasbih.current)?.text : '—'}\\n` +
        `🔢 العداد: ${tasbih.count}`
      )
    }

    // تغيير الذكر
    if (subCmd === 'تغيير' || subCmd === 'change' || subCmd === 'switch') {
      cooldown.set(m.sender, now)
      return conn.sendMessage(m.chat, {
        text: '📿 *اختر الذكر:*',
        footer: 'LIGHT BOT • Tasbih',
        buttons: buildDhikrButtons()
      }, { quoted: m })
    }

    // قائمة رئيسية
    cooldown.set(m.sender, now)
    return conn.sendMessage(m.chat, {
      text: `📿 *المسبحة الإلكترونية*\\n\\n` +
        `اختر ذكراً للبدء:\\n` +
        `${tasbih.current ? `📌 الحالي: ${DHIKR.find(d => d.id === tasbih.current)?.text} (${tasbih.count})` : 'لا يوجد ذكر محدد'}`,
      footer: 'LIGHT BOT • Tasbih',
      buttons: buildDhikrButtons().slice(0, 6)
    }, { quoted: m })

  } catch (e) {
    console.error('tasbih:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['tasbih', 'مسبحة', 'تسبيح', 'dhikr']
handler.usage = ['tasbih', 'tasbih <ذكر>', 'tasbih زيادة', 'tasbih نقص', 'tasbih ريست', 'tasbih إحصائيات', 'tasbih تغيير']
handler.category = 'islamic'
handler.cooldown = 1
export default handler