const timeout = 1800000; // 30 minutes

let handler = async (m, { usedPrefix, conn }) => {
	const user = global.db.data.users[m.sender];

	const { bibitapel, bibitanggur, bibitmangga, bibitpisang, bibitjeruk } = user;

	if (!bibitapel || !bibitanggur || !bibitmangga || !bibitpisang || !bibitjeruk)
		return m.reply(
			`*Make Sure You Have All The Seeds*
• Apple Seed
• Mango Seed
• Orange Seed
• Banana Seed
• Grape Seed

Example:
${usedPrefix}shop buy bibitmangga 500`
		);

	const now = Date.now();
	const diff = user.lastberkebon + timeout;

	if (now < diff)
		return m.reply(`
You have planted before.
Wait ${msToTime(diff - now)} more.`);

	if (bibitmangga < 500) return m.reply(`Your Mango Seed is less than *500*`);
	if (bibitapel < 500) return m.reply(`Your Apple Seed is less than *500*`);
	if (bibitpisang < 500) return m.reply(`Your Banana Seed is less than *500*`);
	if (bibitjeruk < 500) return m.reply(`Your Orange Seed is less than *500*`);
	if (bibitanggur < 500) return m.reply(`Your Grape Seed is less than *500*`);

	const [pisangpoin, anggurpoin, manggapoin, jerukpoin, apelpoin] = Array.from({ length: 5 }, () => Math.floor(Math.random() * 500));

	user.pisang += pisangpoin;
	user.anggur += anggurpoin;
	user.mangga += manggapoin;
	user.jeruk += jerukpoin;
	user.apel += apelpoin;

	user.bibitapel -= 500;
	user.bibitanggur -= 500;
	user.bibitmangga -= 500;
	user.bibitpisang -= 500;
	user.bibitjeruk -= 500;

	user.tiketcoin += 1;
	user.lastberkebon = now;

	m.reply(`
Congratulations ${conn.getName(m.sender)}!
You got:
+${pisangpoin} Banana
+${manggapoin} Mango
+${anggurpoin} Grape
+${jerukpoin} Orange
+${apelpoin} Apple

${usedPrefix}listbuah To see the list.`);

	setTimeout(() => {
		m.reply(`It's time to farm again 🌱`);
	}, timeout);
};

handler.help = ['berkebun'];
handler.tags = ['rpg'];
handler.command = /^berkebun$/i;
handler.group = true;

export default handler;

function msToTime(ms) {
	let s = Math.floor((ms / 1000) % 60);
	let m = Math.floor((ms / (1000 * 60)) % 60);
	let h = Math.floor((ms / (1000 * 60 * 60)) % 24);
	return `${h} Hours ${m} Minutes ${s} Seconds`;
}
