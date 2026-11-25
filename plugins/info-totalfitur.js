let handler = async (m) => {
	let total = Object.values(global.plugins).filter((v) => v.help && v.tags).length;
	conn.adReply(m.chat, `Total Bot Features Currently: ${total}`, './media/thumbnail.jpg', m, { title: 'Total Bot Features' });
};

handler.help = ['totalfitur'];
handler.tags = ['info'];
handler.command = ['totalfitur'];
export default handler;
