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
const DEFAULT_PASSWORD = 'winner'; // legacy default — not allowed as a real password anymore
const DEFAULT_CONFIG = {
  password: '',      // if empty, a strong one is generated and saved
  loginMode: 'code', // code = pairing code | qr = QR
  phone: '',         // bot number (optional)
  secret: '',        // cookie signing key (generated)
  rev: 0,            // bumped on password change / logout-all → invalidates old cookies
  pwHash: '',        // fingerprint to detect password changes between boots
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
    if (diskPwHash !== null) cfg.rev = (Number(cfg.rev) || 0) + 1; // password changed → kill old cookies
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
function sanitizePhone(p) { return String(p || '').replace(/[^0-9]/g, ''); }

/* ============================== State ============================== */
let panelCfg = readPanelConfig();
let panelPasswordOverride = null;

function pushEvent(msg, kind = 'panel') { pushPanelEvent(msg, kind); }

function sessionRegistered(client) {
  try {
    const p = path.join(ROOT, 'sessions', 'creds.json');
    if (!fs.existsSync(p)) return false;
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    return !!(creds?.registered || creds?.me);
  } catch { return false; }
}

function isMaintenanceActive() {
  try { return global.db?.data?.maintenance === true; } catch { return false; }
}

/* command list from global.plugins (no simulator) */
function extractTriggers(plugin) {
  const out = [];
  const cmd = plugin?.command;
  if (Array.isArray(cmd)) out.push(...cmd.map(String));
  else if (cmd instanceof RegExp) {
    const src = cmd.source.replace(/^\^/, '').replace(/\$$/, '');
    src.split('|').forEach((t) => {
      const clean = t.replace(/[^a-z0-9_]/gi, '');
      if (clean) out.push(clean.toLowerCase());
    });
  } else if (typeof cmd === 'string') out.push(cmd);
  if (Array.isArray(plugin?.help)) plugin.help.forEach((h) => String(h).split(/\s+/)[0] && out.push(String(h).split(/\s+/)[0]));
  return [...new Set(out.filter(Boolean))];
}
function buildCommandsList() {
  const plugins = global.plugins || {};
  const catMap = new Map();
  const all = [];
  for (const [file, p] of Object.entries(plugins)) {
    if (!p || p.disabled) continue;
    const triggers = extractTriggers(p);
    if (!triggers.length) continue;
    const category = (Array.isArray(p.tags) && p.tags[0]) || 'misc';
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    const description = (Array.isArray(p.help) && p.help[0]) || '';
    const entry = { primary: triggers[0], triggers, category, categoryLabel, description, file };
    all.push(entry);
    let prev = catMap.get(category);
    if (!prev) { prev = { id: category, label: categoryLabel, count: 0 }; catMap.set(category, prev); }
    prev.count += 1;
  }
  return { all, categories: [...catMap.values()].sort((a, b) => b.count - a.count) };
}

/* ============================== Status ============================== */
function getClientInfo(client) {
  const st = global.__panelState || {};
  const conn = client || global.conn;
  const connected = !!(conn && conn.user && st.connection === 'open');
  const mem = process.memoryUsage();
  const cmdCount = Object.keys(global.plugins || {}).length;
  return {
    ok: true,
    connected,
    connection: st.connection || 'starting',
    sessionRegistered: sessionRegistered(conn),
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

  // Maintenance: close the site to guests, but let admins log in.
  if (maintenance && !authed) {
    if (req.method === 'POST' && url.pathname === '/login') {
      // allow admin login
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
    const { all, categories } = buildCommandsList();
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
      categories, commands: commandsSlice,
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
          setTimeout(() => { if (typeof global.restartBot === 'function') global.restartBot('panel-start'); else pushEvent('Restart path unavailable'); }, 600);
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
          return sendJson(res, 200, { ok: true, message: 'Message sent' });
        }

        case 'pair-main': {
          const phone = sanitizePhone(json?.phone);
          const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
          if (!phone || !/^\d{7,15}$/.test(phone)) {
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

  // Capture pairing code printed to the console (fallback for log-based flows).
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