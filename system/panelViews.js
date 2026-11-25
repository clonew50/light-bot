/**
 * panelViews.js — Bespoke Arabic-first web portal & admin studio for Yono
 * -------------------------------------------------------------------------
 * Exports:
 *   - renderPublicPortalHtml
 *   - renderAdminLoginHtml
 *   - renderAdminPanelHtml
 *   - renderMaintenanceHtml
 *   - INSTALL_RENDER_JS
 */
import { PANEL_CSS } from './panelStyles.js';

function esc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

const CODE_TILES_HELPER_JS = `function buildCodeTilesHtml(code, targetId){
  const raw = String(code || '').trim();
  if(!raw) return '';
  const parts = raw.split('-');
  let html = '<div class="code-tiles" role="button" tabindex="0" title="اضغط لنسخ الكود" data-code="' + esc(raw) + '" onclick="copyCodeValue(this.dataset.code)" onkeydown="if(event.key===\\'Enter\\'||event.key===\\' \\'){event.preventDefault();copyCodeValue(this.dataset.code)}">';
  parts.forEach((part, pIdx) => {
    for(let i = 0; i < part.length; i++){
      const delay = ((pIdx * 4 + i) * 35);
      html += '<span class="code-tile" style="animation-delay:' + delay + 'ms">' + esc(part[i]) + '</span>';
    }
    if(pIdx < parts.length - 1){
      html += '<span class="code-dash">-</span>';
    }
  });
  html += '</div>';
  if(targetId) html += '<span class="hidden" id="' + esc(targetId) + '">' + esc(raw) + '</span>';
  return html;
}`;

/* =====================================================================
 * PUBLIC PORTAL (Sub-Bot Pairing + Full Commands Menu + Live Status)
 * ===================================================================== */
