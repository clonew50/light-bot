/**
 * panelViews.js — HTML views for the web control panel
 * ---------------------------------------------------
 * Ported from the old panel design (public login + admin panel + maintenance),
 * rebuilt for Elaina-Multidevice. UI text is English to match the bot.
 *
 * Exports:
 *   renderLoginHtml(err)                 -> login / public page
 *   renderAdminPanelHtml(installRenderJs) -> full admin control panel
 *   renderMaintenanceHtml(msg)           -> maintenance screen
 */

const SHARED_CSS = `
  :root{
    --bg:#0b1020;--bg2:#0e1530;--card:#141a2e;--line:#243056;
    --txt:#e7ecff;--mut:#93a0c8;--acc:#4f8cff;--ok:#2ecc71;
    --warn:#f1c40f;--err:#ff5c5c;--sky:#38bdf8;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Tahoma,Arial,sans-serif;
    background:linear-gradient(160deg,var(--bg),var(--bg2));color:var(--txt);min-height:100vh}
  header{display:flex;align-items:center;justify-content:space-between;
    padding:16px 22px;border-bottom:1px solid var(--line);
    background:rgba(20,26,46,.7);backdrop-filter:blur(8px)}
  header h1{font-size:18px;margin:0;display:flex;align-items:center;gap:8px}
  .wrap{max-width:1080px;margin:0 auto;padding:22px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
  .card h2{font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:8px}
  .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;
    border-bottom:1px dashed rgba(255,255,255,.06);font-size:14px}
  .row:last-child{border-bottom:0}
  .row b{color:var(--mut);font-weight:600}
  .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
  .ok{background:rgba(46,204,113,.15);color:var(--ok)}
  .warn{background:rgba(241,196,15,.15);color:var(--warn)}
  .err{background:rgba(255,92,92,.15);color:var(--err)}
  input,select,button{font:inherit;border-radius:10px;border:1px solid var(--line);
    background:#0e1530;color:var(--txt);padding:10px 12px;width:100%}
  label{display:block;font-size:13px;color:var(--mut);margin:10px 0 6px}
  button{cursor:pointer;background:linear-gradient(180deg,#4f8cff,#3a6fe0);
    border:none;font-weight:700;margin-top:10px;transition:.15s}
  button:hover{filter:brightness(1.08)}
  button.ghost{background:#1b2444;border:1px solid var(--line)}
  button.sky{background:linear-gradient(180deg,#38bdf8,#0ea5e9)}
  button.danger{background:linear-gradient(180deg,#ff6b6b,#e04848)}
  button:disabled{opacity:.5;cursor:not-allowed}
  .btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px}
  .qrbox img,.qrbox canvas{border-radius:12px;background:#fff;padding:8px}
  .code{font-size:22px;font-weight:800;letter-spacing:3px;text-align:center;
    background:#0a0f22;border:1px solid var(--line);border-radius:12px;padding:14px;margin:10px 0;
    direction:ltr;font-family:ui-monospace,monospace}
  #log{height:200px;overflow:auto;background:#0a0f22;border:1px solid var(--line);
    border-radius:10px;padding:10px;font-size:12px;direction:ltr;text-align:left;
    font-family:ui-monospace,monospace}
  .muted{color:var(--mut);font-size:13px}
  .hint{color:var(--mut);font-size:13px;line-height:1.6}
  .err-banner{background:rgba(255,92,92,.12);border:1px solid rgba(255,92,92,.4);
    color:#ffb4b4;border-radius:10px;padding:10px 12px;font-size:13px}
  .login{max-width:380px;margin:10vh auto}
  .hidden{display:none}
  a{color:var(--acc)}
  .cmd-list{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px}
  .cmd-item{padding:8px 12px;border-bottom:1px dashed rgba(255,255,255,.06);font-size:13px}
  .cmd-item:last-child{border-bottom:0}
  .cmd-item .cmd{font-family:ui-monospace,monospace;color:var(--sky);font-weight:700}
  .cmd-item .cat{float:right;font-size:11px;color:var(--mut);
    background:#0e1530;border:1px solid var(--line);border-radius:999px;padding:1px 8px}
  .cmd-item .desc{color:var(--mut);font-size:12px;margin-top:2px}
  .spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);
    border-top-color:#fff;border-radius:50%;animation:sp .8s linear infinite;vertical-align:middle}
  @keyframes sp{to{transform:rotate(360deg)}}
`;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ----------------------------- Login / public page ----------------------------- */
export function renderPublicPortalHtml(err) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bot Control Panel — Login</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login card">
  <h2>🔐 Admin Login</h2>
  <p class="hint">Enter the panel password to access the control panel.</p>
  ${err ? `<div class="err-banner" style="margin-bottom:10px">${escapeHtml(err)}</div>` : ''}
  <form method="POST" action="/login">
    <label for="pw">Password</label>
    <input id="pw" name="password" type="password" placeholder="••••••" autocomplete="current-password" autofocus/>
    <button type="submit">Login</button>
  </form>
  <p class="muted" style="margin-top:14px">The password is stored in <span style="font-family:monospace">system/panel-config.json</span> (or set via <span style="font-family:monospace">WEB_PASSWORD</span>).</p>
