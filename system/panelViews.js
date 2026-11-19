/**
 * panelViews.js — واجهات لوحة التحكم الافتراضية ولوحة الأدمن
 * -------------------------------------------------------------------------
 * - الواجهة الافتراضية العامة: ربط حساب واتساب + حفظ كود التحكم + إدارة بوت المستخدم
 * - لوحة الأدمن: متابعة الحالة + إدارة البوت الرئيسي وجميع البوتات الفرعية + دليل الأوامر + المحاكي
 */

const SHARED_CSS = `
*{box-sizing:border-box;font-family:system-ui,'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif}
:root{
  --bg:#060913;
  --surface:#0d1424;
  --surface2:#080d18;
  --surface3:#131d33;
  --border:rgba(148,163,184,0.14);
  --border2:rgba(148,163,184,0.26);
  --text:#f1f5f9;
  --muted:#94a3b8;
  --accent:#10b981;
  --accent-ink:#03261a;
  --sky:#38bdf8;
  --amber:#f59e0b;
  --red:#ef4444;
  --ease:cubic-bezier(0.16,1,0.3,1);
}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);overflow-x:hidden;white-space:normal;word-wrap:break-word;overflow-wrap:break-word}
body{padding:18px;position:relative;white-space:normal;word-wrap:break-word;overflow-wrap:break-word}
.ambient{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.ambient::before,.ambient::after{
  content:"";position:absolute;border-radius:50%;filter:blur(90px);opacity:0.18;
  will-change:transform;animation:floatOrb 18s ease-in-out infinite alternate;
}
.ambient::before{width:460px;height:460px;top:-120px;right:-80px;background:radial-gradient(circle,#10b981,transparent 70%)}
.ambient::after{width:520px;height:520px;bottom:-160px;left:-100px;background:radial-gradient(circle,#38bdf8,transparent 70%);animation-delay:-7s}
@keyframes floatOrb{
  0%{transform:translate3d(0,0,0) scale(1)}
  100%{transform:translate3d(32px,24px,0) scale(1.08)}
}
@keyframes fadeSlideUp{
  from{opacity:0;transform:translate3d(0,12px,0)}
  to{opacity:1;transform:translate3d(0,0,0)}
}
@keyframes panelFadeIn{
  from{opacity:0;transform:translate3d(0,8px,0)}
  to{opacity:1;transform:translate3d(0,0,0)}
}
@keyframes shimmerSlide{
  0%{transform:translateX(100%)}
  100%{transform:translateX(-100%)}
}
@media (prefers-reduced-motion:reduce){
  .ambient::before,.ambient::after,.anim-in,.panel.active,.shimmer::after{animation:none!important;transition:none!important}
}
.wrap{max-width:1280px;margin:0 auto;position:relative;z-index:1}
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;
  padding:12px 18px;margin-bottom:20px;
  background:rgba(13,20,36,0.88);backdrop-filter:blur(12px);
  border:1px solid var(--border);border-radius:16px;
  animation:fadeSlideUp .35s var(--ease) both;
}
.brand-word{font-size:18px;font-weight:800;letter-spacing:-0.01em;white-space:nowrap;flex-shrink:0;color:#fff;text-decoration:none}
.nav-links{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.nav-link{
  background:transparent;border:0;color:var(--muted);padding:6px 4px;font-size:14px;font-weight:600;
  cursor:pointer;white-space:nowrap;flex-shrink:0;border-bottom:2px solid transparent;border-radius:0;
  transition:color .18s var(--ease),border-color .18s var(--ease);
}
.nav-link:hover{color:#fff;background:transparent}
.nav-link.active{color:var(--accent);border-bottom-color:var(--accent)}
.top-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
.status-text{font-size:13px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.status-text.on{color:#4ade80}
.status-text.off{color:#f87171}
.status-text.warn{color:#fbbf24}

.card{
  background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;min-width:0;
  transition:border-color .2s var(--ease),transform .2s var(--ease);
  white-space:normal;word-wrap:break-word;overflow-wrap:break-word;word-break:keep-all;
}
.card:hover{border-color:var(--border2)}
.anim-in{animation:fadeSlideUp .4s var(--ease) both}
.anim-d1{animation-delay:.05s}.anim-d2{animation-delay:.1s}.anim-d3{animation-delay:.15s}
.card h2{margin:0 0 14px;font-size:16px;font-weight:700;color:#e2e8f0;display:flex;gap:8px;align-items:center;justify-content:space-between}
.meta-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--border);font-size:14px;font-variant-numeric:tabular-nums}
.row:last-child{border-bottom:0}
.row span:first-child{color:var(--muted)}
button{
  border:0;border-radius:10px;padding:10px 18px;cursor:pointer;font-weight:700;font-size:14px;
  background:#1e293b;color:var(--text);white-space:nowrap;flex-shrink:0;
  transition:transform .16s var(--ease),background-color .16s var(--ease),border-color .16s var(--ease);
}
button:hover{background:#283548}
button:active{transform:scale(0.98)}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--sky);outline-offset:2px}
button.pri{background:var(--accent);color:var(--accent-ink)}
button.pri:hover{background:#34d399}
button.sky{background:var(--sky);color:#042436}
button.sky:hover{background:#7dd3fc}
button.warn{background:var(--amber);color:#361c00}
button.danger{background:#b91c1c;color:#fff}
button.danger:hover{background:#dc2626}
button.ghost{background:transparent;border:1px solid var(--border2);color:var(--text)}
button.ghost:hover{background:rgba(255,255,255,0.05);border-color:var(--sky)}
button.sm{padding:7px 12px;font-size:12px;border-radius:8px}
button:disabled{opacity:.45;cursor:not-allowed;transform:none}

.actions{display:flex;flex-wrap:wrap;gap:8px}
label.lbl{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px}
input,select,textarea{
  width:100%;padding:11px 13px;border-radius:10px;border:1px solid var(--border2);
  background:var(--surface2);color:var(--text);margin-bottom:10px;font-size:14px;
  transition:border-color .18s var(--ease);
}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent)}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.ltr{direction:ltr;unicode-bidi:plaintext}
.hint{color:var(--muted);font-size:13px;line-height:1.7;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;word-break:keep-all}
small.t{color:#64748b}

.kpi-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.kpi-box{
  background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;
  display:flex;flex-direction:column;gap:4px;min-width:0;
}
.kpi-label{font-size:12px;color:var(--muted)}
.kpi-val{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:#fff}
.kpi-val.ltr{text-align:right}

.seg{display:inline-flex;gap:4px;padding:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px}
.seg button{padding:7px 14px;font-size:13px;background:transparent;color:var(--muted);border-radius:8px}
.seg button.active{background:var(--accent);color:var(--accent-ink)}

.switch-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:9px 0;border-bottom:1px dashed var(--border);font-size:14px;
}
.switch-row:last-child{border-bottom:0}
.toggle{position:relative;display:inline-flex;width:44px;height:24px;flex-shrink:0;cursor:pointer}
.toggle input{opacity:0;width:0;height:0;margin:0}
.toggle-track{
  position:absolute;inset:0;border-radius:999px;background:#1e293b;border:1px solid var(--border2);
  transition:background-color .18s var(--ease),border-color .18s var(--ease);
}
.toggle-track::before{
  content:"";position:absolute;width:18px;height:18px;top:2px;left:2px;border-radius:50%;background:#cbd5e1;
  transition:transform .18s var(--ease),background-color .18s var(--ease);
}
.toggle input:checked + .toggle-track{background:rgba(16,185,129,0.25);border-color:var(--accent)}
.toggle input:checked + .toggle-track::before{transform:translateX(20px);background:#34d399}

.code-vault{
  background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(56,189,248,0.08));
  border:1px solid rgba(16,185,129,0.35);border-radius:12px;padding:14px;margin:10px 0;
}
.code-big{
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;font-weight:800;letter-spacing:3px;
  color:#4ade80;direction:ltr;text-align:center;font-variant-numeric:tabular-nums;
  padding:10px 8px;background:rgba(6,9,19,0.75);border-radius:10px;margin:8px 0;
}
.msg{
  position:fixed;bottom:18px;left:50%;transform:translate3d(-50%,16px,0);
  background:#052e1a;border:1px solid #166534;color:#bbf7d0;
  padding:10px 18px;border-radius:12px;font-size:14px;font-weight:600;
  opacity:0;transition:opacity .22s var(--ease),transform .22s var(--ease);pointer-events:none;z-index:120;
}
.msg.show{opacity:1;transform:translate3d(-50%,0,0)}
.err-banner{
  margin-top:10px;background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;
  padding:10px 12px;border-radius:10px;font-size:13px;
}

@media (max-width:860px){
  body{padding:12px}
  .kpi-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .topbar{padding:10px 12px;gap:10px}
}
`;

export function renderPublicPortalHtml(err = '') {
  const autoOpenAdmin = err ? 'true' : 'false';
  const safeErr = String(err || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>لايت بوت — ربط واتساب وإدارة بوتك</title>
<style>${SHARED_CSS}
.hero-band{
  margin-bottom:20px;padding:24px;border-radius:18px;
  background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(13,20,36,0.95) 55%,rgba(56,189,248,0.1));
  border:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;
  animation:fadeSlideUp .38s var(--ease) both;
}
.hero-title{margin:0 0 8px;font-size:clamp(22px,3.2vw,32px);font-weight:800;line-height:1.25;text-wrap:balance;color:#fff}
.hero-sub{margin:0;color:var(--muted);font-size:14px;line-height:1.7;max-width:66ch}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 18px}
.step{
  padding:10px 12px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);
  font-size:13px;color:var(--muted);position:relative;overflow:hidden;
  transition:border-color .2s var(--ease),color .2s var(--ease);
}
.step.done{border-color:rgba(16,185,129,0.45);color:#bbf7d0}
.step.active{border-color:var(--sky);color:#e0f2fe}
.step.active::after{
  content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(56,189,248,0.14),transparent);
  animation:shimmerSlide 1.8s infinite;
}
.portal-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.split-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}

