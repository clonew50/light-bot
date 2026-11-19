/**
 * webPanel.js — لوحة تحكم ويب للبوت
 * ---------------------------------------------------
 * بتشتغل مع البوت على البانل، بتفتح صفحة ويب تقدر منها:
 *   - تعمل تنصيب (ربط) البوت بواتساب: QR أو كود ربط
 *   - تتحكم في البوت: إعادة تشغيل / إيقاف / تشغيل / تصفير الجلسة
 *   - تشوف الحالة والأخطاء وترسل رسالة
 *
 * الدخول بكلمة سر: أول تشغيل بتتولّد كلمة سر عشوائية (16 حرف) وتتحفظ في
 * panel-config.json (ومش بتتطبع في اللوج) — أو حطها في WEB_PASSWORD.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPairingState } from './pairing.js';
import { pushEvent as busPushEvent, getEvents } from './events.js';
import { isAlive, livenessStatus } from './liveness.js';
import { normalizeCommandsList, simulateCommand } from './simulator.js';
import { renderPublicPortalHtml, renderAdminPanelHtml, renderMaintenanceHtml } from './panelViews.js';
import {
  normalizePhone,
  requestSubBotPairing,
  verifySubBotAccess,
  serializeSubBot,
  updateSubBotSettings,
  controlSubBot,
  updateMainBotSettings,
  getBotFleetOverview,
  syncConnectedBotOwner,
  getMainBotSettings
} from './botRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// hook للاختبارات/التشغيل المعزول: ملف الإعدادات في مكان تاني (افتراضيًا نفس الملف)
function configFilePath() {
  return process.env.PANEL_CONFIG_FILE
    ? path.resolve(process.env.PANEL_CONFIG_FILE)
    : path.join(__dirname, 'panel-config.json');
}

/* ============ إعدادات محفوظة ============ */
const DEFAULT_PASSWORD = 'winner'; // كلمة السر القديمة — مش مسموح بيها ككلمة سر فعلية بعد دلوقتي
const fDEFAULT_CONFIG = {
  password: '',      // لو فاضية، بنولّد واحدة قوية تلقائيًا ونحفظها في الملف
  loginMode: 'code', // code = كود ربط | qr = رمز QR
  phone: '',         // رقم البوت (اختياري، يملأ config.phoneNumber)
  secret: ''         // مفتاح توقيع الكوكيز (يتم توليده)
};

// كلمة سر قوية 16 حرف: رجّعت (حروف/أرقام بلا محارف ملخبطة)
function generatePassword(len = 16) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function readPanelConfig() {
  const cfgPath = configFilePath();
  let cfg = { ...fDEFAULT_CONFIG };
  // بصمة كلمة السر كما حفظناها آخر مرة — بنقارن بيها عند الإقلاع عشان نكتشف
  // أي تغيير (env مختلف / توليد جديد / تعديل يدوي في الملف) ونرفع عدّاد rev
  // فسحب كل الكوكيز القديمة فورًا.
  let diskPwHash = null;
  try {
    if (fs.existsSync(cfgPath)) {
      const disk = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg = { ...cfg, ...disk };
      if (disk && typeof disk.pwHash === 'string') diskPwHash = disk.pwHash;
      // ملف موجود من قبل لازم يفضل بصلاحية 0600 (إصلاح أي ملف قديم أوسع من كده)
      try {
        if ((fs.statSync(cfgPath).mode & 0o777) !== 0o600) fs.chmodSync(cfgPath, 0o600);
      } catch {}
    }
  } catch (e) {
    console.error('⚠️ [WEB] تعذّر قراءة panel-config.json:', e.message);
    // ما نكتبش فوق الملف التالف مباشرة — نحفظه للأرشيف ونتابع بقيم جديدة
    try {
      const bad = `${cfgPath}.corrupt-${Date.now()}.json`;
      fs.renameSync(cfgPath, bad);
      console.warn(`🗃️ [WEB] الملف التالف اتنقل إلى ${path.basename(bad)}`);
    } catch {}
  }
  // الأولوية لـ WEB_PASSWORD — وكلمة السر الافتراضية 'winner' مش مسموح بيها:
  // بنتولّد واحدة عشوائية ونحفظها فورًا (مش بتتطبع في اللوج — المسار في الملف فقط)
  if (process.env.WEB_PASSWORD) {
    cfg.password = process.env.WEB_PASSWORD;
  } else if (!cfg.password || cfg.password === DEFAULT_PASSWORD) {
    cfg.password = generatePassword(16);
    // علامة غير منطبقة في JSON.stringify — مش بتنحفظ في الملف
    Object.defineProperty(cfg, '__generated', { value: true, configurable: true });
  } else if (cfg.__generated) {
    // نشيل العلامة من كائن مقروء من القرص (احتياطي) عشان ما تتنحفظش
    delete cfg.__generated;
  }
  // عدّاد rev — بيروح مع كل كوكي، وأي كوكي بـ rev قديم بيترفض.
  if (!Number.isInteger(cfg.rev) || cfg.rev < 0) cfg.rev = 0;
  // بصمة الكلمة النهائية (بعد env/التوليد) — ملاحظة: الملف أصلاً بيحفظ كلمة
  // السر نصًّا، فالبصمة دي لأجل اكتشاف التغيير مش للحماية.
  const pwHash = crypto.createHash('sha256').update(String(cfg.password)).digest('hex');
  let needSave = false;
  if (pwHash !== diskPwHash) {
    if (diskPwHash !== null) {
      // كلمة السر اتغيّرت فعليًا عن آخر حفظ → كل كوكي اتصدر قبل كده ميت.
      cfg.rev = (Number(cfg.rev) || 0) + 1;
    }
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
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    // الملف فيه كلمة سر اللوحة ومفتاح توقيع الكوكيز — صلاحية 0600 إجبارية
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, cfgPath);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    console.error('⚠️ [WEB] تعذّر حفظ panel-config.json:', e.message);
  }
}

