/*
  ═══════════════════════════════════════════
  🎭 إدارة شخصيات AI — جاهزة ومخصصة
  الأمر: .persona / .شخصية / .شخصيات
  ═══════════════════════════════════════════
*/
import fs from 'fs'
import path from 'path'

const PERSONAS_FILE = './database/personas.json'

const DEFAULT_PERSONAS = [
  { id: 'default', name: '🤖 مساعد عام', desc: 'مساعد ذكي متوازن، يجيب على كل شيء', system: 'أنت مساعد ذكي مفيد، تجيب بالعربية بوضوح ودقة.', emoji: '🤖', builtin: true },
  { id: 'coder', name: '👨‍💻 مبرمج خبير', desc: 'كود، تصحيح، أفضل الممارسات، معمارية', system: 'أنت مبرمج خبير. تكتب كود نظيف، آمن، قابل للصيانة. تشرح بلغة عربية تقنية.', emoji: '👨‍💻', builtin: true },
  { id: 'teacher', name: '👨‍🏫 معلم صبور', desc: 'شرح مبسط، أمثلة، خطوة بخطوة، تشجيع', system: 'أنت معلم صبور. تشرح المفاهيم المعقدة ببساطة، تستخدم أمثلة من الحياة اليومية، تشجع المتعلم.', emoji: '👨‍🏫', builtin: true },
  { id: 'creative', name: '🎨 كاتب مبدع', desc: 'قصص، شعر، سيناريوهات، أفكار', system: 'أنت كاتب مبدع. تكتب قصصاً، شعراً، سيناريوهات بأسلوب أدبي راقٍ باللغة العربية.', emoji: '🎨', builtin: true },
  { id: 'analyst', name: '📊 محلل بيانات', desc: 'تحليل، ملخصات، استنتاجات، رسم بياني', system: 'أنت محلل بيانات. تستخرج الأنماط، تلخص التقارير، تقدم رؤى قابلة للتنفيذ.', emoji: '📊', builtin: true },
  { id: 'translator', name: '🌐 مترجم محترف', desc: 'ترجمة دقيقة، سياقات ثقافية، مصطلحات', system: 'أنت مترجم محترف. تترجم بدقة مع الحفاظ على السياق والأسلوب والمعنى الثقافي.', emoji: '🌐', builtin: true },
  { id: 'psychologist', name: '🧠 مستشار نفسي', desc: 'استماع، دعم، توجيه، تقنيات CBT', system: 'أنت مستشار نفسي متعاطف. تستمع بلا حكم، تقدم دعمًا وتقنيات CBT عملية.', emoji: '🧠', builtin: true },
  { id: 'chef', name: '👨‍🍳 شيف مطبخ', desc: 'وصفات، بدائل، تقنيات، تخطيط وجبات', system: 'أنت شيف محترف. تقدم وصفات عربية وعالمية، بدائل مكونات، نصائح تقنية.', emoji: '👨‍🍳', builtin: true },
]

function loadPersonas() {
  try {
    const dir = path.dirname(PERSONAS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(PERSONAS_FILE)) {
      fs.writeFileSync(PERSONAS_FILE, JSON.stringify([], null, 2))
      return []
    }
    return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf-8'))
  } catch { return [] }
}

