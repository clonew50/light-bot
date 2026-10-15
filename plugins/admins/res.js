const handler = async (m, { conn }) => {
  const req = await conn.groupRequestParticipantsList(m.chat);
  if (!req?.length) return m.reply("*📩لا يوجد طلبات انضمام*");

  let text = req.map((r, i) =>
    `${i + 1}- @${r.phone_number.split("@")[0]}`
  ).join("\n");

  await conn.sendMessage(m.chat, {
    text: `📥 قائمة الطلبات:\n\n${text}`,
    mentions: req.map(r => r.phone_number)
  }, { quoted: global.reply_status });
};

handler.command = ["الطلبات", "طلبات_الانضمام"];
handler.usage = ['الطلبات'];
handler.category = "admin";
handler.admin = true;
handler.botAdmin = true

export default handler;