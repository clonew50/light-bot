import { smsg } from './lib/simple.js';
import initDatabase from './lib/database.js';
import printMessage from './lib/print.js';
import { format } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import { unwatchFile, watchFile } from 'fs';
import chalk from 'chalk';

function escapePrefixRegExp(str) {
	return String(str).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function resolveMatchedPrefix(_prefix, text, botConn) {
	const prefixCandidates =
		_prefix instanceof RegExp
			? [[_prefix.exec(text), _prefix]]
			: Array.isArray(_prefix)
				? _prefix.map((p) => {
						const re = p instanceof RegExp ? p : new RegExp('^' + escapePrefixRegExp(p));
						return [re.exec(text), re];
					})
				: typeof _prefix === 'string'
					? [[new RegExp('^' + escapePrefixRegExp(_prefix)).exec(text), new RegExp('^' + escapePrefixRegExp(_prefix))]]
					: [[[], new RegExp()]];

	return prefixCandidates.find((p) => p[0] && p[0][0]) || prefixCandidates.find((p) => p[1]) || [[], new RegExp()];
}

async function processSingleMessage(botConn, rawMsg, chatUpdate) {
	let m = rawMsg;
	if (!m) return;
	try {
		m = smsg(botConn, m) || m;
		if (!m) return;
		m.exp = 0;
		m.limit = false;

		if (botConn.user?.id && !botConn.user.jid) {
			botConn.user.jid = botConn.decodeJid(botConn.user.id);
		}
		const botJid = botConn.user?.jid || (botConn.user?.id ? botConn.decodeJid(botConn.user.id) : 'main');

		if (
			!m.sender ||
			!m.chat ||
			m.chat === 'status@broadcast' ||
			m.sender.endsWith('@broadcast') ||
			m.sender.endsWith('@newsletter') ||
			m.chat.endsWith('@newsletter')
		) {
			return;
		}

		initDatabase(m, botConn);

		if (typeof m.text !== 'string') m.text = '';

		const senderResolved = botConn.getJid ? botConn.getJid(m.sender) : m.sender;
		const extractDigits = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
		const senderDigits = extractDigits(senderResolved);
		const rawSenderDigits = extractDigits(m.sender);
		const botDigits = extractDigits(botConn.user?.jid || botConn.user?.id || '');
		const ownerDigits = [
			botDigits,
			...(Array.isArray(global.owner) ? global.owner.map(([number]) => String(number || '').replace(/[^0-9]/g, '')) : []),
		].filter(Boolean);

		const isROwner = Boolean((senderDigits && ownerDigits.includes(senderDigits)) || (rawSenderDigits && ownerDigits.includes(rawSenderDigits)));
		const isOwner = isROwner || m.fromMe;
		const isPrems = isROwner || (global.db.data.users[m.sender]?.premiumTime || 0) > 0;

		const botSettings = global.db.data.settings[botJid] || {};
		if (botSettings.gconly && !m.isGroup && !isOwner && !isPrems) return;
		if (botSettings.public === false && !isOwner && !m.fromMe) return;

		if (botConn._subBotPhone) {
			const subRec = global.db.data.subBots?.[botConn._subBotPhone];
			const subCfg = subRec?.settings || botConn._subBotSettings;
			if (subCfg?.paused && !isOwner) return;
			if (subCfg?.mode === 'self' && !isOwner && !m.fromMe) return;
		}

		if (m.isBaileys) return;
		m.exp += Math.ceil(Math.random() * 10);

		let usedPrefix;
		const _user = global.db.data?.users?.[m.sender] || {};

		const groupMetadata =
			(m.isGroup ? (botConn.chats?.[m.chat] || {}).metadata || (await botConn.groupMetadata(m.chat).catch(() => null)) : {}) || {};
		const participants = (m.isGroup ? groupMetadata.participants : []) || [];
		const user = (m.isGroup ? participants.find((u) => botConn.getJid(u.id) === m.sender || botConn.getJid(u.id) === senderResolved) : {}) || {};
		const bot = (m.isGroup ? participants.find((u) => botConn.getJid(u.id) === botJid) : {}) || {};
		const isRAdmin = user?.admin == 'superadmin' || false;
		const isAdmin = isRAdmin || user?.admin == 'admin' || false;
		const isBotAdmin = Boolean(bot?.admin);

		const subPrefix = botConn._subBotPhone ? global.db.data.subBots?.[botConn._subBotPhone]?.settings?.prefix || botConn._subBotSettings?.prefix : null;

		const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins');
		for (const name in global.plugins) {
			const plugin = global.plugins[name];
			if (!plugin) continue;
			if (plugin.disabled) continue;
			const __filename = path.join(___dirname, name);

			if (typeof plugin.all === 'function') {
				try {
					await plugin.all.call(botConn, m, {
						chatUpdate,
						__dirname: ___dirname,
						__filename,
					});
				} catch (e) {
					console.error(e);
					for (const [jid] of (global.owner || []).filter(([number, _, isDeveloper]) => isDeveloper && number)) {
						try {
							const data = (await botConn.onWhatsApp(jid))[0] || {};
							if (data.exists) {
								await m.reply(
									`*Plugin:* ${name}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${m.text}\n\n\`\`\`${format(e)}\`\`\``.trim(),
									data.jid
								);
							}
						} catch {}
					}
				}
			}

			const _prefix = plugin.customPrefix ? plugin.customPrefix : botConn.prefix ? botConn.prefix : subPrefix || global.prefix;
			const match = resolveMatchedPrefix(_prefix, m.text, botConn);

			if (typeof plugin.before === 'function') {
				try {
					if (
						await plugin.before.call(botConn, m, {
							match,
							conn: botConn,
							sock: botConn,
							satanic: botConn,
							participants,
							groupMetadata,
							user,
							bot,
							isROwner,
							isOwner,
							isCreator: isROwner || isOwner,
							isRAdmin,
							isAdmin,
							isBotAdmin,
							isPrems,
							config: global.config,
							chatUpdate,
							__dirname: ___dirname,
							__filename,
						})
					) {
						continue;
					}
				} catch (e) {
					console.error(`[Plugin before error: ${name}]`, e);
				}
			}

			if (typeof plugin !== 'function') continue;
			if ((usedPrefix = (match[0] || '')[0])) {
				const noPrefix = m.text.replace(usedPrefix, '');
				const trimmedNoPrefix = noPrefix.trim();
				const cmdMatch = /^(\S+)(?:\s+([\s\S]*))?$/.exec(trimmedNoPrefix);
				let command = (cmdMatch?.[1] || '').toLowerCase();
				const text = (cmdMatch?.[2] || '').trim();
				const args = text ? text.split(/\s+/).filter(Boolean) : [];
				const _args = args;
				const fail = plugin.fail || global.dfail;
				const isAccept =
					plugin.command instanceof RegExp
						? plugin.command.test(command)
						: Array.isArray(plugin.command)
							? plugin.command.some((cmd) => (cmd instanceof RegExp ? cmd.test(command) : cmd === command))
							: typeof plugin.command === 'string'
								? plugin.command === command
								: false;

				if (!isAccept) continue;
				m.plugin = name;

				if (!isOwner && (m.chat in global.db.data.chats || m.sender in global.db.data.users)) {
					const chat = global.db.data.chats[m.chat];
					if (name != 'tools-delete.js' && (chat?.isBanned || _user?.banned)) return;
				}
				if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) {
					fail('owner', m, botConn);
					continue;
				}
				if (plugin.rowner && !isROwner) {
					fail('rowner', m, botConn);
					continue;
				}
				if (plugin.owner && !isOwner) {
					fail('owner', m, botConn);
					continue;
				}
				if (plugin.premium && !isPrems) {
					fail('premium', m, botConn);
					continue;
				}
				if (plugin.group && !m.isGroup) {
					fail('group', m, botConn);
					continue;
				} else if (plugin.botAdmin && !isBotAdmin) {
					fail('botAdmin', m, botConn);
					continue;
				} else if (plugin.admin && !isAdmin) {
					fail('admin', m, botConn);
					continue;
				}
				if (plugin.private && m.isGroup) {
					fail('private', m, botConn);
					continue;
				}
				if (plugin.register == true && !_user?.registered) {
					fail('unreg', m, botConn);
					continue;
				}
				m.isCommand = true;
				const xp = 'exp' in plugin ? parseInt(plugin.exp) : 17;
				if (xp > 200) m.reply('Cheating -_-');
				else m.exp += xp;
				if (!isPrems && plugin.limit && (_user?.limit ?? 0) < plugin.limit * 1) {
					botConn.reply(m.chat, `[❗] Your limit is exhausted, please buy via *${usedPrefix}buy limit*`, m);
					continue;
				}
				if (plugin.level && plugin.level > (_user?.level ?? 1)) {
					botConn.reply(m.chat, `[💬] Level ${plugin.level} is required to use this command\n*Your level:* ${_user?.level ?? 1} 📊`, m);
					continue;
				}
				const extra = {
					match,
					usedPrefix,
					prefix: usedPrefix,
					noPrefix,
					_args,
					args,
					command,
					text,
					conn: botConn,
					sock: botConn,
					satanic: botConn,
					config: global.config,
					participants,
					groupMetadata,
					user,
					bot,
					isROwner,
					isOwner,
					isCreator: isROwner || isOwner,
					isRAdmin,
					isAdmin,
					isBotAdmin,
					isPrems,
					chatUpdate,
					__dirname: ___dirname,
					__filename,
				};
				try {
					await plugin.call(botConn, m, extra);
					if (!isPrems) m.limit = m.limit || plugin.limit || false;
				} catch (e) {
					m.error = e;
					console.error(e);
					if (e) {
						const errText = format(e);
						if (e.name) {
							for (const [jid] of (global.owner || []).filter(([number, _, isDeveloper]) => isDeveloper && number)) {
								try {
									const data = (await botConn.onWhatsApp(jid))[0] || {};
									if (data.exists) {
										await m.reply(
											`*🗂️ Plugin:* ${m.plugin}\n*👤 Sender:* ${m.sender}\n*💬 Chat:* ${m.chat}\n*💻 Command:* ${usedPrefix}${command} ${args.join(' ')}\n📄 *Error Logs:*\n\n\`\`\`${errText}\`\`\``.trim(),
											data.jid
										);
									}
								} catch {}
							}
						}
						m.reply(errText);
					}
				} finally {
					if (typeof plugin.after === 'function') {
						try {
							await plugin.after.call(botConn, m, extra);
						} catch (e) {
							console.error(e);
						}
					}
					if (m.limit) m.reply(+m.limit + ' Limit used ✔️');
				}
				break;
			}
		}
	} catch (e) {
		console.error(e);
	} finally {
		const stats = global.db.data.stats;
		if (m) {
			const u = m.sender ? global.db.data.users[m.sender] : null;
			if (u) {
				u.exp += Number(m.exp || 0);
				u.limit = Math.max(0, Number(u.limit || 0) - Number(m.limit || 0));
			}

			if (m.plugin) {
				const now = Date.now();
				stats[m.plugin] = {
					total: 0,
					success: 0,
					last: 0,
					lastSuccess: 0,
					...stats[m.plugin],
				};
				stats[m.plugin].total++;
				stats[m.plugin].last = now;
				if (!m.error) {
					stats[m.plugin].success++;
					stats[m.plugin].lastSuccess = now;
				}
			}
		}

		try {
			await printMessage(m, botConn);
		} catch (e) {
			console.log(m, m?.quoted, e);
		}
		const botJid = botConn.user?.jid || (botConn.user?.id ? botConn.decodeJid(botConn.user.id) : 'main');
		if (global.db.data.settings[botJid]?.autoread && m?.key) {
			await botConn.readMessages([m.key]).catch(() => {});
		}
	}
}

