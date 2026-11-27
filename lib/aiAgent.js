import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { format } from 'util';
import axios from 'axios';
import * as baileys from 'baileys';
import syntaxerror from 'syntax-error';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORKSPACE_ROOT = path.resolve(__dirname, '..');
export const PLUGINS_DIR = path.join(WORKSPACE_ROOT, 'plugins');
export const LIB_DIR = path.join(WORKSPACE_ROOT, 'lib');
export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

const ALLOWED_ROOT_FILES = new Set(['handler.js', 'config.js', 'package.json']);
const ALLOWED_SEARCH_DIRS = new Set(['plugins', 'lib']);
const PROTECTED_FILENAME_RE = /(\.env|creds\.json|cookies\.txt|youtube-cookies|database\.db|crmdb\.db|session)/i;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const CHAT_MEMORY_MAX_TURNS = 10;
const chatAgentHistory = new Map();

function sanitizePathInput(input) {
	return String(input || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

export function resolveAllowedBotFile(filePath) {
	const cleaned = sanitizePathInput(filePath);
	if (!cleaned || cleaned.includes('\0') || PROTECTED_FILENAME_RE.test(cleaned)) {
		return null;
	}

	const candidate = path.resolve(WORKSPACE_ROOT, cleaned);
	const rel = path.relative(WORKSPACE_ROOT, candidate).replace(/\\/g, '/');
	if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
		return null;
	}

	const topSegment = rel.split('/')[0];
	const isAllowedRootFile = ALLOWED_ROOT_FILES.has(rel);
	const isAllowedSubdirFile = ALLOWED_SEARCH_DIRS.has(topSegment) && /\.(js|mjs|json)$/i.test(rel);
	if (!isAllowedRootFile && !isAllowedSubdirFile) {
		return null;
	}
	if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
		return null;
	}
	return { absPath: candidate, relPath: rel };
}

export function matchesPluginCommand(commandSpec, cmdName) {
	const target = String(cmdName || '').trim().toLowerCase();
	if (!target || !commandSpec) return false;

	if (commandSpec instanceof RegExp) {
		if (commandSpec.global) commandSpec.lastIndex = 0;
		return commandSpec.test(target);
	}
	if (Array.isArray(commandSpec)) {
		return commandSpec.some((item) => {
			if (item instanceof RegExp) {
				if (item.global) item.lastIndex = 0;
				return item.test(target);
			}
			return String(item || '').toLowerCase() === target;
		});
	}
	if (typeof commandSpec === 'string') {
		return commandSpec.toLowerCase() === target;
	}
	return false;
}

