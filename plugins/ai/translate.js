/*
  ═══════════════════════════════════════════
  🌐 ترجمة AI — لغات واتجاهات تفاعلية
  الأمر: .translate / .ترجمة / .trans
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const AI_API = 'https://nour-dev.dyz/api/ai/claude?text='

const LANGUAGES = [
  { code: 'ar', name: '🇸🇦 العربية', native: 'العربية' },
  { code: 'en', name: '🇺🇸 الإنجليزية', native: 'English' },
  { code: 'fr', name: '🇫🇷 الفرنسية', native: 'Français' },
  { code: 'es', name: '🇪🇸 الإسبانية', native: 'Español' },
  { code: 'de', name: '🇩🇪 الألمانية', native: 'Deutsch' },
  { code: 'tr', name: '🇹🇷 التركية', native: 'Türkçe' },
  { code: 'ru', name: '🇷🇺 الروسية', native: 'Русский' },
  { code: 'zh', name: '🇨🇳 الصينية', native: '中文' },
  { code: 'ja', name: '🇯🇵 اليابانية', native: '日本語' },
  { code: 'ko', name: '🇰🇷 الكورية', native: '한국어' },
  { code: 'pt', name: '🇧🇷 البرتغالية', native: 'Português' },
  { code: 'it', name: '🇮🇹 الإيطالية', native: 'Italiano' },
]

const cooldown = new Map()
const COOLDOWN_MS = 3000
const userFrom = new Map()
const userTo = new Map()

function buildLangList() {
  return LANGUAGES.map(l => ({
    title: `${l.name}`,
    description: `${l.native}`,
    id: `.translate من ${l.code}`
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const targetText = m.quoted?.text || m.quoted?.msg?.conversation || text?.replace(/^(ترجمة|translate|trans)\s*/i, '').trim()

    // اختيار اللغة المصدر
    if (subCmd === 'من' || subCmd === 'from') {
      const code = args[1]
      if (!code) {
        const sections = [{ title: '🌐 اختر اللغة المصدر', rows: buildLangList() }]
        return conn.sendMessage(m.chat, {
          text: '🌐 *اختر اللغة المصدر:*',
          footer: 'LIGHT BOT • Translate',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m })
      }
      const lang = LANGUAGES.find(l => l.code === code)
      if (!lang) return m.reply('❌ لغة غير موجودة')
      userFrom.set(m.sender, code)
      return m.reply(`${lang.name} *تم تعيين اللغة المصدر*`)
    }

    // اختيار اللغة الهدف
    if (subCmd === 'إلى' || subCmd === 'إلى' || subCmd === 'to') {
      const code = args[1]
      if (!code) {
        const sections = [{ title: '🎯 اختر اللغة الهدف', rows: buildLangList() }]
        return conn.sendMessage(m.chat, {
          text: '🎯 *اختر اللغة الهدف:*',
          footer: 'LIGHT BOT • Translate',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m })
      }
      const lang = LANGUAGES.find(l => l.code === code)
      if (!lang) return m.reply('❌ لغة غير موجودة')
      userTo.set(m.sender, code)
      return m.reply(`${lang.name} *تم تعيين اللغة الهدف*`)
    }

    // تبديل الاتجاه
    if (subCmd === 'تبديل' || subCmd === 'swap') {
      const from = userFrom.get(m.sender)
      const to = userTo.get(m.sender)
      if (from && to) {
        userFrom.set(m.sender, to)
        userTo.set(m.sender, from)
        const f = LANGUAGES.find(l => l.code === to)
        const t = LANGUAGES.find(l => l.code === from)
        return m.reply(`🔄 *تم التبديل:* ${f.name} ↔ ${t.name}`)
      }
      return m.reply('❌ عين اللغتين أولاً')
    }

    // الإعدادات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const from = userFrom.get(m.sender) || 'auto'
      const to = userTo.get(m.sender) || 'ar'
      const f = LANGUAGES.find(l => l.code === from) || { name: '🔍 كشف تلقائي' }
      const t = LANGUAGES.find(l => l.code === to) || { name: '🇸🇦 العربية' }
      return m.reply(
        `⚙️ *إعدادات الترجمة:*\n\n` +
        `${f.name} → ${t.name}\n\n` +
        `استخدم: \`.translate من <كود>\` / \`.translate إلى <كود>\` / \`.translate تبديل\``
      )
    }

    // تحقق من وجود نص
    if (!targetText) {
      return conn.sendMessage(m.chat, {
        text: `🌐 *ترجمة AI*\n\n` +
          `✍️ اكتب النص للترجمة، أو رد على رسالة:\n` +
          `\`${usedPrefix}translate Hello world\`\n\n` +
          `الإعدادات: ${(userFrom.get(m.sender) ? LANGUAGES.find(l => l.code === userFrom.get(m.sender))?.name : '🔍 تلقائي')} → ${(userTo.get(m.sender) ? LANGUAGES.find(l => l.code === userTo.get(m.sender))?.name : '🇸🇦 العربية')}`,
        footer: 'LIGHT BOT • Translate',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🌐 من', id: `${usedPrefix}translate من` } },
          { name: 'quick_reply', params: { display_text: '🎯 إلى', id: `${usedPrefix}translate إلى` } },
          { name: 'quick_reply', params: { display_text: '🔄 تبديل', id: `${usedPrefix}translate تبديل` } }
        ]
      }, { quoted: m })
    }

    cooldown.set(m.sender, now)
    await m.react('🌐')

    const fromCode = userFrom.get(m.sender) || 'auto'
    const toCode = userTo.get(m.sender) || 'ar'
    const fromLang = LANGUAGES.find(l => l.code === fromCode)?.name || 'كشف تلقائي'
    const toLang = LANGUAGES.find(l => l.code === toCode)?.name || 'العربية'

    const prompt = `ترجم النص التالي من ${fromLang} إلى ${toLang} بدقة مع الحفاظ على السياق:\n\n${targetText}`

    const { data } = await axios.get(AI_API + encodeURIComponent(prompt), { timeout: 20000 })
    const answer = data?.response || data?.text || '❌ فشل الترجمة'

    await m.reply(`🌐 *ترجمة:* ${fromLang} → ${toLang}\n\n${answer}`)
    await m.react('✅')

  } catch (e) {
    console.error('translate:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل الترجمة، جرب نص أقصر')
  }
}

handler.command = ['translate', 'ترجمة', 'trans', 't']
handler.usage = ['translate <نص>', 'translate من <كود>', 'translate إلى <كود>', 'translate تبديل', 'translate إعدادات']
handler.category = 'ai'
handler.cooldown = 3
export default handler