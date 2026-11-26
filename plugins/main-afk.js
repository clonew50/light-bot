let handler = async (m, { conn, text }) => {
	let user = global.db.data.users[m.sender];
	user.afk = +new Date();
	user.afkReason = text;
	await m.reply(
		`${conn.getName(m.sender)} is now AFK${text ? ': ' + text : ''}`.trim()
	);
};
handler.help = ['afk [reason]'];
handler.tags = ['main'];
handler.command = /^afk$/i;

export default handler;
