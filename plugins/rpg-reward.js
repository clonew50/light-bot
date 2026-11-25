const rewardConfig = {
	daily: {
		cooldown: 86400000, // 1 day
		lastKey: 'lastclaim',
		free: { exp: 500, money: 1000, limit: 5 },
		prem: { exp: 1000, money: 5000, limit: 10 },
	},

	weekly: {
		cooldown: 604800000, // 7 days
		lastKey: 'lastweekly',
		free: { exp: 2999, money: 7000, limit: 15 },
		prem: { exp: 4999, money: 14000, limit: 30 },
	},

	monthly: {
		cooldown: 2592000000, // 30 days
		lastKey: 'lastmonthly',
		free: { exp: 4999, money: 50000, limit: 30 },
		prem: { exp: 5999, money: 100000, limit: 50 },
	},
};

let handler = async (m, { command, isPrems }) => {
	const type = /daily|harian|claim/i.test(command) ? 'daily' : /mingguan|weekly/i.test(command) ? 'weekly' : /monthly|bulanan/i.test(command) ? 'monthly' : null;

	if (!type) return;

	const user = global.db.data.users[m.sender];
	const cfg = rewardConfig[type];

	const now = Date.now();
	const remaining = user[cfg.lastKey] + cfg.cooldown - now;

	if (remaining > 0) {
		return m.reply(`⏳ You have already claimed *${type}*.\n` + `Wait *${formatTime(remaining)}* more.`);
	}

	const reward = isPrems ? cfg.prem : cfg.free;

	user.exp += reward.exp;
	user.money += reward.money;
	user.limit += reward.limit;

	user[cfg.lastKey] = now;

	m.reply(`🎁 *${type.charAt(0).toUpperCase() + type.slice(1)} Reward*\n` + `\n+ ${reward.exp} Exp` + `\n+ ${reward.money} Money` + `\n+ ${reward.limit} Limit`);
};

handler.help = ['daily', 'weekly', 'monthly'];
handler.tags = ['rpg'];
handler.command = /^(daily|harian|claim|mingguan|weekly|monthly|bulanan)$/i;

export default handler;

function formatTime(ms) {
	let h = Math.floor(ms / 3600000);
	let m = Math.floor((ms % 3600000) / 60000);
	let s = Math.floor((ms % 60000) / 1000);

	return `${h} Hours ${m} Minutes ${s} Seconds`;
}
