let handler = async (m, { conn, usedPrefix }) => {
	let user = global.db.data.users[m.sender];
	let __timers = new Date() - user.lastnebang;
	let penebang = conn.getName(m.sender);

	if (user.axe < 1) return m.reply('You do not have an Axe yet');
	if (user.stamina < 20) return m.reply(`Your Stamina Is Not Enough\nPlease Refill Your Stamina With *${usedPrefix}eat`);
	if (user.lastnebang > 10800000) throw m.reply(`You Are Still Tired\nPlease Wait ${clockString(10800000 - __timers)} More`);

	let hmsil1 = Math.floor(Math.random() * 300);
	let hmsil2 = Math.floor(Math.random() * 3000);
	let hmsil3 = Math.floor(Math.random() * 300);

	let jln = `
🚶⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${penebang} 
Searching Area....
`;

	let jln2 = `
⬛⬛⬛⬛⬛⬛🚶⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${penebang} 
Almost There....
`;

	let jln3 = `
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛🚶
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${penebang} 
Start Chopping....
`;

	let jln4 = `
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🏘️ 🏘️ 🚶

${penebang}
Receiving Results....
`;

	let hsl = `
*Chopping Results ${penebang}*

Wood: ${hmsil1}
Money: ${hmsil2}
Exp: ${hmsil3}
 
 Your Stamina Decreased -20
`;

	user.axedurability -= 5;
	user.stamina -= 20;
	user.money += hmsil2;
	user.kayu += hmsil1;
	user.exp += hmsil3;

	const { key } = await m.reply(`${penebang} Searching Chopping Area.....`);

	setTimeout(() => {
		conn.reply(hsl, key);
	}, 27000);

	setTimeout(() => {
		m.edit(jln4, key);
	}, 25000);

	setTimeout(() => {
		m.edit(jln3, key);
	}, 20000);

	setTimeout(() => {
		m.edit(jln2, key);
	}, 15000);

	setTimeout(() => {
		m.edit(jln, key);
	}, 10000);

	user.lastnebang = Date.now();
};
handler.help = ['nebang'];
handler.tags = ['rpg'];
handler.command = /^(nebang|menebang)$/i;
handler.group = true;
export default handler;

function clockString(ms) {
	let d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
	return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', m, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
