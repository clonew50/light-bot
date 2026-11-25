let handler = async (m, { conn, usedPrefix }) => {
	let user = global.db.data.users[m.sender];
	let pemancing = await conn.getName(m.sender);

	try {
		let now = Date.now();
		let cooldown = 240000;
		let diff = now - user.lastfishing;
		let timers = clockString(cooldown - diff);
		if (user.fishingrod <= 0) return m.reply(`*You don't have a fishing rod and 100 bait*`);

		if (user.stamina < 20) return m.reply(`Your stamina is not enough\nPlease refill your stamina with *${usedPrefix}eat*`);

		if (diff < cooldown) return m.reply(`You are still tired\nPlease wait *${timers}* more`);

		let nila = Math.floor(Math.random() * 10);
		let bawal = Math.floor(Math.random() * 10);
		let lele = Math.floor(Math.random() * 15);
		let ikan = Math.floor(Math.random() * 30);
		let udang = Math.floor(Math.random() * 39);
		let paus = Math.floor(Math.random() * 2);
		let kepiting = Math.floor(Math.random() * 27);

		setTimeout(() => conn.reply(m.chat, `${pemancing} is fishing...`, m), 0);
		setTimeout(() => conn.reply(m.chat, `${pemancing} waiting..`, m), 8000);
		setTimeout(() => conn.reply(m.chat, `${pemancing} seems to have caught something..`, m), 28000);

		setTimeout(() => {
			let mcng = `
*Fishing Results ${pemancing}!*

Nila : ${nila}
Bawal : ${bawal}
Lele : ${lele}
Ikan : ${ikan}
Udang : ${udang}
Paus : ${paus}
Kepiting : ${kepiting}

You can cook this and eat it
_Example:_
${usedPrefix}cook
`.trim();

			conn.reply(m.chat, mcng);
		}, 38000);

		user.nila += nila;
		user.ikan += ikan;
		user.lele += lele;
		user.bawal += bawal;
		user.udang += udang;
		user.paus += paus;
		user.kepiting += kepiting;

		user.lastfishing = now;
	} catch (e) {
		conn.reply(m.chat, 'Error', m);
		console.log(e);
	}
};

handler.help = ['mancing'];
handler.tags = ['rpg'];
handler.command = /^(fishing|mancing)$/i;

export default handler;

function clockString(ms) {
	let d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
	return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', m, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
