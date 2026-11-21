let handler = async (m, { text }) => {
	let user = global.db.users[m.sender];
	user.afk = +new Date();
	user.afkReason = text;
	m.reply(`
  ${conn.getName(m.sender)} is now AFK${text ? ': ' + text : ''}
  `);
};
handler.usage = ['afk [alasan]'];
handler.category = 'main';
handler.command = /^afk$/i;

export default handler;
