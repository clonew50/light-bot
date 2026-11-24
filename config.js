import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

global.pairingNumber = 201505362172;
global.owner = [
	['79006443503783', 'clonew50', true]
];

global.namebot = 'Yono';
global.author = 'Yono';
global.source = 'https://chat.whatsapp.com/Drghgt4BkXj8HJCLNHwx6o?s=cl&p=a&mlu=4&iam=0';
global.repo = 'https://github.com/rexxzyid/Elaina-Multidevice';

global.wait = 'Loading...';
global.eror = 'Terjadi Kesalahan...';

global.pakasir = {
	slug: '',
	apikey: '',
	expired: 30,
};

global.stickpack = 'Created By';
global.stickauth = namebot;

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
watchFile(file, () => {
	unwatchFile(file);
	console.log(chalk.redBright("Update 'config.js'"));
	import(`${file}?update=${Date.now()}`);
});
