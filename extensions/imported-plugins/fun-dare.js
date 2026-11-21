let handler = async (m) => {
	const res = await fetch('https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/dare.json');
	const result = await res.json();

	let dare = result.data.getRandom();
	m.reply(dare);
};
handler.usage = ['dare'];
handler.category = 'game';
handler.command = /^(dare)$/i;

export default handler;