export function renderPublicPortalHtml(err) {
	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Yono — بوابة ربط البوت وقائمة الأوامر</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>${PANEL_CSS}</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-inner">
    <a class="wordmark" href="/">
      <span class="wordmark-icon">Y</span>
      <span id="topBotName">Yono</span>
    </a>
    <nav class="topnav" aria-label="التنقل الرئيسي">
      <a href="#pair">ربط رقمك</a>
      <a href="#status">حالة البوت</a>
      <a href="#commands">قائمة الأوامر</a>
      <a href="#events">السجل المباشر</a>
    </nav>
    <div class="top-cta">
      <a class="btn sm ghost" href="/admin">لوحة الإدارة</a>
    </div>
  </div>
</header>

<main class="container">
  <!-- Hero Workspace Split -->
  <div class="hero-split">
    <!-- Primary Anchor: Sub-Bot Pairing & Control -->
    <section class="surface reveal" id="pair">
      <div class="surface-head">
        <div>
          <h1 class="surface-title">ربط وإدارة البوت الفرعي</h1>
          <p class="surface-sub">اربط رقم واتساب الخاص بك ليصبح بوتاً مستقلاً بكامل أوامر النظام</p>
        </div>
        <span class="meta-line" id="subSessionBadge">غير مسجل</span>
      </div>

      <div id="subAuthArea">
        <div class="seg-bar" role="tablist" aria-label="وضع الدخول">
          <button type="button" class="seg-btn active" id="tabNewBtn" role="tab" aria-selected="true" onclick="switchTab('new')">ربط رقم جديد</button>
          <button type="button" class="seg-btn" id="tabLoginBtn" role="tab" aria-selected="false" onclick="switchTab('login')">لدي كود تحكم</button>
        </div>

        <!-- Tab 1: New pairing -->
        <div id="tabNewPanel">
          <p class="hint" style="margin-bottom:14px">
            أدخل رقم هاتفك بالرمز الدولي بدون علامة + أو أصفار في البداية، ثم اختر طريقة الربط المناسبة.
          </p>
          <div class="form-row">
            <div class="field">
              <label for="subPhone">رقم الهاتف (مع رمز الدولة)</label>
              <input id="subPhone" class="mono ltr" inputmode="numeric" placeholder="201xxxxxxxxx"/>
            </div>
            <div class="field">
              <label for="subPairMode">طريقة الربط</label>
              <select id="subPairMode">
                <option value="code">كود ربط (8 خانات)</option>
                <option value="qr">رمز QR</option>
              </select>
            </div>
          </div>
          <button type="button" class="primary" id="btnPairSub" onclick="pairSubBot()">إصدار كود الربط الآن</button>
          <div id="subPairMsg" class="hidden" style="margin-top:12px"></div>
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
            <div style="font-size:12.5px;font-weight:600;color:var(--txt);margin-bottom:6px">كيف يتم الربط خلال ثوانٍ؟</div>
            <ol class="steps-ordered" style="margin-top:0">
              <li>أدخل رقمك بالرمز الدولي واضغط <b>إصدار كود الربط الآن</b> للحصول على كود من 8 خانات.</li>
              <li>في واتساب افتح <b>الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف</b> وأدخل الكود.</li>
              <li>احتفظ بـ <b>كود التحكم</b> لتعديل البادئة واسم البوت أو إيقاف الردود لاحقاً.</li>
            </ol>
          </div>
        </div>

        <!-- Tab 2: Control code login -->
        <div id="tabLoginPanel" class="hidden">
          <p class="hint" style="margin-bottom:14px">
            استخدم رقم الهاتف وكود التحكم الخاص بك (مثال: LB-XXXX-YYYY) لإدارة الإعدادات أو إعادة الربط.
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
        <div class="kv-row">
          <span class="kv-key">الرقم المسجل</span>
          <span class="kv-val ltr" id="sbPhone">-</span>
        </div>
        <div class="kv-row">
          <span class="kv-key">الحالة في واتساب</span>
          <span class="kv-val" id="sbState">-</span>
        </div>
        <div class="kv-row">
          <span class="kv-key">كود التحكم الخاص بك</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span class="kv-val ltr" id="sbControlCode" style="color:var(--acc);font-weight:700">-</span>
            <button type="button" class="btn sm ghost" onclick="copyCodeValue($('sbControlCode').textContent, this)">نسخ</button>
          </span>
        </div>

        <!-- Live Pairing Code / QR Stage -->
        <div id="sbPairingBox" class="pair-stage hidden">
          <div class="hint" id="sbPairingTitle" style="text-align:center">أدخل هذا الكود في واتساب للربط:</div>
          <div id="sbPairCodeWrap"></div>
          <div id="sbQrBox" class="qr-frame hidden"></div>
          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px" id="sbCopyCodeWrap">
            <button type="button" class="btn sm primary" id="sbCopyCodeBtn" onclick="copyCodeValue(currentSubPairCode, this)">نسخ كود واتساب</button>
            <button type="button" class="btn sm" onclick="subAction('repair','code')">إصدار كود جديد</button>
            <button type="button" class="btn sm" onclick="subAction('repair','qr')">عرض QR بدلاً من الكود</button>
          </div>
          <ol class="steps-ordered">
            <li>افتح تطبيق واتساب ثم انتقل إلى <b>الأجهزة المرتبطة (Linked Devices)</b>.</li>
            <li>اضغط <b>ربط جهاز</b> ثم اختر <b>الربط برقم الهاتف</b> أسفل الشاشة.</li>
            <li>أدخل الكود المكون من 8 خانات أعلاه واضغط تأكيد.</li>
          </ol>
        </div>

        <div id="sbErrorBanner" class="banner err hidden"></div>

        <!-- Sub-Bot Settings -->
        <div style="margin-top:16px">
          <div class="form-row">
            <div class="field">
              <label for="sbMode">وضع التشغيل</label>
              <select id="sbMode">
                <option value="public">عام — يرد على الجميع</option>
                <option value="self">خاص — يرد على رقمك فقط</option>
              </select>
            </div>
            <div class="field">
              <label for="sbPrefix">بادئة الأوامر</label>
              <input id="sbPrefix" class="mono ltr" maxlength="4" value="." oninput="refreshCmdPrefixes()"/>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="sbCustomName">اسم البوت المخصص</label>
              <input id="sbCustomName" placeholder="Yono Sub-Bot"/>
            </div>
            <div class="field">
              <label for="sbNotes">ملاحظة شخصية</label>
              <input id="sbNotes" placeholder="مثال: بوت إدارة جروب الشغل"/>
            </div>
          </div>

          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">رسائل الترحيب في المجموعات</div>
              <div class="switch-desc">تفعيل رسائل الترحيب التلقائية عند دخول أعضاء جدد</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="sbWelcome"/><span class="switch-track"></span></span>
          </label>
          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">الردود التلقائية</div>
              <div class="switch-desc">السماح للبوت الفرعي بمعالجة الأوامر والردود</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="sbAutoReply"/><span class="switch-track"></span></span>
          </label>
          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">إيقاف الردود مؤقتاً</div>
              <div class="switch-desc">تعطيل استقبال الأوامر دون حذف الجلسة</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="sbPaused"/><span class="switch-track"></span></span>
          </label>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
            <button type="button" class="primary" onclick="saveSubSettings()">حفظ الإعدادات</button>
            <button type="button" class="btn" onclick="subAction('repair','code')">إعادة الربط</button>
            <button type="button" class="btn" onclick="subAction('regenerate-code')">تغيير كود التحكم</button>
            <button type="button" class="btn" onclick="subAction('disconnect')">فصل مؤقت</button>
            <button type="button" class="btn danger" onclick="subAction('reset-session')">حذف الجلسة</button>
            <button type="button" class="btn ghost" onclick="subAction('logout')">خروج</button>
          </div>
          <div id="sbActionMsg" class="hidden" style="margin-top:10px"></div>
        </div>
      </div>
    </section>

    <!-- Companion Column: Bot Status & Command Distribution -->
    <section class="surface reveal-d1" id="status">
      <div class="surface-head">
        <div>
          <h2 class="surface-title">حالة البوت وتوزيع الأوامر</h2>
          <p class="surface-sub">ملخص التشغيل الحي وأقسام الأوامر المتاحة لجميع المستخدمين</p>
        </div>
        <span class="meta-line">مباشر</span>
      </div>

      <div id="catBars" style="margin-bottom:18px"></div>

      <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:auto">
        <div class="kv-row"><span class="kv-key">وضع البوت الأساسي</span><span class="kv-val" id="s-botmode">-</span></div>
        <div class="kv-row"><span class="kv-key">حالة الجلسة</span><span class="kv-val" id="s-reg">-</span></div>
        <div class="kv-row"><span class="kv-key">المستخدمون / المجموعات</span><span class="kv-val ltr" id="s-users">-</span></div>
        <div class="kv-row"><span class="kv-key">طريقة الربط الافتراضية</span><span class="kv-val" id="s-mode">-</span></div>
        <div class="kv-row"><span class="kv-key">الإصدار</span><span class="kv-val ltr" id="s-commit">-</span></div>
      </div>
    </section>
  </div>

  <!-- Full-Width 4-KPI Strip Below Hero Split -->
  <section class="kpi-strip reveal-d2" aria-label="ملخص الحالة">
    <div class="kpi">
      <div class="kpi-label">حالة البوت الأساسي</div>
      <div class="kpi-val" id="k-conn">جاري الاتصال</div>
      <div class="kpi-sub" id="k-conn-sub">يتم التحديث تلقائياً كل 3 ثوانٍ</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">الأوامر المتاحة</div>
      <div class="kpi-val" id="k-plugins">-</div>
      <div class="kpi-sub" id="k-cats">- تصنيف نشط</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">البوتات الفرعية النشطة</div>
      <div class="kpi-val ltr" id="k-subs">-</div>
      <div class="kpi-sub">متصل / إجمالي المسجلين</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">مدة التشغيل</div>
      <div class="kpi-val ltr" id="k-uptime">-</div>
      <div class="kpi-sub" id="k-mem">- MB ذاكرة</div>
    </div>
  </section>

  <!-- Full Commands Directory (Available to All Users) -->
  <section class="surface section-gap reveal-d3" id="commands">
    <div class="surface-head">
      <div>
        <h2 class="surface-title">قائمة أوامر البوت</h2>
        <p class="surface-sub">جميع الأوامر المتاحة لجميع المستخدمين للاستخدام في واتساب — ابحث أو اختر القسم واضغط على أي أمر لنسخه</p>
      </div>
      <span class="meta-line" id="pubCmdMeta">-</span>
    </div>

    <div class="cmd-toolbar">
      <div class="search-wrap">
        <label for="pubCmdSearch" class="hidden">بحث في الأوامر</label>
        <input id="pubCmdSearch" placeholder="ابحث عن أمر أو وصف (مثال: menu, sticker, hd)..." oninput="filterPublicCommands()" style="width:100%;min-height:40px;padding:8px 12px;border-radius:6px;background:var(--bg);border:1px solid var(--line-strong);color:var(--txt)"/>
      </div>
    </div>

    <div class="cat-bar" id="pubCatBar" role="group" aria-label="تصنيفات الأوامر">
      <button type="button" class="cat-btn active" onclick="selectPubCatEl(this)">الكل</button>
    </div>

    <div class="cmd-grid" id="pubCmdGrid" style="max-height:540px">
      <div class="muted">جاري تحميل قائمة الأوامر...</div>
    </div>
  </section>

  <!-- Live Events Log -->
  <section class="surface section-gap" id="events">
    <div class="surface-head">
      <div>
        <h2 class="surface-title">سجل الأحداث المباشر</h2>
        <p class="surface-sub">آخر تحديثات الاتصال وحالة الربط</p>
      </div>
      <span class="meta-line" id="eventsCount">0 حدث</span>
    </div>
    <div class="log-box" id="log"></div>
  </section>
</main>

<div class="toast-wrap" id="toasts" aria-live="polite"></div>

${err ? `<div style="position:fixed;bottom:16px;right:16px;max-width:460px;z-index:90" class="err-banner">${esc(err)}</div>` : ''}

<script>
const $ = (id) => document.getElementById(id);
let subQrObj = null, lastSubQr = null, currentSubPairCode = '', currentPubCat = '', lastCatsSig = '';

function toast(msg, kind = 'ok'){
  const wrap = $('toasts');
  if(!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.remove(); }, 2800);
}

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status === 503){ location.reload(); throw new Error('maintenance'); }
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ...data };
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

