import fs from 'fs';
import path from 'path';

let handler = async (m, { usedPrefix, command, text }) => {
	const ar = Object.keys(global.plugins || {});
	const ar1 = ar.map((v) => v.replace('.js', ''));
	if (!text) throw `uhm.. where the text?\n\nexample:\n${usedPrefix + command} ping`;
	const trimmed = text.trim();
	if (/[/\\]|\.\./.test(trimmed)) throw 'Invalid plugin name';
	const safeName = path.basename(trimmed, '.js');
	if (!ar1.includes(safeName)) throw `*🗃️ NOT FOUND!*\n==================================\n\n${ar1.map((v) => ' ' + v).join('\n')}`;
	const filePath = path.join(process.cwd(), 'plugins', safeName + '.js');
	const content = fs.readFileSync(filePath, 'utf8').trim();
	if (content) await m.reply(content);
};
handler.help = ['gp2 <text>'];
handler.tags = ['owner'];
handler.command = /^(getplugin2|gp2)$/i;
handler.owner = true;

export default handler;
