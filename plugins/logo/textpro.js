import { renderTextProLogo } from "../../system/mediaService.js";

const EFFECT_MAP = {
  "عميق": "deepsea",
  "رعب": "horror",
  "بينك": "pink",
  "حلوى": "candy",
  "كريسماس": "christmas",
  "فاخر": "luxury",
  "سماء": "sky",
  "حديد": "steel",
  "صمغ": "glue",
  "قماش": "fabric",
  "ترانسفورمر": "transformer",
  "سام": "toxic",
  "قديم": "ancient",
  "رعد": "thunder",
  "قوسقزح": "graphy",
  "نيون": "neon",
  "ثلج": "frozen",
  "لوجو_ناروتو": "naruto",
  "لوجو_بوكيمون": "pokemon",
  "لوجو_باتمان": "batman",
  "منقوش": "engraved"
};

let handler = async (m, { conn, text, command }) => {
  if (!text || !text.trim()) return m.reply(`❤ مثال:\n.${command} LIGHT`);

  const effect = EFFECT_MAP[command];
  if (!effect) return m.reply("❌ أمر غير معروف");

  try {
    await m.react?.("🎨");
    const buffer = await renderTextProLogo(effect, text.trim());
    await conn.sendMessage(m.chat, {
      image: buffer,
      mimetype: "image/png",
      caption: `✅ *تم تصميم اللوجو* — (${text.trim()})`,
    }, { quoted: m });
    await m.react?.("✅");
  } catch (error) {
    console.error("textpro:", error?.message || error);
    await m.react?.("❌");
    await m.reply("❌ تعذر إنشاء اللوجو: " + (error?.message || error));
  }
};

const logos = [
  "عميق",
  "رعب",
  "بينك",
  "حلوى",
  "كريسماس",
  "فاخر",
  "سماء",
  "حديد",
  "صمغ",
  "قماش",
  "ترانسفورمر",
  "سام",
  "قديم",
  "رعد",
  "قوسقزح",
  "نيون",
  "ثلج",
  "لوجو_ناروتو",
  "لوجو_بوكيمون",
  "لوجو_باتمان",
  "منقوش",
];

handler.command = logos;
handler.category = "logos";
handler.usage = logos;

export default handler;