export function extractCommandHints(commandSpec, helpSpec = []) {
	const hints = new Set();

	const collectFromRegex = (re) => {
		let src = re.source || '';
		src = src.replace(/^\^/, '').replace(/\$$/, '');
		if (src.startsWith('(') && src.endsWith(')')) {
			src = src.slice(1, -1);
		}
		src = src.replace(/^\?:/, '');
		let depth = 0;
		let current = '';
		const parts = [];
		for (let i = 0; i < src.length; i++) {
			const ch = src[i];
			if (ch === '\\' && i + 1 < src.length) {
				current += ch + src[i + 1];
				i++;
				continue;
			}
			if (ch === '(' || ch === '[') depth++;
			else if ((ch === ')' || ch === ']') && depth > 0) depth--;
			else if (ch === '|' && depth === 0) {
				parts.push(current);
				current = '';
				continue;
			}
			current += ch;
		}
		if (current) parts.push(current);

		for (const raw of parts) {
			const cleaned = raw.replace(/^\(\?:/, '').replace(/\)$/, '').replace(/\\\//g, '/').replace(/\\-/g, '-');
			if (/^[\p{L}\p{N}_-]+$/u.test(cleaned)) {
				hints.add(cleaned.toLowerCase());
			}
		}
	};

	if (commandSpec instanceof RegExp) {
		collectFromRegex(commandSpec);
	} else if (Array.isArray(commandSpec)) {
		for (const item of commandSpec) {
			if (item instanceof RegExp) collectFromRegex(item);
			else if (typeof item === 'string' && item.trim()) hints.add(item.trim().toLowerCase());
		}
	} else if (typeof commandSpec === 'string' && commandSpec.trim()) {
		hints.add(commandSpec.trim().toLowerCase());
	}

	const helpList = Array.isArray(helpSpec) ? helpSpec : typeof helpSpec === 'string' ? [helpSpec] : [];
	for (const entry of helpList) {
		const token = String(entry || '').trim().split(/\s+/)[0]?.replace(/^[.!#/]+/, '').toLowerCase();
		if (token && matchesPluginCommand(commandSpec, token)) {
			hints.add(token);
		}
	}

	return [...hints];
}

export function checkPluginPermissions(pluginFile, plugin, m, ctx = {}) {
	if (!plugin) return { allowed: false, reason: 'not_found', message: `Plugin "${pluginFile}" is not loaded.` };
	if (plugin.disabled) return { allowed: false, reason: 'disabled', message: `Plugin "${pluginFile}" is currently disabled.` };
	if (typeof plugin !== 'function') {
		return { allowed: false, reason: 'not_executable', message: `Plugin "${pluginFile}" does not export an executable command handler.` };
	}

	const isROwner = Boolean(ctx.isROwner);
	const isOwner = Boolean(ctx.isOwner || isROwner);
	const isPrems = Boolean(ctx.isPrems || isROwner);
	const isAdmin = Boolean(ctx.isAdmin);
	const isBotAdmin = Boolean(ctx.isBotAdmin);
	const isGroup = Boolean(m?.isGroup);

	const dbUsers = global.db?.data?.users || {};
	const dbChats = global.db?.data?.chats || {};
	const userDb = dbUsers[m?.sender] || {};
	const chatDb = dbChats[m?.chat] || {};

	if (!isOwner && pluginFile !== 'tools-delete.js' && (chatDb?.isBanned || userDb?.banned)) {
		return { allowed: false, reason: 'banned', message: 'This chat or user is currently banned from running commands.' };
	}
	if (plugin.rowner && plugin.owner && !isOwner) {
		return { allowed: false, reason: 'owner', message: 'Only Owner - This command is only for bot owner.' };
	}
	if (plugin.rowner && !isROwner) {
		return { allowed: false, reason: 'rowner', message: 'Only Developer - This command is only for bot developer.' };
	}
	if (plugin.owner && !isOwner) {
		return { allowed: false, reason: 'owner', message: 'Only Owner - This command is only for bot owner.' };
	}
	if (plugin.premium && !isPrems) {
		return { allowed: false, reason: 'premium', message: 'Only Premium - This command is only for premium users.' };
	}
	if (plugin.group && !isGroup) {
		return { allowed: false, reason: 'group', message: 'Group Chat - This command can only be used in groups.' };
	}
	if (plugin.botAdmin && !isBotAdmin) {
		return { allowed: false, reason: 'botAdmin', message: 'Only Bot Admin - This command can only be used when the bot is group admin.' };
	}
	if (plugin.admin && !isAdmin) {
		return { allowed: false, reason: 'admin', message: 'Only Admin - This command is only for group admins.' };
	}
	if (plugin.private && isGroup) {
		return { allowed: false, reason: 'private', message: 'Private Chat - This command can only be used in private chat.' };
	}
	if (plugin.register == true && !userDb?.registered) {
		return { allowed: false, reason: 'unreg', message: 'User must register first via .register Name.age before using this command.' };
	}
	if (!isPrems && plugin.limit && Number(userDb?.limit ?? 0) < Number(plugin.limit)) {
		return { allowed: false, reason: 'limit', message: 'User limit is exhausted for this command.' };
	}
	if (plugin.level && Number(plugin.level) > Number(userDb?.level ?? 1)) {
		return { allowed: false, reason: 'level', message: `Level ${plugin.level} is required for this command.` };
	}

	return { allowed: true };
}

export function discoverBotPlugins({ plugins = global.plugins, m = {}, ctx = {}, query = '', tag = '', onlyRunnable = false, limit = 200 } = {}) {
	const registry = plugins || {};
	const normalizedQuery = String(query || '').trim().toLowerCase();
	const normalizedTag = String(tag || '').trim().toLowerCase();
	const maxItems = Math.max(1, Math.min(Number(limit) || 200, 300));

	const entries = [];
	const allTags = new Set();

	for (const [file, plugin] of Object.entries(registry)) {
		if (!plugin || plugin.disabled || typeof plugin !== 'function' || !plugin.command) continue;

		const help = (Array.isArray(plugin.help) ? plugin.help : typeof plugin.help === 'string' ? [plugin.help] : []).filter(Boolean).map(String);
		const tags = (Array.isArray(plugin.tags) ? plugin.tags : typeof plugin.tags === 'string' ? [plugin.tags] : []).filter(Boolean).map(String);
		for (const t of tags) allTags.add(t);

		const commands = extractCommandHints(plugin.command, help);
		const commandPattern =
			plugin.command instanceof RegExp
				? plugin.command.toString()
				: Array.isArray(plugin.command)
					? plugin.command.map((c) => String(c)).join(', ')
					: String(plugin.command);

		const permCheck = checkPluginPermissions(file, plugin, m, ctx);
		if (onlyRunnable && !permCheck.allowed) continue;

		if (normalizedTag && !tags.some((t) => t.toLowerCase().includes(normalizedTag))) continue;

		if (normalizedQuery) {
			const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
			const haystack = `${file} ${help.join(' ')} ${tags.join(' ')} ${commands.join(' ')} ${commandPattern}`.toLowerCase();
			const matched = tokens.some((tok) => haystack.includes(tok));
			if (!matched) continue;
		}

		const requirements = [];
		for (const flag of ['rowner', 'owner', 'premium', 'group', 'botAdmin', 'admin', 'private', 'register', 'limit', 'level']) {
			if (plugin[flag]) requirements.push(flag === 'limit' || flag === 'level' ? `${flag}:${plugin[flag]}` : flag);
		}

		entries.push({
			file,
			commands,
			pattern: commandPattern.slice(0, 140),
			help,
			tags,
			requirements,
			canRunNow: permCheck.allowed,
			blockReason: permCheck.allowed ? null : permCheck.reason,
		});
	}

	entries.sort((a, b) => a.file.localeCompare(b.file));
	return {
		totalLoaded: Object.keys(registry).length,
		matchedCount: entries.length,
		tags: [...allTags].sort(),
		commands: entries.slice(0, maxItems),
	};
}

export function inspectRuntimeContext(m = {}, ctx = {}) {
	const conn = ctx.conn || ctx.sock || m?.conn;
	const botJid = conn?.user?.jid || (conn?.user?.id && conn?.decodeJid ? conn.decodeJid(conn.user.id) : conn?.user?.id || '');

	const methodNames = new Set();
	if (conn && typeof conn === 'object') {
		for (const key of Object.keys(conn)) {
			if (typeof conn[key] === 'function' && !key.startsWith('_')) methodNames.add(key);
		}
		const proto = Object.getPrototypeOf(conn);
		if (proto && proto !== Object.prototype) {
			for (const key of Object.getOwnPropertyNames(proto)) {
				if (key !== 'constructor' && typeof conn[key] === 'function' && !key.startsWith('_')) {
					methodNames.add(key);
				}
			}
		}
	}

	const interestingMethodRe = /(group|send|reply|adReply|relay|message|query|jid|download|getFile|resize|onWhatsApp|profile|fetch|update|participants|invite|revoke|newsletter|react|edit|delete)/i;
	const connMethods = [...methodNames].filter((n) => interestingMethodRe.test(n)).sort();

	let libFiles = [];
	try {
		libFiles = fs
			.readdirSync(LIB_DIR)
			.filter((f) => /\.(js|mjs)$/i.test(f))
			.sort();
	} catch {}

	const userDb = global.db?.data?.users?.[m?.sender] || {};
	const chatDb = global.db?.data?.chats?.[m?.chat] || {};
	const settingsDb = global.db?.data?.settings?.[botJid] || {};

	return {
		botName: global.namebot || 'Bot',
		botJid,
		isSubBot: Boolean(conn?._subBotPhone),
		subBotPhone: conn?._subBotPhone || null,
		usedPrefix: ctx.usedPrefix || '.',
		chat: {
			id: m?.chat || '',
			isGroup: Boolean(m?.isGroup),
			groupSubject: ctx.groupMetadata?.subject || null,
			participantsCount: Array.isArray(ctx.participants) ? ctx.participants.length : 0,
			chatSettings: chatDb,
		},
		sender: {
			jid: m?.sender || '',
			pushName: m?.name || m?.pushName || '',
			isROwner: Boolean(ctx.isROwner),
			isOwner: Boolean(ctx.isOwner || ctx.isROwner),
			isAdmin: Boolean(ctx.isAdmin),
			isBotAdmin: Boolean(ctx.isBotAdmin),
			isPrems: Boolean(ctx.isPrems || ctx.isROwner),
			registered: Boolean(userDb?.registered),
			level: userDb?.level ?? 1,
			limit: userDb?.limit ?? 0,
		},
		quotedMessage: m?.quoted
			? {
					sender: m.quoted.sender || null,
					mtype: m.quoted.mtype || null,
					text: typeof m.quoted.text === 'string' ? m.quoted.text.slice(0, 500) : '',
				}
			: null,
		mentionedJids: Array.isArray(m?.mentionedJid) ? m.mentionedJid : [],
		botSettings: settingsDb,
		loadedPluginsCount: Object.keys(global.plugins || {}).length,
		libFiles,
		connMethods: connMethods.slice(0, 80),
	};
}

export function readBotSourceFile(filePath, { startLine = 1, endLine = 220 } = {}) {
	const resolved = resolveAllowedBotFile(filePath);
	if (!resolved) {
		return { ok: false, error: `File "${filePath}" is not readable or outside allowed bot source directories (plugins/, lib/, handler.js, config.js, package.json).` };
	}

	const raw = fs.readFileSync(resolved.absPath, 'utf8');
	const lines = raw.split('\n');
	const start = Math.max(1, Number(startLine) || 1);
	const end = Math.min(lines.length, Math.max(start, Number(endLine) || start + 219), start + 249);
	const numbered = lines.slice(start - 1, end).map((line, idx) => `${start + idx}: ${line}`);

	return {
		ok: true,
		file: resolved.relPath,
		totalLines: lines.length,
		showing: `${start}-${end}`,
		content: numbered.join('\n'),
	};
}

export function searchBotSourceCode(query, { scope = 'all', maxResults = 30 } = {}) {
	const q = String(query || '').trim();
	if (!q) return { ok: false, error: 'Search query must not be empty.' };

	const qLower = q.toLowerCase();
	const cap = Math.max(1, Math.min(Number(maxResults) || 30, 60));
	const targets = [];

	const addDirFiles = (dirPath, prefix) => {
		if (!fs.existsSync(dirPath)) return;
		for (const name of fs.readdirSync(dirPath).sort()) {
			if (!/\.(js|mjs)$/i.test(name) || PROTECTED_FILENAME_RE.test(name)) continue;
			targets.push({ abs: path.join(dirPath, name), rel: `${prefix}/${name}` });
		}
	};

	if (scope === 'plugins' || scope === 'all') addDirFiles(PLUGINS_DIR, 'plugins');
	if (scope === 'lib' || scope === 'all') addDirFiles(LIB_DIR, 'lib');
	if (scope === 'all') {
		for (const rootFile of ['handler.js', 'config.js']) {
			const abs = path.join(WORKSPACE_ROOT, rootFile);
			if (fs.existsSync(abs)) targets.push({ abs, rel: rootFile });
		}
	}

	const matches = [];
	for (const file of targets) {
		if (matches.length >= cap) break;
		let content = '';
		try {
			content = fs.readFileSync(file.abs, 'utf8');
		} catch {
			continue;
		}
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].toLowerCase().includes(qLower)) {
				matches.push({
					file: file.rel,
					line: i + 1,
					snippet: lines[i].trim().slice(0, 180),
				});
				if (matches.length >= cap) break;
			}
		}
	}

	return {
		ok: true,
		query: q,
		count: matches.length,
		matches,
	};
}