/**
 * Handle messages upsert
 * @param {import('baileys').BaileysEventMap<unknown>['messages.upsert']} chatUpdate
 */
export async function handler(chatUpdate) {
	if (!chatUpdate || !Array.isArray(chatUpdate.messages) || chatUpdate.messages.length === 0) return;
	this.pushMessage(chatUpdate.messages).catch(console.error);
	if (global.db.data == null) await global.loadDatabase();
	for (const rawMsg of chatUpdate.messages) {
		if (!rawMsg) continue;
		await processSingleMessage(this, rawMsg, chatUpdate);
	}
}

/**
 * Handle groups participants update
 * @param {import('baileys').BaileysEventMap<unknown>['group-participants.update']} groupsUpdate
 */
export async function participantsUpdate({ id, participants, action, simulate = false }) {
	if (this.isInit && !simulate) return;
	if (global.db.data == null) await global.loadDatabase();
	let chat = global.db.data.chats[id] || {};
	let text = '';
	const groupMetadata = (this.chats?.[id] || {}).metadata || (await this.groupMetadata(id).catch(() => ({}))) || {};
	switch (action) {
		case 'add':
		case 'remove':
			if (chat.welcome) {
				for (let user of participants || []) {
					user = this.getJid(user?.phoneNumber || user?.id || user);
					if (!user) continue;
					const tamnel = await this.profilePictureUrl(user, 'image', 'buffer').catch(() => 'https://telegra.ph/file/24fa902ead26340f3df2c.png');
					text = (action === 'add' ? chat.sWelcome || this.welcome || 'Welcome, @user!' : chat.sBye || this.bye || 'Bye, @user!')
						.replace('@user', `@${user.split('@')[0]}`)
						.replace('@subject', this.getName(id))
						.replace('@desc', groupMetadata.desc || '');
					await this.adReply(id, text, tamnel, null, { title: action == 'add' ? '💌 WELCOME' : '🐾 BYE', description: action == 'add' ? 'OH NO GROUP BURDEN INCREASED BY 1 :(' : 'BYE BURDEN! :)' });
				}
			}
			break;
		case 'promote':
		case 'demote':
			for (let users of participants || []) {
				let user = this.getJid(users?.phoneNumber || users?.id || users);
				if (!user) continue;
				text = (
					action === 'promote'
						? chat.sPromote || this.spromote || '@user ```is now Admin```'
						: chat.sDemote || this.sdemote || '@user ```is no longer Admin```'
				)
					.replace('@user', '@' + user.split('@')[0])
					.replace('@subject', this.getName(id))
					.replace('@desc', groupMetadata.desc || '');
				if (chat.detect) await this.sendMessage(id, { text, mentions: this.parseMention(text) });
			}
			break;
	}
}
/**
 * Handle groups update
 * @param {import('baileys').BaileysEventMap<unknown>['groups.update']} groupsUpdate
 */
