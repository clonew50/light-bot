import { AiChat } from "../../system/utils.js";

const handler = async (m, { conn, text, bot }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر🩸*");
  const res = await AiChat({ text });
  m.reply(res);
};

handler.usage = ["لايت"];
handler.category = "ai";
handler.command = ["لايت"];

export default handler;