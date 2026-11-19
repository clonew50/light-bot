/*
  ═══════════════════════════════════════════
  📋 قوالب لوجو جاهزة — اختيارات سريعة
  الأمر: .logopreset / .قوالب_لوجو / .شعار_جاهز
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 5000

const PRESETS = {
  gaming: [
    { name: '🎮 فريق ألعاب', template: 'Gaming Team {name}', style: 'neon', emoji: '🎮' },
    { name: '👑 كلان/قروب', template: 'Clan {name}', style: 'luxury', emoji: '👑' },
    { name: '🎯 قناة يوتيوب', template: '{name} Gaming', style: 'gradient', emoji: '🎯' },
    { name: '⚔️ سيرفر Discord', template: '{name} Community', style: 'tech', emoji: '⚔️' },
  ],
  business: [
    { name: '🏢 شركة ناشئة', template: '{name} Inc.', style: 'minimal', emoji: '🏢' },
    { name: '💼 وكالة تسويق', template: '{name} Agency', style: 'gradient', emoji: '💼' },
    { name: '🛒 متجر إلكتروني', template: '{name} Store', style: '3d', emoji: '🛒' },
    { name: '💰 استشارات مالية', template: '{name} Capital', style: 'luxury', emoji: '💰' },
  ],
  personal: [
    { name: '👤 علامة شخصية', template: '{name}', style: 'handwritten', emoji: '👤' },
    { name: '🎨 فنان/مصمم', template: '{name} Art', style: 'gradient', emoji: '🎨' },
    { name: '📝 مدون/كاتب', template: '{name} Writes', style: 'minimal', emoji: '📝' },
    { name: '🎵 موسيقي', template: '{name} Music', style: 'neon', emoji: '🎵' },
  ],
  tech: [
    { name: '🤖 مشروع AI', template: '{name} AI', style: 'tech', emoji: '🤖' },
    { name: '💻 مطور/مبرمج', template: '{name} Dev', style: 'minimal', emoji: '💻' },
    { name: '🔧 أداة/بوت', template: '{name} Bot', style: '3d', emoji: '🔧' },
    { name: '☁️ خدمة سحابية', template: '{name} Cloud', style: 'gradient', emoji: '☁️' },
  ],
  fun: [
    { name: '😎 ميم/فكاهي', template: '{name} Memes', style: 'retro', emoji: '😎' },
    { name: '🌈 ملون/مرح', template: '{name} Fun', style: 'gradient', emoji: '🌈' },
    { name: '🎪 فعاليات', template: '{name} Events', style: 'neon', emoji: '🎪' },
    { name: '🎁 هدايا', template: '{name} Gifts', style: 'luxury', emoji: '🎁' },
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

    // عرض فئة
    if (subCmd && PRESETS[subCmd]) {
      const presets = PRESETS[subCmd]
      let msg = `📋 *قوالب ${subCmd.toUpperCase()}:*\\n\\n`
      presets.forEach((p, i) => {
        msg += `${p.emoji} *${p.name}*\\n`
        msg += `   القالب: \`${p.template}\`\\n`
        msg += `   النمط: ${p.style}\\n\\n`
      })
      msg += `الاستخدام: \`.logopreset ${subCmd} 1 "اسمك"\``
      return m.reply(msg)
    }

    // إنشاء من قالب
    if (subCmd && PRESETS[subCmd] && args[1]) {
      const presetIndex = parseInt(args[1]) - 1
      const name = args.slice(2).join(' ')

      if (presetIndex < 0 || presetIndex >= PRESETS[subCmd].length) {
        return m.reply('❌ رقم قالب غير صحيح')
      }
      if (!name) return m.reply('❌ اكتب الاسم: `.logopreset gaming 1 "فريق الأسطورة"`')

      const preset = PRESETS[subCmd][presetIndex]
      const finalText = preset.template.replace('{name}', name)

      cooldown.set(m.sender, now)

      // استدعاء أمر اللوجو الأساسي
      return m.reply(`✅ تم اختيار القالب: ${preset.emoji} ${preset.name}\\nالنص النهائي: ${finalText}\\n\\nالآن اكتب: \`.logo ${finalText}\` مع النمط ${preset.style}`)
    }

    // قائمة الفئات
    cooldown.set(m.sender, now)
    return conn.sendMessage(m.chat, {
      text: `📋 *قوالب اللوجو الجاهزة*\\n\\nاختر فئة:`,
      footer: 'LIGHT BOT • Logo Presets',
      buttons: Object.entries(PRESETS).map(([cat, presets]) => ({
        name: 'quick_reply',
        params: { display_text: `${presets[0].emoji} ${cat}`, id: `${usedPrefix}logopreset ${cat}` }
      }))
    }, { quoted: m })

  } catch (e) {
    console.error('logopreset:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['logopreset', 'قوالب_لوجو', 'شعار_جاهز', 'logo_preset']
handler.usage = ['logopreset', 'logopreset <gaming|business|personal|tech|fun>', 'logopreset <fئة> <رقم> "الاسم"']
handler.category = 'logos'
handler.cooldown = 5
export default handler