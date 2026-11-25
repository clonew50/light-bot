let handler = async (m, { conn }) => {
	if (!m.quoted) return m.reply('Reply to the image/video you want to view');
	const mediaType = m.quoted.mediaType;
	const mediaNode = mediaType ? m.quoted.mediaMessage?.[mediaType] : null;
	if (m.quoted.viewOnce || m.quoted.msg?.viewOnce || mediaNode?.viewOnce) {
		const media = (typeof m.quoted.download === 'function' ? await m.quoted.download().catch(() => null) : null) ||
			(mediaNode && typeof conn.downloadM === 'function' ? await conn.downloadM(mediaNode, mediaType.replace(/Message$/i, ''), false).catch(() => null) : null);
		if (!Buffer.isBuffer(media) || !media.length) return m.reply('Failed to execute the media!');

		const mtype = (mediaType || m.quoted.mtype || '').replace(/Message$/i, '');
		const caption = mediaNode?.caption || m.quoted.caption || '';
		if (mtype === 'image' || mtype === 'video' || mtype === 'audio') {
			await conn.sendMessage(
				m.chat,
				mtype === 'audio' ? { audio: media, mimetype: mediaNode?.mimetype || 'audio/mp4', ptt: Boolean(mediaNode?.ptt) } : { [mtype]: media, caption },
				{ quoted: m }
			);
		} else {
			await conn.sendFile(m.chat, media, 'media', caption, m);
		}
	} else m.reply('This is not a view-once message.');
};

handler.help = ['rvo'];
handler.tags = ['tools'];
handler.command = /^rvo|read$/i;
handler.register = true;

export default handler;