function createMessagingProxy(conn, m) {
	const capturedReplies = [];
	let insideReply = false;

	const record = (text) => {
		const s = typeof text === 'string' ? text : text != null ? format(text) : '';
		if (s.trim()) capturedReplies.push(s.trim().slice(0, 1000));
	};

	const defineMethod = (target, name, fn) => {
		Object.defineProperty(target, name, {
			value: fn,
			configurable: true,
			enumerable: true,
			writable: true,
		});
	};

	const proxyConn = Object.create(conn || {});
	if (conn) {
		defineMethod(proxyConn, 'reply', async (jid, text = '', quoted, options) => {
			record(Buffer.isBuffer(text) ? '[Buffer file]' : text);
			insideReply = true;
			try {
				if (typeof conn.reply === 'function') {
					return await conn.reply(jid, text, quoted, options);
				}
				if (typeof conn.sendMessage === 'function') {
					return await conn.sendMessage(jid, { text: String(text || '') }, { quoted, ...options });
				}
			} finally {
				insideReply = false;
			}
		});
		if (typeof conn.sendMessage === 'function') {
			defineMethod(proxyConn, 'sendMessage', async (jid, content, options = {}) => {
				if (!insideReply && content && !content.react) {
					record(content.text || content.caption || '[media/interactive message sent]');
				}
				return conn.sendMessage(jid, content, options);
			});
		}
		if (typeof conn.sendButton === 'function') {
			defineMethod(proxyConn, 'sendButton', async (jid, content, quoted, options) => {
				record(content?.caption || content?.text || '[button message sent]');
				return conn.sendButton(jid, content, quoted, options);
			});
		}
		if (typeof conn.adReply === 'function') {
			defineMethod(proxyConn, 'adReply', async (jid, text, mediaPath, quoted, options) => {
				record(text || '[adReply sent]');
				return conn.adReply(jid, text, mediaPath, quoted, options);
			});
		}
	}

	const proxyM = Object.create(m || {});
	defineMethod(proxyM, 'reply', async (text, chatId, options) => {
		if (typeof proxyConn.reply === 'function') {
			return proxyConn.reply(chatId || m?.chat, text, m, options);
		}
		if (typeof m?.reply === 'function') {
			record(Buffer.isBuffer(text) ? '[Buffer file]' : text);
			return m.reply(text, chatId, options);
		}
	});

	return { proxyConn, proxyM, capturedReplies };
}

const DISALLOWED_AGENT_PLUGINS = new Set([
	'ai-agent.js',
	'owner-sfp.js',
	'owner-dfp.js',
	'owner-exec.js',
	'owner-exec2.js',
]);