/* ============ حالة اللوحة ============ */
const state = {
  qr: null,
  qrAt: 0,
  qrDataUrl: null,
  qrCacheFor: null,
  pairingCode: null,
  lastConnected: null,
  lastCloseAt: 0,
  stopped: false, // true لما المستخدم يوقف البوت عمدًا من اللوحة (بيستخدمه الـ watchdog)
  pendingRestart: null // {reason, at} — فيه خروج نظيف كامل جارٍ بعد أمر من اللوحة
};

/* حالة الربط — المصدر الوحيد للحقيقة:
   الـ pairing نشط بس لو اتصدر QR/كود، ومفيش open بعده، ومفيش 3 دقايق عدّت.
   الشكل القديم (وجود QR/كود في الذاكرة) كان بيفضل true للأبد، وده كان
   بيوقف الـ watchdog والـ healer للأبد (GAP-13). */
export const pairingState = createPairingState();

/* في عملية ربط حقيقية شغالة دلوقتي؟ (الحالة نفسها هي المرجع — مش flag قديم) */
export function pairingActive(now = Date.now()) {
  try { return pairingState.isActive(now) === true; } catch { return false; }
}

/* حالة اللوحة للأجزاء الخارجية (مثلاً watchdog في index.js):
   pairing       = في عملية ربط حقيقية شغالة دلوقتي (مش بس QR قديم في الذاكرة)
   pairingAgeMs  = عمر عملية الربط بالمللي ثانية (0 لو مفيش عملية)
   stopped       = البوت متقفل عمدًا من اللوحة (ماتعملش restart له) */
export function panelRuntime(now = Date.now()) {
  const active = pairingActive(now);
  return {
    pairing: active,
    stopped: !!state.stopped,
    pairingAgeMs: active ? pairingState.ageMs(now) : 0
  };
}

function pushEvent(msg, kind = 'panel') {
  // كل رسائل اللوحة (وأي subsystem بيستدعي pushEvent) بتترحّل لناقل
  // الأحداث المشترك، فبتظهر في نفس قائمة "سجل الأحداث" مع timestamp.
  // التوقيع القديم pushEvent('نص') شغّال زي ما هو.
  busPushEvent(kind, String(msg));
  try { console.log('🌐 [WEB]', msg); } catch {}
}

