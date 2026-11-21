let handler = async (m, { text }) => {
	if (!text) throw 'Who wants to be banned?';
	let who;
	if (m.isGroup) who = m.mentionedJid[0];
	else who = m.chat;
	if (!who) throw 'Tag??';
	global.db.users[who].banned = false;
	m.reply('Success!');
};
handler.usage = ['unban'];
handler.category = 'owner';
handler.command = /^unban(user)?$/i;
handler.owner = true;

export default handler;
