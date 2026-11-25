let confirm = {};

async function handler(m, { conn, args }) {
	if (m.sender in confirm) throw 'You are still gambling, wait until it is finished!';

	try {
		let user = global.db.data.users[m.sender];
		let jumlah = args[0] && number(parseInt(args[0])) ? Math.max(parseInt(args[0]), 1) : /all/i.test(args[0]) ? Math.floor(user.money) : 1;

		if (user.money < jumlah) return m.reply('You do not have enough money!');

		confirm[m.sender] = {
			count: jumlah,
			timeout: setTimeout(() => {
				m.reply('Time is up! Bet cancelled.');
				delete confirm[m.sender];
			}, 60_000),
		};

		conn.reply(m.chat, `Are you sure you want to gamble?\n\n*Bet:* ${jumlah}\nTime: 60 seconds\nReply *Yes* to continue, *No* to cancel.`, m);
	} catch (e) {
		console.error(e);
		if (m.sender in confirm) {
			clearTimeout(confirm[m.sender].timeout);
			delete confirm[m.sender];
		}
		m.reply('An error occurred (cancelled).');
	}
}

handler.before = async (m) => {
	if (!(m.sender in confirm)) return;
	if (m.isBaileys) return;

	let session = confirm[m.sender];
	let user = global.db.data.users[m.sender];
	let txt = (m.msg?.selectedDisplayText || m.text || '').trim().toLowerCase();

	// YES answer
	if (/^(iya|ya|y|yes)$/i.test(txt)) {
		clearTimeout(session.timeout);

		let taruhan = session.count;

		let bot = Math.ceil(Math.random() * 91);
		let kamu = Math.floor(Math.random() * 71);

		let status;
		let text;

		if (kamu > bot) {
			user.money += taruhan;
			status = 'Win';
			text = `Gained Money of *+${taruhan}*`;
		} else if (kamu < bot) {
			user.money -= taruhan;
			status = 'Lose';
			text = `Lost Money of *-${taruhan}*`;
		} else {
			let bonus = Math.floor(taruhan / 1.5);
			user.money += bonus;
			status = 'Draw';
			text = `Gained Money *+${bonus}*`;
		}

		m.reply(
			`
*Bot:*   ${bot}
*You:* ${kamu}

You *${status}*, You ${text}
            `.trim()
		);

		delete confirm[m.sender];
		return true;
	}

	// NO answer
	if (/^(tidak|n|no|ga|gak)$/i.test(txt)) {
		clearTimeout(session.timeout);
		delete confirm[m.sender];
		m.reply('Cancelled.');
		return true;
	}

	// If replying but it's not "yes/no", ignore
};

handler.help = ['judi'];
handler.tags = ['rpg'];
handler.command = /^(judi|bet)$/i;

export default handler;

function number(x = 0) {
	x = parseInt(x);
	return !isNaN(x) && typeof x == 'number';
}
