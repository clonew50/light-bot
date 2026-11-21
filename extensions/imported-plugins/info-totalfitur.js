let handler = async (m) => {
	let total = Object.values(global.plugins || {}).filter((v) => v.usage && v.category).length;
	conn.adReply(m.chat, `Total Fitur Bot Saat ini: ${total}`, './media/thumbnail.jpg', m, { title: 'Total Cintaku Padamu' });
};

handler.usage = ['totalfitur'];
handler.category = 'info';
handler.command = ['totalfitur'];
export default handler;
