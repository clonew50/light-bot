import * as ruhend from "ruhend-scraper";

const insta = async (m, { text, Api, conn }) => {
  if (!text) return m.reply("*❌: حط الرابط جنب الامر*");
  await m.react("⏳").catch(() => {});

  try {
    let items = [];

    try {
      if (Api?.download?.instagram) {
        const res = await Api.download.instagram({ url: text.trim() });
        if (res?.status === "success" && Array.isArray(res.data)) {
          items = res.data;
        }
      }
    } catch {}

    if (!items.length) {
      const dl = await ruhend.igdl(text.trim());
      const raw = dl?.data || dl?.results || (Array.isArray(dl) ? dl : []);
      for (const entry of Array.isArray(raw) ? raw : []) {
        if (!entry?.url) continue;
        const isImg = entry.type === "image" || entry.type === "thumbnail" || /\.(jpe?g|png|webp)(\?|$)/i.test(entry.url);
        items.push({ type: isImg ? "thumbnail" : "video", url: entry.url });
      }
      if (!items.length && dl?.url) {
        items.push({ type: "video", url: dl.url });
      }
    }

    if (!items.length) {
      await m.react("❌").catch(() => {});
      return m.reply("❌ لم يتم العثور على وسائط صالحة في رابط إنستغرام");
    }

    let sent = 0;
    for (const item of items.slice(0, 6)) {
      if (!item?.url) continue;
      if (item.type === "video") {
        await conn.sendMessage(m.chat, { video: { url: item.url }, caption: "*تم التحميل من إنستغرام ✅*" }, { quoted: m });
        sent++;
      } else {
        await conn.sendMessage(m.chat, { image: { url: item.url }, caption: sent === 0 ? "*تم التحميل من إنستغرام ✅*" : "" }, { quoted: m });
        sent++;
      }
    }

    if (!sent) {
      await m.react("❌").catch(() => {});
      return m.reply("❌ تعذر استخراج الفيديو أو الصورة من هذا المنشور");
    }
    await m.react("✅").catch(() => {});
  } catch (error) {
    console.error("instagram:", error?.message || error);
    await m.react("❌").catch(() => {});
    return m.reply(`❌ تعذر التحميل من إنستغرام: ${error?.message || "حاول مجدداً"}`);
  }
};

insta.usage = ["انستا"];
insta.category = "downloads";
insta.command = ["انستا", "instagram", "ig"];
insta.admin = false;
export default insta;