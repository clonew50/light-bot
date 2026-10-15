import axios from 'axios';
import FormData from 'form-data';

const EDIT_API = 'https://api-faa.my.id/faa/nano-banana';
const UPLOAD_API = 'https://uguu.se/upload.php';

async function uploadToUguu(buffer) {
  const form = new FormData();
  form.append('files[]', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
  const { data } = await axios.post(UPLOAD_API, form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: Infinity,
  });
  const url = data?.files?.[0]?.url;
  if (!url) throw new Error('رفع الصورة فشل');
  return url;
}

async function uploadImage(buffer) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      return await uploadToUguu(buffer);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr || new Error('رفع الصورة فشل');
}

async function editImage(imageUrl, prompt) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await axios.get(EDIT_API, {
        params: { url: imageUrl, prompt },
        responseType: 'arraybuffer',
        timeout: 180000,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      });
      const ct = res.headers['content-type'] || '';
      if (ct.includes('image')) return Buffer.from(res.data);
      const body = Buffer.from(res.data).toString('utf8');
      throw new Error(body.slice(0, 300) || `HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr || new Error('تعديل الصورة فشل');
}

let handler = async (m, { conn, text }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mimetype || '';

  if (!mime.includes('image')) {
    return m.reply('📷 رد على صورة بالأمر مع النص المطلوب\nمثال: .تعديل اجعل لون البشرة اسود');
  }

  let prompt = (text || '').split('|')[0].trim();
  if (!prompt) {
    return m.reply('✍️ اكتب النص المطلوب مع الأمر\nمثال: .تعديل اجعل الخلفية شاطئ');
  }

  await m.reply('⏳ جاري تعديل الصورة...');

  try {
    const buffer = await q.download();
    const imageUrl = await uploadImage(buffer);
    const result = await editImage(imageUrl, prompt);

    await conn.sendMessage(
      m.chat,
      { image: result, caption: '✅ تم التعديل' },
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
