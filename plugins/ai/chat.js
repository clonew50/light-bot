/*
  ═══════════════════════════════════════════
  🤖 محادثة AI — شخصيات ونماذج وذاكرة تفاعلية
  الأمر: .chat / .ai / .محادثة
  ═══════════════════════════════════════════
*/
import {
  askAI,
  getUserPersonaId,
  setUserPersonaId,
  getUserAiModel,
  setUserAiModel
} from '../../system/aiService.js';
import { pruneCooldown } from '../../system/cooldowns.js';
import { splitText } from '../../system/text-chunks.js';
import { addMessage, clearHistory, loadHistory } from './history.js';
import { getAllPersonas, findPersonaById } from './persona.js';

const MODELS = [
  { id: 'openai-fast', name: '⚡ GPT Fast', desc: 'سريع جداً ومناسب لكل الأسئلة اليومية', emoji: '⚡' },
  { id: 'openai', name: '🧠 GPT Balanced', desc: 'توازن عالٍ في التحليل والصياغة العربية', emoji: '🧠' },
  { id: 'openai-large', name: '🚀 GPT Large', desc: 'قدرة أعمق في التفكير والتحليل المعقد', emoji: '🚀' }
];

const cooldown = new Map();
const COOLDOWN_MS = 4000;

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`);
    }

    const subCmd = args[0]?.toLowerCase();
    const personas = getAllPersonas();

    if (subCmd === 'شخصية' || subCmd === 'persona') {
      const personaId = args[1];
      if (!personaId) {
        const sections = [{
          title: '🎭 اختر شخصية',
          rows: personas.map((p) => ({
            title: `${p.emoji} ${p.name}`,
            description: p.desc,
            id: `${usedPrefix}chat شخصية ${p.id}`
          }))
        }];
        return conn.sendMessage(m.chat, {
          text: '🎭 *اختر شخصية للمحادثة:*',
          footer: 'LIGHT BOT • AI Chat',
          buttons: [{ name: 'single_select', params: { title: 'الشخصيات', sections } }],
          mentions: [m.sender]
        }, { quoted: m });
      }
      const persona = personas.find((p) => p.id === personaId);
      if (!persona) return m.reply('❌ شخصية غير موجودة');
      setUserPersonaId(m.sender, persona.id);
      return m.reply(`${persona.emoji} *تم تعيين الشخصية:* ${persona.name}\n${persona.desc}`);
    }

    if (subCmd === 'نموذج' || subCmd === 'model') {
      const modelId = args[1];
      if (!modelId) {
        return conn.sendMessage(m.chat, {
          text: `🧠 *اختر نموذج الذكاء الاصطناعي:*\nالنموذج الحالي: \`${getUserAiModel(m.sender)}\``,
          footer: 'LIGHT BOT • AI Models',
          buttons: MODELS.map((mdl) => ({
            name: 'quick_reply',
            params: { display_text: mdl.name, id: `${usedPrefix}chat نموذج ${mdl.id}` }
          }))
        }, { quoted: m });
      }
      const mdl = MODELS.find((x) => x.id === modelId);
      if (!mdl) return m.reply('❌ نموذج غير موجود. المتاح: `openai-fast`, `openai`, `openai-large`');
      setUserAiModel(m.sender, mdl.id);
      return m.reply(`${mdl.emoji} *تم تفعيل النموذج:* ${mdl.name}\n${mdl.desc}`);
    }

    if (subCmd === 'حالي' || subCmd === 'current') {
      const currentPersona = findPersonaById(getUserPersonaId(m.sender));
      const currentModel = getUserAiModel(m.sender);
      const historyCount = loadHistory(m.sender).length;
      return m.reply(
        `⚙️ *إعدادات المحادثة الحالية:*\n\n` +
        `${currentPersona.emoji} *الشخصية:* ${currentPersona.name}\n` +
        `🧠 *النموذج:* \`${currentModel}\`\n` +
        `📜 *السجل المحفوظ:* ${historyCount} رسالة`
      );
    }

    if (subCmd === 'مسح' || subCmd === 'clear') {
      clearHistory(m.sender);
      return m.reply('🗑️ تم مسح سجل وسياق محادثتك بنجاح');
    }

    if (subCmd === 'سجل' || subCmd === 'history') {
      const history = loadHistory(m.sender);
      if (!history.length) return m.reply('📭 سجل المحادثة فارغ');
      const lines = history.slice(-8).map((h, i) => {
        const who = h.role === 'user' ? '👤 أنت' : '🤖 البوت';
        return `${i + 1}. ${who}: ${String(h.content || '').slice(0, 140)}`;
      });
      return m.reply(`📜 *آخر رسائل المحادثة:*\n\n${lines.join('\n\n')}`);
    }

    const query = (text || m.quoted?.text || m.quoted?.msg?.conversation || '').trim();
    if (!query) {
      const sections = [{
        title: '🤖 أوامر AI',
        rows: [
          { title: '🎭 شخصية', description: 'اختر الشخصية المفعلة', id: `${usedPrefix}chat شخصية` },
          { title: '🧠 نموذج', description: 'اختر نموذج الذكاء الاصطناعي', id: `${usedPrefix}chat نموذج` },
          { title: '📜 سجل', description: 'عرض آخر الرسائل', id: `${usedPrefix}chat سجل` },
          { title: '🗑️ مسح', description: 'مسح السياق الحالي', id: `${usedPrefix}chat مسح` }
        ]
      }];
      return conn.sendMessage(m.chat, {
        text: `🤖 *محادثة AI*\n\nاستخدم: \`${usedPrefix}chat <سؤالك>\`\nأو اختر من القائمة:`,
        footer: 'LIGHT BOT • AI Chat',
        buttons: [{ name: 'single_select', params: { title: 'القائمة', sections } }],
        mentions: [m.sender]
      }, { quoted: m });
    }

    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(m.sender, now);
    await m.react?.('🧠');

    const persona = findPersonaById(getUserPersonaId(m.sender));
    const model = getUserAiModel(m.sender);
    const history = loadHistory(m.sender);

    const res = await askAI({
      prompt: query,
      system: persona.system,
      history,
      model,
      timeoutMs: 35_000
    });

    if (!res.ok || !res.text) {
      await m.react?.('❌');
      return m.reply('❌ تعذر الحصول على رد من الذكاء الاصطناعي حالياً، جرب مرة أخرى.');
    }

    addMessage(m.sender, 'user', query, { persona: persona.id, model });
    addMessage(m.sender, 'assistant', res.text, { persona: persona.id, model });

    for (const part of splitText(res.text)) {
      await m.reply(part);
    }
    await m.react?.('✅');
  } catch (e) {
    console.error('chat:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ حدث خطأ غير متوقع في الذكاء الاصطناعي');
  }
};

handler.command = ['chat', 'ai', 'محادثة'];
handler.usage = ['chat <سؤال>', 'chat شخصية', 'chat نموذج', 'chat حالي', 'chat سجل', 'chat مسح'];
handler.category = 'ai';
handler.cooldown = 4;
export default handler;