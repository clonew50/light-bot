/**
 * webPanel.js — لوحة تحكم ويب للبوت
 * ---------------------------------------------------
 * بتشتغل مع البوت على البانل، بتفتح صفحة ويب تقدر منها:
 *   - تعمل تنصيب (ربط) البوت بواتساب: QR أو كود ربط
 *   - تتحكم في البوت: إعادة تشغيل / إيقاف / تشغيل / تصفير الجلسة
 *   - تشوف الحالة والأخطاء وترسل رسالة
 *
 * الدخول بكلمة سر (الافتراضي: winner) — تقدر تغيّرها من WEB_PASSWORD أو من اللوحة.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'panel-config.json');

/* ============ إعدادات محفوظة ============ */
const DEFAULT_CONFIG = {
  password: process.env.WEB_PASSWORD || 'winner',
  loginMode: 'code', // code = كود ربط | qr = رمز QR
  phone: '',         // رقم البوت (اختياري، يملأ config.phoneNumber)
  secret: ''         // مفتاح توقيع الكوكيز (يتم توليده)
};

export function readPanelConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (e) {
    console.error('⚠️ [WEB] تعذّر قراءة panel-config.json:', e.message);
  }
  if (process.env.WEB_PASSWORD) cfg.password = process.env.WEB_PASSWORD;
  if (!cfg.secret) {
    cfg.secret = crypto.randomBytes(32).toString('hex');
    savePanelConfig(cfg);
  }
  return cfg;
}

export function savePanelConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
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
  events: [],
  lastConnected: null
};

function pushEvent(msg) {
  const line = `[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`;
  state.events.unshift(line);
  if (state.events.length > 40) state.events.pop();
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
        pushEvent('تم إصدار كود ربط: ' + m[1]);
      }
    } catch {}
    return orig(...args);
  };
}

/* ============ ربط مستمع الـ QR/الاتصال بجلسة واتساب ============ */
let attachedSock = null;
function onConnUpdate(update) {
  try {
    const { connection, qr } = update || {};
    if (qr) {
      state.qr = qr;
      state.qrAt = Date.now();
      state.qrDataUrl = null;
      state.qrCacheFor = null;
      state.pairingCode = null;
      pushEvent('QR جديد جاهز للاسكان');
    }
    if (connection) {
      pushEvent('حالة الاتصال: ' + connection);
      if (connection === 'open') {
        state.qr = null;
        state.pairingCode = null;
        state.lastConnected = Date.now();
      }
    }
  } catch (e) {
    pushEvent('خطأ في قراءة حالة الاتصال: ' + e.message);
  }
}

function attachSock(client) {
  const sock = client?.sock;
  if (!sock || sock === attachedSock) return;
  if (attachedSock?.ev) {
    try { attachedSock.ev.removeListener('connection.update', onConnUpdate); } catch {}
  }
  attachedSock = sock;
  try { sock.ev.on('connection.update', onConnUpdate); } catch (e) { pushEvent('تعذّر ربط السوكيت: ' + e.message); }
}

/* ============ أدوات مساعدة ============ */
function sessionPathOf(client) {
  return path.resolve(process.cwd(), client?.config?.sessionPath || './session');
}

function sessionRegistered(client) {
  try {
    const p = path.join(sessionPathOf(client), 'creds.json');
    if (!fs.existsSync(p)) return false;
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    return !!(creds?.registered || creds?.me);
  } catch { return false; }
}

function getClientInfo(client) {
  let commands = 0, errors = [];
  try { commands = client.getAllCommands?.().length || 0; } catch {}
  try { errors = client.errors?.() || []; } catch {}
  const mem = process.memoryUsage();
  return {
    connected: (() => { try { return !!client.isConnected?.(); } catch { return false; } })(),
    phone: client?.config?.phoneNumber || '',
    name: client?.config?.info?.nameBot || 'البوت',
    commands,
    errors: errors.slice(-15).reverse(),
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
    sessionRegistered: sessionRegistered(client),
    sessionPath: sessionPathOf(client),
    qr: state.qr ? state.qrDataUrl : null,
    pairingCode: state.pairingCode,
    loginMode: panelCfg.loginMode,
    configuredPhone: panelCfg.phone || client?.config?.phoneNumber || '',
    events: state.events.slice(0, 20)
  };
}