export async function executeBotPlugin({ pluginFile, commandName = '', text = '', args = null, m, ctx = {}, plugins = global.plugins } = {}) {
	const cleanFile = String(pluginFile || '').trim().replace(/^plugins\//, '');
	const registry = plugins || {};

	let resolvedFile = cleanFile;
	let plugin = registry[resolvedFile];

	if (!plugin && resolvedFile) {
		for (const [key, candidate] of Object.entries(registry)) {
			if (candidate && typeof candidate === 'function' && matchesPluginCommand(candidate.command, resolvedFile)) {
				resolvedFile = key;
				plugin = candidate;
				break;
			}
		}
	}

	if (DISALLOWED_AGENT_PLUGINS.has(resolvedFile)) {
		return {
			ok: false,
			blocked: true,
			pluginFile: resolvedFile,
			reason: 'policy',
			error: `Plugin "${resolvedFile}" cannot be invoked by the AI agent (bot files are read-only; use execute_custom_code for temporary in-memory code).`,
		};
	}

	const perm = checkPluginPermissions(resolvedFile, plugin, m, ctx);
	if (!perm.allowed) {
		return { ok: false, blocked: true, pluginFile: resolvedFile, reason: perm.reason, error: perm.message };
	}

	let resolvedCommand = String(commandName || '').trim().toLowerCase();
	if (!resolvedCommand) {
		const hints = extractCommandHints(plugin.command, plugin.help);
		resolvedCommand = hints.find((h) => matchesPluginCommand(plugin.command, h)) || '';
	}
	if (!resolvedCommand || !matchesPluginCommand(plugin.command, resolvedCommand)) {
		const hints = extractCommandHints(plugin.command, plugin.help);
		return {
			ok: false,
			pluginFile: resolvedFile,
			error: `Invalid commandName "${commandName}" for "${resolvedFile}". Valid hints: [${hints.join(', ')}], pattern: ${String(plugin.command)}. Inspect the plugin source if unsure.`,
		};
	}

	const normalizedText = String(text || '').trim();
	const resolvedArgs = Array.isArray(args)
		? args.map((v) => String(v)).filter(Boolean)
		: normalizedText
			? normalizedText.split(/\s+/).filter(Boolean)
			: [];
	const usedPrefix = ctx.usedPrefix || '.';
	const conn = ctx.conn || ctx.sock || m?.conn;
	const { proxyConn, proxyM, capturedReplies } = createMessagingProxy(conn, m);
	proxyM.plugin = resolvedFile;
	proxyM.isCommand = true;

	const pluginExtra = {
		...ctx,
		match: [[usedPrefix], new RegExp()],
		usedPrefix,
		prefix: usedPrefix,
		noPrefix: normalizedText ? `${resolvedCommand} ${normalizedText}` : resolvedCommand,
		_args: resolvedArgs,
		args: resolvedArgs,
		command: resolvedCommand,
		text: normalizedText,
		conn: proxyConn,
		sock: proxyConn,
		satanic: proxyConn,
		config: ctx.config || global.config || {},
		participants: Array.isArray(ctx.participants) ? ctx.participants : [],
		groupMetadata: ctx.groupMetadata || {},
		user: ctx.user || {},
		bot: ctx.bot || {},
		chatUpdate: ctx.chatUpdate || { messages: [], type: 'notify' },
		__dirname: PLUGINS_DIR,
		__filename: path.join(PLUGINS_DIR, resolvedFile),
	};

	try {
		await plugin.call(proxyConn, proxyM, pluginExtra);
		if (!ctx.isPrems && plugin.limit) {
			m.limit = m.limit || plugin.limit;
		}
		if (typeof plugin.after === 'function') {
			await plugin.after.call(proxyConn, proxyM, pluginExtra).catch(() => {});
		}
		return {
			ok: true,
			pluginFile: resolvedFile,
			command: resolvedCommand,
			text: normalizedText,
			repliesSent: capturedReplies,
		};
	} catch (err) {
		const errMsg = typeof err === 'string' ? err : err?.message || format(err);
		return {
			ok: false,
			pluginFile: resolvedFile,
			command: resolvedCommand,
			error: errMsg,
			repliesSent: capturedReplies,
		};
	}
}

// Deterministic Arabic/English action-word → canonical command hints.
// Only used as a *fallback* when the LLM refuses/fails; resolution still requires
// that a matching plugin is actually loaded AND the caller can run it right now.
const COMMAND_SYNONYMS = {
	closegc: ['اقفل', 'اقفال', 'قفل', 'سكّر', 'سكر', 'قفل_الجروب', 'close', 'lock'],
	opengc: ['افتح', 'فتح', 'فتح_الجروب', 'open', 'unlock'],
	kick: ['اطرد', 'طرد', 'طرد_عضو', 'kick'],
	add: ['اضف', 'إضف', 'اضافه', 'إضافة', 'add'],
	promote: ['رقي', 'رقّي', 'ترقي', 'ترقيه', 'promote'],
	demote: ['خفض', 'خفّض', 'demote'],
	hidetag: ['هيد', 'هيدتاج', 'hidetag', 'tagall', 'منشن'],
	ping: ['سرعه', 'سرعة', 'بينق', 'ping', 'speed', 'سيرفر', 'server'],
	menu: ['القائمه', 'القائمة', 'اوامر', 'أوامر', 'menu'],
};

function normalizeIntentText(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[\u064B-\u065F\u0670\u0640]/g, '') // strip Arabic diacritics + tatweel
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function resolveDeterministicPluginAction(text, { plugins = global.plugins, m = {}, ctx = {} } = {}) {
	const normalized = normalizeIntentText(text);
	if (!normalized) return null;
	const padded = ` ${normalized} `;

	const discovered = discoverBotPlugins({ plugins, m, ctx, onlyRunnable: true, limit: 300 });
	if (!discovered.commands.length) return null;

	// 1. Direct command-name token match (strongest signal).
	let best = null;
	for (const entry of discovered.commands) {
		for (const hint of entry.commands) {
			const h = normalizeIntentText(hint);
			if (h.length >= 3 && padded.includes(` ${h} `)) {
				if (!best || h.length > best.score) best = { file: entry.file, commandName: hint, score: h.length };
			}
		}
	}
	if (best) return { pluginFile: best.file, commandName: best.commandName, via: 'direct' };

	// 2. Synonym match: an Arabic/English action word maps to a canonical command hint.
	for (const [canonical, words] of Object.entries(COMMAND_SYNONYMS)) {
		const hit = words.find((w) => {
			const nw = normalizeIntentText(w);
			return nw.length >= 3 && padded.includes(` ${nw} `);
		});
		if (!hit) continue;
		for (const entry of discovered.commands) {
			const hasCanonical = entry.commands.some((c) => {
				const nc = normalizeIntentText(c);
				return nc === canonical || nc === normalizeIntentText(hit);
			});
			if (hasCanonical) return { pluginFile: entry.file, commandName: canonical, via: 'synonym' };
		}
	}

	return null;
}

// Always blocked for ALL users (including owner): no disk mutations, shell spawning, or credential leaks
const ALWAYS_UNSAFE_CODE_PATTERNS = [
	{ re: /\bchild_process\b|\bexecSync\b|\bspawnSync\b|\bexecFile\b/i, msg: 'Shell/process spawning primitives are not allowed.' },
	{ re: /\bprocess\s*\.\s*(env|exit|kill|abort|mainModule|binding|dlopen)\b/, msg: 'Accessing process environment or lifecycle controls is not allowed.' },
	{ re: /\b(global|globalThis)\s*\.\s*process\b/, msg: 'Accessing global.process is not allowed.' },
	{ re: /(?<![.\w$])(require|eval|Function)\s*\(/, msg: 'Direct require/eval/Function calls are not allowed; use provided helpers or importLib(name).' },
	{ re: /\bimport\s*\(/, msg: 'Dynamic import() is not allowed; use importLib(name) for bot lib/ modules.' },
	{
		re: /\b(writeFile|writeFileSync|appendFile|appendFileSync|unlink|unlinkSync|rmSync|rmdirSync|mkdirSync|renameSync|copyFileSync|createWriteStream|openSync)\b|fs\/promises/i,
		msg: 'Modifying or deleting bot files on disk is not allowed; only temporary in-memory code execution is permitted.',
	},
	{ re: /(creds\.json|\.env|youtube-cookies|cookies\.txt)/i, msg: 'Accessing sensitive credential/cookie files is not allowed.' },
];

// Dangerous / privileged primitives restricted to bot owner ONLY ("الاكواد الخطيرة تشتغل مع المالك بس")
const OWNER_ONLY_CODE_PATTERNS = [
	{ re: /\b(conn|sock|satanic|baileys)\b/, msg: 'Direct Baileys/socket operations in temporary code are restricted to the bot owner (isOwner).' },
	{ re: /\b(db|global|globalThis|config)\b/, msg: 'Accessing or modifying bot database, globals, or configuration in temporary code is restricted to the bot owner (isOwner).' },
	{ re: /\b(axios|fetch|importLib|XMLHttpRequest|WebSocket)\b/, msg: 'External network calls and dynamic library imports in temporary code are restricted to the bot owner (isOwner).' },
	{ re: /\b(groupSettingUpdate|groupParticipantsUpdate|groupUpdateSubject|groupUpdateDescription|groupRevokeInvite|groupLeave|sendMessage|relayMessage|updateProfile|logout|query)\b/, msg: 'Privileged WhatsApp actions in temporary code are restricted to the bot owner (isOwner).' },
];

export async function executeGeneratedCode({ purpose = '', code = '', m, ctx = {} } = {}) {
	const isOwner = Boolean(ctx.isOwner || ctx.isROwner);

	const rawCode = String(code || '').trim();
	if (!rawCode) {
		return { ok: false, error: 'Code parameter cannot be empty.' };
	}

	for (const rule of ALWAYS_UNSAFE_CODE_PATTERNS) {
		if (rule.re.test(rawCode)) {
			return { ok: false, blocked: true, reason: 'policy', error: rule.msg };
		}
	}

	if (!isOwner) {
		for (const rule of OWNER_ONLY_CODE_PATTERNS) {
			if (rule.re.test(rawCode)) {
				return { ok: false, blocked: true, reason: 'owner', error: rule.msg };
			}
		}
	}

	const syntaxErr = syntaxerror(rawCode, 'AiGeneratedCode', {
		allowReturnOutsideFunction: true,
		allowAwaitOutsideFunction: true,
		sourceType: 'module',
	});
	if (syntaxErr) {
		return { ok: false, syntaxError: String(syntaxErr), error: `Syntax error in generated code: ${syntaxErr.message || syntaxErr}` };
	}

	const conn = ctx.conn || ctx.sock || m?.conn;
	const { proxyConn, proxyM, capturedReplies } = createMessagingProxy(conn, m);
	const capturedLogs = [];

	const importLib = async (libName) => {
		const cleaned = String(libName || '').trim().replace(/^\.?\/?lib\//, '').replace(/\.js$/i, '');
		if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
			throw new Error(`Invalid library name "${libName}"`);
		}
		const target = path.resolve(LIB_DIR, `${cleaned}.js`);
		if (!target.startsWith(LIB_DIR + path.sep) || !fs.existsSync(target)) {
			throw new Error(`Library "lib/${cleaned}.js" does not exist`);
		}
		return import(pathToFileURL(target).href);
	};

	const printFn = (...vals) => {
		const textOut = format(...vals);
		capturedLogs.push(textOut.slice(0, 1500));
		return textOut;
	};

	const replyFn = async (txt) => {
		const str = typeof txt === 'string' ? txt : format(txt);
		return proxyM.reply(str);
	};

	// Safe read-only context for non-owners; full live bot bindings for owner only
	const safeReadOnlyM = {
		chat: m?.chat || '',
		sender: m?.sender || '',
		isGroup: Boolean(m?.isGroup),
		name: m?.name || m?.pushName || '',
		text: m?.text || '',
		quoted: m?.quoted ? { text: m.quoted.text || '', sender: m.quoted.sender || '', mtype: m.quoted.mtype || '' } : null,
		mentionedJid: Array.isArray(m?.mentionedJid) ? [...m.mentionedJid] : [],
	};
	const safeGroupMeta = {
		subject: ctx.groupMetadata?.subject || '',
		desc: ctx.groupMetadata?.desc || '',
		size: Array.isArray(ctx.participants) ? ctx.participants.length : 0,
	};
	const safeParticipants = Array.isArray(ctx.participants)
		? ctx.participants.map((p) => ({ id: p.id || p.jid || '', admin: p.admin || null }))
		: [];

	try {
		const fn = new AsyncFunction(
			'm',
			'conn',
			'sock',
			'extra',
			'participants',
			'groupMetadata',
			'db',
			'config',
			'axios',
			'fetch',
			'baileys',
			'util',
			'print',
			'reply',
			'importLib',
			rawCode
		);

		const result = isOwner
			? await fn.call(
					proxyConn,
					proxyM,
					proxyConn,
					proxyConn,
					{ ...ctx, conn: proxyConn, sock: proxyConn },
					ctx.participants || [],
					ctx.groupMetadata || {},
					global.db,
					ctx.config || global.config,
					axios,
					global.fetch,
					baileys,
					{ format },
					printFn,
					replyFn,
					importLib
				)
			: await fn.call(
					null,
					safeReadOnlyM,
					undefined,
					undefined,
					undefined,
					safeParticipants,
					safeGroupMeta,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					{ format },
					printFn,
					replyFn,
					undefined
				);

		return {
			ok: true,
			mode: isOwner ? 'owner' : 'safe_user',
			purpose: String(purpose || '').slice(0, 200),
			result: result === undefined ? null : format(result).slice(0, 2000),
			repliesSent: capturedReplies,
			logs: capturedLogs,
		};
	} catch (err) {
		return {
			ok: false,
			mode: isOwner ? 'owner' : 'safe_user',
			purpose: String(purpose || '').slice(0, 200),
			error: err?.message || format(err),
			repliesSent: capturedReplies,
			logs: capturedLogs,
		};
	}
}

export const AI_AGENT_TOOL_DECLARATIONS = [
	{
		name: 'get_runtime_context',
		description: 'Inspect the live WhatsApp bot runtime environment: bot info, sender permissions (isOwner, isAdmin, isBotAdmin), chat/group metadata, active DB settings, available lib/ modules, and available conn/Baileys methods.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				includeMethods: {
					type: Type.BOOLEAN,
					description: 'Whether to include conn/Baileys method names (default true).',
				},
			},
		},
	},
	{
		name: 'list_bot_commands',
		description: 'Dynamically scan global.plugins right now (no hardcoded list) to discover all loaded bot commands, their triggers, help entries, tags, permission requirements, and whether the current user can run each command right now.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				query: {
					type: Type.STRING,
					description: 'Optional space-separated keywords to filter plugins by filename, command names, help text, or tags.',
				},
				tag: {
					type: Type.STRING,
					description: 'Optional category tag filter (e.g., group, owner, tools, ai, downloader).',
				},
				onlyRunnable: {
					type: Type.BOOLEAN,
					description: 'If true, only return plugins the caller has permission to execute in this chat right now.',
				},
			},
		},
	},
	{
		name: 'search_bot_code',
		description: 'Search across plugins/, lib/, handler.js, and config.js source code to learn how features, Arabic aliases, Baileys APIs, or DB helpers are implemented in this bot.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				query: {
					type: Type.STRING,
					description: 'Text or symbol to search for (case-insensitive).',
				},
				scope: {
					type: Type.STRING,
					description: 'Where to search: all, plugins, or lib.',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'read_bot_file',
		description: 'Read source code lines of a file inside plugins/, lib/, handler.js, config.js, or package.json to analyze how an existing plugin or library works before calling it or writing compatible new code.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				filePath: {
					type: Type.STRING,
					description: 'Relative path inside the workspace, e.g. "plugins/group-manage.js" or "lib/ytdl.js".',
				},
				startLine: {
					type: Type.INTEGER,
					description: '1-based start line number (default 1).',
				},
				endLine: {
					type: Type.INTEGER,
					description: '1-based end line number (default startLine + 219).',
				},
			},
			required: ['filePath'],
		},
	},
	{
		name: 'run_bot_plugin',
		description: 'Execute an existing bot plugin handler directly without the user typing a dot command. Enforces all real bot permissions (admin, botAdmin, owner, group, etc.) automatically.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				pluginFile: {
					type: Type.STRING,
					description: 'Exact plugin filename from global.plugins, e.g. "group-manage.js".',
				},
				commandName: {
					type: Type.STRING,
					description: 'Specific command trigger supported by the plugin (e.g. "closegc", "opengc", "kick", "play").',
				},
				text: {
					type: Type.STRING,
					description: 'Argument string to pass as extra.text and split into extra.args.',
				},
			},
			required: ['pluginFile', 'commandName'],
		},
	},
	{
		name: 'execute_custom_code',
		description: 'Fallback when NO existing plugin satisfies the request: write and execute TEMPORARY in-memory async JS code using fetch (e.g. https://wttr.in/ for weather, public APIs, math, etc.). For owners, conn/sock/db/axios/fetch/importLib are fully available. Never modifies bot files on disk.',
		parameters: {
			type: Type.OBJECT,
			properties: {
				purpose: {
					type: Type.STRING,
					description: 'Short description of what this code does.',
				},
				code: {
					type: Type.STRING,
					description: 'Temporary async JavaScript function body to execute in memory. You can use await fetch(...), parse JSON, and call reply(text).',
				},
			},
			required: ['purpose', 'code'],
		},
	},
];

