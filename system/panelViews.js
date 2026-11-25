/**
 * panelViews.js — HTML views for the web control panel
 * ---------------------------------------------------
 * Two views:
 *   - Public Portal (no login): bot status, pairing, send message, event log.
 *   - Admin Panel (login): everything in public + control, maintenance,
 *     password rotation, command browser, auto-update.
 * Plus a maintenance screen.
 *
 * Design: dark ops/terminal aesthetic — deep black, electric cyan accent,
 * monospace data, subtle grid, no AI-template look.
 */

const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root{
    --bg:#06060a;--bg2:#0a0a12;--panel:#0e0e18;--card:#12121e;
    --line:#1f1f33;--line2:#2a2a44;--txt:#e4e4f0;--mut:#6b6b8a;
    --dim:#3a3a55;--acc:#00e5ff;--acc2:#00ff88;--warn:#ffb020;
    --err:#ff4d6a;--ok:#00ff88;--pink:#ff3d8b;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:'Space Grotesk',system-ui,sans-serif;
    background:var(--bg);color:var(--txt);min-height:100vh;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,229,255,.08), transparent),
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
    background-size:100% 100%, 48px 48px, 48px 48px;
    background-attachment:fixed;
    -webkit-font-smoothing:antialiased;
  }
  ::selection{background:var(--acc);color:#000}
  a{color:var(--acc);text-decoration:none}
  a:hover{text-decoration:underline}

  /* ---------- header ---------- */
  .topbar{
    position:sticky;top:0;z-index:50;
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 24px;
    background:rgba(6,6,10,.75);backdrop-filter:blur(14px);
    border-bottom:1px solid var(--line);
  }
  .brand{display:flex;align-items:center;gap:12px}
  .brand-mark{
    width:34px;height:34px;border-radius:8px;
    background:linear-gradient(135deg,var(--acc),var(--acc2));
    display:grid;place-items:center;color:#000;font-weight:800;font-size:16px;
    box-shadow:0 0 24px rgba(0,229,255,.35);
  }
  .brand-name{font-weight:700;font-size:15px;letter-spacing:.3px}
  .brand-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mut);letter-spacing:.5px}
  .topbar-right{display:flex;align-items:center;gap:10px}
  .status-dot{width:8px;height:8px;border-radius:50%;background:var(--dim);box-shadow:0 0 12px currentColor}
  .status-dot.on{background:var(--ok);color:var(--ok)}
  .status-dot.off{background:var(--err);color:var(--err)}
  .status-text{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--mut)}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
    border-radius:6px;border:1px solid var(--line2);background:var(--card);
    color:var(--txt);font-size:13px;font-weight:500;cursor:pointer;
    transition:all .15s;font-family:inherit}
  .btn:hover{border-color:var(--acc);color:var(--acc)}
  .btn.primary{background:var(--acc);color:#000;border-color:var(--acc);font-weight:600}
  .btn.primary:hover{filter:brightness(1.1);box-shadow:0 0 20px rgba(0,229,255,.4)}
  .btn.danger{border-color:var(--err);color:var(--err)}
  .btn.danger:hover{background:var(--err);color:#000}
  .btn.ghost{background:transparent}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .btn.sm{padding:5px 10px;font-size:12px}

  /* ---------- layout ---------- */
  .container{max-width:1200px;margin:0 auto;padding:28px 24px}
  .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
  .col-4{grid-column:span 4}
  .col-6{grid-column:span 6}
  .col-8{grid-column:span 8}
  .col-12{grid-column:span 12}
  @media(max-width:900px){.col-4,.col-6,.col-8{grid-column:span 12}}

  /* ---------- card ---------- */
  .card{
    background:var(--card);border:1px solid var(--line);border-radius:10px;
    padding:20px;position:relative;overflow:hidden;
    transition:border-color .2s;
  }
  .card:hover{border-color:var(--line2)}
  .card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .card-title{font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);
    display:flex;align-items:center;gap:8px}
  .card-title .dot{width:6px;height:6px;border-radius:2px;background:var(--acc)}
  .card-body{font-size:14px}

  /* ---------- rows / data ---------- */
  .data-row{display:flex;justify-content:space-between;align-items:center;
    padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
  .data-row:last-child{border-bottom:0}
  .data-key{color:var(--mut);font-family:'JetBrains Mono',monospace;font-size:12px}
  .data-val{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--txt);text-align:right}
  .data-val.ok{color:var(--ok)} .data-val.err{color:var(--err)} .data-val.warn{color:var(--warn)}

  /* ---------- form ---------- */
  .field{margin-bottom:12px}
  .field label{display:block;font-size:11px;color:var(--mut);margin-bottom:5px;
    font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px}
  .field input,.field select{
    width:100%;padding:9px 12px;border-radius:6px;
    background:var(--bg);border:1px solid var(--line2);color:var(--txt);
    font-family:'JetBrains Mono',monospace;font-size:13px;
    transition:border-color .15s;
  }
  .field input:focus,.field select:focus{outline:none;border-color:var(--acc)}
  .field input::placeholder{color:var(--dim)}

  /* ---------- code block ---------- */
  .code-block{
    font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:600;
    letter-spacing:4px;text-align:center;padding:16px;
    background:var(--bg);border:1px solid var(--line2);border-radius:8px;
    color:var(--acc);text-shadow:0 0 20px rgba(0,229,255,.4);
    margin:12px 0;
  }

  /* ---------- qr ---------- */
  .qr-box{display:flex;justify-content:center;padding:16px;
    background:#fff;border-radius:8px;margin:12px 0}
  .qr-box img,.qr-box canvas{border-radius:4px}

  /* ---------- log ---------- */
  .log-box{
    height:220px;overflow:auto;background:var(--bg);border:1px solid var(--line);
    border-radius:6px;padding:10px;font-family:'JetBrains Mono',monospace;
    font-size:12px;line-height:1.6;
  }
  .log-line{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.03)}
  .log-time{color:var(--dim);margin-right:8px}
  .log-msg{color:var(--txt)}

  /* ---------- command list ---------- */
  .cmd-list{max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:6px}
  .cmd-item{padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px;
    display:flex;align-items:center;gap:10px}
  .cmd-item:last-child{border-bottom:0}
  .cmd-name{font-family:'JetBrains Mono',monospace;color:var(--acc);font-weight:600;min-width:120px}
  .cmd-cat{font-size:10px;color:var(--mut);background:var(--bg);border:1px solid var(--line2);
    border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.5px}
  .cmd-desc{color:var(--mut);font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* ---------- maintenance banner ---------- */
  .maint-banner{
    background:linear-gradient(90deg,rgba(255,176,32,.1),rgba(255,176,32,.05));
    border:1px solid rgba(255,176,32,.4);border-radius:8px;padding:12px 16px;
    margin-bottom:16px;font-size:13px;color:var(--warn);
    display:flex;align-items:center;gap:10px;
  }

  /* ---------- login ---------- */
  .login-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  .login-card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line2);
    border-radius:12px;padding:32px;position:relative}
  .login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;
    background:linear-gradient(90deg,transparent,var(--acc),transparent)}
  .login-title{font-size:22px;font-weight:700;margin-bottom:4px}
  .login-sub{color:var(--mut);font-size:13px;margin-bottom:24px}
  .login-err{background:rgba(255,77,106,.1);border:1px solid rgba(255,77,106,.4);
    color:var(--err);border-radius:6px;padding:10px 12px;font-size:13px;margin-bottom:12px}

  /* ---------- misc ---------- */
  .muted{color:var(--mut);font-size:12px}
  .hint{color:var(--mut);font-size:12px;line-height:1.6}
  .err-banner{background:rgba(255,77,106,.1);border:1px solid rgba(255,77,106,.4);
    color:var(--err);border-radius:6px;padding:10px 12px;font-size:13px}
  .ok-banner{background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.4);
    color:var(--ok);border-radius:6px;padding:10px 12px;font-size:13px}
  .hidden{display:none}
  .mono{font-family:'JetBrains Mono',monospace}
  .ltr{direction:ltr;text-align:left}
  .spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.2);
    border-top-color:var(--acc);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle}
  @keyframes sp{to{transform:rotate(360deg)}}
  .fade-in{animation:fi .3s ease}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .pulse{animation:pu 2s ease-in-out infinite}
  @keyframes pu{0%,100%{opacity:1}50%{opacity:.5}}
  .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:-1;
    background-image:linear-gradient(rgba(0,229,255,.03) 1px,transparent 1px),
      linear-gradient(90deg,rgba(0,229,255,.03) 1px,transparent 1px);
    background-size:60px 60px}
