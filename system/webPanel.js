/**
 * webPanel.js — لوحة تحكم ويب للبوت (Elaina-Multidevice)
 * ======================================================
 * لوحة ويب بتشتغل جوه عملية البوت (worker) فبتقدر تقرأ حالة الاتصال
 * (global.conn) وتبعت رسائل وتعيد التشغيل.
 *
 * الميزات:
 *   - دخول بكلمة سر (كوكي موقّع بـ HMAC) — الافتراضي: winner
 *   - ربط البوت بواتساب: كود ربط (برقم) أو QR
 *   - عرض الحالة: متصل / كود الربط / QR / اسم البوت / عدد البلجنز / uptime / الكوميت
 *   - إعادة تشغيل / تصفير الجلسة / إرسال رسالة
 *   - فحص وتطبيق التحديثات من الريبو (system/autoUpdate.mjs)
 *   - سجل أحداث مباشر
 *
 * الإعدادات بتتحفظ في system/panel-config.json (كلمة السر، طريقة الربط، الرقم).
 * المتغيرات البيئية: WEB_PASSWORD, PANEL_CONFIG_FILE, WEB_PORT/PORT/SERVER_PORT/P_SERVER_PORT.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { checkUpdate, applyUpdate } from './autoUpdate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = process.env.PANEL_CONFIG_FILE || path.join(__dirname, 'panel-config.json');
const DEFAULT_PASSWORD = process.env.WEB_PASSWORD || 'winner';

/* ----------------------------- الإعدادات ----------------------------- */
function loadCfg() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
	} catch {
		return {};
	}
}
function saveCfg(c) {
	fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
	const tmp = CONFIG_FILE + '.tmp-' + process.pid;
	fs.writeFileSync(tmp, JSON.stringify(c, null, 2));
	fs.renameSync(tmp, CONFIG_FILE);
}
function getSecret() {
	const c = loadCfg();
	if (!c.secret) {
		c.secret = crypto.randomBytes(16).toString('hex');
		saveCfg(c);
	}
	return c.secret;
}
export function readPanelConfig() {
	const c = loadCfg();
	return {
		password: c.password || DEFAULT_PASSWORD,
		loginMode: c.loginMode === 'qr' ? 'qr' : 'code',
		phone: c.phone || '',
	};
}

/* ----------------------------- سجل الأحداث ----------------------------- */
const events = [];
export function pushPanelEvent(message) {
	const e = { t: Date.now(), message: String(message) };
	events.push(e);
	if (events.length > 100) events.shift();
	try {
		console.log('[PANEL]', message);
	} catch {}
}

/* ----------------------------- المصادقة ----------------------------- */
function sign(secret, val) {
	return crypto.createHmac('sha256', secret).update(val).digest('hex');
}
function makeToken(secret) {
	return sign(secret, 'panel-ok');
}
function checkAuth(req, secret) {
	const cookie = req.headers.cookie || '';
	const m = cookie.match(/(?:^|;\s*)panel=([^;]+)/);
	return !!m && m[1] === makeToken(secret);
}
function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (c) => (data += c));
		req.on('end', () => resolve(data));
		req.on('error', () => resolve(data));
	});
}
function json(res, code, obj, extraHeaders = {}) {
	res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
	res.end(JSON.stringify(obj));
}
function currentCommit() {
	try {
		const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.git-pull-state.json'), 'utf8'));
		return (s.commit || '').slice(0, 8) || 'unknown';
	} catch {
		return 'unknown';
	}
}