${CODE_TILES_HELPER_JS}

function showMsg(el, text, isErr){
  if(!el) return;
  el.textContent = text;
  el.className = isErr ? 'err-banner' : 'ok-banner';
}

function copyCodeValue(text, btn){
  const clean = String(text || '').trim();
  if(!clean || clean === '-') return;
  navigator.clipboard?.writeText(clean).then(() => {
    toast('تم نسخ: ' + clean, 'ok');
    if(btn){
      const old = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      setTimeout(() => { btn.textContent = old; }, 1400);
    }
  }).catch(() => {});
}

function switchTab(name){
  const isNew = name === 'new';
  $('tabNewBtn').className = isNew ? 'seg-btn active' : 'seg-btn';
  $('tabLoginBtn').className = !isNew ? 'seg-btn active' : 'seg-btn';
  $('tabNewBtn').setAttribute('aria-selected', String(isNew));
  $('tabLoginBtn').setAttribute('aria-selected', String(!isNew));
  $('tabNewPanel').className = isNew ? '' : 'hidden';
  $('tabLoginPanel').className = !isNew ? '' : 'hidden';
}

function refreshCmdPrefixes(){
  const prefix = ($('sbPrefix') && $('sbPrefix').value.trim()) || '.';
  document.querySelectorAll('#pubCmdGrid .cmd-card').forEach((card) => {
    const cmd = card.dataset?.cmd || '';
    const codeEl = card.querySelector('.cmd-code');
    if(cmd && codeEl) codeEl.textContent = prefix + cmd;
  });
}

