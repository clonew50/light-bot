let handler = async (m, { conn }) => {
	conn.reply(m.chat, pickRandom(ganteng), m);
};

handler.help = ['gantengcek'];
handler.tags = ['fun'];
handler.command = /^(cekganteng|gantengcek)$/i;

export default handler;

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

const ganteng = [
	'Handsome Level : 1%\n\nAmbatukam... hang in there bro, just don’t look in the mirror in broad daylight.',
	'Handsome Level : 3%\n\nEven the mirror cries when it sees your face 😭',
	'Handsome Level : 5%\n\nYour face is like public wifi, everyone can get it but no one wants to connect.',
	'Handsome Level : 10%\n\nThey say you’re handsome, but when people look, it lags.',
	'Handsome Level : 15%\n\nIf you were a game character, you’d fall into the "worst boss" category.',
	'Handsome Level : 22%\n\nYour face comes with a built-in blur effect.',
	'Handsome Level : 30%\n\nNot bad... for scaring off thieves.',
	'Handsome Level : 38%\n\nCool from afar, startling up close.',
	'Handsome Level : 45%\n\nSlightly handsome, like signal on a mountain.',
	'Handsome Level : 52%\n\nHalf handsome, half ambatukam.',
	'Handsome Level : 60%\n\nCould work if it’s a bit dark and you use a filter.',
	'Handsome Level : 70%\n\nGirls like you… but only as a friend 😔',
	'Handsome Level : 77%\n\nWith a full-face helmet, 10/10',
	'Handsome Level : 83%\n\nAn imo streamer with 100+ stars makes the younger ones instantly swoon.',
	'Handsome Level : 89%\n\nMakes girls forget their IG password.',
	'Handsome Level : 94%\n\nAutomatically lands on TikTok girls’ FYP.',
	'Handsome Level : 97%\n\nWhen you show up, the mirror greets you first.',
	'Handsome Level : 100%\n\nYOU ARE TRULY THE MOST HANDSOME GUY IN THE ENTIRE UNIVERSE!! 😎🔥',
];
