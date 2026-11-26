const TRANSFER_FIELDS = {
	money: { field: 'money', label: 'Money' },
	uang: { field: 'money', label: 'Money' },
	tabungan: { field: 'atm', label: 'Bank Savings' },
	atm: { field: 'atm', label: 'Bank Savings' },
	limit: { field: 'limit', label: 'Limit' },
	potion: { field: 'potion', label: 'Potion' },
	sampah: { field: 'trash', label: 'Trash' },
	trash: { field: 'trash', label: 'Trash' },
	diamond: { field: 'diamond', label: 'Diamond' },
	common: { field: 'common', label: 'Common Crate' },
	uncommon: { field: 'uncommon', label: 'Uncommon Crate' },
	mythic: { field: 'mythic', label: 'Mythic Crate' },
	legendary: { field: 'legendary', label: 'Legendary Crate' },
	string: { field: 'string', label: 'String' },
	batu: { field: 'rock', label: 'Rock' },
	rock: { field: 'rock', label: 'Rock' },
	kayu: { field: 'wood', label: 'Wood' },
	wood: { field: 'wood', label: 'Wood' },
	iron: { field: 'iron', label: 'Iron' },
};

const USAGE_TEXT = (usedPrefix) =>
	`Example: *${usedPrefix}transfer money 100 @tag*\n\n*Transferable List :*\n•》Money\n• Savings (atm)\n• Limit\n• Potion\n• Trash\n• Diamond\n• Common\n• Uncommon\n• Mythic\n• Legendary\n• String\n• Wood\n• Rock\n• Iron`.trim();

let handler = async (m, { conn, args, usedPrefix }) => {
	if (args.length < 3) {
		return conn.reply(m.chat, USAGE_TEXT(usedPrefix), m);
	}

	const type = (args[0] || '').toLowerCase();
	const entry = TRANSFER_FIELDS[type];
	if (!entry) {
		return conn.reply(m.chat, USAGE_TEXT(usedPrefix), m);
	}

	const parsed = parseInt(args[1], 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return conn.reply(m.chat, USAGE_TEXT(usedPrefix), m);
	}
	const count = Math.min(9999999, Math.max(parsed, 1));

	const rawTarget = m.mentionedJid?.[0] || (args[2] ? `${args[2].replace(/[^0-9]/g, '')}@s.whatsapp.net` : '');
	const digits = rawTarget.split('@')[0];
	if (!rawTarget || !digits) {
		throw 'Tag someone, or type their number!!';
	}
	const who = rawTarget.includes('@') ? rawTarget : `${digits}@s.whatsapp.net`;
	if (who === m.sender) {
		return conn.reply(m.chat, 'You cannot transfer to yourself.', m);
	}

	const users = global.db?.data?.users;
	if (!users) throw 'Database is not ready.';

	if (!users[m.sender]) users[m.sender] = {};
	if (!users[who]) users[who] = {};

	const senderUser = users[m.sender];
	const targetUser = users[who];
	const currentBalance = Number(senderUser[entry.field] || 0);

	if (currentBalance < count) {
		return conn.reply(m.chat, `Your ${entry.label} is not enough to transfer ${count}.`, m);
	}

	senderUser[entry.field] = currentBalance - count;
	targetUser[entry.field] = Number(targetUser[entry.field] || 0) + count;

	return conn.reply(m.chat, `Successfully transferred ${count} ${entry.label}.`, m);
};

handler.help = ['transfer'];
handler.tags = ['rpg'];
handler.command = /^(transfer|tf)$/i;
handler.group = true;

export default handler;