function buildSystemInstruction(runtimeSnapshot) {
	return [
		`You are the intelligent autonomous assistant of the WhatsApp bot "${runtimeSnapshot.botName}".`,
		'Reply in the same language as the user (Arabic if they write in Arabic, otherwise English) and be clear and concise.',
		'',
		'CRITICAL OPERATING RULES (NO HARDCODING, READ-ONLY FILES, TEMPORARY CODE):',
		'1. NEVER assume or guess command names or plugin filenames from memory. You MUST inspect the live bot environment dynamically using tools (`list_bot_commands`, `get_runtime_context`, `search_bot_code`, `read_bot_file`).',
		'2. You can ONLY READ bot files (`plugins/`, `lib/`, `handler.js`, `config.js`) to learn how the bot works. NEVER modify, edit, create, or delete any bot files on disk.',
		'3. If a user asks you to perform an action (e.g., "اقفل الجروب", "شغل اغنية ...", "احسب ...", "طقس ...", "سرعة ..."), FIRST call `list_bot_commands` (and `search_bot_code` if needed) to discover if an existing plugin handles it. Understand natural-language Arabic/English requests even when they do not match a command name literally (e.g. "اقفل الجروب" = closegc, "افتح الجروب" = opengc, "سرعة البوت" = ping).',
		'4. Whenever you find a candidate plugin with unfamiliar arguments or multiple subcommands, call `read_bot_file` on `"plugins/<file>"` to verify exact `command`, `args`, `text`, and `m.quoted`/`mentionedJid` expectations BEFORE calling `run_bot_plugin`.',
		'5. Execute matching existing plugins via `run_bot_plugin`. If `run_bot_plugin` reports a permission block (like `owner`, `rowner`, `admin`, `botAdmin`, etc.), refuse politely and explain why—NEVER try to bypass permissions via custom code.',
		'6. IF NO EXISTING PLUGIN MATCHES: You MUST write and execute temporary in-memory JavaScript code using `execute_custom_code` to fulfill the user request! (e.g. searching the web, fetching weather via public APIs like https://wttr.in/, playing/downloading audio, checking bot stats, calculating values, scraping, or sending custom messages). If the action requires privileged bot bindings (`conn`, `sock`, `db`, `axios`, `fetch`, `importLib`), ensure the requester is the owner (`isOwner`) or perform safe processing.',
		'7. NEVER reply that you "cannot" do something, "have no access", or "no command is available" WITHOUT first attempting `list_bot_commands` and then `execute_custom_code`. Giving up is the last resort, only after a tool actually fails. Always try to DO the task with a tool first.',
		'8. If the user asks about what the bot can do or asks you to analyze plugins/libraries, use the read-only inspection tools to answer accurately from actual live files.',
		'9. When `run_bot_plugin` or `execute_custom_code` already sent the final result message directly to the chat (`repliesSent` is non-empty), keep your closing response short and avoid repeating long outputs.',
	].join('\n');
}

