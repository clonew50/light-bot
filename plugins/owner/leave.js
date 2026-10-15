const handler = async (m, { conn, text }) => {
  m.reply("*سوف يتم الخروج بأمر من المطور 📖*")
  conn.groupLeave(m.chat)
};

handler.usage = ["اخرج"];
handler.category = "group";
handler.command = ["اخرج"];
handler.owner = true 
export default handler;