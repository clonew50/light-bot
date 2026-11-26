let handler = async (m, { command }) => {
	if (!m.quoted) throw 'Reply to a message!';
	if (!m.quoted.fileSha256) throw 'SHA256 Hash Missing';
	global.db.data.sticker ||= {};
	let sticker = global.db.data.sticker;
	let hash = Buffer.from(m.quoted.fileSha256).toString('base64');
	if (!(hash in sticker)) throw 'Hash not found in database';
	sticker[hash].locked = !/^un/i.test(command);
	await m.reply('Done!');
};
handler.help = ['un', ''].map((v) => v + 'lockcmd');
handler.tags = ['database'];
handler.command = /^(un)?lockcmd$/i;

export default handler;
