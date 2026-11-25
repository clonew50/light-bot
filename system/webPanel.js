/**
 * webPanel.js — web control panel for Elaina-Multidevice
 * =====================================================
 * Rebuilt to match the old panel design & features (secure login, live QR /
 * pairing-code pairing, control, status, errors, send message, event log,
 * maintenance mode, command browser, password rotation, auto-update) — but
 * WITHOUT the command simulator / testing feature.
 *
 * Runs inside the bot worker process so it can read the live connection
 * (global.conn / global.__panelState), send messages and restart the bot.
 *
 * Config is stored in system/panel-config.json (password, login mode, number).
 * Env: WEB_PASSWORD, PANEL_CONFIG_FILE, WEB_PORT/PORT/SERVER_PORT/P_SERVER_PORT.
 *
 * Public portal: normal users can pair as SUB-BOTS (their own WhatsApp
 * account becomes a bot) without admin login. They CANNOT edit the main
 * bot number or control the main bot.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUpdate, applyUpdate } from './autoUpdate.mjs';
import { renderPublicPortalHtml, renderAdminPanelHtml, renderMaintenanceHtml, INSTALL_RENDER_JS } from './panelViews.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function configFilePath() {
  return process.env.PANEL_CONFIG_FILE
    ? path.resolve(process.env.PANEL_CONFIG_FILE)
    : path.join(__dirname, 'panel-config.json');
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
    try { fs.rmSync(tmp, { force: true }); } catch {}
    console.error('⚠️ [WEB] Could not save panel-config.json:', e.message);
  }
}

/* ============================== Events ============================== */
const events = [];
export function pushPanelEvent(message, kind = 'panel') {
  const e = { ts: Date.now(), kind: String(kind), text: String(message) };
  events.push(e);
  if (events.length > 100) events.shift();
  try { console.log('🌐 [WEB]', message); } catch {}
}
function pushEvent(msg, kind) { pushPanelEvent(msg, kind); }
function getEvents() { return events.slice(-100); }

/* ============================== Helpers ============================== */
const ANSI = /\x1b\[[0-9;]*m/g;

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
function resetFail(ip) { attempts.delete(ip); }

/* send rate limiting */
const SEND_WINDOW_MS = 60_000;
const SEND_MAX_PER_WINDOW = 5;
const sendCounts = new Map();
function sendBlocked(ip) {
  const a = sendCounts.get(ip);
  if (!a) return false;
  if (Date.now() - a.t > SEND_WINDOW_MS) { sendCounts.delete(ip); return false; }
  return a.n >= SEND_MAX_PER_WINDOW;
}
function bumpSendCount(ip) {
  const a = sendCounts.get(ip);
  if (!a || Date.now() - a.t > SEND_WINDOW_MS) { sendCounts.set(ip, { n: 1, t: Date.now() }); return; }
  a.n += 1;
}

/* sub-bot request rate limiting */
const SUBPAIR_WINDOW_MS = 60_000;
const SUBPAIR_MAX_PER_WINDOW = 3;
const subPairCounts = new Map();
function subPairBlocked(ip) {
  const a = subPairCounts.get(ip);
  if (!a) return false;
  if (Date.now() - a.t > SUBPAIR_WINDOW_MS) { subPairCounts.delete(ip); return false; }
  return a.n >= SUBPAIR_MAX_PER_WINDOW;
}
function bumpSubPairCount(ip) {
  const a = subPairCounts.get(ip);
  if (!a || Date.now() - a.t > SUBPAIR_WINDOW_MS) { subPairCounts.set(ip, { n: 1, t: Date.now() }); return; }
  a.n += 1;
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) req.destroy(); });
    req.on('end', () => {
      let json = null, form = null;
      try { json = JSON.parse(data); } catch {}
      try { form = Object.fromEntries(new URLSearchParams(data)); } catch {}
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
function sendHtml(res, code, html) {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}
function currentCommit() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.git-pull-state.json'), 'utf8'));
    return (s.commit || '').slice(0, 8) || 'unknown';
  } catch { return 'unknown'; }
}
function sanitizePhone(raw) {
  let s = String(raw || '').trim();
  if (s.includes('@')) s = s.split('@')[0];
  if (s.includes(':')) s = s.split(':')[0];
  let digits = s.replace(/[^0-9]/g, '');
  if (digits.startsWith('00') && digits.length >= 10) digits = digits.slice(2);
  if (/^200(1[0125]\d{8})$/.test(digits)) digits = '20' + digits.slice(3);
  if (!/^\d{6,20}$/.test(digits)) return '';
  return digits;
}