`;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =====================================================================
 * PUBLIC PORTAL (no login)
 * ===================================================================== */
export function renderPublicPortalHtml(err, installRenderJs) {
  const IJS = installRenderJs || INSTALL_RENDER_JS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bot Portal</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="grid-bg"></div>

<div class="topbar">
  <div class="brand">
    <div class="brand-mark">B</div>
    <div>
      <div class="brand-name">Bot Portal</div>
      <div class="brand-sub">public · pairing · status</div>
    </div>
  </div>
  <div class="topbar-right">
    <span class="status-dot" id="statusDot"></span>
    <span class="status-text" id="statusText">connecting</span>
    <a class="btn sm ghost" href="/admin">Admin →</a>
  </div>
</div>

<div class="container">
  <div class="grid">

    <div class="col-4">
      <div class="card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span>Status</div>
        </div>
        <div class="data-row"><span class="data-key">connection</span><span class="data-val" id="s-conn">-</span></div>
        <div class="data-row"><span class="data-key">registered</span><span class="data-val" id="s-reg">-</span></div>
        <div class="data-row"><span class="data-key">login_mode</span><span class="data-val" id="s-mode">-</span></div>
        <div class="data-row"><span class="data-key">bot_number</span><span class="data-val ltr" id="s-phone">-</span></div>
        <div class="data-row"><span class="data-key">bot_name</span><span class="data-val" id="s-name">-</span></div>
        <div class="data-row"><span class="data-key">plugins</span><span class="data-val" id="s-plugins">-</span></div>
        <div class="data-row"><span class="data-key">memory</span><span class="data-val" id="s-mem">-</span></div>
        <div class="data-row"><span class="data-key">uptime</span><span class="data-val" id="s-uptime">-</span></div>
        <div class="data-row"><span class="data-key">commit</span><span class="data-val ltr" id="s-commit">-</span></div>
      </div>
    </div>

    <div class="col-8">
      <div class="card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span>WhatsApp Pairing</div>
        </div>
        <div id="installBody"></div>
      </div>
    </div>

    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span>Send Message</div>
        </div>
        <div class="field">
          <label>target number</label>
          <input id="sendNum" inputmode="numeric" placeholder="201xxxxxxxxx"/>
        </div>
        <div class="field">
          <label>message</label>
          <input id="sendMsg" placeholder="hello"/>
        </div>
        <button class="primary" onclick="sendMsg()">Send →</button>
        <p id="sendMsgOut" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="dot"></span>Event Log</div>
        </div>
        <div class="log-box" id="log"></div>
      </div>
    </div>

  </div>
</div>

${err ? `<div style="position:fixed;bottom:20px;left:20px;right:20px" class="err-banner">${esc(err)}</div>` : ''}

<script>
const $ = (id) => document.getElementById(id);
let lastQR = null, qrObj = null;

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status===503){ location.reload(); throw new Error('maintenance'); }
  return r.json().catch(()=>({}));
}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

${IJS}

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
    .then(r=>{ const el=$('sendMsgOut'); if(el) el.textContent = r.message || 'Saved'; })
    .catch(e=>alert(e.message));
}

async function sendMsg(){
  const out = $('sendMsgOut');
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'send',to:$('sendNum').value,text:$('sendMsg').value})});
    out.textContent = r.ok ? '✓ sent' : ('⚠ '+(r.message||'failed'));
    out.className = r.ok ? 'ok-banner' : 'err-banner';
  }catch(e){ out.textContent='⚠ '+e.message; out.className='err-banner'; }
}

function fmtUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); return (d?d+'d ':'')+h+'h '+m+'m'; }
function renderQR(qr){
  if(!qr){ const e=$('qr'); if(e) e.innerHTML=''; lastQR=null; return; }
  if(qr===lastQR) return; lastQR=qr;
  const e=$('qr'); if(!e) return; e.innerHTML='';
  try{ qrObj = new QRCode(e,{text:qr,width:200,height:200,correctLevel:QRCode.CorrectLevel.M}); }
  catch(e2){ e.textContent=qr; }
}

async function refresh(){
  let s;
  try{ s = await api('/api/status'); }catch(e){ return; }
  const dot = $('statusDot'); const txt = $('statusText');
  if(s.connected){ dot.className='status-dot on'; txt.textContent='online'; }
  else { dot.className='status-dot off'; txt.textContent='offline'; }
  $('s-conn').textContent = s.connection || '-';
  $('s-reg').textContent = s.sessionRegistered ? 'yes' : 'no';
  $('s-mode').textContent = s.loginMode==='qr'?'qr':'code';
  $('s-phone').textContent = s.configuredPhone || s.phone || '-';
  $('s-name').textContent = s.name || '-';
  $('s-plugins').textContent = s.commands || 0;
  $('s-mem').textContent = (s.memoryMB||0)+' MB';
  $('s-uptime').textContent = fmtUptime((s.uptimeSec||0)*1000);
  $('s-commit').textContent = s.commit || '-';
  if(!$('ph')?.value) { const ph=$('ph'); if(ph) ph.value = s.configuredPhone || ''; }
  const lm=$('lm'); if(lm) lm.value = s.loginMode;
  if(s.loginMode==='code' && s.pairingCode){ renderQR(null); const pc=$('pairCode'); if(pc) pc.textContent=s.pairingCode; }
  else if(s.loginMode==='qr'){ renderQR(s.qr); }
  else { renderQR(null); }
  // re-run install renderer
  try{ renderInstall(s); }catch(e){}
  const log = $('log');
  if(log) log.innerHTML = (s.events||[]).map(e=>{
    const t = new Date(e.ts||Date.now()).toLocaleTimeString();
    return '<div class="log-line"><span class="log-time">'+t+'</span><span class="log-msg">'+esc(e.text||e.message||'')+'</span></div>';
  }).join('');
  if(log) log.scrollTop = log.scrollHeight;
}

setInterval(refresh, 3000);
refresh();
</script>
</body>
</html>`;
}