.modal-backdrop{
  position:fixed;inset:0;background:rgba(3,7,18,0.75);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;padding:16px;z-index:100;
  opacity:0;pointer-events:none;transition:opacity .2s var(--ease);
}
.modal-backdrop.open{opacity:1;pointer-events:auto}
.modal-card{
  width:min(100%,410px);background:var(--surface);border:1px solid var(--border2);border-radius:18px;
  padding:22px;transform:translate3d(0,14px,0) scale(.98);transition:transform .24s var(--ease);
}
.modal-backdrop.open .modal-card{transform:translate3d(0,0,0) scale(1)}

@media (max-width:900px){
  .portal-grid{grid-template-columns:minmax(0,1fr)}
  .steps{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:640px){
  .hero-band{flex-direction:column;align-items:flex-start;gap:14px}
  .hero-band > div:first-child{width:100%;min-width:0}
  .hero-band .meta-line{width:100%;justify-content:flex-start;flex-wrap:wrap}
  .hero-title{text-wrap:balance}
}
</style></head>
<body>
<div class="ambient" aria-hidden="true"></div>
<div class="wrap">
  <header class="topbar">
    <a href="/" class="brand-word">لايت بوت</a>
    <nav class="nav-links" aria-label="التنقل الرئيسي">
      <a href="#linkCard" class="nav-link active" style="text-decoration:none">ربط واتساب</a>
      <a href="#manageCard" class="nav-link" style="text-decoration:none">إدارة بوتي بالكود</a>
    </nav>
    <div class="top-actions">
      <button type="button" class="ghost sm" id="openAdminBtn" onclick="openAdminModal()">دخول الأدمن</button>
    </div>
  </header>

  <section class="hero-band">
    <div style="flex:1;min-width:0;overflow-wrap:break-word;word-break:break-word">
      <h1 class="hero-title">اربط حسابك على واتساب وتحكّم في بوتك من نفس الموقع</h1>
      <p class="hero-sub">أدخل رقم هاتفك لإصدار كود ربط واتساب الفوري، مع حفظ كود تحكم خاص بك يتيح لك تعديل إعدادات بوتك (الوضع العام/الخاص، الاسم، البادئة، والترحيب) في أي وقت.</p>
    </div>
    <div class="meta-line" id="savedQuickBar" style="display:none">
      <span>بوت محفوظ: <strong class="mono ltr" id="savedPhoneLbl"></strong></span>
      <button type="button" class="sky sm" onclick="restoreSavedBot()">استعادة التحكم</button>
    </div>
  </section>

  <div class="portal-grid">
    <!-- Left / First: Link WhatsApp Sub-Bot -->
    <section class="card anim-in anim-d1" id="linkCard">
      <h2><span>1. ربط حسابك على واتساب</span><span class="meta-line">اقتران فوري</span></h2>
      <div class="steps" aria-label="مراحل الربط">
        <div class="step active" id="st1">01. إدخال الرقم</div>
        <div class="step" id="st2">02. إصدار وحفظ الكود</div>
        <div class="step" id="st3">03. متصل وجاهز</div>
      </div>

      <form onsubmit="event.preventDefault();startSubPair()">
        <label class="lbl" for="pairPhone">رقم واتساب مع رمز الدولة (بدون +)</label>
        <input id="pairPhone" class="ltr mono" placeholder="2010xxxxxxxx" inputmode="numeric" required>
        <div class="actions">
          <button type="submit" class="pri" id="pairBtn" style="width:100%">إصدار كود الربط وحفظ الكود</button>
        </div>
      </form>

      <div id="pairOutput" style="display:none;margin-top:14px">
        <div class="code-vault">
          <div class="split-row">
            <span style="font-weight:700;color:#bbf7d0">كود ربط واتساب</span>
            <button type="button" class="ghost sm" onclick="copyText(currentPairCode)">نسخ كود الربط</button>
          </div>
          <div class="code-big" id="pairCodeDisplay">—</div>
          <div class="hint" id="pairHintText">افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف واكتب الكود.</div>
        </div>

        <div class="code-vault" style="border-color:rgba(56,189,248,0.38);background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(13,20,36,0.9))">
          <div class="split-row">
            <span style="font-weight:700;color:#bae6fd">كود التحكم المحفوظ لبوتك</span>
            <button type="button" class="sky sm" onclick="copyText(currentControlCode)">نسخ الكود المحفوظ</button>
          </div>
          <div class="code-big" style="color:#7dd3fc" id="controlCodeDisplay">—</div>
          <div class="hint">تم حفظ هذا الكود على السيرفر وفي متصفحك. احتفظ به للرجوع لاحقاً والتحكم في إعدادات بوتك من هنا.</div>
        </div>
      </div>
      <div id="pairErr" class="err-banner" style="display:none"></div>
    </section>

    <!-- Right / Second: My Bot Control Panel using Saved Code -->
    <section class="card anim-in anim-d2" id="manageCard">
      <h2><span>2. التحكم في إعدادات بوتك</span><span class="status-text off" id="myBotStateText">غير مفتوح</span></h2>

      <!-- Unlock View -->
      <div id="subUnlockBox">
        <p class="hint" style="margin-top:0">هل ربطت حسابك سابقاً؟ أدخل رقمك والكود المحفوظ (كود التحكم أو آخر كود ربط) لفتح لوحة إعدادات بوتك:</p>
        <form onsubmit="event.preventDefault();unlockSubBot()">
          <label class="lbl" for="authPhone">رقم الهاتف</label>
          <input id="authPhone" class="ltr mono" placeholder="2010xxxxxxxx" inputmode="numeric" required>
          <label class="lbl" for="authCode">الكود المحفوظ</label>
          <input id="authCode" class="ltr mono" placeholder="LB-XXXX-XXXX" required>
          <button type="submit" class="sky" id="unlockBtn" style="width:100%">دخول لإدارة بوتي</button>
        </form>
        <div id="unlockErr" class="err-banner" style="display:none"></div>
      </div>

      <!-- Active My-Bot Controls -->
      <div id="subControlBox" style="display:none">
        <div class="row"><span>الرقم المربوط</span><strong class="ltr mono" id="mb-phone">—</strong></div>
        <div class="row"><span>الاسم</span><strong id="mb-name">—</strong></div>
        <div class="row"><span>حالة الاتصال</span><strong id="mb-conn">—</strong></div>
        <div class="row"><span>الرسائل المستلمة · التشغيل</span><strong class="mono" id="mb-stats">0 · 0د</strong></div>
        <div class="row">
          <span>الكود المحفوظ</span>
          <span class="actions">
            <strong class="mono ltr" style="color:#7dd3fc" id="mb-code">—</strong>
            <button type="button" class="ghost sm" onclick="copyText(currentControlCode)">نسخ</button>
          </span>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <div class="split-row" style="margin-bottom:12px">
            <span class="lbl" style="margin:0">وضع الاستجابة</span>
            <div class="seg" role="group" aria-label="وضع استجابة البوت">
              <button type="button" id="modePubBtn" onclick="setMyMode('public')">عام للجميع</button>
              <button type="button" id="modePrivBtn" onclick="setMyMode('private')">خاص لك فقط</button>
            </div>
          </div>

          <label class="lbl" for="mb-customName">اسم البوت المخصص</label>
          <input id="mb-customName" placeholder="مثال: بوت محمد الشخصي">

          <label class="lbl" for="mb-prefix">بادئة الأوامر (Prefix)</label>
          <input id="mb-prefix" class="ltr mono" placeholder="." maxlength="4">

          <div class="switch-row">
            <span>الترحيب بالأعضاء الجدد</span>
            <label class="toggle"><input type="checkbox" id="mb-welcome"><span class="toggle-track"></span></label>
          </div>
          <div class="switch-row">
            <span>الرد التلقائي الذكي</span>
            <label class="toggle"><input type="checkbox" id="mb-autoReply"><span class="toggle-track"></span></label>
          </div>
          <div class="switch-row">
            <span>إيقاف البوت مؤقتاً</span>
            <label class="toggle"><input type="checkbox" id="mb-paused"><span class="toggle-track"></span></label>
          </div>

          <div class="actions" style="margin-top:14px">
            <button type="button" class="pri" onclick="saveMySettings()">حفظ الإعدادات</button>
            <button type="button" class="ghost" onclick="mySubAction('reconnect')">إعادة الربط</button>
            <button type="button" class="ghost" onclick="mySubAction('regenerate-code')">توليد كود جديد</button>
            <button type="button" class="danger" onclick="if(confirm('هل تريد فصل جلسة بوتك؟'))mySubAction('unlink')">فصل البوت</button>
            <button type="button" class="ghost sm" onclick="mySubAction('logout')">تبديل حساب</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<!-- Admin Login Modal -->
<div class="modal-backdrop${autoOpenAdmin === 'true' ? ' open' : ''}" id="adminLoginModal" role="dialog" aria-modal="true" aria-labelledby="admDlgTitle">
  <form class="modal-card" method="POST" action="/login">
    <div class="split-row" style="margin-bottom:8px">
      <h2 id="admDlgTitle" style="margin:0;font-size:18px">دخول لوحة الأدمن</h2>
      <button type="button" class="ghost sm" onclick="closeAdminModal()">إغلاق</button>
    </div>
    <p class="hint" style="margin:0 0 14px">أدخل كلمة سر الأدمن العشوائية للوصول إلى لوحة الحالة الشاملة وإدارة جميع البوتات.</p>
    <label class="lbl" for="admPassInput">كلمة سر الأدمن</label>
    <input id="admPassInput" type="password" name="password" placeholder="كلمة السر العشوائية" required>
    <button type="submit" class="pri" style="width:100%">دخول الأدمن</button>
    ${safeErr ? `<div class="err-banner">${safeErr}</div>` : ''}
    <div class="hint" style="margin-top:12px;font-size:12px">كلمة السر محفوظة في panel-config.json ولا تُطبع في السجلات.</div>
  </form>
</div>

<div class="msg" id="msg"></div>

<script>
const STORAGE_KEY='lb_saved_sub';
let currentPairCode='';
let currentControlCode='';
let currentMode='public';
let pollTimer=null;

function toast(t){
  const m=document.getElementById('msg');
  m.textContent=t;
  m.classList.add('show');
  setTimeout(()=>m.classList.remove('show'),2600);
}
function fmt(s){
  s=Math.floor(Number(s)||0);
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return (d?d+'ي ':'')+(h?h+'س ':'')+m+'د';
}
function copyText(val){
  if(!val){toast('لا يوجد كود لنسخه');return;}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(val).then(()=>toast('تم نسخ الكود: '+val)).catch(()=>toast('الكود: '+val));
  }else{toast('الكود: '+val);}
}
function openAdminModal(){
  document.getElementById('adminLoginModal').classList.add('open');
  setTimeout(()=>{const i=document.getElementById('admPassInput');if(i)i.focus();},60);
}
function closeAdminModal(){
  document.getElementById('adminLoginModal').classList.remove('open');
}
function saveLocalCredential(phone,code){
  try{
    if(phone && code) localStorage.setItem(STORAGE_KEY,JSON.stringify({phone:phone,code:code}));
  }catch(e){}
  showSavedBar();
}
function showSavedBar(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return;
    const saved=JSON.parse(raw);
    if(saved && saved.phone && saved.code){
      document.getElementById('savedPhoneLbl').textContent=saved.phone;
      document.getElementById('savedQuickBar').style.display='flex';
    }
  }catch(e){}
}
function updateSteps(bot,pairCode){
  const s1=document.getElementById('st1');
  const s2=document.getElementById('st2');
  const s3=document.getElementById('st3');
  s1.className='step done';
  if(bot && bot.connected){
    s2.className='step done';
    s3.className='step done';
  }else if(pairCode || (bot && bot.controlCode)){
    s2.className='step '+(pairCode?'done':'active');
    s3.className='step active';
  }
}
let hydratedPhone='';
function applyMyBotView(bot,forceHydrate){
  if(!bot){return;}
  currentControlCode=bot.controlCode||currentControlCode||'';
  currentPairCode=bot.pairCode||currentPairCode||'';
  saveLocalCredential(bot.phone,currentControlCode||currentPairCode);

  document.getElementById('subUnlockBox').style.display='none';
  document.getElementById('subControlBox').style.display='block';
  document.getElementById('mb-phone').textContent=bot.phone||'—';
  document.getElementById('mb-name').textContent=bot.name||'—';
  const st=document.getElementById('mb-conn');
  const hdrSt=document.getElementById('myBotStateText');
  if(bot.connected){
    st.textContent='متصل بواتساب';st.style.color='#4ade80';
    hdrSt.textContent='متصل';hdrSt.className='status-text on';
  }else if(bot.status==='pairing'){
    st.textContent='في انتظار إدخال الكود في واتساب';st.style.color='#fbbf24';
    hdrSt.textContent='جاري الربط';hdrSt.className='status-text warn';
  }else{
    st.textContent='غير متصل';st.style.color='#f87171';
    hdrSt.textContent='غير متصل';hdrSt.className='status-text off';
  }
  document.getElementById('mb-stats').textContent=(bot.messages||0)+' رسالة · '+fmt(bot.uptimeSec||0);
  document.getElementById('mb-code').textContent=currentControlCode||'—';

  if(forceHydrate || hydratedPhone!==bot.phone){
    hydratedPhone=bot.phone||'';
    const cfg=bot.settings||{};
    setMyMode(cfg.mode==='private'?'private':'public',true);
    document.getElementById('mb-customName').value=cfg.customName||'';
    document.getElementById('mb-prefix').value=cfg.prefix||'.';
    document.getElementById('mb-welcome').checked=cfg.welcome!==false;
    document.getElementById('mb-autoReply').checked=cfg.autoReply!==false;
    document.getElementById('mb-paused').checked=!!cfg.paused;
  }
  updateSteps(bot,currentPairCode);

  if(bot.pairCode || bot.controlCode){
    document.getElementById('pairOutput').style.display='block';
    document.getElementById('pairCodeDisplay').textContent=bot.pairCode||'جاري الإصدار...';
    document.getElementById('controlCodeDisplay').textContent=currentControlCode||'—';
  }
}
function setMyMode(mode,silent){
  currentMode=mode==='private'?'private':'public';
  document.getElementById('modePubBtn').className=currentMode==='public'?'active':'';
  document.getElementById('modePrivBtn').className=currentMode==='private'?'active':'';
  if(!silent) toast(currentMode==='private'?'تم اختيار وضع الخاص — اضغط حفظ الإعدادات':'تم اختيار وضع العام — اضغط حفظ الإعدادات');
}
async function startSubPair(){
  const phone=document.getElementById('pairPhone').value.trim();
  const btn=document.getElementById('pairBtn');
  const errEl=document.getElementById('pairErr');
  errEl.style.display='none';
  btn.disabled=true;btn.textContent='جاري تجهيز الكود...';
  try{
    const r=await fetch('/api/public/sub/pair',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({phone:phone})
    });
    const d=await r.json();
    if(!d.ok && !d.controlCode){
      errEl.textContent=d.error||'تعذّر بدء عملية الربط';
      errEl.style.display='block';
      return;
    }
    currentPairCode=d.pairCode||'';
    currentControlCode=d.controlCode||'';
    document.getElementById('pairOutput').style.display='block';
    document.getElementById('pairCodeDisplay').textContent=currentPairCode||'جاري الطلب من واتساب...';
    document.getElementById('controlCodeDisplay').textContent=currentControlCode||'—';
    if(d.bot) applyMyBotView(d.bot,true);
    if(d.error){
      errEl.textContent=d.error;
      errEl.style.display='block';
    }
    toast(d.message||'تم حفظ الكود');
    startPollingMe();
  }catch(e){
    errEl.textContent='تعذّر الاتصال بالخادم';
    errEl.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent='إصدار كود الربط وحفظ الكود';
  }
}
async function unlockSubBot(phoneOverride,codeOverride){
  const phone=(phoneOverride||document.getElementById('authPhone').value).trim();
  const code=(codeOverride||document.getElementById('authCode').value).trim();
  const errEl=document.getElementById('unlockErr');
  errEl.style.display='none';
  try{
    const r=await fetch('/api/public/sub/auth',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({phone:phone,code:code})
    });
    const d=await r.json();
    if(!d.ok){
      errEl.textContent=d.error||'بيانات الدخول غير صحيحة';
      errEl.style.display='block';
      return;
    }
    applyMyBotView(d.bot,true);
    toast('تم فتح لوحة تحكم بوتك');
    startPollingMe();
  }catch(e){
    errEl.textContent='خطأ في الاتصال بالخادم';
    errEl.style.display='block';
  }
}
async function restoreSavedBot(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return;
    const saved=JSON.parse(raw);
    if(saved && saved.phone && saved.code){
      document.getElementById('authPhone').value=saved.phone;
      document.getElementById('authCode').value=saved.code;
      await unlockSubBot(saved.phone,saved.code);
    }
  }catch(e){}
}
async function fetchMyBot(){
  try{
    const r=await fetch('/api/public/sub/me');
    if(!r.ok)return false;
    const d=await r.json();
    if(d.ok && d.bot){
      applyMyBotView(d.bot,false);
      return true;
    }
  }catch(e){}
  return false;
}
function startPollingMe(){
  if(pollTimer) clearInterval(pollTimer);
  pollTimer=setInterval(()=>{ void fetchMyBot(); },3000);
}
async function saveMySettings(){
  const payload={
    mode:currentMode,
    customName:document.getElementById('mb-customName').value,
    prefix:document.getElementById('mb-prefix').value,
    welcome:document.getElementById('mb-welcome').checked,
    autoReply:document.getElementById('mb-autoReply').checked,
    paused:document.getElementById('mb-paused').checked
  };
  try{
    const r=await fetch('/api/public/sub/settings',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const d=await r.json();
    if(!d.ok){toast(d.error||'تعذّر حفظ الإعدادات');return;}
    applyMyBotView(d.bot,true);
    toast('تم حفظ وتطبيق إعدادات بوتك');
  }catch(e){toast('خطأ أثناء حفظ الإعدادات');}
}
async function mySubAction(action){
  try{
    const r=await fetch('/api/public/sub/action',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:action})
    });
    const d=await r.json();
    if(action==='logout'){
      if(pollTimer)clearInterval(pollTimer);
      hydratedPhone='';
      document.getElementById('subControlBox').style.display='none';
      document.getElementById('subUnlockBox').style.display='block';
      document.getElementById('myBotStateText').textContent='غير مفتوح';
      document.getElementById('myBotStateText').className='status-text off';
      toast('تم الخروج من عرض هذا البوت');
      return;
    }
    if(!d.ok){toast(d.error||'تعذّر تنفيذ الإجراء');return;}
    if(d.controlCode){
      currentControlCode=d.controlCode;
      saveLocalCredential(document.getElementById('mb-phone').textContent,d.controlCode);
    }
    if(d.bot) applyMyBotView(d.bot,true);
    toast(d.message||'تم التنفيذ');
  }catch(e){toast('تعذّر تنفيذ الإجراء');}
}

