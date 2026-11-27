let handler = async (m, { conn, text, usedPrefix, command }) => {
	try {
		const input = (m.quoted ? m.quoted.text : text) || '';
		const regex = /(https?:\/\/(?:vt|vm|www)\.tiktok\.com\/[^\s]+)/i;

		const parseUrl = input.match(regex)?.[0];
		if (parseUrl) {
			m.react('🔁');
			const resp = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(parseUrl)}&hd=1`);
			const rawText = await resp.text();
			let res;
			try {
				res = JSON.parse(rawText);
			} catch {
				throw new Error(`TikWM returned non-JSON response (HTTP ${resp.status})`);
			}
			if (!res || !res.data) throw new Error(res?.msg || 'Failed to fetch data from TikTok.');

			let data = res.data;
			const authorName = data.author?.nickname || data.author?.unique_id || 'Unknown';
			await m.reply(`# *TIKTOK DOWNLOADER*

> *Title*: ${data.title || '-'}
> *Region*: ${data.region || '-'}
> *Duration*: ${formatDuration(data.duration)}
> *Views*: ${formatNumber(data.play_count)}
> *Comments*: ${formatNumber(data.comment_count)}
> *Share*: ${formatNumber(data.share_count)}
> *Uploader*: ${authorName}

Sending.....`);

			if (data.images && data.images.length > 0) {
				if (data.images.length < 2) {
					for (let img of data.images) {
						await conn.sendFile(m.chat, img, '', '', m);
					}
				} else {
					let media = data.images.map((img) => ({
						image: { url: img },
					}));
					await conn.sendAlbumMessage(m.chat, media, { quoted: m });
				}
			} else if (data.play) {
				await conn.sendFile(m.chat, data.play, '', '', m);
			}

			if (data.music_info?.play) {
				await conn.sendMessage(
					m.chat,
					{
						audio: { url: data.music_info.play },
						mimetype: 'audio/mpeg',
						fileName: `${data.title || 'tiktok'}.mp3`,
					},
					{ quoted: m }
				);
			}
		} else if (input.trim()) {
			const resp = await fetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(input.trim())}&count=1&cursor=0&web=1&hd=1`);
			const rawText = await resp.text();
			let search;
			try {
				search = JSON.parse(rawText);
			} catch {
				throw new Error('TikTok search is temporarily unavailable, please send a direct TikTok link instead.');
			}
			let video = search?.data?.videos?.[0];
			if (!video) throw new Error(`Video not found for the search "${input}".`);

			let caption = `# *TIKTOK PLAYER*

> *Title:* ${video.title || '-'}
> *Region:* ${video.region || '-'}
> *Duration:* ${formatDuration(video.duration)}
> *Views:* ${formatNumber(video.play_count)}
> *Comments:* ${formatNumber(video.comment_count)}
> *Share:* ${formatNumber(video.share_count)}
> *Uploader:* ${video.author?.nickname || video.author?.unique_id || 'Unknown'}
`.trim();
			const videoUrl = String(video.play || '').startsWith('http') ? video.play : 'https://www.tikwm.com' + video.play;
			await conn.sendFile(m.chat, videoUrl, '', caption, m);
		} else {
			let cmd = usedPrefix + command;
			await m.reply(`*TIKTOK DOWNLOADER*
> _*• Search:*_ \`${cmd} [query]\`
> _*• Download:*_ \`${cmd} [link]\`

*E X A M P L E:*
> *• ${cmd}* cosplayer
> *• ${cmd}* \`https://vt.tiktok.com/xxxxx\``);
		}
	} catch (err) {
		console.error(err);
		return m.reply(err?.message || 'An error occurred while processing the request');
	}
};

handler.help = ['tiktok'];
handler.tags = ['downloader'];
handler.command = /^(ttdl|tiktok|tt|tiktokdl)$/i;
handler.limit = true;

export default handler;

function formatNumber(number) {
	return Number(number || 0).toLocaleString();
}

function formatDuration(seconds) {
	if (!seconds) return '00:00';
	const m = Math.floor(seconds / 60)
		.toString()
		.padStart(2, '0');
	const s = Math.floor(seconds % 60)
		.toString()
		.padStart(2, '0');
	return `${m}:${s}`;
}

// Hi
