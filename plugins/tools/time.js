/*
  ═══════════════════════════════════════════
  🕐 محول مناطق زمنية — قائمة تفاعلية
  الأمر: .time / .وقت / .توقيت <منطقة>
  ═══════════════════════════════════════════
*/
import { pruneCooldown } from '../../system/cooldowns.js'

const TIMEZONES = [
  { id: 'UTC', name: '🌍 UTC', offset: 0, cities: ['غرينتش', 'لندن (شتاء)'] },
  { id: 'GMT', name: '🇬🇧 GMT', offset: 0, cities: ['لندن'] },
  { id: 'Europe/London', name: '🇬🇧 لندن', offset: 'auto', cities: ['لندن'] },
  { id: 'Europe/Paris', name: '🇫🇷 باريس', offset: 'auto', cities: ['باريس', 'برلين', 'روما', 'مدريد'] },
  { id: 'Europe/Moscow', name: '🇷🇺 موسكو', offset: 3, cities: ['موسكو', 'سانت بطرسبرغ'] },
  { id: 'Asia/Dubai', name: '🇦🇪 دبي', offset: 4, cities: ['دبي', 'أبوظبي', 'مسقط'] },
  { id: 'Asia/Riyadh', name: '🇸🇦 الرياض', offset: 3, cities: ['الرياض', 'جدة', 'مكة', 'المدينة'] },
  { id: 'Asia/Kuwait', name: '🇰🇼 الكويت', offset: 3, cities: ['الكويت'] },
  { id: 'Asia/Qatar', name: '🇶🇦 الدوحة', offset: 3, cities: ['الدوحة'] },
  { id: 'Asia/Bahrain', name: '🇧🇭 المنامة', offset: 3, cities: ['المنامة'] },
  { id: 'Asia/Tehran', name: '🇮🇷 طهران', offset: 'auto', cities: ['طهران'] },
  { id: 'Asia/Karachi', name: '🇵🇰 كراتشي', offset: 5, cities: ['كراتشي', 'إسلام آباد'] },
  { id: 'Asia/Kolkata', name: '🇮🇳 نيودلهي', offset: 5.5, cities: ['مومباي', 'نيودلهي', 'بنغالور'] },
  { id: 'Asia/Dhaka', name: '🇧🇩 دكا', offset: 6, cities: ['دكا'] },
  { id: 'Asia/Bangkok', name: '🇹🇭 بانكوك', offset: 7, cities: ['بانكوك', 'هانوي', 'جاكرتا'] },
  { id: 'Asia/Singapore', name: '🇸🇬 سنغافورة', offset: 8, cities: ['سنغافورة', 'كوالالمبور', 'مانيلا'] },
  { id: 'Asia/Shanghai', name: '🇨🇳 بكين', offset: 8, cities: ['بكين', 'شنغهاي', 'هونغ كونغ', 'تايبيه'] },
  { id: 'Asia/Tokyo', name: '🇯🇵 طوكيو', offset: 9, cities: ['طوكيو', 'سيول'] },
  { id: 'Asia/Seoul', name: '🇰🇷 سيول', offset: 9, cities: ['سيول'] },
  { id: 'Australia/Sydney', name: '🇦🇺 سيدني', offset: 'auto', cities: ['سيدني', 'ملبورن'] },
  { id: 'Pacific/Auckland', name: '🇳🇿 أوكلاند', offset: 'auto', cities: ['أوكلاند', 'ويلينغتون'] },
  { id: 'America/New_York', name: '🇺🇸 نيويورك', offset: 'auto', cities: ['نيويورك', 'تورنتو', 'مونتريال'] },
  { id: 'America/Chicago', name: '🇺🇸 شيكاغو', offset: 'auto', cities: ['شيكاغو', 'دالاس', 'هيوستن'] },
  { id: 'America/Denver', name: '🇺🇸 دنفر', offset: 'auto', cities: ['دنفر', 'فينيكس'] },
  { id: 'America/Los_Angeles', name: '🇺🇸 لوس أنجلوس', offset: 'auto', cities: ['لوس أنجلوس', 'سان فرانسيسكو', 'سياتل'] },
  { id: 'America/Sao_Paulo', name: '🇧🇷 ساو باولو', offset: 'auto', cities: ['ساو باولو', 'ريو دي جانيرو'] },
  { id: 'America/Argentina/Buenos_Aires', name: '🇦🇷 بوينس آيرس', offset: -3, cities: ['بوينس آيرس'] },
  { id: 'Africa/Cairo', name: '🇪🇬 القاهرة', offset: 2, cities: ['القاهرة', 'الإسكندرية'] },
  { id: 'Africa/Johannesburg', name: '🇿🇦 جوهانسبرغ', offset: 2, cities: ['جوهانسبرغ', 'كيب تاون'] },
  { id: 'Africa/Lagos', name: '🇳🇬 لاغوس', offset: 1, cities: ['لاغوس'] },
]

