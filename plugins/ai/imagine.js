/*
  ═══════════════════════════════════════════
  🎨 توليد صور متقدم — إعدادات تفصيلية
  الأمر: .imagine / .تخيل / .توليد-متقدم
  ═══════════════════════════════════════════
*/
import { generateAIImage } from '../../system/aiService.js';

const MODELS = [
  { id: 'flux', name: 'Flux', desc: 'جودة عالية وتفاصيل دقيقة', emoji: '🌊' },
  { id: 'flux-realism', name: 'Flux Realism', desc: 'صور واقعية فوتوغرافية', emoji: '📸' },
  { id: 'flux-anime', name: 'Flux Anime', desc: 'رسوم أنمي/مانجا', emoji: '🎌' },
  { id: 'sdxl', name: 'SDXL', desc: 'أسلوب رسم احترافي متوازن', emoji: '🖌️' },
  { id: 'dalle3', name: 'DALL-E 3', desc: 'دقة عالية وتكوين متقن', emoji: '🎨' },
  { id: 'midjourney', name: 'Midjourney v6', desc: 'فني وسينمائي', emoji: '🎭' },
];

const ASPECT_RATIOS = [
  { id: '1:1', name: 'مربع (1:1)', w: 768, h: 768, emoji: '📐' },
  { id: '16:9', name: 'أفقي (16:9)', w: 960, h: 576, emoji: '🖥️' },
  { id: '9:16', name: 'عمودي (9:16)', w: 576, h: 960, emoji: '📱' },
  { id: '4:3', name: 'كلاسيكي (4:3)', w: 768, h: 576, emoji: '📺' },
  { id: '3:4', name: 'بورتريه (3:4)', w: 576, h: 768, emoji: '🖼️' },
  { id: '21:9', name: 'سينمائي (21:9)', w: 1024, h: 448, emoji: '🎬' },
];

const STYLES = [
  { id: 'none', name: 'بدون أسلوب', emoji: '⚪' },
  { id: 'photorealistic', name: 'فوتوغرافي', emoji: '📸' },
  { id: 'cinematic', name: 'سينمائي', emoji: '🎬' },
  { id: 'anime', name: 'أنمي', emoji: '🎌' },
  { id: 'digital-art', name: 'فن رقمي', emoji: '🎨' },
  { id: 'oil-painting', name: 'رسم زيتي', emoji: '🖼️' },
  { id: 'watercolor', name: 'ألوان مائية', emoji: '💧' },
  { id: 'sketch', name: 'رسم تخطيطي', emoji: '✏️' },
  { id: '3d-render', name: 'ثلاثي الأبعاد', emoji: '🎮' },
  { id: 'pixel-art', name: 'بكسل آرت', emoji: '🕹️' },
  { id: 'cyberpunk', name: 'سايبربانك', emoji: '🌆' },
  { id: 'fantasy', name: 'فانتازي', emoji: '🏰' },
];

const userSettings = new Map();

