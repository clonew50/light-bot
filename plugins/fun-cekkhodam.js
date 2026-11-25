let handler = async (m, { conn, usedPrefix, command, text }) => {
	conn.khodam = conn.khodam || {};

	if (!text) throw `Enter your name!\n\nExample:\n${usedPrefix + command} Abay gay`;

	let data = conn.khodam[text] || pickRandom(khodamList);
	conn.khodam[text] = data;

	let result = `
👤 Name: *${text}*
🔮 Your khodam is: *${data.nama}*

📖 Explanation:
${data.deskripsi}
  `.trim();

	await m.reply(result);
};

handler.help = ['cekkhodam'];
handler.tags = ['fun'];
handler.command = /^(cek(khodam|kodam)|kodam|khodam)$/i;

export default handler;

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

const khodamList = [
	{ nama: 'Swamp Cat', deskripsi: 'Roams the swamp, loves meowing along with a genderuwo' },
	{ nama: 'Ocean Monitor', deskripsi: 'Has gills, but is allergic to water' },
	{ nama: 'Electric Fan', deskripsi: 'Loves to spin but stays in one spot' },
	{ nama: 'Farhan Kebab', deskripsi: 'Just calling its name makes you hungry' },
	{ nama: 'Rossi Becak', deskripsi: 'MotoGP champion but rides a pedicab' },
	{ nama: 'Indomaret Clerk', deskripsi: 'Never runs out of smiles, like a discount promo' },
	{ nama: 'Treasure Chest', deskripsi: 'Can be filled with gold, can be filled with debt' },
	{ nama: 'Funny Kuntilanak', deskripsi: 'Loves to crack jokes, makes a tuyul laugh' },
	{ nama: 'Three-Headed Pocong', deskripsi: 'Many heads, but still empty inside' },
	{ nama: 'Pace Yunus', deskripsi: 'Legendary Pace, can play ball while flying' },
	{ nama: 'Charger Head', deskripsi: 'Can charge a battery, but tends to overheat' },
	{ nama: 'Green Banana', deskripsi: 'Its sweetness is deceiving, like an ex' },
	{ nama: 'Red Zebra', deskripsi: 'Rare, only shows up when you are in debt' },
	{ nama: 'Wet Towel', deskripsi: 'Always clings on, especially right after a shower' },
	{ nama: 'Tuyul', deskripsi: 'Expert in the dark economy. Master of empty wallets' },
	{ nama: 'Horse Titid', deskripsi: "The most 'overpowered' mystical force" },
	{ nama: 'Goat Torpedo', deskripsi: 'Can explode if flicked' },
	{ nama: 'Black Ant', deskripsi: 'Small but loves to make trouble in the kitchen' },
	{ nama: 'Red Dragon', deskripsi: 'Loves to appear when the power goes out' },
	{ nama: 'Barbie', deskripsi: 'Pretty but cannot cook' },
	{ nama: 'Handsome Gondoruwo', deskripsi: 'Gondoruwo, boyband edition' },
	{ nama: 'Santet Kid', deskripsi: 'Tiny, yet plucks the neighbor grey hairs' },
	{ nama: 'Missing Underwear', deskripsi: 'The greatest mystery in the boarding house' },
	{ nama: 'Spilled Milk', deskripsi: 'Loves to make the floor slippery and hearts uneasy' },
	{ nama: 'Flying Snakehead', deskripsi: 'Flies when sleepy' },
	{ nama: 'Stinky Pillow', deskripsi: 'Sleep protector and opponent paralyzer' },
	{ nama: 'Magic Spatula', deskripsi: 'When thrown, it comes back on its own' },
	{ nama: 'Knockoff Flying Broom', deskripsi: 'Can only hover 3 cm' },
	{ nama: 'Bespectacled Lion', deskripsi: 'Nearsighted, but still fierce' },
	{ nama: 'Genderuwo Fashion Week', deskripsi: 'Scary but stylish' },
	{ nama: 'Reborn Nenek Lampir', deskripsi: 'Young version, loves TikTok' },
	{ nama: 'Phantom Eraser', deskripsi: 'Can erase memories of an ex' },
	{ nama: 'Flying Wok', deskripsi: 'The ultimate housewife weapon' },
	{ nama: 'Cute Frog', deskripsi: 'Its croak makes people fall in love' },
	{ nama: 'Mystical Bakwan', deskripsi: 'When burned, a spell comes out' },
	{ nama: 'Refilled Water', deskripsi: 'Pure, but beware of bacteria' },
	{ nama: 'Haunted Fridge', deskripsi: 'Little inside, lots of noise' },
	{ nama: 'Spirit Flip-Flop', deskripsi: 'The pain goes straight to the heart' },
	{ nama: 'Moody Crab', deskripsi: 'Sometimes pinches, sometimes cries' },
	{ nama: 'Dried Toothpaste', deskripsi: 'Useless but still hanging around the bathroom' },
	{ nama: 'Devil Rambutan', deskripsi: 'Soft spines, horror inside' },
	{ nama: 'Flying Satay', deskripsi: 'Can vanish if left unattended' },
	{ nama: 'Bitter Coffee', deskripsi: 'Brewer of melancholy and awareness' },
	{ nama: 'Haunting Bajigur', deskripsi: 'Warm, but gives you chills' },
	{ nama: 'Blood Cendol', deskripsi: 'Bought in another realm' },
	{ nama: 'Snake-Head Meatball', deskripsi: 'Chewy, but sharp' },
	{ nama: 'Magic Screwdriver', deskripsi: 'Can open up someone’s fate' },
	{ nama: 'Broken TV', deskripsi: 'Static on screen, tuyul inside' },
	{ nama: 'Used Tissue', deskripsi: 'An ex’s khodam that is hard to forget' },
	{ nama: 'Leaky Tent', deskripsi: 'Brings you close to water and suffering' },
	{ nama: 'Crying Piggy Bank', deskripsi: 'When opened, it is full of debt' },
	{ nama: 'Five-Legged Chicken', deskripsi: 'Runs fast, confused about shoes' },
	{ nama: 'Living Potato', deskripsi: 'Fry it a little and it runs off' },
	{ nama: 'Mystical Chopsticks', deskripsi: 'Great for pulling out negative energy' },
	{ nama: 'Cracked Glass', deskripsi: 'Easily broken, like our relationship' },
	{ nama: 'Anti-Soulmate Hat', deskripsi: 'Wear it = single for life' },
	{ nama: 'Possessed Flashlight', deskripsi: 'Sometimes lights up, sometimes prays on its own' },
	{ nama: 'Cursed Tie', deskripsi: 'Whoever wears it becomes a simp' },
	{ nama: 'Mystical Fried Noodles', deskripsi: 'Fragrant and tasty, makes you forget the world' },
	{ nama: 'Alien Serabi', deskripsi: 'A taste unknown to mankind' },
	{ nama: 'Laggy Phone', deskripsi: 'A god-tier patient khodam' },
	{ nama: 'Lost TV Remote', deskripsi: 'Can turn up in the fridge' },
	{ nama: 'Dim Lamp', deskripsi: 'Creates a horror vibe even in broad daylight' },
	{ nama: 'Magic Rat', deskripsi: 'Can steal instant noodles' },
	{ nama: 'Misty Clothesline', deskripsi: 'Disappears when it rains' },
	{ nama: 'Heaven-Scented Jacket', deskripsi: 'Smells odd but soothing to the heart' },
	{ nama: 'Mystery Doll', deskripsi: 'Its smile torments the soul' },
	{ nama: 'Kuntilanak Horn', deskripsi: 'One honk and the neighbors faint' },
	{ nama: 'Failed Mosquito Repellent', deskripsi: 'The more you use it, the more mosquitoes show up' },
	{ nama: 'Emotional Lighter', deskripsi: 'Only lights up when it is not needed' },
	{ nama: 'Magic Mirror', deskripsi: 'When you look into it, your face turns into an ex' },
	{ nama: 'Phantom Powder', deskripsi: 'Use it and you vanish, face and all' },
];