/* =====================================================================
 * INSTALL RENDER JS (shared between public & admin)
 * ===================================================================== */
const INSTALL_RENDER_JS_PUBLIC = `function renderInstall(d){
  const box=document.getElementById('installBody');
  if(!box) return;
  const activeId=document.activeElement?document.activeElement.id:'';
  if(activeId==='lm' || activeId==='ph') return;
  const sig=[!!d.connected,d.pairingCode||'',d.qr?'1':'0',d.loginMode||'',d.configuredPhone||''].join('|');
  if(window._lastInstallSig===sig) return;
  window._lastInstallSig=sig;
  if(d.connected){
    box.innerHTML='<div class="hint">Bot is already connected to WhatsApp. Use <b>Reset Session</b> (admin) to switch numbers.</div>';
    return;
  }
  let html='';
  if(d.pairingCode){
    html+='<div class="hint">Open WhatsApp → Linked devices → Link with phone number, then enter:</div><div class="code">'+esc(d.pairingCode)+'</div>';
  }
  if(d.qr){
    html+='<div class="hint">Scan this QR from WhatsApp:</div><div class="qr-box" id="qr"></div>';
  }
  if(!d.pairingCode && !d.qr){
    html+=(d.loginMode==='code' && !d.configuredPhone)
      ? '<div class="hint">Enter the bot number below, then press <b>Pair now</b> to issue a pairing code.</div>'
      : '<div class="hint">Waiting for a QR code or pairing code...</div>';
  }
  html+='<div style="margin-top:14px">'
     +'<div class="field"><label>login method</label>'
     +'<select id="lm"><option value="code"'+(d.loginMode==='code'?' selected':'')+'>pairing code</option>'
     +'<option value="qr"'+(d.loginMode==='qr'?' selected':'')+'>qr code</option></select></div>'
     +'<div class="field"><label>bot number</label>'
     +'<input id="ph" class="ltr mono" value="'+esc(d.configuredPhone)+'" placeholder="2010xxxxxxxx"></div>'
     +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
     +'<button type="button" class="primary sm" onclick="pairMainNow()">Pair now</button>'
     +'<button type="button" class="btn sm" onclick="applyLogin()">Save &amp; restart</button>'
     +'<button type="button" class="btn sm ghost" onclick="refresh()">Refresh</button></div></div>';
  box.innerHTML=html;
  if(d.qr) renderQR(d.qr);
}`;

