let handler = async (m, { conn, text }) => {
	let who =
		m.quoted?.sender ||
		m.mentionedJid?.[0] ||
		(text ? text.replace(/[^0-9]/g, '') : '');
	if (!who) throw 'Tag, reply to, or provide the user number.';
	if (!who.includes('@')) who = `${who}@s.whatsapp.net`;
	if (who === '@s.whatsapp.net') throw 'Invalid user number.';

	const users = global.db?.data?.users || {};
	if (users[who]) {
		users[who].premium = false;
		users[who].premiumTime = 0;
		await conn.reply(m.chat, 'Done!', m);
	} else {
		throw 'User not found.';
	}
};

handler.help = ['delprem'];
handler.tags = ['owner'];
handler.command = /^delprem(user)?$/i;
handler.owner = true;

export default handler;
