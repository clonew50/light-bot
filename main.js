import './lib/globals.js';
import './config.js';
import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = process.platform !== 'win32') {
	if (rmPrefix) return /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL;
	return pathToFileURL(pathURL).toString();
};

global.__dirname = function dirname(pathURL) {
	return path.dirname(global.__filename(pathURL, true));
};

global.__require = function require(dir = import.meta.url) {
	return createRequire(dir);
};

import fs from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { format } from 'util';
import { parentPort } from 'worker_threads';
import chalk from 'chalk';
import pino from 'pino';
import syntaxerror from 'syntax-error';
import Database from 'better-sqlite3';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import useSQLite from './lib/useSQLite.js';
import { readPanelConfig, startWebPanel, pushPanelEvent } from './system/webPanel.js';
import { setSubBotEventLogger, restoreSubBots } from './system/subBots.js';
import { applyUpdate } from './system/autoUpdate.mjs';

const { Browsers, fetchLatestWaWebVersion, makeCacheableSignalKeyStore } = global.baileys;

protoType();
serialize();

const __dirname = global.__dirname(import.meta.url);

// إعادة التشغيل: index.js (العميل الأب) بيعيد تشغيل الـworker عند استقبال 'restart'
global.restartBot = (reason = 'restart') => {
	try {
		parentPort.postMessage('restart');
	} catch {}
	return true;
};
global.restartBotClean = global.restartBot;

global.prefix = new RegExp('^[' + '‎xzXZ/!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-'.replace(/[|\\{}[\]()^$+*?.-]/g, '\\$&') + ']');

global.db = {
	sqlite: null,
	data: null,
};

