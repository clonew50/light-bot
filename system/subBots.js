import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import useSQLite from '../lib/useSQLite.js';
import { makeWASocket } from '../lib/simple.js';
import * as handlerModule from '../handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(__dirname, 'bots-state.json');

const liveSubBots = new Map();
let cachedWaVersion = null;
let eventLogger = () => {};

export function setSubBotEventLogger(fn) {
	if (typeof fn === 'function') eventLogger = fn;
}

export function ensureSubBotStore() {
	global.db = global.db || {};
	global.db.data = global.db.data || {};
	if (!global.db.data.subBots || typeof global.db.data.subBots !== 'object') {
		global.db.data.subBots = {};
	}
	return global.db.data.subBots;
}

export function saveSubBotStateToDisk() {
	try {
		const store = ensureSubBotStore();
		fs.writeFileSync(STATE_FILE, JSON.stringify({ subBots: store, mainBot: {} }, null, 2));
	} catch {}
}

export function loadSubBotStateFromDisk() {
	try {
		if (!fs.existsSync(STATE_FILE)) return;
		const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
		if (parsed && parsed.subBots && typeof parsed.subBots === 'object') {
			const store = ensureSubBotStore();
			for (const [phone, rec] of Object.entries(parsed.subBots)) {
				if (!store[phone] && rec && typeof rec === 'object') {
					store[phone] = rec;
				}
			}
		}
	} catch {}
}

async function getWaVersion() {
	if (cachedWaVersion) return cachedWaVersion;
	try {
		const { fetchLatestWaWebVersion } = global.baileys;
		const { version } = await fetchLatestWaWebVersion();
		cachedWaVersion = version;
		return version;
	} catch {
		return undefined;
	}
}

function getSubSessionDir(phone) {
	return path.join(ROOT, 'sessions', `sub-${phone}`);
}

export function getLiveSubBotInfo(phone) {
	const live = liveSubBots.get(phone);
	const store = ensureSubBotStore();
	const rec = store[phone];
	if (!live && !rec) return null;
	return {
		connection: live?.connection || (rec?.pairStatus === 'connected' ? 'closed' : rec?.pairStatus || 'idle'),
		pairingCode: live?.pairingCode || rec?.lastPairCode || null,
		qr: live?.qr || null,
		pairStatus: live?.pairStatus || rec?.pairStatus || 'idle',
		pairError: live?.pairError ?? rec?.pairError ?? null,
	};
}

export function listAllSubBots() {
	const store = ensureSubBotStore();
	return Object.entries(store).map(([phone, rec]) => {
		const live = liveSubBots.get(phone);
		return {
			phone,
			pairStatus: live?.pairStatus || rec.pairStatus || 'idle',
			connection: live?.connection || 'offline',
			waName: rec.waName || '',
			pairedAt: rec.pairedAt || 0,
			lastSeenAt: rec.lastSeenAt || 0,
			paused: Boolean(rec.settings?.paused),
			mode: rec.settings?.mode || 'public',
		};
	});
}

export async function stopSubBot(phone, { reason = 'stopped' } = {}) {
	const live = liveSubBots.get(phone);
	if (live) {
		live.manualStop = true;
		if (live.reconnectTimer) {
			clearTimeout(live.reconnectTimer);
			live.reconnectTimer = null;
		}
		try {
			live.sock?.ev?.removeAllListeners();
			live.sock?.ws?.close();
		} catch {}
		liveSubBots.delete(phone);
	}
	const store = ensureSubBotStore();
	if (store[phone]) {
		store[phone].pairStatus = reason;
		saveSubBotStateToDisk();
	}
}

export async function resetSubBotSession(phone) {
	await stopSubBot(phone, { reason: 'idle' });
	const dir = getSubSessionDir(phone);
	try {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	} catch {}
	const store = ensureSubBotStore();
	if (store[phone]) {
		store[phone].pairStatus = 'idle';
		store[phone].pairError = null;
		store[phone].lastPairCode = '';
		saveSubBotStateToDisk();
	}
}

