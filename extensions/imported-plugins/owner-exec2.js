import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';
let exec = promisify(_exec).bind(cp);
let handler = async (m, { conn, command, text }) => {
	if (global.conn?.user?.jid && conn?.user?.jid && global.conn.user.jid !== conn.user.jid) return;
	const { key } = await m.reply('Executing...');
	let o;
	try {
		const cmdLine = `${String(command || '').trimStart()} ${String(text || '').trimEnd()}`.trim();
		if (!cmdLine) return;
		o = await exec(cmdLine);
	} catch (e) {
		o = e;
	} finally {
		let { stdout = '', stderr = '' } = o || {};
		if (String(stdout).trim()) m.edit?.(stdout, key);
		if (String(stderr).trim()) m.reply?.(stderr);
	}
};
handler.usage = ['$'];
handler.category = 'owner';
handler.customPrefix = /^[$] /;
handler.command = new RegExp();
handler.owner = true;
export default handler;
