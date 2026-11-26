import path from 'path';
import { unlinkSync } from 'fs';

let handler = async (m, { conn, usedPrefix, command, __dirname, args }) => {
	const ar = Object.keys(global.plugins || {});
	const ar1 = ar.map((v) => v.replace('.js', ''));
	if (!args?.length || !args[0]) throw `uhm.. where the plugin name?\n\nexample:\n${usedPrefix + command} info`;
	const trimmed = args[0].trim();
	if (/[/\\]|\.\./.test(trimmed)) throw 'Invalid plugin name';
	const safeName = path.basename(trimmed, '.js');
	if (!ar1.includes(safeName)) throw `*🗃️ NOT FOUND!*\n==================================\n\n${ar1.map((v) => ' ' + v).join('\n')}`;
	const pluginsDir = path.resolve(__dirname || process.cwd());
	const file = path.resolve(pluginsDir, safeName + '.js');
	if (!file.startsWith(pluginsDir + path.sep)) throw 'Invalid plugin path';
	unlinkSync(file);
	await conn.reply(m.chat, `Success deleted "plugins/${safeName}.js"`, m);
};
handler.help = ['dfp'];
handler.tags = ['owner'];
handler.command = /^(dfp)$/i;
handler.owner = true;

export default handler;
