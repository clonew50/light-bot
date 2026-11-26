let handler = async (m, { conn }) => {
	let dapat = Math.floor(Math.random() * 100000);
	let who = m.mentionedJid?.[0];
	if (!who) throw 'Tag the person you want to rob';
	let users = global.db.data.users;
	if (typeof users[who] == 'undefined') throw 'User is not in the database';
	let now = Date.now();
	let lastRampok = Number(users[m.sender]?.lastrampok || 0);
	let _timers = now - lastRampok;
	let timers = clockString(3600000 - _timers);
	if (_timers > 3600000) {
		if (10000 > Number(users[who].money || 0)) throw 'The person you tagged has no money\nDo you not feel sorry?';
		let stolen = Math.min(dapat, Number(users[who].money || 0));
		users[who].money = Number(users[who].money || 0) - stolen;
		users[m.sender].money = Number(users[m.sender].money || 0) + stolen;
		users[m.sender].lastrampok = now;
		await conn.reply(m.chat, `Successfully robbed their money and you got Rp.${stolen}`, m);
	} else await conn.reply(m.chat, `You have already robbed and successfully hid, wait ${timers} to rob again`, m);
};
handler.help = ['rob'];
handler.tags = ['rpg'];
handler.command = /^merampok|rob$/;
handler.limit = true;
handler.group = true;

export default handler;

function clockString(ms) {
	let d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
	return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', m, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
