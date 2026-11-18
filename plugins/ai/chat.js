/*
  ═══════════════════════════════════════════
  🤖 محادثة AI — شخصيات ونماذج تفاعلية
  الأمر: .chat / .ai
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const AI_API = 'https://nour-dev.dyz/api/ai/claude?text='
const PERSONAS = [
  { id: 'default', name: '🤖 افتراضي', desc: 'مساعد عام متوازن', emoji: '🤖' },
  { id: 'coder', name: '👨‍💻 مبرمج', desc: 'خبير كود، تصحيح، أفضل الممارسات', emoji: '👨‍💻' },
  { id: 'teacher', name: '👨‍🏫 معلم', desc: 'شرح مبسط، أمثلة، خطوة بخطوة', emoji: '👨‍🏫' },
  { id: 'creative', name: '🎨 مبدع', desc: 'كتابة قصص، شعر، أفكار إبداعية', emoji: '🎨' },
  { id: 'analyst', name: '📊 محلل', desc: 'تحليل بيانات، ملخصات، استنتاجات', emoji: '📊' },
  { id: 'translator', name: '🌐 مترجم', desc: 'ترجمة دقيقة، سياقات ثقافية', emoji: '🌐' },
]

const cooldown = new Map()
const COOLDOWN_MS = 5000
const userPersona = new Map()

function buildPersonaList() {
  return PERSONAS.map(p => ({
    title: `${p.emoji} ${p.name}`,
    description: p.desc,
    id: `.chat شخصية ${p.id}`
  }))
}

function buildModelCarousel() {
  return [
    { title: '🧠 Claude 3.5 Sonnet', description: 'الأذكى، تحليل معقد، كود', id: '.chat نموذج claude' },
    { title: '⚡ GPT-4o', description: 'سريع، متعدد الوسائط', id: '.chat نموذج gpt4o' },
    { title: '🎨 DALL-E 3', description: 'توليد صور من وصف', id: '.chat نموذج dalle' },
    { title: '🔍 Perplexity', description: 'بحث مباشر + مصادر', id: '.chat نموذج perplexity' },
  ]
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }
    cooldown.set(m.sender, now)

    const subCmd = args[0]?.toLowerCase()

    // قائمة الشخصيات
    if (subCmd === 'شخصية' || subCmd === 'persona') {
      const personaId = args[1]
      if (!personaId) {
        const sections = [{ title: '🎭 اختر شخصية', rows: buildPersonaList() }]
        return conn.sendMessage(m.chat, {
          text: '🎭 *اختر شخصية للمحادثة:*',
          footer: 'LIGHT BOT • AI Chat',
          buttons: [{ name: 'single_select', params: { title: 'الشخصيات', sections } }],
          mentions: [m.sender]
        }, { quoted: m })
      }
      const persona = PERSONAS.find(p => p.id === personaId)
      if (!persona) return m.reply('❌ شخصية غير موجودة')
      userPersona.set(m.sender, personaId)
      return m.reply(`${persona.emoji} *تم تعيين الشخصية:* ${persona.name}\n${persona.desc}`)
    }

    // قائمة النماذج
    if (subCmd === 'نموذج' || subCmd === 'model') {
      const modelId = args[1]
      if (!modelId) {
        const cards = buildModelCarousel().map(c => ({
          header: { type: 'text', text: c.title },
          body: { text: c.description },
          footer: { text: 'LIGHT BOT' },
          buttons: [{ type: 'quick_reply', name: 'quick_reply', params: { display_text: 'اختيار', id: c.id } }]
        }))
        return conn.sendMessage(m.chat, {
          carousel: { cards }
        }, { quoted: m })
      }
      return m.reply(`🔄 نموذج \`${modelId}\` المحدد (قيد التطوير)`)
    }

    // عرض الشخصية الحالية
    if (subCmd === 'حالي' || subCmd === 'current') {
      const current = userPersona.get(m.sender) || 'default'
      const p = PERSONAS.find(x => x.id === current)
      return m.reply(`${p.emoji} *الشخصية الحالية:* ${p.name}\n${p.desc}`)
    }

    // محادثة عادية
    const query = text?.trim()
    if (!query) {
      const sections = [{ title: '🤖 أوامر AI', rows: [
        { title: '🎭 شخصية', description: 'اختر/اعرض الشخصية', id: `${usedPrefix}chat شخصية` },
        { title: '🧠 نموذج', description: 'اختر نموذج AI', id: `${usedPrefix}chat نموذج` },
        { title: '📜 سجل', description: 'عرض/مسح المحادثة', id: `${usedPrefix}chat سجل` },
        { title: '🗑️ مسح', description: 'مسح السياق الحالي', id: `${usedPrefix}chat مسح` },
      ]}]
      return conn.sendMessage(m.chat, {
        text: `🤖 *محادثة AI*\n\nاستخدم: \`${usedPrefix}chat <سؤالك>\`\nأو اختر من القائمة:`,
        footer: 'LIGHT BOT • AI Chat',
        buttons: [{ name: 'single_select', params: { title: 'القائمة', sections } }],
        mentions: [m.sender]
      }, { quoted: m })
    }

    await m.react('🧠')
    const personaId = userPersona.get(m.sender) || 'default'
    const persona = PERSONAS.find(p => p.id === personaId)
    const prompt = `أنت ${persona.name} (${persona.desc}). تكلم بالعربية.\nالمستخدم: ${query}`

    const { data } = await axios.get(AI_API + encodeURIComponent(prompt), { timeout: 30000 })
    const answer = data?.response || data?.text || '❌ لم أستطع الرد'
    await m.reply(answer)
    await m.react('✅')

  } catch (e) {
    console.error('chat:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ في الاتصال بالذكاء الاصطناعي')
  }
}

handler.command = ['chat', 'ai', 'محادثة']
handler.usage = ['chat <سؤال>', 'chat شخصية', 'chat نموذج', 'chat حالي', 'chat مسح']
handler.category = 'ai'
handler.cooldown = 5
export default handler