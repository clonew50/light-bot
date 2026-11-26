import { canLevelUp, xpRange } from '../lib/levelling.js';

let handler = async (m, { conn }) => {
	const name = conn.getName(m.sender);
	const user = global.db.data.users[m.sender];
	const { min, xp, max } = xpRange(user.level, global.multiplier);

	if (!canLevelUp(user.level, user.exp, global.multiplier)) {
		return await conn.reply(m.chat, `Level ${name} ${user.level} (${user.exp - min}/${xp})\n${max - user.exp} more EXP needed!`.trim(), m);
	}

	let before = user.level * 1;

	while (canLevelUp(user.level, user.exp, global.multiplier)) {
		user.level++;
	}

	if (before !== user.level) {
		await conn.reply(m.chat, `${name} Level Up!\n_${before}_ -> ${user.level}`.trim(), m);
	}
};

handler.help = ['levelup'];
handler.tags = ['xp'];
handler.command = /^levelup$/i;

export default handler;
