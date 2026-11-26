const FOODS = {
	ayamgoreng: 'Ayam goreng',
	ayambakar: 'Ayam bakar',
	oporayam: 'Opor ayam',
	rendang: 'Rendang',
	steak: 'Steak',
	gulaiayam: 'Gulai ayam',
	babipanggang: 'Babi panggang',
	ikanbakar: 'Ikan bakar',
	lelebakar: 'Lele bakar',
	nilabakar: 'Nila bakar',
	bawalbakar: 'Bawal bakar',
	udangbakar: 'Udang bakar',
	pausbakar: 'Paus bakar',
	kepitingbakar: 'Kepiting bakar',
};

let handler = async (m, { conn, command, args }) => {
	const user = global.db.data.users[m.sender];
	const type = (args[0] || '').toLowerCase();
	const list = `
╭──『 Food 』
│• *Ayambakar*
│• *Ayamgoreng*
│• *Rendang*
│• *Steak*
│• *Babipanggang*
│• *Gulaiayam*
│• *Oporayam*
│• *Ikanbakar*
│• *Lelebakar*
│• *Nilabakar*
│• *Bawalbakar*
│• *Udangbakar*
│• *Pausbakar*
│• *Kepitingbakar*
╰───────────────
`.trim();

	if (/makan|eat/i.test(command)) {
		const parsed = parseInt(args[1], 10);
		const count = args[1] && !Number.isNaN(parsed) ? Math.min(99999999, Math.max(parsed, 1)) : 1;

		const label = FOODS[type];
		if (!label) {
			return conn.reply(m.chat, list, m);
		}

		if ((user.stamina ?? 0) >= 100) {
			return conn.reply(m.chat, `Your stamina is already full`, m);
		}

		if ((user[type] || 0) >= count) {
			user[type] -= count;
			user.stamina = Math.min(100, (user.stamina || 0) + 20 * count);
			return conn.reply(m.chat, `Yum yum`, m);
		}

		return conn.reply(m.chat, `You don't have enough ${label}`, m);
	}
};

handler.help = ['eat'];
handler.tags = ['rpg'];
handler.register = true;
handler.group = true;
handler.command = /^(eat|makan)$/i;
export default handler;
