let handler = async (m) => {
	global.db.groups[m.chat] ||= {};
	global.db.groups[m.chat].isBanned = true;
	m.reply('Done!');
};
handler.usage = ['banchat'];
handler.category = 'owner';
handler.command = /^(banchat|bnc)$/i;
handler.owner = true;
handler.group = true;
export default handler;
