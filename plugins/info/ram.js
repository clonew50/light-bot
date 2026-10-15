import os from 'os';

const handler = async (m, { conn }) => {
  const txt = `❐═━━━═╊⊰🩸⊱╉═━━━═❐
╎ الـمسـتـخـدم: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}MB
╎ الـمتـبــقـي: ${(os.freemem() / 1024 / 1024).toFixed(1)}MB
❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

  await conn.sendMessage(m.chat, {
    image: { url: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg" },
    caption: txt,
    mentions: [m.sender]
  }, { quoted: m });
};

handler.command = ["الرام", "ram"];
handler.category = "info";
handler.usage = ["الرام", "ram"];

export default handler;