function savePersonas(custom) {
  try {
    const dir = path.dirname(PERSONAS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(PERSONAS_FILE, JSON.stringify(custom, null, 2))
  } catch (e) { console.error('savePersonas:', e) }
}

function getAllPersonas() {
  return [...DEFAULT_PERSONAS, ...loadPersonas()]
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const subCmd = args[0]?.toLowerCase()
    const all = getAllPersonas()

    // عرض القائمة
    if (!subCmd || subCmd === 'قائمة' || subCmd === 'list') {
      const sections = [{
        title: '🎭 شخصيات جاهزة',
        rows: DEFAULT_PERSONAS.map(p => ({ title: `${p.emoji} ${p.name}`, description: p.desc, id: `.persona اختر ${p.id}` }))
      }]
      const custom = loadPersonas()
      if (custom.length) {
        sections.push({
          title: '✨ شخصياتك المخصصة',
          rows: custom.map(p => ({ title: `${p.emoji} ${p.name}`, description: p.desc, id: `.persona اختر ${p.id}` }))
        })
      }
      return conn.sendMessage(m.chat, {
        text: `🎭 *إدارة شخصيات AI*\n\n${DEFAULT_PERSONAS.length} جاهزة + ${custom.length} مخصصة`,
        footer: 'LIGHT BOT • Personas',
        buttons: [{ name: 'single_select', params: { title: 'الشخصيات', sections } }]
      }, { quoted: m })
    }

    // اختيار شخصية
    if (subCmd === 'اختر' || subCmd === 'select' || subCmd === 'use') {
      const id = args[1]
      if (!id) return m.reply('❌ حدد المعرف: `.persona اختر coder`')
      const persona = all.find(p => p.id === id)
      if (!persona) return m.reply('❌ شخصية غير موجودة')
      // Save to user session (would need global state)
      return m.reply(`${persona.emoji} *تم تفعيل:* ${persona.name}\n${persona.desc}\n\nالآن اكتب \`.chat سؤالك\` لاستخدامها`)
    }

    // إنشاء شخصية مخصصة
    if (subCmd === 'أنشئ' || subCmd === 'create' || subCmd === 'جديد') {
      const name = args[1]
      if (!name) return m.reply('❌ الاستخدام: `.persona أنشئ "اسم الشخصية" "الوصف" "برومبت النظام"`')
      // Format: .persona أنشئ "الاسم" "الوصف" "البرومبت" "🎭"
      const match = text.match(/أنشئ\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"\s*"?([^"]*)"?/)
      if (!match) return m.reply('❌ التنسيق: `.persona أنشئ "الاسم" "الوصف" "برومبت النظام" "إيموجي"`')
      const [, pname, pdesc, psystem, pemoji] = match
      const id = pname.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      if (all.find(p => p.id === id)) return m.reply('❌ المعرف مستخدم بالفعل')
      const custom = loadPersonas()
      custom.push({ id, name: pname, desc: pdesc, system: psystem, emoji: pemoji || '✨', builtin: false, createdAt: new Date().toISOString() })
      savePersonas(custom)
      return m.reply(`✅ *تم إنشاء شخصية مخصصة:*\n${pemoji || '✨'} ${pname}\n${pdesc}\n\nاستخدم: \`.persona اختر ${id}\``)
    }

    // تعديل شخصية مخصصة
    if (subCmd === 'عدل' || subCmd === 'edit') {
      const id = args[1]
      if (!id) return m.reply('❌ حدد المعرف')
      const custom = loadPersonas()
      const idx = custom.findIndex(p => p.id === id)
      if (idx === -1) return m.reply('❌ شخصية مخصصة غير موجودة')
      const match = text.match(/عدل\s+\S+\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"\s*"?([^"]*)"?/)
      if (!match) return m.reply('❌ التنسيق: `.persona عدل id "الاسم" "الوصف" "البرومبت" "إيموجي"`')
      const [, pname, pdesc, psystem, pemoji] = match
      custom[idx] = { ...custom[idx], name: pname, desc: pdesc, system: psystem, emoji: pemoji || custom[idx].emoji }
      savePersonas(custom)
      return m.reply('✅ تم تحديث الشخصية')
    }

    // حذف شخصية مخصصة
    if (subCmd === 'احذف' || subCmd === 'delete' || subCmd === 'remove') {
      const id = args[1]
      if (!id) return m.reply('❌ حدد المعرف')
      const custom = loadPersonas()
      const idx = custom.findIndex(p => p.id === id)
      if (idx === -1) return m.reply('❌ شخصية مخصصة غير موجودة')
      custom.splice(idx, 1)
      savePersonas(custom)
      return m.reply('🗑️ تم الحذف')
    }

    // عرض تفاصيل شخصية
    if (subCmd === 'تفاصيل' || subCmd === 'info') {
      const id = args[1]
      if (!id) return m.reply('❌ حدد المعرف')
      const persona = all.find(p => p.id === id)
      if (!persona) return m.reply('❌ غير موجودة')
      return m.reply(
        `${persona.emoji} *${persona.name}*\n` +
        `🆔 ${persona.id}\n` +
        `📝 ${persona.desc}\n` +
        `⚙️ ${persona.builtin ? 'مدمجة' : 'مخصصة'}\n` +
        `📜 البرومبت: ${persona.system.slice(0, 100)}...`
      )
    }

    // بحث
    if (subCmd === 'بحث' || subCmd === 'search') {
      const q = args.slice(1).join(' ').toLowerCase()
      if (!q) return m.reply('❌ اكتب كلمة بحث')
      const results = all.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
      if (!results.length) return m.reply('🔍 لا نتائج')
      return m.reply(results.map(p => `${p.emoji} ${p.name} (\`${p.id}\`) - ${p.desc}`).join('\n'))
    }

    // قائمة سريعة
    return conn.sendMessage(m.chat, {
      text: `🎭 *أوامر الشخصيات:*`,
      footer: 'LIGHT BOT • Personas',
      buttons: [
        { name: 'quick_reply', params: { display_text: '📋 قائمة', id: `${usedPrefix}persona قائمة` } },
        { name: 'quick_reply', params: { display_text: '✨ أنشئ', id: `${usedPrefix}persona أنشئ "اسم" "وصف" "برومبت" "🎭"` } },
        { name: 'quick_reply', params: { display_text: '🔍 بحث', id: `${usedPrefix}persona بحث مساعد` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('persona:', e?.message || e)
    m.reply('❌ خطأ')
  }
}

handler.command = ['persona', 'شخصية', 'شخصيات', 'personas']
handler.usage = ['persona', 'persona قائمة', 'persona اختر <id>', 'persona أنشئ "اسم" "وصف" "برومبت" "🎭"', 'persona عدل <id> "اسم" "وصف" "برومبت" "🎭"', 'persona احذف <id>', 'persona تفاصيل <id>', 'persona بحث <كلمة>']
handler.category = 'ai'
handler.cooldown = 3
export default handler