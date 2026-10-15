// ==========================================
// 🦖 NINJA DINO — NIXEL (Interactive AI Rich Response)
// الأمر: .dino  /  .ديناصور
// يعمل داخل واتساب عبر GenAIaeacdsnwHtmlPrimitive
// تحكم باللمس فقط: انقر = قفز | اضغط أسفل الكانفس أو زر ⬇️ = انحناء
// ==========================================

export let handler = async (m, { conn }) => {

const html = `
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body{background:transparent;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#eef2ff;direction:rtl}
.wrap{width:100%;max-width:620px;margin:auto;padding:14px}
.card{background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.15);border-radius:18px;overflow:hidden;box-shadow:0 10px 34px rgba(0,0,0,.45)}
.head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.12)}
.brand .sub{font-size:10px;letter-spacing:2px;color:#00d1a0;font-weight:800}
.brand .h1{font-size:19px;font-weight:900;color:#fff;margin-top:2px}
.stats{text-align:left;direction:ltr}
#score{font-size:20px;font-weight:900;color:#fff;text-shadow:0 0 12px rgba(108,92,231,.9);transition:transform .15s}
#best{font-size:10px;color:rgba(255,255,255,.45);margin-top:3px}
.stage{position:relative;padding:12px}
canvas{width:100%;height:auto;display:block;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);touch-action:none}
.ov{position:absolute;inset:12px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;text-align:center;padding:16px;background:radial-gradient(circle at 50% 35%,rgba(16,20,40,.62),rgba(8,10,24,.94));backdrop-filter:blur(3px)}
.ov.hide{display:none}
.ovt{font-size:23px;font-weight:900;color:#fff;text-shadow:0 4px 14px rgba(0,0,0,.6)}
.ovp{font-size:12.5px;line-height:1.9;opacity:.9}
.row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.chip{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#e8ecff;border-radius:999px;
  padding:7px 14px;font-size:12.5px;font-weight:700}
.chip.on{background:linear-gradient(180deg,#00d1a0,#00a884);border-color:transparent;color:#06231b}
.skin{width:40px;height:40px;border-radius:12px;border:2px solid rgba(255,255,255,.25);position:relative}
.skin.on{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.25)}
.skin.locked{filter:grayscale(.7) brightness(.7)}
.skin .cost{position:absolute;bottom:-8px;left:0;right:0;font-size:9px;color:#ffd54a;font-weight:900;text-align:center}
.wallet{font-size:12px;color:#ffd54a;font-weight:800}
.cta{border:0;border-radius:14px;padding:13px 38px;font-size:17px;font-weight:900;color:#0b1020;
  background:linear-gradient(180deg,#ffe07a,#f6b93b);box-shadow:0 6px 0 #b9821f,0 12px 22px rgba(0,0,0,.35)}
.cta:active{transform:translateY(3px);box-shadow:0 3px 0 #b9821f}
.ctrl{display:flex;gap:10px;padding:12px 14px;border-top:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.14)}
.btn{flex:1;border:0;border-radius:14px;padding:15px 0;font-size:16px;font-weight:900;color:#0e1830;
  background:rgba(255,255,255,.88);box-shadow:0 4px 0 rgba(0,0,0,.22)}
.btn:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.22)}
.btn.pause{flex:0 0 58px;background:rgba(255,255,255,.7)}
.toasts{position:absolute;top:20px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.toast{background:rgba(10,14,30,.85);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;
  padding:7px 16px;font-size:12.5px;font-weight:800;backdrop-filter:blur(4px);animation:pop .3s}
@keyframes pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
</style>
<div class="wrap"><div class="card">
  <div class="head">
    <div class="brand"><div class="sub">NIXEL BOT</div><div class="h1">🦖 نينجا دينو</div></div>
    <div class="stats"><div id="score">00000</div><div id="best">الأفضل 00000</div></div>
  </div>
  <div class="stage">
    <canvas id="cv" width="560" height="300"></canvas>
    <div class="toasts" id="toasts"></div>
    <div class="ov" id="ov">
      <div class="ovt" id="ovt">🦖 نينجا دينو</div>
      <div class="ovp" id="ovp">انقر لقفزة • انقر مرتين لقفزة مزدوجة 🕹️<br>انقر أسفل الكانفس أو زر ⬇️ للانحناء تحت الطيور 🦅<br>اجمع 💰 وافتح أشكالاً جديدة من المتجر</div>
      <div class="row" id="diffrow"></div>
      <div class="row" id="skinrow"></div>
      <div class="wallet" id="wallet">💰 0</div>
      <button class="cta" id="start" type="button">ابدأ اللعب ▶</button>
    </div>
  </div>
  <div class="ctrl">
    <button class="btn" id="bjump" type="button">⬆️ قفز</button>
    <button class="btn" id="bduck" type="button">⬇️ انحناء</button>
    <button class="btn pause" id="bpause" type="button">⏸</button>
  </div>
</div></div>
<script>
var cv=document.getElementById('cv'),x=cv.getContext('2d');
var CW=560,CH=300,GY=250;
var scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');
var ov=document.getElementById('ov'),ovt=document.getElementById('ovt'),ovp=document.getElementById('ovp');
var walletEl=document.getElementById('wallet'),toasts=document.getElementById('toasts');
var S={run:false,over:false,paused:false,started:false,count:0,score:0,level:0,
  lives:2,maxLives:2,combo:0,comboT:0,speed:5,shake:0,flash:0,scroll:0,runT:0,
  accSpawn:0,nextSpawn:0,accCoin:0,nextCoin:0,inv:0,nextAch:0,best:0,
  pu:{shield:0,magnet:0,x2:0,slow:0,star:0}};
var D={x:64,y:GY,vy:0,onGround:true,duck:false,jumps:0,squash:1};
var obs=[],coins=[],pups=[],parts=[],floats=[],drops=[],clouds=[],amb=[];
var last=0;

/* ---------- palettes ---------- */
var THEMES=[
 {sky1:[143,211,255],sky2:[233,247,255],gnd:[217,196,138],h1:[150,205,160],h2:[118,178,128],night:0,star:0,rain:0,name:'الصحراء'},
 {sky1:[255,138,90],sky2:[255,214,150],gnd:[200,150,110],h1:[172,120,110],h2:[112,80,92],night:.25,star:0,rain:0,name:'الغروب'},
 {sky1:[11,16,38],sky2:[27,36,80],gnd:[42,46,74],h1:[36,46,78],h2:[26,33,60],night:1,star:1,rain:0,name:'الليل'},
 {sky1:[198,224,255],sky2:[255,255,255],gnd:[236,241,251],h1:[220,230,246],h2:[198,214,236],night:.15,star:0,rain:0,name:'الثلج'},
 {sky1:[42,47,85],sky2:[92,108,178],gnd:[72,74,92],h1:[62,66,92],h2:[46,50,72],night:.8,star:1,rain:1,name:'المدينة'}
];
var SKINS=[
 {name:'أخضر',a:[63,165,100],b:[38,118,72],cost:0},
 {name:'أزرق',a:[74,134,214],b:[40,80,152],cost:150},
 {name:'أحمر',a:[224,84,84],b:[152,42,42],cost:300},
 {name:'ذهبي',a:[232,192,64],b:[182,132,22],cost:600},
 {name:'نينجا',a:[120,126,158],b:[40,45,72],cost:1000}
];
var PUP={shield:{c:'#5ec8f0',e:'🛡',n:'درع'},magnet:{c:'#e0556b',e:'🧲',n:'مغناطيس'},
  x2:{c:'#f0c04a',e:'2x',n:'نقاط مضاعفة'},slow:{c:'#8a7bf0',e:'⏱',n:'إبطاء'},star:{c:'#ffd34a',e:'★',n:'نجمة'}};
var DUR={shield:10,magnet:9,x2:9,slow:6,star:6};
var ACH=[300,700,1500,3000,6000];
var LEVEL_STEP=500;

/* ---------- store ---------- */
var store={best:0,coins:0,skin:0,diff:'normal',owned:[0]};
function loadStore(){
  var v=null;
  try{v=localStorage.getItem('nixdino');}catch(e){}
  if(!v){try{v=sessionStorage.getItem('nixdino');}catch(e){}}
  if(!v){try{var mm=document.cookie.match(/(?:^|;\\s*)nixdino=([^;]+)/);if(mm)v=decodeURIComponent(mm[1]);}catch(e){}}
  if(v){try{store=JSON.parse(v);}catch(e){}}
  if(!store.owned)store.owned=[0];
  if(store.owned.indexOf(0)<0)store.owned.push(0);
  if(!store.diff)store.diff='normal';
  if(typeof store.coins!=='number')store.coins=0;
  if(typeof store.best!=='number')store.best=0;
}
function saveStore(){
  var v=JSON.stringify(store);
  try{localStorage.setItem('nixdino',v);}catch(e){}
  try{sessionStorage.setItem('nixdino',v);}catch(e){}
  try{document.cookie='nixdino='+encodeURIComponent(v)+';max-age=31536000;path=/';}catch(e){}
}

/* ---------- audio ---------- */
var ac=null;
function initAudio(){try{if(!ac)ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
function beep(f,dur,type,vol,slide){
  if(!ac)return;try{
    var o=ac.createOscillator(),g=ac.createGain();
    o.type=type||'square';o.frequency.value=f;
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(1,slide),ac.currentTime+dur);
    g.gain.value=vol||.05;g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);
    o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+dur);
  }catch(e){}
}
function seq(list,type,vol){list.forEach(function(f,i){setTimeout(function(){beep(f,.13,type||'triangle',vol||.06);},i*75);});}
function sJump(){beep(430,.12,'square',.05,760);}
function sCoin(){beep(900,.07,'sine',.05);setTimeout(function(){beep(1350,.09,'sine',.05);},55);}
function sPower(){seq([523,659,784,1047]);}
function sHit(){beep(170,.28,'sawtooth',.08,60);}
function sLevel(){seq([523,659,784,1047,1319]);}
function sOver(){[420,320,230,150].forEach(function(f,i){setTimeout(function(){beep(f,.26,'sawtooth',.07);},i*140);});}
function vibe(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}

/* ---------- helpers ---------- */
function rgb(a){return 'rgb('+a[0]+','+a[1]+','+a[2]+')';}
function mixA(a,b,t){return [Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)];}
function mixTh(a,b,t){return {sky1:mixA(a.sky1,b.sky1,t),sky2:mixA(a.sky2,b.sky2,t),gnd:mixA(a.gnd,b.gnd,t),
  h1:mixA(a.h1,b.h1,t),h2:mixA(a.h2,b.h2,t),night:a.night+(b.night-a.night)*t,
  star:a.star+(b.star-a.star)*t,rain:a.rain+(b.rain-a.rain)*t,name:a.name};}
function getTheme(){var lv=Math.floor(S.score/LEVEL_STEP),p=(S.score-lv*LEVEL_STEP)/LEVEL_STEP;
  p=p*p*(3-2*p);return mixTh(THEMES[lv%THEMES.length],THEMES[(lv+1)%THEMES.length],p);}
function rr(xx,yy,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(xx+r,yy);
  x.arcTo(xx+w,yy,xx+w,yy+h,r);x.arcTo(xx+w,yy+h,xx,yy+h,r);x.arcTo(xx,yy+h,xx,yy,r);x.arcTo(xx,yy,xx+w,yy,r);x.closePath();}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function toast(msg){var d=document.createElement('div');d.className='toast';d.textContent=msg;
  toasts.appendChild(d);setTimeout(function(){d.style.opacity='0';d.style.transition='opacity .4s';},1400);
  setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d);},1900);}
function cmul(){return 1+Math.floor(S.combo/5);}
function baseSpeed(){return DIFF[store.diff].speed;}

/* ---------- difficulty ---------- */
var DIFF={easy:{lives:3,spawn:1.35,speed:4.6,name:'سهل'},
          normal:{lives:2,spawn:1,speed:5,name:'عادي'},
          hard:{lives:1,spawn:.8,speed:5.6,name:'صعب'}};

/* ---------- reset / lifecycle ---------- */
function updateWallet(){walletEl.textContent='💰 '+store.coins;}
function buildUI(){
  var dr=document.getElementById('diffrow');dr.innerHTML='';
  ['easy','normal','hard'].forEach(function(k){
    var b=document.createElement('button');b.className='chip'+(store.diff===k?' on':'');
    b.textContent=DIFF[k].name;b.type='button';
    b.onclick=function(){store.diff=k;saveStore();buildUI();};
    dr.appendChild(b);
  });
  var sr=document.getElementById('skinrow');sr.innerHTML='';
  SKINS.forEach(function(sk,i){
    var owned=store.owned.indexOf(i)>=0;
    var b=document.createElement('button');
    b.className='skin'+(store.skin===i?' on':'')+(owned?'':' locked');
    b.style.background='linear-gradient(160deg,'+rgb(sk.a)+','+rgb(sk.b)+')';
    b.type='button';
    if(!owned){var t=document.createElement('span');t.className='cost';t.textContent=sk.cost;b.appendChild(t);}
    b.onclick=function(){pickSkin(i);};
    sr.appendChild(b);
  });
  updateWallet();
}
function pickSkin(i){
  var sk=SKINS[i];
  if(store.owned.indexOf(i)>=0){store.skin=i;saveStore();buildUI();return;}
  if(store.coins>=sk.cost){store.coins-=sk.cost;store.owned.push(i);store.skin=i;saveStore();sPower();toast('فتحت شكل: '+sk.name);buildUI();}
  else{toast('محتاج '+sk.cost+' عملة 💰');}
}

function reset(){
  S.score=0;S.level=0;S.combo=0;S.comboT=0;S.speed=baseSpeed();S.shake=0;S.flash=0;S.scroll=0;S.runT=0;
  S.over=false;S.paused=false;S.inv=1;S.nextAch=0;S.milestone=0;
  S.maxLives=DIFF[store.diff].lives;S.lives=S.maxLives;
  S.pu={shield:0,magnet:0,x2:0,slow:0,star:0};
  D.x=64;D.y=GY;D.vy=0;D.onGround=true;D.duck=false;D.jumps=0;D.squash=1;
  obs=[];coins=[];pups=[];parts=[];floats=[];drops=[];
  S.accSpawn=0;S.nextSpawn=dsp(70);
  S.accCoin=0;S.nextCoin=dsp(140);
  clouds=[];for(var i=0;i<5;i++)clouds.push({x:80+i*120,y:26+Math.random()*70,w:40+Math.random()*40,s:.15+Math.random()*.25});
  amb=[];for(var j=0;j<16;j++)amb.push({x:Math.random()*CW,y:Math.random()*GY,r:.5+Math.random()*1.4,vx:.1+Math.random()*.3,ph:Math.random()*10});
  bestEl.textContent='الأفضل '+String(Math.floor(store.best)).padStart(5,'0');
  updateScore();
  ov.classList.add('hide');
}
function dsp(mult){return mult*DIFF[store.diff].spawn;}
function updateScore(){
  var v=Math.floor(S.score);
  scoreEl.textContent=String(v).padStart(5,'0');
}

function startGame(){
  initAudio();reset();
  S.count=3.2;S.run=true;S.paused=false;
  if(!S.started){S.started=true;last=0;requestAnimationFrame(loop);}
  ov.classList.add('hide');
}

/* ---------- spawning ---------- */
function addCactus(){
  var h=22+Math.random()*26;
  obs.push({t:'cactus',x:CW+20,y:GY-h,w:15+Math.random()*6,h:h,g:true});
  if(Math.random()<.22)obs.push({t:'cactus',x:CW+56+Math.random()*10,y:GY-(16+Math.random()*16),w:15,h:16+Math.random()*18,g:true});
}
function addBird(){
  obs.push({t:'bird',x:CW+20,y:GY-(58+Math.random()*18),w:38,h:22,g:false,ph:Math.random()*6});
}
function addCoins(){
  var n=3+Math.floor(Math.random()*3),by=GY-(70+Math.random()*46);
  for(var i=0;i<n;i++)coins.push({x:CW+30+i*32,y:by+Math.sin(i*.9)*12,r:9,t:Math.random()*6});
}
function addPup(){
  var keys=['shield','magnet','x2','slow','star'];
  var k=keys[Math.floor(Math.random()*keys.length)];
  pups.push({x:CW+24,y:GY-(80+Math.random()*60),type:k,t:Math.random()*6});
}
function spawnStuff(dt){
  S.accSpawn+=dt;
  if(S.accSpawn>=S.nextSpawn){
    S.accSpawn=0;S.nextSpawn=Math.max(34,66-S.speed*2.4)+Math.random()*28;
    if(S.score>350&&Math.random()<.3)addBird();else addCactus();
  }
  S.accCoin+=dt;
  if(S.accCoin>=S.nextCoin){S.accCoin=0;S.nextCoin=150+Math.random()*140;
    if(Math.random()<.8)addCoins();else addPup();}
}

/* ---------- powerups ---------- */
function applyPup(k){
  S.pu[k]=DUR[k];sPower();vibe(35);
  toast(PUP[k].e+' '+PUP[k].n+'!');
  for(var i=0;i<10;i++)parts.push({x:D.x+15,y:D.y-20,vx:(Math.random()-.5)*3,vy:-Math.random()*3,life:1,col:PUP[k].c,size:2+Math.random()*2});
}
function loseLife(){
  S.lives--;sHit();vibe(220);S.shake=16;S.flash=1;
  for(var i=0;i<16;i++)parts.push({x:D.x+15,y:D.y-20,vx:(Math.random()-.5)*6,vy:-Math.random()*5,life:1,col:'255,90,90',size:2+Math.random()*3});
  if(S.lives<=0){gameOver();}else{S.inv=1.6;obs=obs.filter(function(o){return o.x>D.x+120||o.x+o.w<D.x-20;});toast('❤️ تبقّى '+S.lives);}
}
function hurt(o){
  if(S.inv>0||S.pu.star>0)return;
  if(S.pu.shield>0){S.pu.shield=0;S.inv=1.2;S.shake=10;vibe(60);toast('🛡 انكسر الدرع');burst(D.x+15,D.y-20,12,'94,200,240',4);return;}
  loseLife();
}
function burst(px,py,n,col,spd){for(var i=0;i<n;i++)parts.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd,life:1,col:col,size:2+Math.random()*2});}
function addFloat(txt,col,fy){floats.push({x:D.x+16,y:fy||(D.y-46),txt:txt,life:1,col:col||'#ffd54a'});}

/* ---------- update ---------- */
function update(dt){
  var rdt=dt;
  for(var k in S.pu){if(S.pu[k]>0){S.pu[k]-=rdt/60;if(S.pu[k]<0)S.pu[k]=0;}}
  if(S.inv>0)S.inv-=rdt/60;
  if(S.comboT>0){S.comboT-=rdt/60;if(S.comboT<=0)S.combo=0;}
  var wdt=dt*(S.pu.slow>0?.55:1);

  S.runT+=dt;
  S.speed=Math.min(12,baseSpeed()+S.score*.006);
  var gain=(0.9+S.speed*.05)*(S.pu.x2>0?2:1)*cmul()*wdt;
  S.score+=gain;S.scroll+=S.speed*wdt;

  var lv=Math.floor(S.score/LEVEL_STEP);
  if(lv>S.level){S.level=lv;onLevelUp();}
  while(S.nextAch<ACH.length&&S.score>=ACH[S.nextAch]){
    toast('🏆 إنجاز: '+ACH[S.nextAch]+' نقطة! (+20 💰)');
    seq([880,1174]);store.coins+=20;saveStore();updateWallet();S.nextAch++;
  }

  /* jump physics */
  if(!D.onGround){D.y+=D.vy*wdt;D.vy+=.72*wdt;
    if(D.y>=GY){if(D.jumps>0)burst(D.x+15,GY,8,'255,255,255',3.4);D.y=GY;D.vy=0;D.onGround=true;D.jumps=0;D.squash=1.35;}}
  D.squash+=(1-D.squash)*.18*wdt;
  if(D.onGround&&!D.duck&&Math.random()<.3)burst(D.x+4,GY-1,1,'255,255,255',1.4);

  spawnStuff(wdt);
  updateObstacles(wdt);
  updateCoins(wdt);
  updatePups(wdt);
  updateParts(wdt);
  updateDrops(rdt);
  updateFloats(rdt);
  clouds.forEach(function(c){c.x-=c.s*wdt;if(c.x<-80){c.x=CW+Math.random()*100;c.y=26+Math.random()*70;}});
  amb.forEach(function(p){p.x-=p.vx*wdt;if(p.x<-4)p.x=CW+4;});

  if(S.shake>0)S.shake=Math.max(0,S.shake-.6*wdt);
  if(S.flash>0)S.flash=Math.max(0,S.flash-.05*wdt);
  if(S.score>(S.best))S.best=S.score;
  if(Math.floor(S.score/500)>S.milestone){S.milestone=Math.floor(S.score/500);scoreEl.style.transform='scale(1.3)';setTimeout(function(){scoreEl.style.transform='scale(1)';},150);}
  updateScore();
  bestEl.textContent='الأفضل '+String(Math.floor(S.best)).padStart(5,'0');
}
function onLevelUp(){
  var th=THEMES[S.level%THEMES.length];
  toast('🏁 المستوى '+S.level+' — '+th.name);
  seq([660,880,1047]);vibe([20,40,20]);
  if(S.lives<S.maxLives){S.lives++;toast('💖 حياة إضافية!');}
}
function updateObstacles(wdt){
  for(var i=obs.length-1;i>=0;i--){
    var o=obs[i];o.x-=S.speed*wdt*(o.t==='bird'?1.08:1);
    if(o.t==='bird')o.ph+=wdt*10;
    if(o.x+o.w<-40){obs.splice(i,1);continue;}
    var bx=D.x+4,by=D.y-(D.duck?22:40),bw=(D.duck?46:30)-8,bh=(D.duck?22:40)-6;
    if(bx<o.x+o.w-3&&bx+bw>o.x+3&&by<o.y+o.h-3&&by+bh>o.y+3){hurt(o);if(S.over)return;
      obs.splice(i,1);
    }
  }
}
function updateCoins(wdt){
  var dcx=D.x+15, dcy=D.y-(D.duck?11:20), bh=(D.duck?22:40)/2+9;
  for(var i=coins.length-1;i>=0;i--){
    var c=coins[i];c.t+=wdt*8;
    if(S.pu.magnet>0){c.x+=(dcx-c.x)*Math.min(1,.14*wdt);c.y+=(dcy-c.y)*Math.min(1,.14*wdt);}
    else{c.x-=S.speed*wdt;}
    if(c.x<-24){coins.splice(i,1);continue;}
    if(Math.abs(dcx-c.x)<c.r+15&&Math.abs(dcy-c.y)<c.r+bh){
      coins.splice(i,1);S.combo++;S.comboT=1.6;
      var val=10*(S.pu.x2>0?2:1)*cmul();
      S.score+=val;store.coins+=1;saveStore();updateWallet();sCoin();
      addFloat('+'+val,'#ffd54a',D.y-46);
      burst(c.x,c.y,6,'255,213,74',3);
    }
  }
}
function updatePups(wdt){
  for(var i=pups.length-1;i>=0;i--){
    var p=pups[i];p.x-=S.speed*wdt*.85;p.t+=wdt*6;
    if(p.x<-30){pups.splice(i,1);continue;}
    if(Math.abs((D.x+15)-p.x)<24&&Math.abs((D.y-(D.duck?11:20))-p.y)<30){applyPup(p.type);pups.splice(i,1);}
  }
}
function updateParts(wdt){
  for(var i=parts.length-1;i>=0;i--){var p=parts[i];p.x+=p.vx*wdt;p.y+=p.vy*wdt;p.vy+=.3*wdt;p.life-=.03*wdt;
    if(p.life<=0)parts.splice(i,1);}
}
function updateFloats(dt){
  for(var i=floats.length-1;i>=0;i--){var f=floats[i];f.y-=.7*dt;f.life-=.02*dt;if(f.life<=0)floats.splice(i,1);}
}
function updateDrops(dt){
  var th=getTheme();
  if(th.rain>.5){
    if(drops.length<70&&Math.random()<.6)drops.push({x:Math.random()*CW,y:-10,len:8+Math.random()*10,v:6+Math.random()*5});
  }
  for(var i=drops.length-1;i>=0;i--){var d=drops[i];d.y+=d.v*dt;if(d.y>GY){drops.splice(i,1);}}
}

/* ---------- input ---------- */
function jump(){
  if(S.over){startGame();return;}
  if(!S.run||S.paused)return;
  if(D.onGround){D.vy=-12.6;D.onGround=false;D.jumps=1;D.duck=false;D.squash=.7;sJump();burst(D.x+15,D.y,8,'255,255,255',3.4);vibe(12);}
  else if(D.jumps<2){D.vy=-10.5;D.jumps=2;D.squash=.8;sJump();burst(D.x+15,D.y-14,10,'150,200,255',4);vibe(12);}
}
function duckStart(){if(S.run&&!S.paused&&D.onGround){D.duck=true;}else if(S.run&&!S.paused&&!D.onGround){D.vy=Math.min(D.vy,-10);} }
function duckEnd(){D.duck=false;}
function togglePause(){if(!S.run)return;S.paused=!S.paused;document.getElementById('bpause').textContent=S.paused?'▶':'⏸';}

/* ---------- draw ---------- */
function drawSky(th){
  var g=x.createLinearGradient(0,0,0,GY);g.addColorStop(0,rgb(th.sky1));g.addColorStop(1,rgb(th.sky2));
  x.fillStyle=g;x.fillRect(0,0,CW,GY+2);
  if(th.star>.02){x.globalAlpha=th.star;for(var i=0;i<26;i++){x.fillStyle='#fff';
    x.fillRect((i*97.13)%CW,(i*53.7)%(GY*.6),1.6,1.6);}x.globalAlpha=1;}
  var cxp=CW*.8,cyp=46;
  if(th.night>.5){x.fillStyle='#eef2ff';x.beginPath();x.arc(cxp,cyp,16,0,7);x.fill();
    x.fillStyle=rgb(th.sky1);x.beginPath();x.arc(cxp+7,cyp-5,14,0,7);x.fill();}
  else{x.fillStyle='#ffd45e';x.beginPath();x.arc(cxp,cyp,15,0,7);x.fill();}
}
function drawHills(th){
  x.fillStyle=rgb(th.h2);x.beginPath();x.moveTo(0,GY+2);
  for(var i=0;i<=CW+30;i+=26){var y=GY-40-Math.sin((i+S.scroll*.3)*.02)*16-Math.sin((i+S.scroll*.3)*.05)*7;x.lineTo(i,y);}
  x.lineTo(CW,GY+2);x.closePath();x.fill();
  x.fillStyle=rgb(th.h1);x.beginPath();x.moveTo(0,GY+2);
  for(var j=0;j<=CW+30;j+=26){var y2=GY-18-Math.sin((j+S.scroll*.6)*.03)*10;x.lineTo(j,y2);}
  x.lineTo(CW,GY+2);x.closePath();x.fill();
}
function drawClouds(th){
  x.fillStyle=th.night>.5?'rgba(210,218,255,.45)':'rgba(255,255,255,.85)';
  clouds.forEach(function(c){var b=Math.sin(S.runT*.03+c.x)*2;
    x.fillRect(c.x,c.y+b,c.w,5);x.fillRect(c.x+10,c.y+b-5,c.w*.45,10);});
}
function drawGround(th){
  x.fillStyle=rgb(th.gnd);x.fillRect(0,GY,CW,CH-GY);
  x.strokeStyle=th.night>.5?'rgba(255,255,255,.35)':'#7a5c2e';x.lineWidth=2;
  x.setLineDash([12,9]);x.lineDashOffset=-S.scroll*.8;x.beginPath();x.moveTo(0,GY);x.lineTo(CW,GY);x.stroke();x.setLineDash([]);
}
function drawRain(){x.strokeStyle='rgba(180,210,255,.5)';x.lineWidth=1.4;
  drops.forEach(function(d){x.beginPath();x.moveTo(d.x,d.y);x.lineTo(d.x-2,d.y+d.len);x.stroke();});}

function drawDino(){
  var sk=SKINS[store.skin||0],a=rgb(sk.a),b=rgb(sk.b);
  x.save();var cx=D.x+15,cy=D.y;x.translate(cx,cy);x.scale(1/D.squash,D.squash);x.translate(-cx,-cy);
  var g=x.createLinearGradient(0,D.y-40,0,D.y);g.addColorStop(0,a);g.addColorStop(1,b);x.fillStyle=g;
  if(S.inv>0&&Math.floor(S.runT*.4)%2===0)x.globalAlpha=.35;
  if(D.duck){
    rr(D.x,D.y-22,46,22,8);x.fill();rr(D.x+30,D.y-24,20,16,7);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(D.x+43,D.y-16,3,0,7);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(D.x+44,D.y-16,1.5,0,7);x.fill();
  }else{
    var leg=D.onGround?Math.sin(S.runT*.9)*5:0;
    // tail
    x.beginPath();x.moveTo(D.x+2,D.y-26);x.lineTo(D.x-12,D.y-32);x.lineTo(D.x+2,D.y-16);x.closePath();x.fill();
    rr(D.x,D.y-38,26,26,8);x.fill();        // body
    rr(D.x+20,D.y-50,22,20,7);x.fill();     // head
    rr(D.x+38,D.y-42,11,8,4);x.fill();      // snout
    x.fillStyle='#fff';x.beginPath();x.arc(D.x+35,D.y-43,3.4,0,7);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(D.x+36,D.y-43,1.7,0,7);x.fill();
    x.fillStyle=b;
    x.fillRect(D.x+3,D.y-14,6,14+leg);      // legs
    x.fillRect(D.x+17,D.y-14,6,14-leg);
  }
  if(S.pu.shield>0){x.strokeStyle='rgba(94,200,240,.9)';x.lineWidth=2.4;x.beginPath();
    x.arc(D.x+16,D.y-20,30,0,7);x.stroke();}
  if(S.pu.star>0){x.fillStyle='rgba(255,211,74,.35)';x.beginPath();x.arc(D.x+16,D.y-20,32,0,7);x.fill();}
  x.restore();
}
function drawObs(){
  obs.forEach(function(o){
    if(o.t==='bird'){
      var wing=Math.sin(o.ph)*o.h*.6;x.strokeStyle='#20243a';x.lineWidth=4;x.lineCap='round';
      x.beginPath();x.moveTo(o.x+4,o.y+o.h*.5);x.quadraticCurveTo(o.x+o.w*.5,o.y+o.h*.5-wing,o.x+o.w-3,o.y+o.h*.4);x.stroke();
      x.fillStyle='#2b3042';x.beginPath();x.arc(o.x+o.w-4,o.y+o.h*.4,o.h*.32,0,7);x.fill();
      x.fillStyle='#ffb300';x.beginPath();x.moveTo(o.x+o.w,o.y+o.h*.32);x.lineTo(o.x+o.w+9,o.y+o.h*.44);x.lineTo(o.x+o.w,o.y+o.h*.52);x.closePath();x.fill();
    }else{
      x.save();x.shadowColor='rgba(255,90,90,.35)';x.shadowBlur=10;x.fillStyle='#2e8b57';
      rr(o.x,o.y,o.w,o.h,Math.min(6,o.w*.3));x.fill();
      rr(o.x-6,o.y+o.h*.3,6,o.h*.3,3);x.fill();rr(o.x-6,o.y+o.h*.3,5,o.h*.5,3);x.fill();
      rr(o.x+o.w,o.y+o.h*.45,6,o.h*.3,3);x.fill();rr(o.x+o.w+1,o.y+o.h*.2,5,o.h*.5,3);x.fill();
      x.restore();
    }
  });
}
function drawCoins(){
  coins.forEach(function(c){var sq=Math.abs(Math.cos(c.t))*.75+.25;
    x.save();x.translate(c.x,c.y);
    x.fillStyle='#f7b500';x.beginPath();x.ellipse(0,0,c.r*sq,c.r,0,0,7);x.fill();
    x.fillStyle='#ffe27a';x.beginPath();x.ellipse(0,0,c.r*sq*.6,c.r*.6,0,0,7);x.fill();
    x.fillStyle='#c98a00';x.font='bold '+(c.r*1.1)+'px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('$',0,c.r*.06);
    x.restore();});
}
function drawPups(){
  pups.forEach(function(p){var m=PUP[p.type],bob=Math.sin(p.t)*4;
    x.save();x.translate(p.x,p.y+bob);
    x.shadowColor=m.c;x.shadowBlur=14;x.fillStyle=m.c;x.beginPath();x.arc(0,0,14,0,7);x.fill();x.shadowBlur=0;
    x.fillStyle='#0b1020';x.font='bold 15px Arial';x.textAlign='center';x.textBaseline='middle';
    x.fillText(m.e==='2x'?'2x':m.e,0,1);x.restore();});
}
function drawParts(){parts.forEach(function(p){x.globalAlpha=Math.max(0,p.life);x.fillStyle='rgba('+p.col+',1)';x.fillRect(p.x,p.y,p.size,p.size);});x.globalAlpha=1;}
function drawFloats(){floats.forEach(function(f){x.globalAlpha=Math.max(0,f.life);x.fillStyle=f.col;x.font='bold 15px Arial';x.textAlign='center';x.fillText(f.txt,f.x,f.y);});x.globalAlpha=1;}
function drawCanvasHUD(){
  // hearts
  x.textAlign='left';x.textBaseline='middle';x.font='15px Arial';
  var s='';for(var i=0;i<S.maxLives;i++)s+=(i<S.lives?'❤️':'🖤');
  x.fillText(s,12,18);
  // powerup chips
  var px=12,py=38;x.font='bold 12px Arial';
  for(var k in S.pu){if(S.pu[k]>0){
    var m=PUP[k];x.fillStyle='rgba(10,14,30,.7)';rr(px,py-11,58,22,11);x.fill();
    x.fillStyle=m.c;x.fillText((m.e==='2x'?'2x':m.e)+' '+Math.ceil(S.pu[k])+'s',px+7,py);px+=64;
  }}
}
function drawCountdown(){
  x.fillStyle='rgba(8,10,24,.55)';x.fillRect(0,0,CW,CH);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
  x.font='bold 90px Arial';var n=Math.ceil(S.count);
  x.fillText(n>0?String(n):'GO',CW/2,CH/2-6);
  x.font='bold 15px Arial';x.fillStyle='#00d1a0';x.fillText('استعد...',CW/2,CH/2+50);
}
function drawPaused(){
  x.fillStyle='rgba(8,10,24,.6)';x.fillRect(0,0,CW,CH);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
  x.font='bold 34px Arial';x.fillText('⏸ متوقف',CW/2,CH/2-8);
  x.font='14px Arial';x.fillStyle='#00d1a0';x.fillText('اضغط ▶ للمتابعة',CW/2,CH/2+32);
}
function draw(){
  var th=getTheme();
  x.clearRect(0,0,CW,CH);
  x.save();
  if(S.shake>0)x.translate((Math.random()-.5)*S.shake,(Math.random()-.5)*S.shake);
  drawSky(th);
  // ambient sparks
  amb.forEach(function(p){var a=.15+Math.sin(S.runT*.05+p.ph)*.1;x.fillStyle='rgba(180,160,255,'+a+')';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();});
  drawClouds(th);drawHills(th);drawGround(th);drawRain();
  drawCoins();drawPups();drawObs();drawDino();drawParts();drawFloats();
  if(S.flash>0){x.fillStyle='rgba(255,60,60,'+(S.flash*.35)+')';x.fillRect(0,0,CW,CH);}
  x.restore();
  drawCanvasHUD();
  x.textAlign='left';x.textBaseline='alphabetic';
  if(S.count>0)drawCountdown();
  else if(S.paused)drawPaused();
  else if(S.over){
    x.fillStyle='rgba(8,10,24,.7)';x.fillRect(0,0,CW,CH);
    x.fillStyle='#fff';x.textAlign='center';x.font='bold 26px Arial';x.fillText('انتهت اللعبة 💥',CW/2,CH/2-10);
    x.font='15px Arial';x.fillStyle='#00d1a0';x.fillText('نتيجتك: '+Math.floor(S.score)+' — المس للعب مجدداً 🔄',CW/2,CH/2+26);
    x.textAlign='left';
  }
}

/* ---------- loop ---------- */
function loop(t){
  if(!last)last=t;var dt=Math.min((t-last)/16.67,2.5);last=t;
  if(S.run&&!S.paused){
    if(S.count>0){var pv=Math.ceil(S.count);S.count-=dt/60;var nv=Math.ceil(S.count);
      if(nv!==pv&&nv>0)beep(680,.1,'sine',.05);if(S.count<=0)beep(1000,.16,'triangle',.07);}
    else update(dt);
  }
  draw();
  requestAnimationFrame(loop);
}
function gameOver(){
  S.over=true;S.run=false;sOver();vibe([40,80,40]);
  if(S.score>store.best){store.best=Math.floor(S.score);}
  saveStore();
  ov.classList.remove('hide');
  ovt.textContent='انتهت اللعبة 💥';
  ovp.innerHTML='نتيجتك: <b>'+Math.floor(S.score)+'</b> — أفضل نتيجة: <b>'+Math.floor(store.best)+'</b><br>💰 رصيدك: <b>'+store.coins+'</b>';
  document.getElementById('start').textContent='العب تاني 🔁';
  buildUI();
}

/* ---------- events ---------- */
cv.addEventListener('pointerdown',function(e){
  e.preventDefault();initAudio();
  if(S.over||!S.run)return;
  var r=cv.getBoundingClientRect();var rel=(e.clientY-r.top)/r.height;
  if(rel>.6)duckStart();else jump();
},{passive:false});
window.addEventListener('pointerup',function(){duckEnd();},{passive:true});
document.getElementById('bjump').addEventListener('pointerdown',function(e){e.preventDefault();initAudio();jump();},{passive:false});
document.getElementById('bduck').addEventListener('pointerdown',function(e){e.preventDefault();duckStart();},{passive:false});
document.getElementById('bduck').addEventListener('pointerup',function(){duckEnd();});
document.getElementById('bduck').addEventListener('pointerleave',function(){duckEnd();});
document.getElementById('bpause').addEventListener('click',function(e){e.preventDefault();togglePause();});
document.getElementById('start').addEventListener('click',function(e){e.preventDefault();initAudio();startGame();});
window.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();jump();}if(e.code==='ArrowDown'){e.preventDefault();duckStart();}});
window.addEventListener('keyup',function(e){if(e.code==='ArrowDown')duckEnd();});

/* ---------- boot ---------- */
loadStore();
S.best=store.best;
buildUI();reset();
requestAnimationFrame(loop);
</script>
`;

    const data = Buffer.from(JSON.stringify({
        "response_id": "nixel-ninja-dino",
        "sections": [{
            "view_model": {
                "primitive": {
                    "__typename": "GenAIaeacdsnwHtmlPrimitive",
                    "payload": html,
                    "trusted_sources": ["nixel.dev"]
                },
                "__typename": "GenAISingleLayoutViewModel"
            }
        }]
    })).toString('base64')

    await conn.relayMessage(m.chat, {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: "🦖 نينجا دينو — NIXEL" }],
                    unifiedResponse: { data },
                    contextInfo: { forwardingScore: 999, isForwarded: true, forwardOrigin: 4 }
                }
            }
        }
    }, {})

}

handler.help = ['dino', 'ديناصور']
handler.tags = ['games']
handler.command = /^(dino|dinogame|dinorunner|ديناصور)$/i

export default handler