const ANSI = /\x1b\[[0-9;]*m/g;

/* ============ التقاط كود الربط من اللوج ============ */
function hookConsole() {
  if (console.__webHooked) return;
  console.__webHooked = true;
  const orig = console.log.bind(console);
  console.log = (...args) => {
    try {
      const line = String(args.join(' ')).replace(ANSI, '');
      const m = line.match(/Pairing Code\s*[:：]?\s*([A-Za-z0-9-]{6,12})/i);
      if (m) {
        state.pairingCode = m[1];
        state.qr = null;
        pairingState.setPairingCode(m[1]);
        pushEvent('تم إصدار كود ربط: ' + m[1]);
      }
    } catch {}
    return orig(...args);
  };
}

/* ============ ربط مستمع الـ QR/الاتصال بجلسة واتساب ============ */
let attachedSock = null;
let attachedClient = null;

/* كود الفصل من آخر حدث close (401 = loggedOut | 403 = forbidden) */
function closeStatusCode(update) {
  const err = update?.lastDisconnect?.error;
  const code = err?.output?.statusCode ?? err?.status;
  const n = Number(code);
  return Number.isFinite(n) ? n : null;
}

export function handleConnectionUpdate(update) {
  try {
    const { connection, qr } = update || {};
    if (qr) {
      state.qr = qr;
      state.qrAt = Date.now();
      state.qrDataUrl = null;
      state.qrCacheFor = null;
      state.pairingCode = null;
      pairingState.setQr(qr);
      pushEvent('QR جديد جاهز للاسكان');
    }
    if (connection) {
      pushEvent('حالة الاتصال: ' + connection);
      if (connection === 'open') {
        state.qr = null;
        state.pairingCode = null;
        state.lastConnected = Date.now();
        pairingState.clear(); // الاتصال اتفتح — خلاص مفيش ربط شغال
        if (attachedClient) syncConnectedBotOwner(attachedClient);
      }
      if (connection === 'close') {
        const code = closeStatusCode(update);
        state.lastCloseAt = Date.now();
        if (code === 401 || code === 403) pairingState.clear(); // اتقفل الحساب/الجهاز — اربط تاني
      }
    }
  } catch (e) {
    pushEvent('خطأ في قراءة حالة الاتصال: ' + e.message);
  }
}

function attachSock(client) {
  attachedClient = client || attachedClient;
  const sock = client?.sock;
  if (sock?.user?.id) syncConnectedBotOwner(client, sock);
  if (!sock || sock === attachedSock) return;
  if (attachedSock?.ev) {
    try { attachedSock.ev.removeListener('connection.update', handleConnectionUpdate); } catch {}
  }
  attachedSock = sock;
  try { sock.ev.on('connection.update', handleConnectionUpdate); } catch (e) { pushEvent('تعذّر ربط السوكيت: ' + e.message); }
}

/* ============ حالة الاتصال — إشارة الحياة المشتركة (todo 35) ============ */
/* الحساب القديم (كان محلي ومؤقت هنا) اتشال؛ دلوقتي بنقرأ من
   system/liveness.js نفسها اللي بيقرا منها الـ watchdog والـ healer:
     • socket.ws.readyState === 1 (WebSocket.OPEN)
     • sock.user موجود
     • اتسجّل open ومفيش close بعده (قبل أول open = مش متصل)
   بنحتفظ بس بتوقيع state.lastConnected/lastCloseAt المحلي عشان مستمع
   connection.update بتاع اللوحة، وبناخد الأحدث بينه وبين نبضة الحياة. */
export function computeConnected(client, now = Date.now()) {
  const status = livenessStatus(client, now);
  const lastOpen = Math.max(Number.isFinite(state.lastConnected) ? state.lastConnected : 0, status.lastOpenAt);
  const lastClose = Math.max(state.lastCloseAt || 0, status.lastCloseAt);
  // نفس الدالة اللي بيقرا منها الـ watchdog والـ healer — مفيش منطق مكرر.
  return isAlive(client, now, { lastOpenAt: lastOpen, lastCloseAt: lastClose });
}

/* ============ أدوات مساعدة ============ */
function sessionPathOf(client) {
  return path.resolve(process.cwd(), client?.config?.sessionPath || './session');
}

// مسار الجلسة مسموح يحذف فقط لو مجلد فرعي داخل المشروع ومفيش فيه ملفات كود حساسة
function isSafeSessionPath(sp) {
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(sp || '');
  if (resolved === root || !resolved.startsWith(root + path.sep)) return false;
  const rel = path.relative(root, resolved);
  return !/^(node_modules|\.git|system|plugins)(\/|$)/.test(rel);
}

function sessionRegistered(client) {
  try {
    const p = path.join(sessionPathOf(client), 'creds.json');
    if (!fs.existsSync(p)) return false;
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    return !!(creds?.registered || creds?.me);
  } catch { return false; }
}

function selectErrors(errors, limit = 15) {
  // client.errors() بترجّع الأحدث أولًا (W.unshift في meowsab)، فالـ 15
  // الأحدث هم أول 15 عنصر — مش آخرهم. (الكود القديم كان slice(-15).reverse()
  // وبيعرض الأقدم 15.)
  const list = Array.isArray(errors) ? errors : [];
  const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 15;
  return list.slice(0, n);
}

export function getClientInfo(client) {
  let commands = 0, errors = [];
  try { commands = client.getAllCommands?.().length || 0; } catch {}
  try { errors = client.errors?.() || []; } catch {}
  const mem = process.memoryUsage();
  let subStats = { totalSubs: 0, connectedSubs: 0 };
  try {
    const fleet = getBotFleetOverview(client, global.subBots, computeConnected(client));
    subStats = {
      totalSubs: fleet.stats.totalSubs,
      connectedSubs: fleet.stats.connectedSubs
    };
  } catch {}
  return {
    connected: computeConnected(client),
    phone: client?.config?.phoneNumber || '',
    name: client?.config?.info?.nameBot || 'البوت',
    commands,
    errors: selectErrors(errors),
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
    sessionRegistered: sessionRegistered(client),
    sessionPath: sessionPathOf(client),
    qr: state.qr ? state.qrDataUrl : null,
    pairingCode: state.pairingCode,
    loginMode: panelCfg.loginMode,
    configuredPhone: panelCfg.phone || client?.config?.phoneNumber || '',
    subStats,
    // فيه إعادة تشغيل كاملة (خروج نظيف) جارٍ بعد أمر تنصيب/تصفير من اللوحة؟
    // الواجهة بتعرض شريط "أعد التشغيل جارٍ..." بدل الرد الصامت.
    pendingRestart: state.pendingRestart,
    // أحدث 100 حدث (ناقل الأحداث بيقصّ الأقدم) — نفس مفتاح `events` اللي
    // الواجهة بتعتمد عليه، وكل عنصر {ts,kind,text,line}.
    events: getEvents()
  };
}

/* ============ الخروج النظيف الكامل (خطوة السلّم المشتركة) ============ */
/* أزرار "تنصيب" (set-login) و"تصفير الجلسة" ما يكمّلوش بإعادة تشغيل داخلية:
   إس كي موديولز مش بتتحمّل من تاني والحالة في الذاكرة بتفضل قديمة — الفايدة
   الحقيقية إن عملية جديدة تقلع وتقرا panel-config.json من الأول (index.js
   بيعمل readPanelConfig عند الإقلاع ويطبّق config.printQR/phone).
   فالمسار الصح: خروج نظيف بكود 1 (تفريغ الداتابيز + process.exit(1)) عشان
   مدير العمليات يرجّع البوت. الخطوة دي بتقدّمها من السلّم المشترك
   (system/restart-ladder.js) عبر setCleanRestart / global.restartBotClean
   اللي index.js بيركّبهم — مش global.restartBot (الإعادة الداخلية). */
let cleanRestartFn = null;

/** يحقن مسار الخروج النظيف (index.js بيمرّر خطوة السلّم — والاختبارات بتحقن نسختها). */
export function setCleanRestart(fn) {
  cleanRestartFn = typeof fn === 'function' ? fn : null;
}

/** يعلّم اللوحة إن فيه إعادة تشغيل كاملة قيد التنفيذ (بدل الرد الصامت). */
function markPendingRestart(reason) {
  state.pendingRestart = { reason: String(reason || ''), at: Date.now() };
}

/**
 * يطلب الخروج النظيف الكامل (كود 1) — نفس خطوة السلّم المشترك.
 * @returns {Promise<boolean>} true لو المسار اشتغل فعلًا
 */
export async function requestCleanRestart(reason) {
  markPendingRestart(reason);
  pushEvent('أعد التشغيل جارٍ: ' + reason + ' — خروج نظيف كامل بكود 1');
  if (typeof cleanRestartFn === 'function') {
    try { await cleanRestartFn(reason); return true; }
    catch (e) { pushEvent('تعذّر الخروج النظيف: ' + (e?.message || e)); return false; }
  }
  if (typeof global.restartBotClean === 'function') {
    try { await global.restartBotClean(reason); return true; }
    catch (e) { pushEvent('تعذّر الخروج النظيف: ' + (e?.message || e)); return false; }
  }
  // مش بنرجع لـ global.restartBot (إعادة تشغيل داخلية) هنا — دي كانت
  // المشكلة الأصلية: بيرجع من غير ما يقرا الإعدادات الجديدة خالص.
  pushEvent('تعذّر إعادة التشغيل النظيفة: المسار المركزي غير متاح');
  return false;
}

/* ============ الحماية ============ */
function sign(value) {
  return crypto.createHmac('sha256', panelCfg.secret).update(value).digest('hex');
}
/* الكوكي = exp.rev.signature — rev بيتصاعد مع كل تغيير كلمة سر أو خروج من
   كل الأجهزة، فأي كوكي اتصدر قبل التغيير بيرفض فورًا (حتى لو التوقيع سليم). */
function makeCookie(days = 30) {
  const exp = Date.now() + days * 86400000;
  const payload = `${exp}.${Number(panelCfg.rev) || 0}`;
  return `${payload}.${sign(payload)}`;
}
function verifyCookie(cookie) {
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false; // كوكي قديم بدون rev → مرفوض
  const [expStr, revStr, sig] = parts;
  if (!expStr || !revStr || !sig) return false;
  const expect = sign(`${expStr}.${revStr}`);
  if (sig.length !== expect.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  if (Number(revStr) !== (Number(panelCfg.rev) || 0)) return false; // rev قديم = منسوخ
  return Number(expStr) > Date.now();
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

const attempts = new Map(); // ip -> {count, until}
const MAX_ATTEMPTS = 8;

/* عنوان العميل الفعلي: أول hop من X-Forwarded-For لما فيه reverse proxy —
   من غير كده الحد بيتحسب على IP البروكسي الواحد وبيبقى حد عام على كل الزوار. */
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '');
  const first = xff.split(',')[0].trim();
  return first || req.socket.remoteAddress || 'x';
}

// تنظيف دوري بسيط عشان خريطة المحاولات ما تزيدش في الذاكرة للأبد
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
  a.count += 1;
  a.until = Date.now() + 5 * 60000;
  if (a.count >= MAX_ATTEMPTS) a.count = MAX_ATTEMPTS;
  attempts.set(ip, a);
}
function resetFail(ip) { attempts.delete(ip); }

