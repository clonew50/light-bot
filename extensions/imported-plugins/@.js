let handler = async (m, { conn, text, participants }) => {
  if (!m.isGroup) return m.reply("only group 🌺");

  let caption = text ? text : "Yono Dev";
  let members = participants.map(v => v.id);

  await conn.sendMessage(m.chat, {
    text: `@${m.chat}`,
    contextInfo: {
      mentionedJid: members,
      groupMentions: [
        {
          groupSubject: caption,
          groupJid: m.chat
        }
      ]
    }
  });
};

handler.usage = ['@'];
handler.category = 'group';
handler.command = /^@$/i;
handler.group = true;


export default handler;