function formatDurationMs(ms) {
	const total = Math.max(0, Number(ms) || 0);
	const seconds = Math.floor((total / 1000) % 60);
	const minutes = Math.floor((total / (60 * 1000)) % 60);
	const hours = Math.floor((total / (60 * 60 * 1000)) % 24);
	const days = Math.floor(total / (24 * 60 * 60 * 1000));
	return (
		(days ? `${days} days ` : '') +
		(hours ? `${hours} hours ` : '') +
		(minutes ? `${minutes} minutes ` : '') +
		(seconds ? `${seconds} seconds` : '')
	).trim() || 'just now';
}

export function before(m, { conn }) {
	const botConn = conn || this;
	const user = global.db?.data?.users?.[m.sender];
	if (user?.afk > -1) {
		const senderName = typeof botConn?.getName === 'function' ? botConn.getName(m.sender) : m.name || m.sender;
		m.reply(
			`${senderName} stopped being AFK${user.afkReason ? ' after ' + user.afkReason : ''}\nFor ${formatDurationMs(Date.now() - user.afk)}`.trim()
		);
		user.afk = -1;
		user.afkReason = '';
	}
	const jids = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])].filter(Boolean))];
	for (const jid of jids) {
		const target = global.db?.data?.users?.[jid];
		if (!target) continue;
		const afkTime = target.afk;
		if (!afkTime || afkTime < 0) continue;
		const reason = target.afkReason;
		const targetName = typeof botConn?.getName === 'function' ? botConn.getName(jid) : jid;
		m.reply(
			`${targetName} is AFK, don't tag them!\n${reason ? 'Reason: ' + reason : 'Without reason'}\nFor ${formatDurationMs(Date.now() - afkTime)}`.trim()
		);
	}
	return false;
}

// Hi
