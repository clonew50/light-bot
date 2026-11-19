/*
  ═══════════════════════════════════════════
  📝 ملخص نصوص AI — أطوال وأساليب تفاعلية
  الأمر: .summarize / .ملخص / .اختصار / .tldr
  ═══════════════════════════════════════════
*/
import { askAI } from '../../system/aiService.js';
import { pruneCooldown } from '../../system/cooldowns.js';
import { splitText } from '../../system/text-chunks.js';

const STYLES = [
  { id: 'bullets', name: '📋 نقاط', desc: 'نقاط مختصرة سهلة القراءة', emoji: '📋' },
  { id: 'paragraph', name: '📄 فقرة', desc: 'نص مترابط متناسق', emoji: '📄' },
  { id: 'tldr', name: '⚡ جملة واحدة', desc: 'خلاصة مركزة جداً', emoji: '⚡' },
  { id: 'keywords', name: '🔑 كلمات مفتاحية', desc: 'أهم المصطلحات فقط', emoji: '🔑' },
  { id: 'action', name: '✅ مهام', desc: 'خطوات قابلة للتنفيذ', emoji: '✅' },
];

const LENGTHS = [
  { id: 'short', name: '🔹 قصير (50 كلمة)', emoji: '🔹' },
  { id: 'medium', name: '🔸 متوسط (150 كلمة)', emoji: '🔸' },
  { id: 'long', name: '🔷 طويل (300 كلمة)', emoji: '🔷' },
];

const cooldown = new Map();
const COOLDOWN_MS = 5000;
const userStyle = new Map();
const userLength = new Map();

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`);
    }

    const subCmd = args[0]?.toLowerCase();

    if (subCmd === 'اسلوب' || subCmd === 'أسلوب' || subCmd === 'style') {
      const styleId = args[1]?.toLowerCase();
      if (!styleId) {
        return conn.sendMessage(m.chat, {
          text: '📝 *اختر أسلوب الملخص:*',
          footer: 'LIGHT BOT • Summarize',
          buttons: STYLES.map((s) => ({
            name: 'quick_reply',
            params: { display_text: s.name, id: `${usedPrefix}summarize اسلوب ${s.id}` }
          }))
        }, { quoted: m });
      }
      const style = STYLES.find((s) => s.id === styleId);
      if (!style) return m.reply('❌ أسلوب غير موجود');
      userStyle.set(m.sender, styleId);
      return m.reply(`${style.emoji} *تم اختيار:* ${style.name}`);
    }

    if (subCmd === 'طول' || subCmd === 'length') {
      const lenId = args[1]?.toLowerCase();
      if (!lenId) {
        return conn.sendMessage(m.chat, {
          text: '📏 *اختر طول الملخص:*',
          footer: 'LIGHT BOT • Summarize',
          buttons: LENGTHS.map((l) => ({
            name: 'quick_reply',
            params: { display_text: l.name, id: `${usedPrefix}summarize طول ${l.id}` }
          }))
        }, { quoted: m });
      }
      const len = LENGTHS.find((l) => l.id === lenId);
      if (!len) return m.reply('❌ طول غير موجود');
      userLength.set(m.sender, lenId);
      return m.reply(`${len.emoji} *تم اختيار:* ${len.name}`);
    }

    if (subCmd === 'إعدادات' || subCmd === 'اعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const style = STYLES.find((s) => s.id === userStyle.get(m.sender)) || STYLES[0];
      const len = LENGTHS.find((l) => l.id === userLength.get(m.sender)) || LENGTHS[1];
      return m.reply(
        `⚙️ *إعدادات الملخص:*\n\n` +
        `*الأسلوب:* ${style.name}\n` +
        `*الطول:* ${len.name}`
      );
    }

    const targetText = (m.quoted?.text || m.quoted?.msg?.conversation || text || '').trim();
    if (!targetText) {
      return conn.sendMessage(m.chat, {
        text: `📝 *ملخص نصوص AI*\n\n` +
          `✍️ اكتب النص بعد الأمر، أو رد على رسالة:\n` +
          `\`${usedPrefix}summarize نص طويل هنا...\`\n\n` +
          `أو اختر الأسلوب والطول:`,
        footer: 'LIGHT BOT • Summarize',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📋 نقاط', id: `${usedPrefix}summarize اسلوب bullets` } },
          { name: 'quick_reply', params: { display_text: '📄 فقرة', id: `${usedPrefix}summarize اسلوب paragraph` } },
          { name: 'quick_reply', params: { display_text: '🔹 قصير', id: `${usedPrefix}summarize طول short` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}summarize إعدادات` } }
        ]
      }, { quoted: m });
    }

    if (targetText.length < 30) {
      return m.reply('❌ النص قصير جداً، لا يحتاج إلى تلخيص');
    }

    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(m.sender, now);
    await m.react?.('📝');

    const styleId = userStyle.get(m.sender) || 'bullets';
    const lenId = userLength.get(m.sender) || 'medium';
    const style = STYLES.find((s) => s.id === styleId) || STYLES[0];
    const len = LENGTHS.find((l) => l.id === lenId) || LENGTHS[1];

    const prompts = {
      bullets: 'لخص النص التالي في نقاط مختصرة ومرقمة:',
      paragraph: 'لخص النص التالي في فقرة واحدة متناسقة:',
      tldr: 'لخص النص التالي في جملة واحدة فقط مركزة:',
      keywords: 'استخرج أهم الكلمات المفتاحية من النص التالي مع شرح سريع:',
      action: 'استخرج خطوات قابلة للتنفيذ من النص التالي:'
    };

    const res = await askAI({
      prompt: `${prompts[styleId] || prompts.bullets}\nالطول المطلوب: ${len.name}\n\nالنص:\n${targetText}`,
      system: 'أنت خبير تلخيص نصوص بدقة دون إخلال بالمعنى، وترد بالعربية بوضوح.',
      timeoutMs: 35_000
    });

    if (!res.ok || !res.text) {
      await m.react?.('❌');
      return m.reply('❌ فشل التلخيص حالياً، جرب بعد قليل.');
    }

    const out = `${style.emoji} *ملخص (${style.name} • ${len.name}):*\n\n${res.text}\n\n📊 *الأصلي:* ${targetText.length} حرف → *الملخص:* ${res.text.length} حرف`;
    for (const part of splitText(out)) {
      await m.reply(part);
    }
    await m.react?.('✅');
  } catch (e) {
    console.error('summarize:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل التلخيص، جرب نصاً أقصر');
  }
};

handler.command = ['summarize', 'ملخص', 'اختصار', 'tldr'];
handler.usage = ['summarize <نص>', 'summarize اسلوب <bullets|paragraph|tldr|keywords|action>', 'summarize طول <short|medium|long>', 'summarize إعدادات'];
handler.category = 'ai';
handler.cooldown = 5;
export default handler;