function toOpenAiTools(declarations) {
	return declarations.map((decl) => ({
		type: 'function',
		function: {
			name: decl.name,
			description: decl.description,
			parameters: normalizeJsonSchema(decl.parameters),
		},
	}));
}

function normalizeJsonSchema(node) {
	if (!node || typeof node !== 'object') return node;
	const out = {};
	for (const [k, v] of Object.entries(node)) {
		if (k === 'type' && typeof v === 'string') {
			out[k] = v.toLowerCase();
		} else if (Array.isArray(v)) {
			out[k] = v.map(normalizeJsonSchema);
		} else if (v && typeof v === 'object') {
			out[k] = normalizeJsonSchema(v);
		} else {
			out[k] = v;
		}
	}
	return out;
}

export function parseReactJsonAction(rawText) {
	const raw = String(rawText || '').trim();
	if (!raw) return { finalAnswer: '' };

	const tryParse = (candidate) => {
		try {
			const parsed = JSON.parse(candidate);
			if (parsed && typeof parsed === 'object') {
				if (Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
					return {
						toolCalls: parsed.tool_calls
							.filter((c) => c && typeof c.name === 'string')
							.map((c, idx) => ({
								id: c.id || `react_${Date.now()}_${idx}`,
								name: c.name,
								args: c.args && typeof c.args === 'object' ? c.args : {},
							})),
					};
				}
				if (typeof parsed.final_answer === 'string') {
					return { finalAnswer: parsed.final_answer };
				}
				if (typeof parsed.answer === 'string') {
					return { finalAnswer: parsed.answer };
				}
			}
		} catch {}
		return null;
	};

	const direct = tryParse(raw);
	if (direct) return direct;

	const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch) {
		const parsed = tryParse(fencedMatch[1].trim());
		if (parsed) return parsed;
	}

	const firstBrace = raw.indexOf('{');
	const lastBrace = raw.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		const parsed = tryParse(raw.slice(firstBrace, lastBrace + 1));
		if (parsed) return parsed;
	}

	return { finalAnswer: raw };
}

function buildReactToolPrompt(systemInstruction) {
	const toolLines = AI_AGENT_TOOL_DECLARATIONS.map((t) => {
		const props = t.parameters?.properties ? Object.keys(t.parameters.properties).join(', ') : '';
		return `- ${t.name}(${props}): ${t.description}`;
	}).join('\n');

	return [
		systemInstruction,
		'',
		'TOOL CALLING PROTOCOL (STRICT JSON):',
		'You MUST respond with ONLY ONE valid JSON object (no markdown fences, no extra prose outside JSON):',
		'• To invoke one or more tools:',
		'  {"tool_calls":[{"name":"tool_name","args":{...}}]}',
		'• When you have completed the task or have the final reply for the user:',
		'  {"final_answer":"your final reply in the user language"}',
		'',
		'Available tools:',
		toolLines,
	].join('\n');
}

export const KEYLESS_AI_PROVIDERS = [
	{
		name: 'pollinations-openai',
		url: 'https://text.pollinations.ai/openai',
		model: 'openai-fast',
		supportsNativeTools: true,
	},
	{
		name: 'llm7-openai',
		url: 'https://api.llm7.io/v1/chat/completions',
		model: 'default',
		supportsNativeTools: true,
	},
	{
		name: 'ch-at-react',
		url: 'https://ch.at/v1/chat/completions',
		model: 'default',
		supportsNativeTools: false,
	},
	{
		name: 'pollinations-react',
		url: 'https://text.pollinations.ai/',
		model: 'openai-fast',
		supportsNativeTools: false,
		isPollinationsRoot: true,
	},
];

