/*
  ═══════════════════════════════════════════
  🌐 ترجمة AI — لغات واتجاهات تفاعلية
  الأمر: .translate / .ترجمة / .trans / .t
  ═══════════════════════════════════════════
*/
import { askAI, translateText } from '../../system/aiService.js';
import { pruneCooldown } from '../../system/cooldowns.js';

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
];

const cooldown = new Map();
const COOLDOWN_MS = 3000;
const userFrom = new Map();
const userTo = new Map();

function buildLangList(direction = 'من', usedPrefix = '.') {
  return LANGUAGES.map((l) => ({
    title: l.name,
    description: l.native,
    id: `${usedPrefix}translate ${direction} ${l.code}`
  }));
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`);
    }

    const subCmd = args[0]?.toLowerCase();

    if (subCmd === 'من' || subCmd === 'from') {
      const code = args[1]?.toLowerCase();
      if (!code) {
        const sections = [{ title: '🌐 اختر اللغة المصدر', rows: buildLangList('من', usedPrefix) }];
        return conn.sendMessage(m.chat, {
          text: '🌐 *اختر اللغة المصدر:*',
          footer: 'LIGHT BOT • Translate',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m });
      }
      if (code === 'auto') {
        userFrom.set(m.sender, 'auto');
        return m.reply('🔍 *تم تعيين اللغة المصدر:* كشف تلقائي');
      }
      const lang = LANGUAGES.find((l) => l.code === code);
      if (!lang) return m.reply('❌ لغة غير موجودة');
      userFrom.set(m.sender, code);
      return m.reply(`${lang.name} *تم تعيين اللغة المصدر*`);
    }

    if (subCmd === 'إلى' || subCmd === 'الى' || subCmd === 'to') {
      const code = args[1]?.toLowerCase();
      if (!code) {
        const sections = [{ title: '🎯 اختر اللغة الهدف', rows: buildLangList('إلى', usedPrefix) }];
        return conn.sendMessage(m.chat, {
          text: '🎯 *اختر اللغة الهدف:*',
          footer: 'LIGHT BOT • Translate',
          buttons: [{ name: 'single_select', params: { title: 'اللغات', sections } }]
        }, { quoted: m });
      }
      const lang = LANGUAGES.find((l) => l.code === code);
      if (!lang) return m.reply('❌ لغة غير موجودة');
      userTo.set(m.sender, code);
      return m.reply(`${lang.name} *تم تعيين اللغة الهدف*`);
    }

    if (subCmd === 'تبديل' || subCmd === 'swap') {
      const from = userFrom.get(m.sender);
      const to = userTo.get(m.sender) || 'ar';
      if (from && from !== 'auto' && to) {
        userFrom.set(m.sender, to);
        userTo.set(m.sender, from);
        const f = LANGUAGES.find((l) => l.code === to);
        const t = LANGUAGES.find((l) => l.code === from);
        return m.reply(`🔄 *تم التبديل:* ${f?.name || to} ↔ ${t?.name || from}`);
      }
      return m.reply('❌ عين لغتي المصدر والهدف أولاً قبل التبديل');
    }

    if (subCmd === 'إعدادات' || subCmd === 'اعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const from = userFrom.get(m.sender) || 'auto';
      const to = userTo.get(m.sender) || 'ar';
      const f = LANGUAGES.find((l) => l.code === from) || { name: '🔍 كشف تلقائي' };
      const t = LANGUAGES.find((l) => l.code === to) || LANGUAGES[0];
      return m.reply(
        `⚙️ *إعدادات الترجمة:*\n\n` +
        `${f.name} → ${t.name}\n\n` +
        `استخدم: \`${usedPrefix}translate من <كود>\` / \`${usedPrefix}translate إلى <كود>\` / \`${usedPrefix}translate تبديل\``
      );
    }

    const targetText = (m.quoted?.text || m.quoted?.msg?.conversation || text || '').trim();
    if (!targetText) {
      const from = userFrom.get(m.sender);
      const to = userTo.get(m.sender);
      return conn.sendMessage(m.chat, {
        text: `🌐 *ترجمة AI*\n\n` +
          `✍️ اكتب النص للترجمة، أو رد على رسالة:\n` +
          `\`${usedPrefix}translate Hello world\`\n\n` +
          `الإعدادات: ${from ? LANGUAGES.find((l) => l.code === from)?.name || '🔍 تلقائي' : '🔍 تلقائي'} → ${to ? LANGUAGES.find((l) => l.code === to)?.name : '🇸🇦 العربية'}`,
        footer: 'LIGHT BOT • Translate',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🌐 من', id: `${usedPrefix}translate من` } },
          { name: 'quick_reply', params: { display_text: '🎯 إلى', id: `${usedPrefix}translate إلى` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}translate إعدادات` } }
        ]
      }, { quoted: m });
    }

    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(m.sender, now);
    await m.react?.('🌐');

    const fromCode = userFrom.get(m.sender) || 'auto';
    const toCode = userTo.get(m.sender) || 'ar';
    const fromLang = LANGUAGES.find((l) => l.code === fromCode)?.name || 'كشف تلقائي';
    const toLang = LANGUAGES.find((l) => l.code === toCode)?.name || 'العربية';

    let answer = await translateText(targetText, toCode, fromCode, 12_000);
    if (!answer || answer === targetText) {
      const aiRes = await askAI({
        prompt: `ترجم النص التالي بدقة من (${fromLang}) إلى (${toLang}) وأعد النص المترجم فقط:\n\n${targetText}`,
        system: 'أنت مترجم محترف. أعد النص المترجم فقط دون مقدمات.',
        timeoutMs: 25_000
      });
      if (aiRes.ok && aiRes.text) answer = aiRes.text;
    }

    if (!answer) {
      await m.react?.('❌');
      return m.reply('❌ تعذرت الترجمة حالياً، حاول مرة أخرى');
    }

    await m.reply(`🌐 *ترجمة:* ${fromLang} → ${toLang}\n\n${answer}`);
    await m.react?.('✅');
  } catch (e) {
    console.error('translate:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل الترجمة، جرب نصاً أقصر');
  }
};

handler.command = ['translate', 'ترجمة', 'trans', 't'];
handler.usage = ['translate <نص>', 'translate من <كود>', 'translate إلى <كود>', 'translate تبديل', 'translate إعدادات'];
handler.category = 'ai';
handler.cooldown = 3;
export default handler;