(async function initPortal(){
  showSavedBar();
  const hasCookie=await fetchMyBot();
  if(hasCookie){
    startPollingMe();
  }else{
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const s=JSON.parse(raw);
        if(s && s.phone && s.code){
          document.getElementById('authPhone').value=s.phone;
          document.getElementById('authCode').value=s.code;
        }
      }
    }catch(e){}
  }
})();
</script>
</body></html>`;
}

export function renderMaintenanceHtml(err = '') {
  const autoOpenAdmin = err ? 'true' : 'false';
  const safeErr = String(err || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🛠️ الموقع تحت الصيانة — لايت بوت</title>
<style>${SHARED_CSS}
.maint-wrap{
  min-height: calc(100vh - 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.maint-card{
  width: min(100%, 580px);
  background: rgba(13, 20, 36, 0.94);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 24px;
  padding: 38px 28px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55), 0 0 50px rgba(245, 158, 11, 0.08);
  animation: fadeSlideUp .42s var(--ease) both;
}
.maint-badge{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 22px;
}
.gear-orbit{
  width: 90px;
  height: 90px;
  margin: 0 auto 20px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gear-icon-main{
  font-size: 48px;
  display: inline-block;
  animation: spinGear 9s linear infinite;
  filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.45));
}
.gear-icon-sub{
  position: absolute;
  bottom: 2px;
  left: 6px;
  font-size: 26px;
  display: inline-block;
  animation: spinGearRev 6s linear infinite;
}
@keyframes spinGear{
  from{transform: rotate(0deg)}
  to{transform: rotate(360deg)}
}
@keyframes spinGearRev{
  from{transform: rotate(360deg)}
  to{transform: rotate(0deg)}
}
.pulse-dot{
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 10px #fbbf24;
  display: inline-block;
  animation: pulseDot 1.4s ease-in-out infinite alternate;
}
@keyframes pulseDot{
  from{opacity: 0.4; transform: scale(0.9)}
  to{opacity: 1; transform: scale(1.2)}
}
.maint-title{
  font-size: clamp(22px, 3.8vw, 30px);
  font-weight: 800;
  margin: 0 0 12px;
  color: #fff;
  letter-spacing: -0.01em;
}
.maint-text{
  font-size: 15px;
  color: var(--muted);
  line-height: 1.8;
  margin: 0 0 24px;
}
.status-box{
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 24px;
  text-align: right;
}
.progress-bar{
  height: 8px;
  border-radius: 9999px;
  background: #1e293b;
  overflow: hidden;
  margin: 12px 0;
  position: relative;
}
.progress-fill{
  height: 100%;
  width: 70%;
  background: linear-gradient(90deg, #f59e0b, #10b981, #38bdf8);
  border-radius: 9999px;
  position: relative;
  overflow: hidden;
}
.progress-fill::after{
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmerSlide 2s infinite;
}
.maint-actions{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.auto-poll-hint{
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.modal-backdrop{
  position:fixed;inset:0;background:rgba(3,7,18,0.75);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;padding:16px;z-index:100;
  opacity:0;pointer-events:none;transition:opacity .2s var(--ease);
}
.modal-backdrop.open{opacity:1;pointer-events:auto}
.modal-card{
  width:min(100%,410px);background:var(--surface);border:1px solid var(--border2);border-radius:18px;
  padding:22px;transform:translate3d(0,14px,0) scale(.98);transition:transform .24s var(--ease);
}
.modal-backdrop.open .modal-card{transform:translate3d(0,0,0) scale(1)}
</style></head>
<body>
<div class="ambient" aria-hidden="true"></div>
<div class="wrap maint-wrap">
  <div class="maint-card">
    <div class="maint-badge">
      <span class="pulse-dot"></span>
      <span>وضع الصيانة والتطوير مفعّل</span>
    </div>

    <div class="gear-orbit" aria-hidden="true">
      <span class="gear-icon-main">⚙️</span>
      <span class="gear-icon-sub">🛠️</span>
    </div>

    <h1 class="maint-title">الموقع في استراحة صيانة وتطوير قصيرة!</h1>
    <p class="maint-text">
      أهلاً بك يا صديقي! نعمل الآن خلف الكواليس على ترقية الخوادم وتحديث النظام وتحسين الأداء لتقديم أفضل تجربة ممكنة.<br>
      <strong>استنّانا شوية وهنرجع أقوى وأسرع من الأول بإذن الله! ☕✨</strong>
    </p>

    <div class="status-box">
      <div class="split-row" style="margin-bottom:6px">
        <span style="font-weight:700;color:#e2e8f0">حالة التحديثات:</span>
        <span style="color:#fbbf24;font-size:13px;font-weight:700">جاري العمل الآن</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="hint" style="color:var(--muted);font-size:13px">
        💡 تقدر تاخد لك فنجان شاي أو قهوة سريع، الفحص شغال تلقائياً ومش هنتأخر عليك!
      </div>
    </div>

    <div class="maint-actions">
      <button type="button" class="pri" id="refreshBtn" onclick="manualCheck()">
        <span id="btnIcon">🔄</span> إعادة فحص الحالة وتحديث الصفحة
      </button>
      <button type="button" class="ghost" onclick="openAdminModal()">
        🔐 دخول الإدارة
      </button>
    </div>

    <div class="auto-poll-hint">
      يتم الفحص التلقائي لعودة الموقع كل 10 ثوانٍ (الفحص القادم خلال: <span id="secCount">10</span> ثانية)
    </div>
  </div>
</div>

<!-- Modal: Admin Login Bypass -->
<div class="modal-backdrop" id="adminModal" onclick="if(event.target===this)closeAdminModal()">
  <div class="modal-card">
    <div class="split-row" style="margin-bottom:12px">
      <h3 style="margin:0;font-size:16px;color:#fff">دخول الإدارة للتحكم</h3>
      <button type="button" class="ghost sm" onclick="closeAdminModal()">✕</button>
    </div>
    <p class="hint" style="margin:0 0 14px">أدخل كلمة سر لوحة التحكم لإدارة البوت أو إيقاف وضع الصيانة.</p>
    ${safeErr ? `<div class="err-banner" style="margin-bottom:12px">${safeErr}</div>` : ''}
    <form method="POST" action="/login">
      <label class="lbl" for="maintPass">كلمة سر لوحة التحكم</label>
      <input type="password" id="maintPass" name="password" required autofocus style="margin-bottom:14px">
      <div class="actions">
        <button type="submit" class="pri" style="width:100%">تسجيل الدخول للوحة التحكم</button>
      </div>
    </form>
  </div>
</div>

<script>
let remaining = 10;
const secCountEl = document.getElementById('secCount');
const autoOpen = ${autoOpenAdmin};

if (autoOpen) {
  openAdminModal();
}

function openAdminModal() {
  document.getElementById('adminModal').classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('maintPass');
    if (inp) inp.focus();
  }, 50);
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('open');
}

async function checkMaintenanceStatus() {
  try {
    const res = await fetch('/api/maintenance-status');
    if (res.ok) {
      const data = await res.json();
      if (!data.maintenance) {
        window.location.reload();
        return;
      }
    }
  } catch (_) {}
}

async function manualCheck() {
  const btn = document.getElementById('refreshBtn');
  const icon = document.getElementById('btnIcon');
  if (btn) btn.disabled = true;
  if (icon) icon.style.display = 'inline-block';
  if (icon) icon.style.transform = 'rotate(180deg)';
  await checkMaintenanceStatus();
  setTimeout(() => {
    if (btn) btn.disabled = false;
    if (icon) icon.style.transform = 'none';
  }, 600);
}

setInterval(() => {
  remaining--;
  if (secCountEl) secCountEl.textContent = String(remaining);
  if (remaining <= 0) {
    remaining = 10;
    if (secCountEl) secCountEl.textContent = '10';
    checkMaintenanceStatus();
  }
}, 1000);
</script>
</body></html>`;
}

