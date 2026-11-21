let handler = async (m, { command }) => {
	if (command === 'linkgc') {
		m.reply('https://chat.whatsapp.com/' + (await conn.groupInviteCode(m.chat)));
	}
	if (command === 'revoke') {
		m.reply('Berhasil Reset linkgc\n\nLink : https://chat.whatsapp.com/' + (await conn.groupRevokeInvite(m.chat)));
	}
};
handler.usage = ['linkgc', 'revoke'];
handler.category = 'group';
handler.command = /^(linkgc|revoke)$/i;
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

export default handler;