</div>
</body>
</html>`;
}

/* ----------------------------- Maintenance page ----------------------------- */
export function renderMaintenanceHtml(msg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Maintenance</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login card" style="text-align:center">
  <h2 style="justify-content:center">🛠️ Under Maintenance</h2>
  <p class="hint">The bot is currently under maintenance. Please check back later.</p>
  ${msg ? `<div class="err-banner" style="margin-top:10px">${escapeHtml(msg)}</div>` : ''}
  <p class="muted" style="margin-top:14px">Admins can still <a href="/">log in</a>.</p>
</div>
</body>
</html>`;
}

/* ----------------------------- Admin panel ----------------------------- */
export function renderAdminPanelHtml(installRenderJs) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bot Control Panel</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${SHARED_CSS}</style>
</head>
<body>
<header>
  <h1>🤖 Bot Control Panel</h1>
  <div style="display:flex;align-items:center;gap:12px">
    <span id="connPill" class="pill warn">…</span>
    <button class="ghost" style="width:auto;margin:0;padding:8px 14px" onclick="logout()">Logout</button>
  </div>
</header>

<div class="wrap">
  <div class="grid">

    <div class="card">
      <h2>📊 Status</h2>
      <div class="row"><b>Connection</b><span id="s-conn">-</span></div>
      <div class="row"><b>Registered</b><span id="s-reg">-</span></div>
      <div class="row"><b>Login mode</b><span id="s-mode">-</span></div>
      <div class="row"><b>Bot number</b><span id="s-phone" class="ltr">-</span></div>
      <div class="row"><b>Bot name</b><span id="s-name">-</span></div>
      <div class="row"><b>Plugins</b><span id="s-plugins">-</span></div>
      <div class="row"><b>Memory</b><span id="s-mem">-</span></div>
      <div class="row"><b>Uptime</b><span id="s-uptime">-</span></div>
      <div class="row"><b>Commit</b><span id="s-commit" class="ltr">-</span></div>
    </div>

    <div class="card">
      <h2>🔗 WhatsApp Pairing</h2>
      <div id="installBody"></div>
    </div>

    <div class="card">
      <h2>🎛️ Control</h2>
      <div class="btns">
        <button class="ghost" onclick="act('restart')">♻️ Restart</button>
        <button class="danger" onclick="act('reset-session')">🗑️ Reset Session</button>
        <button class="ghost" onclick="act('stop')">⏹️ Stop</button>
        <button class="sky" onclick="act('start')">▶️ Start</button>
      </div>
      <label for="sendNum">Send message to number</label>
      <input id="sendNum" inputmode="numeric" placeholder="201xxxxxxxxx"/>
      <label for="sendMsg">Message text</label>
      <input id="sendMsg" placeholder="hello"/>
      <button class="ghost" onclick="sendMsg()">✉️ Send</button>
      <p id="ctrlMsg" class="muted"></p>
    </div>

    <div class="card">
      <h2>⬇️ Updates</h2>
      <p class="hint">Auto-update every <span id="autoInt">-</span> minutes from the GitHub repo.</p>
      <div class="btns">
        <button class="ghost" onclick="checkUpdate()">Check</button>
        <button onclick="applyUpdate()">Apply update</button>
      </div>
      <p id="updMsg" class="muted"></p>
    </div>

    <div class="card">
      <h2>🛠️ Maintenance</h2>
      <p class="hint">When enabled, visitors see a maintenance screen. Admins can still log in.</p>
      <div class="row"><b>Status</b><span id="maintState">-</span></div>
      <div class="btns">
        <button class="danger" onclick="setMaint(true)">Enable</button>
        <button class="sky" onclick="setMaint(false)">Disable</button>
      </div>
      <p id="maintMsg" class="muted"></p>
    </div>

    <div class="card">
      <h2>🔑 Panel Password</h2>
      <p class="hint">Generate a new random password. All existing sessions will be logged out.</p>
      <button class="ghost" onclick="rotatePw()">Generate new password</button>
      <p id="pwMsg" class="muted"></p>
    </div>

    <div class="card" style="grid-column:1/-1">
      <h2>🧩 Commands</h2>
      <div style="display:grid;grid-template-columns:1fr 220px;gap:10px">
        <input id="cmdSearch" placeholder="Search commands…" oninput="loadCommands()"/>
        <select id="cmdCat" onchange="loadCommands()"><option value="">All categories</option></select>
      </div>
      <div class="cmd-list" id="cmdList" style="margin-top:10px"></div>
      <p id="cmdMeta" class="muted"></p>
    </div>

    <div class="card" style="grid-column:1/-1">
      <h2>📜 Event Log</h2>
      <div id="log"></div>
    </div>

  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
