let handler = async (m, { conn, command }) => {
	if (command === 'linkgc') {
		await m.reply('https://chat.whatsapp.com/' + (await conn.groupInviteCode(m.chat)));
	}
	if (command === 'revoke') {
		await m.reply('Successfully reset linkgc\n\nLink : https://chat.whatsapp.com/' + (await conn.groupRevokeInvite(m.chat)));
	}
};
handler.help = ['linkgc', 'revoke'];
handler.tags = ['group'];
handler.command = /^(linkgc|revoke)$/i;
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

export default handler;