/* ============================== Sub-bot management ============================== */
// Sub-bots are stored in global.db.data.subBots (phone -> record).
// Each record: { phone, controlCode, pairStatus, pairError, createdAt, pairedAt, lastSeenAt, waName, settings }
function ensureSubBotStore() {
  global.db = global.db || {};
  global.db.data = global.db.data || {};
  if (!global.db.data.subBots || typeof global.db.data.subBots !== 'object') {
    global.db.data.subBots = {};
  }
  return global.db.data.subBots;
}

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

function normalizePhone(raw) {
  let s = String(raw || '').trim();
  if (s.includes('@')) s = s.split('@')[0];
  if (s.includes(':')) s = s.split(':')[0];
  let digits = s.replace(/[^0-9]/g, '');
  if (digits.startsWith('00') && digits.length >= 10) digits = digits.slice(2);
  if (/^200(1[0125]\d{8})$/.test(digits)) digits = '20' + digits.slice(3);
  if (!/^\d{6,20}$/.test(digits)) return '';
  return digits;
}

export function verifySubBotAccess(phoneRaw, codeRaw) {
  const phone = normalizePhone(phoneRaw);
  const code = String(codeRaw || '').trim();
  if (!phone || !code) return { ok: false, error: 'Enter phone number and control code' };
  const store = ensureSubBotStore();
  const rec = store[phone];
  if (!rec) return { ok: false, error: 'No sub-bot registered with this number yet. Start by pairing first.' };
  const matchesControl = rec.controlCode && timingSafeEqualStr(code, rec.controlCode);
  if (!matchesControl) return { ok: false, error: 'Invalid control code' };
  return { ok: true, phone, record: rec };
}

function serializeSubBot(phone, record) {
  if (!record) return null;
  return {
    phone,
    controlCode: record.controlCode,
    pairStatus: record.pairStatus || 'idle',
    pairError: record.pairError || null,
    pairedAt: record.pairedAt || 0,
    lastSeenAt: record.lastSeenAt || 0,
    waName: record.waName || '',
    settings: record.settings || { mode: 'public', customName: '', prefix: '.', welcome: true, autoReply: true, paused: false, notes: '' },
  };
}

/* ============================== Status ============================== */
function isMaintenanceActive() {
  try { return global.db?.data?.maintenance === true; } catch { return false; }
}

function getClientInfo(client) {
  const st = global.__panelState || (global.__panelState = {});
  const conn = client || global.conn;
  const connected = !!(conn && conn.user && st.connection === 'open');
  const mem = process.memoryUsage();
  const cmdCount = Object.keys(global.plugins || {}).length;
  return {
    ok: true,
    connected,
    connection: st.connection || 'starting',
    sessionRegistered: !!(conn && conn.authState && conn.authState.creds && conn.authState.creds.registered),
    loginMode: panelCfg.loginMode === 'qr' ? 'qr' : 'code',
    configuredPhone: panelCfg.phone || conn?.config?.phoneNumber || '',
    phone: (conn && conn.user && conn.user.id) || '',
    name: (conn && conn.user && (conn.user.name || conn.user.verifiedName)) || global.namebot || 'Bot',
    commands: cmdCount,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
    commit: currentCommit(),
    pairingCode: st.pairingCode || null,
    qr: st.lastQR || null,
    maintenance: isMaintenanceActive(),
    events: getEvents(),
  };
}

/* ============================== HTML views ============================== */
const LOGIN_HTML = (err) => renderPublicPortalHtml(err, INSTALL_RENDER_JS);
const PANEL_HTML = renderAdminPanelHtml(INSTALL_RENDER_JS);

