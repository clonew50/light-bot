/**
 * panelStyles.js — Bespoke Arabic-first architectural dark UI styles
 * -------------------------------------------------------------------
 * Deliberate 60-30-10 neutral slate/emerald palette, Cairo + IBM Plex Sans Arabic
 * + IBM Plex Mono tabular numerals, compositor-only motion, zero pill-clutter.
 */
export const PANEL_CSS = `
  :root{
    --bg:#0b0e13;
    --bg-elevated:#10151d;
    --surface:#141a24;
    --surface-2:#1a2230;
    --line:#232b3a;
    --line-strong:#323d52;
    --txt:#eef2f7;
    --mut:#9aa6b8;
    --dim:#6c788e;
    --acc:#10b981;
    --acc-hover:#059669;
    --acc-soft:rgba(16,185,129,.14);
    --acc-border:rgba(16,185,129,.38);
    --acc-glow:rgba(16,185,129,.18);
    --gold:#d4a24c;
    --gold-soft:rgba(212,162,76,.13);
    --err:#e5484d;
    --err-soft:rgba(229,72,77,.13);
    --radius-lg:14px;
    --radius:9px;
    --radius-sm:6px;
    --ease:cubic-bezier(0.16, 1, 0.3, 1);
  }

  :root[data-theme="gold"]{
    --acc:#e0a94f;
    --acc-hover:#c89238;
    --acc-soft:rgba(224,169,79,.14);
    --acc-border:rgba(224,169,79,.4);
    --acc-glow:rgba(224,169,79,.18);
  }
  :root[data-theme="cyan"]{
    --acc:#22d3ee;
    --acc-hover:#06b6d4;
    --acc-soft:rgba(34,211,238,.13);
    --acc-border:rgba(34,211,238,.38);
    --acc-glow:rgba(34,211,238,.18);
  }
  :root[data-theme="violet"]{
    --acc:#a78bfa;
    --acc-hover:#8b5cf6;
    --acc-soft:rgba(167,139,250,.14);
    --acc-border:rgba(167,139,250,.38);
    --acc-glow:rgba(167,139,250,.18);
  }

  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  html,body{min-height:100%}
  body{
    font-family:'IBM Plex Sans Arabic',system-ui,-apple-system,sans-serif;
    background:var(--bg);
    color:var(--txt);
    font-size:14px;
    line-height:1.65;
    letter-spacing:0.005em;
    -webkit-font-smoothing:antialiased;
    font-feature-settings:"tnum" 1;
    font-variant-numeric:tabular-nums;
    overflow-x:hidden;
    position:relative;
  }

  #ambientCanvas{
    position:fixed;inset:0;width:100%;height:100%;
    pointer-events:none;z-index:0;opacity:.85;
  }
  .topbar,.container,.admin-shell,.login-wrap{position:relative;z-index:2}

  h1,h2,h3,.display-font{
    font-family:'Cairo','IBM Plex Sans Arabic',sans-serif;
    text-wrap:balance;
  }

  a{color:var(--acc);text-decoration:none;transition:color .16s var(--ease)}
  a:hover{color:#34d399}

  button,input,select,textarea{font-family:inherit}
  :focus-visible{
    outline:2px solid var(--acc);
    outline-offset:2px;
  }

  /* ---------- Entrance & Micro-Animations (Compositor-Only) ---------- */
  @keyframes fadeSlideUp{
    from{opacity:0;transform:translateY(10px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes tilePop{
    from{opacity:0;transform:translateY(6px) scale(.94)}
    to{opacity:1;transform:translateY(0) scale(1)}
  }
  @keyframes toastIn{
    from{opacity:0;transform:translateY(12px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes msgIn{
    from{opacity:0;transform:translateY(6px)}
    to{opacity:1;transform:translateY(0)}
  }

  .reveal{animation:fadeSlideUp .34s var(--ease) both}
  .reveal-d1{animation:fadeSlideUp .36s var(--ease) .05s both}
  .reveal-d2{animation:fadeSlideUp .38s var(--ease) .1s both}
  .reveal-d3{animation:fadeSlideUp .4s var(--ease) .15s both}

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{
      animation-duration:.01ms !important;
      animation-iteration-count:1 !important;
      transition-duration:.01ms !important;
      scroll-behavior:auto !important;
    }
    #ambientCanvas{display:none}
  }

  /* ---------- Topbar (Strict 3-Zone Contract) ---------- */
  .topbar{
    position:sticky;top:0;z-index:40;
    background:rgba(12,15,20,.9);
    backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
  }
  .topbar-inner{
    max-width:1280px;margin:0 auto;
    padding:12px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:32px;
  }
  .wordmark{
    font-family:'Cairo','IBM Plex Sans Arabic',sans-serif;
    font-size:19px;font-weight:700;color:var(--txt);
    letter-spacing:-0.01em;white-space:nowrap;flex-shrink:0;
    display:inline-flex;align-items:center;gap:10px;
  }
  .wordmark-icon{
    width:30px;height:30px;border-radius:7px;
    background:var(--acc-soft);border:1px solid var(--acc-border);
    color:var(--acc);display:grid;place-items:center;
    font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;
  }
  .topnav{
    display:flex;align-items:center;gap:24px;
  }
  .topnav a{
    color:var(--mut);font-size:13px;font-weight:500;
    white-space:nowrap;flex-shrink:0;padding:6px 0;
    position:relative;transition:color .15s var(--ease);
  }
  .topnav a::after{
    content:'';position:absolute;right:0;left:0;bottom:0;height:1.5px;
    background:var(--acc);transform:scaleX(0);transform-origin:center;
    transition:transform .18s var(--ease);
  }
  .topnav a:hover{color:var(--txt);text-decoration:none}
  .topnav a:hover::after{transform:scaleX(1)}
  .top-cta{flex-shrink:0}

  @media(max-width:760px){
    .topbar-inner{padding:10px 16px;gap:12px}
    .topnav{display:none}
  }

  /* ---------- Buttons & Interactive Controls ---------- */
  .btn, button.primary{
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    min-height:40px;padding:8px 18px;border-radius:var(--radius-sm);
    border:1px solid var(--line-strong);
    background:var(--surface-2);color:var(--txt);
    font-size:13px;font-weight:600;cursor:pointer;
    white-space:nowrap;flex-shrink:0;
    transition:transform .12s var(--ease),border-color .16s var(--ease),background-color .16s var(--ease),color .16s var(--ease);
  }
  .btn:hover{border-color:var(--mut);background:#202736}
  .btn:active, button.primary:active{transform:scale(.98)}
  .btn.primary, button.primary{
    background:var(--acc);border-color:var(--acc);color:#04150e;font-weight:700;
  }
  .btn.primary:hover, button.primary:hover{background:#22c58e;border-color:#22c58e;color:#04150e}
  .btn.danger{
    background:var(--err-soft);border-color:rgba(229,72,77,.4);color:#fca5a5;
  }
  .btn.danger:hover{background:var(--err);border-color:var(--err);color:#fff}
  .btn.ghost{background:transparent;border-color:var(--line)}
  .btn.ghost:hover{border-color:var(--line-strong);background:var(--surface)}
  .btn.sm{min-height:34px;padding:6px 12px;font-size:12px}
  .btn.copied{border-color:var(--acc-border);color:#6ee7b7;background:var(--acc-soft)}
  .btn.primary.copied{background:#22c58e;border-color:#22c58e;color:#04150e}
  .btn:disabled, button.primary:disabled{opacity:.45;cursor:not-allowed;transform:none}

  @media(max-width:600px){
    .btn, button.primary{min-height:44px}
    .btn.sm{min-height:38px}
  }

  /* ---------- Containers & Grids ---------- */
  .container{max-width:1280px;margin:0 auto;padding:28px 24px 56px}
  .section-gap{margin-top:28px}

  .hero-split{
    display:grid;grid-template-columns:1.25fr 0.95fr;gap:20px;align-items:stretch;
  }
  @media(max-width:980px){
    .hero-split{grid-template-columns:1fr}
  }

  .kpi-strip{
    display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px;
  }
  .kpi{
    background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
    padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;
    transition:border-color .18s var(--ease),transform .18s var(--ease);
  }
  .kpi:hover{border-color:var(--line-strong);transform:translateY(-1px)}
  .kpi-label{font-size:12px;color:var(--mut);font-weight:500}
  .kpi-val{
    font-size:22px;font-weight:700;color:var(--txt);
    font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace;
    font-variant-numeric:tabular-nums;
  }
  .kpi-val.ok{color:var(--acc)}
  .kpi-val.warn{color:var(--gold)}
  .kpi-val.err{color:var(--err)}
  .kpi-sub{font-size:12px;color:var(--dim)}

  @media(max-width:900px){
    .kpi-strip{grid-template-columns:repeat(2,1fr)}
  }
  @media(max-width:560px){
    .container{padding:16px 14px 40px}
    .kpi-strip{gap:10px}
    .kpi{padding:13px 14px}
    .kpi-val{font-size:19px}
  }

  .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
  .grid-12{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}
  .col-4{grid-column:span 4}
  .col-5{grid-column:span 5}
  .col-6{grid-column:span 6}
  .col-7{grid-column:span 7}
  .col-8{grid-column:span 8}
  .col-12{grid-column:span 12}
  @media(max-width:980px){
    .grid-2{grid-template-columns:1fr}
    .col-4,.col-5,.col-6,.col-7,.col-8{grid-column:span 12}
  }

  /* ---------- Surface Cards (Single-Elevation, Zero Nested Card Clutter) ---------- */
  .surface{
    background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);
    padding:22px;display:flex;flex-direction:column;
  }
  .surface-head{
    display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
    padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid var(--line);
  }
  .surface-title{font-size:17px;font-weight:700;color:var(--txt);line-height:1.35}
  .surface-sub{font-size:12.5px;color:var(--mut);margin-top:2px}
  .meta-line{font-size:12px;color:var(--mut);display:flex;align-items:center;gap:6px;white-space:nowrap}

  /* ---------- Segmented Tabs ---------- */
  .seg-bar{
    display:inline-flex;gap:4px;padding:4px;border-radius:var(--radius);
    background:var(--bg);border:1px solid var(--line);margin-bottom:18px;
    max-width:100%;overflow-x:auto;
  }
  .seg-btn{
    min-height:34px;padding:6px 14px;border-radius:5px;border:0;
    background:transparent;color:var(--mut);font-size:13px;font-weight:600;
    cursor:pointer;white-space:nowrap;flex-shrink:0;
    transition:background-color .16s var(--ease),color .16s var(--ease);
  }
  .seg-btn:hover{color:var(--txt)}
  .seg-btn.active{background:var(--surface-2);color:var(--txt);box-shadow:inset 0 0 0 1px var(--line-strong)}

  /* ---------- Forms ---------- */
  .field{margin-bottom:14px}
  .field label{display:block;font-size:12.5px;font-weight:600;color:var(--mut);margin-bottom:6px}
  .field input,.field select,.field textarea{
    width:100%;min-height:42px;padding:9px 12px;border-radius:var(--radius-sm);
    background:var(--bg);border:1px solid var(--line-strong);color:var(--txt);
    font-size:13.5px;transition:border-color .15s var(--ease),background-color .15s var(--ease);
  }
  .field textarea{min-height:84px;resize:vertical;line-height:1.6}
  .field input.mono,.field select.mono,.field textarea.mono{font-family:'IBM Plex Mono',monospace}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--acc);background:#0a0d12}
  .field input::placeholder,.field textarea::placeholder{color:var(--dim)}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:600px){.form-row{grid-template-columns:1fr}}

  /* ---------- Custom Switch Toggles (Accessible Native Checkbox) ---------- */
  .switch-row{
    display:flex;align-items:center;justify-content:space-between;gap:14px;
    padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer;
  }
  .switch-row:last-child{border-bottom:0}
  .switch-info{flex:1;min-width:0}
  .switch-title{font-size:13.5px;font-weight:600;color:var(--txt)}
  .switch-desc{font-size:12px;color:var(--mut);margin-top:2px}
  .switch-ctl{
    position:relative;width:44px;height:24px;flex-shrink:0;display:inline-block;
  }
  .switch-ctl input{
    opacity:0;width:44px;height:24px;margin:0;cursor:pointer;position:relative;z-index:2;
  }
  .switch-track{
    position:absolute;inset:0;border-radius:999px;
    background:var(--surface-2);border:1px solid var(--line-strong);
    transition:background-color .18s var(--ease),border-color .18s var(--ease);
  }
  .switch-track::after{
    content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
    background:var(--mut);transition:transform .18s var(--ease),background-color .18s var(--ease);
  }
  .switch-ctl input:checked + .switch-track{
    background:var(--acc-soft);border-color:var(--acc);
  }
  .switch-ctl input:checked + .switch-track::after{
    transform:translateX(20px);background:var(--acc);
  }
  .switch-ctl input:focus-visible + .switch-track{
    outline:2px solid var(--acc);outline-offset:2px;
  }

  /* ---------- 8-Digit Segmented Pairing Code Tiles ---------- */
  .pair-stage{
    padding:18px 0;margin:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  }
  .code-tiles{
    display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;
    direction:ltr;margin:14px 0;cursor:pointer;
  }
  .code-tile{
    width:40px;height:48px;border-radius:7px;
    background:var(--bg);border:1px solid var(--line-strong);
    display:grid;place-items:center;
    font-family:'IBM Plex Mono',monospace;font-size:21px;font-weight:700;color:var(--acc);
    animation:tilePop .24s var(--ease) both;
    transition:border-color .15s var(--ease),transform .15s var(--ease);
  }
  .code-tiles:hover .code-tile{border-color:var(--acc);transform:translateY(-1px)}
  .code-tiles.copied .code-tile{border-color:var(--acc);background:var(--acc-soft);color:#6ee7b7}
  .code-dash{
    font-family:'IBM Plex Mono',monospace;font-size:20px;color:var(--dim);padding:0 2px;
  }
  @media(max-width:440px){
    .code-tile{width:32px;height:40px;font-size:17px}
  }
  .qr-frame{
    display:flex;justify-content:center;padding:14px;background:#fff;border-radius:8px;
    margin:12px auto;width:fit-content;
  }
  .steps-ordered{
    margin-top:14px;padding-right:18px;font-size:12.5px;color:var(--mut);line-height:1.85;
  }

  /* ---------- Key-Value Rows & Data Tables ---------- */
  .kv-row{
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    padding:10px 0;border-bottom:1px solid var(--line);font-size:13px;
  }
  .kv-row:last-child{border-bottom:0}
  .kv-key{color:var(--mut)}
  .kv-val{font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace;font-size:12.5px;color:var(--txt)}
  .kv-val.ok{color:var(--acc)}
  .kv-val.warn{color:var(--gold)}
  .kv-val.err{color:var(--err)}

  .tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:10px 14px;text-align:right;border-bottom:1px solid var(--line);height:42px}
  th{background:var(--bg-elevated);color:var(--mut);font-size:12px;font-weight:600;white-space:nowrap}
  tbody tr{transition:background-color .12s var(--ease)}
  tbody tr:hover{background:rgba(255,255,255,.025)}
  tr:last-child td{border-bottom:0}

  /* ---------- Commands Explorer & Category Bars ---------- */
  .cmd-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .cmd-toolbar .search-wrap{flex:1;min-width:200px}
  .cat-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
  .cat-btn{
    min-height:32px;padding:5px 11px;border-radius:5px;border:1px solid var(--line);
    background:var(--bg);color:var(--mut);font-size:12px;font-weight:500;cursor:pointer;
    white-space:nowrap;transition:border-color .15s var(--ease),color .15s var(--ease),background-color .15s var(--ease);
  }
  .cat-btn:hover{border-color:var(--line-strong);color:var(--txt)}
  .cat-btn.active{background:var(--acc-soft);border-color:var(--acc-border);color:var(--acc);font-weight:600}

  .cmd-grid{
    display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;
    max-height:380px;overflow-y:auto;padding-left:4px;
  }
  .cmd-card{
    text-align:right;width:100%;padding:11px 13px;border-radius:var(--radius);
    background:var(--bg);border:1px solid var(--line);cursor:pointer;
    display:flex;flex-direction:column;gap:4px;
    transition:border-color .15s var(--ease),transform .15s var(--ease),background-color .15s var(--ease);
  }
  .cmd-card:hover{border-color:var(--acc-border);background:#10151d;transform:translateY(-1px)}
  .cmd-card.copied{border-color:var(--acc);background:var(--acc-soft)}
  .cmd-card.copied .cmd-meta{color:#6ee7b7;font-weight:600}
  .cmd-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}
  .cmd-code{
    font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;
    color:var(--acc);direction:ltr;
  }
  .cmd-meta{font-size:11.5px;color:var(--dim)}
  .cmd-desc{
    font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;
  }

  .bar-row{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}
  .bar-row:last-child{margin-bottom:0}
  .bar-head{display:flex;justify-content:space-between;font-size:12px}
  .bar-track{height:6px;border-radius:3px;background:var(--bg);overflow:hidden;border:1px solid var(--line)}
  .bar-fill{
    height:100%;background:var(--acc);border-radius:3px;
    transform-origin:right;transition:transform .3s var(--ease);
  }

  /* ---------- Logs ---------- */
  .log-box{
    height:260px;overflow:auto;background:var(--bg);border:1px solid var(--line);
    border-radius:var(--radius);padding:10px 14px;
    font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace;font-size:12px;line-height:1.65;
  }
  .log-line{
    padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);
    display:flex;gap:12px;align-items:baseline;
  }
  .log-line:last-child{border-bottom:0}
  .log-time{color:var(--dim);flex-shrink:0;direction:ltr}
  .log-msg{color:var(--txt);word-break:break-word}

  /* ---------- Banners & Toasts ---------- */
  .banner{padding:11px 14px;border-radius:var(--radius);font-size:13px;margin:10px 0;border:1px solid}
  .banner.err,.err-banner{background:var(--err-soft);border-color:rgba(229,72,77,.42);color:#fca5a5;padding:11px 14px;border-radius:var(--radius);font-size:13px}
  .banner.ok,.ok-banner{background:var(--acc-soft);border-color:var(--acc-border);color:#6ee7b7;padding:11px 14px;border-radius:var(--radius);font-size:13px}
  .banner.warn,.maint-banner{
    background:var(--gold-soft);border-color:rgba(212,162,76,.42);color:#fcd34d;
    padding:11px 14px;border-radius:var(--radius);font-size:13px;
    display:flex;align-items:center;gap:10px;margin-bottom:16px;
  }

  .toast-wrap{
    position:fixed;bottom:18px;left:18px;z-index:80;
    display:flex;flex-direction:column;gap:8px;max-width:340px;pointer-events:none;
  }
  .toast{
    pointer-events:auto;padding:11px 15px;border-radius:var(--radius);
    background:#18202c;border:1px solid var(--line-strong);color:var(--txt);
    font-size:13px;font-weight:500;box-shadow:0 10px 28px rgba(0,0,0,.45);
    animation:toastIn .2s var(--ease) both;
  }
  .toast.ok{border-color:var(--acc-border)}
  .toast.warn{border-color:rgba(212,162,76,.5)}
  .toast.err{border-color:rgba(229,72,77,.5)}
  .manual-copy-input{
    flex:1;min-width:0;min-height:34px;padding:5px 9px;border-radius:var(--radius-sm);
    background:var(--bg);border:1px solid var(--line-strong);color:var(--acc);font-size:12.5px;
  }

  /* ---------- Admin Workspace Sidebar Layout ---------- */
  .admin-shell{display:flex;min-height:100vh}
  .sidebar{
    width:250px;flex-shrink:0;background:var(--bg-elevated);
    border-left:1px solid var(--line);
    padding:20px 14px;display:flex;flex-direction:column;gap:20px;
    position:sticky;top:0;height:100vh;overflow-y:auto;
  }
  .side-nav{display:flex;flex-direction:column;gap:4px}
  .side-btn{
    width:100%;text-align:right;min-height:40px;padding:8px 12px;border-radius:var(--radius-sm);
    border:1px solid transparent;background:transparent;color:var(--mut);
    font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:space-between;
    transition:background-color .14s var(--ease),color .14s var(--ease),border-color .14s var(--ease);
  }
  .side-btn:hover{color:var(--txt);background:var(--surface)}
  .side-btn.active{background:var(--acc-soft);color:var(--acc);border-color:var(--acc-border)}
  .side-count{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--dim)}
  .side-btn.active .side-count{color:var(--acc)}

  .admin-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .admin-topbar{
    position:sticky;top:0;z-index:30;
    background:rgba(12,15,20,.9);backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);padding:12px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:16px;
  }
  .breadcrumb{font-size:13px;color:var(--mut);display:flex;align-items:center;gap:8px;white-space:nowrap}
  .breadcrumb b{color:var(--txt);font-weight:600}
  .admin-content{max-width:1200px;width:100%;margin:0 auto;padding:24px}

  .mobile-nav{
    display:none;gap:6px;overflow-x:auto;padding:10px 14px;
    border-bottom:1px solid var(--line);background:var(--bg-elevated);
  }
  @media(max-width:960px){
    .sidebar{display:none}
    .mobile-nav{display:flex}
    .admin-topbar{padding:10px 14px}
    .admin-content{padding:16px 14px}
  }

  /* ---------- Login & Maintenance ---------- */
  .login-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  .login-card{
    width:100%;max-width:420px;background:var(--surface);border:1px solid var(--line-strong);
    border-radius:var(--radius-lg);padding:28px;
    animation:fadeSlideUp .3s var(--ease) both;
  }
  .login-title{font-size:21px;font-weight:700;margin-bottom:4px}
  .login-sub{color:var(--mut);font-size:13px;margin-bottom:22px}

  .hidden{display:none !important}
  .mono{font-family:'IBM Plex Mono',monospace}
  .ltr{direction:ltr;text-align:left}
  .hint{color:var(--mut);font-size:12.5px;line-height:1.65}
  .muted{color:var(--mut);font-size:12px}

  /* ---------- Hero Visual Banner, Theme Switcher & 3D Tilt Spotlight ---------- */
  .hero-banner-shell{
    position:relative;overflow:hidden;border-radius:var(--radius-lg);
    border:1px solid var(--line);background:var(--surface);
    margin-bottom:22px;min-height:196px;
    display:grid;grid-template-columns:1.35fr 0.85fr;align-items:stretch;
  }
  .hero-banner-copy{
    padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;gap:16px;
    position:relative;z-index:2;
  }
  .hero-kicker{
    font-size:12px;color:var(--acc);font-weight:600;
    display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  }
  .hero-headline{
    font-size:clamp(1.45rem,2.5vw,2.1rem);font-weight:700;line-height:1.28;color:var(--txt);
    max-width:26ch;
  }
  .hero-desc{color:var(--mut);font-size:13.5px;max-width:58ch;line-height:1.7}
  .hero-actions-row{
    display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  }
  .theme-bar{
    display:inline-flex;align-items:center;gap:6px;padding:4px 6px;
    background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);
  }
  .theme-label{font-size:11.5px;color:var(--mut);padding:0 6px;white-space:nowrap}
  .theme-swatch{
    width:26px;height:26px;border-radius:5px;border:1px solid var(--line-strong);
    cursor:pointer;display:grid;place-items:center;background:var(--surface-2);
    transition:transform .16s var(--ease),border-color .16s var(--ease);
  }
  .theme-swatch:hover{transform:scale(1.08)}
  .theme-swatch.active{border-color:var(--txt);box-shadow:0 0 0 1px var(--txt)}
  .theme-dot{width:12px;height:12px;border-radius:3px;display:block}

  .hero-media-pane{
    position:relative;min-height:196px;overflow:hidden;border-right:1px solid var(--line);
    background:linear-gradient(135deg,#0d151c,#121c26);
  }
  .hero-banner-img{
    width:100%;height:100%;object-fit:cover;display:block;
    transition:transform .7s var(--ease);
  }
  .hero-banner-shell:hover .hero-banner-img{transform:scale(1.03)}
  .hero-banner-scrim{
    position:absolute;inset:0;
    background:linear-gradient(to left,rgba(11,14,19,.86) 0%,rgba(11,14,19,.28) 55%,rgba(11,14,19,.18) 100%);
    pointer-events:none;
  }
  .hero-avatar-lockup{
    position:absolute;bottom:14px;left:14px;z-index:2;
    display:flex;align-items:center;gap:10px;padding:8px 12px;
    background:rgba(11,14,19,.78);backdrop-filter:blur(8px);
    border:1px solid var(--line-strong);border-radius:var(--radius);
  }
  .hero-avatar-img{
    width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid var(--acc-border);
    flex-shrink:0;background:var(--surface);
  }
  @media(max-width:900px){
    .hero-banner-shell{grid-template-columns:1fr}
    .hero-media-pane{min-height:155px;border-right:0;border-top:1px solid var(--line)}
    .hero-banner-copy{padding:20px 18px}
  }

  /* ---------- Interactive 3D Tilt & Spotlight Showcase ---------- */
  .showcase-grid{
    display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px;
  }
  @media(max-width:1040px){.showcase-grid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:560px){.showcase-grid{grid-template-columns:1fr}}

  .tilt-card{
    position:relative;overflow:hidden;
    background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);
    padding:16px;display:flex;flex-direction:column;gap:12px;text-align:right;cursor:pointer;
    transform-style:preserve-3d;
    transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
    transition:transform .22s var(--ease),border-color .22s var(--ease);
  }
  .tilt-card::before{
    content:'';position:absolute;inset:0;pointer-events:none;opacity:0;
    background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%),var(--acc-glow),transparent 70%);
    transition:opacity .25s var(--ease);
  }
  .tilt-card:hover{border-color:var(--acc-border)}
  .tilt-card:hover::before{opacity:1}
  .showcase-thumb{
    height:108px;border-radius:var(--radius);overflow:hidden;
    border:1px solid var(--line);background:var(--bg);position:relative;
  }
  .showcase-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
  .tilt-card:hover .showcase-thumb img{transform:scale(1.05)}
  .showcase-kicker{font-size:11.5px;color:var(--acc);font-weight:600}
  .showcase-title{font-size:15px;font-weight:700;color:var(--txt)}
  .showcase-desc{font-size:12.5px;color:var(--mut);line-height:1.55}

  /* ---------- Smart Command Composer Studio (#cmd-composer) ---------- */
  .composer-grid{
    display:grid;grid-template-columns:1.15fr 0.85fr;gap:20px;align-items:stretch;
  }
  @media(max-width:940px){.composer-grid{grid-template-columns:1fr}}
  .composer-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
  .composer-chip{
    min-height:32px;padding:5px 11px;border-radius:5px;
    border:1px solid var(--line);background:var(--bg);color:var(--mut);
    font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;
    transition:border-color .15s var(--ease),background-color .15s var(--ease),color .15s var(--ease),transform .12s var(--ease);
  }
  .composer-chip:hover{border-color:var(--line-strong);color:var(--txt);transform:translateY(-1px)}
  .composer-chip.active{background:var(--acc-soft);border-color:var(--acc-border);color:var(--acc)}

  .composer-output-box{
    background:var(--bg);border:1px solid var(--line-strong);border-radius:var(--radius);
    padding:16px;display:flex;flex-direction:column;justify-content:space-between;gap:14px;height:100%;
  }
  .composer-code{
    font-family:'IBM Plex Mono','IBM Plex Sans Arabic',monospace;font-size:13.5px;line-height:1.7;
    color:var(--acc);background:var(--bg-elevated);border:1px solid var(--line);
    border-radius:var(--radius-sm);padding:12px 14px;word-break:break-word;min-height:68px;
    text-align:start;unicode-bidi:plaintext;
  }

  /* ---------- Bug Report Panel & Admin Inbox ---------- */
  .bug-split{
    display:grid;grid-template-columns:1.25fr 0.75fr;gap:20px;align-items:stretch;
  }
  @media(max-width:920px){.bug-split{grid-template-columns:1fr}}
  .bug-art-card{
    border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;
    background:var(--bg);display:flex;flex-direction:column;
  }
  .bug-art-media{height:175px;position:relative;overflow:hidden;background:var(--surface-2)}
  .bug-art-media img{width:100%;height:100%;object-fit:cover;display:block}
  .bug-art-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex:1}

  .bug-list{display:flex;flex-direction:column;gap:10px;max-height:380px;overflow-y:auto}
  .bug-item{
    border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;background:var(--bg);
    display:flex;flex-direction:column;gap:8px;
    transition:border-color .15s var(--ease);
  }
  .bug-item:hover{border-color:var(--line-strong)}
  .bug-item.resolved{opacity:.68}
  .bug-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .bug-item-meta{font-size:11.5px;color:var(--mut);display:flex;gap:8px;flex-wrap:wrap}
  .bug-item-text{font-size:13px;color:var(--txt);white-space:pre-wrap;word-break:break-word}
`;
