let handler = async (m, { text }) => {
	if (!text) throw 'Who wants to be banned?';
	let who;
	if (m.isGroup) who = m.mentionedJid[0];
	else who = m.chat;
	if (!who) throw 'Tag??';
	global.db.users[who] ||= {};
	global.db.users[who].banned = true;
	m.reply('Success!');
};
handler.usage = ['ban'];
handler.category = 'owner';
handler.command = /^ban(user)?$/i;
handler.owner = true;

export default handler;
