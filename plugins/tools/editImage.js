import sharp from 'sharp';
import { generateAIImage } from '../../system/aiService.js';

function tryLocalFilter(buffer, prompt) {
  const p = prompt.trim().toLowerCase();

  if (/^(رمادي|ابيض واسود|أبيض وأسود|grayscale|bw)$/.test(p)) {
    return {
      label: 'أبيض وأسود',
      run: () => sharp(buffer).grayscale().jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(بلور|ضباب|ضبابي|تغبيش|blur)$/.test(p)) {
    return {
      label: 'تأثير ضبابي',
      run: () => sharp(buffer).blur(8).jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(عكس|نيجاتيف|negate|invert)$/.test(p)) {
    return {
      label: 'عكس الألوان',
      run: () => sharp(buffer).negate({ alpha: false }).jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(اقلب|قلب|flip)$/.test(p)) {
    return {
      label: 'قلب عمودي',
      run: () => sharp(buffer).flip().jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(مرآة|مراية|flop|mirror)$/.test(p)) {
    return {
      label: 'عكس أفقي (مرآة)',
      run: () => sharp(buffer).flop().jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(تدوير|دوران|rotate)$/.test(p)) {
    return {
      label: 'تدوير 90°',
      run: () => sharp(buffer).rotate(90).jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(سطوع|اضاءة|إضاءة|bright|brighten)$/.test(p)) {
    return {
      label: 'زيادة السطوع والوضوح',
      run: () => sharp(buffer).modulate({ brightness: 1.25, saturation: 1.15 }).sharpen().jpeg({ quality: 92 }).toBuffer()
    };
  }
  if (/^(وضوح|تحسين|حدة|sharpen|hd)$/.test(p)) {
    return {
      label: 'تحسين الحدة والوضوح',
      run: () => sharp(buffer).sharpen({ sigma: 1.5 }).normalize().jpeg({ quality: 92 }).toBuffer()
    };
  }
  return null;
}

let handler = async (m, { conn, text }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mimetype || '';

  if (!mime.includes('image')) {
    return m.reply(
      '📷 رد على صورة بالأمر مع التعديل المطلوب\n' +
      '• فلاتر فورية: `رمادي` | `بلور` | `عكس` | `مرآة` | `تدوير` | `سطوع` | `وضوح`\n' +
      '• تعديل بالذكاء الاصطناعي: `.تعديل اجعل الخلفية شاطئ عند الغروب`'
    );
  }

  const prompt = (text || '').split('|')[0].trim();
  if (!prompt) {
    return m.reply('✍️ اكتب التعديل المطلوب مع الأمر\nمثال: `.تعديل اجعلها بأسلوب أنمي` أو `.تعديل رمادي`');
  }

  await m.reply('⏳ جاري تعديل الصورة...');

  try {
    const rawBuffer = await q.download();
    if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
      return m.reply('❌ تعذر تحميل الصورة المرفقة');
    }

    const local = tryLocalFilter(rawBuffer, prompt);
    if (local) {
      const out = await local.run();
      await conn.sendMessage(
        m.chat,
        { image: out, caption: `✅ تم تطبيق: *${local.label}*` },
        { quoted: m }
      );
      return;
    }

    // تحويل/تصغير الصورة إلى 512px JPEG حتى يقبلها محرك AI img2img بسلاسة
    const normalized = await sharp(rawBuffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const res = await generateAIImage({
      prompt,
      width: 512,
      height: 512,
      sourceImageBase64: normalized.toString('base64'),
      timeoutMs: 90_000
    });

    if (!res.ok || !res.buffer) {
      return m.reply(`❌ فشل تعديل الصورة: ${res.error || 'تعذر الاتصال بمحرك التعديل'}`);
    }

    await conn.sendMessage(
      m.chat,
      { image: res.buffer, caption: `✅ *تم تعديل الصورة*\n🎨 *التعديل:* ${prompt}` },
      { quoted: m }
    );
  } catch (e) {
    m.reply(`❌ فشل تعديل الصورة: ${e.message}`);
  }
};

handler.usage = ['تعديل <النص>'];
handler.command = ['editimage', 'تعديل', 'عدل'];
handler.category = 'tools';

export default handler;