export async function groupsUpdate(groupsUpdate) {
	for (const groupUpdate of groupsUpdate || []) {
		const id = groupUpdate?.id;
		if (!id) continue;
		let chats = global.db.data.chats[id],
			text = '';
		if (!chats?.detect) continue;
		if (groupUpdate.desc) text = (chats.sDesc || this.sDesc || '```Description has been changed to```\n@desc').replace('@desc', groupUpdate.desc);
		if (groupUpdate.subject) text = (chats.sSubject || this.sSubject || '```Subject has been changed to```\n@subject').replace('@subject', groupUpdate.subject);
		if (groupUpdate.icon) text = (chats.sIcon || this.sIcon || '```Icon has been changed to```').replace('@icon', groupUpdate.icon);
		if (groupUpdate.revoke) text = (chats.sRevoke || this.sRevoke || '```Group link has been changed to```\n@revoke').replace('@revoke', groupUpdate.revoke);
		if (!text) continue;
		await this.sendMessage(id, { text, mentions: this.parseMention(text) });
	}
}

export async function deleteUpdate(message) {
	try {
		const { fromMe, id, participant } = message || {};
		if (fromMe || !id) return;
		const loaded = this.loadMessage(id);
		if (!loaded) return;
		let msg = this.serializeM(loaded);
		if (!msg) return;
		let chat = global.db.data.chats[msg.chat];
		if (!chat?.delete) return;
		const senderNum = participant ? participant.split('@')[0] : 'unknown';
		await this.reply(
			msg.chat,
			`
Detected @${senderNum} has deleted a message
To disable this feature, type
*.enable delete*
`.trim(),
			msg,
			{
				mentions: participant ? [participant] : [],
			}
		);
		this.copyNForward(msg.chat, msg).catch((e) => console.log(e, msg));
	} catch (e) {
		console.error(e);
	}
}

global.dfail = (type, m, conn) => {
	let msg = {
		rowner: 'Only Developer - This command is only for bot developer',
		owner: 'Only Owner - This command is only for bot owner',
		premium: 'Only Premium - This command is only for premium users',
		group: 'Group Chat - This command can only be used in groups',
		private: 'Private Chat - This command can only be used in private chat',
		admin: 'Only Admin - This command is only for group admins',
		botAdmin: 'Only Bot Admin - This command can only be used when bot is admin',
		unreg: 'Hello! 👋 You must register to the bot database first before using this feature\nHow to register: type .register Name.age',
		restrict: 'Restrict - Restrict feature not activated in this chat',
	}[type];
	if (msg) return conn.reply(m.chat, msg, m);
};

let file = global.__filename(import.meta.url, true);
watchFile(file, { persistent: false }, async () => {
	unwatchFile(file);
	console.log(chalk.redBright("Update 'handler.js'"));
	if (global.reloadHandler) console.log(await global.reloadHandler());
});