const FORMATS = [
  { id: 'full', name: '📅 كامل' },
  { id: 'short', name: '📝 قصير' },
  { id: 'time', name: '🕐 وقت فقط' },
  { id: 'iso', name: '📋 ISO 8601' },
  { id: 'relative', name: '⏱️ نسبي' },
]

const cooldown = new Map()
const COOLDOWN_MS = 3000
const userFrom = new Map()
const userTo = new Map()
const userFormat = new Map()

function buildTzList(direction = 'من', usedPrefix = '.') {
  return TIMEZONES.map(t => ({
    title: `${t.name}`,
    description: t.cities.join('، '),
    id: `${usedPrefix}time ${direction} ${t.id}`
  }))
}

function formatTime(date, tz, format) {
  try {
    const opts = { timeZone: tz }
    switch (format) {
      case 'full':
        opts.weekday = 'long'; opts.year = 'numeric'; opts.month = 'long'; opts.day = 'numeric'
        opts.hour = '2-digit'; opts.minute = '2-digit'; opts.second = '2-digit'; opts.hour12 = true
        break
      case 'short':
        opts.year = 'numeric'; opts.month = '2-digit'; opts.day = '2-digit'
        opts.hour = '2-digit'; opts.minute = '2-digit'; opts.hour12 = true
        break
      case 'time':
        opts.hour = '2-digit'; opts.minute = '2-digit'; opts.second = '2-digit'; opts.hour12 = true
        break
      case 'iso':
        return date.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T')
      case 'relative': {
        const diff = Math.round((Date.now() - date.getTime()) / 1000)
        if (diff < 60) return `منذ ${diff} ثانية`
        if (diff < 3600) return `منذ ${Math.round(diff / 60)} دقيقة`
        if (diff < 86400) return `منذ ${Math.round(diff / 3600)} ساعة`
        return `منذ ${Math.round(diff / 86400)} يوم`
      }
    }
    return date.toLocaleString('ar-EG', opts)
  } catch {
    return 'خطأ في التنسيق'
  }
}