/* ============================== Request handler ============================== */
async function handle(req, res, client) {
  panelCfg = readPanelConfig();
  if (panelPasswordOverride !== null) panelCfg.password = panelPasswordOverride;
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://localhost');
  const cookies = parseCookies(req);
  const authed = verifyCookie(cookies.pw);
  const maintenance = isMaintenanceActive();

  if (req.method === 'GET' && url.pathname === '/api/maintenance-status') {
    return sendJson(res, 200, { maintenance });
  }

  if (maintenance && !authed) {
    if (req.method === 'POST' && url.pathname === '/login') {
    } else if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 503, { ok: false, maintenance: true, error: 'Site under maintenance, please try again later' });
    } else {
      return sendHtml(res, 503, renderMaintenanceHtml(''));
    }
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin')) {
    if (authed) return sendHtml(res, 200, PANEL_HTML);
    return sendHtml(res, 200, LOGIN_HTML(''));
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const blocked = loginBlocked(ip);
    if (blocked) return sendHtml(res, 429, maintenance ? renderMaintenanceHtml('Too many attempts, wait ' + blocked + ' seconds') : LOGIN_HTML('Too many attempts, wait ' + blocked + ' seconds'));
    const { json, form } = await readBody(req);
    const pass = (json?.password ?? form?.password ?? '').toString();
    const ok = pass.length === panelCfg.password.length &&
      crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(panelCfg.password));
    if (!ok) {
      registerFail(ip);
      return sendHtml(res, 401, maintenance ? renderMaintenanceHtml('Wrong password') : LOGIN_HTML('Wrong password'));
    }
    resetFail(ip);
    const secure = secureCookieFlag(req);
    res.writeHead(302, { 'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`, Location: '/' });
    return res.end();
  }

  /* ============ Public sub-bot pairing (no admin login required) ============ */
  // Public users pair as SUB-BOTS (their own WhatsApp account), they cannot
  // touch the main bot number or main bot controls.

  if (req.method === 'POST' && url.pathname === '/api/public/sub/pair') {
    if (subPairBlocked(ip)) return sendJson(res, 429, { ok: false, error: 'Too many attempts — wait a minute' });
    const { json } = await readBody(req);
    const phone = normalizePhone(json?.phone);
    if (!phone || phone.length < 8 || phone.length > 15) {
      return sendJson(res, 400, { ok: false, error: 'Invalid phone number (8-15 digits with country code)' });
    }
    // Don't let public users pair the main bot number
    const mainPhone = sanitizePhone(panelCfg.phone || client?.config?.phoneNumber || '');
    if (mainPhone && phone === mainPhone) {
      return sendJson(res, 400, { ok: false, error: 'This number is the main bot number. Contact the admin.' });
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
        createdAt: Date.now(),
        pairedAt: 0,
        lastSeenAt: 0,
        waName: '',
        settings: { mode: 'public', customName: '', prefix: '.', welcome: true, autoReply: true, paused: false, notes: '' },
      };
      store[phone] = rec;
    } else {
      rec.pairStatus = 'pairing';
      rec.pairError = null;
    }
    // Save to disk
    try {
      const stateFile = path.join(__dirname, 'bots-state.json');
      fs.writeFileSync(stateFile, JSON.stringify({ subBots: store, mainBot: {} }, null, 2));
    } catch {}
    // Generate pairing code using main connection
    try {
      if (client && client.authState && !client.authState.creds.registered) {
        // Main bot not registered yet — can't pair sub-bots
      }
      // Store the request; admin or the user can complete pairing via WhatsApp
      rec.lastPairCode = '';
      rec.pairStatus = 'pending';
    } catch (e) {
      rec.pairError = e.message;
      rec.pairStatus = 'error';
    }
    pushPanelEvent(`Sub-bot pairing requested: ${phone}`);
    const secure = secureCookieFlag(req);
    const tok = makeSubCookie(phone);
    res.writeHead(200, {
      'Set-Cookie': `sub_tok=${tok}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify({
      ok: true,
      phone,
      controlCode: rec.controlCode,
      message: 'Sub-bot registered. Use the control code to manage it.',
      bot: serializeSubBot(phone, store),
    }));
  }

  if (req.method === 'POST' && url.pathname === '/api/public/sub/auth') {
    const blocked = loginBlocked(`subauth:${ip}`);
    if (blocked) return sendJson(res, 429, { ok: false, error: 'Too many attempts — wait ' + blocked + ' seconds' });
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
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify({ ok: true, bot: serializeSubBot(v.phone, ensureSubBotStore()) }));
  }

  if (url.pathname.startsWith('/api/public/sub/')) {
    const subPhone = verifySubCookie(cookies.sub_tok);
    if (req.method === 'GET' && url.pathname === '/api/public/sub/me') {
      if (!subPhone) return sendJson(res, 200, { ok: false, authenticated: false, bot: null });
      return sendJson(res, 200, { ok: true, authenticated: true, bot: serializeSubBot(subPhone, ensureSubBotStore()) });
    }
    if (!subPhone) return sendJson(res, 401, { ok: false, error: 'Enter your number and control code first' });
    if (req.method === 'POST' && url.pathname === '/api/public/sub/settings') {
      const { json } = await readBody(req);
      const store = ensureSubBotStore();
      const rec = store[subPhone];
      if (rec) {
        rec.settings = { ...rec.settings, ...(json || {}) };
        try { fs.writeFileSync(path.join(__dirname, 'bots-state.json'), JSON.stringify({ subBots: store, mainBot: {} }, null, 2)); } catch {}
      }
      return sendJson(res, rec ? 200 : 400, { ok: !!rec, bot: serializeSubBot(subPhone, store) });
    }
    if (req.method === 'POST' && url.pathname === '/api/public/sub/action') {
      const { json } = await readBody(req);
      const act = String(json?.action || '');
      if (act === 'logout') {
        res.writeHead(200, {
          'Set-Cookie': 'sub_tok=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        return res.end(JSON.stringify({ ok: true, message: 'Sub-bot session closed in this browser' }));
      }
      if (act === 'regenerate-code') {
        const store = ensureSubBotStore();
        const rec = store[subPhone];
        if (rec) {
          rec.controlCode = generateControlCode();
          try { fs.writeFileSync(path.join(__dirname, 'bots-state.json'), JSON.stringify({ subBots: store, mainBot: {} }, null, 2)); } catch {}
          return sendJson(res, 200, { ok: true, controlCode: rec.controlCode, message: 'New control code generated' });
        }
        return sendJson(res, 400, { ok: false, error: 'Sub-bot not found' });
      }
      return sendJson(res, 400, { ok: false, error: 'Action not allowed' });
    }
    return sendJson(res, 404, { ok: false, error: 'Path not found' });
  }

  // everything below needs admin auth
  if (!authed) {
    if (url.pathname.startsWith('/api/')) return sendJson(res, 401, { ok: false, message: 'Unauthorized' });
    res.writeHead(302, { Location: '/' });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    return sendJson(res, 200, getClientInfo(client));
  }

  if (req.method === 'GET' && url.pathname === '/api/commands') {
    const all = [];
    const catMap = new Map();
    // build from global.plugins
    for (const [file, p] of Object.entries(global.plugins || {})) {
      if (!p || p.disabled) continue;
      const triggers = [];
      const cmd = p.command;
      if (Array.isArray(cmd)) triggers.push(...cmd.map(String));
      else if (cmd instanceof RegExp) {
        const src = cmd.source.replace(/^\^/, '').replace(/\$$/, '');
        src.split('|').forEach((t) => {
          const clean = t.replace(/[^a-z0-9_]/gi, '');
          if (clean) triggers.push(clean.toLowerCase());
        });
      } else if (typeof cmd === 'string') triggers.push(cmd);
      if (!triggers.length) continue;
      const category = (Array.isArray(p.tags) && p.tags[0]) || 'misc';
      const entry = { primary: triggers[0], triggers, category, categoryLabel: category.charAt(0).toUpperCase() + category.slice(1), description: (Array.isArray(p.help) && p.help[0]) || '', file };
      all.push(entry);
      let prev = catMap.get(category);
      if (!prev) { prev = { id: category, label: entry.categoryLabel, count: 0 }; catMap.set(category, prev); }
      prev.count += 1;
    }
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const cat = (url.searchParams.get('cat') || '').trim();
    const filtered = (!q && !cat) ? all : all.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (!q) return true;
      return c.primary.toLowerCase().includes(q)
        || (c.description || '').toLowerCase().includes(q)
        || c.categoryLabel.toLowerCase().includes(q)
        || c.triggers.some((t) => t.toLowerCase().includes(q));
    });
    const hasLimit = url.searchParams.has('limit') || url.searchParams.has('page');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = hasLimit ? Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10) || 24)) : 0;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(filtered.length / limit)) : 1;
    const safePage = Math.min(page, totalPages);
    const commandsSlice = limit > 0 ? filtered.slice((safePage - 1) * limit, safePage * limit) : (filtered.length > 500 ? filtered.slice(0, 500) : filtered);
    return sendJson(res, 200, {
      ok: true, total: all.length, filtered: filtered.length, page: safePage,
      limit: limit || commandsSlice.length, totalPages,
      truncated: limit === 0 && filtered.length > 500,
      categories: [...catMap.values()].sort((a, b) => b.count - a.count),
      commands: commandsSlice,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/maintenance') {
    const { json } = await readBody(req);
    const enabled = !!json?.enabled;
    try {
      global.db = global.db || {};
      global.db.data = global.db.data || {};
      global.db.data.maintenance = enabled;
      pushEvent(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
      return sendJson(res, 200, { ok: true, maintenance: enabled, message: enabled ? 'Maintenance enabled' : 'Maintenance disabled' });
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
    pushEvent('Generated a new random panel password');
    const secure = secureCookieFlag(req);
    res.writeHead(200, {
      'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify({ ok: true, password: nextPass, message: 'New random password generated' }));
  }

  if (req.method === 'GET' && url.pathname === '/api/update-check') {
    try { return sendJson(res, 200, await checkUpdate()); }
    catch (e) { return sendJson(res, 200, { ok: false, error: e.message }); }
  }

  if (req.method === 'POST' && url.pathname === '/api/update') {
    pushEvent('Update requested from panel');
    sendJson(res, 200, { ok: true });
    setTimeout(async () => {
      try {
        await applyUpdate({ log: (t) => pushEvent(t), event: (m) => pushEvent(m), delayMs: 1500 });
      } catch (e) { pushEvent('Update failed: ' + (e && e.message)); }
    }, 500);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const { json } = await readBody(req);
    const action = json?.action;
    const st = global.__panelState || (global.__panelState = {});
    try {
      switch (action) {
        case 'logout':
          panelCfg.rev = (Number(panelCfg.rev) || 0) + 1;
          savePanelConfig(panelCfg);
          pushEvent('Logged out of all sessions — rev is now ' + panelCfg.rev);
          res.writeHead(200, { 'Set-Cookie': 'pw=; HttpOnly; Path=/; Max-Age=0', 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, message: 'Logged out — all sessions revoked' }));

        case 'restart':
          pushEvent('Restart requested from panel');
          st.stopped = false;
          sendJson(res, 200, { ok: true, message: 'Restarting...' });
          setTimeout(() => { if (typeof global.restartBot === 'function') global.restartBot('panel'); else pushEvent('Restart path unavailable'); }, 600);
          return;

        case 'stop':
          pushEvent('Stop requested from panel');
          st.stopped = true;
          try { global.conn?.ws?.close(); } catch {}
          return sendJson(res, 200, { ok: true, message: 'Bot stopped' });

        case 'start':
          pushEvent('Start requested from panel');
          st.stopped = false;
          sendJson(res, 200, { ok: true, message: 'Starting...' });
          setTimeout(() => { if (typeof global.restartBot === 'function') global.restartBot('panel-start'); }, 600);
          return;

        case 'reset-session': {
          pushEvent('Reset session requested from panel');
          const sp = path.join(ROOT, 'sessions');
          if (!fs.existsSync(sp)) {
            pushEvent('No session exists — nothing to reset');
            return sendJson(res, 200, { ok: false, message: 'No session to delete' });
          }
          sendJson(res, 200, { ok: true, message: 'Session moved. Restarting...', pendingRestart: true });
          setTimeout(() => {
            void (async () => {
              try { global.conn?.ws?.close(); } catch {}
              let bak = `${sp}.bak-${Date.now()}`;
              let n = 0;
              while (fs.existsSync(bak)) { n += 1; bak = `${sp}.bak-${Date.now()}-${n}`; }
              try {
                fs.renameSync(sp, bak);
                pushEvent('Old session moved to ' + path.basename(bak) + ' — nothing deleted');
              } catch (e) {
                pushEvent('Could not move session — reset cancelled: ' + (e?.message || e));
                return;
              }
              st.stopped = false;
              if (typeof global.restartBot === 'function') global.restartBot('panel-reset');
            })().catch((e) => pushEvent('Reset error: ' + (e?.message || e)));
          }, 500);
          return;
        }

        case 'send': {
          if (!(global.conn && global.conn.user && st.connection === 'open')) {
            return sendJson(res, 400, { ok: false, message: 'Bot is not connected' });
          }
          const to = String(json?.to || '').replace(/[^0-9]/g, '');
          const text = String(json?.text || '');
          if (!/^\d{7,15}$/.test(to)) return sendJson(res, 400, { ok: false, message: 'Invalid WhatsApp number' });
          if (!text || !text.trim()) return sendJson(res, 400, { ok: false, message: 'Number or text missing' });
          if (text.length > 4096) return sendJson(res, 400, { ok: false, message: 'Text longer than allowed (4096)' });
          if (sendBlocked(ip)) return sendJson(res, 429, { ok: false, message: 'Too many messages — wait a minute' });
          bumpSendCount(ip);
          await global.conn.sendMessage(`${to}@s.whatsapp.net`, { text });
          return sendJson(res, 200, { ok: false, message: 'Message sent' });
        }

        case 'pair-main': {
          // Admin-only: pair the MAIN bot with a number
          const phone = sanitizePhone(json?.phone);
          const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
          if (!phone || !/^\d{6,20}$/.test(phone)) {
            return sendJson(res, 400, { ok: false, error: 'Invalid phone number' });
          }
          if (loginMode === 'qr') {
            return sendJson(res, 200, { ok: true, message: 'QR mode: use Save & restart to apply and scan the QR' });
          }
          try {
            if (global.conn?.authState?.creds?.registered) {
              return sendJson(res, 400, { ok: false, error: 'Bot is already registered. Reset the session first.' });
            }
            let code = await global.conn.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            st.pairingCode = code;
            st.lastQR = null;
            pushEvent('Pairing code issued: ' + code);
            return sendJson(res, 200, { ok: true, pairingCode: code });
          } catch (e) {
            return sendJson(res, 400, { ok: false, error: e?.message || String(e) });
          }
        }

        case 'set-login': {
          const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
          const phone = sanitizePhone(json?.phone || '');
          panelCfg.loginMode = loginMode;
          panelCfg.phone = phone;
          savePanelConfig(panelCfg);
          pushEvent('Login method changed to: ' + loginMode + (phone ? ' — number ' + phone : ''));
          sendJson(res, 200, { ok: true, message: 'Saved. Restarting...', pendingRestart: true });
          setTimeout(() => { if (typeof global.restartBot === 'function') global.restartBot('panel-set-login'); }, 500);
          return;
        }

        default:
          return sendJson(res, 400, { ok: false, message: 'Unknown action' });
      }
    } catch (e) {
      pushEvent('Error executing ' + action + ': ' + e.message);
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

  const port = options.port !== undefined
    ? Number(options.port)
    : (Number(process.env.WEB_PORT || process.env.PORT || process.env.SERVER_PORT || process.env.P_SERVER_PORT) || 3732);
  const host = options.host || '0.0.0.0';

  const server = http.createServer((req, res) => {
    handle(req, res, global.conn).catch((e) => {
      console.error('⚠️ [WEB] error:', e.message);
      try { sendJson(res, 500, { ok: false, message: 'Internal error' }); } catch {}
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
      pushEvent('Control panel running on port ' + port);
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
  if (!/^\d{6,20}$/.test(phone)) return '';
  const expect = sign(`${phone}.${expStr}.${revStr}`);
  if (sig.length !== expect.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  if (Number(revStr) !== (Number(panelCfg.rev) || 0)) return false;
  if (!(Number(expStr) > Date.now())) return false;
  return phone;
}
