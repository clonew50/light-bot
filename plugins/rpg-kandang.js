let handler = async (m, { conn }) => {
	let banteng = global.db.data.users[m.sender].banteng;
	let harimau = global.db.data.users[m.sender].harimau;
	let gajah = global.db.data.users[m.sender].gajah;
	let kambing = global.db.data.users[m.sender].kambing;
	let panda = global.db.data.users[m.sender].panda;
	let buaya = global.db.data.users[m.sender].buaya;
	let kerbau = global.db.data.users[m.sender].kerbau;
	let sapi = global.db.data.users[m.sender].sapi;
	let monyet = global.db.data.users[m.sender].monyet;
	let babihutan = global.db.data.users[m.sender].babihutan;
	let babi = global.db.data.users[m.sender].babi;
	let ayam = global.db.data.users[m.sender].ayam;

	let ndy = `Farm Animal Inventory
    
• Bull: ${banteng}
• Tiger: ${harimau}
• Elephant: ${gajah}
• Goat: ${kambing}
• Panda: ${panda}
• Crocodile: ${buaya}
• Buffalo: ${kerbau}
• Cow: ${sapi}
• Monkey: ${monyet}
• Wild Boar: ${babihutan}
• Pig: ${babi}
• Chicken: ${ayam}
 
 `.trim();
	conn.reply(m.chat, ndy, m);
};
handler.help = ['farm'];
handler.tags = ['rpg'];
handler.command = /^(kandang|farm)$/i;

export default handler;
