let handler = async (m) => {
	let totalreg = Object.keys(global.db.users).length;
	let rtotalreg = Object.values(global.db.users).filter((user) => user.registered == true).length;
	let kon = `乂 *U S E R*

╭╾• *Current Database ${totalreg} User*
=
╰╾• *Currently Registered ${rtotalreg} User*`;
	await m.reply(kon);
};
handler.usage = ['totaluser'];
handler.category = 'info';
handler.command = /^(pengguna|(jumlah)?database|totaluser)$/i;

export default handler;
