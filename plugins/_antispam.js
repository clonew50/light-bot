export async function before(m, { conn, isAdmin, isOwner, isBotAdmin }) {
	const user = global.db?.data?.users?.[m.sender];
	const chat = global.db?.data?.chats?.[m.chat];
	if (!user || !chat) return;

	if (m.isBaileys || m.mtype === 'protocolMessage' || m.mtype === 'pollUpdateMessage' || m.mtype === 'reactionMessage') return;
	if (!m.msg || !m.message || m.key?.remoteJid !== m.chat || user.banned || chat.isBanned) return;

	this.spam = this.spam || {};
	this.spam[m.sender] = this.spam[m.sender] || { count: 0, lastspam: 0 };
	const rawTs = m.messageTimestamp?.low || m.messageTimestamp || Math.floor(Date.now() / 1000);
	const now = Number(rawTs) > 1e12 ? Math.floor(Number(rawTs) / 1000) : Number(rawTs);
	const timeDifference = now - this.spam[m.sender].lastspam;

	if (timeDifference < 10) {
		this.spam[m.sender].count++;
		if (this.spam[m.sender].count >= 5 && !isOwner && !isAdmin && !isBotAdmin) {
			user.banned = true;
			this.spam[m.sender].lastspam = now;
			const botConn = conn || this;

			setTimeout(() => {
				user.banned = false;
				if (this.spam?.[m.sender]) this.spam[m.sender].count = 0;
				botConn?.sendMessage?.(m.chat, { react: { text: '✅', key: m.key } })?.catch?.(() => {});
			}, 10000);

			return m.reply('⚠️ You have been banned, wait for 10 seconds..');
		}
	} else {
		this.spam[m.sender].count = 0;
	}

	this.spam[m.sender].lastspam = now;
}
