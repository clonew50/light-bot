let handler = async (m, { conn, text, usedPrefix, command }) => {
	if (!text) return conn.reply(m.chat, `Use example: \n${usedPrefix + command} <teks>`, m);
	conn.sendFile(m.chat, `https://quickchart.io/qr?text=${encodeURIComponent(text)}`, 'qrcode.png', '¯\\_(ツ)_/¯', m);
};

handler.usage = ['qrcode <teks>'];
handler.category = 'tools';
handler.command = /^qr(code)?$/i;

export default handler;