/* =====================================================================
 * ADMIN PANEL (login required)
 * ===================================================================== */
export function renderAdminPanelHtml(installRenderJs) {
  const IJS = installRenderJs || INSTALL_RENDER_JS_PUBLIC;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bot Admin</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="grid-bg"></div>

<div class="topbar">
  <div class="brand">
    <div class="brand-mark">A</div>
    <div>
      <div class="brand-name">Admin Panel</div>
      <div class="brand-sub">control · monitor · deploy</div>
    </div>
  </div>
  <div class="topbar-right">
    <span class="status-dot" id="statusDot"></span>
    <span class="status-text" id="statusText">connecting</span>
    <a class="btn sm ghost" href="/">Public</a>
    <button class="btn sm danger" onclick="logout()">Logout</button>
  </div>
</div>

<div class="container">
  <div id="maintBanner" class="maint-banner hidden">
    <span>⚠</span><span>Maintenance mode is <b>ON</b> — visitors see a maintenance screen.</span>
  </div>

  <div class="grid">

    <!-- status -->
    <div class="col-4">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Status</div></div>
        <div class="data-row"><span class="data-key">connection</span><span class="data-val" id="s-conn">-</span></div>
        <div class="data-row"><span class="data-key">registered</span><span class="data-val" id="s-reg">-</span></div>
        <div class="data-row"><span class="data-key">login_mode</span><span class="data-val" id="s-mode">-</span></div>
        <div class="data-row"><span class="data-key">bot_number</span><span class="data-val ltr" id="s-phone">-</span></div>
        <div class="data-row"><span class="data-key">bot_name</span><span class="data-val" id="s-name">-</span></div>
        <div class="data-row"><span class="data-key">plugins</span><span class="data-val" id="s-plugins">-</span></div>
        <div class="data-row"><span class="data-key">memory</span><span class="data-val" id="s-mem">-</span></div>
        <div class="data-row"><span class="data-key">uptime</span><span class="data-val" id="s-uptime">-</span></div>
        <div class="data-row"><span class="data-key">commit</span><span class="data-val ltr" id="s-commit">-</span></div>
      </div>
    </div>

    <!-- pairing -->
    <div class="col-8">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>WhatsApp Pairing</div></div>
        <div id="installBody"></div>
      </div>
    </div>

    <!-- control -->
    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Control</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button class="btn" onclick="act('restart')">↻ Restart</button>
          <button class="btn danger" onclick="act('reset-session')">⊘ Reset Session</button>
          <button class="btn" onclick="act('stop')">■ Stop</button>
          <button class="btn" style="border-color:var(--ok);color:var(--ok)" onclick="act('start')">▶ Start</button>
        </div>
        <div class="field"><label>target number</label><input id="sendNum" inputmode="numeric" placeholder="201xxxxxxxxx"/></div>
        <div class="field"><label>message</label><input id="sendMsg" placeholder="hello"/></div>
        <button class="primary" onclick="sendMsg()">Send →</button>
        <p id="ctrlMsg" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <!-- updates -->
    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Updates</div></div>
        <p class="hint" style="margin-bottom:12px">Auto-update every <span id="autoInt">-</span> minutes from GitHub.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="checkUpdate()">Check</button>
          <button class="primary" onclick="applyUpdate()">Apply</button>
        </div>
        <p id="updMsg" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <!-- maintenance -->
    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Maintenance</div></div>
        <p class="hint" style="margin-bottom:12px">When ON, visitors see a maintenance screen. Admins can still log in.</p>
        <div class="data-row"><span class="data-key">status</span><span class="data-val" id="maintState">-</span></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn danger" onclick="setMaint(true)">Enable</button>
          <button class="btn" style="border-color:var(--ok);color:var(--ok)" onclick="setMaint(false)">Disable</button>
        </div>
        <p id="maintMsg" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <!-- password -->
    <div class="col-6">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Password</div></div>
        <p class="hint" style="margin-bottom:12px">Generate a new random password. All sessions logged out.</p>
        <button class="btn" onclick="rotatePw()">Generate new</button>
        <p id="pwMsg" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <!-- commands -->
    <div class="col-12">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Commands</div></div>
        <div style="display:grid;grid-template-columns:1fr 220px;gap:10px;margin-bottom:12px">
          <input id="cmdSearch" placeholder="search commands…" oninput="loadCommands()"/>
          <select id="cmdCat" onchange="loadCommands()"><option value="">all categories</option></select>
        </div>
        <div class="cmd-list" id="cmdList"></div>
        <p id="cmdMeta" class="muted" style="margin-top:8px"></p>
      </div>
    </div>

    <!-- log -->
    <div class="col-12">
      <div class="card fade-in">
        <div class="card-head"><div class="card-title"><span class="dot"></span>Event Log</div></div>
        <div class="log-box" id="log"></div>
      </div>
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

${IJS}

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
    .then(r=>{ const el=$('ctrlMsg'); if(el) el.textContent = r.message || 'Saved'; })
    .catch(e=>alert(e.message));
}

