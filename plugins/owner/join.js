const handler = async (m, { conn, text }) => {

  if (!m.isOwner) {
    return m.reply("❌ هذا الأمر للمطور فقط");
  }

  if (!text) {
    return m.reply("❌ أرسل رابط جروب واتساب");
  }

  if (!text.includes("https://chat.whatsapp.com/")) {
    return m.reply("❌ رابط واتساب فقط");
  }

  try {
    await m.react("📂");
    await conn.groupJoin(text);
    await m.reply("✅ تم الدخول إلى المجموعة");
  } catch (e) {
    await m.reply(`❌ فشل الدخول\n${e.message}`);
  }
};

handler.usage = ["انضم"];
handler.category = "group";
handler.command = ["انضم", "ادخل"];

export default handler;