function getOffsetString(tz) {
  const tzData = TIMEZONES.find(x => x.id === tz)
  if (!tzData) return ''
  if (tzData.offset === 'auto') return '(توقيت صيفي/شتوي)'
  const sign = tzData.offset >= 0 ? '+' : ''
  return `UTC${sign}${tzData.offset}`
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }
    pruneCooldown(cooldown, COOLDOWN_MS)
    for (const map of [userFrom, userTo, userFormat]) {
      if (map.size > 2000) map.delete(map.keys().next().value)
    }

    const subCmd = args[0]?.toLowerCase()

    if (subCmd === 'من' || subCmd === 'from') {
      const tz = args[1]
      if (!tz) {
        const sections = [{ title: '🌍 اختر المنطقة المصدر', rows: buildTzList('من', usedPrefix) }]
        return conn.sendMessage(m.chat, {
          text: '🌍 *اختر المنطقة الزمنية المصدر:*',
          footer: 'LIGHT BOT • Time Converter',
          buttons: [{ name: 'single_select', params: { title: 'المناطق', sections } }],
          mentions: [m.sender]
        }, { quoted: m })
      }
      const found = TIMEZONES.find(x => x.id === tz)
      if (!found) return m.reply('❌ منطقة غير موجودة')
      userFrom.set(m.sender, tz)
      return m.reply(`${found.name} *تم تعيين المنطقة المصدر* ${getOffsetString(tz)}`)
    }

    if (subCmd === 'إلى' || subCmd === 'الى' || subCmd === 'to') {
      const tz = args[1]
      if (!tz) {
        const sections = [{ title: '🎯 اختر المنطقة الهدف', rows: buildTzList('إلى', usedPrefix) }]
        return conn.sendMessage(m.chat, {
          text: '🎯 *اختر المنطقة الزمنية الهدف:*',
          footer: 'LIGHT BOT • Time Converter',
          buttons: [{ name: 'single_select', params: { title: 'المناطق', sections } }],
          mentions: [m.sender]
        }, { quoted: m })
      }
      const found = TIMEZONES.find(x => x.id === tz)
      if (!found) return m.reply('❌ منطقة غير موجودة')
      userTo.set(m.sender, tz)
      return m.reply(`${found.name} *تم تعيين المنطقة الهدف* ${getOffsetString(tz)}`)
    }

    if (subCmd === 'تنسيق' || subCmd === 'format') {
      const fmt = args[1]
      if (!fmt) {
        return conn.sendMessage(m.chat, {
          text: '📋 *اختر تنسيق الوقت:*',
          footer: 'LIGHT BOT • Time Converter',
          buttons: FORMATS.map(f => ({
            name: 'quick_reply',
            params: { display_text: `${f.name}`, id: `${usedPrefix}time تنسيق ${f.id}` }
          }))
        }, { quoted: m })
      }
      if (!FORMATS.find(f => f.id === fmt)) return m.reply('❌ تنسيق غير موجود')
      userFormat.set(m.sender, fmt)
      return m.reply(`📋 *تم اختيار:* ${FORMATS.find(f => f.id === fmt)?.name}`)
    }

    if (subCmd === 'تبديل' || subCmd === 'swap') {
      const from = userFrom.get(m.sender) || 'UTC'
      const to = userTo.get(m.sender) || 'Asia/Riyadh'
      userFrom.set(m.sender, to)
      userTo.set(m.sender, from)
      return m.reply(`🔄 *تم التبديل:* ${TIMEZONES.find(x => x.id === to)?.name} ↔ ${TIMEZONES.find(x => x.id === from)?.name}`)
    }

    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const from = userFrom.get(m.sender) || 'UTC'
      const to = userTo.get(m.sender) || 'Asia/Riyadh'
      const fmt = userFormat.get(m.sender) || 'full'
      const f = TIMEZONES.find(x => x.id === from)
      const t = TIMEZONES.find(x => x.id === to)
      const fmtObj = FORMATS.find(x => x.id === fmt)
      return m.reply(
        `⚙️ *إعدادات المحول:*\n\n` +
        `${f?.name || '🌍 UTC'} ${getOffsetString(from)}\n` +
        `➡️\n` +
        `${t?.name || '🇸🇦 الرياض'} ${getOffsetString(to)}\n\n` +
        `📋 تنسيق: ${fmtObj?.name}`
      )
    }

    if (subCmd === 'الآن' || subCmd === 'now') {
      cooldown.set(m.sender, now)
      const date = new Date()
      const from = userFrom.get(m.sender) || 'UTC'
      const to = userTo.get(m.sender) || 'Asia/Riyadh'
      const fmt = userFormat.get(m.sender) || 'full'

      await m.react('🕐')
      return m.reply(
        `🕐 *الوقت الحالي:*\n\n` +
        `${TIMEZONES.find(x => x.id === from)?.name}: ${formatTime(date, from, fmt)}\n` +
        `➡️\n` +
        `${TIMEZONES.find(x => x.id === to)?.name}: ${formatTime(date, to, fmt)}`
      )
    }

    if (subCmd === 'تحويل' || subCmd === 'convert') {
      const timeStr = args.slice(1).join(' ')
      if (!timeStr) return m.reply('❌ أدخل وقت: `.time تحويل 2026-11-18 22:30`')
      const from = userFrom.get(m.sender) || 'UTC'
      const to = userTo.get(m.sender) || 'Asia/Riyadh'
      const fmt = userFormat.get(m.sender) || 'full'

      let date
      try {
        if (/\d{4}-\d{2}-\d{2}/.test(timeStr)) {
          date = new Date(timeStr)
        } else {
          const hm = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i)
          date = new Date()
          if (hm) {
            let h = parseInt(hm[1], 10)
            const min = parseInt(hm[2], 10)
            const ampm = hm[3]?.toLowerCase()
            if (ampm === 'pm' && h < 12) h += 12
            if (ampm === 'am' && h === 12) h = 0
            date.setHours(h, min, 0, 0)
          } else {
            date = new Date(timeStr)
          }
        }
        if (isNaN(date.getTime())) throw new Error()
      } catch {
        return m.reply('❌ تنسيق وقت غير مفهوم، جرب: `10:30 PM` أو `2026-11-18 22:30`')
      }

      cooldown.set(m.sender, now)
      await m.react('🔄')
      return m.reply(
        `🔄 *تحويل الوقت:*\n\n` +
        `${TIMEZONES.find(x => x.id === from)?.name}: ${formatTime(date, from, fmt)}\n` +
        `➡️\n` +
        `${TIMEZONES.find(x => x.id === to)?.name}: ${formatTime(date, to, fmt)}`
      )
    }

    // بحث سريع بالمدينة إذا كتب المستخدم اسم دولة/مدينة بعد الأمر مباشرة
    const query = (text || '').trim().toLowerCase()
    if (query) {
      const match = TIMEZONES.find(t =>
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.cities.some(c => c.toLowerCase().includes(query))
      )
      if (match) {
        cooldown.set(m.sender, now)
        const fmt = userFormat.get(m.sender) || 'full'
        return m.reply(`🕐 *${match.name}:*\n${formatTime(new Date(), match.id, fmt)}`)
      }
    }

    cooldown.set(m.sender, now)
    const from = userFrom.get(m.sender) || 'UTC'
    const to = userTo.get(m.sender) || 'Asia/Riyadh'

    return conn.sendMessage(m.chat, {
      text: `🕐 *محول المناطق الزمنية*\n\n` +
        `${TIMEZONES.find(x => x.id === from)?.name} ➡️ ${TIMEZONES.find(x => x.id === to)?.name}\n\n` +
        `اختر إجراء:`,
      footer: 'LIGHT BOT • Time Converter',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🕐 الآن', id: `${usedPrefix}time الآن` } },
        { name: 'quick_reply', params: { display_text: '🔄 تحويل', id: `${usedPrefix}time تحويل 10:30 PM` } },
        { name: 'quick_reply', params: { display_text: '🌍 من', id: `${usedPrefix}time من` } },
        { name: 'quick_reply', params: { display_text: '🎯 إلى', id: `${usedPrefix}time إلى` } },
        { name: 'quick_reply', params: { display_text: '📋 تنسيق', id: `${usedPrefix}time تنسيق` } },
        { name: 'quick_reply', params: { display_text: '🔄 تبديل', id: `${usedPrefix}time تبديل` } }
      ],
      mentions: [m.sender]
    }, { quoted: m })

  } catch (e) {
    console.error('time:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['time', 'وقت', 'توقيت', 'timezone', 'tz']
handler.usage = ['time', 'time الآن', 'time <مدينة>', 'time تحويل <وقت>', 'time من <منطقة>', 'time إلى <منطقة>', 'time تنسيق <full|short|time|iso|relative>', 'time تبديل', 'time إعدادات']
handler.category = 'tools'
handler.cooldown = 3
export default handler