/* ----------------------------- الخادم ----------------------------- */
export function startWebPanel() {
	const secret = getSecret();
	const getState = () => global.__panelState || {};

	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, 'http://localhost');
			const p = url.pathname;

			if (p === '/' || p === '/index.html') {
				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(PAGE);
				return;
			}

			if (p === '/api/login' && req.method === 'POST') {
				let pw = '';
				try {
					pw = JSON.parse(await readBody(req)).password || '';
				} catch {}
				if (pw === readPanelConfig().password) {
					json(res, 200, { ok: true }, {
						'Set-Cookie': `panel=${makeToken(secret)}; Path=/; HttpOnly; SameSite=Lax`,
					});
				} else {
					json(res, 401, { ok: false, error: 'كلمة السر غلط' });
				}
				return;
			}

			// كل اللي تحت محتاج تسجيل دخول
			if (!checkAuth(req, secret)) {
				json(res, 401, { ok: false, error: 'auth' });
				return;
			}

			if (p === '/api/status' && req.method === 'GET') {
				const st = getState();
				const conn = global.conn;
				const connected = !!(conn && conn.user && st.connection === 'open');
				const isRegistered = !!(conn && conn.authState && conn.authState.creds && conn.authState.creds.registered);
				json(res, 200, {
					ok: true,
					connected,
					connection: st.connection || 'starting',
					isRegistered,
					pairingCode: st.pairingCode || null,
					qr: st.lastQR || null,
					phone: st.phone || '',
					mode: st.mode || 'code',
					botJid: (conn && conn.user && conn.user.id) || null,
					botName: (conn && conn.user && (conn.user.name || conn.user.verifiedName)) || global.namebot || 'Bot',
					plugins: Object.keys(global.plugins || {}).length,
					uptimeMs: Date.now() - (st.startedAt || Date.now()),
					commit: currentCommit(),
					events: events.slice(-40),
				});
				return;
			}

			if (p === '/api/pair' && req.method === 'POST') {
				let b = {};
				try {
					b = JSON.parse(await readBody(req));
				} catch {}
				const c = loadCfg();
				if (b.phone) c.phone = String(b.phone).replace(/[^0-9]/g, '');
				if (b.mode === 'qr' || b.mode === 'code') c.loginMode = b.mode;
				saveCfg(c);
				pushPanelEvent('تم حفظ إعدادات الربط — إعادة تشغيل');
				json(res, 200, { ok: true });
				setTimeout(() => global.restartBot && global.restartBot('panel-pair'), 800);
				return;
			}

			if (p === '/api/restart' && req.method === 'POST') {
				pushPanelEvent('طلب إعادة تشغيل من اللوحة');
				json(res, 200, { ok: true });
				setTimeout(() => global.restartBot && global.restartBot('panel-restart'), 600);
				return;
			}

			if (p === '/api/reset' && req.method === 'POST') {
				try {
					fs.rmSync(path.join(ROOT, 'sessions'), { recursive: true, force: true });
					pushPanelEvent('تم تصفير الجلسة — إعادة تشغيل');
				} catch (e) {
					pushPanelEvent('تعذّر تصفير الجلسة: ' + (e && e.message));
				}
				json(res, 200, { ok: true });
				setTimeout(() => global.restartBot && global.restartBot('panel-reset'), 600);
				return;
			}

			if (p === '/api/send' && req.method === 'POST') {
				let b = {};
				try {
					b = JSON.parse(await readBody(req));
				} catch {}
				const number = String(b.number || '').replace(/[^0-9]/g, '');
				const message = String(b.message || '');
				const conn = global.conn;
				if (!conn || !conn.user) return json(res, 400, { ok: false, error: 'البوت مش متصل' });
				if (!number || !message) return json(res, 400, { ok: false, error: 'رقم أو رسالة ناقصة' });
				try {
					await conn.sendMessage(number + '@s.whatsapp.net', { text: message });
					pushPanelEvent('تم إرسال رسالة إلى ' + number);
					json(res, 200, { ok: true });
				} catch (e) {
					json(res, 500, { ok: false, error: e && e.message });
				}
				return;
			}

			if (p === '/api/update-check' && req.method === 'GET') {
				const r = await checkUpdate();
				json(res, 200, r);
				return;
			}

			if (p === '/api/update' && req.method === 'POST') {
				pushPanelEvent('طلب تحديث من اللوحة');
				json(res, 200, { ok: true });
				// في الخلفية عشان الرد يوصل الأول
				setTimeout(async () => {
					try {
						await applyUpdate({
							log: (t) => pushPanelEvent(t),
							event: (m) => pushPanelEvent(m),
							delayMs: 1500,
						});
					} catch (e) {
						pushPanelEvent('فشل التحديث: ' + (e && e.message));
					}
				}, 500);
				return;
			}

			json(res, 404, { ok: false, error: 'not found' });
		} catch (e) {
			try {
				json(res, 500, { ok: false, error: e && e.message });
			} catch {}
		}
	});

	const port = Number(
		process.env.WEB_PORT || process.env.PORT || process.env.SERVER_PORT || process.env.P_SERVER_PORT || 3732
	);

	server.on('error', (e) => {
		console.error('[WEB] فشل تشغيل اللوحة:', e && e.message);
		pushPanelEvent('فشل تشغيل اللوحة: ' + (e && e.message));
	});

	server.listen(port, '0.0.0.0', () => {
		console.log('🌐 [WEB] لوحة التحكم شغالة على: http://0.0.0.0:' + port);
		pushPanelEvent('لوحة التحكم شغالة على المنفذ ' + port);
	});

	return server;
}

