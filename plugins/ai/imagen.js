/*
  ═══════════════════════════════════════════
  ✨ انشاء صور بالذكاء الاصطناعي — Pollinations (مجاني بدون مفتاح)
  الأمر: .انشاء <وصف>  |  .ايماجن <وصف>  |  .imagen <وصف>
  ═══════════════════════════════════════════
*/
import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/* حدود ومدة انتظار */
const MAX_PROMPT = 500;                    // أقصى طول للوصف
const MAX_BYTES = 15 * 1024 * 1024;        // حد حجم الصورة (15 ميجا)
const TIMEOUT = 90000;                     // مهلة التوليد
const COOLDOWN = 15 * 1000;                // 15 ثانية بين كل عملية لكل مستخدم

/* كولداون في الذاكرة زي ما هو معمول في plugins/bank/theft.js */
const cooldown = new Map();

const FOOTER = "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻";

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text || !text.trim())
      return m.reply(`📌 اكتب وصف الصورة اللي عايزها بعد الأمر\nمثال: ${usedPrefix}${command} قطة شامبو نائمة على السفن`);

    const prompt = text.trim();
    if (prompt.length > MAX_PROMPT)
      return m.reply(`❌ الوصف طويل أوي، خليه أقل من ${MAX_PROMPT} حرف`);

    /* كولداون ضد السبام */
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN)
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية قبل عملية جديدة`);

    cooldown.set(m.sender, now);

    try { await m.react("⏳"); } catch (e) {}
    await m.reply("🎨 جاري رسم صورتك بالذكاء الاصطناعي...\nاستنى شوية، الجودة بتستاهل 🩸");

    const buffer = await generateImage(prompt, 2); // محاولة + إعادة محاولة

    if (!buffer || !buffer.length) {
      try { await m.react("❌"); } catch (e) {}
      return m.reply("❌ فشل توليد الصورة، جرب وصف تاني أو أبسط شوية");
    }

    try { await m.react("✅"); } catch (e) {}
    await conn.sendMessage(m.chat, {
      image: buffer,
      mimetype: "image/jpeg",
      caption: `✨ *صورة بالذكاء الاصطناعي*\n📝 الوصف: _${prompt.slice(0, 200)}_\n\n${FOOTER}`
    }, { quoted: m });
  } catch (error) {
    console.error("[imagen]", error?.message || error);
    try { await m.react("❌"); } catch (e) {}
    await m.reply("❌ حصلت مشكلة في توليد الصورة: " + (error.message || error));
  }
};

/* توليد الصورة من pollinations مع إعادة محاولة */
async function generateImage(prompt, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get("https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt), {
        params: {
          width: 1024,
          height: 1024,
          model: "flux",
          nologo: true,
          seed: Math.floor(Math.random() * 1000000)
        },
        headers: { "User-Agent": UA },
        responseType: "arraybuffer",
        timeout: TIMEOUT,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES
      });
      const buf = Buffer.from(res.data);
      if (buf.length) return buf;
    } catch (e) {
      console.error(`[imagen] محاولة ${attempt} فشلت:`, e?.message || e);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

handler.command = ["انشاء", "ايماجن", "imagen"];
handler.usage = ["انشاء <وصف الصورة>"];
handler.category = "ai";
handler.usePrefix = true;
handler.limit = true;

export default handler;