async function act(action){
  if(action==='reset-session' && !confirm('Move the current session to a backup and restart?')) return;
  if(action==='stop' && !confirm('Stop the bot?')) return;
  const el=$('ctrlMsg'); if(el) el.textContent='Working…';
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    if(el) el.textContent = r.message || (r.ok?'OK':'Failed');
  }catch(e){ if(el) el.textContent='⚠ '+e.message; }
}
async function sendMsg(){
  const el=$('ctrlMsg');
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'send',to:$('sendNum').value,text:$('sendMsg').value})});
    if(el) el.textContent = r.ok ? '✓ sent' : ('⚠ '+(r.message||'failed'));
  }catch(e){ if(el) el.textContent='⚠ '+e.message; }
}

async function checkUpdate(){
  const el=$('updMsg'); if(el) el.textContent='Checking…';
  const r = await api('/api/update-check');
  if(el) el.textContent = r.error ? ('⚠ '+r.error) : (r.upToDate ? '✓ up to date' : ('⬇ available: '+r.download.length+' files'));
}
async function applyUpdate(){
  const el=$('updMsg'); if(el) el.textContent='Applying…';
  await api('/api/update',{method:'POST'});
  if(el) el.textContent='⏳ updating…';
}

async function setMaint(on){
  const r = await api('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!!on})});
  const el=$('maintMsg'); if(el) el.textContent = r.message || 'OK';
  refresh();
}
async function rotatePw(){
  if(!confirm('Generate a new password and log out all sessions?')) return;
  const r = await api('/api/rotate-password',{method:'POST'});
  const el=$('pwMsg'); if(el) el.textContent = r.password ? ('new password: '+r.password) : 'failed';
}

async function loadCommands(){
  const q = $('cmdSearch').value || '';
  const cat = $('cmdCat').value || '';
  const r = await api('/api/commands?q='+encodeURIComponent(q)+'&cat='+encodeURIComponent(cat));
  if(!r.ok) return;
  const sel = $('cmdCat');
  if(sel && sel.options.length<=1 && r.categories){
    for(const c of r.categories){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.label+' ('+c.count+')'; sel.appendChild(o); }
  }
  const sig = r.commands.map(c=>c.primary).join('|')+'#'+r.filtered;
  if(sig===lastCmdSig) return; lastCmdSig=sig;
  const list=$('cmdList');
  if(list) list.innerHTML = r.commands.map(c=>
    '<div class="cmd-item"><span class="cmd-name">'+esc(c.primary)+'</span>'+
    '<span class="cmd-cat">'+esc(c.categoryLabel)+'</span>'+
    '<span class="cmd-desc">'+esc(c.description||'')+'</span></div>'
  ).join('') || '<div class="cmd-item muted">no commands</div>';
  const meta=$('cmdMeta'); if(meta) meta.textContent = r.filtered+' of '+r.total+' commands'+(r.truncated?' (truncated)':'');
}

function fmtUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); return (d?d+'d ':'')+h+'h '+m+'m'; }
function renderQR(qr){
  if(!qr){ const e=$('qr'); if(e) e.innerHTML=''; lastQR=null; return; }
  if(qr===lastQR) return; lastQR=qr;
  const e=$('qr'); if(!e) return; e.innerHTML='';
  try{ qrObj = new QRCode(e,{text:qr,width:200,height:200,correctLevel:QRCode.CorrectLevel.M}); }
  catch(e2){ e.textContent=qr; }
}

