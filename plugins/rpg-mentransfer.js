let handler = async (m, { conn, args, usedPrefix }) => {
	if (args.length < 3) {
		return conn.reply(
			m.chat,
			`Example: *${usedPrefix}transfer money 100 @tag*\n\n*Transferable List :*\n•》Money\n• Savings\n• Potion\n• Trash\n• Diamond\n• Common\n• Uncommon\n• Mythic\n• Legendary\n• String\n🪵 Wood\n• Rock\n• Iron`.trim(),
			m
		);
	} else
		try {
			let type = (args[0] || '').toLowerCase();
			let count = args[1] && args[1].length > 0 ? Math.min(9999999, Math.max(parseInt(args[1]), 1)) : Math.min(1);
			let who = m.mentionedJid ? m.mentionedJid[0] : args[2].replace(/[@ .+-]/g, '').replace(' ', '') + '@s.whatsapp.net';
			if (!m.mentionedJid || !args[2]) throw 'Tag someone, or type their number!!';
			switch (type) {
				case 'money':
				case 'uang':
					if (global.db.data.users[m.sender].money >= count * 1) {
						try {
							global.db.data.users[m.sender].money -= count * 1;
							global.db.data.users[who].money += count * 1;
							conn.reply(m.chat, `Successfully transferred money of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].money += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your money is not enough to transfer ${count}`.trim(), m);
					break;
				case 'tabungan':
				case 'atm':
					if (global.db.data.users[m.sender].atm >= count * 1) {
						try {
							global.db.data.users[m.sender].atm -= count * 1;
							global.db.data.users[who].atm += count * 1;
							conn.reply(m.chat, `Successfully transferred money from bank of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].atm += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Not enough to transfer money from bank of ${count}`.trim(), m);
					break;
				case 'limit':
					if (global.db.data.users[m.sender].limit >= count * 1) {
						try {
							global.db.data.users[m.sender].limit -= count * 1;
							global.db.data.users[who].limit += count * 1;
							conn.reply(m.chat, `Successfully transferred limit of ${count}`.trim(), m);
						} catch (e) {
							[m.sender].limit += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your limit is not enough to transfer ${count} limit`.trim(), m);
					break;
				case 'potion':
					if (global.db.data.users[m.sender].potion >= count * 1) {
						try {
							global.db.data.users[m.sender].potion -= count * 1;
							global.db.data.users[who].potion += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Potion`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].potion += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your potion is not enough`.trim(), m);
					break;
				case 'sampah':
				case 'trash':
					if (global.db.data.users[m.sender].sampah >= count * 1) {
						try {
							global.db.data.users[m.sender].sampah -= count * 1;
							global.db.data.users[who].sampah += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Trash`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].sampah += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your trash is not enough`.trim(), m);
					break;
				case 'diamond':
					if (global.db.data.users[m.sender].diamond >= count * 1) {
						try {
							global.db.data.users[m.sender].diamond -= count * 1;
							global.db.data.users[who].diamond += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Diamond`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].diamond += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your diamond is not enough`.trim(), m);
					break;
				case 'common':
					if (global.db.data.users[m.sender].common >= count * 1) {
						try {
							global.db.data.users[m.sender].common -= count * 1;
							global.db.data.users[who].common += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Common Crate`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].common += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your common crate is not enough`.trim(), m);
					break;
				case 'uncommon':
					if (global.db.data.users[m.sender].uncommon >= count * 1) {
						try {
							global.db.data.users[m.sender].uncommon -= count * 1;
							global.db.data.users[who].uncommon += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Uncommon Crate`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].uncommon += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
							if (DevMode) {
								for (let jid of global.owner.map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').filter((v) => v != conn.user.jid)) {
									conn.reply(jid, 'Transfer.js error\nNo: *' + m.sender.split`@`[0] + '*\nCommand: *' + m.text + '*\n\n*' + e + '*', m);
								}
							}
						}
					} else conn.reply(m.chat, `Your uncommon crate is not enough`.trim(), m);
					break;
				case 'mythic':
					if (global.db.data.users[m.sender].mythic >= count * 1) {
						try {
							global.db.data.users[m.sender].mythic -= count * 1;
							global.db.data.users[who].mythic += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Mythic Crate`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].mythic += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your mythic crate is not enough`.trim(), m);
					break;
				case 'legendary':
					if (global.db.data.users[m.sender].legendary >= count * 1) {
						try {
							global.db.data.users[m.sender].legendary -= count * 1;
							global.db.data.users[who].legendary += count * 1;
							conn.reply(m.chat, `Successfully transferred ${count} Legendary Crate`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].legendary += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your legendary crate is not enough`.trim(), m);
					break;
				case 'string':
					if (global.db.data.users[m.sender].string >= count * 1) {
						try {
							global.db.data.users[m.sender].string -= count * 1;
							global.db.data.users[who].string += count * 1;
							conn.reply(m.chat, `Successfully transferred string of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].string += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your string is not enough to transfer string of ${count}`.trim(), m);
					break;
				case 'batu':
				case 'rock':
					if (global.db.data.users[m.sender].rock >= count * 1) {
						try {
							global.db.data.users[m.sender].rock -= count * 1;
							global.db.data.users[who].rock += count * 1;
							conn.reply(m.chat, `Successfully transferred rock of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].rock += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your rock is not enough to transfer rock of ${count}`.trim(), m);
					break;
				case 'kayu':
				case 'wood':
					if (global.db.data.users[m.sender].wood >= count * 1) {
						try {
							global.db.data.users[m.sender].wood -= count * 1;
							global.db.data.users[who].wood += count * 1;
							conn.reply(m.chat, `Successfully transferred wood of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].wood += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your wood is not enough to transfer wood of ${count}`.trim(), m);
					break;
				case 'iron':
					if (global.db.data.users[m.sender].iron >= count * 1) {
						try {
							global.db.data.users[m.sender].iron -= count * 1;
							global.db.data.users[who].iron += count * 1;
							conn.reply(m.chat, `Successfully transferred iron of ${count}`.trim(), m);
						} catch (e) {
							global.db.data.users[m.sender].iron += count * 1;
							m.reply('Failed to transfer');
							console.log(e);
						}
					} else conn.reply(m.chat, `Your iron is not enough to transfer iron of ${count}`.trim(), m);
					break;
				default:
					return conn.reply(
						m.chat,
						`Example: *${usedPrefix}transfer money 100 @tag*\n\n*Transferable List :*\n•》Money\n• Savings\n• Potion\n• Trash\n• Diamond\n• Common\n• Uncommon\n• Mythic\n• Legendary\n• String\n🪵 Wood\n• Rock\n• Iron`.trim(),
						m
					);
			}
		} catch (e) {
			conn.reply(
				m.chat,
				`Example: *${usedPrefix}transfer money 100 @tag*\n\n*Transferable List :*\n•》Money\n• Savings\n• Potion\n• Trash\n• Diamond\n• Common\n• Uncommon\n• Mythic\n• Legendary\n• String\n🪵 Wood\n• Rock\n• Iron`.trim(),
				m
			);
			console.log(e);
		}
};

handler.help = ['transfer'];
handler.tags = ['rpg'];
handler.command = /^(transfer|tf)$/i;
handler.group = true;

export default handler;