/* ==== حد إرسال الرسائل من اللوحة (حماية من استخدام /api/action/send كسبام) ==== */
const SEND_WINDOW_MS = 60_000;
const SEND_MAX_PER_WINDOW = 5;
const sendCounts = new Map(); // ip -> {n, t}
function pruneSendCounts() {
  const now = Date.now();
  for (const [k, v] of sendCounts) if (now - v.t > SEND_WINDOW_MS) sendCounts.delete(k);
}
function sendBlocked(ip) {
  if (sendCounts.size > 500) pruneSendCounts();
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

/* ============ قراءة الجسم ============ */
function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) req.destroy();
    });
    req.on('end', () => {
      let json = null, form = null;
      try { json = JSON.parse(data); } catch {}
      try { form = Object.fromEntries(new URLSearchParams(data)); } catch {}
      resolve({ data, json, form });
    });
    req.on('error', () => resolve({ data: '', json: null, form: null }));
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendHtml(res, code, html) {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

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
  if (!/^\d{8,15}$/.test(phone)) return '';
  const expect = sign(`${phone}.${expStr}.${revStr}`);
  if (sig.length !== expect.length) return '';
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return '';
  if (Number(revStr) !== (Number(panelCfg.rev) || 0)) return '';
  if (!(Number(expStr) > Date.now())) return '';
  return phone;
}
function secureCookieFlag(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https' ? '; Secure' : '';
}

