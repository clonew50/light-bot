import { createHash } from 'crypto';

let Reg = /\|?(.*)([.|] *?)([0-9]*)$/i;
let handler = async function (m, { text, usedPrefix }) {
	let user = global.db.data.users[m.sender];
	const pp = await conn.profilePictureUrl(m.sender, 'image', 'buffer');
	if (user.registered === true) throw `You Have Already Registered In The Database, Do You Want To Re-Register? *${usedPrefix}unreg*`;
	if (!Reg.test(text)) throw `Enter Name.Age\nExample: .daftar Vlyyyn.17`;
	let [_, name, _splitter, age] = text.match(Reg);
	if (!name) throw 'Name cannot be empty';
	if (!age) throw 'Age cannot be empty';
	age = parseInt(age);
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
• Name: ${name}
• Age: ${age} Years
• Status: Success
• Serial: ${sn}

── STARTER PACK ──
• Axe: 1 ( 30 Durability )
• Pickaxe: 1 ( 40 Durability )
`;
	conn.adReply(m.chat, cap, pp, m, {
		title: 'Registration Successful',
		body: 'You Are User Number ' + Object.values(db.data.users).filter((v) => v.registered == true).length,
	});
};
handler.help = ['daftar <nama>.<umur>'];
handler.tags = ['xp'];
handler.command = /^(daftar|verify|reg(ister)?)$/i;

export default handler;
