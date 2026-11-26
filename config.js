import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

global.pairingNumber = 201505362172;
global.owner = [
	['201212446299', 'clonew50', true],
	['79006443503783', 'Clonew50', true]
];

global.namebot = 'Yono';
global.author = 'Yono';
global.source = 'https://chat.whatsapp.com/Drghgt4BkXj8HJCLNHwx6o?s=cl&p=a&mlu=4&iam=0';
global.repo = 'https://github.com/rexxzyid/Elaina-Multidevice';

global.wait = 'Loading...';
global.eror = 'An error occurred...';

// Global bot options (used by menu/status plugins). Some settings also live in
// global.db.data.settings[botJid]; these are the process-wide defaults.
global.opts = {
	self: false,
	public: true,
	restrict: true,
	autoread: false,
	anticall: false,
	gconly: false,
};

global.settings = {
	owner: global.owner,
	botname: global.namebot,
};

global.config = {
	botname: global.namebot,
	owner: global.owner,
	saluran: { id: '120363404849776664@newsletter' },
};

global.img = {
	profile: {
		bot: 'https://files.catbox.moe/96cm7n.jpeg',
		sender: 'https://files.catbox.moe/96cm7n.jpeg',
	},
};

global.getServerUrl = () => {
	if (process.env.APP_URL) return process.env.APP_URL;
	const port = process.env.PORT || process.env.WEB_PORT || 3000;
	return `http://localhost:${port}`;
};

global.pakasir = {
	slug: '',
	apikey: '',
	expired: 30,
};

global.stickpack = 'Created By';
global.stickauth = global.namebot;

global.multiplier = 38;

global.rpg = {
	emoticon(string) {
		string = string.toLowerCase();
		let emot = {
			level: '📊',
			limit: '🎫',
			health: '❤️',
			stamina: '🔋',
			exp: '✨',
			money: '💹',
			bank: '🏦',
			potion: '🥤',
			diamond: '💎',
			common: '📦',
			uncommon: '🛍️',
			mythic: '🎁',
			legendary: '🗃️',
			superior: '💼',
			pet: '🔖',
			trash: '🗑',
			armor: '🥼',
			sword: '⚔️',
			pickaxe: '⛏️',
			fishingrod: '🎣',
			wood: '🪵',
			rock: '🪨',
			string: '🕸️',
			horse: '🐴',
			cat: '🐱',
			dog: '🐶',
			fox: '🦊',
			petFood: '🍖',
			iron: '⛓️',
			gold: '🪙',
			emerald: '❇️',
			upgrader: '🧰',
		};
		let results = Object.keys(emot)
			.map((v) => [v, new RegExp(v, 'gi')])
			.filter((v) => v[1].test(string));
		if (!results.length) return '';
		else return emot[results[0][0]];
	},
};

let file = fileURLToPath(import.meta.url);
watchFile(file, { persistent: false }, () => {
	unwatchFile(file);
	console.log(chalk.redBright("Update 'config.js'"));
	import(`${file}?update=${Date.now()}`);
});
