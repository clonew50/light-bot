let handler = async (m, { usedPrefix }) => {
	let user = global.db.data.users[m.sender];
	let ini_txt = `[ *YOUR FRUIT WAREHOUSE* ]\n\n`;
	ini_txt += `${user.pisang} Banana\n`;
	ini_txt += `${user.anggur} Grape\n`;
	ini_txt += `${user.mangga} Mango\n`;
	ini_txt += `${user.jeruk} Orange\n`;
	ini_txt += `${user.apel} Apple\n\n`;
	ini_txt += `Type *${usedPrefix}jual* to sell.`;
	m.reply(ini_txt);
};

handler.help = ['fruits'];
handler.tags = ['rpg'];
handler.command = /^((list)?(buah|fruits?))$/i;

export default handler;
