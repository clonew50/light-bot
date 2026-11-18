/*
  ═══════════════════════════════════════════
  🔐 مولد كلمة مرور قوية — تفاعلي كامل
  الأمر: .باسورد / .password / .passgen
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 3000
const userPrefs = new Map()

const STRENGTHS = [
  { min: 25, label: '🔒 قوي جداً', emoji: '🔒' },
  { min: 20, label: '🔐 قوي', emoji: '🔐' },
  { min: 16, label: '🔓 متوسط', emoji: '🔓' },
  { min: 12, label: '⚠️ ضعيف', emoji: '⚠️' },
  { min: 0, label: '❌ جداً ضعيف', emoji: '❌' },
]

function getStrength(len, hasSymbols, hasUpper, hasLower, hasDigits) {
  let score = len
  if (hasSymbols) score += 5
  if (hasUpper) score += 3
  if (hasLower) score += 2
  if (hasDigits) score += 2
  return STRENGTHS.find(s => score >= s.min) || STRENGTHS[STRENGTHS.length - 1]
}

function generatePassword(len, options) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const symbols = '!@#$%^&*_-+='
  const ambiguous = 'il1Lo0O'

  let pool = ''
  let guaranteed = ''

  if (options.upper) { pool += upper; guaranteed += upper[Math.floor(Math.random() * upper.length)] }
  if (options.lower) { pool += lower; guaranteed += lower[Math.floor(Math.random() * lower.length)] }
  if (options.digits) { pool += digits; guaranteed += digits[Math.floor(Math.random() * digits.length)] }
  if (options.symbols) { pool += symbols; guaranteed += symbols[Math.floor(Math.random() * symbols.length)] }

  if (options.excludeAmbiguous) {
    pool = pool.split('').filter(c => !ambiguous.includes(c)).join('')
  }

  if (!pool) pool = lower + upper + digits

  let pwd = guaranteed
  for (let i = pwd.length; i < len; i++) {
    pwd += pool[Math.floor(Math.random() * pool.length)]
  }

  // خلط فيشر-ياتس
  pwd = pwd.split('').sort(() => Math.random() - 0.5).join('')

  return pwd
}

function buildMainButtons() {
  return [
    { name: 'quick_reply', params: { display_text: '🔐 توليد', id: '.باسورد توليد' } },
    { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: '.باسورد إعدادات' } },
    { name: 'quick_reply', params: { display_text: '📋 آخر مولد', id: '.باسورد آخر' } }
  ]
}

function buildSettingsButtons(prefs) {
  return [
    { name: 'quick_reply', params: { display_text: `${prefs.symbols ? '✅' : '❌'} رموز`, id: '.باسورد تبديل symbols' } },
    { name: 'quick_reply', params: { display_text: `${prefs.upper ? '✅' : '❌'} حروف كبيرة`, id: '.باسورد تبديل upper' } },
    { name: 'quick_reply', params: { display_text: `${prefs.lower ? '✅' : '❌'} حروف صغيرة`, id: '.باسورد تبديل lower' } },
    { name: 'quick_reply', params: { display_text: `${prefs.digits ? '✅' : '❌'} أرقام`, id: '.باسورد تبديل digits' } },
    { name: 'quick_reply', params: { display_text: `${prefs.excludeAmbiguous ? '✅' : '❌'} استبعاد غامض`, id: '.باسورد تبديل excludeAmbiguous' } },
    { name: 'quick_reply', params: { display_text: `📏 طول: ${prefs.length}`, id: '.باسورد طول' } }
  ]
}

function buildLengthButtons() {
  return [
    { name: 'quick_reply', params: { display_text: '12', id: '.باسورد طول 12' } },
    { name: 'quick_reply', params: { display_text: '16', id: '.باسورد طول 16' } },
    { name: 'quick_reply', params: { display_text: '20', id: '.باسورد طول 20' } },
    { name: 'quick_reply', params: { display_text: '25', id: '.باسورد طول 25' } },
    { name: 'quick_reply', params: { display_text: '32', id: '.باسورد طول 32' } },
    { name: 'quick_reply', params: { display_text: 'مخصص', id: '.باسورد طول مخصص' } }
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
    const prefs = userPrefs.get(m.sender) || {
      length: 16,
      symbols: true,
      upper: true,
      lower: true,
      digits: true,
      excludeAmbiguous: false
    }

    // تبديل خيار
    if (subCmd === 'تبديل' || subCmd === 'toggle') {
      const key = args[1]
      if (!key || !(key in prefs)) {
        return conn.sendMessage(m.chat, {
          text: '⚙️ *اختر خياراً للتبديل:*',
          footer: 'LIGHT BOT • Password Generator',
          buttons: buildSettingsButtons(prefs)
        }, { quoted: m })
      }
      prefs[key] = !prefs[key]
      // التأكد من وجود مجموعة حروف واحدة على الأقل
      if (key !== 'length' && key !== 'excludeAmbiguous') {
        const charOptions = ['upper', 'lower', 'digits', 'symbols']
        if (!charOptions.some(k => prefs[k])) {
          prefs[key] = true
          return m.reply('❌ يجب تفعيل مجموعة حروف واحدة على الأقل')
        }
      }
      userPrefs.set(m.sender, prefs)
      return m.reply(`${prefs[key] ? '✅' : '❌'} *تم ${prefs[key] ? 'تفعيل' : 'إيقاف'}:* ${key}`)
    }

    // تعيين الطول
    if (subCmd === 'طول' || subCmd === 'length') {
      const len = args[1]
      if (!len) {
        return conn.sendMessage(m.chat, {
          text: '📏 *اختر طول كلمة المرور:*',
          footer: 'LIGHT BOT • Password Generator',
          buttons: buildLengthButtons()
        }, { quoted: m })
      }
      if (len === 'مخصص' || len === 'custom') {
        return m.reply('✍️ اكتب الطول: `.باسورد طول 24` (8-64)')
      }
      const parsed = parseInt(len)
      if (isNaN(parsed) || parsed < 8 || parsed > 64) {
        return m.reply('❌ الطول يجب أن يكون بين 8 و 64')
      }
      prefs.length = parsed
      userPrefs.set(m.sender, prefs)
      return m.reply(`📏 *تم تعيين الطول:* ${parsed}`)
    }

    // الإعدادات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const strength = getStrength(prefs.length, prefs.symbols, prefs.upper, prefs.lower, prefs.digits)
      return m.reply(
        `⚙️ *إعدادات التوليد الحالية:*\n\n` +
        `📏 *الطول:* ${prefs.length}\n` +
        `${prefs.symbols ? '✅' : '❌'} *رموز خاصة* (!@#$%^&*_-+=)\n` +
        `${prefs.upper ? '✅' : '❌'} *حروف كبيرة* (A-Z)\n` +
        `${prefs.lower ? '✅' : '❌'} *حروف صغيرة* (a-z)\n` +
        `${prefs.digits ? '✅' : '❌'} *أرقام* (0-9)\n` +
        `${prefs.excludeAmbiguous ? '✅' : '❌'} *استبعاد غامض* (il1Lo0O)\n\n` +
        `${strength.emoji} *القوة المتوقعة:* ${strength.label}`
      )
    }

    // آخر مولد
    if (subCmd === 'آخر' || subCmd === 'last') {
      const lastPwd = userPrefs.get(m.sender + '_last')
      if (!lastPwd) return m.reply('📭 لا توجد كلمة مرور سابقة')
      const strength = getStrength(lastPwd.length, /[!@#$%^&*_\-+=]/.test(lastPwd), /[A-Z]/.test(lastPwd), /[a-z]/.test(lastPwd), /[0-9]/.test(lastPwd))
      return m.reply(
        `📋 *آخر كلمة مرور مولدة:*\n\n` +
        `\`${lastPwd}\`\n\n` +
        `${strength.emoji} ${strength.label}\n` +
        `⚠️ *لا تشاركها مع أحد*`
      )
    }

    // توليد
    if (subCmd === 'توليد' || subCmd === 'generate' || subCmd === 'create' || !subCmd) {
      const strength = getStrength(prefs.length, prefs.symbols, prefs.upper, prefs.lower, prefs.digits)
      const pwd = generatePassword(prefs.length, prefs)
      userPrefs.set(m.sender + '_last', pwd)
      userPrefs.set(m.sender, prefs)
      cooldown.set(m.sender, now)
      await m.react('🔐')

      return conn.sendMessage(m.chat, {
        text: `🔐 *كلمة مرور جديدة مولدة:*\n\n` +
          `\`${pwd}\`\n\n` +
          `📏 *الطول:* ${prefs.length} حرف\n` +
          `${strength.emoji} *القوة:* ${strength.label}\n\n` +
          `⚠️ *لا تشاركها مع أحد، احفظها بأمان*`,
        footer: 'LIGHT BOT • Password Generator',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🔐 توليد أخرى', id: `${usedPrefix}باسورد توليد` } },
          { name: 'quick_reply', params: { display_text: '📋 نسخ', id: `${usedPrefix}باسورد نسخ ${pwd}` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}باسورد إعدادات` } },
          { name: 'quick_reply', params: { display_text: '🔄 طول آخر', id: `${usedPrefix}باسورد طول` } }
        ],
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })
    }

    // نسخ
    if (subCmd === 'نسخ' || subCmd === 'copy') {
      const value = args.slice(1).join(' ')
      if (!value) return m.reply('❌ لا توجد قيمة')
      return m.reply(`📋 *تم النسخ:*\n\`${value}\`\n\n(اضغط مطولاً للنسخ)`)
    }

    // قائمة رئيسية
    const strength = getStrength(prefs.length, prefs.symbols, prefs.upper, prefs.lower, prefs.digits)
    cooldown.set(m.sender, now)
    return conn.sendMessage(m.chat, {
      text: `🔐 *مولد كلمة مرور قوية*\n\n` +
        `الإعدادات الحالية: ${prefs.length} حرف • ${strength.emoji} ${strength.label}`,
      footer: 'LIGHT BOT • Password Generator',
      buttons: buildMainButtons()
    }, { quoted: m })

  } catch (e) {
    console.error('password:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['باسورد', 'password', 'passgen', 'كلمةمرور']
handler.usage = ['باسورد', 'باسورد توليد', 'باسورد إعدادات', 'باسورد طول <8-64>', 'باسورد تبديل <symbols|upper|lower|digits|excludeAmbiguous>']
handler.category = 'tools'
handler.cooldown = 3
export default handler