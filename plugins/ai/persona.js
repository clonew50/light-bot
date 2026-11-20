/*
  ═══════════════════════════════════════════
  🎭 إدارة شخصيات AI — جاهزة ومخصصة
  الأمر: .persona / .شخصية / .شخصيات
  ═══════════════════════════════════════════
*/
import fs from 'fs';
import path from 'path';
import { getUserPersonaId, setUserPersonaId } from '../../system/aiService.js';

const PERSONAS_FILE = './database/personas.json';

export const DEFAULT_PERSONAS = [
  { id: 'default', name: '🤖 مساعد عام', desc: 'مساعد ذكي متوازن، يجيب على كل شيء', system: 'أنت مساعد ذكي مفيد، تجيب بالعربية بوضوح ودقة.', emoji: '🤖', builtin: true },
  { id: 'coder', name: '👨‍💻 مبرمج خبير', desc: 'كود، تصحيح، أفضل الممارسات، معمارية', system: 'أنت مبرمج خبير. تكتب كوداً نظيفاً وآمناً وقابلاً للصيانة، وتشرح بلغة عربية تقنية واضحة.', emoji: '👨‍💻', builtin: true },
  { id: 'teacher', name: '👨‍🏫 معلم صبور', desc: 'شرح مبسط، أمثلة، خطوة بخطوة، تشجيع', system: 'أنت معلم صبور. تشرح المفاهيم المعقدة ببساطة مع أمثلة واضحة وتشجع المتعلم.', emoji: '👨‍🏫', builtin: true },
  { id: 'creative', name: '🎨 كاتب مبدع', desc: 'قصص، شعر، سيناريوهات، أفكار', system: 'أنت كاتب مبدع. تكتب قصصاً وشعراً وسيناريوهات بأسلوب أدبي راقٍ باللغة العربية.', emoji: '🎨', builtin: true },
  { id: 'analyst', name: '📊 محلل بيانات', desc: 'تحليل، ملخصات، استنتاجات، خطط', system: 'أنت محلل بيانات. تستخرج الأنماط وتلخص التقارير وتقدم رؤى عملية واضحة.', emoji: '📊', builtin: true },
  { id: 'translator', name: '🌐 مترجم محترف', desc: 'ترجمة دقيقة، سياقات ثقافية، مصطلحات', system: 'أنت مترجم محترف. تترجم بدقة مع الحفاظ على السياق والأسلوب والمعنى الثقافي.', emoji: '🌐', builtin: true },
  { id: 'psychologist', name: '🧠 مستشار نفسي', desc: 'استماع، دعم، توجيه، تقنيات CBT', system: 'أنت مستشار داعم ومتعاطف. تستمع باهتمام وتقدم خطوات عملية مطمئنة.', emoji: '🧠', builtin: true },
  { id: 'chef', name: '👨‍🍳 شيف مطبخ', desc: 'وصفات، بدائل، تقنيات، تخطيط وجبات', system: 'أنت شيف محترف. تقدم وصفات عربية وعالمية مع بدائل المكونات ونصائح التحضير.', emoji: '👨‍🍳', builtin: true },
];