function getSettings(sender) {
  if (!userSettings.has(sender)) {
    userSettings.set(sender, {
      model: 'flux',
      ratio: '1:1',
      style: 'none',
      negative: '',
      seed: -1,
      steps: 24,
      cfg: 7
    });
  }
  return userSettings.get(sender);
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now();

    const subCmd = args[0]?.toLowerCase();
    const settings = getSettings(m.sender);

    if (subCmd === 'نموذج' || subCmd === 'model') {
      const id = args[1]?.toLowerCase();
      if (!id) {
        return conn.sendMessage(m.chat, {
          text: '🎨 اختر النموذج:',
          footer: 'LIGHT BOT • Imagine',
          buttons: MODELS.map((mdl) => ({
            name: 'quick_reply',
            params: { display_text: `${mdl.emoji} ${mdl.name}`, id: `${usedPrefix}imagine نموذج ${mdl.id}` }
          }))
        }, { quoted: m });
      }
      const mdl = MODELS.find((x) => x.id === id);
      if (!mdl) return m.reply('❌ نموذج غير موجود');
      settings.model = id;
      return m.reply(`${mdl.emoji} تم اختيار: ${mdl.name}`);
    }

    if (subCmd === 'نسبة' || subCmd === 'ratio' || subCmd === 'أبعاد') {
      const id = args[1]?.toLowerCase();
      if (!id) {
        return conn.sendMessage(m.chat, {
          text: '📐 اختر النسبة:',
          footer: 'LIGHT BOT • Imagine',
          buttons: ASPECT_RATIOS.map((r) => ({
            name: 'quick_reply',
            params: { display_text: `${r.emoji} ${r.name}`, id: `${usedPrefix}imagine نسبة ${r.id}` }
          }))
        }, { quoted: m });
      }
      const ratio = ASPECT_RATIOS.find((x) => x.id === id);
      if (!ratio) return m.reply('❌ نسبة غير موجودة');
      settings.ratio = id;
      return m.reply(`${ratio.emoji} تم اختيار: ${ratio.name}`);
    }

    if (subCmd === 'أسلوب' || subCmd === 'اسلوب' || subCmd === 'style') {
      const id = args[1]?.toLowerCase();
      if (!id) {
        return conn.sendMessage(m.chat, {
          text: '🎨 اختر الأسلوب:',
          footer: 'LIGHT BOT • Imagine',
          buttons: STYLES.slice(0, 6).map((s) => ({
            name: 'quick_reply',
            params: { display_text: `${s.emoji} ${s.name}`, id: `${usedPrefix}imagine أسلوب ${s.id}` }
          }))
        }, { quoted: m });
      }
      const style = STYLES.find((x) => x.id === id);
      if (!style) return m.reply('❌ أسلوب غير موجود');
      settings.style = id;
      return m.reply(`${style.emoji} تم اختيار: ${style.name}`);
    }

    if (subCmd === 'سلبي' || subCmd === 'negative') {
      const neg = args.slice(1).join(' ');
      settings.negative = neg || '';
      return m.reply(neg ? `🚫 السلبي: ${neg}` : '🚫 تم مسح الوصف السلبي');
    }

    if (subCmd === 'بذرة' || subCmd === 'seed') {
      const seed = parseInt(args[1], 10);
      if (isNaN(seed)) return m.reply('❌ بذرة غير صالحة');
      settings.seed = seed;
      return m.reply(`🌰 البذرة: ${seed}`);
    }

    if (subCmd === 'خطوات' || subCmd === 'steps') {
      const steps = parseInt(args[1], 10);
      if (isNaN(steps) || steps < 10 || steps > 100) return m.reply('❌ خطوات 10-100');
      settings.steps = steps;
      return m.reply(`👣 الخطوات: ${steps}`);
    }

    if (subCmd === 'توجيه' || subCmd === 'cfg') {
      const cfg = parseFloat(args[1]);
      if (isNaN(cfg) || cfg < 1 || cfg > 20) return m.reply('❌ CFG 1-20');
      settings.cfg = cfg;
      return m.reply(`⚙️ CFG: ${cfg}`);
    }

    if (subCmd === 'إعدادات' || subCmd === 'اعدادات' || subCmd === 'settings' || subCmd === 'current') {
      const mdl = MODELS.find((x) => x.id === settings.model) || MODELS[0];
      const ratio = ASPECT_RATIOS.find((x) => x.id === settings.ratio) || ASPECT_RATIOS[0];
      const style = STYLES.find((x) => x.id === settings.style) || STYLES[0];
      return m.reply(
        `⚙️ *إعدادات Imagine:*\n\n` +
        `${mdl.emoji} *النموذج:* ${mdl.name}\n` +
        `${ratio.emoji} *النسبة:* ${ratio.name} (${ratio.w}x${ratio.h})\n` +
        `${style.emoji} *الأسلوب:* ${style.name}\n` +
        `${settings.negative ? `🚫 *السلبي:* ${settings.negative}\n` : ''}` +
        `${settings.seed !== -1 ? `🌰 *البذرة:* ${settings.seed}\n` : ''}` +
        `👣 *الخطوات:* ${settings.steps} | ⚙️ *CFG:* ${settings.cfg}`
      );
    }

    if (subCmd === 'ريست' || subCmd === 'reset') {
      userSettings.delete(m.sender);
      return m.reply('🔄 تم إعادة الإعدادات للافتراضي');
    }

    const prompt = (text || '').trim();
    if (!prompt) {
      return conn.sendMessage(m.chat, {
        text: `🎨 *توليد صور متقدم (Imagine)*\n\n` +
          `اكتب الوصف بعد الأمر:\n` +
          `\`${usedPrefix}imagine قطة فضاء ببدلة لامعة\`\n\n` +
          `الإعدادات الحالية جاهزة، أو عدلها بالأزرار:`,
        footer: 'LIGHT BOT • Imagine',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎨 نموذج', id: `${usedPrefix}imagine نموذج` } },
          { name: 'quick_reply', params: { display_text: '📐 نسبة', id: `${usedPrefix}imagine نسبة` } },
          { name: 'quick_reply', params: { display_text: '🎨 أسلوب', id: `${usedPrefix}imagine أسلوب` } },
          { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}imagine إعدادات` } }
        ]
      }, { quoted: m });
    }

    await m.react?.('🎨');

    const ratio = ASPECT_RATIOS.find((x) => x.id === settings.ratio) || ASPECT_RATIOS[0];
    const style = STYLES.find((x) => x.id === settings.style) || STYLES[0];
    const model = MODELS.find((x) => x.id === settings.model) || MODELS[0];

    const res = await generateAIImage({
      prompt,
      width: ratio.w,
      height: ratio.h,
      model: model.id,
      style: style.id,
      negative: settings.negative,
      seed: settings.seed
    });

    if (!res.ok || !res.buffer?.length) {
      await m.react?.('❌');
      return m.reply('❌ فشل التوليد حالياً، جرب وصفاً أبسط أو أعد المحاولة بعد قليل');
    }

    await conn.sendMessage(m.chat, {
      image: res.buffer,
      mimetype: 'image/jpeg',
      caption: `🎨 *${prompt}*\n\n${model.emoji} ${model.name} • ${ratio.emoji} ${ratio.name} • ${style.emoji} ${style.name}`
    }, { quoted: m });

    await m.react?.('✅');
  } catch (e) {
    console.error('imagine:', e?.message || e);
    await m.react?.('❌');
    return m.reply('❌ فشل التوليد، جرب وصفاً أبسط أو نموذجاً آخر');
  }
};

handler.command = ['imagine', 'تخيل', 'توليد-متقدم', 'imagine-adv'];
handler.usage = ['imagine <وصف>', 'imagine نموذج <flux|sdxl|dalle3|...>', 'imagine نسبة <1:1|16:9|9:16|...>', 'imagine أسلوب <photorealistic|anime|...>', 'imagine سلبي <ما لا تريد>', 'imagine بذرة <رقم>', 'imagine خطوات <10-100>', 'imagine توجيه <1-20>', 'imagine إعدادات', 'imagine ريست'];
handler.category = 'ai';
export default handler;