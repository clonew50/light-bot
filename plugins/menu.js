// ─── plugins/menu.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻
//  .اوامر1  → القائمة القديمة (رد بالأرقام)
//  .اوامر2  → قائمة أوامر بصيغة Rich HTML (Widget تفاعلي مثل xo2 / dino) + مؤثرات وأنيميشن
//
// مصدر الأوامر: bot.getAllCommands() (يُقرأ لحظياً) لذلك أي بلجن جديد يُضاف تلقائياً.

/* ======================= الإعدادات ======================= */
// الاسم + الإيموجي لكل فئة (المفتاح = قيمة handler.category)
const CAT_META = {
    downloads: ['التحميل', '📂'],
    group:     ['المجموعات', '🛡️'],
    sticker:   ['الملصقات', '🃏'],
    owner:     ['المطورين', '👑'],
    tools:     ['الأدوات', '⚙️'],
    search:    ['البحث', '🔍'],
    admin:     ['الأدمن', '⚔️'],
    games:     ['الألعاب', '🎮'],
    gif:       ['الجيف', '🖼️'],
    bank:      ['البنك', '💳'],
    ai:        ['الذكاء الاصطناعي', '🤖'],
    sub:       ['البوتات الفرعية', '⛓️'],
    subs:      ['الاشتراكات', '📡'],
    info:      ['معلومات البوت', '📜'],
    nicknames: ['الألقاب', '🏷️'],
    logos:     ['اللوجوهات', '🎨'],
    voices:    ['الأصوات', '🎙️'],
    islamic:   ['الإسلاميات', '🕌'],
    guild:     ['النقابات', '🏰'],
    other:     ['أخرى', '🔮']
};
const CAT_ORDER = Object.keys(CAT_META);
const metaOf = (key) => CAT_META[key] || [key, '📁'];

const usagesOf = (c) => (Array.isArray(c?.usage) ? c.usage : [c?.usage]).filter(Boolean);

// تجميع الأوامر حسب الفئة + ترتيبها حسب CAT_ORDER ثم الباقي
function collect(commands) {
    const byCat = new Map();
    for (const c of commands || []) {
        if (c?.hidden) continue;
        const usages = usagesOf(c);
        if (!usages.length) continue;
        const key = c.category || 'other';
        if (!byCat.has(key)) byCat.set(key, []);
        byCat.get(key).push(c);
    }
    const ordered = [];
    for (const k of CAT_ORDER) if (byCat.has(k)) ordered.push(k);
    for (const k of byCat.keys()) if (!ordered.includes(k)) ordered.push(k);
    return { byCat, ordered };
}

/* ===========================================================
   قالب الـ HTML (Rich Widget) — نفس بنية xo2
   لا يحتوي على backtick ولا ${} حتى لا يتعارض مع القالب
   =========================================================== */