async function callKeylessProvider(provider, { systemInstruction, openAiMessages, openAiTools, fetchFn = global.fetch }) {
	const useNativeTools = Boolean(provider.supportsNativeTools);
	const messages = useNativeTools
		? [{ role: 'system', content: systemInstruction }, ...openAiMessages]
		: [{ role: 'system', content: buildReactToolPrompt(systemInstruction) }, ...flattenMessagesForReact(openAiMessages)];

	const payload = provider.isPollinationsRoot
		? { model: provider.model, messages, private: true, jsonMode: false }
		: useNativeTools
			? { model: provider.model, messages, tools: openAiTools, tool_choice: 'auto' }
			: { model: provider.model, messages };

	const res = await fetchFn(provider.url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(25000),
	});

	const rawText = await res.text();
	if (!res.ok) {
		throw new Error(`${provider.name} HTTP ${res.status}: ${rawText.slice(0, 180)}`);
	}

	if (provider.isPollinationsRoot) {
		const parsedAction = parseReactJsonAction(rawText);
		return { mode: 'react', rawText, ...parsedAction };
	}

	let data;
	try {
		data = JSON.parse(rawText);
	} catch {
		throw new Error(`${provider.name} invalid JSON response`);
	}

	const msg = data?.choices?.[0]?.message;
	if (!msg) {
		throw new Error(`${provider.name} returned empty choices`);
	}

	if (useNativeTools && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
		const calls = msg.tool_calls.map((tc, idx) => {
			let parsedArgs = {};
			try {
				parsedArgs = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments || '{}') : tc.function?.arguments || {};
			} catch {}
			return {
				id: tc.id || `oa_${Date.now()}_${idx}`,
				name: tc.function?.name,
				args: parsedArgs,
			};
		});
		return { mode: 'native', assistantMessage: msg, toolCalls: calls };
	}

	const contentText = String(msg.content || '').trim();
	const parsedAction = parseReactJsonAction(contentText);
	return { mode: useNativeTools ? 'native_text' : 'react', rawText: contentText, assistantMessage: msg, ...parsedAction };
}

function flattenMessagesForReact(openAiMessages) {
	return openAiMessages.map((msg) => {
		if (msg.role === 'tool') {
			return {
				role: 'user',
				content: `Tool result (${msg.name || msg.tool_call_id}):\n${msg.content}\n\nContinue and reply ONLY with JSON (either {"tool_calls":[...]} or {"final_answer":"..."}).`,
			};
		}
		if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
			return {
				role: 'assistant',
				content: JSON.stringify({
					tool_calls: msg.tool_calls.map((tc) => ({
						name: tc.function?.name,
						args: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments || '{}') : tc.function?.arguments || {},
					})),
				}),
			};
		}
		return { role: msg.role, content: String(msg.content || '') };
	});
}

async function runGeminiAgentLoop({ ai, model, systemInstruction, contextualMessage, priorHistory, maxTurns, dispatchToolCall }) {
	const contents = [
		...priorHistory.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
		{ role: 'user', parts: [{ text: contextualMessage }] },
	];

	for (let step = 0; step < maxTurns; step++) {
		const response = await ai.models.generateContent({
			model,
			contents,
			config: {
				systemInstruction,
				tools: [{ functionDeclarations: AI_AGENT_TOOL_DECLARATIONS }],
			},
		});

		const candidateContent = response?.candidates?.[0]?.content;
		const functionCalls = response?.functionCalls;

		if (Array.isArray(functionCalls) && functionCalls.length > 0) {
			if (candidateContent) contents.push(candidateContent);
			const responseParts = [];
			for (const call of functionCalls) {
				const toolResult = await dispatchToolCall(call);
				responseParts.push({
					functionResponse: {
						id: call.id,
						name: call.name,
						response: { result: toolResult },
					},
				});
			}
			contents.push({ role: 'user', parts: responseParts });
			continue;
		}

		return String(response?.text || '').trim();
	}
	return '';
}

