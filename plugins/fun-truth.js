let handler = async (m) => {
	const res = await fetch('https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/truth.json');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const result = await res.json();
	const list = Array.isArray(result) ? result : result?.data || [];
	if (!list.length) throw new Error('No truth prompts available');
	const truth = list[Math.floor(Math.random() * list.length)];
	await m.reply(truth);
};

handler.help = ['truth'];
handler.tags = ['fun'];
handler.command = /^(truth)$/i;

export default handler;
