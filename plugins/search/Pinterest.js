import { searchPinterestImages } from "../../system/mediaService.js";

async function handler(m, { conn, text }) {
  try {
    if (!text) return m.reply("*اكتب اسم الصورة عشان تظهر لك 📸*\nمثال: `.بينترست انمي ليفاي`");

    await m.react("🔍").catch(() => {});
    const arr = await searchPinterestImages(text, 12);

    if (!arr || arr.length === 0) {
      return m.reply("*⚠️ لا توجد نتائج لهذه الكلمة، جرب كلمة أبسط*");
    }

    const start = arr.length > 10 ? Math.floor(Math.random() * (arr.length - 10)) : 0;
    const selectedImages = arr.slice(start, start + 10);

    const cards = selectedImages.map((item, index) => {
      const title = item.title && item.title !== 'No title' ? item.title : `Image ~ ${index + 1}`;
      return {
        imageUrl: item.url,
        bodyText: `*${title}*`,
        footerText: item.owner ? `👤 ${item.owner} • Pinterest` : '📌 Pinterest Image',
        buttons: [
          { name: 'cta_url', params: { display_text: '🔗╎ رؤيـتـهـا', url: item.pinUrl || item.url } },
          { name: 'cta_copy', params: { display_text: '📋╎ نـسـخ الـرابــط', copy_code: item.url } }
        ]
      };
    });

    try {
      return await conn.sendCarousel(m.chat, {
        headerText: `📸 البحث الخاص بك → *[ ${text} ]* `,
        globalFooterText: 'اسحب لرؤية المزيد من الصور',
        cards,
        mentions: [m.sender],
        newsletter: {
          name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
          jid: (process.env.BOT_NEWSLETTER_JID || '')
        }
      }, global.reply_status);
    } catch {
      const first = selectedImages[0];
      return await conn.sendMessage(m.chat, {
        image: { url: first.url },
        caption: `📸 *نتائج البحث عن:* ${text}\n\n` + selectedImages.slice(0, 5).map((i, idx) => `${idx + 1}. ${i.url}`).join('\n')
      }, { quoted: m });
    }
  } catch (error) {
    console.error('pinterest:', error?.message || error);
    await m.react("❌").catch(() => {});
    return m.reply(`❌ تعذر البحث في بينتريست: ${error?.message || 'خطأ غير معروف'}`);
  }
}

handler.category = "search";
handler.usage = ["بينترست"];
handler.command = ["بين", "بينترست", "pinterest"];
export default handler;