/* ============ HTML (الواجهة الافتراضية + لوحة الأدمن) ============ */
const LOGIN_HTML = (err) => renderPublicPortalHtml(err);
const INSTALL_RENDER_JS = `let lastInstallSig='';
function renderInstall(d){
  const box=document.getElementById('installBody');
  const activeId=document.activeElement?document.activeElement.id:'';
  if(activeId==='lm' || activeId==='ph') return;
  const sig=[!!d.connected,d.pairingCode||'',d.qr?'1':'0',d.loginMode||'',d.configuredPhone||''].join('|');
  if(sig===lastInstallSig) return;
  lastInstallSig=sig;
  if(d.connected){
    box.innerHTML='<div class="hint">البوت الرئيسي متصل بواتساب بالفعل. لتغييره برقم آخر استخدم <b>تصفير الجلسة</b> ثم أعد الربط.</div>';
    return;
  }
  let html='';
  if(d.pairingCode){
    html+='<div class="hint">افتح واتساب ← الأجهزة المرتبطة ← الربط برقم الهاتف واكتب الكود:</div><div class="code">'+esc(d.pairingCode)+'</div>';
  }
  if(d.qr){
    html+='<div class="qrbox"><div class="hint">امسح رمز QR من واتساب:</div><img src="'+d.qr+'" alt="QR"></div>';
  }
  if(!d.pairingCode && !d.qr){
    html+='<div class="hint">في انتظار صدور QR أو كود الربط للبوت الرئيسي...</div>';
  }
  html+='<div style="margin-top:12px">'
     +'<label class="lbl">طريقة الربط</label>'
     +'<select id="lm"><option value="code"'+(d.loginMode==='code'?' selected':'')+'>كود ربط (برقم الهاتف)</option>'
     +'<option value="qr"'+(d.loginMode==='qr'?' selected':'')+'>رمز QR</option></select>'
     +'<label class="lbl">رقم البوت الرئيسي</label>'
     +'<input id="ph" class="ltr mono" value="'+esc(d.configuredPhone)+'" placeholder="2010xxxxxxx">'
     +'<div class="actions"><button type="button" class="pri" onclick="applyLogin()">حفظ وإعادة التشغيل</button>'
     +'<button type="button" class="ghost" onclick="refresh()">تحديث</button></div></div>';
  box.innerHTML=html;
}`;
const PANEL_HTML = renderAdminPanelHtml(INSTALL_RENDER_JS);

/* ============ معالجة الطلبات ============ */
// تهيئة مبدئية: getClientInfo ممكن يتنده قبل startWebPanel (اختبارات) —
// startWebPanel بيستبدلها بالقيم المقروءة من القرص.
let panelCfg = readPanelConfig();

export function isMaintenanceActive(client) {
  if (global.db && typeof global.db.maintenance === 'boolean' && global.db.maintenance === true) {
    return true;
  }
  try {
    const ms = getMainBotSettings(client);
    return Boolean(ms?.maintenance === true);
  } catch (_) {
    return false;
  }
}

