/*
  ═══════════════════════════════════════════
  🎨 توليد صور AI — نماذج وأحجام تفاعلية
  الأمر: .imggen / .توليد / .صورة / .imagegen
  ═══════════════════════════════════════════
*/
import { generateAIImage } from '../../system/aiService.js';

const MODELS = [
  { id: 'flux', name: '🌊 Flux', desc: 'جودة عالية وتفاصيل دقيقة', emoji: '🌊' },
  { id: 'dalle3', name: '🎨 DALL-E 3', desc: 'دقة عالية وتكوين متقن', emoji: '🎨' },
  { id: 'sdxl', name: '🖌️ SDXL', desc: 'أسلوب رسم احترافي', emoji: '🖌️' },
  { id: 'midjourney', name: '🎭 Midjourney v6', desc: 'فني وسينمائي', emoji: '🎭' },
];

const SIZES = [
  { id: '768x768', name: '📐 مربع (1:1)', emoji: '📐' },
  { id: '576x960', name: '📱 عمودي (9:16)', emoji: '📱' },
  { id: '960x576', name: '🖥️ أفقي (16:9)', emoji: '🖥️' },
  { id: '512x512', name: '⚡ سريع (512)', emoji: '⚡' },
];

const userModel = new Map();
const userSize = new Map();

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();

    const subCmd = args[0]?.toLowerCase();

    if (subCmd === 'نموذج' || subCmd === 'model') {
      const modelId = args[1]?.toLowerCase();
      if (!modelId) {
        return conn.sendMessage(m.chat, {
          text: '🎨 *اختر نموذج التوليد:*',
          footer: 'LIGHT BOT • Image Gen',
          buttons: MODELS.map((mdl) => ({
            name: 'quick_reply',
            params: { display_text: mdl.name, id: `${usedPrefix}imggen نموذج ${mdl.id}` }
          }))
        }, { quoted: m });
      }
      const model = MODELS.find((x) => x.id === modelId);
      if (!model) return m.reply('❌ نموذج غير موجود');
      userModel.set(m.sender, modelId);
      return m.reply(`${model.emoji} *تم اختيار:* ${model.name}`);
    }

    if (subCmd === 'حجم' || subCmd === 'size') {
      const sizeId = args[1]?.toLowerCase();
      if (!sizeId) {
        return conn.sendMessage(m.chat, {
          text: '📐 *اختر حجم الصورة:*',
          footer: 'LIGHT BOT • Image Gen',
          buttons: SIZES.map((s) => ({
            name: 'quick_reply',
            params: { display_text: s.name, id: `${usedPrefix}imggen حجم ${s.id}` }
          }))
        }, { quoted: m });
      }
      const size = SIZES.find((s) => s.id === sizeId);
      if (!size) return m.reply('❌ حجم غير موجود');
      userSize.set(m.sender, sizeId);
      return m.reply(`${size.emoji} *تم اختيار:* ${size.name}`);
    }

    if (subCmd === 'إعدادات' || subCmd === 'اعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const model = MODELS.find((m2) => m2.id === userModel.get(m.sender)) || MODELS[0];
      const size = SIZES.find((s) => s.id === userSize.get(m.sender)) || SIZES[0];
      return m.reply(
        `⚙️ *إعدادات التوليد الحالية:*\n\n` +
        `*النموذج:* ${model.name}\n` +
        `*الحجم:* ${size.name}\n\n` +
        `استخدم: \`${usedPrefix}imggen نموذج <اسم>\` أو \`${usedPrefix}imggen حجم <مقاس>\``
      );
    }

    const prompt = (text || '').trim();
    if (!prompt) {
      return conn.sendMessage(m.chat, {
        text: `🎨 *توليد صور AI*\n\n` +
          `اكتب وصف الصورة بعد الأمر:\n` +
          `\`${usedPrefix}imggen قطة تلبس بدلة فضاء\`\n\n` +
          `الإعدادات الحالية: ${(userModel.get(m.sender) ? MODELS.find((x) => x.id === userModel.get(m.sender))?.name : 'Flux')} • ${(userSize.get(m.sender) ? SIZES.find((x) => x.id === userSize.get(m.sender))?.name : 'مربع (1:1)')}`,
        footer: 'LIGHT BOT • Image Gen',
        buttons: [
          ...MODELS.slice(0, 2).map((mdl) => ({
            name: 'quick_reply',
            params: { display_text: mdl.name, id: `${usedPrefix}imggen نموذج ${mdl.id}` }
          })),
          ...SIZES.slice(0, 2).map((s) => ({
            name: 'quick_reply',
            params: { display_text: s.name, id: `${usedPrefix}imggen حجم ${s.id}` }
          })),
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}imggen إعدادات` } }
        ]
      }, { quoted: m });
    }

    await m.react?.('🎨');

    const modelId = userModel.get(m.sender) || 'flux';
    const sizeId = userSize.get(m.sender) || '768x768';
    const [w, h] = sizeId.split('x').map(Number);

    const res = await generateAIImage({ prompt, width: w, height: h, model: modelId });
    if (!res.ok || !res.buffer?.length) {
      await m.react?.('❌');
      return m.reply('❌ فشل توليد الصورة حالياً، جرب وصفاً أبسط أو أعد المحاولة بعد قليل');
    }

    const modelObj = MODELS.find((x) => x.id === modelId) || MODELS[0];
    const sizeObj = SIZES.find((x) => x.id === sizeId) || SIZES[0];

    await conn.sendMessage(m.chat, {
      image: res.buffer,
      mimetype: 'image/jpeg',
      caption: `🎨 *${prompt}*\n\n${modelObj.name} • ${sizeObj.name}`
    }, { quoted: m });

    await m.react?.('✅');
  } catch (e) {
    console.error('imggen:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل توليد الصورة، جرب وصفاً أبسط أو نموذجاً آخر');
  }
};

handler.command = ['imggen', 'توليد', 'صورة', 'imagegen'];
handler.usage = ['imggen <وصف>', 'imggen نموذج <flux|dalle3|sdxl|midjourney>', 'imggen حجم <768x768|576x960|960x576|512x512>', 'imggen إعدادات'];
handler.category = 'ai';
export default handler;