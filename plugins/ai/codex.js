/*
  ═══════════════════════════════════════════
  💻 مساعد كود AI — لغات وعمليات تفاعلية
  الأمر: .codex / .كود / .برمجة
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const AI_API = 'https://nour-dev.dyz/api/ai/claude?text='

const LANGUAGES = [
  { id: 'js', name: '🟨 JavaScript', ext: 'js' },
  { id: 'ts', name: '🔵 TypeScript', ext: 'ts' },
  { id: 'py', name: '🐍 Python', ext: 'py' },
  { id: 'java', name: '☕ Java', ext: 'java' },
  { id: 'cpp', name: '⚙️ C++', ext: 'cpp' },
  { id: 'go', name: '🐹 Go', ext: 'go' },
  { id: 'rust', name: '🦀 Rust', ext: 'rs' },
  { id: 'php', name: '🐘 PHP', ext: 'php' },
  { id: 'cs', name: '🟣 C#', ext: 'cs' },
  { id: 'swift', name: '🍎 Swift', ext: 'swift' },
  { id: 'kt', name: '💜 Kotlin', ext: 'kt' },
  { id: 'dart', name: '🎯 Dart', ext: 'dart' },
]

const ACTIONS = [
  { id: 'explain', name: '📖 شرح', desc: 'شرح الكود سطر بسطر', emoji: '📖' },
  { id: 'debug', name: '🐛 تصحيح', desc: 'إيجاد الأخطاء وإصلاحها', emoji: '🐛' },
  { id: 'optimize', name: '⚡ تحسين', desc: 'تحسين الأداء والوضوح', emoji: '⚡' },
  { id: 'convert', name: '🔄 تحويل', desc: 'تحويل للغة أخرى', emoji: '🔄' },
  { id: 'test', name: '🧪 اختبارات', desc: 'كتابة unit tests', emoji: '🧪' },
  { id: 'doc', name: '📝 توثيق', desc: 'إضافة تعليقات/JSDoc', emoji: '📝' },
  { id: 'refactor', name: '🔧 إعادة هيكلة', desc: 'تنظيف وتنظيم الكود', emoji: '🔧' },
  { id: 'review', name: '👀 مراجعة', desc: 'مراجعة شاملة + نصائح', emoji: '👀' },
]

const cooldown = new Map()
const COOLDOWN_MS = 5000
const userLang = new Map()
const userAction = new Map()

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const code = m.quoted?.text || m.quoted?.msg?.conversation || text?.replace(/^(كود|codex|برمجة)\s*/i, '').trim()

    // اختيار اللغة
    if (subCmd === 'لغة' || subCmd === 'lang') {
      const langId = args[1]
      if (!langId) {
        const sections = [{ title: '💻 اختر اللغة', rows: LANGUAGES.map(l => ({
          title: l.name, description: `امتداد: .${l.ext}`, id: `.codex لغة ${l.id}`
        })) }]
        return conn.sendMessage(m.chat, {
          text: '💻 *اختر لغة البرمجة:*',
          footer: 'LIGHT BOT • Codex',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m })
      }
      const lang = LANGUAGES.find(l => l.id === langId)
      if (!lang) return m.reply('❌ لغة غير موجودة')
      userLang.set(m.sender, langId)
      return m.reply(`${lang.name} *تم اختيار اللغة*`)
    }

    // اختيار العملية
    if (subCmd === 'عملية' || subCmd === 'action') {
      const actId = args[1]
      if (!actId) {
        return conn.sendMessage(m.chat, {
          text: '🔧 *اختر العملية:*',
          footer: 'LIGHT BOT • Codex',
          buttons: ACTIONS.map(a => ({
            name: 'quick_reply',
            params: { display_text: `${a.emoji} ${a.name}`, id: `.codex عملية ${a.id}` }
          }))
        }, { quoted: m })
      }
      const action = ACTIONS.find(a => a.id === actId)
      if (!action) return m.reply('❌ عملية غير موجودة')
      userAction.set(m.sender, actId)
      return m.reply(`${action.emoji} *تم اختيار:* ${action.name}`)
    }

    // الإعدادات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const lang = LANGUAGES.find(l => l.id === userLang.get(m.sender)) || { name: '🔍 كشف تلقائي' }
      const action = ACTIONS.find(a => a.id === userAction.get(m.sender)) || { name: '📖 شرح', emoji: '📖' }
      return m.reply(
        `⚙️ *إعدادات Codex:*\n\n` +
        `${lang.name} كلغة\n` +
        `${action.emoji} ${action.name} كعملية\n\n` +
        `استخدم: \`.codex لغة <كود>\` / \`.codex عملية <نوع>\``
      )
    }

    // تحقق من وجود كود
    if (!code) {
      return conn.sendMessage(m.chat, {
        text: `💻 *مساعد كود AI*\n\n` +
          `✍️ أرسل الكود، أو رد على رسالة تحتوي كود:\n` +
          `\`${usedPrefix}codex دالة جمع رقمين\`\n\n` +
          `الإعدادات: ${(userLang.get(m.sender) ? LANGUAGES.find(l => l.id === userLang.get(m.sender))?.name : '🔍 تلقائي')} • ${(userAction.get(m.sender) ? ACTIONS.find(a => a.id === userAction.get(m.sender))?.name : '📖 شرح')}`,
        footer: 'LIGHT BOT • Codex',
        buttons: [
          { name: 'quick_reply', params: { display_text: '💻 لغة', id: `${usedPrefix}codex لغة` } },
          { name: 'quick_reply', params: { display_text: '🔧 عملية', id: `${usedPrefix}codex عملية` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}codex إعدادات` } }
        ]
      }, { quoted: m })
    }

    if (code.length < 10) {
      return m.reply('❌ الكود قصير جداً')
    }

    cooldown.set(m.sender, now)
    await m.react('💻')

    const lang = LANGUAGES.find(l => l.id === userLang.get(m.sender)) || { name: 'كشف تلقائي' }
    const action = ACTIONS.find(a => a.id === userAction.get(m.sender)) || { id: 'explain', name: 'شرح', emoji: '📖' }

    const prompts = {
      explain: `اشرح الكود التالي بلغة ${lang.name} سطر بسطر ب العربية:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      debug: `افحص الكود التالي بلغة ${lang.name} لإيجاد الأخطاء المحتملة واقترح الإصلاح:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      optimize: `حسّن الكود التالي بلغة ${lang.name} للأداء والوضوح:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      convert: `حوّل الكود التالي من ${lang.name} للغة أخرى (حدد الهدف):\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      test: `اكتب unit tests شاملة للكود التالي بلغة ${lang.name}:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      doc: `أضف توثيق شامل (JSDoc/docstrings) للكود التالي بلغة ${lang.name}:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      refactor: `أعد هيكلة الكود التالي بلغة ${lang.name} للنظافة والصيانة:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      review: `راجع الكود التالي بلغة ${lang.name} وقدم ملاحظات شاملة:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
    }

    const prompt = prompts[action.id] || prompts.explain

    const { data } = await axios.get(AI_API + encodeURIComponent(prompt), { timeout: 45000 })
    const answer = data?.response || data?.text || '❌ فشل المعالجة'

    await m.reply(
      `${action.emoji} *${action.name} (${lang.name}):*\n\n${answer}`
    )
    await m.react('✅')

  } catch (e) {
    console.error('codex:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل المعالجة، جرب كود أصغر')
  }
}

handler.command = ['codex', 'كود', 'برمجة', 'code']
handler.usage = ['codex <كود>', 'codex لغة <js|ts|py|java|...>', 'codex عملية <explain|debug|optimize|convert|test|doc|refactor|review>', 'codex إعدادات']
handler.category = 'ai'
handler.cooldown = 5
export default handler