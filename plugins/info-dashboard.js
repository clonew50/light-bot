let handler = async (m) => {
	let stats = Object.entries(global.db.data.stats || {})
		.map(([key, val]) => {
			let plugin = global.plugins[key];
			let name = Array.isArray(plugin?.help) ? plugin?.help.join(' , ') : plugin?.help || key;
			if (/exec/.test(name)) return null;
			return { name, ...val };
		})
		.filter(Boolean);
	stats = stats.sort((a, b) => b.total - a.total);

	let handlers = stats
		.slice(0, 50)
		.map(({ name, total, last, success, lastSuccess }, i) => {
			return `*${i + 1}.* *${name}*\n - *Hits* : ${total}\n - *Success* : ${success}\n - *Last Used* : ${getTime(last)}\n - *Last Success* : ${formatTime(lastSuccess)}`;
		})
		.join('\n\n');
	await m.reply(handlers || 'No command statistics recorded yet.');
};

handler.help = ['dashboard'];
handler.command = ['dashboard', 'dash'];
handler.tags = ['info'];
export default handler;

function formatTime(time) {
	const date = new Date(time);
	const month = getMonthName(date.getMonth());
	const day = date.getDate();
	const year = date.getFullYear();

	return `${month} ${day}, ${year}`;
}

function getMonthName(month) {
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	return months[month];
}

function getTime(ms) {
	var now = parseMs(+new Date() - ms);
	if (now.days) return `${now.days} days ago`;
	else if (now.hours) return `${now.hours} hours ago`;
	else if (now.minutes) return `${now.minutes} minutes ago`;
	else return `a few seconds ago`;
}

function parseMs(ms) {
	if (typeof ms !== 'number') throw 'Parameters must be filled with numbers';
	return {
		days: Math.trunc(ms / 86400000),
		hours: Math.trunc(ms / 3600000) % 24,
		minutes: Math.trunc(ms / 60000) % 60,
		seconds: Math.trunc(ms / 1000) % 60,
		milliseconds: Math.trunc(ms) % 1000,
		microseconds: Math.trunc(ms * 1000) % 1000,
		nanoseconds: Math.trunc(ms * 1e6) % 1000,
	};
}
