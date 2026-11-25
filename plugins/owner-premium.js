let handler = async (m, { args, usedPrefix, command }) => {
	let who;
	if (m.quoted) {
		who = m.quoted.sender;
	} else if (m.isGroup) {
		who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : args[1] ? args[1] : false;
	} else if (args[1]) {
		who = args[1] + '@s.whatsapp.net';
	}

	if (!who) throw `Whose premium status do you want to change?`;

	let user = db.data.users[who];

	switch (command) {
		case 'addprem':
		case 'tambahprem':
		case '+prem':
			if (!args[0]) throw `How many days??`;

			if (args[0] == 'permanen') {
				user.premium = true;
				user.premiumTime = null;
				await m.reply(`✅ *Success* \n\n*Name:* ${user.name}\n*Premium Status:* Permanent\n*Date:* ${new Date().toLocaleDateString()}`);
				await conn.reply(who, `✨ *Premium Info*\n\n*Name:* ${user.name}\n*Premium Status:* Permanent\n*Date:* ${new Date().toLocaleDateString()}`, null);
			} else {
				if (isNaN(args[0])) throw `⚠️ Number only!\n\nExample:\n${usedPrefix + command} 30 @${m.sender.split`@`[0]}`;
				let txt = args[0];
				let jumlahHari = 86400000 * txt;

				let now = new Date();
				if (now < user.premiumTime) {
					user.premiumTime += jumlahHari;
				} else {
					user.premiumTime = now.getTime() + jumlahHari;
				}
				user.premium = true;

				let tanggalBerakhir = new Date(user.premiumTime).toLocaleDateString();

				await m.reply(`✅ *Success* \n\n*Name:* ${user.name}\n*Duration:* ${txt} Days\n*Starts:* ${now.toLocaleDateString()}\n*Ends:* ${tanggalBerakhir}`);
				await conn.reply(who, `✨ *Premium Info*\n\n*Name:* ${user.name}\n*Duration:* ${txt} Days\n*Starts:* ${now.toLocaleDateString()}\n*Ends:* ${tanggalBerakhir}`, null);
			}
			break;

		case 'delprem':
		case 'hapusprem':
		case '-prem':
			user.premium = false;
			user.premiumTime = 0;
			await m.reply(`⚠️ *Success* \n\n*Name:* ${user.name}\nPremium status removed on ${new Date().toLocaleDateString()}.`);
			await conn.reply(who, `✨ *Premium Info*\n\n*Name:* ${user.name}\nPremium status removed on ${new Date().toLocaleDateString()}.`, null);
			break;

		default:
			throw `Invalid command. Use addprem or delprem.`;
	}
};

handler.help = ['addprem', 'delprem'];
handler.tags = ['owner'];
handler.command = /^(add|tambah|\+|del|hapus|-)p(rem)?$/i;
handler.group = false;
handler.owner = true;

export default handler;
