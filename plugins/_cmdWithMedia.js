export async function all(m, chatUpdate) {
	if (m.isBaileys) return;
	if (!m.message) return;
	if (!m.msg?.fileSha256) return;
	const stickerDb = global.db?.data?.sticker;
	if (!stickerDb) return;
	const hash = Buffer.from(m.msg.fileSha256).toString('base64');
	if (!(hash in stickerDb)) return;

	const { text, mentionedJid } = stickerDb[hash];
	const baileysMod = global.baileys;
	const messages = await baileysMod.generateWAMessage(
		m.sender,
		{ text: text, mentions: mentionedJid },
		{
			userJid: this.user?.jid || this.user?.id,
			quoted: m.quoted && m.quoted.fakeObj,
		}
	);
	messages.key.remoteJid = m.chat;
	messages.key.fromMe = baileysMod.areJidsSameUser(m.sender, this.user?.id || this.user?.jid);
	messages.key.id = m.key.id;
	messages.pushName = m.pushName;
	if (m.isGroup) messages.key.participant = m.sender;
	const msg = {
		...chatUpdate,
		messages: [baileysMod.proto.WebMessageInfo.create(messages)],
		type: 'append',
	};
	this.ev.emit('messages.upsert', msg);
}

// Hi
