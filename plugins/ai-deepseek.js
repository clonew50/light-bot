let handler = async (m, { conn, text, usedPrefix, command }) => {
	const input = m.quoted ? m.quoted.text : text;
	if (!input) throw `Enter a question or command!\n\nExample:\n${usedPrefix + command} what is AI`;

	if (!conn.deepseek) conn.deepseek = {};
	if (!conn.deepseek[m.sender]) conn.deepseek[m.sender] = [];
	conn.deepseek[m.sender].push({ role: 'user', content: input });
	if (conn.deepseek[m.sender].length > 20) {
		conn.deepseek[m.sender] = conn.deepseek[m.sender].slice(-20);
	}

	try {
		const res = await deepinfra('openai-fast', conn.deepseek[m.sender]);
		conn.deepseek[m.sender].push({ role: 'assistant', content: res });
		await m.reply(res);
	} catch (err) {
		console.error(err);
		await m.reply(`An error occurred: ${err.message}`);
	}
};

handler.help = ['deepseek'];
handler.tags = ['ai'];
handler.command = /^deepseek|depseek|deepsek|dipsek$/i;
handler.register = true;
handler.limit = true;

export default handler;

export async function deepinfra(model, history) {
	try {
		const res = await fetch('https://text.pollinations.ai/openai', {
			method: 'POST',
			headers: {
				'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: model && !model.includes('/') ? model : 'openai-fast',
				messages: Array.isArray(history) ? history : [{ role: 'user', content: String(history || '') }],
			}),
		});
		if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
		const data = await res.json();

		let teks = [];
		for (let out of data?.choices || []) {
			if (out.message?.content) teks.push(out.message.content);
		}
		if (!teks.length) throw new Error('Empty AI response');

		return teks.join('\n');
	} catch (e) {
		throw new Error(e?.message || 'AI request failed');
	}
}

// Hi
