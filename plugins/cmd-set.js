let handler = async (m, { text, usedPrefix, command }) => {
	if (!m.quoted) throw `Reply to sticker with command *${usedPrefix + command}*`;
	if (!m.quoted.fileSha256) throw 'SHA256 Hash Missing';
	if (!text) throw `Usage:\n${usedPrefix + command} <text>\n\nExample:\n${usedPrefix + command} test`;
	global.db.data.sticker ||= {};
	let sticker = global.db.data.sticker;
	let hash = Buffer.from(m.quoted.fileSha256).toString('base64');
	if (sticker[hash] && sticker[hash].locked) throw 'You do not have permission to change this sticker command';
	sticker[hash] = {
		text,
		mentionedJid: m.mentionedJid,
		creator: m.sender,
		at: Date.now(),
		locked: false,
	};
	await m.reply(`Success!`);
};

handler.help = ['setcmd <text>'];
handler.tags = ['database'];
handler.command = ['setcmd'];

export default handler;