const HTML_MENU = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Menu</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:#060609;color:#f1f1f4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;overflow-x:hidden}
.bg{position:fixed;inset:0;z-index:0;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(64px);opacity:.5;animation:float 15s ease-in-out infinite}
.orb.a{width:300px;height:300px;background:#e11d48;top:-90px;right:-70px}
.orb.b{width:250px;height:250px;background:#7c3aed;bottom:-80px;left:-70px;animation-delay:-5s}
.orb.c{width:210px;height:210px;background:#f43f5e;top:38%;left:48%;animation-delay:-9s}
@keyframes float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(26px,-30px) scale(1.18)}66%{transform:translate(-22px,18px) scale(.92)}}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(circle at 50% 28%,#000,transparent 82%);mask-image:radial-gradient(circle at 50% 28%,#000,transparent 82%)}
.wrap{position:relative;z-index:1;width:100%;max-width:480px;margin:0 auto;padding:16px 13px 30px}
.head{display:flex;align-items:center;gap:12px;padding:15px;border-radius:18px;background:rgba(20,20,26,.72);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);box-shadow:0 12px 42px rgba(225,29,72,.14);animation:drop .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes drop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
.blade{position:relative;width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:23px;background:linear-gradient(135deg,rgba(225,29,72,.28),rgba(124,58,237,.28));border:1px solid rgba(255,255,255,.12);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(225,29,72,.55)}50%{box-shadow:0 0 0 11px rgba(225,29,72,0)}}
.title{font-size:18px;font-weight:900;letter-spacing:.4px;background:linear-gradient(90deg,#fff,#ff8fa3,#fff);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 3s linear infinite}
@keyframes shine{to{background-position:200% center}}
.sub{font-size:12px;color:#9aa0ad;margin-top:3px}
.stats{display:flex;gap:10px;margin-top:12px}
.stat{position:relative;flex:1;padding:12px;border-radius:16px;background:rgba(20,20,26,.72);border:1px solid rgba(255,255,255,.07);text-align:center;overflow:hidden;animation:drop .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.08s}
.stat b{display:block;font-size:22px;font-weight:900;color:#ff3b5c;text-shadow:0 0 18px rgba(255,59,92,.55)}
.stat span{font-size:11px;color:#9aa0ad}
.search{width:100%;margin-top:12px;padding:13px 15px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(20,20,26,.72);color:#f1f1f4;font-size:14px;outline:none;transition:.25s;animation:drop .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.14s}
.search:focus{border-color:rgba(255,59,92,.7);box-shadow:0 0 0 4px rgba(255,59,92,.13);background:rgba(24,24,32,.92)}
.chips{display:flex;gap:8px;overflow-x:auto;padding:14px 2px 8px;-webkit-overflow-scrolling:touch}
.chips::-webkit-scrollbar{display:none}
.chip{flex:0 0 auto;padding:8px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#c3c7d0;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;transition:transform .18s,background .22s,box-shadow .22s,color .22s}
.chip:active{transform:scale(.92)}
.chip.on{background:linear-gradient(135deg,#ff2b4e,#c81e3c);border-color:transparent;color:#fff;box-shadow:0 6px 22px rgba(255,43,78,.42)}
.sec{margin-top:12px}
.sec-head{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:#ff8fa3;padding:8px 4px;animation:fade .4s ease both}
.sec-head:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(255,59,92,.55),transparent)}
.cmd{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;margin-bottom:8px;padding:12px 13px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(20,20,26,.66);color:#f1f1f4;cursor:pointer;text-align:right;overflow:hidden;transition:transform .16s,box-shadow .22s,border-color .22s;animation:rise .45s ease both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.cmd:before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:3px;background:linear-gradient(#ff2b4e,#7c3aed);opacity:.85}
.cmd:active{transform:scale(.98)}
@media(hover:hover){.cmd:hover{border-color:rgba(255,59,92,.45);box-shadow:0 10px 28px rgba(255,43,78,.2);transform:translateY(-2px)}}
.code{font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13.5px;direction:ltr;text-align:left;color:#d7fbe8;word-break:break-word;padding-inline-start:6px}
.cp{flex:0 0 auto;font-size:15px;opacity:.6;transition:transform .2s,opacity .2s}
.cmd.copied .cp{opacity:1;transform:scale(1.25)}
.ripple{position:absolute;border-radius:50%;transform:scale(0);background:rgba(255,59,92,.35);animation:rip .6s ease-out;pointer-events:none}
@keyframes rip{to{transform:scale(3);opacity:0}}
.empty{text-align:center;color:#9aa0ad;padding:34px 0;font-size:13px}
.foot{text-align:center;color:#5c6270;font-size:11px;margin-top:20px}
.toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,24px);z-index:9;padding:10px 18px;border-radius:24px;background:rgba(255,43,78,.96);color:#fff;font-size:13px;font-weight:700;box-shadow:0 12px 32px rgba(255,43,78,.45);opacity:0;pointer-events:none;transition:.32s cubic-bezier(.2,.8,.2,1)}
.toast.show{opacity:1;transform:translate(-50%,0)}
</style>
</head>
<body>
<div class="bg"><div class="grid"></div><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="wrap">
  <div class="head">
    <div class="blade">🩸</div>
    <div>
      <div class="title">𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻</div>
      <div class="sub">قائمة الأوامر • Rich Menu</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><b id="s-total">0</b><span>إجمالي الأوامر</span></div>
    <div class="stat"><b id="s-cats">0</b><span>الأقسام</span></div>
  </div>
  <input id="search" class="search" placeholder="🔍 ابحث عن أمر..." autocomplete="off">
  <div id="chips" class="chips"></div>
  <div id="list" class="list"></div>
  <div class="foot">اضغط على أي أمر لنسخه 📋</div>
</div>
<div id="toast" class="toast">تم النسخ ✅</div>
<script type="application/json" id="menu-data">/*__MENU_DATA__*/</script>
<script>
(function(){
  "use strict";
  var D = JSON.parse(document.getElementById("menu-data").textContent);
  var chips = document.getElementById("chips");
  var list  = document.getElementById("list");
  var search= document.getElementById("search");
  var toast = document.getElementById("toast");
  var active = "all";

  function countUp(el,to){
    var toN = to||0, start=null, dur=900;
    function step(t){
      if(!start) start=t;
      var p=Math.min((t-start)/dur,1);
      el.textContent=Math.floor(p*toN);
      if(p<1){ requestAnimationFrame(step); } else { el.textContent=toN; }
    }
    requestAnimationFrame(step);
  }
  countUp(document.getElementById("s-total"), D.total);
  countUp(document.getElementById("s-cats"), D.cats.length);

  function showToast(msg){
    toast.textContent=msg;
    toast.classList.add("show");
    window.setTimeout(function(){ toast.classList.remove("show"); },1200);
  }
  function copyText(t){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t); }
      else {
        var ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta);
        ta.select(); try{ document.execCommand("copy"); }catch(e){} document.body.removeChild(ta);
      }
    }catch(e){}
  }
  function ripple(ev,el){
    var r=document.createElement("span"); r.className="ripple";
    var rect=el.getBoundingClientRect();
    var size=Math.max(rect.width,rect.height);
    var x=(ev && ev.clientX ? ev.clientX-rect.left : rect.width/2);
    var y=(ev && ev.clientY ? ev.clientY-rect.top : rect.height/2);
    r.style.width=r.style.height=size+"px";
    r.style.left=(x-size/2)+"px"; r.style.top=(y-size/2)+"px";
    el.appendChild(r);
    window.setTimeout(function(){ if(r.parentNode) r.parentNode.removeChild(r); },600);
  }
  function chipEl(label,key){
    var b=document.createElement("button");
    b.className="chip"+(active===key?" on":"");
    b.textContent=label;
    b.addEventListener("click",function(){ active=key; draw(); });
    return b;
  }
  function draw(){
    chips.innerHTML="";
    chips.appendChild(chipEl("🗂️ الكل","all"));
    D.cats.forEach(function(c){ chips.appendChild(chipEl(c.emoji+" "+c.name,c.key)); });

    var q=(search.value||"").trim().toLowerCase();
    list.innerHTML="";
    var any=false, idx=0;

    D.cats.forEach(function(c){
      if(active!=="all" && active!==c.key) return;
      var items=c.cmds.filter(function(u){ return !q || u.toLowerCase().indexOf(q)!==-1; });
      if(!items.length) return;
      any=true;

      var sec=document.createElement("div"); sec.className="sec";
      var h=document.createElement("div"); h.className="sec-head";
      h.textContent=c.emoji+" "+c.name+" · "+items.length;
      sec.appendChild(h);

      items.forEach(function(u){
        var row=document.createElement("button"); row.className="cmd";
        row.style.animationDelay=(idx*0.03)+"s"; idx++;
        var code=document.createElement("span"); code.className="code"; code.textContent=D.prefix+u;
        var cp=document.createElement("span"); cp.className="cp"; cp.textContent="📋";
        row.appendChild(code); row.appendChild(cp);
        row.addEventListener("click",function(ev){
          ripple(ev,row);
          copyText(D.prefix+u);
          row.classList.add("copied"); cp.textContent="✅"; showToast("تم نسخ الأمر ✅");
          window.setTimeout(function(){ row.classList.remove("copied"); cp.textContent="📋"; },1000);
        });
        sec.appendChild(row);
      });
      list.appendChild(sec);
    });
    if(!any){
      var e=document.createElement("div"); e.className="empty"; e.textContent="لا توجد نتائج مطابقة 🔎";
      list.appendChild(e);
    }
  }
  search.addEventListener("input",draw);
  draw();
})();
</script>
</body>
</html>`;

/* ===========================================================
   .اوامر2  — إرسال الـ Rich HTML Widget
   =========================================================== */
const menuV2 = async (m, { conn, bot, command, usedPrefix, sock }) => {
    const client = sock || conn;
    const prefix = usedPrefix || '.';

    let commands = [];
    try { commands = (await bot.getAllCommands()) || []; } catch { commands = []; }
    const { byCat, ordered } = collect(commands);

    const cats = ordered.map((key) => {
        const [name, emoji] = metaOf(key);
        const cmds = byCat.get(key).flatMap((c) => usagesOf(c));
        return { key, name, emoji, cmds };
    });
    const total = cats.reduce((n, c) => n + c.cmds.length, 0);

    const dataJson = JSON.stringify({ prefix, total, cats }).replace(/</g, '\\u003c');
    const html = HTML_MENU.replace('/*__MENU_DATA__*/', function () { return dataJson; });

    const unifiedResponse = {
        response_id: 'light-menu-' + Date.now().toString(36),
        sections: [
            {
                __typename: 'GenAIUnifiedResponseSection',
                view_model: {
                    __typename: 'GenAISingleLayoutViewModel',
                    primitive: {
                        __typename: 'GenAIBotProgressStatusPrimitive',
                        title: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻:*إضغط هنا*',
                        is_in_progress: true
                    }
                }
            }
        ],
        embedded_screens: [
            {
                title: 'Preview',
                content: [
                    {
                        __typename: 'FOAIDNixelButtonSheets',
                        tabs: [
                            {
                                id: 'tab_0',
                                tab_header: 'Widget',
                                sections: [
                                    {
                                        __typename: 'GenAIUnifiedResponseSection',
                                        view_model: {
                                            __typename: 'GenAISingleLayoutViewModel',
                                            primitive: {
                                                __typename: 'GenAIaeacdsnwHtmlPrimitive',
                                                payload: html,
                                                url: 'https://example.com',
                                                trusted_sources: ['example.com']
                                            }
                                        }
                                    }
                                ],
                                step_entries: []
                            }
                        ]
                    }
                ]
            }
        ]
    };

    try {
        if (!client || typeof client.relayMessage !== 'function') throw new Error('relayMessage unavailable');

        const data = Buffer.from(JSON.stringify(unifiedResponse)).toString('base64');
        const options = {};
        if (typeof client.generateMessageTag === 'function') options.messageId = await client.generateMessageTag();

        await client.relayMessage(
            m.chat,
            {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                    botMetadata: {
                        messageDisclaimerText: '',
                        richResponseSourcesMetadata: {}
                    }
                },
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            unifiedResponse: { data },
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedAiBotMessageInfo: { botJid: '0@bot' },
                                forwardOrigin: 4
                            }
                        }
                    }
                }
            },
            options
        );
    } catch (error) {
        console.error('[اوامر2] rich response error:', error);
        const fallback = cats.map((c) => `${c.emoji} *${c.name}*\n` + c.cmds.map((u) => `┇ \`${prefix}${u}\``).join('\n')).join('\n\n');
        await m.reply(`${fallback}\n\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n> تعذّر عرض القائمة التفاعلية، حدّث meowsab وأعد التشغيل.`);
    }
};

menuV2.command = ['اوامر2'];
menuV2.usage = ['اوامر2'];
menuV2.category = 'info';
menuV2.usePrefix = true;

/* ===========================================================
   .اوامر1  — القائمة القديمة (كما هي، بدون تغيير)
   =========================================================== */
const MENU_TIMEOUT = 120000;

const CATEGORIES = [
    [1, 'التـحـمـيـل', 'downloads', '📂'],
    [2, 'الـمـجـمـوعـات', 'group', '🛡️'],
    [3, 'الـمـلـصـقـات', 'sticker', '🃏'],
    [4, 'الـمـطـوريـن', 'owner', '👑'],
    [5, 'امـثـلـه', 'example', '✳️'],
    [6, 'الـادوات', 'tools', '⚙️'],
    [7, 'الـبـحـث', 'search', '🔍'],
    [8, 'الادمــن', 'admin', '⚔️'],
    [9, 'الالــعـاب', 'games', '🎮'],
    [10, 'الچيف', 'gif', '🖼️'],
    [11, 'الـبــنـك', 'bank', '💳'],
    [12, 'الـذكـاء الاصـطـنـاعـي', 'ai', '🤖'],
    [13, 'الـبـوتـات الـفـرعـي', 'sub', '⛓️'],
    [14, 'مـعـلومـات الـبـوت', 'info', '📜'],
    [15, 'الـالــقــاب', 'nicknames', '🏷️'],
    [16, 'الـلـوجـوهــات', 'logos', '🎨'],
    [17, 'تـغـيـر الاصـوات', 'voices', '🎙️'],
    [18, 'أخــرى', 'other', '🔮']
];

const getCat = n => CATEGORIES.find(c => c[0] === n);

if (!global.menus) global.menus = {};

const clean = () => {
    const now = Date.now();
    Object.keys(global.menus).forEach(k => {
        if (now - global.menus[k].time > MENU_TIMEOUT) delete global.menus[k];
    });
};

const getImg = (bot) => {
    const { images } = bot.config.info;
    return Array.isArray(images) ? images[Math.floor(Math.random() * images.length)] : images;
};

const context = (jid, img) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    },
    externalAdReply: {
        title: "🩸┇𝐾𝐼𝑅𝐴┇📖",
        body: "أنا هو إله العالم الجديد.. العدالة المطلقة تبدأ من هنا.",
        thumbnailUrl: img,
        sourceUrl: '',
        mediaType: 1,
        renderLargerThumbnail: true
    }
});

const menuV1 = async (m, { conn, bot }) => {
    clean();

    const cmds = await bot.getAllCommands();
    const cats = {};

    cmds.forEach(c => {
        if (!c.usage?.length) return;
        const cat = c.category || 'other';
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push(c);
    });

    const txt = `
📖 *حـان وقـت تـطـهـيـر الـعـالـم..* ⚔️
🩸 *اكـتـب اسـمـك فـي مـفـكـرة الـمـوت!*

❐═━━━═╊⊰🩸⊱╉═━━━═❐
${CATEGORIES.map(c => `┇ 🩸 ${c[0]} *قـسـم ${c[1]} ${c[3]}*`).join('\n')}
❐═━━━═╊⊰🩸⊱╉═━━━═❐
> *اختر رقم القسم المراد فتحه من المفكرة بدون نقاط.*`;

    const msg = await conn.sendMessage(m.chat, {
        text: txt,
        contextInfo: context(m.sender, getImg(bot))
    }, { quoted: m });

    global.menus[msg.key.id] = { cats, chatId: m.chat, time: Date.now() };
};

menuV1.before = async (m, { conn, bot }) => {
    clean();

    const menuData = global.menus[m.quoted?.id];
    if (!menuData) return false;

    const cat = getCat(parseInt(m.text));
    if (!cat) {
        await conn.sendMessage(m.chat, { text: '❌ ┇ *اخـتـر رقـمـاً صـحـيـحـاً مـن الـمـفـكـرة فـقـط.*' }, { quoted: m });
        return true;
    }

    const cmds = menuData.cats[cat[2]];
    if (!cmds?.length) {
        await conn.sendMessage(m.chat, { text: '❌ ┇ *هـذا الـقـسـم لا يـحـتـوي عـلـى أوامـر حـالـيـاً.*' }, { quoted: m });
        return true;
    }

    await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: m.quoted.id, fromMe: true } });
    delete global.menus[m.quoted.id];

    const cmdsList = cmds.map(c => `┇ ${cat[3]}  /${c.usage.join(`\n┇ ${cat[3]}  /`)}`).join('\n');

    await conn.sendMessage(m.chat, {
        text: `
╭─┈──┈─⟞📖⟝─┈┈─┈─╮
┃ *قـسـم ${cat[1]} ${cat[3]}*
╰─┈──┈─⟞🩸⟝─┈──┈─╯

${cmdsList}

╭─┈─┈┈─⟞🩸⟝─┈┈─┈─╮
┃ *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*
╰─┈──┈─⟞📖⟝─┈┈─┈─╯
> *الـعـدالـة سـوف تـتـحـقـق مـهـمـا كـلـف الأمـر.*`.trim(),
        contextInfo: context(m.sender, getImg(bot))
    }, { quoted: m });

    return true;
};

menuV1.command = ['اوامر1'];

export default [menuV1, menuV2];