async function runKeylessAgentLoop({ systemInstruction, contextualMessage, priorHistory, maxTurns, dispatchToolCall, providers = KEYLESS_AI_PROVIDERS, fetchFn = global.fetch }) {
	const openAiTools = toOpenAiTools(AI_AGENT_TOOL_DECLARATIONS);
	const openAiMessages = [
		...priorHistory.map((h) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
		{ role: 'user', content: contextualMessage },
	];

	let activeProviders = [...providers];
	let lastErrors = [];

	for (let step = 0; step < maxTurns; step++) {
		let turnResult = null;
		let chosenProvider = null;

		for (const provider of activeProviders) {
			try {
				turnResult = await callKeylessProvider(provider, { systemInstruction, openAiMessages, openAiTools, fetchFn });
				chosenProvider = provider;
				break;
			} catch (err) {
				lastErrors.push(`${provider.name}: ${err?.message || err}`);
			}
		}

		if (!turnResult) {
			throw new Error(`All keyless AI providers failed (${lastErrors.slice(-3).join(' | ')})`);
		}

		// Keep working provider at the front for subsequent steps in this turn
		activeProviders = [chosenProvider, ...activeProviders.filter((p) => p !== chosenProvider)];

		if (Array.isArray(turnResult.toolCalls) && turnResult.toolCalls.length > 0) {
			openAiMessages.push({
				role: 'assistant',
				content: turnResult.assistantMessage?.content || '',
				tool_calls: turnResult.toolCalls.map((tc) => ({
					id: tc.id,
					type: 'function',
					function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
				})),
			});

			for (const call of turnResult.toolCalls) {
				const toolResult = await dispatchToolCall(call);
				openAiMessages.push({
					role: 'tool',
					tool_call_id: call.id,
					name: call.name,
					content: JSON.stringify(toolResult).slice(0, 12000),
				});
			}
			continue;
		}

		return String(turnResult.finalAnswer || turnResult.rawText || '').trim();
	}

	return '';
}

function getOptionalGeminiClient() {
	const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
	if (!apiKey) return null;
	return new GoogleGenAI({
		apiKey,
		httpOptions: {
			headers: {
				'User-Agent': 'aistudio-build',
			},
		},
	});
}

export async function runAiAgent(prompt, m, extra = {}, options = {}) {
	const userPrompt = String(prompt || '').trim();
	if (!userPrompt) {
		throw new Error('Prompt is required.');
	}

	const ctx = { ...extra, conn: extra.conn || extra.sock || m?.conn };
	const chatKey = `${m?.chat || 'default'}::${m?.sender || 'anon'}`;

	if (/^(reset|clear|مسح|تصفير)$/i.test(userPrompt)) {
		chatAgentHistory.delete(chatKey);
		return {
			text: '✅ تم مسح ذاكرة الوكيل الذكي لهذه المحادثة.',
			actions: [],
		};
	}

	const maxTurns = Math.max(1, Math.min(Number(options.maxTurns) || 8, 12));
	const pluginsRegistry = options.plugins || global.plugins || {};
	const runtimeSnapshot = inspectRuntimeContext(m, ctx);
	const systemInstruction = buildSystemInstruction(runtimeSnapshot);
	const priorHistory = Array.isArray(chatAgentHistory.get(chatKey)) ? chatAgentHistory.get(chatKey) : [];

	const contextualMessage = [
		`User request: ${userPrompt}`,
		m?.quoted?.text ? `Quoted message text: ${String(m.quoted.text).slice(0, 600)}` : '',
		Array.isArray(m?.mentionedJid) && m.mentionedJid.length ? `Mentioned JIDs: ${m.mentionedJid.join(', ')}` : '',
		`Current live context: sender=${runtimeSnapshot.sender.jid}, isGroup=${runtimeSnapshot.chat.isGroup}, isAdmin=${runtimeSnapshot.sender.isAdmin}, isBotAdmin=${runtimeSnapshot.sender.isBotAdmin}, isOwner=${runtimeSnapshot.sender.isOwner}`,
	]
		.filter(Boolean)
		.join('\n');

	const executedActions = [];

	const dispatchToolCall = async (call) => {
		const args = call?.args || {};
		switch (call?.name) {
			case 'get_runtime_context': {
				const snap = inspectRuntimeContext(m, ctx);
				if (args.includeMethods === false) delete snap.connMethods;
				return snap;
			}
			case 'list_bot_commands':
				return discoverBotPlugins({
					plugins: pluginsRegistry,
					m,
					ctx,
					query: args.query,
					tag: args.tag,
					onlyRunnable: Boolean(args.onlyRunnable),
				});
			case 'search_bot_code':
				return searchBotSourceCode(args.query, { scope: args.scope || 'all' });
			case 'read_bot_file':
				return readBotSourceFile(args.filePath, { startLine: args.startLine, endLine: args.endLine });
			case 'run_bot_plugin': {
				const res = await executeBotPlugin({
					pluginFile: args.pluginFile,
					commandName: args.commandName,
					text: args.text || '',
					m,
					ctx,
					plugins: pluginsRegistry,
				});
				executedActions.push({ type: 'plugin', pluginFile: res.pluginFile, command: res.command, ok: res.ok, blocked: Boolean(res.blocked) });
				return res;
			}
			case 'execute_custom_code': {
				const res = await executeGeneratedCode({
					purpose: args.purpose || '',
					code: args.code || '',
					m,
					ctx,
				});
				executedActions.push({ type: 'custom_code', purpose: args.purpose || '', ok: res.ok, blocked: Boolean(res.blocked) });
				return res;
			}
			default:
				return { ok: false, error: `Unknown tool: ${call?.name}` };
		}
	};

	let finalText = '';
	const explicitAiClient = options.aiClient || (typeof options.aiFactory === 'function' ? options.aiFactory() : null);

	// Wrap the Gemini/keyless loop so it can be re-invoked with a corrective nudge on refusal.
	const runAgentLoop = async (ctxMsg) => {
		if (explicitAiClient) {
			return runGeminiAgentLoop({
				ai: explicitAiClient,
				model: options.model || DEFAULT_GEMINI_MODEL,
				systemInstruction,
				contextualMessage: ctxMsg,
				priorHistory,
				maxTurns,
				dispatchToolCall,
			});
		}

		const optionalGemini = getOptionalGeminiClient();
		if (optionalGemini) {
			try {
				const out = await runGeminiAgentLoop({
					ai: optionalGemini,
					model: options.model || DEFAULT_GEMINI_MODEL,
					systemInstruction,
					contextualMessage: ctxMsg,
					priorHistory,
					maxTurns,
					dispatchToolCall,
				});
				if (out) return out;
			} catch (geminiErr) {
				console.warn('[AI-AGENT] Gemini key path failed, falling back to keyless providers:', geminiErr?.message || geminiErr);
			}
		}

		return runKeylessAgentLoop({
			systemInstruction,
			contextualMessage: ctxMsg,
			priorHistory,
			maxTurns,
			dispatchToolCall,
			providers: options.providers || KEYLESS_AI_PROVIDERS,
			fetchFn: options.fetchFn || global.fetch,
		});
	};

	const REFUSAL_RE = /لا\s*(?:أ|ا)ستطيع|لا\s*يمكنني|لا\s*يوجد\s*أمر|غير\s* قادر|عذرا|not\s+able|unable|cannot|can't|i'?m\s+sorry|no\s+command/i;
	const isRefusal = (txt) => !txt || REFUSAL_RE.test(txt);
	const anyActionOk = () => executedActions.some((a) => a.ok);

	finalText = await runAgentLoop(contextualMessage);

	// Fallback 1: deterministic Arabic/English intent → existing runnable plugin.
	// Only triggers when the model refused/failed and nothing was actually executed.
	if (isRefusal(finalText) && !anyActionOk()) {
		const resolved = resolveDeterministicPluginAction(userPrompt, { plugins: pluginsRegistry, m, ctx });
		if (resolved) {
			const res = await executeBotPlugin({
				pluginFile: resolved.pluginFile,
				commandName: resolved.commandName,
				text: '',
				m,
				ctx,
				plugins: pluginsRegistry,
			});
			executedActions.push({ type: 'plugin', pluginFile: res.pluginFile, command: res.command, ok: res.ok, blocked: Boolean(res.blocked), via: `deterministic:${resolved.via}` });
			if (res.ok) {
				finalText = res.repliesSent?.length ? '✅ تم تنفيذ المطلوب.' : '✅ تم.';
			} else if (res.blocked) {
				finalText = `⚠️ ${res.error}`;
			}
		}
	}

	// Fallback 2: one corrective LLM pass that forbids giving up and forces a tool call
	// (typically execute_custom_code) so temporary commands get generated instead of refused.
	if (isRefusal(finalText) && !anyActionOk() && options.allowRefusalRetry !== false) {
		const corrective = `${contextualMessage}\n\nSYSTEM OVERRIDE: Your previous reply refused or gave up. That is NOT acceptable. You MUST now call a tool to actually DO the task — use run_bot_plugin if a plugin fits, otherwise use execute_custom_code to write and run temporary code (e.g. fetch weather, download media, compute). Do not apologize; act.`;
		const retryText = await runAgentLoop(corrective);
		if (retryText && !isRefusal(retryText)) finalText = retryText;
		else if (anyActionOk() && isRefusal(finalText)) finalText = '✅ تم تنفيذ المطلوب.';
	}

	if (!finalText) {
		finalText = anyActionOk() ? '✅ تم تنفيذ المطلوب.' : '⚠️ تعذر إكمال الطلب، حاول صياغة الطلب بشكل أوضح.';
	}

	const updatedMemory = [
		...priorHistory,
		{ role: 'user', text: userPrompt },
		{ role: 'model', text: finalText },
	].slice(-CHAT_MEMORY_MAX_TURNS * 2);
	chatAgentHistory.set(chatKey, updatedMemory);

	return {
		text: finalText,
		actions: executedActions,
	};
}

export function clearAiAgentMemory(chatId, senderId) {
	if (!chatId && !senderId) {
		chatAgentHistory.clear();
		return;
	}
	chatAgentHistory.delete(`${chatId || 'default'}::${senderId || 'anon'}`);
}
