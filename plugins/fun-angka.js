let handler = async (m, { conn, args }) => {
	const angkaUser = args[0];
	const angkaValid = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

	if (!angkaUser || !angkaValid.includes(angkaUser)) return conn.reply(m.chat, '⚠️ Enter a number between 0 and 9!\nExample: #angka 5', m);

	const angkaBot = pickRandom(angkaValid);
	const tebakanBenar = angkaUser === angkaBot;
	const bonus = tebakanBenar ? Math.floor(Math.random() * 201) + 100 : Math.floor(Math.random() * 100) + 1;

	global.db.data.users[m.sender].exp += bonus;

	let hasil = `
*「 🎲 TEBAK ANGKA 」*

🎯 Your Number : *${angkaUser}*
🤖 Bot Number  : *${angkaBot}*

${tebakanBenar ? '✅ Your guess is **CORRECT!**' : '❌ Your guess is **WRONG!**'}
🎁 You earned *+${bonus} XP!*
`.trim();

	conn.reply(m.chat, hasil, m);
};

handler.help = ['angka'];
handler.tags = ['fun'];
handler.command = /^angka$/i;

export default handler;

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}
