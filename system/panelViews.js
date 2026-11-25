/**
 * panelViews.js — Arabic-first dark ops UI for Elaina-Multidevice
 * ----------------------------------------------------------------
 * Views:
 *   - Public Portal (/): live public status, real WhatsApp sub-bot pairing
 *     (Pairing Code + QR), existing sub-bot control-code login, settings & actions.
 *   - Admin Login (/admin unauthenticated): clean password form -> /login.
 *   - Admin Panel (/admin authenticated): main bot pairing, controls, send test,
 *     sub-bots monitor, commands browser, maintenance toggle, password rotation, updates.
 *   - Maintenance Screen (503).
 */

const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

  :root{
    --bg:#0b0d12;
    --bg2:#10141d;
    --card:#121620;
    --card2:#171c29;
    --line:#232a3b;
    --line2:#313b52;
    --txt:#eef2f7;
    --mut:#94a3b8;
    --dim:#64748b;
    --acc:#22d3ee;
    --acc-bg:rgba(34,211,238,.12);
    --ok:#10b981;
    --ok-bg:rgba(16,185,129,.12);
    --warn:#f59e0b;
    --warn-bg:rgba(245,158,11,.12);
    --err:#ef4444;
    --err-bg:rgba(239,68,68,.12);
    --radius:8px;
  }

  *{box-sizing:border-box;margin:0;padding:0}
  html,body{min-height:100%}
  body{
    font-family:'IBM Plex Sans Arabic','Plus Jakarta Sans',system-ui,-apple-system,sans-serif;
    background:var(--bg);
    color:var(--txt);
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
    font-feature-settings:"tnum" 1;
    font-variant-numeric:tabular-nums;
  }
  a{color:var(--acc);text-decoration:none}
  a:hover{text-decoration:underline}

  /* ---------- Topbar ---------- */
  .topbar{
    position:sticky;top:0;z-index:40;
    background:rgba(11,13,18,.92);
    backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
    padding:12px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:16px;
  }
  .brand{display:flex;align-items:center;gap:12px}
  .brand-mark{
    width:36px;height:36px;border-radius:8px;
    background:var(--acc-bg);border:1px solid rgba(34,211,238,.35);
    color:var(--acc);display:grid;place-items:center;
    font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:16px;
  }
  .brand-name{font-weight:700;font-size:15px;color:var(--txt)}
  .brand-sub{font-size:12px;color:var(--mut)}
  .topbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

  .conn-indicator{
    display:inline-flex;align-items:center;gap:7px;
    padding:5px 10px;border-radius:6px;
    border:1px solid var(--line);background:var(--bg2);
    font-size:12px;color:var(--mut);
  }
  .status-dot{width:8px;height:8px;border-radius:2px;background:var(--dim)}
  .status-dot.on{background:var(--ok)}
  .status-dot.off{background:var(--err)}
  .status-dot.warn{background:var(--warn)}

  /* ---------- Buttons ---------- */
  .btn, button.primary{
    display:inline-flex;align-items:center;justify-content:center;gap:6px;
    padding:9px 15px;border-radius:6px;border:1px solid var(--line2);
    background:var(--card2);color:var(--txt);
    font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;
    transition:border-color .15s,background .15s,color .15s;
  }
  .btn:hover{border-color:var(--acc);color:var(--acc)}
  .btn.primary, button.primary{
    background:var(--acc);color:#061218;border-color:var(--acc);font-weight:700;
  }
  .btn.primary:hover, button.primary:hover{filter:brightness(1.08)}
  .btn.danger{border-color:rgba(239,68,68,.45);color:#fca5a5;background:var(--err-bg)}
  .btn.danger:hover{border-color:var(--err);background:var(--err);color:#fff}
  .btn.ok{border-color:rgba(16,185,129,.45);color:#6ee7b7;background:var(--ok-bg)}
  .btn.ok:hover{border-color:var(--ok);background:var(--ok);color:#052e16}
  .btn.ghost{background:transparent;border-color:var(--line)}
  .btn.sm{padding:6px 11px;font-size:12px}
  .btn:disabled{opacity:.45;cursor:not-allowed}

  /* ---------- Layout & Grid ---------- */
  .container{max-width:1240px;margin:0 auto;padding:24px}
  .kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
  .kpi{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:14px 16px;
  }
  .kpi-label{font-size:12px;color:var(--mut);margin-bottom:4px}
  .kpi-val{font-size:20px;font-weight:700;color:var(--txt);font-family:'IBM Plex Mono',monospace}
  .kpi-val.ok{color:var(--ok)}
  .kpi-val.err{color:var(--err)}

  .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
  .col-4{grid-column:span 4}
  .col-5{grid-column:span 5}
  .col-6{grid-column:span 6}
  .col-7{grid-column:span 7}
  .col-8{grid-column:span 8}
  .col-12{grid-column:span 12}
  @media(max-width:960px){
    .kpi-strip{grid-template-columns:repeat(2,1fr)}
    .col-4,.col-5,.col-6,.col-7,.col-8{grid-column:span 12}
  }
  @media(max-width:560px){
    .container{padding:14px}
    .topbar{padding:10px 14px}
    .kpi-strip{grid-template-columns:1fr 1fr;gap:10px}
  }

  /* ---------- Card ---------- */
  .card{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:20px;
  }
  .card-head{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--line);
  }
  .card-title{font-size:14px;font-weight:700;color:var(--txt);display:flex;align-items:center;gap:8px}
  .card-title .accent{width:4px;height:14px;border-radius:2px;background:var(--acc)}

  /* ---------- Tabs ---------- */
  .tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px}
  .tab{
    padding:7px 14px;border-radius:6px;border:1px solid transparent;
    background:transparent;color:var(--mut);font-size:13px;font-weight:600;
    cursor:pointer;font-family:inherit;
  }
  .tab:hover{color:var(--txt);background:var(--bg2)}
  .tab.active{background:var(--acc-bg);color:var(--acc);border-color:rgba(34,211,238,.35)}

  /* ---------- Forms ---------- */
  .field{margin-bottom:14px}
  .field label{display:block;font-size:12px;font-weight:600;color:var(--mut);margin-bottom:6px}
  .field input,.field select,.field textarea{
    width:100%;padding:10px 12px;border-radius:6px;
    background:var(--bg);border:1px solid var(--line2);color:var(--txt);
    font-family:inherit;font-size:13px;transition:border-color .15s;
  }
  .field input.mono,.field select.mono{font-family:'IBM Plex Mono',monospace}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--acc)}
  .field input::placeholder{color:var(--dim)}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:600px){.form-row{grid-template-columns:1fr}}
  .check-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--txt);cursor:pointer}
  .check-row input{width:16px;height:16px;accent-color:var(--acc)}

  /* ---------- Data rows & tables ---------- */
  .data-row{
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;
  }
  .data-row:last-child{border-bottom:0}
  .data-key{color:var(--mut);font-size:12px}
  .data-val{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--txt)}
  .data-val.ok{color:var(--ok)} .data-val.err{color:var(--err)} .data-val.warn{color:var(--warn)}

  .tbl-wrap{overflow:auto;border:1px solid var(--line);border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line)}
  th{background:var(--bg2);color:var(--mut);font-size:12px;font-weight:600}
  tr:last-child td{border-bottom:0}

  /* ---------- Pairing Code & QR ---------- */
  .code-panel{
    background:var(--bg);border:1px solid var(--line2);border-radius:8px;
    padding:16px;margin:12px 0;
  }
  .code-block{
    font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;
    letter-spacing:4px;text-align:center;padding:12px;direction:ltr;
    color:var(--acc);user-select:all;
  }
  .code-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:8px}
  .qr-box{display:flex;justify-content:center;padding:14px;background:#fff;border-radius:6px;margin:10px auto;width:fit-content}
  .steps-list{
    margin-top:12px;padding-right:18px;font-size:12px;color:var(--mut);line-height:1.8;
  }

  /* ---------- Logs & Commands ---------- */
  .log-box{
    height:250px;overflow:auto;background:var(--bg);border:1px solid var(--line);
    border-radius:6px;padding:10px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.6;
  }
  .log-line{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:10px}
  .log-line:last-child{border-bottom:0}
  .log-time{color:var(--dim);flex-shrink:0;direction:ltr}
  .log-msg{color:var(--txt);word-break:break-word}

  .cmd-list{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--bg)}
  .cmd-item{
    padding:9px 12px;border-bottom:1px solid var(--line);font-size:13px;
    display:flex;align-items:center;gap:10px;
  }
  .cmd-item:last-child{border-bottom:0}
  .cmd-name{font-family:'IBM Plex Mono',monospace;color:var(--acc);font-weight:600;min-width:130px;direction:ltr;text-align:left}
  .cmd-cat{font-size:11px;color:var(--mut);background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:2px 8px}
  .cmd-desc{color:var(--mut);font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* ---------- Banners ---------- */
  .banner{padding:10px 14px;border-radius:6px;font-size:13px;margin:10px 0;border:1px solid}
  .banner.err,.err-banner{background:var(--err-bg);border-color:rgba(239,68,68,.4);color:#fca5a5;padding:10px 12px;border-radius:6px;font-size:13px}
  .banner.ok,.ok-banner{background:var(--ok-bg);border-color:rgba(16,185,129,.4);color:#6ee7b7;padding:10px 12px;border-radius:6px;font-size:13px}
  .banner.warn,.maint-banner{background:var(--warn-bg);border-color:rgba(245,158,11,.4);color:#fcd34d;padding:11px 14px;border-radius:6px;font-size:13px;display:flex;align-items:center;gap:10px;margin-bottom:16px}

  .login-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  .login-card{
    width:100%;max-width:420px;background:var(--card);border:1px solid var(--line2);
    border-radius:10px;padding:28px;
  }
  .login-title{font-size:20px;font-weight:700;margin-bottom:6px}
  .login-sub{color:var(--mut);font-size:13px;margin-bottom:20px}

  .hidden{display:none !important}
  .mono{font-family:'IBM Plex Mono',monospace}
  .ltr{direction:ltr;text-align:left}
  .hint{color:var(--mut);font-size:12px;line-height:1.6}
  .muted{color:var(--mut);font-size:12px}
`;

function esc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/* =====================================================================
 * PUBLIC PORTAL (Sub-Bot Pairing + Control + Live Public Status)
 * ===================================================================== */
export function renderPublicPortalHtml(err) {
	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>بوابة ربط البوت — Yono</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${SHARED_CSS}</style>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <div class="brand-mark">Y</div>
    <div>
      <div class="brand-name" id="topBotName">Yono Bot</div>
      <div class="brand-sub">بوابة ربط البوتات الفرعية والحالة المباشرة</div>
    </div>
  </div>
  <div class="topbar-right">
    <div class="conn-indicator">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">جاري الاتصال...</span>
    </div>
    <a class="btn sm ghost" href="/admin">لوحة الإدارة</a>
  </div>
</header>

<main class="container">
  <section class="kpi-strip">
    <div class="kpi">
      <div class="kpi-label">حالة البوت الأساسي</div>
      <div class="kpi-val" id="k-conn">-</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">الأوامر المتاحة</div>
      <div class="kpi-val" id="k-plugins">-</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">البوتات الفرعية النشطة</div>
      <div class="kpi-val ltr" id="k-subs">-</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">مدة التشغيل</div>
      <div class="kpi-val ltr" id="k-uptime">-</div>
    </div>
  </section>

  <div class="grid">
    <!-- Sub-Bot Pairing & Control Panel -->
    <section class="col-7">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="accent"></span>ربط وإدارة البوت الفرعي (Sub-Bot)</div>
          <span class="muted" id="subSessionBadge">غير مسجل</span>
        </div>

        <div id="subAuthArea">
          <div class="tabs">
            <button type="button" class="tab active" id="tabNewBtn" onclick="switchTab('new')">ربط رقم جديد</button>
            <button type="button" class="tab" id="tabLoginBtn" onclick="switchTab('login')">لدي كود تحكم</button>
          </div>

          <!-- Tab 1: New pairing -->
          <div id="tabNewPanel">
            <p class="hint" style="margin-bottom:14px">
              اربط رقم واتساب الخاص بك ليصبح بوتاً فرعياً مستقلاً. أدخل رقمك بالرمز الدولي بدون علامة + أو أصفار زائدة.
            </p>
            <div class="form-row">
              <div class="field">
                <label for="subPhone">رقم الهاتف (مع رمز الدولة)</label>
                <input id="subPhone" class="mono ltr" inputmode="numeric" placeholder="201xxxxxxxxx"/>
              </div>
              <div class="field">
                <label for="subPairMode">طريقة الربط</label>
                <select id="subPairMode">
                  <option value="code">كود ربط (8 أحرف وأرقام)</option>
                  <option value="qr">رمز QR</option>
                </select>
              </div>
            </div>
            <button type="button" class="primary" id="btnPairSub" onclick="pairSubBot()">إصدار كود الربط الآن</button>
            <div id="subPairMsg" class="hidden" style="margin-top:12px"></div>
          </div>

          <!-- Tab 2: Control code login -->
          <div id="tabLoginPanel" class="hidden">
            <p class="hint" style="margin-bottom:14px">
              أدخل رقم هاتفك وكود التحكم الخاص بك (مثال: LB-XXXX-YYYY) لإدارة بوتك أو إعادة إصدار كود الربط.
            </p>
            <div class="form-row">
              <div class="field">
                <label for="authPhone">رقم الهاتف</label>
                <input id="authPhone" class="mono ltr" inputmode="numeric" placeholder="201xxxxxxxxx"/>
              </div>
              <div class="field">
                <label for="authCode">كود التحكم</label>
                <input id="authCode" class="mono ltr" placeholder="LB-XXXX-YYYY"/>
              </div>
            </div>
            <button type="button" class="primary" onclick="loginSubBot()">فتح لوحة البوت الفرعي</button>
            <div id="subAuthMsg" class="hidden" style="margin-top:12px"></div>
          </div>
        </div>

        <!-- Authenticated / Active Sub-Bot View -->
        <div id="subActivePanel" class="hidden">
          <div class="data-row">
            <span class="data-key">الرقم</span>
            <span class="data-val ltr" id="sbPhone">-</span>
          </div>
          <div class="data-row">
            <span class="data-key">الحالة في واتساب</span>
            <span class="data-val" id="sbState">-</span>
          </div>
          <div class="data-row">
            <span class="data-key">كود التحكم (احفظه لإدارة البوت لاحقاً)</span>
            <span style="display:flex;align-items:center;gap:8px">
              <span class="data-val ltr" id="sbControlCode" style="color:var(--acc);font-weight:700">-</span>
              <button type="button" class="btn sm ghost" onclick="copyText($('sbControlCode').textContent, this)">نسخ</button>
            </span>
          </div>

          <!-- Live Pairing Code / QR Box -->
          <div id="sbPairingBox" class="code-panel hidden">
            <div class="hint" id="sbPairingTitle" style="text-align:center">أدخل هذا الكود في واتساب للربط:</div>
            <div id="sbPairCodeText" class="code-block hidden"></div>
            <div id="sbQrBox" class="qr-box hidden"></div>
            <div class="code-actions" id="sbCopyCodeWrap">
              <button type="button" class="btn sm primary" id="sbCopyCodeBtn" onclick="copyText($('sbPairCodeText').textContent, this)">نسخ كود واتساب</button>
              <button type="button" class="btn sm" onclick="subAction('repair','code')">إصدار كود جديد</button>
              <button type="button" class="btn sm" onclick="subAction('repair','qr')">عرض QR بدلاً من الكود</button>
            </div>
            <ol class="steps-list">
              <li>افتح تطبيق واتساب على هاتفك ثم اختر <b>الأجهزة المرتبطة (Linked Devices)</b>.</li>
              <li>اضغط <b>ربط جهاز (Link a Device)</b> ثم اختر <b>الربط برقم الهاتف</b> في الأسفل.</li>
              <li>أدخل الكود المكون من 8 خانات أعلاه واضغط تأكيد.</li>
            </ol>
          </div>

          <div id="sbErrorBanner" class="banner err hidden"></div>

          <!-- Sub-Bot Settings -->
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
            <div class="form-row">
              <div class="field">
                <label for="sbMode">وضع التشغيل</label>
                <select id="sbMode">
                  <option value="public">عام (يرد على الجميع)</option>
                  <option value="self">خاص (يرد على رقمك فقط)</option>
                </select>
              </div>
              <div class="field">
                <label for="sbPrefix">بادئة الأوامر</label>
                <input id="sbPrefix" class="mono ltr" maxlength="4" value="."/>
              </div>
            </div>
            <div class="field">
              <label for="sbCustomName">اسم البوت المخصص</label>
              <input id="sbCustomName" placeholder="Yono Sub-Bot"/>
            </div>
            <label class="check-row">
              <input type="checkbox" id="sbPaused"/>
              <span>إيقاف الردود مؤقتاً (Pause)</span>
            </label>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
              <button type="button" class="primary" onclick="saveSubSettings()">حفظ الإعدادات</button>
              <button type="button" class="btn" onclick="subAction('repair','code')">إعادة الربط</button>
              <button type="button" class="btn" onclick="subAction('regenerate-code')">تغيير كود التحكم</button>
              <button type="button" class="btn danger" onclick="subAction('reset-session')">حذف الجلسة</button>
              <button type="button" class="btn ghost" onclick="subAction('logout')">خروج</button>
            </div>
            <div id="sbActionMsg" class="hidden" style="margin-top:10px"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- System Status & Event Log -->
    <section class="col-5">
      <div class="card" style="margin-bottom:16px">
        <div class="card-head">
          <div class="card-title"><span class="accent"></span>معلومات الخادم</div>
        </div>
        <div class="data-row"><span class="data-key">اسم البوت</span><span class="data-val" id="s-name">-</span></div>
        <div class="data-row"><span class="data-key">حالة الجلسة</span><span class="data-val" id="s-reg">-</span></div>
        <div class="data-row"><span class="data-key">وضع الربط الافتراضي</span><span class="data-val" id="s-mode">-</span></div>
        <div class="data-row"><span class="data-key">الذاكرة المستخدمة</span><span class="data-val ltr" id="s-mem">-</span></div>
        <div class="data-row"><span class="data-key">رقم الإصدار</span><span class="data-val ltr" id="s-commit">-</span></div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="accent"></span>سجل الأحداث المباشر</div>
        </div>
        <div class="log-box" id="log"></div>
      </div>
    </section>
  </div>
</main>

${err ? `<div style="position:fixed;bottom:16px;left:16px;right:16px;max-width:600px;margin:auto" class="err-banner">${esc(err)}</div>` : ''}

<script>
const $ = (id) => document.getElementById(id);
let subQrObj = null, lastSubQr = null;

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status === 503){ location.reload(); throw new Error('maintenance'); }
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ...data };
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showMsg(el, text, isErr){
  if(!el) return;
  el.textContent = text;
  el.className = isErr ? 'err-banner' : 'ok-banner';
}

function copyText(text, btn){
  if(!text) return;
  navigator.clipboard?.writeText(String(text).trim()).then(() => {
    if(btn){
      const old = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  }).catch(() => {});
}

function switchTab(name){
  const isNew = name === 'new';
  $('tabNewBtn').className = isNew ? 'tab active' : 'tab';
  $('tabLoginBtn').className = !isNew ? 'tab active' : 'tab';
  $('tabNewPanel').className = isNew ? '' : 'hidden';
  $('tabLoginPanel').className = !isNew ? '' : 'hidden';
}

function renderSubQr(qr){
  const box = $('sbQrBox');
  if(!box) return;
  if(!qr){ box.className = 'qr-box hidden'; box.innerHTML = ''; lastSubQr = null; return; }
  box.className = 'qr-box';
  if(qr === lastSubQr) return;
  lastSubQr = qr;
  box.innerHTML = '';
  try {
    subQrObj = new QRCode(box, { text: qr, width: 210, height: 210, correctLevel: QRCode.CorrectLevel.M });
  } catch { box.textContent = qr; }
}

function applySubBotView(bot){
  if(!bot){
    $('subAuthArea').className = '';
    $('subActivePanel').className = 'hidden';
    $('subSessionBadge').textContent = 'غير مسجل';
    return;
  }
  $('subAuthArea').className = 'hidden';
  $('subActivePanel').className = '';
  $('subSessionBadge').textContent = bot.pairStatus === 'connected' ? 'متصل الآن ✓' : (bot.pairStatus || 'جاهز');
  $('sbPhone').textContent = '+' + bot.phone;
  $('sbControlCode').textContent = bot.controlCode || '-';

  const stEl = $('sbState');
  if(bot.pairStatus === 'connected' || bot.connection === 'open'){
    stEl.textContent = 'متصل بالواتساب ✓';
    stEl.className = 'data-val ok';
  } else if(bot.pairStatus === 'pairing_code'){
    stEl.textContent = 'بانتظار إدخال كود الربط';
    stEl.className = 'data-val warn';
  } else if(bot.pairStatus === 'qr'){
    stEl.textContent = 'بانتظار مسح QR';
    stEl.className = 'data-val warn';
  } else if(bot.pairStatus === 'error' || bot.pairStatus === 'logged_out'){
    stEl.textContent = 'غير متصل (' + bot.pairStatus + ')';
    stEl.className = 'data-val err';
  } else {
    stEl.textContent = bot.connection || bot.pairStatus || 'خامل';
    stEl.className = 'data-val';
  }

  const pairBox = $('sbPairingBox');
  const codeEl = $('sbPairCodeText');
  const copyBtn = $('sbCopyCodeBtn');
  if(bot.pairStatus !== 'connected' && (bot.pairingCode || bot.qr)){
    pairBox.className = 'code-panel';
    if(bot.pairingCode){
      codeEl.className = 'code-block';
      codeEl.textContent = bot.pairingCode;
      if(copyBtn) copyBtn.className = 'btn sm primary';
      $('sbPairingTitle').textContent = 'أدخل كود الربط في واتساب (الأجهزة المرتبطة):';
    } else {
      codeEl.className = 'code-block hidden';
      if(copyBtn) copyBtn.className = 'btn sm primary hidden';
      $('sbPairingTitle').textContent = 'امسح رمز QR من تطبيق واتساب (الأجهزة المرتبطة):';
    }
    if(bot.qr){
      renderSubQr(bot.qr);
    } else {
      renderSubQr(null);
    }
  } else {
    pairBox.className = 'code-panel hidden';
    renderSubQr(null);
  }

  const errEl = $('sbErrorBanner');
  if(bot.pairError){
    errEl.className = 'banner err';
    errEl.textContent = 'تنبيه: ' + bot.pairError;
  } else {
    errEl.className = 'banner err hidden';
  }

  const actId = document.activeElement ? document.activeElement.id : '';
  if(!['sbMode','sbPrefix','sbCustomName','sbPaused'].includes(actId) && bot.settings){
    $('sbMode').value = bot.settings.mode === 'self' ? 'self' : 'public';
    $('sbPrefix').value = bot.settings.prefix || '.';
    $('sbCustomName').value = bot.settings.customName || '';
    $('sbPaused').checked = !!bot.settings.paused;
  }
}

async function pairSubBot(){
  const phone = ($('subPhone').value || '').trim();
  const mode = $('subPairMode').value || 'code';
  const msg = $('subPairMsg');
  const btn = $('btnPairSub');
  if(!phone){ showMsg(msg, 'أدخل رقم الهاتف أولاً مع رمز الدولة', true); return; }
  btn.disabled = true;
  btn.textContent = 'جاري إنشاء جلسة الربط...';
  try{
    const r = await api('/api/public/sub/pair', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ phone, mode })
    });
    if(r.ok && r.bot){
      showMsg(msg, r.message || 'تم إصدار بيانات الربط', false);
      applySubBotView(r.bot);
    } else {
      showMsg(msg, r.error || 'تعذر بدء الربط', true);
    }
  } catch(e){
    showMsg(msg, e.message || 'حدث خطأ في الاتصال', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'إصدار كود الربط الآن';
  }
}

async function loginSubBot(){
  const phone = ($('authPhone').value || '').trim();
  const code = ($('authCode').value || '').trim();
  const msg = $('subAuthMsg');
  try{
    const r = await api('/api/public/sub/auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ phone, code })
    });
    if(r.ok && r.bot){
      msg.className = 'hidden';
      applySubBotView(r.bot);
    } else {
      showMsg(msg, r.error || 'بيانات الدخول غير صحيحة', true);
    }
  } catch(e){ showMsg(msg, e.message, true); }
}

async function saveSubSettings(){
  const msg = $('sbActionMsg');
  try{
    const r = await api('/api/public/sub/settings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        mode: $('sbMode').value,
        prefix: $('sbPrefix').value,
        customName: $('sbCustomName').value,
        paused: $('sbPaused').checked
      })
    });
    if(r.ok){
      showMsg(msg, r.message || 'تم الحفظ', false);
      if(r.bot) applySubBotView(r.bot);
    } else showMsg(msg, r.error || 'فشل الحفظ', true);
  } catch(e){ showMsg(msg, e.message, true); }
}

async function subAction(action, mode){
  if(action === 'reset-session' && !confirm('هل تريد حذف جلسة واتساب لهذا البوت الفرعي؟')) return;
  const msg = $('sbActionMsg');
  showMsg(msg, 'جاري التنفيذ...', false);
  try{
    const r = await api('/api/public/sub/action', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action, mode })
    });
    if(action === 'logout'){
      applySubBotView(null);
      return;
    }
    if(r.ok){
      showMsg(msg, r.message || 'تم التنفيذ', false);
      if(r.bot) applySubBotView(r.bot);
    } else {
      showMsg(msg, r.error || 'تعذر تنفيذ الطلب', true);
    }
  } catch(e){ showMsg(msg, e.message, true); }
}

function fmtUptime(sec){
  const s = Math.floor(sec || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
}

async function refresh(){
  try{
    const s = await api('/api/public/status');
    if(s.ok){
      const dot = $('statusDot'), txt = $('statusText');
      if(s.connected){
        dot.className = 'status-dot on';
        txt.textContent = 'متصل';
        $('k-conn').textContent = 'متصل ✓';
        $('k-conn').className = 'kpi-val ok';
      } else if(s.connection === 'connecting' || s.connection === 'starting'){
        dot.className = 'status-dot warn';
        txt.textContent = 'جاري الاتصال';
        $('k-conn').textContent = 'جاري الاتصال';
        $('k-conn').className = 'kpi-val';
      } else {
        dot.className = 'status-dot off';
        txt.textContent = 'غير متصل';
        $('k-conn').textContent = 'غير متصل';
        $('k-conn').className = 'kpi-val err';
      }
      if(s.botName) $('topBotName').textContent = s.botName;
      $('k-plugins').textContent = s.commands || 0;
      $('k-subs').textContent = (s.activeSubBotsCount || 0) + ' / ' + (s.subBotsCount || 0);
      $('k-uptime').textContent = fmtUptime(s.uptimeSec);
      $('s-name').textContent = s.botName || '-';
      $('s-reg').textContent = s.sessionRegistered ? 'مسجلة' : 'غير مسجلة';
      $('s-mode').textContent = s.loginMode === 'qr' ? 'QR' : 'Pairing Code';
      $('s-mem').textContent = (s.memoryMB || 0) + ' MB';
      $('s-commit').textContent = s.commit || '-';

      const log = $('log');
      if(log){
        log.innerHTML = (s.events || []).map(e => {
          const t = new Date(e.ts || Date.now()).toLocaleTimeString();
          return '<div class="log-line"><span class="log-time">'+esc(t)+'</span><span class="log-msg">'+esc(e.text || '')+'</span></div>';
        }).join('') || '<div class="muted">لا توجد أحداث بعد</div>';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch {}

  try{
    const sub = await api('/api/public/sub/me');
    if(sub.authenticated && sub.bot) applySubBotView(sub.bot);
  } catch {}
}

setInterval(refresh, 3000);
refresh();
</script>
</body>
</html>`;
}

/* =====================================================================
 * ADMIN LOGIN (/admin unauthenticated)
 * ===================================================================== */
export function renderAdminLoginHtml(err) {
	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>دخول الإدارة — Yono</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <div class="brand-mark">A</div>
      <div>
        <div class="login-title" style="margin-bottom:0">لوحة تحكم الإدارة</div>
        <div class="muted">إدارة البوت الأساسي والبوتات الفرعية</div>
      </div>
    </div>
    ${err ? `<div class="err-banner" style="margin-bottom:14px">${esc(err)}</div>` : ''}
    <form method="POST" action="/login">
      <div class="field">
        <label for="password">كلمة مرور الإدارة (من ملف system/panel-config.json)</label>
        <input id="password" name="password" type="password" class="mono ltr" required autofocus placeholder="أدخل كلمة المرور"/>
      </div>
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:16px">
        <button type="submit" class="primary">تسجيل الدخول</button>
        <a class="btn ghost sm" href="/">العودة لبوابة الربط</a>
      </div>
    </form>
  </div>
</div>
</body>
</html>`;
}

/* =====================================================================
 * INSTALL RENDER JS (Admin main bot pairing box)
 * ===================================================================== */
export const INSTALL_RENDER_JS = `function formatPairErr(err){
  const raw = String(err || '').trim();
  if(!raw) return '';
  if(/rate-overlimit/i.test(raw)){
    return 'فرض واتساب تقييداً مؤقتاً لكثرة طلبات كود الربط (rate-overlimit). انتظر 1-2 دقيقة ثم اضغط إصدار كود الربط، أو اختر رمز QR.';
  }
  return 'تعذر إصدار كود الربط: ' + raw;
}
function renderInstall(d){
  const box = document.getElementById('installBody');
  if(!box) return;
  const activeId = document.activeElement ? document.activeElement.id : '';
  if(activeId === 'lm' || activeId === 'ph') return;
  const showQr = d.loginMode === 'qr' && !!d.qr;
  const sig = [!!d.connected, d.pairingCode || '', d.pairingError || '', showQr ? '1' : '0', d.loginMode || '', d.configuredPhone || ''].join('|');
  if(window._lastInstallSig === sig) return;
  window._lastInstallSig = sig;
  if(d.connected){
    box.innerHTML = '<div class="ok-banner">البوت الأساسي متصل بالواتساب بنجاح ✓ — لتغيير الرقم استخدم <b>إعادة ضبط الجلسة</b>.</div>';
    return;
  }
  let html = '';
  if(d.pairingCode && d.loginMode !== 'qr'){
    html += '<div class="code-panel">'
      + '<div class="hint" style="text-align:center">افتح واتساب ← الأجهزة المرتبطة ← الربط برقم الهاتف ثم أدخل:</div>'
      + '<div class="code-block" id="mainPairCodeVal">' + esc(d.pairingCode) + '</div>'
      + '<div class="code-actions"><button type="button" class="btn sm primary" onclick="copyText(document.getElementById(\\'mainPairCodeVal\\').textContent, this)">نسخ كود الربط</button></div>'
      + '</div>';
  }
  if(showQr){
    html += '<div class="code-panel"><div class="hint" style="text-align:center">امسح رمز QR من تطبيق واتساب:</div><div class="qr-box" id="qr"></div></div>';
  }
  if(d.pairingError && d.loginMode !== 'qr' && !d.pairingCode){
    html += '<div class="banner err">' + esc(formatPairErr(d.pairingError)) + '</div>';
  } else if(!d.pairingCode && !showQr){
    html += (d.loginMode === 'code' && !d.configuredPhone)
      ? '<div class="hint">أدخل رقم البوت بالرمز الدولي ثم اضغط <b>إصدار كود الربط</b>.</div>'
      : '<div class="hint">بانتظار استجابة خادم واتساب لإصدار ' + (d.loginMode === 'qr' ? 'رمز QR' : 'كود الربط') + '...</div>';
  }
  html += '<div style="margin-top:14px"><div class="form-row">'
     + '<div class="field"><label>طريقة الربط</label>'
     + '<select id="lm"><option value="code"' + (d.loginMode === 'code' ? ' selected' : '') + '>كود ربط (Pairing Code)</option>'
     + '<option value="qr"' + (d.loginMode === 'qr' ? ' selected' : '') + '>رمز QR</option></select></div>'
     + '<div class="field"><label>رقم البوت الأساسي</label>'
     + '<input id="ph" class="ltr mono" value="' + esc(d.configuredPhone) + '" placeholder="201505xxxxxx"></div></div>'
     + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
     + '<button type="button" class="primary sm" onclick="pairMainNow()">إصدار كود الربط الآن</button>'
     + '<button type="button" class="btn sm" onclick="applyLogin()">حفظ وتطبيق الطريقة</button>'
     + '<button type="button" class="btn sm ghost" onclick="refresh()">تحديث</button></div></div>';
  box.innerHTML = html;
  if(showQr) renderQR(d.qr);
}`;

/* =====================================================================
 * ADMIN PANEL (authenticated)
 * ===================================================================== */
export function renderAdminPanelHtml(installRenderJs) {
	const IJS = installRenderJs || INSTALL_RENDER_JS;
	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>لوحة الإدارة — Yono</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${SHARED_CSS}</style>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <div class="brand-mark">A</div>
    <div>
      <div class="brand-name">لوحة تحكم الإدارة</div>
      <div class="brand-sub">إدارة البوت الأساسي · البوتات الفرعية · الأوامر</div>
    </div>
  </div>
  <div class="topbar-right">
    <div class="conn-indicator">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">جاري الاتصال...</span>
    </div>
    <a class="btn sm ghost" href="/">البوابة العامة</a>
    <button type="button" class="btn sm danger" onclick="logout()">تسجيل الخروج</button>
  </div>
</header>

<main class="container">
  <div id="maintBanner" class="maint-banner hidden">
    <span>⚠</span><span>وضع الصيانة <b>مفعّل</b> — الزوار يرون شاشة الصيانة حالياً.</span>
  </div>

  <div class="grid">
    <!-- Status -->
    <section class="col-4">
      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>حالة البوت الأساسي</div></div>
        <div class="data-row"><span class="data-key">الاتصال</span><span class="data-val" id="s-conn">-</span></div>
        <div class="data-row"><span class="data-key">الجلسة</span><span class="data-val" id="s-reg">-</span></div>
        <div class="data-row"><span class="data-key">طريقة الربط</span><span class="data-val" id="s-mode">-</span></div>
        <div class="data-row"><span class="data-key">الرقم</span><span class="data-val ltr" id="s-phone">-</span></div>
        <div class="data-row"><span class="data-key">الاسم</span><span class="data-val" id="s-name">-</span></div>
        <div class="data-row"><span class="data-key">الإضافات (Plugins)</span><span class="data-val" id="s-plugins">-</span></div>
        <div class="data-row"><span class="data-key">الذاكرة</span><span class="data-val ltr" id="s-mem">-</span></div>
        <div class="data-row"><span class="data-key">مدة التشغيل</span><span class="data-val ltr" id="s-uptime">-</span></div>
        <div class="data-row"><span class="data-key">الإصدار</span><span class="data-val ltr" id="s-commit">-</span></div>
      </div>
    </section>

    <!-- Main Pairing -->
    <section class="col-8">
      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>ربط البوت الأساسي بواتساب</div></div>
        <div id="installBody"></div>
      </div>
    </section>

    <!-- Controls & Send -->
    <section class="col-6">
      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>التحكم وإرسال رسالة تجريبية</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button type="button" class="btn" onclick="act('restart')">↻ إعادة تشغيل</button>
          <button type="button" class="btn danger" onclick="act('reset-session')">⊘ إعادة ضبط الجلسة</button>
          <button type="button" class="btn" onclick="act('stop')">■ إيقاف</button>
          <button type="button" class="btn ok" onclick="act('start')">▶ تشغيل</button>
        </div>
        <div class="form-row">
          <div class="field"><label>رقم المستلم</label><input id="sendNum" class="mono ltr" inputmode="numeric" placeholder="201xxxxxxxxx"/></div>
          <div class="field"><label>نص الرسالة</label><input id="sendMsg" placeholder="مرحباً"/></div>
        </div>
        <button type="button" class="primary" onclick="sendMsg()">إرسال رسالة اختبارية</button>
        <p id="ctrlMsg" class="muted" style="margin-top:10px"></p>
      </div>
    </section>

    <!-- Security & Maintenance & Updates -->
    <section class="col-6">
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><div class="card-title"><span class="accent"></span>وضع الصيانة وكلمة المرور</div></div>
        <div class="data-row" style="margin-bottom:10px"><span class="data-key">وضع الصيانة</span><span class="data-val" id="maintState">-</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn danger sm" onclick="setMaint(true)">تفعيل الصيانة</button>
          <button type="button" class="btn ok sm" onclick="setMaint(false)">إيقاف الصيانة</button>
          <button type="button" class="btn sm" onclick="rotatePw()">توليد كلمة مرور جديدة</button>
        </div>
        <p id="maintMsg" class="muted" style="margin-top:8px"></p>
        <p id="pwMsg" class="muted" style="margin-top:4px"></p>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>التحديثات</div></div>
        <p class="hint" style="margin-bottom:10px">تحديث تلقائي كل <span id="autoInt">60</span> دقيقة.</p>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn sm" onclick="checkUpdate()">فحص التحديثات</button>
          <button type="button" class="primary sm" onclick="applyUpdate()">تطبيق التحديث</button>
        </div>
        <p id="updMsg" class="muted" style="margin-top:8px"></p>
      </div>
    </section>

    <!-- Sub-Bots Monitor -->
    <section class="col-12">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="accent"></span>البوتات الفرعية المسجلة (Sub-Bots)</div>
          <span class="muted" id="subCountMeta">0 مسجل</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>الاسم</th>
                <th>الحالة</th>
                <th>الوضع</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody id="subBotsTable">
              <tr><td colspan="5" class="muted">لا توجد بوتات فرعية مسجلة</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Commands -->
    <section class="col-12">
      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>متصفح الأوامر</div></div>
        <div class="form-row" style="margin-bottom:12px">
          <div class="field" style="margin-bottom:0"><input id="cmdSearch" placeholder="ابحث عن أمر..." oninput="loadCommands()"/></div>
          <div class="field" style="margin-bottom:0"><select id="cmdCat" onchange="loadCommands()"><option value="">كل التصنيفات</option></select></div>
        </div>
        <div class="cmd-list" id="cmdList"></div>
        <p id="cmdMeta" class="muted" style="margin-top:8px"></p>
      </div>
    </section>

    <!-- Log -->
    <section class="col-12">
      <div class="card">
        <div class="card-head"><div class="card-title"><span class="accent"></span>سجل الأحداث</div></div>
        <div class="log-box" id="log"></div>
      </div>
    </section>
  </div>
</main>

<script>
const $ = (id) => document.getElementById(id);
let lastQR = null, qrObj = null, lastCmdSig = '';

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status === 401){ location.reload(); throw new Error('auth'); }
  if(r.status === 503){ location.reload(); throw new Error('maintenance'); }
  return r.json().catch(() => ({}));
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function copyText(text, btn){
  if(!text) return;
  navigator.clipboard?.writeText(String(text).trim()).then(() => {
    if(btn){
      const old = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  }).catch(() => {});
}

async function logout(){
  await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
  location.reload();
}

${IJS}

function pairMainNow(){
  const phone = ($('ph') && $('ph').value || '').trim();
  const mode = ($('lm') && $('lm').value) || 'code';
  if(mode === 'qr'){
    applyLogin();
    return;
  }
  const el = $('ctrlMsg');
  api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'pair-main',phone,loginMode:mode})})
    .then(r => {
      if(r.error){ if(el) el.textContent = '⚠ ' + r.error; }
      else { if(el) el.textContent = r.pairingCode ? ('كود الربط: ' + r.pairingCode) : (r.message || 'تم'); }
      refresh();
    })
    .catch(e => { if(el) el.textContent = '⚠ ' + e.message; refresh(); });
}
function applyLogin(){
  const phone = ($('ph') && $('ph').value || '').trim();
  const mode = ($('lm') && $('lm').value) || 'code';
  api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'set-login',phone,loginMode:mode})})
    .then(r => { const el=$('ctrlMsg'); if(el) el.textContent = r.message || 'تم الحفظ'; })
    .catch(e => { const el=$('ctrlMsg'); if(el) el.textContent = '⚠ ' + e.message; });
}

async function act(action, extra){
  if(action==='reset-session' && !confirm('نقل الجلسة الحالية لنسخة احتياطية وإعادة التشغيل؟')) return;
  if(action==='stop' && !confirm('إيقاف البوت الأساسي؟')) return;
  const el=$('ctrlMsg'); if(el) el.textContent='جاري التنفيذ...';
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action, ...(extra||{})})});
    if(el) el.textContent = r.message || (r.ok ? 'تم' : 'فشل');
    refresh();
  }catch(e){ if(el) el.textContent='⚠ '+e.message; }
}
async function sendMsg(){
  const el=$('ctrlMsg');
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'send',to:$('sendNum').value,text:$('sendMsg').value})});
    if(el) el.textContent = r.ok ? ('✓ ' + (r.message||'تم الإرسال')) : ('⚠ '+(r.message||'فشل الإرسال'));
  }catch(e){ if(el) el.textContent='⚠ '+e.message; }
}

async function checkUpdate(){
  const el=$('updMsg'); if(el) el.textContent='جاري الفحص...';
  const r = await api('/api/update-check');
  if(el) el.textContent = r.error ? ('⚠ '+r.error) : (r.upToDate ? '✓ محدث لآخر إصدار' : ('⬇ متاح تحديث: '+r.download.length+' ملف'));
}
async function applyUpdate(){
  const el=$('updMsg'); if(el) el.textContent='جاري التحديث...';
  await api('/api/update',{method:'POST'});
  if(el) el.textContent='⏳ يتم تطبيق التحديث...';
}

async function setMaint(on){
  const r = await api('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!!on})});
  const el=$('maintMsg'); if(el) el.textContent = r.message || 'تم';
  refresh();
}
async function rotatePw(){
  if(!confirm('توليد كلمة مرور جديدة وإنهاء الجلسات الأخرى؟')) return;
  const r = await api('/api/rotate-password',{method:'POST'});
  const el=$('pwMsg');
  if(el) el.textContent = r.password ? ('كلمة المرور الجديدة: ' + r.password) : 'فشل التوليد';
}

async function loadCommands(){
  const q = $('cmdSearch').value || '';
  const cat = $('cmdCat').value || '';
  const r = await api('/api/commands?q='+encodeURIComponent(q)+'&cat='+encodeURIComponent(cat));
  if(!r.ok) return;
  const sel = $('cmdCat');
  if(sel && sel.options.length <= 1 && r.categories){
    for(const c of r.categories){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.label+' ('+c.count+')'; sel.appendChild(o); }
  }
  const sig = r.commands.map(c => c.primary).join('|') + '#' + r.filtered;
  if(sig === lastCmdSig) return; lastCmdSig = sig;
  const list = $('cmdList');
  if(list) list.innerHTML = r.commands.map(c =>
    '<div class="cmd-item"><span class="cmd-name">'+esc(c.primary)+'</span>'+
    '<span class="cmd-cat">'+esc(c.categoryLabel)+'</span>'+
    '<span class="cmd-desc">'+esc(c.description||'')+'</span></div>'
  ).join('') || '<div class="cmd-item muted">لا توجد أوامر مطابقة</div>';
  const meta=$('cmdMeta'); if(meta) meta.textContent = r.filtered+' من '+r.total+' أمر'+(r.truncated?' (مقتطع)':'');
}

function fmtUptime(sec){
  const s=Math.floor(sec||0), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60);
  return (d?d+'d ':'')+h+'h '+m+'m';
}
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
  const dot=$('statusDot'), txt=$('statusText');
  if(s.connected){ if(dot) dot.className='status-dot on'; if(txt) txt.textContent='متصل'; }
  else { if(dot) dot.className='status-dot off'; if(txt) txt.textContent='غير متصل'; }
  if($('s-conn')) $('s-conn').textContent = s.connection || '-';
  if($('s-reg')) $('s-reg').textContent = s.sessionRegistered ? 'مسجلة' : 'غير مسجلة';
  if($('s-mode')) $('s-mode').textContent = s.loginMode === 'qr' ? 'QR' : 'Code';
  if($('s-phone')) $('s-phone').textContent = s.configuredPhone || s.phone || '-';
  if($('s-name')) $('s-name').textContent = s.name || '-';
  if($('s-plugins')) $('s-plugins').textContent = s.commands || 0;
  if($('s-mem')) $('s-mem').textContent = (s.memoryMB || 0) + ' MB';
  if($('s-uptime')) $('s-uptime').textContent = fmtUptime(s.uptimeSec || 0);
  if($('s-commit')) $('s-commit').textContent = s.commit || '-';
  if($('autoInt') && s.autoUpdateIntervalMin) $('autoInt').textContent = s.autoUpdateIntervalMin;
  const mb=$('maintBanner'); if(mb) mb.className = s.maintenance ? 'maint-banner' : 'maint-banner hidden';
  if($('maintState')) $('maintState').textContent = s.maintenance ? 'مفعّل' : 'متوقف';

  try{ renderInstall(s); }catch(e){}

  const subs = s.subBots || [];
  if($('subCountMeta')) $('subCountMeta').textContent = subs.length + ' مسجل';
  const tb = $('subBotsTable');
  if(tb){
    tb.innerHTML = subs.length ? subs.map(sb =>
      '<tr>'
      + '<td class="ltr mono">+'+esc(sb.phone)+'</td>'
      + '<td>'+esc(sb.waName || '-')+'</td>'
      + '<td class="mono">'+esc(sb.pairStatus)+'</td>'
      + '<td class="mono">'+(sb.paused ? 'متوقف' : esc(sb.mode))+'</td>'
      + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button type="button" class="btn sm" onclick="act(\\'sub-stop\\',{phone:\\''+esc(sb.phone)+'\\'})">إيقاف</button>'
      + '<button type="button" class="btn sm danger" onclick="act(\\'sub-reset\\',{phone:\\''+esc(sb.phone)+'\\'})">حذف الجلسة</button>'
      + '</div></td></tr>'
    ).join('') : '<tr><td colspan="5" class="muted">لا توجد بوتات فرعية مسجلة</td></tr>';
  }

  const log=$('log');
  if(log){
    log.innerHTML = (s.events||[]).map(e => {
      const t = new Date(e.ts || Date.now()).toLocaleTimeString();
      return '<div class="log-line"><span class="log-time">'+esc(t)+'</span><span class="log-msg">'+esc(e.text||'')+'</span></div>';
    }).join('') || '<div class="muted">لا توجد أحداث</div>';
    log.scrollTop = log.scrollHeight;
  }
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
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>الموقع في وضع الصيانة — Yono</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card" style="text-align:center">
    <div class="brand-mark" style="margin:0 auto 16px">M</div>
    <div class="login-title">الموقع تحت الصيانة</div>
    <div class="login-sub">يتم تحديث البوت وصيانته حالياً. يرجى المحاولة بعد قليل.</div>
    ${msg ? `<div class="err-banner" style="margin-top:12px">${esc(msg)}</div>` : ''}
    <div style="margin-top:20px">
      <a class="btn sm ghost" href="/admin">دخول الإدارة</a>
    </div>
  </div>
</div>
</body>
</html>`;
}
