let handler = async (m, { text, conn }) => {
	if (!text) throw 'Enter text\n\nExample:\n.brat hello world';
	try {
		const url = 'https://shinana-brat.hf.space/?text=' + encodeURIComponent(text);
		conn.sendSticker(m.chat, url, m);
	} catch (e) {
		console.error(e);
		m.reply('Brat error, donate to the owner now');
	}
};

handler.help = ['brat'];
handler.tags = ['sticker'];
handler.command = /^brat$/i;
handler.register = true;

export default handler;
