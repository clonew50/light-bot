/**
 * webPanel.js — web control panel & public sub-bot pairing portal
 * ================================================================
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUpdate, applyUpdate } from './autoUpdate.mjs';
import {
	renderPublicPortalHtml,
	renderAdminPanelHtml,
	renderAdminLoginHtml,
	renderMaintenanceHtml,
	INSTALL_RENDER_JS,
} from './panelViews.js';
import {
	ensureSubBotStore,
	saveSubBotStateToDisk,
	loadSubBotStateFromDisk,
	requestSubBotPairing,
	getLiveSubBotInfo,
	stopSubBot,
	resetSubBotSession,
	listAllSubBots,
} from './subBots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PANEL_ASSETS = {
	'/panel-assets/hero-banner.jpg': path.join(ROOT, 'src', 'assets', 'images', 'hero_banner_1795868491633.jpg'),
	'/panel-assets/bot-avatar.jpg': path.join(ROOT, 'src', 'assets', 'images', 'bot_avatar_1795868492331.jpg'),
	'/panel-assets/support-card.jpg': path.join(ROOT, 'src', 'assets', 'images', 'support_card_1795868492613.jpg'),
	'/panel-assets/subbot-node.jpg': path.join(ROOT, 'src', 'assets', 'images', 'subbot_node_1795868492869.jpg'),
};

function configFilePath() {
	return process.env.PANEL_CONFIG_FILE
		? path.resolve(process.env.PANEL_CONFIG_FILE)
		: path.join(__dirname, 'panel-config.json');
}

function bugReportsFilePath() {
	return process.env.BUG_REPORTS_FILE
		? path.resolve(process.env.BUG_REPORTS_FILE)
		: path.join(ROOT, 'data', 'bug-reports.json');
}

function readBugReports() {
	try {
		const p = bugReportsFilePath();
		if (!fs.existsSync(p)) return [];
		const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveBugReports(list) {
	const p = bugReportsFilePath();
	const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
	try {
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(tmp, JSON.stringify((Array.isArray(list) ? list : []).slice(0, 100), null, 2));
		fs.renameSync(tmp, p);
	} catch {
		try {
			fs.rmSync(tmp, { force: true });
		} catch {}
	}
}

function resolveOwnerJids() {
	const owners = Array.isArray(global.owner) ? global.owner : [];
	const out = [];
	const seen = new Set();
	for (const entry of owners) {
		const raw = Array.isArray(entry) ? entry[0] : entry;
		const digits = String(raw || '').replace(/[^0-9]/g, '');
		if (/^\d{8,14}$/.test(digits)) {
			const jid = `${digits}@s.whatsapp.net`;
			if (!seen.has(jid)) {
				seen.add(jid);
				out.push(jid);
			}
		}
	}
	if (!out.length) out.push('201212446299@s.whatsapp.net');
	return out;
}

/* ============================== Config ============================== */
let panelCfg;
let panelPasswordOverride = null;
const DEFAULT_PASSWORD = 'winner';
const DEFAULT_CONFIG = {
	password: '',
	loginMode: 'code',
	phone: '',
	secret: '',
	rev: 0,
	pwHash: '',
};

function generatePassword(len = 16) {
	const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const bytes = crypto.randomBytes(len);
	let out = '';
	for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
	return out;
}

export function readPanelConfig() {
	const cfgPath = configFilePath();
	let cfg = { ...DEFAULT_CONFIG };
	let diskPwHash = null;
	try {
		if (fs.existsSync(cfgPath)) {
			const disk = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
			cfg = { ...cfg, ...disk };
			if (disk && typeof disk.pwHash === 'string') diskPwHash = disk.pwHash;
			try {
				if ((fs.statSync(cfgPath).mode & 0o777) !== 0o600) fs.chmodSync(cfgPath, 0o600);
			} catch {}
		}
	} catch (e) {
		console.error('⚠️ [WEB] Could not read panel-config.json:', e.message);
		try {
			const bad = `${cfgPath}.corrupt-${Date.now()}.json`;
			fs.renameSync(cfgPath, bad);
			console.warn(`🗃️ [WEB] Corrupt file moved to ${path.basename(bad)}`);
		} catch {}
	}

	if (process.env.WEB_PASSWORD) {
		cfg.password = process.env.WEB_PASSWORD;
	} else if (!cfg.password || cfg.password === DEFAULT_PASSWORD) {
		cfg.password = generatePassword(16);
		Object.defineProperty(cfg, '__generated', { value: true, configurable: true });
	} else if (cfg.__generated) {
		delete cfg.__generated;
	}

	if (!Number.isInteger(cfg.rev) || cfg.rev < 0) cfg.rev = 0;

	const pwHash = crypto.createHash('sha256').update(String(cfg.password)).digest('hex');
	let needSave = false;
	if (pwHash !== diskPwHash) {
		if (diskPwHash !== null) cfg.rev = (Number(cfg.rev) || 0) + 1;
		needSave = true;
	}
	cfg.pwHash = pwHash;
	if (!cfg.secret) {
		cfg.secret = crypto.randomBytes(32).toString('hex');
		needSave = true;
	}
	if (needSave) savePanelConfig(cfg);
	return cfg;
}

export function savePanelConfig(cfg) {
	const cfgPath = configFilePath();
	const tmp = `${cfgPath}.tmp-${process.pid}-${Date.now()}`;
	try {
		fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
		fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
		fs.chmodSync(tmp, 0o600);
		fs.renameSync(tmp, cfgPath);
	} catch (e) {
		try {
			fs.rmSync(tmp, { force: true });
		} catch {}
		console.error('⚠️ [WEB] Could not save panel-config.json:', e.message);
	}
}

/* ============================== Events ============================== */
const events = [];
export function pushPanelEvent(message, kind = 'panel') {
	const e = { ts: Date.now(), kind: String(kind), text: String(message) };
	events.push(e);
	if (events.length > 100) events.shift();
	try {
		console.log('🌐 [WEB]', message);
	} catch {}
}
function pushEvent(msg, kind) {
	pushPanelEvent(msg, kind);
}
function getEvents() {
	return events.slice(-100);
}

/* ============================== Helpers ============================== */
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

