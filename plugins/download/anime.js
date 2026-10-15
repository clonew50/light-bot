import { Scrapy } from "meowsab";

const handler = async (m, { conn, text, command }) => {
  if (!text) return m.reply("*مثال: .انمي death note*");

  if (command === "انمي") {
    if (!/^[A-Za-z0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]*$/.test(text)) {
      return m.reply("⚠️ اكتب اسم الأنمي بالإنجليزية فقط!\nمثال: .انمي Naruto");
    }

    const response = await Scrapy.Witanime({ query: text, choose: "search" });
    const results = response?.data;
    if (!Array.isArray(results) || !results.length) {
      return m.reply("❌ لم يتم العثور على نتائج، تأكد من كتابة الاسم الصحيح.");
    }

    const sections = [{
      title: "📺 نتائج البحث",
      rows: results.map(anime => ({
        title: anime.name || "غير معروف",
        description: `⭐ ${anime.rating || "غير معروف"} | 👁️ ${anime.views || 0} | ${anime.release_date || "غير معروف"}`,
        id: `.تحميل_انمي ${anime.id}`
      }))
    }];

    return conn.sendButtonNormal(m.chat, {
      media: { url: results[0]?.poster },
      mediaType: 'image',
      caption: `📌 *نتائج البحث عن:* "${text}"\n\n${results.map((anime, index) => `${index + 1}. *${anime.name || "غير معروف"}*\n⭐ ${anime.rating || "غير معروف"} | 🎬 ${anime.genre || "غير معروف"} | 📅 ${anime.release_date || "غير معروف"}\n👁️ ${Number(anime.views || 0).toLocaleString()}\n${'─'.repeat(20)}`).join('\n')}`,
      buttons: [{
        name: "single_select",
        params: { title: "🎬 اختر الأنمي", sections }
      }],
      mentions: [m.sender],
      newsletter: {
        name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        jid: '120363405545946827@newsletter'
      }
    }, m);
  }

  if (command === "تحميل_انمي") {
    const response = await Scrapy.Witanime({ query: text, choose: "id" });
    const data = response?.data;
    if (!data || !Array.isArray(data.episodes)) return m.reply('❌ بيانات الأنمي غير متاحة.');

    const sections = [{
      title: `📺 ${data.name || 'الأنمي'}`,
      rows: data.episodes.map(episode => ({
        title: `${episode.name || `الحلقة ${episode.episode_number}`}`,
        description: `📅 ${episode.air_date || "غير محدد"}`,
        id: `.جلب_حلقة ${text}|${episode.episode_number}`
      }))
    }];

    return conn.sendButtonNormal(m.chat, {
      media: { url: data.poster },
      mediaType: 'image',
      caption: `🎬 *${data.name || "الأنمي"}*\n⭐ ${data.rating || "غير معروف"} | 👁️ ${Number(data.views || 0).toLocaleString()}\n📅 ${data.first_air_date || "غير معروف"}\n🎭 ${Array.isArray(data.genres) ? data.genres.join(", ") : "غير محدد"}\n\n📝 ${String(data.overview || '').slice(0, 200)}...`,
      buttons: [{
        name: "single_select",
        params: { title: "🎬 اختر الحلقة", sections }
      }],
      mentions: [m.sender],
      newsletter: {
        name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        jid: '120363405545946827@newsletter'
      }
    }, m);
  }

  if (command === "جلب_حلقة") {
    const [id, episodeNumber] = text.split("|");
    if (!id || !episodeNumber) return m.reply("البيانات المطلوبة: id|episode_number");

    const response = await Scrapy.Witanime({ query: id, choose: "id" });
    const data = response?.data;
    const episode = data?.episodes?.find(item => String(item.episode_number) === String(episodeNumber));
    if (!episode) return m.reply("الحلقة غير موجودة");
    if (!Array.isArray(episode.download_links) || !episode.download_links.length) {
      return m.reply("❌ لا توجد روابط تحميل للحلقة.");
    }

    const sections = [{
      title: `🎬 ${data.name || "الأنمي"} - الحلقة ${episodeNumber}`,
      rows: episode.download_links.map(link => ({
        title: `📥 ${link.quality || "جودة غير محددة"}`,
        description: "اضغط للتحميل",
        id: `.رابط_تحميل ${link.url}|${data.name || "أنمي"}|${episodeNumber}|${link.quality || "جودة"}`
      }))
    }];

    return conn.sendButtonNormal(m.chat, {
      media: { url: episode.thumbnail },
      mediaType: 'image',
      caption: `🎬 *${data.name || "الأنمي"}*\n📺 *${episode.name || `الحلقة ${episodeNumber}`}* | 📅 ${episode.air_date || "غير محدد"}\n\n🎀 اختار جودة الفيديو:`,
      buttons: [{
        name: "single_select",
        params: { title: "📥 جودة التحميل", sections }
      }],
      mentions: [m.sender],
      newsletter: {
        name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        jid: '120363405545946827@newsletter'
      }
    }, m);
  }

  if (command === "رابط_تحميل") {
    const [url, name, episodeNumber, quality] = text.split("|");
    if (!url) return m.reply("❌ رابط التحميل مش موجود.");

    return conn.sendButtonNormal(m.chat, {
      media: { url: 'https://witanime.life/wp-content/uploads/2023/08/cropped-Logo-WITU-192x192.png' },
      mediaType: 'image',
      caption: `🎬 *${name || "أنمي"}*\n📺 الحلقة ${episodeNumber || "?"}\n📥 الجودة: *${quality || "غير محددة"}*\n\n🔗 رابط التحميل:\n${url}`,
      buttons: [{
        name: "cta_url",
        params: { display_text: "🔗 Download", url }
      }],
      mentions: [m.sender],
      newsletter: {
        name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        jid: '120363405545946827@newsletter'
      }
    }, m);
  }
};

handler.usage = ["انمي"];
handler.command = ["انمي", "تحميل_انمي", "جلب_حلقة", "رابط_تحميل"];
handler.category = "downloads";

export default handler;
