const handler = async (m, { conn, command }) => {
  if (command === "قفل_المجموعة") {
    await conn.groupSettingUpdate(m.chat, 'announcement');
    m.reply('🔒 *تم قفل المجموعة* 🔒');
  } else if (command === "فتح_المجموعة") {
    await conn.groupSettingUpdate(m.chat, 'not_announcement');
    m.reply('🔓 *تم فتح المجموعة* 🔓');
  }
};

handler.usage = ["قفل", "فتح"];
handler.category = "admin";
handler.command = ["قفل_المجموعة", "فتح_المجموعة"];
handler.admin = true;
handler.botAdmin = false;

export default handler;