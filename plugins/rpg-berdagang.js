let handler = async (m) => {
	const dapat = Math.floor(Math.random() * 5000);
	const who = m.mentionedJid[0];
	if (!who) throw 'Tag someone, the person you want to trade with';

	if (!global.db.data.users[who]) return m.reply('User does not exist in the database');

	const user = global.db.data.users[m.sender];
	const partner = global.db.data.users[who];

	const now = Date.now();
	const _timers = now - user.lastdagang;
	const timers = clockString(28800000 - _timers);

	if (now - user.lastdagang < 28800000) return m.reply(`You have already traded, wait ${timers} more.`);

	if (partner.money < 5000) throw 'Target does not have capital, minimum 5000';
	if (user.money < 5000) throw 'You do not have capital, minimum 5000';

	partner.money -= dapat;
	user.money -= dapat;
	partner.lastdagang = now;
	user.lastdagang = now;

	m.reply(
		`
Please wait..
You and @${who.split('@')[0]} are trading...
Both parties put up capital: -${dapat}
        `.trim()
	);

	setTimeout(() => {
		user.money += 15000;
		partner.money += 15000;

		m.reply(
			`
Congratulations! The first trade result is out.

You get +15000 (Total: ${user.money})
@${who.split('@')[0]} gets +15000 (Total: ${partner.money})`
		);
	}, 3600000);

	setTimeout(() => {
		user.money += 15000;
		partner.money += 15000;

		m.reply(
			`
Congratulations! The second trade result is out.

You get +15000 (Total: ${user.money})
@${who.split('@')[0]} gets +15000 (Total: ${partner.money})`
		);
	}, 7200000);
};

handler.help = ['berdagang'];
handler.tags = ['rpg'];
handler.command = /^berdagang$/i;
handler.register = true;
handler.group = true;

export default handler;

function clockString(ms) {
	let h = Math.floor(ms / 3600000);
	let m = Math.floor(ms / 60000) % 60;
	let s = Math.floor(ms / 1000) % 60;
	return [h, m, s].map((v) => v.toString().padStart(2, 0)).join(':');
}