function renderSubQr(qr){
  const box = $('sbQrBox');
  if(!box) return;
  if(!qr){ box.className = 'qr-frame hidden'; box.innerHTML = ''; lastSubQr = null; return; }
  box.className = 'qr-frame';
  if(qr === lastSubQr) return;
  lastSubQr = qr;
  box.innerHTML = '';
  try {
    subQrObj = new QRCode(box, { text: qr, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  } catch { box.textContent = qr; }
}

function applySubBotView(bot){
  if(!bot){
    $('subAuthArea').className = '';
    $('subActivePanel').className = 'hidden';
    $('subSessionBadge').textContent = 'غير مسجل';
    currentSubPairCode = '';
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
    stEl.className = 'kv-val ok';
  } else if(bot.pairStatus === 'pairing_code'){
    stEl.textContent = 'بانتظار إدخال كود الربط';
    stEl.className = 'kv-val warn';
  } else if(bot.pairStatus === 'qr'){
    stEl.textContent = 'بانتظار مسح QR';
    stEl.className = 'kv-val warn';
  } else if(bot.pairStatus === 'error' || bot.pairStatus === 'logged_out'){
    stEl.textContent = 'غير متصل (' + bot.pairStatus + ')';
    stEl.className = 'kv-val err';
  } else {
    stEl.textContent = bot.connection || bot.pairStatus || 'خامل';
    stEl.className = 'kv-val';
  }

  const pairBox = $('sbPairingBox');
  const codeWrap = $('sbPairCodeWrap');
  const copyBtn = $('sbCopyCodeBtn');
  if(bot.pairStatus !== 'connected' && (bot.pairingCode || bot.qr)){
    pairBox.className = 'pair-stage';
    if(bot.pairingCode){
      if(currentSubPairCode !== bot.pairingCode){
        currentSubPairCode = bot.pairingCode;
        codeWrap.innerHTML = buildCodeTilesHtml(bot.pairingCode);
      }
      if(copyBtn) copyBtn.className = 'btn sm primary';
      $('sbPairingTitle').textContent = 'أدخل كود الربط في واتساب (الأجهزة المرتبطة):';
    } else {
      currentSubPairCode = '';
      codeWrap.innerHTML = '';
      if(copyBtn) copyBtn.className = 'btn sm primary hidden';
      $('sbPairingTitle').textContent = 'امسح رمز QR من تطبيق واتساب:';
    }
    renderSubQr(bot.qr || null);
  } else {
    currentSubPairCode = '';
    pairBox.className = 'pair-stage hidden';
    codeWrap.innerHTML = '';
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
  if(!['sbMode','sbPrefix','sbCustomName','sbNotes','sbWelcome','sbAutoReply','sbPaused'].includes(actId) && bot.settings){
    $('sbMode').value = bot.settings.mode === 'self' ? 'self' : 'public';
    $('sbPrefix').value = bot.settings.prefix || '.';
    $('sbCustomName').value = bot.settings.customName || '';
    $('sbNotes').value = bot.settings.notes || '';
    $('sbWelcome').checked = bot.settings.welcome !== false;
    $('sbAutoReply').checked = bot.settings.autoReply !== false;
    $('sbPaused').checked = !!bot.settings.paused;
    refreshCmdPrefixes();
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
      toast('تم إنشاء جلسة البوت الفرعي', 'ok');
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
      toast('تم فتح لوحة البوت الفرعي', 'ok');
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
        notes: $('sbNotes').value,
        welcome: $('sbWelcome').checked,
        autoReply: $('sbAutoReply').checked,
        paused: $('sbPaused').checked
      })
    });
    if(r.ok){
      showMsg(msg, r.message || 'تم الحفظ', false);
      toast('تم حفظ إعدادات البوت الفرعي', 'ok');
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
      toast('تم تسجيل الخروج', 'ok');
      return;
    }
    if(r.ok){
      showMsg(msg, r.message || 'تم التنفيذ', false);
      toast(r.message || 'تم التنفيذ', 'ok');
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

function selectPubCatEl(btn){
  currentPubCat = btn ? (btn.dataset.cat || '') : '';
  document.querySelectorAll('#pubCatBar .cat-btn').forEach((b) => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  filterPublicCommands();
}

async function filterPublicCommands(){
  const q = ($('pubCmdSearch') && $('pubCmdSearch').value) || '';
  try{
    const r = await api('/api/public/commands?q=' + encodeURIComponent(q) + '&cat=' + encodeURIComponent(currentPubCat));
    if(!r.ok) return;
    const catSig = (r.categories || []).map((c) => c.id + ':' + c.count).join('|');
    if(catSig !== lastCatsSig){
      lastCatsSig = catSig;
      const bar = $('pubCatBar');
      if(bar){
        let h = '<button type="button" class="cat-btn' + (currentPubCat === '' ? ' active' : '') + '" data-cat="" onclick="selectPubCatEl(this)">الكل (' + (r.total || 0) + ')</button>';
        (r.categories || []).forEach((c) => {
          h += '<button type="button" class="cat-btn' + (currentPubCat === c.id ? ' active' : '') + '" data-cat="' + esc(c.id) + '" onclick="selectPubCatEl(this)">' + esc(c.label) + ' (' + c.count + ')</button>';
        });
        bar.innerHTML = h;
      }
    }
    const grid = $('pubCmdGrid');
    const prefix = ($('sbPrefix') && $('sbPrefix').value.trim()) || '.';
    if(grid){
      grid.innerHTML = (r.commands || []).map((c) =>
        '<button type="button" class="cmd-card" title="اضغط لنسخ الأمر" data-cmd="' + esc(c.primary) + '" onclick="pickPublicCommandEl(this)">'
        + '<div class="cmd-card-top"><span class="cmd-code">' + esc(prefix + c.primary) + '</span><span class="cmd-meta">' + esc(c.categoryLabel) + '</span></div>'
        + '<div class="cmd-desc">' + esc(c.description || c.primary) + '</div>'
        + '</button>'
      ).join('') || '<div class="muted">لا توجد أوامر مطابقة للبحث.</div>';
    }
    if($('pubCmdMeta')) $('pubCmdMeta').textContent = (r.filtered || 0) + ' من ' + (r.total || 0) + ' أمر';
  } catch {}
}

function pickPublicCommandEl(el){
  const cmd = el?.dataset?.cmd || '';
  if(!cmd) return;
  const prefix = ($('sbPrefix') && $('sbPrefix').value.trim()) || '.';
  copyCodeValue(prefix + cmd);
}

function renderCategoryBars(cats){
  const wrap = $('catBars');
  if(!wrap || !Array.isArray(cats) || !cats.length) return;
  const max = Math.max(1, ...cats.map((c) => c.count || 0));
  wrap.innerHTML = cats.slice(0, 6).map((c) => {
    const pct = Math.max(6, Math.round(((c.count || 0) / max) * 100));
    return '<div class="bar-row">'
      + '<div class="bar-head"><span>' + esc(c.label) + '</span><span class="mono">' + (c.count || 0) + '</span></div>'
      + '<div class="bar-track"><div class="bar-fill" style="transform:scaleX(' + (pct / 100) + ')"></div></div>'
      + '</div>';
  }).join('');
}

async function refresh(){
  try{
    const s = await api('/api/public/status');
    if(s.ok){
      if(s.connected){
        $('k-conn').textContent = 'متصل ✓';
        $('k-conn').className = 'kpi-val ok';
        $('k-conn-sub').textContent = 'يعمل ويستقبل الرسائل الآن';
      } else if(s.connection === 'connecting' || s.connection === 'starting'){
        $('k-conn').textContent = 'جاري الاتصال';
        $('k-conn').className = 'kpi-val warn';
        $('k-conn-sub').textContent = 'جاري تهيئة الجلسة مع واتساب';
      } else {
        $('k-conn').textContent = 'غير متصل';
        $('k-conn').className = 'kpi-val err';
        $('k-conn-sub').textContent = 'بانتظار إتمام الربط من لوحة الإدارة';
      }
      if(s.botName){
        $('topBotName').textContent = s.botName;
      }
      $('k-plugins').textContent = s.commands || 0;
      $('k-cats').textContent = (s.categoriesCount || 0) + ' تصنيف نشط';
      $('k-subs').textContent = (s.activeSubBotsCount || 0) + ' / ' + (s.subBotsCount || 0);
      $('k-uptime').textContent = fmtUptime(s.uptimeSec);
      $('k-mem').textContent = (s.memoryMB || 0) + ' MB ذاكرة';

      $('s-botmode').textContent = (s.botMode === 'self' ? 'خاص' : 'عام') + ' · ' + (s.gconly ? 'مجموعات فقط' : 'الخاص والمجموعات');
      $('s-reg').textContent = s.sessionRegistered ? 'مسجلة' : 'غير مسجلة';
      $('s-users').textContent = (s.usersCount || 0) + ' / ' + (s.groupsCount || 0);
      $('s-mode').textContent = s.loginMode === 'qr' ? 'QR' : 'Pairing Code';
      $('s-commit').textContent = s.commit || 'v2.0.0';

      if(s.topCategories) renderCategoryBars(s.topCategories);

      const evs = s.events || [];
      if($('eventsCount')) $('eventsCount').textContent = evs.length + ' حدث';
      const log = $('log');
      if(log){
        log.innerHTML = evs.map(e => {
          const t = new Date(e.ts || Date.now()).toLocaleTimeString();
          return '<div class="log-line"><span class="log-time">'+esc(t)+'</span><span class="log-msg">'+esc(e.text || '')+'</span></div>';
        }).join('') || '<div class="muted">لا توجد أحداث مسجلة بعد</div>';
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
filterPublicCommands();
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
<style>${PANEL_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div class="wordmark-icon" style="width:40px;height:40px;font-size:17px">A</div>
      <div>
        <h1 class="login-title" style="margin-bottom:0">لوحة تحكم الإدارة</h1>
        <div class="muted">إدارة البوت الأساسي · الإعدادات · البوتات الفرعية</div>
      </div>
    </div>
    ${err ? `<div class="err-banner" style="margin-bottom:16px">${esc(err)}</div>` : ''}
    <form method="POST" action="/login">
      <div class="field">
        <label for="password">كلمة مرور الإدارة (من ملف system/panel-config.json)</label>
        <div style="display:flex;gap:8px">
          <input id="password" name="password" type="password" class="mono ltr" required autofocus placeholder="أدخل كلمة المرور"/>
          <button type="button" class="btn sm ghost" id="togglePwBtn" onclick="const p=document.getElementById('password');const s=p.type==='password';p.type=s?'text':'password';this.textContent=s?'إخفاء':'إظهار';">إظهار</button>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:20px">
        <button type="submit" class="primary">تسجيل الدخول</button>
        <a class="btn ghost sm" href="/">العودة للبوابة العامة</a>
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
export const INSTALL_RENDER_JS = `${CODE_TILES_HELPER_JS}
function formatPairErr(err){
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
    html += '<div class="pair-stage">'
      + '<div class="hint" style="text-align:center">افتح واتساب ← الأجهزة المرتبطة ← الربط برقم الهاتف ثم أدخل الكود:</div>'
      + buildCodeTilesHtml(d.pairingCode, 'mainPairCodeVal')
      + '<div style="display:flex;justify-content:center;gap:8px;margin-top:8px"><button type="button" class="btn sm primary" onclick="copyCodeValue(document.getElementById(\\'mainPairCodeVal\\').textContent, this)">نسخ كود الربط</button></div>'
      + '</div>';
  }
  if(showQr){
    html += '<div class="pair-stage"><div class="hint" style="text-align:center">امسح رمز QR من تطبيق واتساب:</div><div class="qr-frame" id="qr"></div></div>';
  }
  if(d.pairingError && d.loginMode !== 'qr' && !d.pairingCode){
    html += '<div class="banner err">' + esc(formatPairErr(d.pairingError)) + '</div>';
  } else if(!d.pairingCode && !showQr){
    html += (d.loginMode === 'code' && !d.configuredPhone)
      ? '<div class="hint">أدخل رقم البوت بالرمز الدولي ثم اضغط <b>إصدار كود الربط</b>.</div>'
      : '<div class="hint">بانتظار استجابة خادم واتساب لإصدار ' + (d.loginMode === 'qr' ? 'رمز QR' : 'كود الربط') + '...</div>';
  }
  html += '<div style="margin-top:16px"><div class="form-row">'
     + '<div class="field"><label for="lm">طريقة الربط</label>'
     + '<select id="lm"><option value="code"' + (d.loginMode === 'code' ? ' selected' : '') + '>كود ربط (Pairing Code)</option>'
     + '<option value="qr"' + (d.loginMode === 'qr' ? ' selected' : '') + '>رمز QR</option></select></div>'
     + '<div class="field"><label for="ph">رقم البوت الأساسي</label>'
     + '<input id="ph" class="ltr mono" value="' + esc(d.configuredPhone) + '" placeholder="201505xxxxxx"></div></div>'
     + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
     + '<button type="button" class="primary sm" onclick="pairMainNow()">إصدار كود الربط الآن</button>'
     + '<button type="button" class="btn sm" onclick="applyLogin()">حفظ وتطبيق الطريقة</button>'
     + '<button type="button" class="btn sm ghost" onclick="refresh()">تحديث</button></div></div>';
  box.innerHTML = html;
  if(showQr) renderQR(d.qr);
}`;

/* =====================================================================
 * ADMIN STUDIO (authenticated Sidebar + Workspace)
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
<style>${PANEL_CSS}</style>
</head>
<body>

<div class="admin-shell">
  <!-- Sidebar -->
  <aside class="sidebar" aria-label="أقسام لوحة الإدارة">
    <a class="wordmark" href="/admin">
      <span class="wordmark-icon">Y</span>
      <span>Yono الإدارة</span>
    </a>

    <nav class="side-nav" id="sideNav">
      <button type="button" class="side-btn active" data-sec="all" onclick="showSection('all', this)"><span>نظرة شاملة</span><span class="side-count">الكل</span></button>
      <button type="button" class="side-btn" data-sec="pairing" onclick="showSection('pairing', this)"><span>الربط والاتصال</span><span class="side-count" id="navConnBadge">-</span></button>
      <button type="button" class="side-btn" data-sec="settings" onclick="showSection('settings', this)"><span>سلوك البوت</span><span class="side-count" id="navModeBadge">-</span></button>
      <button type="button" class="side-btn" data-sec="subbots" onclick="showSection('subbots', this)"><span>البوتات الفرعية</span><span class="side-count" id="navSubCount">0</span></button>
      <button type="button" class="side-btn" data-sec="send" onclick="showSection('send', this)"><span>استوديو الإرسال</span></button>
      <button type="button" class="side-btn" data-sec="commands" onclick="showSection('commands', this)"><span>الأوامر والإحصائيات</span><span class="side-count" id="navCmdCount">0</span></button>
      <button type="button" class="side-btn" data-sec="security" onclick="showSection('security', this)"><span>الصيانة والسجل</span></button>
    </nav>

    <div style="margin-top:auto;border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:8px">
      <a class="btn sm ghost" href="/">البوابة العامة</a>
      <button type="button" class="btn sm danger" onclick="logout()">تسجيل الخروج</button>
    </div>
  </aside>

  <div class="admin-main">
    <header class="admin-topbar">
      <div class="breadcrumb">
        <span>لوحة الإدارة</span>
        <span>/</span>
        <b id="crumbSection">نظرة شاملة</b>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="meta-line" id="topConnLabel">جاري الفحص...</span>
        <a class="btn sm ghost" href="/">البوابة العامة</a>
      </div>
    </header>

    <div class="mobile-nav" id="mobileNav">
      <button type="button" class="seg-btn active" data-sec="all" onclick="showSection('all', this)">الكل</button>
      <button type="button" class="seg-btn" data-sec="pairing" onclick="showSection('pairing', this)">الربط</button>
      <button type="button" class="seg-btn" data-sec="settings" onclick="showSection('settings', this)">الإعدادات</button>
      <button type="button" class="seg-btn" data-sec="subbots" onclick="showSection('subbots', this)">الفرعية</button>
      <button type="button" class="seg-btn" data-sec="send" onclick="showSection('send', this)">إرسال</button>
      <button type="button" class="seg-btn" data-sec="commands" onclick="showSection('commands', this)">الأوامر</button>
      <button type="button" class="seg-btn" data-sec="security" onclick="showSection('security', this)">السجل</button>
    </div>

    <main class="admin-content">
      <div id="maintBanner" class="maint-banner hidden">
        <span>⚠</span><span>وضع الصيانة <b>مفعّل</b> — الزوار يرون شاشة الصيانة حالياً.</span>
      </div>

      <!-- KPIs -->
      <section class="kpi-strip reveal" style="margin-top:0;margin-bottom:20px" data-group="overview">
        <div class="kpi">
          <div class="kpi-label">حالة الاتصال</div>
          <div class="kpi-val" id="k-admin-conn">-</div>
          <div class="kpi-sub" id="s-phone">-</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">المستخدمون المسجلون</div>
          <div class="kpi-val" id="k-admin-users">0</div>
          <div class="kpi-sub" id="k-admin-groups">0 مجموعة · 0 محادثة</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">إجمالي تنفيذ الأوامر</div>
          <div class="kpi-val" id="k-admin-hits">0</div>
          <div class="kpi-sub" id="k-admin-cmds">0 أمر مفعّل</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">الموارد والتشغيل</div>
          <div class="kpi-val ltr" id="s-uptime">-</div>
          <div class="kpi-sub" id="s-mem">- MB</div>
        </div>
      </section>

      <!-- Section: Pairing & Main Controls -->
      <section class="grid-12 reveal-d1" data-section="pairing">
        <div class="surface col-8">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">ربط البوت الأساسي بواتساب</h2>
              <p class="surface-sub">إصدار كود الربط أو رمز QR والتحكم في الجلسة</p>
            </div>
            <span class="meta-line" id="s-reg">-</span>
          </div>
          <div id="installBody"></div>
        </div>

        <div class="surface col-4">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">معلومات وتشغيل البوت</h2>
              <p class="surface-sub">أوامر الخادم المباشرة</p>
            </div>
          </div>
          <div class="kv-row"><span class="kv-key">الاسم</span><span class="kv-val" id="s-name">-</span></div>
          <div class="kv-row"><span class="kv-key">طريقة الربط</span><span class="kv-val" id="s-mode">-</span></div>
          <div class="kv-row"><span class="kv-key">الإضافات</span><span class="kv-val" id="s-plugins">-</span></div>
          <div class="kv-row"><span class="kv-key">الإصدار</span><span class="kv-val ltr" id="s-commit">-</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
            <button type="button" class="btn sm" onclick="act('restart')">↻ إعادة تشغيل</button>
            <button type="button" class="btn sm danger" onclick="act('reset-session')">إعادة ضبط الجلسة</button>
            <button type="button" class="btn sm" onclick="act('stop')">■ إيقاف</button>
            <button type="button" class="btn sm primary" onclick="act('start')">▶ تشغيل</button>
          </div>
        </div>
      </section>

      <!-- Section: Bot Settings & Send Studio -->
      <section class="grid-12 section-gap reveal-d2" data-section="settings send">
        <div class="surface col-6" data-section="settings">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">إعدادات سلوك البوت الأساسي</h2>
              <p class="surface-sub">تطبيق فوري على قاعدة البيانات وإعدادات الاستقبال</p>
            </div>
          </div>

          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">الوضع العام (Public Mode)</div>
              <div class="switch-desc">عند التفعيل يرد البوت على جميع المستخدمين وليس المالك فقط</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="bsPublic"/><span class="switch-track"></span></span>
          </label>
          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">قصر الرد على المجموعات فقط (gconly)</div>
              <div class="switch-desc">أوقفه للسماح للبوت بالرد داخل المحادثات الخاصة (DM)</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="bsGconly"/><span class="switch-track"></span></span>
          </label>
          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">القراءة التلقائية (Auto-Read)</div>
              <div class="switch-desc">تحديد الرسائل الواردة كمقروءة تلقائياً</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="bsAutoread"/><span class="switch-track"></span></span>
          </label>
          <label class="switch-row">
            <div class="switch-info">
              <div class="switch-title">رفض المكالمات (Anti-Call)</div>
              <div class="switch-desc">رفض المكالمات الصوتية والمرئية الواردة تلقائياً</div>
            </div>
            <span class="switch-ctl"><input type="checkbox" id="bsAnticall"/><span class="switch-track"></span></span>
          </label>

          <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
            <button type="button" class="primary" onclick="saveBotSettings()">حفظ وتطبيق الإعدادات</button>
            <span id="bsMsg" class="muted"></span>
          </div>
        </div>

        <div class="surface col-6" data-section="send">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">استوديو إرسال رسالة اختبارية</h2>
              <p class="surface-sub">أرسل رسالة مباشرة من رقم البوت الأساسي</p>
            </div>
          </div>
          <div class="field">
            <label for="sendNum">رقم المستلم (مع رمز الدولة)</label>
            <input id="sendNum" class="mono ltr" inputmode="numeric" placeholder="201xxxxxxxxx"/>
          </div>
          <div class="field">
            <label for="sendMsg">نص الرسالة</label>
            <textarea id="sendMsg" placeholder="اكتب رسالتك هنا..."></textarea>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
            <button type="button" class="cat-btn" onclick="$('sendMsg').value='أهلاً! البوت يعمل بشكل سليم الآن.'">قالب ترحيب</button>
            <button type="button" class="cat-btn" onclick="$('sendMsg').value='.menu'">اختبار القائمة (.menu)</button>
            <button type="button" class="cat-btn" onclick="$('sendMsg').value='تم تحديث البوت وإعادة تشغيله بنجاح.'">إشعار تحديث</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <button type="button" class="primary" onclick="sendMsg()">إرسال الرسالة الآن</button>
            <span id="ctrlMsg" class="muted"></span>
          </div>
        </div>
      </section>

      <!-- Section: Sub-Bots Fleet -->
      <section class="surface section-gap" data-section="subbots">
        <div class="surface-head">
          <div>
            <h2 class="surface-title">إدارة البوتات الفرعية (Sub-Bots)</h2>
            <p class="surface-sub">مراقبة، إيقاف مؤقت، أو إعادة ضبط جلسات البوتات الفرعية</p>
          </div>
          <span class="meta-line" id="subCountMeta">0 مسجل</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>الاسم</th>
                <th>البادئة</th>
                <th>الحالة</th>
                <th>الوضع</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody id="subBotsTable">
              <tr><td colspan="6" class="muted">لا توجد بوتات فرعية مسجلة</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section: Commands & Stats -->
      <section class="grid-12 section-gap" data-section="commands">
        <div class="surface col-8">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">متصفح الأوامر</h2>
              <p class="surface-sub">اضغط على أي أمر لنسخه فوراً</p>
            </div>
            <span class="meta-line" id="cmdMeta">-</span>
          </div>
          <div class="form-row" style="margin-bottom:12px">
            <div class="field" style="margin-bottom:0"><input id="cmdSearch" placeholder="ابحث عن أمر..." oninput="loadCommands()"/></div>
            <div class="field" style="margin-bottom:0"><select id="cmdCat" onchange="loadCommands()"><option value="">كل التصنيفات</option></select></div>
          </div>
          <div class="cmd-grid" id="cmdList"></div>
        </div>

        <div class="surface col-4">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">الأكثر استخداماً</h2>
              <p class="surface-sub">أكثر الأوامر تنفيذاً</p>
            </div>
          </div>
          <div id="topCmdBars"><div class="muted">لا توجد إحصائيات استخدام مسجلة بعد</div></div>
        </div>
      </section>

      <!-- Section: Security, Maintenance, Updates & Log -->
      <section class="grid-12 section-gap" data-section="security">
        <div class="surface col-5">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">الصيانة والأمان والتحديثات</h2>
              <p class="surface-sub">فحص التحديثات التلقائية وتدوير كلمة المرور</p>
            </div>
          </div>
          <div class="kv-row"><span class="kv-key">وضع الصيانة</span><span class="kv-val" id="maintState">-</span></div>
          <div class="kv-row"><span class="kv-key">فترة التحديث التلقائي</span><span class="kv-val">كل <span id="autoInt">60</span> دقيقة</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <button type="button" class="btn danger sm" onclick="setMaint(true)">تفعيل الصيانة</button>
            <button type="button" class="btn sm" onclick="setMaint(false)">إيقاف الصيانة</button>
            <button type="button" class="btn sm" onclick="rotatePw()">تغيير كلمة المرور</button>
            <button type="button" class="btn sm" onclick="checkUpdate()">فحص التحديثات</button>
            <button type="button" class="btn primary sm" onclick="applyUpdate()">تطبيق التحديث</button>
          </div>
          <p id="maintMsg" class="muted" style="margin-top:10px"></p>
          <p id="pwMsg" class="muted" style="margin-top:4px"></p>
          <p id="updMsg" class="muted" style="margin-top:4px"></p>
        </div>

        <div class="surface col-7">
          <div class="surface-head">
            <div>
              <h2 class="surface-title">سجل الأحداث المباشر</h2>
              <p class="surface-sub">أحداث النظام والربط والإعدادات</p>
            </div>
          </div>
          <div class="log-box" id="log"></div>
        </div>
      </section>
    </main>
  </div>
</div>

<div class="toast-wrap" id="toasts" aria-live="polite"></div>

<script>
const $ = (id) => document.getElementById(id);
let lastQR = null, qrObj = null, lastCmdSig = '';

function toast(msg, kind = 'ok'){
  const wrap = $('toasts');
  if(!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.remove(); }, 2800);
}

const SEC_LABELS = {
  all: 'نظرة شاملة',
  pairing: 'الربط والاتصال',
  settings: 'سلوك البوت',
  subbots: 'البوتات الفرعية',
  send: 'استوديو الإرسال',
  commands: 'الأوامر والإحصائيات',
  security: 'الصيانة والسجل'
};

function showSection(sec, triggerBtn){
  document.querySelectorAll('#sideNav .side-btn, #mobileNav .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-sec') === sec);
  });
  if($('crumbSection')) $('crumbSection').textContent = SEC_LABELS[sec] || 'نظرة شاملة';
  document.querySelectorAll('[data-section]').forEach((el) => {
    const tags = (el.getAttribute('data-section') || '').split(/\\s+/);
    const visible = sec === 'all' || tags.includes(sec);
    el.classList.toggle('hidden', !visible);
  });
  if(triggerBtn && sec !== 'all') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function api(path, opts){
  const r = await fetch(path, opts);
  if(r.status === 401){ location.reload(); throw new Error('auth'); }
  if(r.status === 503){ location.reload(); throw new Error('maintenance'); }
  return r.json().catch(() => ({}));
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function copyCodeValue(text, btn){
  const clean = String(text || '').trim();
  if(!clean || clean === '-') return;
  navigator.clipboard?.writeText(clean).then(() => {
    toast('تم نسخ: ' + clean, 'ok');
    if(btn){
      const old = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      setTimeout(() => { btn.textContent = old; }, 1400);
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
      if(r.error){ if(el) el.textContent = '⚠ ' + r.error; toast(r.error, 'err'); }
      else { const txt = r.pairingCode ? ('كود الربط: ' + r.pairingCode) : (r.message || 'تم'); if(el) el.textContent = txt; toast(txt, 'ok'); }
      refresh();
    })
    .catch(e => { if(el) el.textContent = '⚠ ' + e.message; refresh(); });
}
function applyLogin(){
  const phone = ($('ph') && $('ph').value || '').trim();
  const mode = ($('lm') && $('lm').value) || 'code';
  api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'set-login',phone,loginMode:mode})})
    .then(r => { const el=$('ctrlMsg'); const msg=r.message||'تم الحفظ'; if(el) el.textContent = msg; toast(msg, 'ok'); })
    .catch(e => { const el=$('ctrlMsg'); if(el) el.textContent = '⚠ ' + e.message; });
}

async function saveBotSettings(){
  const msgEl = $('bsMsg');
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'save-bot-settings',
        public: $('bsPublic').checked,
        gconly: $('bsGconly').checked,
        autoread: $('bsAutoread').checked,
        anticall: $('bsAnticall').checked
      })});
    const m = r.message || (r.ok ? 'تم الحفظ' : 'فشل الحفظ');
    if(msgEl) msgEl.textContent = m;
    toast(m, r.ok ? 'ok' : 'err');
    refresh();
  } catch(e){ if(msgEl) msgEl.textContent = '⚠ ' + e.message; }
}

async function act(action, extra){
  if(action==='reset-session' && !confirm('نقل الجلسة الحالية لنسخة احتياطية وإعادة التشغيل؟')) return;
  if(action==='stop' && !confirm('إيقاف البوت الأساسي؟')) return;
  const el=$('ctrlMsg'); if(el) el.textContent='جاري التنفيذ...';
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action, ...(extra||{})})});
    const m = r.message || (r.ok ? 'تم' : 'فشل');
    if(el) el.textContent = m;
    toast(m, r.ok ? 'ok' : 'err');
    refresh();
  }catch(e){ if(el) el.textContent='⚠ '+e.message; toast(e.message, 'err'); }
}
async function sendMsg(){
  const el=$('ctrlMsg');
  try{
    const r = await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'send',to:$('sendNum').value,text:$('sendMsg').value})});
    const m = r.ok ? ('✓ ' + (r.message||'تم الإرسال')) : ('⚠ '+(r.message||'فشل الإرسال'));
    if(el) el.textContent = m;
    toast(m, r.ok ? 'ok' : 'err');
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
  toast(r.message || 'تم', 'ok');
  refresh();
}
async function rotatePw(){
  if(!confirm('توليد كلمة مرور جديدة وإنهاء الجلسات الأخرى؟')) return;
  const r = await api('/api/rotate-password',{method:'POST'});
  const el=$('pwMsg');
  if(el) el.textContent = r.password ? ('كلمة المرور الجديدة: ' + r.password) : 'فشل التوليد';
  if(r.password) toast('تم توليد كلمة مرور جديدة', 'ok');
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
    '<button type="button" class="cmd-card" data-cmd="' + esc('.' + c.primary) + '" onclick="copyCodeValue(this.dataset.cmd)">'
    + '<div class="cmd-card-top"><span class="cmd-code">.' + esc(c.primary) + '</span><span class="cmd-meta">' + esc(c.categoryLabel) + '</span></div>'
    + '<div class="cmd-desc">' + esc(c.description || c.primary) + '</div>'
    + '</button>'
  ).join('') || '<div class="muted">لا توجد أوامر مطابقة</div>';
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

  const connEl = $('k-admin-conn');
  if(s.connected){
    if(connEl){ connEl.textContent = 'متصل ✓'; connEl.className = 'kpi-val ok'; }
    if($('topConnLabel')) $('topConnLabel').textContent = 'متصل بواتساب ✓';
    if($('navConnBadge')) $('navConnBadge').textContent = 'متصل';
  } else {
    const isWait = s.connection === 'connecting' || s.connection === 'starting';
    if(connEl){ connEl.textContent = isWait ? 'جاري الاتصال' : 'غير متصل'; connEl.className = isWait ? 'kpi-val warn' : 'kpi-val err'; }
    if($('topConnLabel')) $('topConnLabel').textContent = isWait ? 'جاري الاتصال...' : 'غير متصل';
    if($('navConnBadge')) $('navConnBadge').textContent = isWait ? 'انتظار' : 'متوقف';
  }

  if($('s-reg')) $('s-reg').textContent = s.sessionRegistered ? 'جلسة مسجلة' : 'غير مسجلة';
  if($('s-mode')) $('s-mode').textContent = s.loginMode === 'qr' ? 'QR' : 'Pairing Code';
  if($('s-phone')) $('s-phone').textContent = s.configuredPhone || s.phone || '-';
  if($('s-name')) $('s-name').textContent = s.name || '-';
  if($('s-plugins')) $('s-plugins').textContent = s.commands || 0;
  if($('s-mem')) $('s-mem').textContent = (s.memoryMB || 0) + ' MB ذاكرة';
  if($('s-uptime')) $('s-uptime').textContent = fmtUptime(s.uptimeSec || 0);
  if($('s-commit')) $('s-commit').textContent = s.commit || 'v2.0.0';
  if($('autoInt') && s.autoUpdateIntervalMin) $('autoInt').textContent = s.autoUpdateIntervalMin;
  if($('navCmdCount')) $('navCmdCount').textContent = s.commands || 0;

  if(s.stats){
    if($('k-admin-users')) $('k-admin-users').textContent = s.stats.usersCount || 0;
    if($('k-admin-groups')) $('k-admin-groups').textContent = (s.stats.groupsCount || 0) + ' مجموعة · ' + (s.stats.chatsCount || 0) + ' محادثة';
    if($('k-admin-hits')) $('k-admin-hits').textContent = s.stats.totalCommandsRun || 0;
    if($('k-admin-cmds')) $('k-admin-cmds').textContent = (s.commands || 0) + ' أمر مفعّل';

    const topWrap = $('topCmdBars');
    const top = s.stats.topCommands || [];
    if(topWrap && top.length){
      const maxH = Math.max(1, ...top.map((t) => t.hits));
      topWrap.innerHTML = top.map((t) => {
        const pct = Math.max(8, Math.round((t.hits / maxH) * 100));
        return '<div class="bar-row">'
          + '<div class="bar-head"><span class="mono ltr">.' + esc(t.name) + '</span><span class="mono">' + t.hits + '</span></div>'
          + '<div class="bar-track"><div class="bar-fill" style="transform:scaleX(' + (pct / 100) + ')"></div></div>'
          + '</div>';
      }).join('');
    }
  }

  if(s.botSettings){
    if($('navModeBadge')) $('navModeBadge').textContent = s.botSettings.public ? 'عام' : 'خاص';
    const actId = document.activeElement ? document.activeElement.id : '';
    if(!['bsPublic','bsGconly','bsAutoread','bsAnticall'].includes(actId)){
      if($('bsPublic')) $('bsPublic').checked = !!s.botSettings.public;
      if($('bsGconly')) $('bsGconly').checked = !!s.botSettings.gconly;
      if($('bsAutoread')) $('bsAutoread').checked = !!s.botSettings.autoread;
      if($('bsAnticall')) $('bsAnticall').checked = !!s.botSettings.anticall;
    }
  }

  const mb=$('maintBanner'); if(mb) mb.className = s.maintenance ? 'maint-banner' : 'maint-banner hidden';
  if($('maintState')) $('maintState').textContent = s.maintenance ? 'مفعّل' : 'متوقف';

  try{ renderInstall(s); }catch(e){}

  const subs = s.subBots || [];
  if($('subCountMeta')) $('subCountMeta').textContent = subs.length + ' مسجل';
  if($('navSubCount')) $('navSubCount').textContent = subs.length;
  const tb = $('subBotsTable');
  if(tb){
    tb.innerHTML = subs.length ? subs.map(sb =>
      '<tr>'
      + '<td class="ltr mono">+'+esc(sb.phone)+'</td>'
      + '<td>'+esc(sb.customName || sb.waName || '-')+'</td>'
      + '<td class="mono ltr">'+esc(sb.prefix || '.')+'</td>'
      + '<td class="mono">'+esc(sb.pairStatus)+'</td>'
      + '<td>'+(sb.paused ? 'متوقف مؤقتاً' : (sb.mode === 'self' ? 'خاص' : 'عام'))+'</td>'
      + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button type="button" class="btn sm" onclick="act(\\'sub-toggle-pause\\',{phone:\\''+esc(sb.phone)+'\\'})">'+(sb.paused ? 'تفعيل' : 'إيقاف مؤقت')+'</button>'
      + '<button type="button" class="btn sm" onclick="act(\\'sub-stop\\',{phone:\\''+esc(sb.phone)+'\\'})">فصل</button>'
      + '<button type="button" class="btn sm danger" onclick="act(\\'sub-reset\\',{phone:\\''+esc(sb.phone)+'\\'})">حذف الجلسة</button>'
      + '</div></td></tr>'
    ).join('') : '<tr><td colspan="6" class="muted">لا توجد بوتات فرعية مسجلة</td></tr>';
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
<style>${PANEL_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card" style="text-align:center">
    <div class="wordmark-icon" style="width:44px;height:44px;font-size:18px;margin:0 auto 16px">M</div>
    <h1 class="login-title">الموقع تحت الصيانة</h1>
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