async function refresh(){
  let s;
  try{ s = await api('/api/status'); }catch(e){ return; }
  const dot=$('statusDot'); const txt=$('statusText');
  if(s.connected){ if(dot) dot.className='status-dot on'; if(txt) txt.textContent='online'; }
  else { if(dot) dot.className='status-dot off'; if(txt) txt.textContent='offline'; }
  if($('s-conn')) $('s-conn').textContent = s.connection || '-';
  if($('s-reg')) $('s-reg').textContent = s.sessionRegistered ? 'yes' : 'no';
  if($('s-mode')) $('s-mode').textContent = s.loginMode==='qr'?'qr':'code';
  if($('s-phone')) $('s-phone').textContent = s.configuredPhone || s.phone || '-';
  if($('s-name')) $('s-name').textContent = s.name || '-';
  if($('s-plugins')) $('s-plugins').textContent = s.commands || 0;
  if($('s-mem')) $('s-mem').textContent = (s.memoryMB||0)+' MB';
  if($('s-uptime')) $('s-uptime').textContent = fmtUptime((s.uptimeSec||0)*1000);
  if($('s-commit')) $('s-commit').textContent = s.commit || '-';
  const mb=$('maintBanner'); if(mb) mb.className = s.maintenance ? 'maint-banner' : 'maint-banner hidden';
  if($('maintState')) $('maintState').textContent = s.maintenance ? 'ON' : 'OFF';
  const ph=$('ph'); if(ph && !ph.value) ph.value = s.configuredPhone || '';
  const lm=$('lm'); if(lm) lm.value = s.loginMode;
  if(s.loginMode==='code' && s.pairingCode){ renderQR(null); const pc=$('pairCode'); if(pc) pc.textContent=s.pairingCode; }
  else if(s.loginMode==='qr'){ renderQR(s.qr); }
  else { renderQR(null); }
  try{ renderInstall(s); }catch(e){}
  const log=$('log');
  if(log) log.innerHTML = (s.events||[]).map(e=>{
    const t = new Date(e.ts||Date.now()).toLocaleTimeString();
    return '<div class="log-line"><span class="log-time">'+t+'</span><span class="log-msg">'+esc(e.text||e.message||'')+'</span></div>';
  }).join('');
  if(log) log.scrollTop = log.scrollHeight;
}

