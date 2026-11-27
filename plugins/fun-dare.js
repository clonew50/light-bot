let handler = async (m) => {
	const res = await fetch('https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/dare.json');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const result = await res.json();
	const list = Array.isArray(result) ? result : result?.data || [];
	if (!list.length) throw new Error('No dare prompts available');
	const dare = list[Math.floor(Math.random() * list.length)];
	await m.reply(dare);
};
handler.help = ['dare'];
handler.tags = ['fun'];
handler.command = /^(dare)$/i;

export default handler;

// Hi
