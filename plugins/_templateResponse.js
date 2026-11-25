export async function all(m, chatUpdate) {
	if (m.isBaileys) return;
	if (!m.message) return;
	if (!(m.message.buttonsResponseMessage || m.message.templateButtonReplyMessage || m.message.listResponseMessage || m.message.interactiveResponseMessage || m.message.pollUpdateMessage)) return;

	let id = '';
	try {
		if (m.mtype === 'buttonsResponseMessage') {
			id = m.message.buttonsResponseMessage?.selectedButtonId || '';
		} else if (m.mtype === 'listResponseMessage') {
			id = m.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
		} else if (m.mtype === 'templateButtonReplyMessage') {
			id = m.message.templateButtonReplyMessage?.selectedId || '';
		} else if (m.mtype === 'interactiveResponseMessage') {
			const paramsRaw = m.msg?.nativeFlowResponseMessage?.paramsJson;
			if (paramsRaw) {
				const parsed = JSON.parse(paramsRaw);
				id = parsed?.id || '';
			}
		} else if (m.mtype === 'messageContextInfo') {
			id =
				m.message.buttonsResponseMessage?.selectedButtonId ||
				m.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
				m.text ||
				'';
		}
	} catch {
		id = '';
	}
	if (!id) return;

	let messages = await baileys.generateWAMessage(
		m.chat,
		{ text: id, mentions: m.mentionedJid },
		{
			userJid: this.user?.jid || this.user?.id,
			quoted: m.quoted && m.quoted.fakeObj,
		}
	);
	messages.key.remoteJid = m.chat;
	messages.key.fromMe = baileys.areJidsSameUser(m.sender, this.user?.id || this.user?.jid);
	messages.key.id = m.key.id;
	messages.pushName = m.pushName;
	if (m.isGroup) messages.key.participant = messages.participant = m.sender;
	let msg = {
		...chatUpdate,
		messages: [baileys.proto.WebMessageInfo.create(messages)].map((v) => ((v.conn = this), v)),
		type: 'append',
	};
	this.ev.emit('messages.upsert', msg);
}