/* ----------------------------- صفحة الواجهة ----------------------------- */
const PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>لوحة تحكم البوت</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  :root{--bg:#0b1020;--card:#141a2e;--line:#243056;--txt:#e7ecff;--mut:#93a0c8;--acc:#4f8cff;--ok:#2ecc71;--warn:#f1c40f;--err:#ff5c5c;}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Tahoma,Arial,sans-serif;background:linear-gradient(160deg,#0b1020,#0e1530);color:var(--txt);min-height:100vh}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--line);background:rgba(20,26,46,.7);backdrop-filter:blur(8px)}
  header h1{font-size:18px;margin:0}
  .wrap{max-width:1000px;margin:0 auto;padding:22px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
  .card h2{font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:8px}
  .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.06);font-size:14px}
  .row:last-child{border-bottom:0}
  .row b{color:var(--mut);font-weight:600}
  .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
  .ok{background:rgba(46,204,113,.15);color:var(--ok)}
  .warn{background:rgba(241,196,15,.15);color:var(--warn)}
  .err{background:rgba(255,92,92,.15);color:var(--err)}
  input,select,button{font:inherit;border-radius:10px;border:1px solid var(--line);background:#0e1530;color:var(--txt);padding:10px 12px;width:100%}
  label{display:block;font-size:13px;color:var(--mut);margin:10px 0 6px}
  button{cursor:pointer;background:linear-gradient(180deg,#4f8cff,#3a6fe0);border:none;font-weight:700;margin-top:10px;transition:.15s}
  button:hover{filter:brightness(1.08)}
  button.ghost{background:#1b2444;border:1px solid var(--line)}
  button.danger{background:linear-gradient(180deg,#ff6b6b,#e04848)}
  .btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #qr{display:flex;justify-content:center;padding:10px}
  #log{height:180px;overflow:auto;background:#0a0f22;border:1px solid var(--line);border-radius:10px;padding:10px;font-size:12px;direction:ltr;text-align:left;font-family:ui-monospace,monospace}
  .muted{color:var(--mut);font-size:13px}
  .login{max-width:380px;margin:12vh auto}
  .hidden{display:none}
  a{color:var(--acc)}
</style>
</head>
<body>
<header>
  <h1>🤖 لوحة تحكم البوت</h1>
  <span id="connPill" class="pill warn">…</span>
</header>

<div id="login" class="login card">
  <h2>🔐 تسجيل الدخول</h2>
  <label for="pw">كلمة السر</label>
  <input id="pw" type="password" placeholder="••••••" autocomplete="current-password"/>
  <button id="loginBtn">دخول</button>
  <p id="loginErr" class="muted"></p>
</div>

<div id="app" class="wrap hidden">
  <div class="grid">
    <div class="card">
      <h2>📊 الحالة</h2>
      <div class="row"><b>الاتصال</b><span id="s-conn">-</span></div>
      <div class="row"><b>طريقة الربط</b><span id="s-mode">-</span></div>
      <div class="row"><b>رقم البوت</b><span id="s-phone">-</span></div>
      <div class="row"><b>اسم البوت</b><span id="s-name">-</span></div>
      <div class="row"><b>البلجنز</b><span id="s-plugins">-</span></div>
      <div class="row"><b>آخر كوميت</b><span id="s-commit">-</span></div>
      <div class="row"><b>مدة التشغيل</b><span id="s-uptime">-</span></div>
    </div>

    <div class="card">
      <h2>🔗 ربط واتساب</h2>
      <label for="phone">رقم البوت (بكود الدولة، بدون +)</label>
      <input id="phone" inputmode="numeric" placeholder="201505362172"/>
      <label for="mode">طريقة الربط</label>
      <select id="mode">
        <option value="code">كود ربط (برقم الهاتف)</option>
        <option value="qr">رمز QR</option>
      </select>
      <button id="pairBtn">حفظ وإعادة التشغيل</button>
      <div id="qr"></div>
      <div id="pairCode" class="muted" style="text-align:center;font-size:18px;font-weight:800;letter-spacing:2px"></div>
    </div>

    <div class="card">
      <h2>🎛️ التحكم</h2>
      <div class="btns">
        <button class="ghost" id="restartBtn">♻️ إعادة تشغيل</button>
        <button class="danger" id="resetBtn">🗑️ تصفير الجلسة</button>
      </div>
      <label for="sendNum">إرسال رسالة إلى رقم</label>
      <input id="sendNum" inputmode="numeric" placeholder="201xxxxxxxxx"/>
      <label for="sendMsg">نص الرسالة</label>
      <input id="sendMsg" placeholder="hello"/>
      <button class="ghost" id="sendBtn">✉️ إرسال</button>
    </div>

    <div class="card">
      <h2>⬇️ التحديثات</h2>
      <p class="muted">تحديث تلقائي كل <span id="autoInt">-</span> دقيقة من الريبو (GitHub).</p>
      <div class="btns">
        <button class="ghost" id="checkBtn">فحص</button>
        <button id="updateBtn">تطبيق التحديث</button>
      </div>
      <p id="updMsg" class="muted"></p>
    </div>

    <div class="card" style="grid-column:1/-1">
      <h2>📜 سجل الأحداث</h2>
      <div id="log"></div>
    </div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
let lastQR = null, qrObj = null;

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status===401){ showLogin(); throw new Error('auth'); }
  return r.json();
}
function showLogin(){ $('login').classList.remove('hidden'); $('app').classList.add('hidden'); }
function showApp(){ $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

$('loginBtn').onclick = async () => {
  $('loginErr').textContent = '';
  try{
    await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('pw').value})});
    showApp(); refresh();
  }catch(e){ $('loginErr').textContent = 'فشل الدخول'; }
};

$('pairBtn').onclick = async () => { await api('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:$('phone').value,mode:$('mode').value})}); $('updMsg').textContent='تم الحفظ، جاري إعادة التشغيل…'; };
$('restartBtn').onclick = async () => { await api('/api/restart',{method:'POST'}); };
$('resetBtn').onclick = async () => { if(confirm('متأكد؟ هتمسح الجلسة الحالية')) await api('/api/reset',{method:'POST'}); };
$('sendBtn').onclick = async () => { try{ await api('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:$('sendNum').value,message:$('sendMsg').value})}); $('updMsg').textContent='✅ تم الإرسال'; }catch(e){ $('updMsg').textContent='⚠️ '+e.message; } };
$('checkBtn').onclick = async () => { $('updMsg').textContent='جاري الفحص…'; const r = await api('/api/update-check'); $('updMsg').textContent = r.error? ('⚠️ '+r.error) : (r.upToDate? '✅ لا يوجد تحديث' : ('⬇️ متاح: '+r.download.length+' ملف')); };
$('updateBtn').onclick = async () => { await api('/api/update',{method:'POST'}); $('updMsg').textContent='⏳ جاري التحديث…'; };

function fmtUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); return (d?d+'d ':'')+h+'h '+m+'m'; }

function renderQR(qr){
  if(!qr){ $('qr').innerHTML=''; $('pairCode').textContent=''; lastQR=null; return; }
  if(qr===lastQR) return; lastQR=qr;
  $('pairCode').textContent='';
  $('qr').innerHTML='';
  try{ qrObj = new QRCode($('qr'),{text:qr,width:220,height:220,correctLevel:QRCode.CorrectLevel.M}); }
  catch(e){ $('qr').textContent=qr; }
}

async function refresh(){
  let s;
  try{ s = await api('/api/status'); }catch(e){ return; }
  const pill = $('connPill');
  if(s.connected){ pill.textContent='متصل ✅'; pill.className='pill ok'; }
  else { pill.textContent='غير متصل'; pill.className='pill warn'; }
  $('s-conn').textContent = s.connection;
  $('s-mode').textContent = s.mode==='qr'?'QR':'كود';
  $('s-phone').textContent = s.phone||'-';
  $('s-name').textContent = s.botName||'-';
  $('s-plugins').textContent = s.plugins;
  $('s-commit').textContent = s.commit;
  $('s-uptime').textContent = fmtUptime(s.uptimeMs);
  if(!$('phone').value) $('phone').value = s.phone||'';
  $('mode').value = s.mode;
  if(s.mode==='code' && s.pairingCode) $('pairCode').textContent = s.pairingCode;
  if(s.mode==='qr') renderQR(s.qr); else renderQR(null);
  const log = $('log');
  log.innerHTML = (s.events||[]).map(e=>'<div>['+new Date(e.t).toLocaleTimeString()+'] '+e.message.replace(/</g,'&lt;')+'</div>').join('');
  log.scrollTop = log.scrollHeight;
}

setInterval(refresh, 3000);
refresh();
</script>
</body>
</html>`;