global.loadDatabase = function () {
	if (!global.db.sqlite) {
		const dbFile = path.resolve('./data/database.db');
		fs.mkdirSync(path.dirname(dbFile), { recursive: true });
		global.db.sqlite = new Database(dbFile);
		global.db.sqlite.pragma('journal_mode = WAL');
		global.db.sqlite.pragma('synchronous = NORMAL');
		global.db.sqlite.pragma('wal_autocheckpoint = 1000');
		global.db.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS database (
        id INTEGER PRIMARY KEY,
        data TEXT
      )
    `);
	}

	if (global.db.data !== null) return;

	global.db.data = {
		users: {},
		chats: {},
		stats: {},
		msgs: {},
		sticker: {},
		settings: {},
	};

	const row = global.db.sqlite.prepare('SELECT data FROM database WHERE id = 1').get();
	if (row?.data) {
		try {
			Object.assign(global.db.data, JSON.parse(row.data));
		} catch {
			console.error('[DB] JSON corrupted, reset database');
		}
	} else {
		global.db.sqlite.prepare('INSERT OR IGNORE INTO database (id, data) VALUES (1, ?)').run(JSON.stringify(global.db.data));
	}
};

loadDatabase();

const panelCfg = readPanelConfig();
const loginMode = panelCfg.loginMode === 'qr' ? 'qr' : 'code';
if (panelCfg.phone) global.pairingNumber = panelCfg.phone;

function normalizeMainPhone(raw) {
	let s = String(raw || '').trim();
	if (s.includes('@')) s = s.split('@')[0];
	if (s.includes(':')) s = s.split(':')[0];
	let d = s.replace(/[^0-9]/g, '');
	if (d.startsWith('00') && d.length >= 10) d = d.slice(2);
	if (/^200(1[0125]\d{8})$/.test(d)) d = '20' + d.slice(3);
	return d;
}

global.__panelState = {
	connection: 'starting',
	lastQR: null,
	pairingCode: null,
	pairingError: null,
	phone: normalizeMainPhone(global.pairingNumber),
	mode: loginMode,
	startedAt: Date.now(),
};

const { state, saveCreds } = await useSQLite('sessions');
const { version } = await fetchLatestWaWebVersion();

const connectionOptions = {
	auth: {
		creds: state.creds,
		keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'fatal', stream: 'store' })),
	},
	version,
	logger: pino({ level: 'silent' }),
	browser: Browsers.ubuntu('Chrome'),
	generateHighQualityLinkPreview: true,
	syncFullHistory: false,
	markOnlineOnConnect: true,
	connectTimeoutMs: 60000,
	keepAliveIntervalMs: 30000,
	retryRequestDelayMs: 250,
	maxMsgRetryCount: 5,
	cachedGroupMetadata: (jid) => global.conn?.chats?.[jid],
};

let handshakeReadyResolve = null;
let handshakeReadyPromise = new Promise((resolve) => {
	handshakeReadyResolve = resolve;
});

global.conn = makeWASocket(connectionOptions);

global.issueMainPairingCode = async (phoneRaw) => {
	const phone = normalizeMainPhone(phoneRaw || global.pairingNumber);
	if (!phone || phone.startsWith('0') || phone.length < 6 || phone.length > 15) {
		throw new Error('رقم الهاتف غير صالح — أدخل الرقم بالرمز الدولي بدون أصفار زائدة');
	}
	if (global.conn?.authState?.creds?.registered) {
		throw new Error('البوت مسجل بالفعل. أعد ضبط الجلسة أولاً لتغيير الرقم.');
	}
	global.__panelState.phone = phone;
	global.__panelState.pairingError = null;
	await Promise.race([
		handshakeReadyPromise,
		new Promise((resolve) => {
			const t = setTimeout(resolve, 4500);
			t.unref?.();
		}),
	]);
	try {
		global.conn.cancelPairingCode?.();
		let code = await global.conn.requestPairingCode(phone);
		code = code?.match(/.{1,4}/g)?.join('-') || code;
		global.__panelState.pairingCode = code;
		global.__panelState.pairingError = null;
		global.__panelState.lastQR = null;
		console.log(chalk.black(chalk.bgGreen('Your Pairing Code : ')), chalk.black(chalk.white(code)));
		pushPanelEvent('كود الربط: ' + code);
		return code;
	} catch (e) {
		const errMsg = e?.message || String(e);
		global.__panelState.pairingError = errMsg;
		throw e;
	}
};

if (!global.conn.authState.creds.registered) {
	if (loginMode === 'qr') {
		console.log(chalk.bgWhite(chalk.blue('QR mode — امسح الرمز من لوحة التحكم')));
		pushPanelEvent('وضع QR — بانتظار المسح من اللوحة');
	} else {
		console.log(chalk.bgWhite(chalk.blue('Generating code...')));
		Promise.race([
			handshakeReadyPromise,
			new Promise((resolve) => {
				const t = setTimeout(resolve, 4000);
				t.unref?.();
			}),
		])
			.then(() => global.issueMainPairingCode(global.pairingNumber))
			.catch((e) => {
				const errMsg = e?.message || String(e);
				if (global.__panelState) global.__panelState.pairingError = errMsg;
				console.error('[PAIRING]', errMsg);
				pushPanelEvent('تعذر إصدار كود الربط تلقائياً: ' + errMsg);
			});
	}
}

if (global.db) {
	setInterval(() => {
		if (global.db.data) {
			global.db.sqlite.prepare('UPDATE database SET data = ? WHERE id = 1').run(JSON.stringify(global.db.data));
		}
		if ((global.support || {}).find) {
			const folders = [tmpdir(), 'tmp'];
			folders.forEach((folder) => spawn('find', [folder, '-amin', '3', '-type', 'f', '-delete']));
		}
	}, 5000);
}

async function connectionUpdate(update) {
	const { receivedPendingNotifications, connection, lastDisconnect, isOnline, qr } = update;

	if (qr) {
		handshakeReadyResolve?.();
		if (global.__panelState) global.__panelState.lastQR = qr;
	}
	if (connection && global.__panelState) {
		global.__panelState.connection = connection;
		if (connection === 'open') {
			handshakeReadyResolve?.();
			global.__panelState.connectedAt = Date.now();
			global.__panelState.pairingCode = null;
			global.__panelState.pairingError = null;
			global.__panelState.lastQR = null;
			if (global.conn?.user?.id) {
				global.conn.user.jid = global.conn.decodeJid(global.conn.user.id);
			}
		}
		pushPanelEvent('الاتصال: ' + connection);
	}

	if (connection === 'connecting') console.log(chalk.redBright('⚡ Activating Bot, Please wait a moment...'));
	if (connection === 'open') console.log(chalk.green('✅ Connected'));

	if (isOnline === true) console.log(chalk.green('Status Active'));
	else if (isOnline === false) console.log(chalk.red('Status Offline'));

	if (receivedPendingNotifications) console.log(chalk.yellow('Waiting for New Message'));

	if (global.__panelState?.stopped && connection === 'close') {
		console.log(chalk.yellow('Bot stopped via panel — not reconnecting'));
		return;
	}

	const output = lastDisconnect?.error?.output;
	if (output?.payload) {
		if (output.statusCode === 401) {
			console.log(chalk.red('Session logged out. Recreate session...'));
			fs.rmSync('./sessions', { recursive: true, force: true });
			parentPort.postMessage('restart');
			return;
		} else if (output.statusCode === 403) {
			console.log(chalk.red('WhatsApp account banned :D'));
			process.exit(0);
		} else if (output.statusCode === 515) {
			console.log(chalk.yellow('Restart Required, Restarting....'));
		} else if (output.statusCode === 428) {
			console.log(chalk.yellow('Connection closed, Restarting....'));
		} else if (output.statusCode === 408) {
			console.log(chalk.yellow('Connection timed out, Restarting....'));
		} else {
			console.log(chalk.red(output.payload.message));
		}
		await global.reloadHandler(true);
	}

	if (!global.db.data) await global.loadDatabase();
}

let isInit = true;
let handler = await import('./handler.js');

global.reloadHandler = async function (restartConn) {
	try {
		const newHandler = await import('./handler.js?update=' + Date.now()).catch(console.error);
		if (Object.keys(newHandler || {}).length) handler = newHandler;
	} catch (e) {
		console.error(e);
	}

	if (restartConn) {
		const oldChats = global.conn.chats;
		try {
			global.conn.ws.close();
		} catch {}
		global.conn.ev.removeAllListeners();
		handshakeReadyPromise = new Promise((resolve) => {
			handshakeReadyResolve = resolve;
		});
		global.conn = makeWASocket(connectionOptions, { chats: oldChats });
		isInit = true;
	}

	if (!isInit) {
		global.conn.ev.off('messages.upsert', global.conn.handler);
		global.conn.ev.off('group-participants.update', global.conn.participantsUpdate);
		global.conn.ev.off('groups.update', global.conn.groupsUpdate);
		global.conn.ev.off('message.delete', global.conn.onDelete);
		global.conn.ev.off('connection.update', global.conn.connectionUpdate);
		global.conn.ev.off('creds.update', global.conn.credsUpdate);
	}

	global.conn.welcome = '✦━━━━━━[ *WELCOME* ]━━━━━━✦\n\n┏––––––━━━━━━━━•\n│⫹⫺ @subject\n┣━━━━━━━━┅┅┅\n│( 👋 Hello @user)\n├[ *INTRO* ]—\n│ *Name:* \n│ *Age:* \n│ *Gender:*\n┗––––––━━┅┅┅\n\n––––––┅┅ *DESCRIPTION* ┅┅––––––\n@desc';
	global.conn.bye = '✦━━━━━━[ *GOOD BYE* ]━━━━━━✦\nSayonara *@user* 👋( ╹▽╹ )';
	global.conn.spromote = '@user is now admin!';
	global.conn.sdemote = '@user is no longer admin!';
	global.conn.sDesc = 'Description has been changed to \n@desc';
	global.conn.sSubject = 'Group title has been changed to \n@subject';
	global.conn.sIcon = 'Group icon has been changed!';
	global.conn.sRevoke = 'Group link has been changed to \n@revoke';

	global.conn.handler = handler.handler.bind(global.conn);
	global.conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
	global.conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
	global.conn.onDelete = handler.deleteUpdate.bind(global.conn);
	global.conn.connectionUpdate = connectionUpdate.bind(global.conn);
	global.conn.credsUpdate = saveCreds.bind(global.conn);

	global.conn.ev.on('call', async (calls) => {
		for (const call of calls) {
			const { id, from, status } = call;
			const botJid = global.conn.user?.jid || (global.conn.user?.id ? global.conn.decodeJid(global.conn.user.id) : 'main');
			const settings = global.db.data.settings[botJid];
			if (status === 'offer' && settings?.anticall) {
				await global.conn.rejectCall(id, from);
				console.log('Rejecting call from', from);
			}
		}
	});

	global.conn.ev.on('messages.upsert', global.conn.handler);
	global.conn.ev.on('group-participants.update', global.conn.participantsUpdate);
	global.conn.ev.on('groups.update', global.conn.groupsUpdate);
	global.conn.ev.on('message.delete', global.conn.onDelete);
	global.conn.ev.on('connection.update', global.conn.connectionUpdate);
	global.conn.ev.on('creds.update', global.conn.credsUpdate);

	isInit = false;
	return true;
};

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function filesInit() {
	for (const filename of fs.readdirSync(pluginFolder).filter(pluginFilter)) {
		try {
			const file = global.__filename(join(pluginFolder, filename));
			const module = await import(file);
			global.plugins[filename] = module.default || module;
		} catch (e) {
			conn.logger.error('❌ Failed to load plugins ' + filename + ': ' + e);
			delete global.plugins[filename];
		}
	}
}

filesInit()
	.then(() => console.log('Successfully Loaded ' + Object.keys(global.plugins).length + ' Plugins'))
	.catch(console.error);

global.reload = async (_ev, filename) => {
	if (!pluginFilter(filename)) return;

	const dir = global.__filename(join(pluginFolder, filename), true);

	if (filename in global.plugins) {
		if (fs.existsSync(dir)) {
			conn.logger.info("re - require plugin '" + filename + "'");
		} else {
			conn.logger.warn("deleted plugin '" + filename + "'");
			return delete global.plugins[filename];
		}
	} else {
		conn.logger.info("requiring new plugin '" + filename + "'");
	}

	const err = syntaxerror(fs.readFileSync(dir), filename, {
		sourceType: 'module',
		allowAwaitOutsideFunction: true,
	});

	if (err) {
		conn.logger.error("syntax error while loading '" + filename + "'\n" + format(err));
		return;
	}

	try {
		const module = await import(global.__filename(dir) + '?update=' + Date.now());
		global.plugins[filename] = module.default || module;
	} catch (e) {
		conn.logger.error("error require plugin '" + filename + '\n' + format(e) + "'");
	} finally {
		global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
	}
};

Object.freeze(global.reload);
fs.watch(pluginFolder, global.reload);
await global.reloadHandler();

// لوحة التحكم الويب + استعادة البوتات الفرعية
try {
	setSubBotEventLogger(pushPanelEvent);
	startWebPanel();
	restoreSubBots().catch((e) => console.error('[SUBBOT]', e?.message || e));
} catch (e) {
	console.error('[WEB] تعذّر تشغيل اللوحة:', e && e.message);
}

// التحديث التلقائي الدوري (يتعطّل أثناء الربط، ويتوقف بـ AUTO_UPDATE=0)
const AUTO_UPDATE = process.env.AUTO_UPDATE !== '0';
const AUTO_UPDATE_INTERVAL_MIN = Number(process.env.AUTO_UPDATE_INTERVAL_MIN) || 60;
if (AUTO_UPDATE && AUTO_UPDATE_INTERVAL_MIN > 0) {
	setInterval(async () => {
		if (!conn.authState.creds.registered) return; // لا نقطع عملية الربط
		try {
			await applyUpdate({
				log: (t) => console.log(t),
				event: (m) => pushPanelEvent(m),
			});
		} catch (e) {
			console.error('[UPDATE]', e && e.message);
		}
	}, AUTO_UPDATE_INTERVAL_MIN * 60 * 1000);
	console.log('🔁 [UPDATE] التحديث التلقائي كل ' + AUTO_UPDATE_INTERVAL_MIN + ' دقيقة (يتوقف بـ AUTO_UPDATE=0)');
}

async function _quickTest() {
	const results = await Promise.all(
		[
			spawn('ffmpeg'),
			spawn('ffprobe'),
			spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
			spawn('convert'),
			spawn('magick'),
			spawn('gm'),
			spawn('find', ['--version']),
		].map((child) => {
			return Promise.race([
				new Promise((resolve) => {
					child.on('close', (code) => resolve(code !== 127));
				}),
				new Promise((resolve) => {
					child.on('error', () => resolve(false));
				}),
			]);
		})
	);

	const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = results;
	const support = (global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find });
	Object.freeze(global.support);

	if (!support.ffmpeg) conn.logger.warn('Please install ffmpeg for sending videos (apt install ffmpeg)');
	if (support.ffmpeg && !support.ffmpegWebp) conn.logger.warn('Stickers may not animated without libwebp on ffmpeg (--enable-ibwebp while compiling ffmpeg)');
	if (!support.convert && !support.magick && !support.gm) conn.logger.warn('Stickers may not work without imagemagick if libwebp on ffmpeg doesnt isntalled (apt install imagemagick)');
}

_quickTest()
	.then(() => conn.logger.info('☑️ Quick Test Done'))
	.catch(console.error);

function closeDB() {
	try {
		global.db.sqlite.close();
		console.log('Database closed');
	} catch (e) {
		console.error(e);
	}
}

process.on('uncaughtException', console.error);
process.on('exit', closeDB);
process.on('SIGINT', closeDB);

// Hi