setInterval(refresh, 3000);
setInterval(loadCommands, 15000);
refresh();
loadCommands();
</script>
</body>
</html>`;
}

/* =====================================================================
 * MAINTENANCE
 * ===================================================================== */
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
<div class="login-wrap">
  <div class="login-card" style="text-align:center">
    <div class="brand-mark" style="margin:0 auto 16px">M</div>
    <div class="login-title">Under Maintenance</div>
    <div class="login-sub">The bot is being serviced. Please check back shortly.</div>
    ${msg ? `<div class="err-banner" style="margin-top:12px">${esc(msg)}</div>` : ''}
    <div style="margin-top:24px">
      <a class="btn sm ghost" href="/">Admin login →</a>
    </div>
  </div>
</div>
</body>
</html>`;
}
/* Export the install render js as a string for webPanel.js to inject */
export const INSTALL_RENDER_JS = `
function renderInstall(d){
  const box=document.getElementById('installBody');
  if(!box) return;
  const activeId=document.activeElement?document.activeElement.id:'';
  if(activeId==='lm' || activeId==='ph') return;
  const sig=[!!d.connected,d.pairingCode||'',d.qr?'1':'0',d.loginMode||'',d.configuredPhone||''].join('|');
  if(window._lastInstallSig===sig) return;
  window._lastInstallSig=sig;
  if(d.connected){
    box.innerHTML='<div class="hint">Bot is already connected to WhatsApp. Use <b>Reset Session</b> (admin) to switch numbers.</div>';
    return;
  }
  let html='';
  if(d.pairingCode){
    html+='<div class="hint">Open WhatsApp → Linked devices → Link with phone number, then enter:</div><div class="code">'+esc(d.pairingCode)+'</div>';
  }
  if(d.qr){
    html+='<div class="hint">Scan this QR from WhatsApp:</div><div class="qr-box" id="qr"></div>';
  }
  if(!d.pairingCode && !d.qr){
    html+=(d.loginMode==='code' && !d.configuredPhone)
      ? '<div class="hint">Enter the bot number below, then press <b>Pair now</b> to issue a pairing code.</div>'
      : '<div class="hint">Waiting for a QR code or pairing code...</div>';
  }
  html+='<div style="margin-top:14px">'
     +'<div class="field"><label>login method</label>'
     +'<select id="lm"><option value="code"'+(d.loginMode==='code'?' selected':'')+'>pairing code</option>'
     +'<option value="qr"'+(d.loginMode==='qr'?' selected':'')+'>qr code</option></select></div>'
     +'<div class="field"><label>bot number</label>'
     +'<input id="ph" class="ltr mono" value="'+esc(d.configuredPhone)+'" placeholder="2010xxxxxxxx"></div>'
     +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
     +'<button type="button" class="primary sm" onclick="pairMainNow()">Pair now</button>'
     +'<button type="button" class="btn sm" onclick="applyLogin()">Save &amp; restart</button>'
     +'<button type="button" class="btn sm ghost" onclick="refresh()">Refresh</button></div></div>';
  box.innerHTML=html;
  if(d.qr) renderQR(d.qr);
}`;