function loadPersonas() {
  try {
    const dir = path.dirname(PERSONAS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(PERSONAS_FILE)) {
      fs.writeFileSync(PERSONAS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function savePersonas(custom) {
  try {
    const dir = path.dirname(PERSONAS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERSONAS_FILE, JSON.stringify(custom, null, 2));
  } catch (e) {
    console.error('savePersonas:', e);
  }
}

export function getAllPersonas() {
  return [...DEFAULT_PERSONAS, ...loadPersonas()];
}

export function findPersonaById(id) {
  return getAllPersonas().find((p) => p.id === id) || DEFAULT_PERSONAS[0];
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const subCmd = args[0]?.toLowerCase();
    const all = getAllPersonas();

    if (!subCmd || subCmd === 'قائمة' || subCmd === 'list') {
      const currentId = getUserPersonaId(m.sender);
      const sections = [{
        title: '🎭 شخصيات جاهزة',
        rows: DEFAULT_PERSONAS.map((p) => ({
          title: `${p.id === currentId ? '✅ ' : ''}${p.name}`,
          description: p.desc,
          id: `${usedPrefix}persona اختر ${p.id}`
        }))
      }];
      const custom = loadPersonas();
      if (custom.length) {
        sections.push({
          title: '✨ شخصياتك المخصصة',
          rows: custom.map((p) => ({
            title: `${p.id === currentId ? '✅ ' : ''}${p.emoji} ${p.name}`,
            description: p.desc,
            id: `${usedPrefix}persona اختر ${p.id}`
          }))
        });
      }
      return conn.sendMessage(m.chat, {
        text: `🎭 *إدارة شخصيات AI*\n\n${DEFAULT_PERSONAS.length} جاهزة + ${custom.length} مخصصة\nالشخصية الحالية: *${findPersonaById(currentId).name}*`,
        footer: 'LIGHT BOT • Personas',
        buttons: [{ name: 'single_select', params: { title: 'الشخصيات', sections } }]
      }, { quoted: m });
    }

    if (subCmd === 'اختر' || subCmd === 'select' || subCmd === 'use') {
      const id = args[1];
      if (!id) return m.reply(`❌ حدد المعرف:\n\`${usedPrefix}persona اختر coder\``);
      const persona = all.find((p) => p.id === id);
      if (!persona) return m.reply('❌ شخصية غير موجودة');
      setUserPersonaId(m.sender, persona.id);
      return m.reply(`${persona.emoji} *تم تفعيل الشخصية:* ${persona.name}\n${persona.desc}\n\nالآن اكتب \`${usedPrefix}chat سؤالك\` لاستخدامها`);
    }

    if (subCmd === 'أنشئ' || subCmd === 'انشئ' || subCmd === 'create' || subCmd === 'جديد') {
      const match = String(text || '').match(/(?:أنشئ|انشئ|create|جديد)\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"(?:\s+"([^"]*)")?/i);
      if (!match) {
        return m.reply(`❌ التنسيق:\n\`${usedPrefix}persona أنشئ "الاسم" "الوصف" "برومبت النظام" "🎭"\``);
      }
      const [, pname, pdesc, psystem, pemoji] = match;
      let id = pname.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!id) id = `custom-${Date.now().toString(36)}`;
      if (all.find((p) => p.id === id)) return m.reply('❌ المعرف مستخدم بالفعل، اختر اسماً مختلفاً');
      const custom = loadPersonas();
      custom.push({
        id,
        name: pname,
        desc: pdesc,
        system: psystem,
        emoji: pemoji || '✨',
        builtin: false,
        createdAt: new Date().toISOString()
      });
      savePersonas(custom);
      setUserPersonaId(m.sender, id);
      return m.reply(`✅ *تم إنشاء وتفعيل الشخصية:*\n${pemoji || '✨'} ${pname}\n🆔 \`${id}\`\n${pdesc}`);
    }

    if (subCmd === 'عدل' || subCmd === 'edit') {
      const id = args[1];
      if (!id) return m.reply('❌ حدد المعرف');
      const custom = loadPersonas();
      const idx = custom.findIndex((p) => p.id === id);
      if (idx === -1) return m.reply('❌ شخصية مخصصة غير موجودة');
      const match = String(text || '').match(/(?:عدل|edit)\s+\S+\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"(?:\s+"([^"]*)")?/i);
      if (!match) return m.reply(`❌ التنسيق:\n\`${usedPrefix}persona عدل ${id} "الاسم" "الوصف" "البرومبت" "🎭"\``);
      const [, pname, pdesc, psystem, pemoji] = match;
      custom[idx] = { ...custom[idx], name: pname, desc: pdesc, system: psystem, emoji: pemoji || custom[idx].emoji };
      savePersonas(custom);
      return m.reply('✅ تم تحديث الشخصية');
    }

    if (subCmd === 'احذف' || subCmd === 'delete' || subCmd === 'remove') {
      const id = args[1];
      if (!id) return m.reply('❌ حدد المعرف');
      const custom = loadPersonas();
      const idx = custom.findIndex((p) => p.id === id);
      if (idx === -1) return m.reply('❌ شخصية مخصصة غير موجودة');
      custom.splice(idx, 1);
      savePersonas(custom);
      if (getUserPersonaId(m.sender) === id) setUserPersonaId(m.sender, 'default');
      return m.reply('🗑️ تم الحذف');
    }

    if (subCmd === 'تفاصيل' || subCmd === 'info') {
      const id = args[1] || getUserPersonaId(m.sender);
      const persona = all.find((p) => p.id === id);
      if (!persona) return m.reply('❌ غير موجودة');
      return m.reply(
        `${persona.emoji} *${persona.name}*\n` +
        `🆔 \`${persona.id}\`\n` +
        `📝 ${persona.desc}\n` +
        `⚙️ ${persona.builtin ? 'مدمجة' : 'مخصصة'}\n` +
        `📜 البرومبت: ${persona.system.slice(0, 150)}`
      );
    }

    if (subCmd === 'بحث' || subCmd === 'search') {
      const q = args.slice(1).join(' ').toLowerCase();
      if (!q) return m.reply('❌ اكتب كلمة بحث');
      const results = all.filter((p) => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
      if (!results.length) return m.reply('🔍 لا نتائج');
      return m.reply(results.map((p) => `${p.emoji} ${p.name} (\`${p.id}\`) - ${p.desc}`).join('\n'));
    }

    return conn.sendMessage(m.chat, {
      text: '🎭 *أوامر الشخصيات:*',
      footer: 'LIGHT BOT • Personas',
      buttons: [
        { name: 'quick_reply', params: { display_text: '📋 قائمة', id: `${usedPrefix}persona قائمة` } },
        { name: 'quick_reply', params: { display_text: '📌 الحالية', id: `${usedPrefix}persona تفاصيل` } },
        { name: 'quick_reply', params: { display_text: '🔍 بحث', id: `${usedPrefix}persona بحث مبرمج` } }
      ]
    }, { quoted: m });
  } catch (e) {
    console.error('persona:', e?.message || e);
    return m.reply('❌ حدث خطأ أثناء إدارة الشخصيات');
  }
};

handler.command = ['persona', 'شخصية', 'شخصيات', 'personas'];
handler.usage = ['persona', 'persona قائمة', 'persona اختر <id>', 'persona أنشئ "اسم" "وصف" "برومبت" "🎭"', 'persona عدل <id> "اسم" "وصف" "برومبت" "🎭"', 'persona احذف <id>', 'persona تفاصيل <id>', 'persona بحث <كلمة>'];
handler.category = 'ai';
export default handler;