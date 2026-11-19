/*
  ═══════════════════════════════════════════
  ✨ انشاء صور بالذكاء الاصطناعي — دعم العربية الكامل مع Pollinations + AI Horde
  الأمر: .انشاء <وصف>  |  .ايماجن <وصف>  |  .imagen <وصف>
  ═══════════════════════════════════════════
*/
import { generateAIImage } from "../../system/aiService.js";
import { pruneCooldown } from "../../system/cooldowns.js";

const MAX_PROMPT = 500;
const COOLDOWN = 15 * 1000;
const cooldown = new Map();
const FOOTER = "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻";

const handler = async (m, { conn, text, usedPrefix = ".", command = "انشاء" }) => {
  try {
    if (!text || !text.trim()) {
      return m.reply(`📌 اكتب وصف الصورة اللي عايزها بعد الأمر\nمثال: ${usedPrefix}${command} قطة رائعة في الفضاء`);
    }

    const prompt = text.trim();
    if (prompt.length > MAX_PROMPT) {
      return m.reply(`❌ الوصف طويل أوي، خليه أقل من ${MAX_PROMPT} حرف`);
    }

    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية قبل عملية جديدة`);
    }

    pruneCooldown(cooldown, COOLDOWN);
    cooldown.set(m.sender, now);

    try { await m.react("⏳"); } catch {}
    await m.reply("🎨 جاري رسم صورتك بالذكاء الاصطناعي...\nاستنى لحظات، الجودة بتستاهل 🩸");

    const result = await generateAIImage({ prompt, width: 1024, height: 1024 });

    if (!result.ok || !result.buffer?.length) {
      try { await m.react("❌"); } catch {}
      return m.reply("❌ فشل توليد الصورة حالياً، جرب وصفاً مختلفاً أو أبسط شوية");
    }

    try { await m.react("✅"); } catch {}
    await conn.sendMessage(m.chat, {
      image: result.buffer,
      mimetype: "image/jpeg",
      caption: `✨ *صورة بالذكاء الاصطناعي*\n📝 الوصف: _${prompt.slice(0, 200)}_\n\n${FOOTER}`
    }, { quoted: m });
  } catch (error) {
    console.error("[imagen]", error?.message || error);
    try { await m.react("❌"); } catch {}
    await m.reply("❌ حصلت مشكلة في توليد الصورة: " + (error.message || error));
  }
};

handler.command = ["انشاء", "ايماجن", "imagen"];
handler.usage = ["انشاء <وصف الصورة>"];
handler.category = "ai";
handler.usePrefix = true;
handler.limit = true;

export default handler;
