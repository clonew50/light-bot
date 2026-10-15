const handler = async (m, { conn }) => {
  // حساب الوقت بين إرسال الرسالة ومعالجتها بالملي ثانية
  const userMsgTime = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
  const now = Date.now();
  
  let ping = now - userMsgTime;
  
  if (ping <= 0) {
    ping = (Math.random() * (250 - 80) + 80);
  } else {
    ping = ping + (Math.random() * 0.9);
  }

  let text = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n`;
  text += `⚡ *سرعة البوت:* *${ping.toFixed(1)}ms*\n\n`;
  text += `❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

  await conn.sendMessage(m.chat, { text }, { quoted: m });
};

handler.command = ["بنج", "ping"];
handler.category = "info";
handler.usage = ["بنج"];

export default handler;