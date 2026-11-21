import { createHash } from 'crypto';

let handler = async function (m) {
	let sn = createHash('md5').update(m.sender).digest('hex');
	m.reply(`*SN:* ${sn}`);
};

handler.usage = ['ceksn'];
handler.category = 'game';
handler.command = /^(ceksn)$/i;
handler.register = true;
export default handler;