let lastQR = null, qrObj = null, lastCmdSig = '';

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status===401){ location.reload(); throw new Error('auth'); }
  if(r.status===503){ location.reload(); throw new Error('maintenance'); }
  return r.json().catch(()=>({}));
}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function logout(){
  await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
  location.reload();
}

/* ---- pairing / install (injected renderer) ---- */
${installRenderJs || ''}

function pairMainNow(){
  const phone = ($('ph') && $('ph').value || '').trim();
  const mode = ($('lm') && $('lm').value) || 'code';
  api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'pair-main',phone,loginMode:mode})})
    .then(r=>{ if(r.error) alert(r.error); else refresh(); })
    .catch(e=>alert(e.message));
}
function applyLogin(){
  const phone = ($('ph') && $('ph').value || '').trim();
  const mode = ($('lm') && $('lm').value) || 'code';
  api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'set-login',phone,loginMode:mode})})
    .then(r=>{ $('ctrlMsg').textContent = r.message || 'Saved'; })
    .catch(e=>alert(e.message));
}

/* ---- control ---- */
async function act(action){
  if(action==='reset-session' && !confirm('Move the current session to a backup and restart?')) return;
  if(action==='stop' && !confirm('Stop the bot?')) return;
  $('ctrlMsg').textContent = 'Working…';
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    $('ctrlMsg').textContent = r.message || (r.ok?'OK':'Failed');
  }catch(e){ $('ctrlMsg').textContent = '⚠️ '+e.message; }
}
async function sendMsg(){
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'send',to:$('sendNum').value,text:$('sendMsg').value})});
    $('ctrlMsg').textContent = r.ok ? '✅ Sent' : ('⚠️ '+(r.message||'Failed'));
  }catch(e){ $('ctrlMsg').textContent = '⚠️ '+e.message; }
}

/* ---- updates ---- */
async function checkUpdate(){
  $('updMsg').textContent='Checking…';
  const r = await api('/api/update-check');
  $('updMsg').textContent = r.error ? ('⚠️ '+r.error) : (r.upToDate ? '✅ Up to date' : ('⬇️ Available: '+r.download.length+' files'));
}
async function applyUpdate(){
  $('updMsg').textContent='Applying update…';
  await api('/api/update',{method:'POST'});
  $('updMsg').textContent='⏳ Updating…';
}

