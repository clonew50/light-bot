const handler = async (m, { conn, text, bot }) => {
if (!text) return m.reply("*اكتب سوألك بعد الامر 🤖*")
const { api } = bot.config.info.urls
const url = api + `/home/sections/Ai/api/Ai/CustomPrompt?q=${encodeURIComponent(text)}`;
let data;
try {
  const response = await fetch(url)
  ({ data } = await response.json())
} catch (e) {
  return m.reply(`❌ حدث خطأ: ${(e && e.message) || e}`);
}

m.reply(data)
};

handler.usage = ["اوبن"];
handler.category = "ai";
handler.command = ["اوبن"];

export default handler;