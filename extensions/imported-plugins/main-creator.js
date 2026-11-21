function handler(m) {
	const data = global.owner.filter(([id, isCreator]) => id && isCreator);
	this.sendContact(
		m.chat,
		data.map(([id, name]) => [id, name]),
		m
	);
}
handler.usage = ['owner'];
handler.category = 'main';
handler.command = ['owner', 'creator'];

export default handler;
