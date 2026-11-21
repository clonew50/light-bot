let handler = async (m, { conn, text, participants }) => {
	conn.reply(m.chat, text, m, { mentions: participants.map((a) => a.id) });
};

handler.usage = ['hidetag'];
handler.category = 'group';
handler.command = /^(hidetag)$/i;
handler.group = true;
handler.admin = true;

export default handler;
