let handler = async (m) => {
	if (new Date() - global.db.data.users[m.sender].lastnguli > 86400000) {
		global.db.data.users[m.sender].limit += 10;
		m.reply('_Congrats you got +10 Limit_');
		global.db.data.users[m.sender].lastnguli = Date.now();
	} else m.reply('You have already claimed today\'s work reward');
};
handler.help = ['nguli'];
handler.tags = ['rpg'];
handler.command = /^(nguli)$/i;
handler.group = true;

export default handler;
