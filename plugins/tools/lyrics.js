import { Scrapy } from "meowsab";
import { splitText } from "../../system/text-chunks.js";

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("مثال: .كلمات Shiloh again");

  let response;
  try {
    response = await Scrapy.lyrics(text);
  } catch (e) {
    return m.reply("❌ تعذر جلب الكلمات");
  }
  
  if (!response.ok) return m.reply("❌ لم يتم العثور على كلمات الأغنية");
  
  const data = response.data;
  
  let result = `🎵 *${data.trackName}* 🎵\n`;
  result += `👤 *الفنان:* ${data.artistName}\n`;
  result += `💿 *الألبوم:* ${data.albumName}\n`;
  result += `⏱️ *المدة:* ${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}\n\n`;
  result += `📝 *كلمات الأغنية:*\n\`\`\`\n${data.plainLyrics}\n\`\`\``;
  
  // كلمات الأغنية الطويلة بتتجاوز حد الواتساب، فبنبعت النص على رسائل
  // متتابعة بدل ما الرسالة تضيع.
  for (const part of splitText(result)) {
    await conn.sendMessage(m.chat, { text: part }, { quoted: m });
  }
}

handler.usage = ["كلمات"];
handler.command = ["كلمات", "lyrics"];
handler.category = "tools";

export default handler;