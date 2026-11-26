let handler = async (m, { text }) => {
	let who = m.quoted?.sender || m.mentionedJid?.[0] || (m.isGroup ? '' : m.chat);
	if (!who && text) {
		const digits = text.replace(/[^0-9]/g, '');
		if (digits) who = `${digits}@s.whatsapp.net`;
	}
	if (!who) throw 'Who wants to be banned? Tag, reply, or provide a number.';
	const users = (global.db.data.users ||= {});
	if (!users[who]) users[who] = { banned: false };
	users[who].banned = true;
	await m.reply('Success!');
};
handler.help = ['ban'];
handler.tags = ['owner'];
handler.command = /^ban(user)?$/i;
handler.owner = true;

export default handler;
