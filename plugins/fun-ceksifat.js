let handler = async (m, { text }) => {
	if (!text) throw 'Enter your name!';

	m.reply(
		`
╭━━━°「 *Character ${text}* 」°━━━
┃
┃• Name          : ${text}
┃• Good Morals   : ${randomPersen()}
┃• Bad Morals    : ${randomPersen()}
┃• Person who is : ${pickRandom(['Kind-Hearted', 'Arrogant', 'Stingy', 'Generous', 'Humble', 'Self-Deprecating', 'Shy', 'Cowardly', 'Nosy', 'Crybaby'])}
┃• Always        : ${pickRandom([
			'Diligent',
			'Lazy',
			'Helping',
			'Gossiping',
			'Teasing',
			'Vague',
			'Shopping',
			'Chatting with a Crush',
			'Chatting on WhatsApp because Single',
			'Sad',
			'Lonely',
			'Happy',
			'Masturbating every day',
		])}
┃• Intelligence  : ${randomPersen()}
┃• Naughtiness   : ${randomPersen()}
┃• Bravery       : ${randomPersen()}
┃• Fear          : ${randomPersen()}
╰━━━━━━━━━━━━━━━
`.trim()
	);
};

handler.help = ['ceksifat'];
handler.tags = ['fun'];
handler.command = /^ceksifat$/i;

export default handler;

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function randomPersen() {
	return (Math.random() * 100).toFixed(1) + '%';
}
