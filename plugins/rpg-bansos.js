let handler = async (m) => {
	try {
		const user = global.db.data.users[m.sender];
		const randomAku = Math.floor(Math.random() * 101);
		const randomKamu = Math.floor(Math.random() * 81);

		const now = Date.now();
		const cooldown = 604800000;
		const diff = now - user.lastbansos;
		const timers = clockString(cooldown - diff);

		if (diff < cooldown) return m.reply(`You have already committed financial corruption!\nWait for:\n${timers}\nSo you don't get caught by the KPK`);
		if (randomAku > randomKamu) {
			m.reply('You got caught after embezzling public funds,\nAnd you must pay a fine of *Rp. 5,000,000* to be released from prison');
			user.money -= 5000000;
			user.lastbansos = now;
		} else if (randomAku < randomKamu) {
			user.money += 2000000;
			m.reply('You successfully embezzled public funds!\nYou got *Rp. 2,000,000*');
			user.lastbansos = now;
		} else {
			m.reply('You failed to commit corruption,\nBut you did not go to jail because you *bribed certain parties*.');
			user.lastbansos = now;
		}
	} catch (e) {
		console.error(e);
		m.reply('Error');
	}
};

handler.help = ['korupsi'];
handler.tags = ['rpg'];
handler.command = /^(korupsi)$/i;
handler.group = true;

export default handler;

function clockString(ms) {
	let d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
	return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', m, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
