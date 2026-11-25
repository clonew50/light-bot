const timeout = 1800000; // 30 minutes

let handler = async (m, { conn }) => {
	let user = global.db.data.users[m.sender];
	let now = Date.now();
	let wait = timeout - (now - user.lastmulung);
	if (now - user.lastmulung < timeout) throw `You are too tired to scavenge 😵\nWait *${clockString(wait)}* more`;

	let botol = Math.floor(Math.random() * 100);
	let kaleng = Math.floor(Math.random() * 40);
	let kardus = Math.floor(Math.random() * 20);

	user.botol += botol;
	user.kaleng += kaleng;
	user.kardus += kardus;
	user.lastmulung = now;

	m.reply(`*Your Scavenging Results* :
- Bottle : *${botol}*
- Cardboard : *${kardus}*
- Can : *${kaleng}*`);

	setTimeout(() => {
		conn.reply(m.chat, `♻️ Come on, time to *scavenge again*!`, m);
	}, timeout);
};

handler.help = ['mulung'];
handler.tags = ['rpg'];
handler.command = /^(mulung)$/i;
handler.group = true;

export default handler;

function clockString(ms) {
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
	return ['\n' + h, ' *Hours*\n ', m, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