async function handle(req, res, client) {
  panelCfg = readPanelConfig();
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://localhost');
  const cookies = parseCookies(req);
  const authed = verifyCookie(cookies.pw);
  const maintenance = isMaintenanceActive(client);

  // حالة الصيانة لفحص الصفحة وإعادة التحميل التلقائي
  if (req.method === 'GET' && url.pathname === '/api/maintenance-status') {
    return sendJson(res, 200, { maintenance });
  }

  // وضع الصيانة: إغلاق الموقع للزوار وعرض شاشة الصيانة اللطيفة مع إتاحة تسجيل دخول الأدمن
  if (maintenance && !authed) {
    if (req.method === 'POST' && url.pathname === '/login') {
      // مسموح للأدمن بالمرور لتسجيل الدخول للوحة التحكم
    } else if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 503, {
        ok: false,
        maintenance: true,
        error: 'الموقع تحت الصيانة حالياً، يرجى الانتظار والمحاولة لاحقاً'
      });
    } else {
      return sendHtml(res, 503, renderMaintenanceHtml(''));
    }
  }

  // الشاشة الافتراضية للزوار (ربط واتساب + التحكم بالكود المحفوظ) أو لوحة الأدمن للمسجلين
  if (req.method === 'GET' && url.pathname === '/') {
    if (authed) return sendHtml(res, 200, PANEL_HTML);
    return sendHtml(res, 200, LOGIN_HTML(''));
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const blocked = loginBlocked(ip);
    if (blocked) {
      const blockHtml = maintenance
        ? renderMaintenanceHtml('محاولات كثيرة، انتظر ' + blocked + ' ثانية')
        : LOGIN_HTML('محاولات كثيرة، انتظر ' + blocked + ' ثانية');
      return sendHtml(res, 429, blockHtml);
    }
    const { json, form } = await readBody(req);
    const pass = (json?.password ?? form?.password ?? '').toString();
    const ok = pass.length === panelCfg.password.length &&
      crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(panelCfg.password));
    if (!ok) {
      registerFail(ip);
      const failHtml = maintenance ? renderMaintenanceHtml('كلمة السر غلط') : LOGIN_HTML('كلمة السر غلط');
      return sendHtml(res, 401, failHtml);
    }
    resetFail(ip);
    // SameSite=Strict بدل Lax — والكوكي Secure بس لما الطلب جه على TLS
    // (ورا reverse proxy: X-Forwarded-Proto: https).
    const secure = secureCookieFlag(req);
    res.writeHead(302, { 'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`, Location: '/' });
    return res.end();
  }

  /* ============ مسارات المستخدم الافتراضية (ربط البوت والتحكم بالكود المحفوظ) ============ */
  if (req.method === 'POST' && url.pathname === '/api/public/sub/pair') {
    const blocked = loginBlocked(`subpair:${ip}`);
    if (blocked) return sendJson(res, 429, { ok: false, error: 'محاولات كثيرة، انتظر ' + blocked + ' ثانية' });
    const { json } = await readBody(req);
    const result = await requestSubBotPairing(json?.phone, { subBots: global.subBots, isAdmin: false });
    if (!result.ok && !result.controlCode) {
      registerFail(`subpair:${ip}`);
      return sendJson(res, result.statusCode || 400, result);
    }
    resetFail(`subpair:${ip}`);
    const secure = secureCookieFlag(req);
    const tok = makeSubCookie(result.phone);
    res.writeHead(200, {
      'Set-Cookie': `sub_tok=${tok}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify(result));
  }

  if (req.method === 'POST' && url.pathname === '/api/public/sub/auth') {
    const blocked = loginBlocked(`subauth:${ip}`);
    if (blocked) return sendJson(res, 429, { ok: false, error: 'محاولات كثيرة، انتظر ' + blocked + ' ثانية' });
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
    return res.end(JSON.stringify({ ok: true, bot: serializeSubBot(v.phone, global.subBots) }));
  }

  if (url.pathname.startsWith('/api/public/sub/')) {
    const subPhone = verifySubCookie(cookies.sub_tok);
    if (req.method === 'GET' && url.pathname === '/api/public/sub/me') {
      if (!subPhone) {
        return sendJson(res, 200, { ok: false, authenticated: false, bot: null });
      }
      return sendJson(res, 200, { ok: true, authenticated: true, bot: serializeSubBot(subPhone, global.subBots) });
    }
    if (!subPhone) {
      return sendJson(res, 401, { ok: false, error: 'أدخل رقمك والكود المحفوظ أولاً للتحكم في بوتك' });
    }
    if (req.method === 'POST' && url.pathname === '/api/public/sub/settings') {
      const { json } = await readBody(req);
      const upd = updateSubBotSettings(subPhone, json || {}, global.subBots);
      return sendJson(res, upd.ok ? 200 : 400, upd);
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
        return res.end(JSON.stringify({ ok: true, message: 'تم إغلاق جلسة البوت من هذا المتصفح' }));
      }
      if (!['reconnect', 'regenerate-code', 'unlink', 'pause', 'resume'].includes(act)) {
        return sendJson(res, 400, { ok: false, error: 'إجراء غير مسموح' });
      }
      const resAct = await controlSubBot(subPhone, act, {}, global.subBots);
      return sendJson(res, resAct.ok ? 200 : 400, resAct);
    }
    return sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
  }

  // كل ما بعد كده يحتاج تسجيل دخول الأدمن
  if (!authed) {
    if (url.pathname.startsWith('/api/')) return sendJson(res, 401, { ok: false, message: 'غير مصرح' });
    res.writeHead(302, { Location: '/' });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    if (state.qr && state.qrCacheFor !== state.qr) {
      try {
        const mod = await import('qrcode');
        const QR = mod.default || mod;
        state.qrDataUrl = await QR.toDataURL(state.qr, { margin: 1, width: 320 });
        state.qrCacheFor = state.qr;
      } catch (e) {
        state.qrDataUrl = null;
      }
    }
    return sendJson(res, 200, getClientInfo(client));
  }

  if (req.method === 'GET' && url.pathname === '/api/commands') {
    const all = normalizeCommandsList(client);
    const catMap = new Map();
    for (const c of all) {
      const prev = catMap.get(c.category) || { id: c.category, label: c.categoryLabel, emoji: c.categoryEmoji, count: 0 };
      prev.count += 1;
      catMap.set(c.category, prev);
    }
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const cat = (url.searchParams.get('cat') || '').trim();
    const filtered = all.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (!q) return true;
      return c.primary.toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.categoryLabel.toLowerCase().includes(q)
        || c.triggers.some((t) => String(t).toLowerCase().includes(q));
    });
    return sendJson(res, 200, {
      ok: true,
      total: all.length,
      filtered: filtered.length,
      categories: [...catMap.values()].sort((a, b) => b.count - a.count),
      commands: filtered
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/simulate') {
    const { json } = await readBody(req);
    const input = String(json?.input || '');
    if (!input.trim() || input.length > 1000) {
      return sendJson(res, 400, { ok: false, error: 'اكتب أمراً صالحاً (أقل من 1000 حرف)' });
    }
    const result = await simulateCommand(client, input);
    return sendJson(res, 200, result);
  }

  /* ============ مسارات الأدمن: إدارة البوتات والإعدادات وتوليد كلمة السر ============ */
  if (req.method === 'GET' && url.pathname === '/api/admin/bots') {
    const fleet = getBotFleetOverview(client, global.subBots, computeConnected(client));
    return sendJson(res, 200, { ok: true, ...fleet });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/main-settings') {
    const { json } = await readBody(req);
    const updated = updateMainBotSettings(client, json || {});
    pushEvent('تحديث إعدادات البوت الرئيسي من لوحة الأدمن');
    return sendJson(res, 200, { ok: true, settings: updated, message: 'تم حفظ وتطبيق إعدادات البوت الرئيسي' });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/bot-control') {
    const { json } = await readBody(req);
    const action = String(json?.action || '');
    const phone = normalizePhone(json?.phone);

    if (action === 'add-sub') {
      const r = await requestSubBotPairing(json?.phone, { subBots: global.subBots, isAdmin: true });
      pushEvent(`طلب الأدمن ربط بوت فرعي: ${r.phone || json?.phone}`);
      return sendJson(res, r.ok || r.controlCode ? 200 : 400, r);
    }

    if (action === 'approve' || action === 'deny') {
      if (!phone) return sendJson(res, 400, { ok: false, error: 'رقم الهاتف غير صالح' });
      global.db = global.db || {};
      const allow = (global.db.subPairAllow = global.db.subPairAllow || {});
      if (action === 'approve') {
        allow[phone] = { at: Date.now(), by: 'web-admin' };
        pushEvent(`الأدمن أضاف الرقم ${phone} لقائمة سماح التنصيب`);
        return sendJson(res, 200, { ok: true, message: `تم السماح للرقم ${phone}` });
      }
      delete allow[phone];
      pushEvent(`الأدمن أزال الرقم ${phone} من قائمة سماح التنصيب`);
      return sendJson(res, 200, { ok: true, message: `تمت إزالة ${phone} من قائمة السماح` });
    }

    if (action === 'update-settings') {
      if (!phone) return sendJson(res, 400, { ok: false, error: 'رقم الهاتف غير صالح' });
      const upd = updateSubBotSettings(phone, json?.settings || {}, global.subBots);
      pushEvent(`الأدمن عدّل إعدادات البوت الفرعي ${phone}`);
      return sendJson(res, upd.ok ? 200 : 400, { ...upd, message: 'تم تحديث إعدادات البوت بنجاح' });
    }

    if (!phone) return sendJson(res, 400, { ok: false, error: 'رقم الهاتف غير صالح' });
    const resAct = await controlSubBot(phone, action, json || {}, global.subBots);
    pushEvent(`تنفيذ إجراء (${action}) على البوت الفرعي ${phone}`);
    return sendJson(res, resAct.ok ? 200 : 400, resAct);
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/rotate-password') {
    const nextPass = generatePassword(16);
    panelCfg.password = nextPass;
    panelCfg.pwHash = crypto.createHash('sha256').update(nextPass).digest('hex');
    panelCfg.rev = (Number(panelCfg.rev) || 0) + 1;
    savePanelConfig(panelCfg);
    pushEvent('تم توليد كلمة سر عشوائية جديدة للوحة الأدمن');
    const secure = secureCookieFlag(req);
    res.writeHead(200, {
      'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Strict${secure}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify({ ok: true, password: nextPass, message: 'تم توليد كلمة سر عشوائية جديدة' }));
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const { json } = await readBody(req);
    const action = json?.action;
    try {
      switch (action) {
        case 'logout':
          // خروج من كل الأجهزة: نرفع عدّاد rev — أي كوكي اتصدر قبل كده بيرفض
          // فورًا حتى لو لسه صالح في الوقت. كوكي المتصفح الحالي بيتصفّر كمان.
          panelCfg.rev = (Number(panelCfg.rev) || 0) + 1;
          savePanelConfig(panelCfg);
          pushEvent('خروج من كل الجلسات — عدّاد rev بقا ' + panelCfg.rev);
          res.writeHead(200, { 'Set-Cookie': 'pw=; HttpOnly; Path=/; Max-Age=0', 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, message: 'تم الخروج — كل الجلسات اتلغت' }));

        case 'restart':
          pushEvent('طلب إعادة تشغيل من اللوحة');
          state.stopped = false;
          sendJson(res, 200, { ok: true, message: 'جاري إعادة التشغيل...' });
          setTimeout(() => {
            if (typeof global.restartBot === 'function') global.restartBot('لوحة التحكم');
            else pushEvent('تعذّر إعادة التشغيل: المسار المركزي غير متاح');
          }, 600);
          return;

        case 'stop':
          pushEvent('طلب إيقاف من اللوحة');
          await client.stop?.();
          state.stopped = true; // الـ watchdog ميعملش restart للبوت الموقوف عمدًا
          return sendJson(res, 200, { ok: true, message: 'تم إيقاف البوت' });

        case 'start':
          pushEvent('طلب تشغيل من اللوحة');
          state.stopped = false;
          client.start?.().catch(() => {});
          return sendJson(res, 200, { ok: true, message: 'جاري تشغيل البوت...' });

        case 'reset-session': {
          pushEvent('طلب تصفير الجلسة من اللوحة');
          const sp = sessionPathOf(client);
          if (!isSafeSessionPath(sp)) {
            return sendJson(res, 400, { ok: false, message: 'مسار الجلسة غير آمن — تم إلغاء التصغير' });
          }
          // مفيش جلسة أصلًا → مفيش حاجة تتنقل ولا إعادة تشغيل (ومفيش unlink أبدًا)
          if (!fs.existsSync(sp)) {
            pushEvent('مفيش جلسة موجودة — مفيش حاجة تتصفّر');
            return sendJson(res, 200, { ok: false, message: 'لا توجد جلسة لحذفها' });
          }
          markPendingRestart('تصفير الجلسة');
          sendJson(res, 200, { ok: true, message: 'تم نقل الجلسة. أعد التشغيل جارٍ...', pendingRestart: true });
          setTimeout(() => {
            void (async () => {
              try { await client.stop?.(); } catch {}
              // نقل (rename) مش حذف: الجلسة القديمة بتتحفظ كنسخة احتياطية
              // session.bak-<timestamp> — ممنوع unlink وممنوع مسح النسخة.
              let bak = `${sp}.bak-${Date.now()}`;
              let n = 0;
              while (fs.existsSync(bak)) { n += 1; bak = `${sp}.bak-${Date.now()}-${n}`; }
              try {
                fs.renameSync(sp, bak);
                pushEvent('تم نقل الجلسة القديمة إلى ' + path.basename(bak) + ' — مفيش حاجة اتحذفت');
              } catch (e) {
                pushEvent('تعذّر نقل الجلسة — تم إلغاء التصفير: ' + (e?.message || e));
                return; // من غير نقل مفيش تصفير — وما نخرجش والجلسة القديمة مكانها
              }
              state.stopped = false;
              await requestCleanRestart('تصفير الجلسة');
            })().catch((e) => pushEvent('خطأ في تصفير الجلسة: ' + (e?.message || e)));
          }, 500);
          return;
        }

        case 'send': {
          // تحقق صارم: الرقم أرقام بس بطول منطقي، والنص محدود، ومفيش فيض سبام
          if (!computeConnected(client)) {
            return sendJson(res, 400, { ok: false, message: 'البوت غير متصل' });
          }
          const to = String(json?.to || '').replace(/[^0-9]/g, '');
          const text = String(json?.text || '');
          if (!/^\d{7,15}$/.test(to)) return sendJson(res, 400, { ok: false, message: 'رقم واتساب غير صالح' });
          if (!text || !text.trim()) return sendJson(res, 400, { ok: false, message: 'رقم أو نص ناقص' });
          if (text.length > 4096) return sendJson(res, 400, { ok: false, message: 'النص أطول من الحد المسموح (4096)' });
          if (sendBlocked(ip)) return sendJson(res, 429, { ok: false, message: 'رسائل كتير — انتظر دقيقة' });
          bumpSendCount(ip);
          await client.sock.sendMessage(`${to}@s.whatsapp.net`, { text });
          return sendJson(res, 200, { ok: true, message: 'تم إرسال الرسالة' });
        }

        case 'set-login': {
          const loginMode = json?.loginMode === 'qr' ? 'qr' : 'code';
          const phone = String(json?.phone || '').replace(/[^0-9]/g, '');
          panelCfg.loginMode = loginMode;
          panelCfg.phone = phone;
          savePanelConfig(panelCfg);
          pushEvent('تغيير طريقة الربط إلى: ' + loginMode + (phone ? ' — رقم ' + phone : ''));
          // الإعداد اتكتب في panel-config.json — والإقلاع الجديد هو اللي بيقراه
          // وبيطبّقه (config.printQR / phoneNumber). global.restartBot مش كافي:
          // إعادة تشغيل داخلية مش بتحمّل الإس كي موديولز من تاني.
          markPendingRestart('تغيير إعدادات الربط');
          sendJson(res, 200, { ok: true, message: 'تم الحفظ. أعد التشغيل جارٍ...', pendingRestart: true });
          setTimeout(() => { void requestCleanRestart('تغيير إعدادات الربط'); }, 500);
          return;
        }

        default:
          return sendJson(res, 400, { ok: false, message: 'أمر غير معروف' });
      }
    } catch (e) {
      pushEvent('خطأ في تنفيذ ' + action + ': ' + e.message);
      return sendJson(res, 500, { ok: false, message: 'خطأ: ' + e.message });
    }
  }

  return sendHtml(res, 404, '<h3 style="font-family:sans-serif">404</h3>');
}

/* ============ التشغيل ============ */
export function startWebPanel(client, options = {}) {
  panelCfg = readPanelConfig();
  if (options.password) panelCfg.password = options.password;

  hookConsole();

  const port = options.port !== undefined
    ? Number(options.port)
    : (Number(process.env.WEB_PORT || process.env.PORT || process.env.SERVER_PORT || process.env.P_SERVER_PORT) || 3000);
  const host = options.host || '0.0.0.0';

  const server = http.createServer((req, res) => {
    handle(req, res, client).catch((e) => {
      console.error('⚠️ [WEB] خطأ:', e.message);
      try { sendJson(res, 500, { ok: false, message: 'خطأ داخلي' }); } catch {}
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`❌ [WEB] المنفذ ${port} مستخدم بالفعل. غيّره بـ WEB_PORT`);
    else console.error('❌ [WEB] خطأ في السيرفر:', e.message);
  });

  server.listen(port, host, () => {
    console.log(`\n🌐 [WEB] لوحة التحكم شغالة على: http://${host}:${port}`);
    // ممنوع نطبع كلمة السر في stdout — اللوج بيتخزن وبيتشارك. بنكتفى بمسار
    // الملف (نفس الصيغة المطلوبة: 🔑 كلمة السر محفوظة في system/panel-config.json)
    const cfgPath = configFilePath();
    const cfgRel = path.isAbsolute(cfgPath) ? path.relative(process.cwd(), cfgPath) : cfgPath;
    console.log(`   🔑 كلمة السر محفوظة في ${cfgRel || cfgPath} (مش بتتطبع في اللوج لأسباب أمنية)`);
    console.log(`   طريقة الربط الحالية: ${panelCfg.loginMode}\n`);
    pushEvent('تم تشغيل لوحة التحكم على المنفذ ' + port);
  });

  // نتأكد من ربط مستمع QR بأي سوكيت جديد
  const watcher = setInterval(() => attachSock(client), 800);

  // حالة الربط ليها صلاحية 3 دقايق — من غير فحص كده الـ flag القديم بيفضل
  // true للأبد والـ watchdog يفضل متسلّح. هنا بنقفلها أول ما تنتهي صلاحيتها
  // (من غير ما نلمس الجلسة خالص).
  const pairingTimer = setInterval(() => {
    const now = Date.now();
    if (!pairingState.expired(now)) return;
    pairingState.clear();
    pushEvent('انتهت صلاحية حالة الربط — رجع الحارس يشتغل');
  }, 15 * 1000);

  server.on('close', () => { clearInterval(watcher); clearInterval(pairingTimer); });

  return server;
}

export default startWebPanel;

// pushEvent مُصدَّر من برة كمان: subsystems تانية (زي حماية الجلسة) تبعت
// تحذيراتها للوحة كـ event حقيقي، مش مجرد سطر لوج. كلها بتترحّل لناقل
// الأحداث المشترك (system/events.js).
export { pushEvent, selectErrors };
