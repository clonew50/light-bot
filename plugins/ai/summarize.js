/*
  ═══════════════════════════════════════════
  📝 ملخص نصوص AI — أطوال وأساليب تفاعلية
  الأمر: .summarize / .ملخص / .اختصار
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const AI_API = 'https://nour-dev.dyz/api/ai/claude?text='

const STYLES = [
  { id: 'bullets', name: '📋 نقاط', desc: 'نقاط مختصرة سهلة القراءة', emoji: '📋' },
  { id: 'paragraph', name: '📄 فقرة', desc: 'نص مترابط متناسق', emoji: '📄' },
  { id: 'tldr', name: '⚡ TL;DR', desc: 'جملة واحدة فقط', emoji: '⚡' },
  { id: 'keywords', name: '🔑 كلمات مفتاحية', desc: 'أهم المصطلحات فقط', emoji: '🔑' },
  { id: 'action', name: '✅ مهام', desc: 'استخراج خطوات قابلة للتنفيذ', emoji: '✅' },
]

const LENGTHS = [
  { id: 'short', name: '🔹 قصير (50 كلمة)', emoji: '🔹' },
  { id: 'medium', name: '🔸 متوسط (150 كلمة)', emoji: '🔸' },
  { id: 'long', name: '🔷 طويل (300 كلمة)', emoji: '🔷' },
]

const cooldown = new Map()
const COOLDOWN_MS = 5000
const userStyle = new Map()
const userLength = new Map()

function buildStyleButtons() {
  return STYLES.map(s => ({
    name: 'quick_reply',
    params: { display_text: `${s.emoji} ${s.name}`, id: `.summarize اسلوب ${s.id}` }
  }))
}

function buildLengthButtons() {
  return LENGTHS.map(l => ({
    name: 'quick_reply',
    params: { display_text: `${l.emoji} ${l.name}`, id: `.summarize طول ${l.id}` }
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
    const targetText = m.quoted?.text || m.quoted?.msg?.conversation || text?.replace(/^(ملخص|summarize|اختصار)\s*/i, '').trim()

    // اختيار الأسلوب
    if (subCmd === 'اسلوب' || subCmd === 'style') {
      const styleId = args[1]
      if (!styleId) {
        return conn.sendMessage(m.chat, {
          text: '📝 *اختر أسلوب الملخص:*',
          footer: 'LIGHT BOT • Summarize',
          buttons: STYLES.map(s => ({
            name: 'quick_reply',
            params: { display_text: `${s.emoji} ${s.name}`, id: `.summarize اسلوب ${s.id}` }
          }))
        }, { quoted: m })
      }
      const style = STYLES.find(s => s.id === styleId)
      if (!style) return m.reply('❌ أسلوب غير موجود')
      userStyle.set(m.sender, styleId)
      return m.reply(`${style.emoji} *تم اختيار:* ${style.name}`)
    }

    // اختيار الطول
    if (subCmd === 'طول' || subCmd === 'length') {
      const lenId = args[1]
      if (!lenId) {
        return conn.sendMessage(m.chat, {
          text: '📏 *اختر طول الملخص:*',
          footer: 'LIGHT BOT • Summarize',
          buttons: LENGTHS.map(l => ({
            name: 'quick_reply',
            params: { display_text: `${l.emoji} ${l.name}`, id: `.summarize طول ${l.id}` }
          }))
        }, { quoted: m })
      }
      const len = LENGTHS.find(l => l.id === lenId)
      if (!len) return m.reply('❌ طول غير موجود')
      userLength.set(m.sender, lenId)
      return m.reply(`${len.emoji} *تم اختيار:* ${len.name}`)
    }

    // الإعدادات الحالية
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const style = STYLES.find(s => s.id === userStyle.get(m.sender)) || STYLES[0]
      const len = LENGTHS.find(l => l.id === userLength.get(m.sender)) || LENGTHS[1]
      return m.reply(
        `⚙️ *إعدادات الملخص:*\n\n` +
        `${style.emoji} *الأسلوب:* ${style.name}\n` +
        `${len.emoji} *الطول:* ${len.name}`
      )
    }

    // تحقق من وجود نص
    if (!targetText) {
      return conn.sendMessage(m.chat, {
        text: `📝 *ملخص نصوص AI*\n\n` +
          `✍️ اكتب النص بعد الأمر، أو رد على رسالة:\n` +
          `\`${usedPrefix}summarize نص طويل هنا...\`\n\n` +
          `أو اختر الأسلوب/الطول:`,
        footer: 'LIGHT BOT • Summarize',
        buttons: [
          ...buildStyleButtons().slice(0, 2),
          ...buildLengthButtons().slice(0, 2),
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}summarize إعدادات` } }
        ]
      }, { quoted: m })
    }

    if (targetText.length < 50) {
      return m.reply('❌ النص قصير جداً، لا يحتاج ملخص')
    }

    cooldown.set(m.sender, now)
    await m.react('📝')

    const styleId = userStyle.get(m.sender) || 'bullets'
    const lenId = userLength.get(m.sender) || 'medium'
    const style = STYLES.find(s => s.id === styleId)
    const len = LENGTHS.find(l => l.id === lenId)

    const prompts = {
      bullets: 'لخص النص التالي في نقاط مختصرة ومرقمة:',
      paragraph: 'لخص النص التالي في فقرة واحدة متناسقة:',
      tldr: 'لخص النص التالي في جملة واحدة فقط (TL;DR):',
      keywords: 'استخرج أهم 10 كلمات مفتاحية من النص التالي:',
      action: 'استخرج خطوات قابلة للتنفيذ (Action items) من النص التالي:'
    }

    const prompt = `${prompts[styleId] || prompts.bullets}\nالطول: ${len.name}\n\nالنص:\n${targetText}`

    const { data } = await axios.get(AI_API + encodeURIComponent(prompt), { timeout: 30000 })
    const answer = data?.response || data?.text || '❌ لم أستطع التلخيص'

    await m.reply(
      `${style.emoji} *ملخص (${style.name} • ${len.name}):*\n\n${answer}\n\n` +
      `📊 *النص الأصلي:* ${targetText.length} حرف → *الملخص:* ${answer.length} حرف`
    )
    await m.react('✅')

  } catch (e) {
    console.error('summarize:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل التلخيص، جرب نص أقصر')
  }
}

handler.command = ['summarize', 'ملخص', 'اختصار', 'tl;dr']
handler.usage = ['summarize <نص>', 'summarize اسلوب <bullets|paragraph|tldr|keywords|action>', 'summarize طول <short|medium|long>', 'summarize إعدادات']
handler.category = 'ai'
handler.cooldown = 5
export default handler