import { createHash } from 'crypto';

let Reg = /\|?(.*)([.|] *?)([0-9]*)$/i;
let handler = async function (m, { conn, text, usedPrefix }) {
	let user = global.db.data.users[m.sender];
	let pp = global.thumb || 'https://files.catbox.moe/96cm7n.jpeg';
	try {
		pp = (await conn.profilePictureUrl(m.sender, 'image')) || pp;
	} catch {}
	if (user.registered === true) throw `You Have Already Registered In The Database, Do You Want To Re-Register? *${usedPrefix}unreg*`;
	if (!Reg.test(text)) throw `Enter Name.Age\nExample: .register Alex.17`;
	let [, name, , age] = text.match(Reg);
	if (!name || !name.trim()) throw 'Name cannot be empty';
	if (!age) throw 'Age cannot be empty';
	age = parseInt(age, 10);
	if (age > 50) throw 'Too old';
	if (age < 12) throw 'Minors are not allowed to join';
	user.name = name.trim();
	user.age = age;
	user.regTime = Date.now();
	user.registered = true;
	user.axe = 1;
	user.axedurability = 30;
	user.pickaxe = 1;
	user.pickaxedurability = 40;
	let sn = createHash('md5').update(m.sender).digest('hex');
	let cap = `
─── USER INFO ───
• Name: ${user.name}
• Age: ${age} Years
• Status: Success
• Serial: ${sn}

── STARTER PACK ──
• Axe: 1 ( 30 Durability )
• Pickaxe: 1 ( 40 Durability )
`;
	await conn.adReply(m.chat, cap, pp, m, {
		title: 'Registration Successful',
		description: 'You Are User Number ' + Object.values(global.db.data.users).filter((v) => v.registered == true).length,
	});
};
handler.help = ['register <name>.<age>'];
handler.tags = ['xp'];
handler.command = /^(daftar|verify|reg(ister)?)$/i;

export default handler;
