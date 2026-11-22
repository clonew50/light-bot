let handler = async (m) => {
	const res = await fetch('https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/truth.json');
	const result = await res.json();

	let truth = result.data[Math.floor(Math.random() * result.data.length)];
	m.reply(truth);
};

handler.usage = ['truth'];
handler.category = 'game';
handler.command = /^(truth)$/i;

export default handler;