/* ---- maintenance ---- */
async function setMaint(on){
  const r = await api('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!!on})});
  $('maintMsg').textContent = r.message || 'OK';
  refresh();
}
/* ---- password ---- */
async function rotatePw(){
  if(!confirm('Generate a new password and log out all sessions?')) return;
  const r = await api('/api/rotate-password',{method:'POST'});
  $('pwMsg').textContent = r.password ? ('New password: '+r.password) : 'Failed';
}

/* ---- commands ---- */
async function loadCommands(){
  const q = $('cmdSearch').value || '';
  const cat = $('cmdCat').value || '';
  const r = await api('/api/commands?q='+encodeURIComponent(q)+'&cat='+encodeURIComponent(cat));
  if(!r.ok) return;
  // persist category options
  const sel = $('cmdCat');
  if(sel.options.length<=1 && r.categories){
    for(const c of r.categories){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.label+' ('+c.count+')'; sel.appendChild(o); }
  }
  const sig = r.commands.map(c=>c.primary).join('|')+'#'+r.filtered;
  if(sig===lastCmdSig) return; lastCmdSig=sig;
  $('cmdList').innerHTML = r.commands.map(c=>
    '<div class="cmd-item"><span class="cat">'+esc(c.categoryLabel)+'</span>'+
    '<span class="cmd">'+esc(c.primary)+'</span>'+
    (c.description?'<div class="desc">'+esc(c.description)+'</div>':'')+'</div>'
  ).join('') || '<div class="cmd-item muted">No commands</div>';
  $('cmdMeta').textContent = r.filtered+' of '+r.total+' commands'+(r.truncated?' (truncated)':'');
}

function fmtUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); return (d?d+'d ':'')+h+'h '+m+'m'; }

function renderQR(qr){
  if(!qr){ $('qr').innerHTML=''; $('pairCode') && ($('pairCode').textContent=''); lastQR=null; return; }
  if(qr===lastQR) return; lastQR=qr;
  const pc = $('pairCode'); if(pc) pc.textContent='';
  $('qr').innerHTML='';
  try{ qrObj = new QRCode($('qr'),{text:qr,width:220,height:220,correctLevel:QRCode.CorrectLevel.M}); }
  catch(e){ $('qr').textContent=qr; }
}

async function refresh(){
  let s;
  try{ s = await api('/api/status'); }catch(e){ return; }
  const pill = $('connPill');
  if(s.connected){ pill.textContent='Connected ✅'; pill.className='pill ok'; }
  else { pill.textContent='Not connected'; pill.className='pill warn'; }
  $('s-conn').textContent = s.connection || '-';
  $('s-reg').textContent = s.sessionRegistered ? 'Yes' : 'No';
  $('s-mode').textContent = s.loginMode==='qr'?'QR':'Code';
  $('s-phone').textContent = s.configuredPhone || s.phone || '-';
  $('s-name').textContent = s.name || '-';
  $('s-plugins').textContent = s.commands || 0;
  $('s-mem').textContent = (s.memoryMB||0)+' MB';
  $('s-uptime').textContent = fmtUptime(s.uptimeSec*1000);
  $('s-commit').textContent = s.commit || '-';
  $('maintState').textContent = s.maintenance ? 'ON' : 'OFF';
  if(!$('ph').value) $('ph').value = s.configuredPhone || '';
  $('lm').value = s.loginMode;
  if(s.loginMode==='code' && s.pairingCode){ renderQR(null); const pc=$('pairCode'); if(pc) pc.textContent=s.pairingCode; }
  else if(s.loginMode==='qr'){ renderQR(s.qr); }
  else { renderQR(null); }
  const log = $('log');
  log.innerHTML = (s.events||[]).map(e=>{
    const t = new Date(e.ts||e.t||Date.now()).toLocaleTimeString();
    return '<div>['+t+'] '+esc(e.text||e.message||'')+'</div>';
  }).join('');
  log.scrollTop = log.scrollHeight;
}

setInterval(refresh, 3000);
setInterval(loadCommands, 15000);
refresh();
loadCommands();
</script>
</body>
</html>`;
}