export function renderAdminPanelHtml(customInstallJs = '') {
return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة تحكم الأدمن — لايت بوت</title>
<style>${SHARED_CSS}
.panel{display:none}
.panel.active{display:block;animation:panelFadeIn .24s var(--ease) both}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.qrbox{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;word-break:keep-all}
.qrbox img{width:min(100%,260px);background:#fff;padding:10px;border-radius:14px}
.code{
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;font-weight:800;letter-spacing:3px;
  color:#4ade80;direction:ltr;text-align:center;background:#052e1a;border:1px solid #14532d;
  border-radius:12px;padding:12px;margin:8px 0;font-variant-numeric:tabular-nums;
}
.log{
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#a5b4fc;
  max-height:220px;overflow:auto;background:var(--surface2);border:1px solid var(--border);
  border-radius:10px;padding:10px;white-space:pre-wrap;
}
.err-item{background:#2a1414;border:1px solid #7f1d1d;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:13px}

/* Fleet Manager */
.fleet-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;align-items:start}
.bot-list{display:flex;flex-direction:column;gap:12px}
.bot-card{
  background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;
  transition:border-color .18s var(--ease);
}
.bot-card:hover{border-color:var(--border2)}
.bot-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:12px}
.bot-edit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.allow-chip{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;
}

/* Command Explorer */
.toolbar{display:grid;grid-template-columns:2fr 1fr auto;gap:10px;margin-bottom:14px;align-items:start}
.toolbar input,.toolbar select{margin-bottom:0}
.cmd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.cmd-item{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
.cmd-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cmd-name{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;font-weight:700;color:var(--sky);direction:ltr;unicode-bidi:plaintext}
.cmd-cat{font-size:11px;color:var(--muted)}
.cmd-desc{font-size:13px;color:#cbd5e1;line-height:1.5;min-height:20px}
.pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap}

/* Simulator */
.sim-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
.sim-layout > *{min-width:0}
.preset-list{display:flex;flex-direction:column;gap:8px}
.preset-btn{text-align:right;display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border:1px solid var(--border)}
.preset-btn:hover{border-color:var(--accent)}
.sim-bar{display:flex;gap:8px;margin-bottom:12px}
.sim-bar input{margin-bottom:0;flex:1;min-width:0;direction:rtl;text-align:right;unicode-bidi:plaintext}
.wa-chat{background:#0b141a;border:1px solid #1f2c34;border-radius:14px;padding:14px;min-height:420px;max-height:620px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:12px}
.wa-msg{max-width:88%;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.65;word-break:break-word;min-width:0}
.wa-user{align-self:flex-start;background:#005c4b;color:#e9edef;border-top-right-radius:2px}
.wa-bot{align-self:flex-end;background:#1f2c34;color:#e9edef;border-top-left-radius:2px;width:min(100%,540px)}
.wa-body{white-space:pre-wrap}
.wa-body code{background:#0b141a;padding:2px 6px;border-radius:6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#7dd3fc}
.wa-body pre{background:#0b141a;padding:10px;border-radius:8px;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#a5b4fc;direction:ltr;text-align:left;margin:6px 0}
.wa-footer{margin-top:8px;font-size:11px;color:#8696a0}
.wa-reacts{display:flex;gap:6px;margin-top:4px;font-size:13px}
.wa-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid #2a3942}
.wa-btn{background:#111b21;color:#53bdeb;border:1px solid #2a3942;border-radius:8px;padding:7px 11px;font-size:13px;font-weight:600;cursor:pointer}
.wa-btn:hover{background:#18262e;border-color:#53bdeb}
.wa-select-box{width:100%;margin-top:6px;background:#111b21;border:1px solid #2a3942;border-radius:10px;padding:8px}
.wa-select-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:right;background:transparent;border-bottom:1px solid #1f2c34;border-radius:0;padding:7px 4px;font-size:13px}
.wa-select-row:last-child{border-bottom:0}
.wa-poll{background:#111b21;border:1px solid #2a3942;border-radius:10px;padding:10px;margin-top:4px}
.wa-poll-opt{display:flex;justify-content:space-between;width:100%;margin-top:6px;background:#18262e;border:1px solid #2a3942;text-align:right}
.wa-poll-opt.voted{border-color:#4ade80;background:#052e1a}
.wa-carousel{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-top:8px;max-width:100%}
.wa-car-card{min-width:210px;background:#111b21;border:1px solid #2a3942;border-radius:10px;padding:10px;flex-shrink:0}
.wa-widget{width:100%;height:265px;border:1px solid #2a3942;border-radius:10px;background:#0f172a;margin-top:6px}

@media (max-width:960px){
  .fleet-grid{grid-template-columns:minmax(0,1fr)}
  .bot-edit-grid{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:820px){
  .toolbar{grid-template-columns:1fr}
  .sim-layout{grid-template-columns:minmax(0,1fr)}
  .sim-layout > .card:last-child{order:-1}
  .preset-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .preset-btn{padding:8px 10px;font-size:12px}
  .preset-btn small{display:none}
  .wa-msg{max-width:100%;width:100%}
}
</style></head>
<body>
<div class="ambient" aria-hidden="true"></div>
<div class="wrap">
  <div id="pendingRestart" style="display:none;background:#3b2f05;border:1px solid #f59e0b;color:#fde68a;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:14px">♻️ إعادة التشغيل جارية... سيتم تطبيق الإعدادات فور إقلاع البوت</div>
  <div id="maintenanceAlert" style="display:none;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fbbf24;border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:14px;font-weight:700">🛠️ وضع الصيانة مفعّل حالياً — الموقع مغلق أمام الزوار وتظهر لهم شاشة الصيانة. يمكنك إيقافه من قسم "إعدادات البوت الرئيسي" أدناه.</div>

  <header class="topbar">
    <span class="brand-word">إدارة لايت بوت</span>
    <nav class="nav-links" role="tablist" aria-label="أقسام لوحة الأدمن">
      <button type="button" class="nav-link active" data-tab="overview" onclick="switchTab('overview')">الحالة والربط</button>
      <button type="button" class="nav-link" data-tab="fleet" onclick="switchTab('fleet')">إدارة البوتات (<span id="tab-sub-count">0</span>)</button>
      <button type="button" class="nav-link" data-tab="commands" onclick="switchTab('commands')">دليل الأوامر (<span id="tab-cmd-count">0</span>)</button>
      <button type="button" class="nav-link" data-tab="simulator" onclick="switchTab('simulator')">محاكي التفاعل</button>
    </nav>
    <div class="top-actions">
      <span id="badge" class="status-text off">غير متصل</span>
      <button class="ghost sm" type="button" onclick="doAction('logout')">خروج</button>
    </div>
  </header>

  <!-- TAB 1: Admin Status Dashboard -->
  <section id="tab-overview" class="panel active">
    <div class="kpi-strip">
      <div class="kpi-box"><span class="kpi-label">البوت الرئيسي</span><span class="kpi-val" id="kpi-main">—</span></div>
      <div class="kpi-box"><span class="kpi-label">البوتات الفرعية المتصلة</span><span class="kpi-val" id="kpi-subs">0 / 0</span></div>
      <div class="kpi-box"><span class="kpi-label">الأوامر المحمّلة</span><span class="kpi-val" id="kpi-cmds">0</span></div>
      <div class="kpi-box"><span class="kpi-label">الذاكرة · التشغيل</span><span class="kpi-val" id="kpi-sys">0 MB</span></div>
    </div>

    <div class="grid">
      <div class="card">
        <h2><span>لوحة الحالة التفصيلية</span><small class="t" id="hdr-cmds">…</small></h2>
        <div class="row"><span>الاتصال</span><b id="s-conn">…</b></div>
        <div class="row"><span>رقم البوت</span><b class="ltr mono" id="s-phone">…</b></div>
        <div class="row"><span>الجلسة مُسجّلة</span><b id="s-session">…</b></div>
        <div class="row"><span>عدد الأوامر</span><b class="mono" id="s-cmds">…</b></div>
        <div class="row"><span>البوتات الفرعية</span><b class="mono" id="s-subs">0</b></div>
        <div class="row"><span>الذاكرة</span><b class="mono" id="s-mem">…</b></div>
        <div class="row"><span>مدة التشغيل</span><b class="mono" id="s-up">…</b></div>
      </div>

      <div class="card" id="installCard">
        <h2><span>تنصيب / ربط البوت الرئيسي</span></h2>
        <div id="installBody"></div>
      </div>

      <div class="card">
        <h2><span>التحكم والإرسال المباشر</span></h2>
        <div class="actions">
          <button type="button" class="pri" onclick="doAction('restart')">إعادة تشغيل</button>
          <button type="button" class="warn" onclick="doAction('stop')">إيقاف</button>
          <button type="button" class="sky" onclick="doAction('start')">تشغيل</button>
          <button type="button" class="danger" onclick="resetSession()">تصفير الجلسة</button>
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <label class="lbl" for="msgTo">إرسال رسالة من البوت الرئيسي</label>
          <input id="msgTo" class="ltr mono" placeholder="رقم واتساب مثال: 2010xxxxxxx">
          <input id="msgText" placeholder="نص الرسالة">
          <button type="button" class="pri" onclick="sendMsg()">إرسال</button>
        </div>
      </div>

      <div class="card">
        <h2><span>باسورد الأدمن العشوائي</span></h2>
        <p class="hint" style="margin-top:0">يتم توليد كلمة سر عشوائية قوية وحفظها في panel-config.json. يمكنك توليد كلمة سر عشوائية جديدة من هنا في أي وقت.</p>
        <div class="actions">
          <button type="button" class="sky" onclick="rotateAdminPassword()">توليد باسورد عشوائي جديد</button>
        </div>
        <div id="rotatedPassBox" class="code-vault" style="display:none;margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:700">كلمة السر العشوائية الجديدة</span>
            <button type="button" class="ghost sm" onclick="copyValue(lastRotatedPass)">نسخ</button>
          </div>
          <div class="code-big" style="font-size:18px" id="rotatedPassVal">—</div>
        </div>
      </div>

      <div class="card">
        <h2><span>سجل الأحداث الحي</span></h2>
        <div class="log" id="log">…</div>
      </div>

      <div class="card">
        <h2><span>آخر الأخطاء</span></h2>
        <div id="errors"><small class="t">لا يوجد</small></div>
      </div>
    </div>
  </section>

  <!-- TAB 2: Fleet Management (Main Bot + All Sub-Bots) -->
  <section id="tab-fleet" class="panel">
    <div class="kpi-strip">
      <div class="kpi-box"><span class="kpi-label">إجمالي البوتات المسجلة</span><span class="kpi-val" id="fl-total">0</span></div>
      <div class="kpi-box"><span class="kpi-label">متصلة الآن</span><span class="kpi-val" style="color:#4ade80" id="fl-conn">0</span></div>
      <div class="kpi-box"><span class="kpi-label">إجمالي الرسائل</span><span class="kpi-val" id="fl-msgs">0</span></div>
      <div class="kpi-box"><span class="kpi-label">كود الاقتران الحالي</span><span class="kpi-val mono ltr" style="font-size:18px;color:#38bdf8" id="fl-paircode">—</span></div>
    </div>

    <div class="fleet-grid">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <h2><span>إعدادات البوت الرئيسي والربط</span></h2>
          <label class="lbl" for="ms-nameBot">اسم البوت</label>
          <input id="ms-nameBot" placeholder="اسم البوت">
          <label class="lbl" for="ms-prefix">البادئات (مفصولة بمسافة)</label>
          <input id="ms-prefix" class="ltr mono" placeholder=". / !">
          <div class="switch-row"><span>السماح بالربط المباشر من الموقع</span><label class="toggle"><input type="checkbox" id="ms-allowWeb"><span class="toggle-track"></span></label></div>
          <div class="switch-row"><span>إغلاق التنصيب الفرعي (noSub)</span><label class="toggle"><input type="checkbox" id="ms-noSub"><span class="toggle-track"></span></label></div>
          <div class="switch-row"><span>وضع الصيانة</span><label class="toggle"><input type="checkbox" id="ms-maint"><span class="toggle-track"></span></label></div>
          <div class="switch-row"><span>القراءة التلقائية (autoRead)</span><label class="toggle"><input type="checkbox" id="ms-autoRead"><span class="toggle-track"></span></label></div>
          <div style="margin:10px 0 6px">
            <label class="lbl" for="ms-fromMe" style="margin-top:0">تشغيل الأوامر من الرقم المتصل (fromMe)</label>
            <select id="ms-fromMe">
              <option value="both">الجميع + الرقم المتصل بالبوت (الافتراضي)</option>
              <option value="others">الآخرين فقط (تجاهل الرقم المتصل)</option>
              <option value="self">الرقم المتصل فقط (وضع خاص)</option>
            </select>
          </div>
          <div class="switch-row"><span>الترحيب بالأعضاء</span><label class="toggle"><input type="checkbox" id="ms-welcome"><span class="toggle-track"></span></label></div>
          <div class="switch-row"><span>مانع الروابط العام</span><label class="toggle"><input type="checkbox" id="ms-antiLink"><span class="toggle-track"></span></label></div>
          <button type="button" class="pri" style="width:100%;margin-top:12px" onclick="saveMainSettings()">حفظ إعدادات البوت الرئيسي</button>
        </div>

        <div class="card">
          <h2><span>إضافة بوت فرعي وقائمة السماح</span></h2>
          <label class="lbl" for="admSubPhone">رقم الهاتف مع رمز الدولة</label>
          <input id="admSubPhone" class="ltr mono" placeholder="2010xxxxxxxx">
          <div class="actions">
            <button type="button" class="pri sm" onclick="adminAddSub()">ربط بوت جديد</button>
            <button type="button" class="sky sm" onclick="adminAllowNum(true)">إضافة للسماح</button>
          </div>
          <div id="allowListBox" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="card">
        <h2>
          <span>البوتات الموجودة والتحكم الكامل بها</span>
          <button type="button" class="ghost sm" onclick="loadFleet(true)">تحديث</button>
        </h2>
        <div class="toolbar" style="grid-template-columns:1fr auto">
          <input id="fleetSearch" type="search" placeholder="ابحث برقم الهاتف أو الاسم أو الكود..." oninput="renderFleetList()">
          <div class="seg" role="group" aria-label="تصفية البوتات">
            <button type="button" class="active" data-flt="all" onclick="setFleetFilter('all')">الكل</button>
            <button type="button" data-flt="connected" onclick="setFleetFilter('connected')">متصل</button>
            <button type="button" data-flt="offline" onclick="setFleetFilter('offline')">غير متصل</button>
          </div>
        </div>
        <div id="fleetList" class="bot-list"></div>
      </div>
    </div>
  </section>

  <!-- TAB 3: Command Explorer -->
  <section id="tab-commands" class="panel">
    <div class="card">
      <h2><span>دليل الأوامر التفاعلي</span><small class="t" id="cmdSummary"></small></h2>
      <div class="toolbar">
        <input id="cmdSearch" type="search" placeholder="ابحث باسم الأمر أو الوصف (مثال: سورة، زخرفة، تصويت، بطاقتي)..." oninput="cmdPage=1;renderCommands()">
        <select id="cmdCat" onchange="cmdPage=1;renderCommands()">
          <option value="">كل الأقسام</option>
        </select>
        <button type="button" class="ghost" onclick="loadCommands(true)">تحديث</button>
      </div>
      <div id="cmdGrid" class="cmd-grid"></div>
      <div class="pager">
        <button type="button" class="ghost sm" id="cmdPrev" onclick="changePage(-1)">السابق</button>
        <span class="hint" id="cmdPageInfo">صفحة 1</span>
        <button type="button" class="ghost sm" id="cmdNext" onclick="changePage(1)">التالي</button>
      </div>
    </div>
  </section>

  <!-- TAB 4: Interactive Simulator -->
  <section id="tab-simulator" class="panel">
    <div class="sim-layout">
      <div class="card">
        <h2><span>أوامر تفاعلية جاهزة</span></h2>
        <div class="preset-list">
          <button type="button" class="preset-btn" onclick="runSim('.تصفح')"><span>المتصفح الشامل</span><small>.تصفح</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.اذكار_الصباح')"><span>أذكار الصباح</span><small>أزرار</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.سبحة')"><span>السبحة التفاعلية</span><small>قاعدة</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.زخرفة1 لايت')"><span>زخرفة الاسم</span><small>نسخ</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.لغز_عشوائي')"><span>لغز تفاعلي</span><small>اختيارات</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.ابراج')"><span>قائمة الأبراج</span><small>منسدلة</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.بطاقتي')"><span>بطاقتي HTML</span><small>Widget</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.لوحة_البوت')"><span>لوحة البوت HTML</span><small>Widget</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.تصويت_سريع')"><span>استطلاع رأي</span><small>Poll</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.معاينة_كاروسيل')"><span>عرض دوّار</span><small>Carousel</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.دولة_مصر')"><span>دليل دولة</span><small>بطاقة</small></button>
          <button type="button" class="preset-btn" onclick="runSim('.محفظتي')"><span>محفظتي</span><small>بنك</small></button>
        </div>
      </div>

      <div class="card">
        <h2><span>معاينة رسائل واتساب التفاعلية</span><button type="button" class="ghost sm" onclick="clearSim()">مسح</button></h2>
        <form class="sim-bar" onsubmit="event.preventDefault();runSim()">
          <input id="simInput" value=".تصفح" placeholder="اكتب أي أمر مثل .بطاقتي أو .زخرفة1 لايت أو .كم_لميل 10">
          <button type="submit" class="pri" id="simRunBtn">تنفيذ ▶</button>
        </form>
        <div class="wa-chat" id="simChat">
          <div class="wa-msg wa-bot">
            <div class="wa-body">مرحباً بك في <strong>محاكي واتساب التفاعلي</strong>! اختر أي أمر أو اكتب أمراً واضغط <strong>تنفيذ</strong> لمعاينة البطاقات والأزرار وودجت HTML مباشرة.</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
<div class="msg" id="msg"></div>

<script>
let lastRotatedPass='';
function toast(t){const m=document.getElementById('msg');m.textContent=t;m.classList.add('show');setTimeout(()=>m.classList.remove('show'),2600);}
function fmt(s){s=Math.floor(Number(s)||0);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return (d?d+'ي ':'')+(h?h+'س ':'')+m+'د';}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function switchTab(name){
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));
  if(name==='commands' && !allCommands.length) loadCommands();
  if(name==='fleet') loadFleet();
}

async function refresh(){
  try{
    const r=await fetch('/api/status');if(r.status===401){location.reload();return;}
    const d=await r.json();
    const b=document.getElementById('badge');
    b.textContent=d.connected?'متصل':'غير متصل';
    b.className='status-text '+(d.connected?'on':'off');
    document.getElementById('s-conn').textContent=d.connected?'مفتوح':'مغلق';
    document.getElementById('s-phone').textContent=d.phone||'—';
    document.getElementById('s-session').textContent=d.sessionRegistered?'نعم':'لا';
    document.getElementById('s-cmds').textContent=d.commands;
    document.getElementById('tab-cmd-count').textContent=d.commands;
    document.getElementById('hdr-cmds').textContent=d.commands+' أمر جاهز';
    document.getElementById('s-mem').textContent=d.memoryMB+' MB';
    document.getElementById('s-up').textContent=fmt(d.uptimeSec);
    const subs=d.subStats||{totalSubs:0,connectedSubs:0};
    document.getElementById('s-subs').textContent=subs.connectedSubs+' / '+subs.totalSubs;
    document.getElementById('tab-sub-count').textContent=subs.totalSubs;
    document.getElementById('kpi-main').textContent=d.connected?'متصل':'غير متصل';
    document.getElementById('kpi-main').style.color=d.connected?'#4ade80':'#f87171';
    document.getElementById('kpi-subs').textContent=subs.connectedSubs+' / '+subs.totalSubs;
    document.getElementById('kpi-cmds').textContent=d.commands;
    document.getElementById('kpi-sys').innerHTML='<bdi class="ltr">'+d.memoryMB+' MB</bdi> · <bdi>'+fmt(d.uptimeSec)+'</bdi>';

    document.getElementById('log').textContent=(d.events||[]).map(e=>e&&e.line?e.line:(e&&e.text?e.text:String(e||''))).join('\\n')||'—';
    const eb=document.getElementById('errors');
    eb.innerHTML=(d.errors&&d.errors.length)?d.errors.map(e=>'<div class="err-item"><b>'+esc(e.command||'')+'</b><br>'+esc((e.error||'').slice(0,200))+'<br><small class="t">'+esc(e.time||'')+'</small></div>').join(''):'<small class="t">لا يوجد</small>';
    const pr=document.getElementById('pendingRestart');
    if(pr)pr.style.display=d.pendingRestart?'':'none';
    renderInstall(d);
  }catch(e){}
}

${customInstallJs || `let lastInstallSig='';
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
}`}

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
  if(a==='logout'){setTimeout(()=>location.reload(),600);return;}
  setTimeout(refresh,1500);
}
async function resetSession(){
  if(!confirm('سيتم نقل الجلسة الحالية لنسخة احتياطية والخروج لإقلاع جديد غير مقرن. متأكد؟'))return;
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset-session'})});
  const d=await r.json();toast(d.message||'تم');setTimeout(refresh,2200);
}
async function sendMsg(){
  const to=document.getElementById('msgTo').value.trim();
  const text=document.getElementById('msgText').value.trim();
  if(!to||!text){toast('اكتب الرقم والنص');return;}
  const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',to,text})});
  const d=await r.json();toast(d.message||'تم');
}
async function rotateAdminPassword(){
  const r=await fetch('/api/admin/rotate-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'random'})});
  const d=await r.json();
  if(!d.ok){toast(d.message||'تعذّر توليد كلمة السر');return;}
  lastRotatedPass=d.password||'';
  document.getElementById('rotatedPassVal').textContent=lastRotatedPass;
  document.getElementById('rotatedPassBox').style.display='block';
  toast('تم توليد وحفظ كلمة سر عشوائية جديدة');
}

/* Fleet Manager */
let fleetData=null;
let fleetFilter='all';
function setFleetFilter(f){
  fleetFilter=f;
  document.querySelectorAll('[data-flt]').forEach(b=>b.classList.toggle('active',b.dataset.flt===f));
  renderFleetList();
}
async function loadFleet(notify){
  try{
    const r=await fetch('/api/admin/bots');
    if(r.status===401){location.reload();return;}
    const d=await r.json();
    if(!d.ok)return;
    fleetData=d;
    document.getElementById('fl-total').textContent=d.stats.totalSubs;
    document.getElementById('fl-conn').textContent=d.stats.connectedSubs;
    document.getElementById('fl-msgs').textContent=d.stats.totalMessages;
    document.getElementById('fl-paircode').textContent=(d.subPairing&&d.subPairing.code)?d.subPairing.code:'—';
    document.getElementById('tab-sub-count').textContent=d.stats.totalSubs;

    const ms=d.mainBot.settings||{};
    document.getElementById('ms-nameBot').value=ms.nameBot||'';
    document.getElementById('ms-prefix').value=ms.prefix||'.';
    document.getElementById('ms-allowWeb').checked=ms.allowPublicWebPair!==false;
    document.getElementById('ms-noSub').checked=!!ms.noSub;
    document.getElementById('ms-maint').checked=!!ms.maintenance;
    const maintAlert=document.getElementById('maintenanceAlert');
    if(maintAlert) maintAlert.style.display=ms.maintenance?'block':'none';
    document.getElementById('ms-autoRead').checked=!!ms.autoRead;
    document.getElementById('ms-fromMe').value=ms.fromMeMode||'both';
    document.getElementById('ms-welcome').checked=ms.welcomeEnabled!==false;
    document.getElementById('ms-antiLink').checked=!!ms.antiLink;

    renderAllowList(d.allowList||[]);
    renderFleetList();
    if(notify) toast('تم تحديث بيانات جميع البوتات');
  }catch(e){}
}
function renderAllowList(list){
  const box=document.getElementById('allowListBox');
  if(!list.length){
    box.innerHTML='<div class="hint">لا توجد أرقام في قائمة السماح الخاصة بأمر .تنصيب حالياً.</div>';
    return;
  }
  box.innerHTML=list.map(x=>'<div class="allow-chip"><span class="mono ltr">'+esc(x.phone)+'</span><button type="button" class="danger sm" onclick="adminAllowNum(false,\\''+esc(x.phone)+'\\')">إزالة</button></div>').join('');
}
function renderFleetList(){
  const box=document.getElementById('fleetList');
  if(!fleetData){box.innerHTML='<div class="hint">جاري تحميل البوتات...</div>';return;}
  const q=(document.getElementById('fleetSearch').value||'').trim().toLowerCase();
  const list=(fleetData.subBots||[]).filter(b=>{
    if(fleetFilter==='connected' && !b.connected)return false;
    if(fleetFilter==='offline' && b.connected)return false;
    if(!q)return true;
    return (b.phone||'').toLowerCase().includes(q)
      ||(b.name||'').toLowerCase().includes(q)
      ||(b.controlCode||'').toLowerCase().includes(q)
      ||(b.uid||'').toLowerCase().includes(q);
  });
  if(!list.length){
    box.innerHTML='<div class="hint">لا توجد بوتات فرعية مطابقة. يمكنك ربط بوت من الشاشة الافتراضية أو من نموذج الإضافة الجانبي.</div>';
    return;
  }
  box.innerHTML=list.map(b=>{
    const stCls=b.connected?'on':(b.status==='pairing'?'warn':'off');
    const stTxt=b.connected?'متصل':(b.status==='pairing'?'قيد الربط':'غير متصل');
    const s=b.settings||{};
    const safeP=esc(b.phone);
    return '<div class="bot-card">'
      +'<div class="bot-top">'
      +'<div><div style="font-size:16px;font-weight:800">'+esc(b.name)+'</div>'
      +'<div class="meta-line"><span class="ltr mono">'+safeP+'</span><span>·</span><span>UID: <b class="mono">'+esc(b.uid||'—')+'</b></span><span>·</span><span>الرسائل: <b class="mono">'+(b.messages||0)+'</b></span><span>·</span><span>التشغيل: <b class="mono">'+fmt(b.uptimeSec||0)+'</b></span></div></div>'
      +'<span class="status-text '+stCls+'">'+stTxt+'</span>'
      +'</div>'
      +'<div class="meta-line" style="margin-bottom:10px">'
      +'<span>كود التحكم: <b class="mono ltr" style="color:#7dd3fc">'+esc(b.controlCode||'—')+'</b></span>'
      +'<span>·</span><span>آخر كود واتساب: <b class="mono ltr" style="color:#4ade80">'+esc(b.pairCode||'—')+'</b></span>'
      +'<span>·</span><span>الوضع: <b>'+(s.mode==='private'?'خاص':'عام')+'</b></span>'
      +(b.waName?'<span>·</span><span>واتساب: <b>'+esc(b.waName)+'</b></span>':'')
      +'</div>'
      +(b.pairError?'<div class="err-banner" style="margin:0 0 10px">'+esc(b.pairError)+'</div>':'')
      +'<div class="bot-edit-grid">'
      +'<div><label class="lbl">الوضع</label><select id="sb-mode-'+safeP+'"><option value="public"'+(s.mode!=='private'?' selected':'')+'>عام للجميع</option><option value="private"'+(s.mode==='private'?' selected':'')+'>خاص</option></select></div>'
      +'<div><label class="lbl">الاسم المخصص</label><input id="sb-name-'+safeP+'" value="'+esc(s.customName||'')+'" placeholder="اسم البوت"></div>'
      +'<div><label class="lbl">البادئة</label><input id="sb-pre-'+safeP+'" class="ltr mono" value="'+esc(s.prefix||'.')+'" maxlength="4"></div>'
      +'</div>'
      +'<div class="meta-line" style="margin:6px 0 10px">'
      +'<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input style="width:auto;margin:0" type="checkbox" id="sb-wel-'+safeP+'"'+(s.welcome!==false?' checked':'')+'> الترحيب</label>'
      +'<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input style="width:auto;margin:0" type="checkbox" id="sb-auto-'+safeP+'"'+(s.autoReply!==false?' checked':'')+'> الرد التلقائي</label>'
      +'</div>'
      +'<div class="actions" style="margin-top:6px">'
      +'<button type="button" class="pri sm" onclick="saveSubSettingsAdmin(\\''+safeP+'\\')">حفظ التعديلات</button>'
      +'<button type="button" class="sky sm" onclick="adminBotAct(\\''+safeP+'\\',\\''+(s.paused?'resume':'pause')+'\\')">'+(s.paused?'استئناف البوت':'إيقاف مؤقت')+'</button>'
      +'<button type="button" class="ghost sm" onclick="adminBotAct(\\''+safeP+'\\',\\'reconnect\\')">إعادة اتصال</button>'
      +'<button type="button" class="ghost sm" onclick="adminBotAct(\\''+safeP+'\\',\\'regenerate-code\\')">توليد كود</button>'
      +'<button type="button" class="ghost sm" onclick="copyValue(\\''+esc(b.controlCode||'')+'\\')">نسخ الكود</button>'
      +'<button type="button" class="danger sm" onclick="if(confirm(\\'حذف البوت '+safeP+' نهائياً؟\\'))adminBotAct(\\''+safeP+'\\',\\'remove\\')">حذف</button>'
      +'</div>'
      +'</div>';
  }).join('');
}

async function saveMainSettings(){
  const payload={
    nameBot:document.getElementById('ms-nameBot').value,
    prefix:document.getElementById('ms-prefix').value,
    allowPublicWebPair:document.getElementById('ms-allowWeb').checked,
    noSub:document.getElementById('ms-noSub').checked,
    maintenance:document.getElementById('ms-maint').checked,
    autoRead:document.getElementById('ms-autoRead').checked,
    fromMeMode:document.getElementById('ms-fromMe').value,
    welcomeEnabled:document.getElementById('ms-welcome').checked,
    antiLink:document.getElementById('ms-antiLink').checked
  };
  const r=await fetch('/api/admin/main-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  toast(d.message||(d.ok?'تم حفظ إعدادات البوت الرئيسي':'فشل الحفظ'));
  loadFleet();refresh();
}
async function saveSubSettingsAdmin(phone){
  const payload={
    action:'update-settings',
    phone:phone,
    settings:{
      mode:document.getElementById('sb-mode-'+phone).value,
      customName:document.getElementById('sb-name-'+phone).value,
      prefix:document.getElementById('sb-pre-'+phone).value,
      welcome:document.getElementById('sb-wel-'+phone).checked,
      autoReply:document.getElementById('sb-auto-'+phone).checked
    }
  };
  const r=await fetch('/api/admin/bot-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  toast(d.message||(d.ok?'تم تحديث البوت':'تعذّر التحديث'));
  loadFleet();
}
async function adminBotAct(phone,action){
  const r=await fetch('/api/admin/bot-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,phone:phone})});
  const d=await r.json();
  toast(d.message||d.error||'تم');
  loadFleet();refresh();
}
async function adminAddSub(){
  const phone=document.getElementById('admSubPhone').value.trim();
  if(!phone){toast('اكتب رقم الهاتف');return;}
  const r=await fetch('/api/admin/bot-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add-sub',phone:phone})});
  const d=await r.json();
  toast(d.message||d.error||'تم');
  loadFleet();
}
async function adminAllowNum(approve,phoneArg){
  const phone=(phoneArg||document.getElementById('admSubPhone').value).trim();
  if(!phone){toast('اكتب رقم الهاتف');return;}
  const r=await fetch('/api/admin/bot-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:approve?'approve':'deny',phone:phone})});
  const d=await r.json();
  toast(d.message||d.error||'تم');
  loadFleet();
}

/* Command Explorer */
let allCommands=[],cmdPage=1;
const PAGE_SIZE=24;
async function loadCommands(force){
  try{
    const r=await fetch('/api/commands');
    if(r.status===401){location.reload();return;}
    const d=await r.json();
    allCommands=d.commands||[];
    const sel=document.getElementById('cmdCat');
    const prev=sel.value;
    sel.innerHTML='<option value="">كل الأقسام ('+allCommands.length+')</option>'
      +(d.categories||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.emoji+' '+c.label+' ('+c.count+')')+'</option>').join('');
    if(prev)sel.value=prev;
    renderCommands();
    if(force)toast('تم تحديث الفهرس: '+allCommands.length+' أمر');
  }catch(e){toast('تعذّر تحميل الأوامر');}
}
function getFilteredCommands(){
  const q=(document.getElementById('cmdSearch').value||'').trim().toLowerCase();
  const cat=document.getElementById('cmdCat').value;
  return allCommands.filter(c=>{
    if(cat && c.category!==cat) return false;
    if(!q) return true;
    return c.primary.toLowerCase().includes(q)
      || (c.description||'').toLowerCase().includes(q)
      || (c.categoryLabel||'').toLowerCase().includes(q)
      || (c.triggers||[]).some(t=>String(t).toLowerCase().includes(q));
  });
}
function renderCommands(){
  const items=getFilteredCommands();
  const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
  if(cmdPage>pages)cmdPage=pages;
  const start=(cmdPage-1)*PAGE_SIZE;
  const slice=items.slice(start,start+PAGE_SIZE);
  document.getElementById('cmdSummary').textContent='عرض '+slice.length+' من '+items.length+' أمر';
  document.getElementById('cmdPageInfo').textContent='صفحة '+cmdPage+' من '+pages;
  document.getElementById('cmdPrev').disabled=cmdPage<=1;
  document.getElementById('cmdNext').disabled=cmdPage>=pages;
  const grid=document.getElementById('cmdGrid');
  if(!slice.length){grid.innerHTML='<div class="hint">لا توجد أوامر مطابقة لبحثك.</div>';return;}
  grid.innerHTML=slice.map(c=>{
    const sample='.'+(c.usages&&c.usages[0]?c.usages[0].split(' ')[0]:c.primary);
    return '<div class="cmd-item">'
      +'<div><div class="cmd-head"><span class="cmd-name">.'+esc(c.primary)+'</span><span class="cmd-cat">'+esc(c.categoryEmoji+' '+c.categoryLabel)+'</span></div>'
      +'<div class="cmd-desc">'+esc(c.description||'أمر متاح للتشغيل')+'</div></div>'
      +'<button type="button" class="pri sm" data-cmd="'+esc(sample)+'" onclick="tryInSimulator(this.dataset.cmd)">جرب في المحاكي ▶</button>'
      +'</div>';
  }).join('');
}
function changePage(delta){cmdPage=Math.max(1,cmdPage+delta);renderCommands();}
function tryInSimulator(cmd){switchTab('simulator');runSim(cmd);}

/* Interactive Simulator */
function clearSim(){
  document.getElementById('simChat').innerHTML='<div class="wa-msg wa-bot"><div class="wa-body">تم مسح المحادثة. اكتب أي أمر لتجربته الآن!</div></div>';
}
function formatWaText(raw){
  let s=esc(raw||'');
  s=s.replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g,(_,c)=>'<pre>'+c.trim()+'</pre>');
  s=s.replace(/\\\`([^\\\`\\n]+)\\\`/g,'<code>$1</code>');
  s=s.replace(/\\*([^\\*\\n]+)\\*/g,'<strong>$1</strong>');
  s=s.replace(/(^|\\s)_([^_\\n]+)_(\\s|$)/g,'$1<em>$2</em>$3');
  return s;
}
function appendChatNode(node){
  const chat=document.getElementById('simChat');
  chat.appendChild(node);
  chat.scrollTop=chat.scrollHeight;
}
function copyValue(val){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(val).then(()=>toast('تم النسخ: '+val.slice(0,30))).catch(()=>toast('القيمة: '+val));
  }else{toast('القيمة: '+val);}
}
function renderButtons(btns){
  if(!btns||!btns.length)return null;
  const wrap=document.createElement('div');
  wrap.className='wa-btns';
  for(const b of btns){
    if(b.name==='single_select'&&b.params&&Array.isArray(b.params.sections)){
      const box=document.createElement('div');box.className='wa-select-box';
      const title=document.createElement('div');title.className='hint';title.textContent=(b.params.display_title||b.params.title||'قائمة اختيار');
      box.appendChild(title);
      for(const sec of b.params.sections){
        for(const row of (sec.rows||[])){
          const rbtn=document.createElement('button');rbtn.type='button';rbtn.className='wa-select-row';
          rbtn.innerHTML='<span>'+esc(row.title)+'</span><small class="t">'+esc(row.id||'')+'</small>';
          rbtn.onclick=()=>{if(row.id)runSim(row.id);};
          box.appendChild(rbtn);
        }
      }
      wrap.appendChild(box);
      continue;
    }
    const btn=document.createElement('button');btn.type='button';btn.className='wa-btn';
    if(b.name==='cta_copy'){
      btn.textContent=(b.params&&b.params.display_text)||'نسخ';
      btn.onclick=()=>copyValue((b.params&&b.params.copy_code)||'');
    }else if(b.name==='cta_url'){
      btn.textContent=(b.params&&b.params.display_text)||'رابط';
      btn.onclick=()=>toast('الرابط: '+((b.params&&b.params.url)||''));
    }else{
      const label=(b.params&&b.params.display_text)||b.displayText||b.id||'زر';
      const cmdId=(b.params&&b.params.id)||b.id||'';
      btn.textContent=label;
      btn.onclick=()=>{if(cmdId)runSim(cmdId);};
    }
    wrap.appendChild(btn);
  }
  return wrap;
}
async function runSim(presetCmd){
  const inp=document.getElementById('simInput');
  const cmd=(typeof presetCmd==='string'?presetCmd:inp.value).trim();
  if(!cmd){toast('اكتب أمراً أولاً');return;}
  if(typeof presetCmd==='string')inp.value=cmd;

  const uNode=document.createElement('div');
  uNode.className='wa-msg wa-user';
  uNode.innerHTML='<div class="wa-body">'+esc(cmd)+'</div>';
  appendChatNode(uNode);

  try{
    const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:cmd})});
    if(r.status===401){location.reload();return;}
    const d=await r.json();
    if(!d.ok){
      const eNode=document.createElement('div');eNode.className='wa-msg wa-bot';
      eNode.innerHTML='<div class="wa-body">'+esc(d.error||'تعذّر تنفيذ الأمر')+'</div>';
      appendChatNode(eNode);
      return;
    }
    const outs=(d.outputs&&d.outputs.length)?d.outputs:[{type:'text',text:'تم التنفيذ ('+d.durationMs+'ms)'}];
    for(const out of outs){
      const bNode=document.createElement('div');bNode.className='wa-msg wa-bot';
      if(out.type==='widget'){
        const hdr=document.createElement('div');hdr.innerHTML='<strong>'+esc(out.title||'Widget')+'</strong>';
        const ifr=document.createElement('iframe');
        ifr.className='wa-widget';
        ifr.setAttribute('sandbox','allow-scripts');
        ifr.srcdoc=out.html||'';
        bNode.appendChild(hdr);bNode.appendChild(ifr);
      }else if(out.type==='poll'){
        const pBox=document.createElement('div');pBox.className='wa-poll';
        pBox.innerHTML='<strong>'+esc(out.name)+'</strong>';
        for(const v of (out.values||[])){
          const ob=document.createElement('button');ob.type='button';ob.className='wa-poll-opt';
          ob.innerHTML='<span>'+esc(v)+'</span><span>0</span>';
          ob.onclick=()=>{
            pBox.querySelectorAll('.wa-poll-opt').forEach(x=>{x.classList.remove('voted');x.lastChild.textContent='0';});
            ob.classList.add('voted');ob.lastChild.textContent='1 ✓';
            toast('تم التصويت: '+v);
          };
          pBox.appendChild(ob);
        }
        bNode.appendChild(pBox);
      }else if(out.type==='carousel'){
        const h=document.createElement('div');h.className='wa-body';h.innerHTML=formatWaText(out.headerText||'');
        bNode.appendChild(h);
        const track=document.createElement('div');track.className='wa-carousel';
        for(const c of (out.cards||[])){
          const cc=document.createElement('div');cc.className='wa-car-card';
          cc.innerHTML='<strong>'+esc(c.title||'')+'</strong><div class="hint" style="margin:6px 0">'+esc(c.body||'')+'</div>';
          const btns=renderButtons(c.buttons||[]);
          if(btns)cc.appendChild(btns);
          track.appendChild(cc);
        }
        bNode.appendChild(track);
      }else{
        const body=document.createElement('div');body.className='wa-body';body.innerHTML=formatWaText(out.text||'');
        bNode.appendChild(body);
        const btns=renderButtons(out.buttons||[]);
        if(btns)bNode.appendChild(btns);
      }
      if(out.footer){
        const f=document.createElement('div');f.className='wa-footer';f.textContent=out.footer+' · '+d.durationMs+'ms';
        bNode.appendChild(f);
      }
      if(d.reactions&&d.reactions.length){
        const rx=document.createElement('div');rx.className='wa-reacts';rx.textContent='تفاعل: '+d.reactions.join(' ');
        bNode.appendChild(rx);
      }
      appendChatNode(bNode);
    }
  }catch(e){toast('خطأ في الاتصال بالمحاكي');}
}

refresh();setInterval(refresh,3000);
loadCommands();
loadFleet();
</script>
</body></html>`;
}

export const ADMIN_PANEL_HTML = renderAdminPanelHtml();
