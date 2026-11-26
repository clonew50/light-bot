import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
	if (!text) {
		return conn.reply(m.chat, `⚠️ Please enter a GitHub repository name.\n\nExample: ${usedPrefix + command} baileys`, m);
	}

	try {
		await m.react('🔍');

		const api = `https://api.github.com/search/repositories?q=${encodeURIComponent(text)}&per_page=5`;
		const response = await fetch(api, {
			headers: {
				'User-Agent': 'Elaina-Bot/1.0',
				Accept: 'application/vnd.github+json',
			},
		});
		if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
		const json = await response.json();

		if (!json.items || json.items.length === 0) {
			return conn.reply(m.chat, `❌ No repositories found for: *${text}*`, m);
		}

		const result = json.items[0];
		const created = result.created_at ? new Date(result.created_at).toISOString().slice(0, 10) : '-';

		const txt =
			`*GITHUB - SEARCH*\n\n` +
			`📦 *Name:* ${result.name}\n` +
			`👤 *Owner:* ${result.owner?.login || 'Unknown'}\n` +
			`⭐ *Stars:* ${Number(result.stargazers_count || 0).toLocaleString()}\n` +
			`🍴 *Forks:* ${Number(result.forks_count || 0).toLocaleString()}\n` +
			`💻 *Language:* ${result.language || 'Unknown'}\n` +
			`📜 *Description:* ${result.description || 'No description'}\n` +
			`📆 *Created:* ${created}\n` +
			`🔗 *Link:* ${result.html_url}`;

		const img = result.owner?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';

		await conn.sendMessage(m.chat, { image: { url: img }, caption: txt }, { quoted: m });
		await m.react('✅');
	} catch (error) {
		console.error(error);
		await m.react('✖️');
		return m.reply(`❌ Error: ${error.message}`);
	}
};

handler.help = ['githubsearch <query>'];
handler.tags = ['search'];
handler.command = ['githubsearch', 'gbsearch'];

export default handler;