let handler = async (m) => {
	let response = '• *PREMIUM SUBSCRIPTION*\n\n';
	let totalPremium = 0;

	for (let user in global.db.users) {
		if (global.db.users[user].premium) {
			let number = user.split('@')[0];
			let name = global.db.users[user].name || '';
			let days = Math.abs(Math.floor((global.db.users[user].premiumTime - new Date()) / (24 * 60 * 60 * 1000)));
			let hours = Math.abs(Math.floor((global.db.users[user].premiumTime - new Date()) / (60 * 60 * 1000))) % 24;
			let minutes = Math.abs(Math.floor((global.db.users[user].premiumTime - new Date()) / (60 * 1000))) % 60;

			response += `∝───────•••───────\n◦  *${number}*\n•  ${name}\n*Active period*: ${days} Hari ${hours} Jam ${minutes} Menit\n∝───────•••───────\n`;

			totalPremium++;
		}
	}

	response += `┌  ◦  Total Premium : *${totalPremium}*\n`;
	response += '└  ◦  Upgrade Premium: *.owner*';

	m.reply(response, m.from, {
		contextInfo: {
			mentionedJid: Object.keys(global.db.users).filter((jid) => global.db.users[jid].premium),
		},
	});
};

handler.usage = ['listpremium'];
handler.command = /^(listprem(ium|iums)?)$/i;
handler.category = 'info';

export default handler;