function sign(value) {
	return crypto.createHmac('sha256', panelCfg.secret).update(value).digest('hex');
}
function makeCookie(days = 30) {
	const exp = Date.now() + days * 86400000;
	const payload = `${exp}.${Number(panelCfg.rev) || 0}`;
	return `${payload}.${sign(payload)}`;
}
function verifyCookie(cookie) {
	if (!cookie) return false;
	const parts = cookie.split('.');
	if (parts.length !== 3) return false;
	const [expStr, revStr, sig] = parts;
	if (!expStr || !revStr || !sig) return false;
	const expect = sign(`${expStr}.${revStr}`);
	if (sig.length !== expect.length) return false;
	if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
	if (Number(revStr) !== (Number(panelCfg.rev) || 0)) return false;
	return Number(expStr) > Date.now();
}
function parseCookies(req) {
	const out = {};
	(req.headers.cookie || '').split(';').forEach((part) => {
		const i = part.indexOf('=');
		if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
	});
	return out;
}
function clientIp(req) {
	const xff = String(req.headers['x-forwarded-for'] || '');
	const first = xff.split(',')[0].trim();
	return first || req.socket.remoteAddress || 'x';
}
function secureCookieFlag(req) {
	const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
	return proto === 'https' ? '; Secure' : '';
}

/* rate limiting (login) */
const attempts = new Map();
const MAX_ATTEMPTS = 8;
function pruneAttempts() {
	const now = Date.now();
	for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
}
function loginBlocked(ip) {
	const a = attempts.get(ip);
	if (a && a.until > Date.now() && a.count >= MAX_ATTEMPTS) return Math.ceil((a.until - Date.now()) / 1000);
	return 0;
}
function registerFail(ip) {
	if (attempts.size > 500) pruneAttempts();
	const a = attempts.get(ip) || { count: 0, until: 0 };
	a.count = Math.min(MAX_ATTEMPTS, a.count + 1);
	a.until = Date.now() + 5 * 60000;
	attempts.set(ip, a);
}
function resetFail(ip) {
	attempts.delete(ip);
}

/* send rate limiting */
const SEND_WINDOW_MS = 60_000;
const SEND_MAX_PER_WINDOW = 10;
const sendCounts = new Map();
function sendBlocked(ip) {
	const a = sendCounts.get(ip);
	if (!a) return false;
	if (Date.now() - a.t > SEND_WINDOW_MS) {
		sendCounts.delete(ip);
		return false;
	}
	return a.n >= SEND_MAX_PER_WINDOW;
}
function bumpSendCount(ip) {
	const a = sendCounts.get(ip);
	if (!a || Date.now() - a.t > SEND_WINDOW_MS) {
		sendCounts.set(ip, { n: 1, t: Date.now() });
		return;
	}
	a.n += 1;
}

/* sub-bot request rate limiting */
const SUBPAIR_WINDOW_MS = 60_000;
const SUBPAIR_MAX_PER_WINDOW = 8;
const subPairCounts = new Map();
function subPairBlocked(ip) {
	const a = subPairCounts.get(ip);
	if (!a) return false;
	if (Date.now() - a.t > SUBPAIR_WINDOW_MS) {
		subPairCounts.delete(ip);
		return false;
	}
	return a.n >= SUBPAIR_MAX_PER_WINDOW;
}
function bumpSubPairCount(ip) {
	const a = subPairCounts.get(ip);
	if (!a || Date.now() - a.t > SUBPAIR_WINDOW_MS) {
		subPairCounts.set(ip, { n: 1, t: Date.now() });
		return;
	}
	a.n += 1;
}

/* bug report rate limiting */
const BUG_WINDOW_MS = 120_000;
const BUG_MAX_PER_WINDOW = 6;
const bugCounts = new Map();
function bugBlocked(ip) {
	const a = bugCounts.get(ip);
	if (!a) return false;
	if (Date.now() - a.t > BUG_WINDOW_MS) {
		bugCounts.delete(ip);
		return false;
	}
	return a.n >= BUG_MAX_PER_WINDOW;
}
function bumpBugCount(ip) {
	const a = bugCounts.get(ip);
	if (!a || Date.now() - a.t > BUG_WINDOW_MS) {
		bugCounts.set(ip, { n: 1, t: Date.now() });
		return;
	}
	a.n += 1;
}

function readBody(req, limit = 1024 * 1024) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (c) => {
			data += c;
			if (data.length > limit) req.destroy();
		});
		req.on('end', () => {
			let json = null,
				form = null;
			try {
				json = JSON.parse(data);
			} catch {}
			try {
				form = Object.fromEntries(new URLSearchParams(data));
			} catch {}
			resolve({ data, json, form });
		});
		req.on('error', () => resolve({ data: '', json: null, form: null }));
	});
}
function sendJson(res, code, obj, extra = {}) {
	const body = JSON.stringify(obj);
	res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
	res.end(body);
}
function sendHtml(res, code, html, isHead = false) {
	res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
	res.end(isHead ? undefined : html);
}
function currentCommit() {
	try {
		const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.git-pull-state.json'), 'utf8'));
		if (s.commit) return String(s.commit).slice(0, 8);
	} catch {}
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
		if (pkg.version) return `v${pkg.version}`;
	} catch {}
	return 'v1.0.0';
}
function sanitizePhone(raw) {
	let s = String(raw || '').trim();
	if (s.includes('@')) s = s.split('@')[0];
	if (s.includes(':')) s = s.split(':')[0];
	let digits = s.replace(/[^0-9]/g, '');
	if (digits.startsWith('00') && digits.length >= 10) digits = digits.slice(2);
	if (/^200(1[0125]\d{8})$/.test(digits)) digits = '20' + digits.slice(3);
	if (digits.startsWith('0')) return '';
	if (!/^\d{6,15}$/.test(digits)) return '';
	return digits;
}

