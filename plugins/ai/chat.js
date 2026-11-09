import { AiChat } from "../../system/utils.js";

const handler = async (m, { conn, text, bot }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر🩸*");
  try {
    const res = await AiChat({ text });
    m.reply(res);
  } catch (e) {
    await m.reply(`❌ حدث خطأ: ${(e && e.message) || e}`);
  }
};

handler.usage = ["لايت"];
handler.category = "ai";
handler.command = ["لايت"];

export default handler;