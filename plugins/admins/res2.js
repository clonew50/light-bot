const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس');
  const req = await conn.groupRequestParticipantsList(m.chat);
  if (!req?.length) return m.reply("*📩لا يوجد طلبات انضمام*");

  const arg = parseInt(m.text.split(" ")[1]);
  const limit = Number.isFinite(arg) && arg > 0 ? arg : req.length;

  const list = req.slice(0, limit);

  for (let r of list) {
    await conn.groupRequestParticipantsUpdate(
      m.chat,
      [r.phone_number],
      "approve"
    );
  }

  m.reply(`*✅ تم قبول ${list.length} طلب انضمام*`);
};

handler.command = ["اقبل_طلبات"];
handler.usage = ['اقبل_طلبات', 'اقبل_الطلبات'];
handler.category = "admin";
handler.admin = true;
handler.group = true;
handler.botAdmin = false

export default handler;