async function startSubBotSocket(phone, { waitForHandshake = false } = {}) {
	const store = ensureSubBotStore();
	const rec = store[phone];
	if (!rec) throw new Error('Sub-bot record not found');

	const existing = liveSubBots.get(phone);
	if (existing && existing.sock) {
		existing.manualStop = true;
		if (existing.reconnectTimer) clearTimeout(existing.reconnectTimer);
		try {
			existing.sock.ev.removeAllListeners();
			existing.sock.ws?.close();
		} catch {}
		liveSubBots.delete(phone);
	}

	const sessionRel = path.join('sessions', `sub-${phone}`);
	const { state, saveCreds } = await useSQLite(sessionRel);
	const version = await getWaVersion();
	const { Browsers, makeCacheableSignalKeyStore } = global.baileys;

	const entry = {
		phone,
		sock: null,
		connection: 'connecting',
		pairingCode: null,
		qr: null,
		pairStatus: rec.pairStatus || 'connecting',
		pairError: null,
		manualStop: false,
		reconnectTimer: null,
		saveCreds,
	};
	liveSubBots.set(phone, entry);

	const connectionOptions = {
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'fatal', stream: 'store' })),
		},
		...(version ? { version } : {}),
		logger: pino({ level: 'silent' }),
		browser: Browsers.ubuntu('Chrome'),
		generateHighQualityLinkPreview: true,
		syncFullHistory: false,
		markOnlineOnConnect: true,
		connectTimeoutMs: 60000,
		keepAliveIntervalMs: 30000,
		retryRequestDelayMs: 250,
		maxMsgRetryCount: 5,
		cachedGroupMetadata: (jid) => entry.sock?.chats?.[jid],
	};

	const sock = makeWASocket(connectionOptions);
	sock._subBotPhone = phone;
	sock._subBotSettings = rec.settings || {};
	if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);
	entry.sock = sock;

	sock.handler = handlerModule.handler.bind(sock);
	sock.participantsUpdate = handlerModule.participantsUpdate.bind(sock);
	sock.groupsUpdate = handlerModule.groupsUpdate.bind(sock);
	sock.onDelete = handlerModule.deleteUpdate.bind(sock);
	sock.credsUpdate = saveCreds.bind(sock);

	let handshakeResolve;
	const handshakePromise = new Promise((resolve) => {
		handshakeResolve = resolve;
		const timer = setTimeout(() => resolve({ timedOut: true }), 12000);
		timer.unref?.();
	});

	sock.ev.on('creds.update', sock.credsUpdate);
	sock.ev.on('messages.upsert', sock.handler);
	sock.ev.on('group-participants.update', sock.participantsUpdate);
	sock.ev.on('groups.update', sock.groupsUpdate);
	sock.ev.on('message.delete', sock.onDelete);

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update;
		if (qr) {
			entry.qr = qr;
			handshakeResolve({ qr });
		}
		if (connection) {
			entry.connection = connection;
			if (connection === 'open') {
				if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);
				entry.pairStatus = 'connected';
				entry.pairError = null;
				entry.pairingCode = null;
				entry.qr = null;
				rec.pairStatus = 'connected';
				rec.pairError = null;
				rec.lastPairCode = '';
				rec.pairedAt = rec.pairedAt || Date.now();
				rec.lastSeenAt = Date.now();
				rec.waName = sock.user?.name || sock.user?.verifiedName || rec.waName || '';
				saveSubBotStateToDisk();
				eventLogger(`Sub-bot connected: ${phone}`, 'subbot');
				handshakeResolve({ open: true });
			} else if (connection === 'close') {
				const statusCode = lastDisconnect?.error?.output?.statusCode;
				const errMsg = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || '';
				if (entry.manualStop) return;

				if (statusCode === 401) {
					entry.pairStatus = 'logged_out';
					entry.pairError = 'Session logged out from WhatsApp';
					rec.pairStatus = 'logged_out';
					rec.pairError = entry.pairError;
					saveSubBotStateToDisk();
					try {
						fs.rmSync(getSubSessionDir(phone), { recursive: true, force: true });
					} catch {}
					eventLogger(`Sub-bot logged out: ${phone}`, 'subbot');
					handshakeResolve({ closed: statusCode });
					return;
				}

				if (statusCode === 403) {
					entry.pairStatus = 'error';
					entry.pairError = 'WhatsApp banned or rejected session (403)';
					rec.pairStatus = 'error';
					rec.pairError = entry.pairError;
					saveSubBotStateToDisk();
					handshakeResolve({ closed: statusCode });
					return;
				}

				// Transient disconnect (515 restart required, 428, 408, etc.) -> reconnect if registered or actively pairing
				if (sock.authState?.creds?.registered || entry.pairStatus === 'pairing_code' || entry.pairStatus === 'qr') {
					entry.connection = 'reconnecting';
					if (errMsg && !rec.pairedAt) entry.pairError = errMsg;
					entry.reconnectTimer = setTimeout(() => {
						if (!entry.manualStop) {
							startSubBotSocket(phone).catch((e) => {
								entry.pairError = e?.message || String(e);
							});
						}
					}, 2000);
					entry.reconnectTimer.unref?.();
				}
			}
		}
	});

	if (waitForHandshake) {
		await handshakePromise;
	}
	return entry;
}

