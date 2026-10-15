const handler = async (m, { conn, text }) => {
  m.reply("*تم اصلاح البوت في المجموعة*")
  await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote');
  
};

handler.usage = ["اصلاح"];
handler.category = "owner";
handler.command = ["اصلاح"];
handler.owner = true 
handler.botAdmin = true 

export default handler;