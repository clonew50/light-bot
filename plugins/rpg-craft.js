let handler = async (m, { args }) => {
	let user = global.db.data.users[m.sender];
	let type = (args[0] || '').toLowerCase();

	let listCraft = `
❏ *CRAFT LIST*

• Pickaxe
  - 10 Wood
  - 5 Rock
  - 5 Iron
  - 20 String

• Sword
  - 10 Wood
  - 15 Iron
  
• Axe
  - 5 Wood
  - 10 Iron

• Fishingrod
  - 10 Wood
  - 2 Iron
  - 20 String

• Armor
  - 30 Iron
  - 1 Emerald
  - 5 Diamond

• Atm
  - 3 Emerald
  - 6 Diamond
  - 10.000 Money

Example:
.craft sword
`;

	if (!type) return m.reply(listCraft);
	try {
		switch (type) {
			case 'pickaxe':
				if (user.pickaxe > 0) return m.reply('You already have a Pickaxe!');
				if (user.wood < 10 || user.rock < 5 || user.iron < 5 || user.string < 20) return m.reply('Not enough materials!\nNeed: 10 Wood, 5 Rock, 5 Iron, 20 String');

				user.wood -= 10;
				user.rock -= 5;
				user.iron -= 5;
				user.string -= 20;
				user.pickaxe = 1;
				user.pickaxedurability = 40;

				m.reply('Successfully created 1 Pickaxe!');
				break;

			case 'sword':
				if (user.axe > 0) return m.reply('You already have a Sword!');
				if (user.wood < 10 || user.iron < 15) return m.reply('Not enough materials!\nNeed: 10 Wood, 15 Iron');

				user.wood -= 10;
				user.iron -= 15;
				user.sword = 1;
				user.sworddurability = 40;

				m.reply('Successfully created 1 Sword!');
				break;

			case 'axe':
				if (user.sword > 0) return m.reply('You already have a Sword!');
				if (user.wood < 5 || user.iron < 10) return m.reply('Not enough materials!\nNeed: 5 Wood, 10 Iron');

				user.wood -= 5;
				user.iron -= 10;
				user.axe = 1;
				user.axedurability = 40;

				m.reply('Successfully created 1 Axe!');
				break;

			case 'fishingrod':
				if (user.fishingrod > 0) return m.reply('You already have a Fishing Rod!');
				if (user.wood < 10 || user.iron < 2 || user.string < 20) return m.reply('Not enough materials!\nNeed: 10 Wood, 2 Iron, 20 String');

				user.wood -= 10;
				user.iron -= 2;
				user.string -= 20;
				user.fishingrod = 1;
				user.fishingroddurability = 40;

				m.reply('Successfully created 1 Fishing Rod!');
				break;

			case 'armor':
				if (user.armor > 0) return m.reply('You already have Armor!');
				if (user.iron < 30 || user.emerald < 1 || user.diamond < 5) return m.reply('Not enough materials!\nNeed: 30 Iron, 1 Emerald, 5 Diamond');

				user.iron -= 30;
				user.emerald -= 1;
				user.diamond -= 5;
				user.armor = 1;
				user.armordurability = 50;

				m.reply('Successfully created 1 Armor!');
				break;

			case 'atm':
				if (user.atm > 0) return m.reply('You already have an ATM!');
				if (user.emerald < 3 || user.diamond < 6 || user.money < 10000) return m.reply('Not enough materials!\nNeed: 3 Emerald, 6 Diamond, 10.000 Money');

				user.emerald -= 3;
				user.diamond -= 6;
				user.money -= 10000;
				user.atm = 1;
				user.fullatm = 5000000;

				m.reply('Successfully created an ATM!');
				break;

			default:
				return m.reply(listCraft);
		}
	} catch (e) {
		console.log(e);
		m.reply('Error');
	}
};

handler.help = ['craft'];
handler.tags = ['rpg'];
handler.command = /^craft$/i;

export default handler;