export async function requestSubBotPairing(phone, { mode = 'code' } = {}) {
	const store = ensureSubBotStore();
	const rec = store[phone];
	if (!rec) throw new Error('Sub-bot not registered');

	// Reset unregistered stale session before issuing fresh code so WhatsApp accepts the companion hello
	const existingLive = liveSubBots.get(phone);
	const isAlreadyConnected = existingLive?.connection === 'open' || existingLive?.sock?.authState?.creds?.registered;
	if (!isAlreadyConnected) {
		await resetSubBotSession(phone);
	}

	rec.pairStatus = mode === 'qr' ? 'qr' : 'pairing';
	rec.pairError = null;
	saveSubBotStateToDisk();

	const entry = await startSubBotSocket(phone, { waitForHandshake: true });
	if (entry.connection === 'open' || entry.sock?.authState?.creds?.registered) {
		rec.pairStatus = 'connected';
		saveSubBotStateToDisk();
		return { ok: true, connected: true, pairingCode: null, qr: null };
	}

	if (mode === 'qr') {
		entry.pairStatus = 'qr';
		rec.pairStatus = 'qr';
		saveSubBotStateToDisk();
		return { ok: true, pairingCode: null, qr: entry.qr || null };
	}

	try {
		entry.sock.cancelPairingCode?.();
		let code = await entry.sock.requestPairingCode(phone);
		code = code?.match(/.{1,4}/g)?.join('-') || code;
		entry.pairingCode = code;
		entry.pairStatus = 'pairing_code';
		entry.pairError = null;
		rec.lastPairCode = code;
		rec.pairStatus = 'pairing_code';
		rec.pairError = null;
		saveSubBotStateToDisk();
		eventLogger(`Sub-bot pairing code issued for ${phone}: ${code}`, 'subbot');
		return { ok: true, pairingCode: code, qr: entry.qr || null };
	} catch (e) {
		entry.pairStatus = 'error';
		entry.pairError = e?.message || String(e);
		rec.pairStatus = 'error';
		rec.pairError = entry.pairError;
		saveSubBotStateToDisk();
		throw e;
	}
}

export async function restoreSubBots() {
	loadSubBotStateFromDisk();
	const store = ensureSubBotStore();
	let restored = 0;
	for (const [phone, rec] of Object.entries(store)) {
		if (!rec || rec.settings?.paused) continue;
		const authDb = path.join(getSubSessionDir(phone), 'auth.db');
		if (!fs.existsSync(authDb)) continue;
		if (rec.pairStatus !== 'connected' && !rec.pairedAt) continue;
		try {
			await startSubBotSocket(phone);
			restored++;
		} catch (e) {
			console.error(`[SUBBOT] Failed to restore ${phone}:`, e?.message || e);
		}
	}
	if (restored > 0) {
		console.log(`🤖 [SUBBOT] Restored ${restored} sub-bot session(s)`);
	}
	return restored;
}
