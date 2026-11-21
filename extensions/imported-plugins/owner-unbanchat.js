let handler = async (m) => {
	global.db.groups[m.chat].isBanned = false;
	m.reply('Done!');
};
handler.usage = ['unbanchat'];
handler.category = 'owner';
handler.command = /^(unbanchat|ubnc)$/i;
handler.owner = true;
handler.group = true;

export default handler;