/* ============ الحماية ============ */
function sign(value) {
  return crypto.createHmac('sha256', panelCfg.secret).update(value).digest('hex');
}
function makeCookie(days = 30) {
  const exp = Date.now() + days * 86400000;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}
function verifyCookie(cookie) {
  if (!cookie) return false;
  const [payload, sig] = cookie.split('.');
  if (!payload || !sig) return false;
  const expect = sign(payload);
  if (sig.length !== expect.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  return Number(payload) > Date.now();
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
function loginBlocked(ip) {
  const a = attempts.get(ip);
  if (a && a.until > Date.now() && a.count >= 8) return Math.ceil((a.until - Date.now()) / 1000);
  return 0;
}
function registerFail(ip) {
  const a = attempts.get(ip) || { count: 0, until: 0 };
  a.count += 1;
  a.until = Date.now() + 5 * 60000;
  if (a.count >= 8) a.count = 8;
  attempts.set(ip, a);
}
function resetFail(ip) { attempts.delete(ip); }

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

/* ============ HTML ============ */
const LOGIN_HTML = (err) => `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>دخول لوحة التحكم</title>
<style>
*{box-sizing:border-box;font-family:system-ui,'Segoe UI',Tahoma,sans-serif}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:linear-gradient(135deg,#0f172a,#1e293b);color:#e2e8f0}
.card{width:min(92vw,380px);background:#111827;border:1px solid #1f2937;border-radius:18px;
padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.5)}
h1{margin:0 0 6px;font-size:22px;text-align:center}
p.sub{margin:0 0 20px;text-align:center;color:#94a3b8;font-size:13px}
input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid #334155;background:#0b1220;
color:#e2e8f0;font-size:16px;outline:none}
input:focus{border-color:#38bdf8}
button{width:100%;margin-top:14px;padding:13px;border:0;border-radius:12px;cursor:pointer;
background:#38bdf8;color:#04283a;font-weight:700;font-size:16px}
button:active{transform:scale(.99)}
.err{margin-top:14px;background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;padding:10px;
border-radius:10px;font-size:13px;text-align:center}
.note{margin-top:16px;color:#64748b;font-size:12px;text-align:center}
</style></head>
<body>
<form class="card" method="POST" action="/login">
  <h1>🔐 لوحة تحكم البوت</h1>
  <p class="sub">اكتب كلمة السر للدخول</p>
  <input type="password" name="password" placeholder="كلمة السر" autofocus required>
  <button type="submit">دخول</button>
  ${err ? `<div class="err">${err}</div>` : ''}
  <div class="note">الافتراضي: winner (يمكن تغييرها بـ WEB_PASSWORD)</div>
</form>
</body></html>`;

const PANEL_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة تحكم البوت</title>
<style>
*{box-sizing:border-box;font-family:system-ui,'Segoe UI',Tahoma,sans-serif}
body{margin:0;background:#0b1220;color:#e2e8f0;padding:16px}
.wrap{max-width:960px;margin:0 auto}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{font-size:20px;margin:0}
.badge{padding:6px 12px;border-radius:999px;font-size:13px;font-weight:700}
.on{background:#052e1a;color:#4ade80;border:1px solid #14532d}
.off{background:#3f1d1d;color:#fca5a5;border:1px solid #7f1d1d}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:16px}
.card h2{margin:0 0 12px;font-size:15px;color:#93c5fd;display:flex;gap:8px;align-items:center}
.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #1f2937;font-size:14px}
.row:last-child{border-bottom:0}
.row span:first-child{color:#94a3b8}
button{border:0;border-radius:10px;padding:10px 12px;cursor:pointer;font-weight:600;font-size:14px;background:#1f2937;color:#e2e8f0}
button:hover{background:#334155}
button.pri{background:#38bdf8;color:#04283a}
button.warn{background:#f59e0b;color:#3b2100}
button.danger{background:#ef4444;color:#fff}
button.ghost{background:transparent;border:1px solid #334155}
.actions{display:flex;flex-wrap:wrap;gap:10px}
input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;margin-bottom:10px}
.qrbox{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.qrbox img{width:min(100%,280px);background:#fff;padding:10px;border-radius:14px}
.code{font-size:30px;font-weight:800;letter-spacing:3px;color:#4ade80;direction:ltr;text-align:center;
background:#052e1a;border:1px solid #14532d;border-radius:12px;padding:14px;margin:8px 0}
.hint{color:#94a3b8;font-size:13px;line-height:1.7}
.log{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#a5b4fc;
max-height:190px;overflow:auto;background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;white-space:pre-wrap}
.err-item{background:#2a1414;border:1px solid #7f1d1d;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:13px}
.msg{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#052e1a;border:1px solid #14532d;
color:#86efac;padding:10px 16px;border-radius:12px;font-size:14px;opacity:0;transition:.3s;pointer-events:none}
.msg.show{opacity:1}
small.t{color:#475569}
</style></head>
<body>
<div class="wrap">
  <header>
    <h1>🩸 لوحة تحكم البوت</h1>
    <div style="display:flex;gap:8px;align-items:center">
      <span id="badge" class="badge off">…</span>
      <button class="ghost" onclick="doAction('logout')">خروج</button>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <h2>📊 الحالة</h2>
      <div class="row"><span>الاتصال</span><b id="s-conn">…</b></div>
      <div class="row"><span>رقم البوت</span><b id="s-phone">…</b></div>
      <div class="row"><span>الجلسة مُسجّلة</span><b id="s-session">…</b></div>
      <div class="row"><span>عدد الأوامر</span><b id="s-cmds">…</b></div>
      <div class="row"><span>الذاكرة</span><b id="s-mem">…</b></div>
      <div class="row"><span>مدة التشغيل</span><b id="s-up">…</b></div>
    </div>

    <div class="card" id="installCard">
      <h2>🔗 تنصيب / ربط واتساب</h2>
      <div id="installBody"></div>
    </div>

    <div class="card">
      <h2>🎛️ التحكم</h2>
      <div class="actions">
        <button class="pri" onclick="doAction('restart')">♻️ إعادة تشغيل</button>
        <button class="warn" onclick="doAction('stop')">⏹️ إيقاف</button>
        <button onclick="doAction('start')">▶️ تشغيل</button>
        <button class="danger" onclick="resetSession()">🗑️ تصفير الجلسة</button>
      </div>
      <h2 style="margin-top:16px">✉️ إرسال رسالة</h2>
      <input id="msgTo" placeholder="رقم واتساب مثال: 2010xxxxxxx">
      <input id="msgText" placeholder="نص الرسالة">
      <button class="pri" onclick="sendMsg()">إرسال</button>
    </div>

    <div class="card">
      <h2>📝 سجل الأحداث</h2>
      <div class="log" id="log">…</div>
    </div>

    <div class="card">
      <h2>⚠️ آخر الأخطاء</h2>
      <div id="errors"><small class="t">لا يوجد</small></div>
    </div>
  </div>
</div>
<div class="msg" id="msg"></div>

<script>
function toast(t){const m=document.getElementById('msg');m.textContent=t;m.classList.add('show');setTimeout(()=>m.classList.remove('show'),2500);}
function fmt(s){s=Math.floor(s);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return (d?d+'ي ':'')+(h?h+'س ':'')+m+'د';}
let lastQr=null;
async function refresh(){
  try{
    const r=await fetch('/api/status');if(r.status===401){location.reload();return;}
    const d=await r.json();
    const b=document.getElementById('badge');
    b.textContent=d.connected?'متصل ✅':'غير متصل ❌';
    b.className='badge '+(d.connected?'on':'off');
    document.getElementById('s-conn').textContent=d.connected?'مفتوح':'مغلق';
    document.getElementById('s-phone').textContent=d.phone||'—';
    document.getElementById('s-session').textContent=d.sessionRegistered?'نعم':'لا';
    document.getElementById('s-cmds').textContent=d.commands;
    document.getElementById('s-mem').textContent=d.memoryMB+' MB';
    document.getElementById('s-up').textContent=fmt(d.uptimeSec);
    document.getElementById('log').textContent=(d.events||[]).join('\\n')||'—';
    const eb=document.getElementById('errors');
    eb.innerHTML=(d.errors&&d.errors.length)?d.errors.map(e=>'<div class="err-item"><b>'+esc(e.command||'')+'</b><br>'+esc((e.error||'').slice(0,200))+'<br><small class="t">'+esc(e.time||'')+'</small></div>').join(''):'<small class="t">لا يوجد</small>';
    renderInstall(d);
  }catch(e){}
}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function renderInstall(d){
  const box=document.getElementById('installBody');
  if(d.connected){
    box.innerHTML='<div class="hint">✅ البوت متصل بواتساب بالفعل.<br>لو عايز تربطه برقم تاني اضغط <b>تصفير الجلسة</b> ثم أعد التنصيب.</div>';
    return;
  }
  let html='';
  if(d.pairingCode){
    html+='<div class="hint">افتح واتساب → الأجهزة المرتبطة → الربط برقم الهاتف، واكتب الكود:</div><div class="code">'+esc(d.pairingCode)+'</div>';
  }
  if(d.qr){
    html+='<div class="qrbox"><div class="hint">امسح رمز QR من واتساب (الأجهزة المرتبطة → ربط جهاز):</div><img src="'+d.qr+'" alt="QR"></div>';
  }
  if(!d.pairingCode && !d.qr){
    html+='<div class="hint">⏳ في انتظار صدور QR / كود الربط... (قد يستغرق ثوانٍ)</div>';
  }
  html+='<div style="margin-top:14px">'
     +'<label class="hint">طريقة الربط</label>'
     +'<select id="lm"><option value="code"'+(d.loginMode==='code'?' selected':'')+'>كود ربط (برقم الهاتف)</option>'
     +'<option value="qr"'+(d.loginMode==='qr'?' selected':'')+'>رمز QR</option></select>'
     +'<label class="hint">رقم البوت</label>'
     +'<input id="ph" value="'+esc(d.configuredPhone)+'" placeholder="2010xxxxxxx">'
     +'<div class="actions"><button class="pri" onclick="applyLogin()">حفظ وإعادة التشغيل</button>'
     +'<button class="ghost" onclick="refresh()">🔄 تحديث</button></div></div>';
  box.innerHTML=html;
}
async function applyLogin(){
  const loginMode=document.getElementById('lm').value;
  const phone=document.getElementById('ph').value.trim();
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'set-login',loginMode,phone})});
  const d=await r.json();toast(d.message||'تم');
  setTimeout(refresh,1500);
}
async function doAction(a){
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a})});
  const d=await r.json();toast(d.message||'تم');
  if(a==='logout'){setTimeout(()=>location.reload(),800);return;}
  setTimeout(refresh,1500);
}
async function resetSession(){
  if(!confirm('سيتم حذف الجلسة وإعادة التنصيب من جديد. متأكد؟'))return;
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset-session'})});
  const d=await r.json();toast(d.message||'تم');setTimeout(refresh,2500);
}
async function sendMsg(){
  const to=document.getElementById('msgTo').value.trim();
  const text=document.getElementById('msgText').value.trim();
  if(!to||!text){toast('اكتب الرقم والنص');return;}
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',to,text})});
  const d=await r.json();toast(d.message||'تم');
}
refresh();setInterval(refresh,3000);
</script>
</body></html>`;

/* ============ معالجة الطلبات ============ */
let panelCfg;

async function handle(req, res, client) {
  const ip = req.socket.remoteAddress || 'x';
  const url = new URL(req.url, 'http://localhost');
  const cookies = parseCookies(req);
  const authed = verifyCookie(cookies.pw);

  // صفحة تسجيل الدخول
  if (req.method === 'GET' && url.pathname === '/') {
    if (authed) return sendHtml(res, 200, PANEL_HTML);
    return sendHtml(res, 200, LOGIN_HTML(''));
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const blocked = loginBlocked(ip);
    if (blocked) return sendHtml(res, 429, LOGIN_HTML('محاولات كثيرة، انتظر ' + blocked + ' ثانية'));
    const { json, form } = await readBody(req);
    const pass = (json?.password ?? form?.password ?? '').toString();
    const ok = pass.length === panelCfg.password.length &&
      crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(panelCfg.password));
    if (!ok) {
      registerFail(ip);
      return sendHtml(res, 401, LOGIN_HTML('كلمة السر غلط'));
    }
    resetFail(ip);
    res.writeHead(302, { 'Set-Cookie': `pw=${makeCookie()}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`, Location: '/' });
    return res.end();
  }

  // كل ما بعد كده يحتاج تسجيل دخول
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

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const { json } = await readBody(req);
    const action = json?.action;
    try {
      switch (action) {
        case 'logout':
          res.writeHead(200, { 'Set-Cookie': 'pw=; HttpOnly; Path=/; Max-Age=0', 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, message: 'تم الخروج' }));

        case 'restart':
          pushEvent('طلب إعادة تشغيل من اللوحة');
          sendJson(res, 200, { ok: true, message: 'جاري إعادة التشغيل...' });
          setTimeout(() => {
            if (typeof global.restartBot === 'function') global.restartBot('لوحة التحكم');
            else client.restart?.();
          }, 600);
          return;

        case 'stop':
          pushEvent('طلب إيقاف من اللوحة');
          await client.stop?.();
          return sendJson(res, 200, { ok: true, message: 'تم إيقاف البوت' });

        case 'start':
          pushEvent('طلب تشغيل من اللوحة');
          client.start?.().catch(() => {});
          return sendJson(res, 200, { ok: true, message: 'جاري تشغيل البوت...' });

        case 'reset-session': {
          pushEvent('طلب تصفير الجلسة من اللوحة');
          const sp = sessionPathOf(client);
          sendJson(res, 200, { ok: true, message: 'تم تصفير الجلسة، جاري إعادة التشغيل...' });
          setTimeout(async () => {
            try { await client.stop?.(); } catch {}
            try { fs.rmSync(sp, { recursive: true, force: true }); } catch (e) { pushEvent('تعذّر حذف الجلسة: ' + e.message); }
            if (typeof global.restartBot === 'function') global.restartBot('تصفير الجلسة');
          }, 600);
          return;
        }

        case 'send': {
          const to = String(json?.to || '').replace(/[^0-9]/g, '');
          const text = String(json?.text || '');
          if (!to || !text) return sendJson(res, 400, { ok: false, message: 'رقم أو نص ناقص' });
          if (!client.sock) return sendJson(res, 400, { ok: false, message: 'البوت غير متصل' });
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
          sendJson(res, 200, { ok: true, message: 'تم الحفظ، جاري إعادة التشغيل...' });
          setTimeout(() => {
            if (typeof global.restartBot === 'function') global.restartBot('تغيير إعدادات الربط');
            else client.restart?.();
          }, 700);
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

  const port = Number(options.port || process.env.WEB_PORT || process.env.PORT || process.env.SERVER_PORT || process.env.P_SERVER_PORT) || 3732;
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
    console.log(`   كلمة السر: ${panelCfg.password === 'winner' ? 'winner (افتراضية)' : '********'}`);
    console.log(`   طريقة الربط الحالية: ${panelCfg.loginMode}\n`);
    pushEvent('تم تشغيل لوحة التحكم على المنفذ ' + port);
  });

  // نتأكد من ربط مستمع QR بأي سوكيت جديد
  const watcher = setInterval(() => attachSock(client), 800);
  server.on('close', () => clearInterval(watcher));

  return server;
}

export default startWebPanel;
