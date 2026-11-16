const handler = async (m, { conn }) => {
  // ◄ زمن استجابة حقيقي (todo 29f): من وصول رسالة المستخدم (timestamp
  //    السيرفر) لحد لحظة الردّ دلوقتي — شامل وقت الشبكة والمعالجة.
  //    الأرقام العشوائية القديمة اتشالت: مش هيكون في رقم ملفّق.
  const now = Date.now();
  const userMsgTime = typeof m.messageTimestamp === 'number' && m.messageTimestamp > 0
    ? m.messageTimestamp * 1000
    : now;

  const rtt = Math.max(0, now - userMsgTime);
  const shown = Number.isFinite(rtt) ? `${rtt.toFixed(1)}ms` : '—';

  let text = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n`;
  text += `⚡ *سرعة البوت:* *${shown}*\n\n`;
  text += `❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

  await conn.sendMessage(m.chat, { text }, { quoted: m });
};

handler.command = ["بنج", "ping"];
handler.category = "info";
handler.usage = ["بنج"];

export default handler;