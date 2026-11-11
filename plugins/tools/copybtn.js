/*
  ═══════════════════════════════════════════
  📋 زر نسخ — رسالة تفاعلية فيها زر "نسخ" (بروتوكول cta_copy الرسمي)
  للمطورين: تبعت أي نص/كود/رابط واللي يوصله يقدر ينسخه بضغطة واحدة.

  الأمر (للمطورين فقط):
    .زر_نسخ <نص>
    مثال:  .زر_نسخ LIGHT-BOT-2026
  ═══════════════════════════════════════════
*/

const COOLDOWN_MS = 5 * 1000;
const cooldown = new Map();

const DEFAULT_IMG = 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg';
const getImg = (bot) => {
  const images = bot?.config?.info?.images || global.config?.info?.images;
  if (!images) return DEFAULT_IMG;
  return Array.isArray(images) ? images[Math.floor(Math.random() * images.length)] : images;
};

const handler = async (m, { conn, bot, args }) => {
  try {
    const content = (args || []).join(' ').trim();
    if (!content) {
      await conn.sendMessage(m.chat, { text: '✍️ اكتب اللي عايز يتنسخ بعد الأمر:\n.زر_نسخ LIGHT-2026' }, { quoted: m });
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());

    if (typeof conn?.sendButtonNormal === 'function') {
      await conn.sendButtonNormal(m.chat, {
        media: { url: getImg(bot) },
        mediaType: 'image',
        caption: '📋 اضغط الزر لنسخ المحتوى:',
        buttons: [
          {
            name: 'cta_copy',
            params: {
              display_text: '📋 انسخ',
              copy_code: content
            }
          }
        ]
      }, m);
      return;
    }
    // احتياطي: نص عادي في بلوك كود (بيتنسخ من واتساب برضو بسهولة)
    await conn.sendMessage(m.chat, { text: '```\n' + content + '\n```' }, { quoted: m });
  } catch (e) {
    console.error('❌ [زر_نسخ]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في إرسال زر النسخ.' }, { quoted: m });
  }
};

handler.command = ['زر_نسخ', 'copybtn'];
handler.usage = ['.زر_نسخ <نص>'];
handler.category = 'tools';
handler.owner = true;
handler.cooldown = 5;

export default handler;
