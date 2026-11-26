let handler = async (m, { text }) => {
	let who = m.quoted?.sender || m.mentionedJid?.[0] || (m.isGroup ? '' : m.chat);
	if (!who && text) {
		const digits = text.replace(/[^0-9]/g, '');
		if (digits) who = `${digits}@s.whatsapp.net`;
	}
	if (!who) throw 'Who wants to be unbanned? Tag, reply, or provide a number.';
	const users = (global.db.data.users ||= {});
	if (!users[who]) users[who] = { banned: false };
	users[who].banned = false;
	await m.reply('Success!');
};
handler.help = ['unban'];
handler.tags = ['owner'];
handler.command = /^unban(user)?$/i;
handler.owner = true;

export default handler;
