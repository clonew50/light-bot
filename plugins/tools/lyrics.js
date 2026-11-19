import { Scrapy } from "meowsab";
import { splitText } from "../../system/text-chunks.js";

async function fetchLrcLib(query) {
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'LightBot/1.0' },
    signal: AbortSignal.timeout(12_000)
  });
  if (!res.ok) return null;
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) return null;
  const item = list.find((x) => x?.plainLyrics) || list[0];
  if (!item?.plainLyrics) return null;
  return {
    trackName: item.trackName || item.name || query,
    artistName: item.artistName || 'غير معروف',
    albumName: item.albumName || 'غير معروف',
    duration: Number(item.duration) || 0,
    plainLyrics: item.plainLyrics
  };
}

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("مثال: .كلمات Shiloh again");

  let data = null;
  try {
    const response = await Scrapy.lyrics(text);
    if (response?.ok && response?.data?.plainLyrics) {
      data = response.data;
    }
  } catch {}

  if (!data) {
    try {
      data = await fetchLrcLib(text);
    } catch {}
  }

  if (!data) return m.reply("❌ لم يتم العثور على كلمات الأغنية");

  let result = `🎵 *${data.trackName}* 🎵\n`;
  result += `👤 *الفنان:* ${data.artistName}\n`;
  result += `💿 *الألبوم:* ${data.albumName}\n`;
  if (data.duration > 0) {
    result += `⏱️ *المدة:* ${Math.floor(data.duration / 60)}:${Math.floor(data.duration % 60).toString().padStart(2, '0')}\n\n`;
  } else {
    result += `\n`;
  }
  result += `📝 *كلمات الأغنية:*\n\`\`\`\n${data.plainLyrics}\n\`\`\``;

  for (const part of splitText(result)) {
    await conn.sendMessage(m.chat, { text: part }, { quoted: m });
  }
};

handler.usage = ["كلمات"];
handler.command = ["كلمات", "lyrics"];
handler.category = "tools";

export default handler;