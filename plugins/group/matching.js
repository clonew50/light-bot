import { searchPinterestImages } from "../../system/mediaService.js";

const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس');

  try {
    let boyUrl = null;
    let girlUrl = null;

    try {
      const { Scrapy } = await import("meowsab");
      const res = await Scrapy.Matching();
      const parsed = typeof res === "string" ? JSON.parse(res) : res;
      if (parsed?.data?.boy && parsed?.data?.girl) {
        boyUrl = parsed.data.boy;
        girlUrl = parsed.data.girl;
      }
    } catch {}

    if (!boyUrl || !girlUrl) {
      const [boys, girls] = await Promise.all([
        searchPinterestImages("anime boy matching pfp icon", 6),
        searchPinterestImages("anime girl matching pfp icon", 6)
      ]);
      boyUrl = boys[Math.floor(Math.random() * Math.max(boys.length, 1))]?.url || null;
      girlUrl = girls[Math.floor(Math.random() * Math.max(girls.length, 1))]?.url || null;
    }

    if (!boyUrl || !girlUrl) {
      return m.reply("❌ تعذر جلب صور التطقيم حالياً، حاول مجدداً.");
    }

    const newsletter = {
      name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      jid: (process.env.BOT_NEWSLETTER_JID || '')
    };

    await conn.sendButtonNormal(m.chat, {
      media: { url: boyUrl },
      mediaType: 'image',
      caption: `# Boy 🚹`,
      buttons: [
        { name: "cta_url", params: { display_text: "📎╎ مــســتــودع الـبــوت ", url: "https://github.com/clonew50/light-bot" } }
      ],
      mentions: [m.sender],
      newsletter
    }, global.reply_status);

    return await conn.sendButtonNormal(m.chat, {
      media: { url: girlUrl },
      mediaType: 'image',
      caption: `# Girl 🚺`,
      buttons: [
        { name: "quick_reply", params: { display_text: "▶️ ╎ الـتـالـي ", id: ".تطقيم" } }
      ],
      mentions: [m.sender],
      newsletter
    }, global.reply_status);
  } catch (e) {
    console.error("matching:", e?.message || e);
    return m.reply(`❌ تعذر جلب التطقيم: ${e?.message || "خطأ غير معروف"}`);
  }
};

handler.usage = ["تطقيم"];
handler.category = "group";
handler.group = true;
handler.command = ["ماتشينج", "تطقيم"];

export default handler;