/* ============================== Sub-bot helpers ============================== */
function generateControlCode() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = crypto.randomBytes(8);
	let raw = '';
	for (let i = 0; i < 8; i++) raw += chars[bytes[i] % chars.length];
	return `LB-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function timingSafeEqualStr(a, b) {
	const sa = String(a || '').trim().toUpperCase().replace(/[\s-]+/g, '');
	const sb = String(b || '').trim().toUpperCase().replace(/[\s-]+/g, '');
	if (!sa || !sb || sa.length !== sb.length) return false;
	return crypto.timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
}

export function verifySubBotAccess(phoneRaw, codeRaw) {
	const phone = sanitizePhone(phoneRaw);
	const code = String(codeRaw || '').trim();
	if (!phone || !code) return { ok: false, error: 'أدخل رقم الهاتف وكود التحكم' };
	const store = ensureSubBotStore();
	const rec = store[phone];
	if (!rec) return { ok: false, error: 'لا يوجد بوت فرعي مسجل بهذا الرقم. ابدأ بعملية الربط أولاً.' };
	const matchesControl = rec.controlCode && timingSafeEqualStr(code, rec.controlCode);
	if (!matchesControl) return { ok: false, error: 'كود التحكم غير صحيح' };
	return { ok: true, phone, record: rec };
}

function serializeSubBot(phone, storeObj) {
	const record = storeObj && storeObj[phone];
	if (!record) return null;
	const live = getLiveSubBotInfo(phone);
	return {
		phone,
		controlCode: record.controlCode,
		pairStatus: live?.pairStatus || record.pairStatus || 'idle',
		connection: live?.connection || 'offline',
		pairingCode: live?.pairingCode || record.lastPairCode || null,
		qr: live?.qr || null,
		pairError: live?.pairError ?? record.pairError ?? null,
		pairedAt: record.pairedAt || 0,
		lastSeenAt: record.lastSeenAt || 0,
		waName: record.waName || '',
		settings: record.settings || {
			mode: 'public',
			customName: '',
			prefix: '.',
			welcome: true,
			autoReply: true,
			paused: false,
			notes: '',
		},
	};
}

/* ============================== Status ============================== */
function isMaintenanceActive() {
	try {
		return global.db?.data?.maintenance === true;
	} catch {
		return false;
	}
}

function buildCommandsCatalog({ q = '', cat = '', page = 1, limit = 0 } = {}) {
	const all = [];
	const catMap = new Map();
	for (const [file, p] of Object.entries(global.plugins || {})) {
		if (!p || p.disabled) continue;
		const triggers = [];
		const cmd = p.command;
		if (Array.isArray(cmd)) triggers.push(...cmd.map(String));
		else if (cmd instanceof RegExp) {
			const src = cmd.source.replace(/^\^/, '').replace(/\$$/, '');
			src.split('|').forEach((t) => {
				const clean = t.replace(/[^a-z0-9_\u0600-\u06FF]/gi, '');
				if (clean) triggers.push(clean.toLowerCase());
			});
		} else if (typeof cmd === 'string') triggers.push(cmd);
		if (!triggers.length) continue;
		const category = (Array.isArray(p.tags) && p.tags[0]) || 'misc';
		const entry = {
			primary: triggers[0],
			triggers,
			category,
			categoryLabel: category.charAt(0).toUpperCase() + category.slice(1),
			description: (Array.isArray(p.help) && p.help[0]) || '',
			file,
		};
		all.push(entry);
		let prev = catMap.get(category);
		if (!prev) {
			prev = { id: category, label: entry.categoryLabel, count: 0 };
			catMap.set(category, prev);
		}
		prev.count += 1;
	}
	const qNorm = String(q || '').trim().toLowerCase();
	const catNorm = String(cat || '').trim();
	const filtered =
		!qNorm && !catNorm
			? all
			: all.filter((c) => {
					if (catNorm && c.category !== catNorm) return false;
					if (!qNorm) return true;
					return (
						c.primary.toLowerCase().includes(qNorm) ||
						(c.description || '').toLowerCase().includes(qNorm) ||
						c.categoryLabel.toLowerCase().includes(qNorm) ||
						c.triggers.some((t) => t.toLowerCase().includes(qNorm))
					);
				});
	const safePageNum = Math.max(1, Number(page) || 1);
	const safeLimit = limit > 0 ? Math.min(500, Math.max(1, Number(limit) || 24)) : 0;
	const totalPages = safeLimit > 0 ? Math.max(1, Math.ceil(filtered.length / safeLimit)) : 1;
	const safePage = Math.min(safePageNum, totalPages);
	const commandsSlice =
		safeLimit > 0
			? filtered.slice((safePage - 1) * safeLimit, safePage * safeLimit)
			: filtered.length > 500
				? filtered.slice(0, 500)
				: filtered;
	return {
		ok: true,
		total: all.length,
		filtered: filtered.length,
		page: safePage,
		limit: safeLimit || commandsSlice.length,
		totalPages,
		truncated: safeLimit === 0 && filtered.length > 500,
		categories: [...catMap.values()].sort((a, b) => b.count - a.count),
		commands: commandsSlice,
	};
}

function resolveMainBotJid(client) {
	const conn = client || global.conn;
	const raw =
		conn?.user?.jid ||
		(conn?.user?.id && typeof conn.decodeJid === 'function' ? conn.decodeJid(conn.user.id) : conn?.user?.id) ||
		'';
	if (raw) return raw;
	const keys = Object.keys(global.db?.data?.settings || {});
	return keys[0] || 'main';
}

function getBotSettingsSnapshot(client) {
	const jid = resolveMainBotJid(client);
	const s = global.db?.data?.settings?.[jid] || {};
	return {
		botJid: jid,
		public: s.public ?? global.opts?.public ?? !global.opts?.self,
		gconly: Boolean(s.gconly ?? global.opts?.gconly ?? false),
		autoread: Boolean(s.autoread ?? global.opts?.autoread ?? false),
		anticall: Boolean(s.anticall ?? global.opts?.anticall ?? false),
	};
}

function getStatsSnapshot() {
	const data = global.db?.data || {};
	const users = Object.keys(data.users || {}).length;
	const chatKeys = Object.keys(data.chats || {});
	const groups = chatKeys.filter((k) => k.endsWith('@g.us')).length;
	const stats = data.stats || {};
	let totalHits = 0;
	const topCommands = Object.entries(stats)
		.map(([name, val]) => {
			const hits = Number(val?.total || 0);
			totalHits += hits;
			return { name: name.replace(/\.js$/, ''), hits, success: Number(val?.success || 0) };
		})
		.filter((x) => x.hits > 0)
		.sort((a, b) => b.hits - a.hits)
		.slice(0, 6);
	return {
		usersCount: users,
		chatsCount: chatKeys.length,
		groupsCount: groups,
		totalCommandsRun: totalHits,
		topCommands,
	};
}

function getClientInfo(client) {
	const st = global.__panelState || (global.__panelState = {});
	const conn = client || global.conn;
	const connected = !!(conn && conn.user && st.connection === 'open');
	const mem = process.memoryUsage();
	const catalog = buildCommandsCatalog({ limit: 1 });
	const cmdCount = catalog.total;
	const subBots = listAllSubBots();
	const statsSnap = getStatsSnapshot();
	return {
		ok: true,
		connected,
		connection: st.connection || 'starting',
		sessionRegistered: !!(conn && conn.authState && conn.authState.creds && conn.authState.creds.registered),
		loginMode: panelCfg.loginMode === 'qr' ? 'qr' : 'code',
		configuredPhone: panelCfg.phone || String(global.pairingNumber || '') || conn?.config?.phoneNumber || '',
		phone: (conn && (conn.user?.jid || conn.user?.id)) || '',
		name: (conn && conn.user && (conn.user.name || conn.user.verifiedName)) || global.namebot || 'Yono',
		commands: cmdCount,
		categoriesCount: catalog.categories.length,
		topCategories: catalog.categories.slice(0, 8),
		memoryMB: Math.round(mem.rss / 1024 / 1024),
		uptimeSec: Math.round(process.uptime()),
		commit: currentCommit(),
		pairingCode: st.pairingCode || null,
		pairingError: st.pairingError || null,
		qr: st.lastQR || null,
		maintenance: isMaintenanceActive(),
		autoUpdateIntervalMin: Number(process.env.AUTO_UPDATE_INTERVAL_MIN) || 60,
		botSettings: getBotSettingsSnapshot(client),
		stats: statsSnap,
		subBots,
		bugReports: readBugReports().slice(0, 50),
		events: getEvents(),
	};
}

function getPublicStatusInfo(client) {
	const info = getClientInfo(client);
	return {
		ok: true,
		connected: info.connected,
		connection: info.connection,
		sessionRegistered: info.sessionRegistered,
		loginMode: info.loginMode,
		botName: info.name,
		commands: info.commands,
		categoriesCount: info.categoriesCount,
		topCategories: info.topCategories,
		usersCount: info.stats.usersCount,
		groupsCount: info.stats.groupsCount,
		botMode: info.botSettings.public ? 'public' : 'self',
		gconly: info.botSettings.gconly,
		memoryMB: info.memoryMB,
		uptimeSec: info.uptimeSec,
		commit: info.commit,
		maintenance: info.maintenance,
		subBotsCount: info.subBots.length,
		activeSubBotsCount: info.subBots.filter((s) => s.pairStatus === 'connected').length,
		events: info.events.slice(-25),
	};
}

/* ============================== Request handler ============================== */
export async function handleWebRequest(req, res, client, options = {}) {
	panelCfg = readPanelConfig();
	if (panelPasswordOverride !== null) panelCfg.password = panelPasswordOverride;
	loadSubBotStateFromDisk();

	const ip = clientIp(req);
	const url = new URL(req.url, 'http://localhost');
	const cookies = parseCookies(req);
	const authed = verifyCookie(cookies.pw);
	const maintenance = isMaintenanceActive();

	const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';
	const isHead = req.method === 'HEAD';

	if (isGetOrHead && PANEL_ASSETS[url.pathname]) {
		const assetPath = PANEL_ASSETS[url.pathname];
		if (!fs.existsSync(assetPath)) {
			res.writeHead(404);
			return res.end();
		}
		const buf = fs.readFileSync(assetPath);
		res.writeHead(200, {
			'Content-Type': 'image/jpeg',
			'Content-Length': String(buf.length),
			'Cache-Control': 'public, max-age=86400',
		});
		return res.end(isHead ? undefined : buf);
	}

	if (req.method === 'GET' && url.pathname === '/api/maintenance-status') {
		return sendJson(res, 200, { maintenance });
	}

	if (maintenance && !authed) {
		if (req.method === 'POST' && url.pathname === '/login') {
			// allow admin login POST during maintenance
		} else if (isGetOrHead && url.pathname === '/admin') {
			return sendHtml(res, 200, renderAdminLoginHtml(''), isHead);
		} else if (url.pathname.startsWith('/api/')) {
			return sendJson(res, 503, { ok: false, maintenance: true, error: 'الموقع في وضع الصيانة، حاول مرة أخرى لاحقاً' });
		} else {
			return sendHtml(res, 503, renderMaintenanceHtml(''), isHead);
		}
	}

	if (isGetOrHead && (url.pathname === '/' || url.pathname === '/index.html')) {
		return sendHtml(res, 200, renderPublicPortalHtml('', INSTALL_RENDER_JS), isHead);
	}

	if (isGetOrHead && url.pathname === '/admin') {
		if (authed) return sendHtml(res, 200, renderAdminPanelHtml(INSTALL_RENDER_JS), isHead);
		return sendHtml(res, 200, renderAdminLoginHtml(''), isHead);
	}

	if (req.method === 'POST' && url.pathname === '/login') {
		const blocked = loginBlocked(ip);
		if (blocked) {
			const msg = 'محاولات كثيرة جداً، انتظر ' + blocked + ' ثانية';
			return sendHtml(res, 429, maintenance ? renderMaintenanceHtml(msg) : renderAdminLoginHtml(msg));
		}
		const { json, form } = await readBody(req);
		const pass = (json?.password ?? form?.password ?? '').toString();
		const ok =
			pass.length === panelCfg.password.length &&
			crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(panelCfg.password));
		if (!ok) {
			registerFail(ip);
			return sendHtml(res, 401, maintenance ? renderMaintenanceHtml('كلمة المرور غير صحيحة') : renderAdminLoginHtml('كلمة المرور غير صحيحة'));
		}
		resetFail(ip);
		const secure = secureCookieFlag(req);
		res.writeHead(302, {
			'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
			Location: '/admin',
		});
		return res.end();
	}

	if (req.method === 'GET' && url.pathname === '/api/public/status') {
		return sendJson(res, 200, getPublicStatusInfo(client));
	}

	if (req.method === 'GET' && url.pathname === '/api/public/commands') {
		const q = url.searchParams.get('q') || '';
		const cat = url.searchParams.get('cat') || '';
		const hasLimit = url.searchParams.has('limit') || url.searchParams.has('page');
		const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
		const limit = hasLimit ? parseInt(url.searchParams.get('limit') || '36', 10) || 36 : 0;
		return sendJson(res, 200, buildCommandsCatalog({ q, cat, page, limit }));
	}

	if (req.method === 'POST' && url.pathname === '/api/public/report-error') {
		if (bugBlocked(ip)) {
			return sendJson(res, 429, { ok: false, error: 'تم استلام عدة بلاغات متتالية — انتظر دقيقتين قبل إرسال بلاغ جديد.' });
		}
		const { json } = await readBody(req);
		const title = String(json?.title || '').trim().slice(0, 120);
		const category = String(json?.category || 'bug').trim().slice(0, 32) || 'bug';
		const details = String(json?.details || json?.message || '').trim().slice(0, 2000);
		const contact = String(json?.contact || '').trim().slice(0, 100);
		const commandRef = String(json?.command || '').trim().slice(0, 80);

		if (details.length < 4) {
			return sendJson(res, 400, { ok: false, error: 'يرجى كتابة وصف واضح للخطأ (4 أحرف على الأقل).' });
		}
		bumpBugCount(ip);

		const report = {
			id: `BUG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
			title: title || 'بلاغ خطأ من لوحة الويب',
			category,
			commandRef,
			details,
			contact,
			status: 'open',
			deliveredToOwner: false,
			createdAt: Date.now(),
		};

		const st = global.__panelState || (global.__panelState = {});
		const activeConn = client || global.conn;
		if (activeConn && typeof activeConn.sendMessage === 'function' && (activeConn.user || st.connection === 'open')) {
			const catLabels = { bug: 'عطل / خطأ برمجي', command: 'مشكلة في أمر', subbot: 'مشكلة في البوت الفرعي', suggestion: 'ملاحظة / اقتراح' };
			const ownerMsg = [
				'🐞 *بلاغ خطأ جديد من لوحة الويب*',
				`🆔 *الرقم:* \`${report.id}\``,
				`📂 *التصنيف:* ${catLabels[category] || category}`,
				`📌 *العنوان:* ${report.title}`,
				commandRef ? `⌨️ *الأمر:* \`${commandRef}\`` : '',
				contact ? `👤 *التواصل:* ${contact}` : '',
				'',
				`📝 *التفاصيل:*`,
				details,
			]
				.filter(Boolean)
				.join('\n');

			for (const jid of resolveOwnerJids()) {
				try {
					await activeConn.sendMessage(jid, { text: ownerMsg });
					report.deliveredToOwner = true;
					break;
				} catch {}
			}
		}

		const list = readBugReports();
		list.unshift(report);
		saveBugReports(list);
		pushEvent(`بلاغ جديد (${report.id}): ${report.title}${report.deliveredToOwner ? ' — تم إرساله للمالك ✓' : ''}`, 'bug');

		return sendJson(res, 200, {
			ok: true,
			id: report.id,
			deliveredToOwner: report.deliveredToOwner,
			message: report.deliveredToOwner
				? `تم تسجيل البلاغ (${report.id}) وإرساله مباشرة للمالك عبر البوت الأساسي ✓`
				: `تم تسجيل البلاغ (${report.id}) وحفظه في صندوق الإدارة لحين اتصال البوت الأساسي.`,
		});
	}

	/* ============ Public sub-bot pairing (no admin login required) ============ */
	if (req.method === 'POST' && url.pathname === '/api/public/sub/pair') {
		if (subPairBlocked(ip)) return sendJson(res, 429, { ok: false, error: 'محاولات كثيرة — انتظر دقيقة' });
		const { json } = await readBody(req);
		const phone = sanitizePhone(json?.phone);
		const mode = json?.mode === 'qr' ? 'qr' : 'code';
		if (!phone || phone.length < 8 || phone.length > 15) {
			return sendJson(res, 400, { ok: false, error: 'رقم غير صالح (أدخل 8-15 رقم مع رمز الدولة وبدون أصفار في البداية)' });
		}
		const mainPhone = sanitizePhone(panelCfg.phone || global.pairingNumber || client?.config?.phoneNumber || '');
		if (mainPhone && phone === mainPhone) {
			return sendJson(res, 400, { ok: false, error: 'هذا رقم البوت الأساسي، تواصل مع المسؤول أو استخدم صفحة /admin.' });
		}
		bumpSubPairCount(ip);

		const store = ensureSubBotStore();
		let rec = store[phone];
		if (!rec) {
			rec = {
				phone,
				controlCode: generateControlCode(),
				pairStatus: 'pairing',
				pairError: null,
				lastPairCode: '',
				createdAt: Date.now(),
				pairedAt: 0,
				lastSeenAt: 0,
				waName: '',
				settings: {
					mode: 'public',
					customName: '',
					prefix: '.',
					welcome: true,
					autoReply: true,
					paused: false,
					notes: '',
				},
			};
			store[phone] = rec;
		} else {
			rec.pairStatus = 'pairing';
			rec.pairError = null;
		}
		saveSubBotStateToDisk();

		const pairFn = options.requestSubBotPairing || requestSubBotPairing;
		let pairResult = { pairingCode: null, qr: null, connected: false };
		try {
			pairResult = await pairFn(phone, { mode });
		} catch (e) {
			rec.pairError = e?.message || String(e);
			rec.pairStatus = 'error';
			saveSubBotStateToDisk();
		}

		pushPanelEvent(`طلب ربط بوت فرعي: ${phone}`, 'subbot');
		const secure = secureCookieFlag(req);
		const tok = makeSubCookie(phone);
		res.writeHead(200, {
			'Set-Cookie': `sub_tok=${tok}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		});
		const botData = serializeSubBot(phone, store);
		const mergedPairingCode = pairResult?.pairingCode || botData?.pairingCode || null;
		const mergedQr = pairResult?.qr || botData?.qr || null;
		if (botData) {
			botData.pairingCode = mergedPairingCode;
			botData.qr = mergedQr;
		}
		return res.end(
			JSON.stringify({
				ok: true,
				phone,
				controlCode: rec.controlCode,
				pairingCode: mergedPairingCode,
				qr: mergedQr,
				pairError: botData?.pairError || null,
				message: pairResult?.connected
					? 'هذا الرقم مربوط ومتصل بالفعل'
					: pairResult?.pairingCode
						? 'تم إصدار كود الربط في واتساب! أدخله في الأجهزة المرتبطة.'
						: 'تم تسجيل البوت الفرعي.',
				bot: botData,
			})
		);
	}

	if (req.method === 'POST' && url.pathname === '/api/public/sub/auth') {
		const blocked = loginBlocked(`subauth:${ip}`);
		if (blocked) return sendJson(res, 429, { ok: false, error: 'محاولات كثيرة — انتظر ' + blocked + ' ثانية' });
		const { json } = await readBody(req);
		const v = verifySubBotAccess(json?.phone, json?.code);
		if (!v.ok) {
			registerFail(`subauth:${ip}`);
			return sendJson(res, 401, { ok: false, error: v.error });
		}
		resetFail(`subauth:${ip}`);
		const secure = secureCookieFlag(req);
		const tok = makeSubCookie(v.phone);
		res.writeHead(200, {
			'Set-Cookie': `sub_tok=${tok}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		});
		return res.end(JSON.stringify({ ok: true, bot: serializeSubBot(v.phone, ensureSubBotStore()) }));
	}

	if (url.pathname.startsWith('/api/public/sub/')) {
		const subPhone = verifySubCookie(cookies.sub_tok);
		if (req.method === 'GET' && url.pathname === '/api/public/sub/me') {
			if (!subPhone) return sendJson(res, 200, { ok: false, authenticated: false, bot: null });
			const bot = serializeSubBot(subPhone, ensureSubBotStore());
			if (!bot) return sendJson(res, 200, { ok: false, authenticated: false, bot: null });
			return sendJson(res, 200, { ok: true, authenticated: true, bot });
		}
		if (!subPhone) return sendJson(res, 401, { ok: false, error: 'أدخل رقمك وكود التحكم أولاً' });

		if (req.method === 'POST' && url.pathname === '/api/public/sub/settings') {
			const { json } = await readBody(req);
			const store = ensureSubBotStore();
			const rec = store[subPhone];
			if (!rec) return sendJson(res, 404, { ok: false, error: 'البوت الفرعي غير موجود' });

			const next = { ...(rec.settings || {}) };
			if (json?.mode === 'public' || json?.mode === 'self') next.mode = json.mode;
			if (typeof json?.customName === 'string') next.customName = json.customName.trim().slice(0, 40);
			if (typeof json?.prefix === 'string' && json.prefix.trim()) next.prefix = json.prefix.trim().slice(0, 4);
			if (typeof json?.welcome === 'boolean') next.welcome = json.welcome;
			if (typeof json?.autoReply === 'boolean') next.autoReply = json.autoReply;
			if (typeof json?.paused === 'boolean') next.paused = json.paused;
			if (typeof json?.notes === 'string') next.notes = json.notes.slice(0, 200);
			rec.settings = next;
			saveSubBotStateToDisk();
			return sendJson(res, 200, { ok: true, message: 'تم حفظ الإعدادات', bot: serializeSubBot(subPhone, store) });
		}

		if (req.method === 'POST' && url.pathname === '/api/public/sub/action') {
			const { json } = await readBody(req);
			const act = String(json?.action || '');
			const store = ensureSubBotStore();
			const rec = store[subPhone];

			if (act === 'logout') {
				res.writeHead(200, {
					'Set-Cookie': 'sub_tok=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
					'Content-Type': 'application/json; charset=utf-8',
					'Cache-Control': 'no-store',
				});
				return res.end(JSON.stringify({ ok: true, message: 'تم تسجيل الخروج من لوحة البوت الفرعي' }));
			}
			if (!rec) return sendJson(res, 404, { ok: false, error: 'البوت الفرعي غير موجود' });

			if (act === 'regenerate-code') {
				rec.controlCode = generateControlCode();
				saveSubBotStateToDisk();
				return sendJson(res, 200, { ok: true, controlCode: rec.controlCode, message: 'تم توليد كود تحكم جديد', bot: serializeSubBot(subPhone, store) });
			}
			if (act === 'repair') {
				const pairFn = options.requestSubBotPairing || requestSubBotPairing;
				const mode = json?.mode === 'qr' ? 'qr' : 'code';
				try {
					const r = await pairFn(subPhone, { mode });
					return sendJson(res, 200, {
						ok: true,
						pairingCode: r?.pairingCode || null,
						qr: r?.qr || null,
						message: r?.pairingCode ? 'تم إصدار كود ربط جديد' : 'تم تحديث حالة الربط',
						bot: serializeSubBot(subPhone, store),
					});
				} catch (e) {
					return sendJson(res, 400, { ok: false, error: e?.message || String(e) });
				}
			}
			if (act === 'disconnect') {
				await stopSubBot(subPhone, { reason: 'paused' });
				return sendJson(res, 200, { ok: true, message: 'تم إيقاف البوت الفرعي مؤقتاً', bot: serializeSubBot(subPhone, store) });
			}
			if (act === 'reset-session') {
				await resetSubBotSession(subPhone);
				return sendJson(res, 200, { ok: true, message: 'تم إعادة ضبط جلسة البوت الفرعي', bot: serializeSubBot(subPhone, store) });
			}
			return sendJson(res, 400, { ok: false, error: 'إجراء غير مسموح' });
		}
		return sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
	}

	// Everything below requires admin authentication
	if (!authed) {
		if (url.pathname.startsWith('/api/')) return sendJson(res, 401, { ok: false, message: 'Unauthorized' });
		res.writeHead(302, { Location: '/admin' });
		return res.end();
	}

	if (req.method === 'GET' && url.pathname === '/api/status') {
		return sendJson(res, 200, getClientInfo(client));
	}

	if (req.method === 'GET' && url.pathname === '/api/subbots') {
		return sendJson(res, 200, { ok: true, subBots: listAllSubBots() });
	}

	if (req.method === 'GET' && url.pathname === '/api/commands') {
		const q = url.searchParams.get('q') || '';
		const cat = url.searchParams.get('cat') || '';
		const hasLimit = url.searchParams.has('limit') || url.searchParams.has('page');
		const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
		const limit = hasLimit ? parseInt(url.searchParams.get('limit') || '24', 10) || 24 : 0;
		return sendJson(res, 200, buildCommandsCatalog({ q, cat, page, limit }));
	}

	if (req.method === 'POST' && url.pathname === '/api/maintenance') {
		const { json } = await readBody(req);
		const enabled = !!json?.enabled;
		try {
			global.db = global.db || {};
			global.db.data = global.db.data || {};
			global.db.data.maintenance = enabled;
			pushEvent(enabled ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة');
			return sendJson(res, 200, { ok: true, maintenance: enabled, message: enabled ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة' });
		} catch (e) {
			return sendJson(res, 500, { ok: false, message: e.message });
		}
	}

	if (req.method === 'POST' && url.pathname === '/api/rotate-password') {
		const nextPass = generatePassword(16);
		panelPasswordOverride = null;
		panelCfg.password = nextPass;
		panelCfg.pwHash = crypto.createHash('sha256').update(nextPass).digest('hex');
		panelCfg.rev = (Number(panelCfg.rev) || 0) + 1;
		savePanelConfig(panelCfg);
		pushEvent('تم توليد كلمة مرور عشوائية جديدة للوحة');
		const secure = secureCookieFlag(req);
		res.writeHead(200, {
			'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		});
		return res.end(JSON.stringify({ ok: true, password: nextPass, message: 'تم توليد كلمة مرور جديدة' }));
	}

	if (req.method === 'GET' && url.pathname === '/api/update-check') {
		try {
			return sendJson(res, 200, await checkUpdate());
		} catch (e) {
			return sendJson(res, 200, { ok: false, error: e.message });
		}
	}

	if (req.method === 'POST' && url.pathname === '/api/update') {
		pushEvent('تم طلب التحديث من اللوحة');
		sendJson(res, 200, { ok: true });
		setTimeout(async () => {
			try {
				await applyUpdate({ log: (t) => pushEvent(t), event: (m) => pushEvent(m), delayMs: 1500 });
			} catch (e) {
				pushEvent('فشل التحديث: ' + (e && e.message));
			}
		}, 500);
		return;
	}

	if (req.method === 'POST' && url.pathname === '/api/action') {
		const { json } = await readBody(req);
		const action = json?.action;
		const st = global.__panelState || (global.__panelState = {});
		const activeConn = client || global.conn;
		try {
			switch (action) {
				case 'logout':
					panelCfg.rev = (Number(panelCfg.rev) || 0) + 1;
					savePanelConfig(panelCfg);
					pushEvent('تم تسجيل الخروج من جميع الجلسات');
					res.writeHead(200, { 'Set-Cookie': 'pw=; HttpOnly; Path=/; Max-Age=0', 'Content-Type': 'application/json' });
					return res.end(JSON.stringify({ ok: true, message: 'تم تسجيل الخروج' }));

				case 'restart':
					pushEvent('تم طلب إعادة التشغيل من اللوحة');
					st.stopped = false;
					sendJson(res, 200, { ok: true, message: 'جاري إعادة التشغيل...' });
					setTimeout(() => {
						if (typeof global.restartBot === 'function') global.restartBot('panel');
						else pushEvent('مسار إعادة التشغيل غير متاح');
					}, 600);
					return;

				case 'stop':
					pushEvent('تم إيقاف البوت من اللوحة');
					st.stopped = true;
					try {
						activeConn?.ws?.close();
					} catch {}
					return sendJson(res, 200, { ok: true, message: 'تم إيقاف البوت' });

				case 'start':
					pushEvent('تم طلب تشغيل البوت من اللوحة');
					st.stopped = false;
					sendJson(res, 200, { ok: true, message: 'جاري التشغيل...' });
					setTimeout(() => {
						if (typeof global.restartBot === 'function') global.restartBot('panel-start');
					}, 600);
					return;

				case 'reset-session': {
					pushEvent('تم طلب إعادة ضبط الجلسة');
					const sp = path.join(ROOT, 'sessions');
					if (!fs.existsSync(sp)) {
						pushEvent('لا توجد جلسة لحذفها');
						return sendJson(res, 200, { ok: false, message: 'لا توجد جلسة حالية' });
					}
					sendJson(res, 200, { ok: true, message: 'تم نقل الجلسة وإعادة التشغيل...', pendingRestart: true });
					setTimeout(() => {
						void (async () => {
							try {
								activeConn?.ws?.close();
							} catch {}
							let bak = `${sp}.bak-${Date.now()}`;
							let n = 0;
							while (fs.existsSync(bak)) {
								n += 1;
								bak = `${sp}.bak-${Date.now()}-${n}`;
							}
							try {
								fs.renameSync(sp, bak);
								pushEvent('تم نقل الجلسة القديمة إلى ' + path.basename(bak));
							} catch (e) {
								pushEvent('تعذر نقل الجلسة: ' + (e?.message || e));
								return;
							}
							st.stopped = false;
							if (typeof global.restartBot === 'function') global.restartBot('panel-reset');
						})().catch((e) => pushEvent('خطأ إعادة الضبط: ' + (e?.message || e)));
					}, 500);
					return;
				}

				case 'send': {
					if (!(activeConn && activeConn.user && st.connection === 'open')) {
						return sendJson(res, 400, { ok: false, message: 'البوت غير متصل حالياً' });
					}
					const to = sanitizePhone(json?.to);
					const text = String(json?.text || '');
					if (!to || !/^\d{7,15}$/.test(to)) return sendJson(res, 400, { ok: false, message: 'رقم واتساب غير صالح' });
					if (!text || !text.trim()) return sendJson(res, 400, { ok: false, message: 'أدخل نص الرسالة' });
					if (text.length > 4096) return sendJson(res, 400, { ok: false, message: 'النص أطول من المسموح (4096)' });
					if (sendBlocked(ip)) return sendJson(res, 429, { ok: false, message: 'محاولات إرسال كثيرة — انتظر دقيقة' });
					bumpSendCount(ip);
					await activeConn.sendMessage(`${to}@s.whatsapp.net`, { text });
					return sendJson(res, 200, { ok: true, message: 'تم إرسال الرسالة بنجاح' });
				}

				case 'pair-main': {
					const phone = sanitizePhone(json?.phone || panelCfg.phone || global.pairingNumber);
					const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
					if (loginMode === 'qr') {
						return sendJson(res, 200, { ok: true, message: 'وضع QR: احفظ وأعد التشغيل لعرض رمز QR' });
					}
					if (!phone) {
						return sendJson(res, 400, { ok: false, error: 'رقم الهاتف غير صالح — أدخله بالرمز الدولي بدون 0' });
					}
					try {
						if (activeConn?.authState?.creds?.registered) {
							return sendJson(res, 400, { ok: false, error: 'البوت مسجل بالفعل. أعد ضبط الجلسة أولاً.' });
						}
						let code;
						if (typeof global.issueMainPairingCode === 'function' && activeConn === global.conn) {
							code = await global.issueMainPairingCode(phone);
						} else {
							activeConn.cancelPairingCode?.();
							code = await activeConn.requestPairingCode(phone);
							code = code?.match(/.{1,4}/g)?.join('-') || code;
							st.pairingCode = code;
							st.lastQR = null;
							pushEvent('تم إصدار كود الربط: ' + code);
						}
						return sendJson(res, 200, { ok: true, pairingCode: code });
					} catch (e) {
						return sendJson(res, 400, { ok: false, error: e?.message || String(e) });
					}
				}

				case 'set-login': {
					const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
					const phone = sanitizePhone(json?.phone || '');
					panelCfg.loginMode = loginMode;
					if (phone) panelCfg.phone = phone;
					else if (!json?.phone) panelCfg.phone = '';
					savePanelConfig(panelCfg);
					pushEvent('تم تغيير طريقة الربط إلى: ' + loginMode + (phone ? ' — ' + phone : ''));
					sendJson(res, 200, { ok: true, message: 'تم الحفظ. جاري إعادة التشغيل...', pendingRestart: true });
					setTimeout(() => {
						if (typeof global.restartBot === 'function') global.restartBot('panel-set-login');
					}, 500);
					return;
				}

				case 'sub-stop': {
					const phone = sanitizePhone(json?.phone);
					if (!phone) return sendJson(res, 400, { ok: false, message: 'رقم غير صالح' });
					await stopSubBot(phone, { reason: 'paused' });
					return sendJson(res, 200, { ok: true, message: `تم إيقاف البوت الفرعي ${phone}` });
				}

				case 'sub-toggle-pause': {
					const phone = sanitizePhone(json?.phone);
					if (!phone) return sendJson(res, 400, { ok: false, message: 'رقم غير صالح' });
					const store = ensureSubBotStore();
					const rec = store[phone];
					if (!rec) return sendJson(res, 404, { ok: false, message: 'البوت الفرعي غير موجود' });
					rec.settings = rec.settings || {};
					rec.settings.paused = typeof json?.paused === 'boolean' ? json.paused : !rec.settings.paused;
					saveSubBotStateToDisk();
					pushEvent(`${rec.settings.paused ? 'إيقاف مؤقت' : 'تفعيل'} للبوت الفرعي: ${phone}`);
					return sendJson(res, 200, {
						ok: true,
						paused: rec.settings.paused,
						message: rec.settings.paused ? `تم إيقاف الردود للبوت ${phone}` : `تم استئناف الردود للبوت ${phone}`,
					});
				}

				case 'sub-reset': {
					const phone = sanitizePhone(json?.phone);
					if (!phone) return sendJson(res, 400, { ok: false, message: 'رقم غير صالح' });
					await resetSubBotSession(phone);
					return sendJson(res, 200, { ok: true, message: `تم إعادة ضبط جلسة ${phone}` });
				}

				case 'save-bot-settings': {
					const botJid = resolveMainBotJid(activeConn);
					global.db = global.db || {};
					global.db.data = global.db.data || {};
					global.db.data.settings = global.db.data.settings || {};
					const cur = global.db.data.settings[botJid] || {};
					const next = {
						...cur,
						public: typeof json?.public === 'boolean' ? json.public : cur.public ?? true,
						gconly: typeof json?.gconly === 'boolean' ? json.gconly : cur.gconly ?? false,
						autoread: typeof json?.autoread === 'boolean' ? json.autoread : cur.autoread ?? false,
						anticall: typeof json?.anticall === 'boolean' ? json.anticall : cur.anticall ?? false,
					};
					global.db.data.settings[botJid] = next;
					if (global.opts) {
						global.opts.public = next.public;
						global.opts.self = !next.public;
						global.opts.gconly = next.gconly;
						global.opts.autoread = next.autoread;
						global.opts.anticall = next.anticall;
					}
					try {
						if (global.db.sqlite) {
							global.db.sqlite.prepare('UPDATE database SET data = ? WHERE id = 1').run(JSON.stringify(global.db.data));
						}
					} catch {}
					pushEvent(`تحديث إعدادات البوت الأساسي (${next.public ? 'عام' : 'خاص'} · ${next.gconly ? 'مجموعات فقط' : 'خاص ومجموعات'})`);
					return sendJson(res, 200, { ok: true, botSettings: getBotSettingsSnapshot(activeConn), message: 'تم حفظ إعدادات البوت الأساسي وتطبيقها فوراً' });
				}

				case 'bug-resolve': {
					const id = String(json?.id || '').trim();
					if (!id) return sendJson(res, 400, { ok: false, message: 'معرّف البلاغ مطلوب' });
					const list = readBugReports();
					const item = list.find((x) => x.id === id);
					if (!item) return sendJson(res, 404, { ok: false, message: 'البلاغ غير موجود' });
					item.status = item.status === 'resolved' ? 'open' : 'resolved';
					item.resolvedAt = item.status === 'resolved' ? Date.now() : 0;
					saveBugReports(list);
					return sendJson(res, 200, { ok: true, bugReports: list, message: item.status === 'resolved' ? 'تم تحديد البلاغ كمحلول' : 'تمت إعادة فتح البلاغ' });
				}

				case 'bug-delete': {
					const id = String(json?.id || '').trim();
					const nextList = readBugReports().filter((x) => x.id !== id);
					saveBugReports(nextList);
					return sendJson(res, 200, { ok: true, bugReports: nextList, message: 'تم حذف البلاغ' });
				}

				case 'bug-clear': {
					const nextList = readBugReports().filter((x) => x.status !== 'resolved');
					saveBugReports(nextList);
					return sendJson(res, 200, { ok: true, bugReports: nextList, message: 'تم مسح البلاغات المحلولة' });
				}

				default:
					return sendJson(res, 400, { ok: false, message: 'إجراء غير معروف' });
			}
		} catch (e) {
			pushEvent('خطأ أثناء تنفيذ ' + action + ': ' + e.message);
			return sendJson(res, 500, { ok: false, message: 'Error: ' + e.message });
		}
	}

	return sendHtml(res, 404, '<h3 style="font-family:sans-serif">404</h3>');
}

/* ============================== Startup ============================== */
export function startWebPanel(options = {}) {
	panelCfg = readPanelConfig();
	panelPasswordOverride = options.password ? String(options.password) : null;
	if (panelPasswordOverride !== null) panelCfg.password = panelPasswordOverride;

	if (!console.__webHooked) {
		console.__webHooked = true;
		const orig = console.log.bind(console);
		console.log = (...args) => {
			try {
				const line = String(args.join(' ')).replace(ANSI, '');
				const m = line.match(/Pairing Code\s*[:：]?\s*([A-Za-z0-9-]{6,12})/i);
				if (m && global.__panelState) global.__panelState.pairingCode = m[1];
			} catch {}
			return orig(...args);
		};
	}

	const port =
		options.port !== undefined
			? Number(options.port)
			: Number(process.env.WEB_PORT || process.env.PORT || process.env.SERVER_PORT || process.env.P_SERVER_PORT) || 3732;
	const host = options.host || '0.0.0.0';

	const server = http.createServer((req, res) => {
		handleWebRequest(req, res, options.client || global.conn, options).catch((e) => {
			console.error('⚠️ [WEB] error:', e.message);
			try {
				sendJson(res, 500, { ok: false, message: 'Internal error' });
			} catch {}
		});
	});

	let attempts = 0;
	const maxAttempts = 10;
	function tryListen() {
		server.once('error', (e) => {
			if (e && e.code === 'EADDRINUSE' && attempts < maxAttempts) {
				attempts++;
				setTimeout(tryListen, 500);
				return;
			}
			console.error('[WEB] Failed to start panel:', e && e.message);
			pushEvent('Failed to start panel: ' + (e && e.message));
		});
		server.listen(port, host, () => {
			console.log(`\n🌐 [WEB] Control panel running at: http://${host}:${port}`);
			const cfgPath = configFilePath();
			const cfgRel = path.isAbsolute(cfgPath) ? path.relative(process.cwd(), cfgPath) : cfgPath;
			console.log(`   🔑 Password saved in ${cfgRel || cfgPath} (not printed to logs for security)`);
			console.log(`   Current login mode: ${panelCfg.loginMode}\n`);
			pushEvent('تم تشغيل لوحة التحكم على المنفذ ' + port);
		});
	}
	tryListen();

	return server;
}

export default startWebPanel;

function makeSubCookie(phone, days = 30) {
	const exp = Date.now() + days * 86400000;
	const payload = `${phone}.${exp}.${Number(panelCfg.rev) || 0}`;
	return `${payload}.${sign(payload)}`;
}
function verifySubCookie(cookie) {
	if (!cookie) return '';
	const parts = cookie.split('.');
	if (parts.length !== 4) return '';
	const [phone, expStr, revStr, sig] = parts;
	if (!phone || !expStr || !revStr || !sig) return '';
	if (!/^\d{6,15}$/.test(phone)) return '';
	const expect = sign(`${phone}.${expStr}.${revStr}`);
	if (sig.length !== expect.length) return '';
	if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return '';
	if (Number(revStr) !== (Number(panelCfg.rev) || 0)) return '';
	if (!(Number(expStr) > Date.now())) return '';
	return phone;
}
