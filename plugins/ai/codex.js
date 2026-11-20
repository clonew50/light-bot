/*
  ═══════════════════════════════════════════
  💻 مساعد كود AI — لغات وعمليات تفاعلية
  الأمر: .codex / .برمجة / .code
  ═══════════════════════════════════════════
*/
import { askAI } from '../../system/aiService.js';
import { splitText } from '../../system/text-chunks.js';

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
];

const ACTIONS = [
  { id: 'explain', name: '📖 شرح', desc: 'شرح الكود سطر بسطر', emoji: '📖' },
  { id: 'debug', name: '🐛 تصحيح', desc: 'إيجاد الأخطاء وإصلاحها', emoji: '🐛' },
  { id: 'optimize', name: '⚡ تحسين', desc: 'تحسين الأداء والوضوح', emoji: '⚡' },
  { id: 'convert', name: '🔄 تحويل', desc: 'تحويل للغة أخرى', emoji: '🔄' },
  { id: 'test', name: '🧪 اختبارات', desc: 'كتابة unit tests', emoji: '🧪' },
  { id: 'doc', name: '📝 توثيق', desc: 'إضافة تعليقات/JSDoc', emoji: '📝' },
  { id: 'refactor', name: '🔧 إعادة هيكلة', desc: 'تنظيف وتنظيم الكود', emoji: '🔧' },
  { id: 'review', name: '👀 مراجعة', desc: 'مراجعة شاملة + نصائح', emoji: '👀' },
];

const userLang = new Map();
const userAction = new Map();

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();

    const subCmd = args[0]?.toLowerCase();

    if (subCmd === 'لغة' || subCmd === 'lang') {
      const langId = args[1]?.toLowerCase();
      if (!langId) {
        const sections = [{
          title: '💻 اختر اللغة',
          rows: LANGUAGES.map((l) => ({
            title: l.name,
            description: `امتداد: .${l.ext}`,
            id: `${usedPrefix}codex لغة ${l.id}`
          }))
        }];
        return conn.sendMessage(m.chat, {
          text: '💻 *اختر لغة البرمجة:*',
          footer: 'LIGHT BOT • Codex',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m });
      }
      const lang = LANGUAGES.find((l) => l.id === langId);
      if (!lang) return m.reply('❌ لغة غير موجودة');
      userLang.set(m.sender, langId);
      return m.reply(`${lang.name} *تم اختيار اللغة*`);
    }

    if (subCmd === 'عملية' || subCmd === 'action') {
      const actId = args[1]?.toLowerCase();
      if (!actId) {
        return conn.sendMessage(m.chat, {
          text: '🔧 *اختر العملية:*',
          footer: 'LIGHT BOT • Codex',
          buttons: ACTIONS.map((a) => ({
            name: 'quick_reply',
            params: { display_text: a.name, id: `${usedPrefix}codex عملية ${a.id}` }
          }))
        }, { quoted: m });
      }
      const action = ACTIONS.find((a) => a.id === actId);
      if (!action) return m.reply('❌ عملية غير موجودة');
      userAction.set(m.sender, actId);
      return m.reply(`${action.emoji} *تم اختيار:* ${action.name}`);
    }

    if (subCmd === 'إعدادات' || subCmd === 'اعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const lang = LANGUAGES.find((l) => l.id === userLang.get(m.sender)) || { name: '🔍 كشف تلقائي' };
      const action = ACTIONS.find((a) => a.id === userAction.get(m.sender)) || ACTIONS[0];
      return m.reply(
        `⚙️ *إعدادات Codex:*\n\n` +
        `${lang.name} كلغة\n` +
        `${action.name} كعملية\n\n` +
        `استخدم: \`${usedPrefix}codex لغة <id>\` / \`${usedPrefix}codex عملية <id>\``
      );
    }

    const code = (m.quoted?.text || m.quoted?.msg?.conversation || text || '').trim();
    if (!code) {
      return conn.sendMessage(m.chat, {
        text: `💻 *مساعد كود AI*\n\n` +
          `✍️ أرسل طلبك أو الكود، أو رد على رسالة تحتوي كود:\n` +
          `\`${usedPrefix}codex دالة جمع رقمين في بايثون\`\n\n` +
          `الإعدادات: ${(userLang.get(m.sender) ? LANGUAGES.find((l) => l.id === userLang.get(m.sender))?.name : '🔍 تلقائي')} • ${(userAction.get(m.sender) ? ACTIONS.find((a) => a.id === userAction.get(m.sender))?.name : '📖 شرح')}`,
        footer: 'LIGHT BOT • Codex',
        buttons: [
          { name: 'quick_reply', params: { display_text: '💻 لغة', id: `${usedPrefix}codex لغة` } },
          { name: 'quick_reply', params: { display_text: '🔧 عملية', id: `${usedPrefix}codex عملية` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}codex إعدادات` } }
        ]
      }, { quoted: m });
    }

    if (code.length < 3) {
      return m.reply('❌ الطلب قصير جداً');
    }

    await m.react?.('💻');

    const lang = LANGUAGES.find((l) => l.id === userLang.get(m.sender)) || { name: 'كشف تلقائي', ext: '' };
    const action = ACTIONS.find((a) => a.id === userAction.get(m.sender)) || ACTIONS[0];

    const prompts = {
      explain: `اشرح أو اكتب الكود التالي بلغة ${lang.name} بالعربية بوضوح:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      debug: `افحص الكود التالي بلغة ${lang.name} لإيجاد الأخطاء واقترح الإصلاح:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      optimize: `حسّن الكود التالي بلغة ${lang.name} للأداء والوضوح:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      convert: `حوّل الكود التالي مع الحفاظ على المنطق واذكر اللغة الهدف:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      test: `اكتب اختبارات وحدات (unit tests) شاملة للكود التالي:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      doc: `أضف توثيقاً وتعليقات واضحة للكود التالي:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      refactor: `أعد هيكلة الكود التالي ليكون أنظف وأسهل صيانة:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
      review: `راجع الكود التالي مراجعة شاملة وقدم نصائح عملية:\n\`\`\`${lang.ext}\n${code}\n\`\`\``,
    };

    const res = await askAI({
      prompt: prompts[action.id] || prompts.explain,
      system: 'أنت مهندس برمجيات خبير. اكتب كوداً دقيقاً وآمناً مع شرح عربي موجز.',
      timeoutMs: 40_000
    });

    if (!res.ok || !res.text) {
      await m.react?.('❌');
      return m.reply('❌ تعذر تحليل الكود حالياً، جرب مرة أخرى.');
    }

    const fullMsg = `${action.name} (${lang.name}):\n\n${res.text}`;
    for (const part of splitText(fullMsg)) {
      await m.reply(part);
    }
    await m.react?.('✅');
  } catch (e) {
    console.error('codex:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل المعالجة، جرب نصاً أو كوداً أبسط');
  }
};

handler.command = ['codex', 'برمجة', 'code'];
handler.usage = ['codex <كود>', 'codex لغة <js|ts|py|java|...>', 'codex عملية <explain|debug|optimize|convert|test|doc|refactor|review>', 'codex إعدادات'];
handler.category = 'ai';
export default handler;