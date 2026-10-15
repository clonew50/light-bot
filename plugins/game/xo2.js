/*
⌁ 𝐍𝐎𝐗 ⌁
𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝙎𝙃𝙰𝙽𝙾𝚂
「 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 𝐛𝐲 𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝙎𝙃𝙰𝙽𝙾𝚂 」
「 لا تحذف الحقوق 🖤 」
https://github.com/SHANKS-CODE-1/CODE
*/

const handler = async (m, { conn, sock }) => {
  const client = sock || conn;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>X-O — SHANKS</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#111b21;color:#e9edef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.xo2-game{width:100%;max-width:380px;margin:0 auto;padding:18px 14px;direction:rtl;text-align:right}
.xo2-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #2a3942}
.xo2-title{font-size:19px;font-weight:700}
.xo2-by{font-size:11px;color:#8696a0}
.xo2-status{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;font-size:13px;color:#aebac1}
.xo2-turn{display:flex;align-items:center;gap:7px}
.xo2-dot{width:10px;height:10px;border-radius:50%;background:#e9edef;flex-shrink:0}
.xo2-dot.o{background:#00a884}
.xo2-score{display:flex;gap:9px;color:#8696a0;font-size:11px}
.xo2-score b{color:#e9edef;margin-right:3px}
/* الفواصل متحمولة في الاتجاهين: gap + حدود داخلية واضحة */
.xo2-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:2px;width:100%;aspect-ratio:1;padding:2px;background:#52636c;border:1px solid #667983;border-radius:10px;overflow:hidden}
.xo2-cell{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;padding:0;border:0!important;border-radius:0;background:#111b21;box-shadow:inset 0 0 0 1px #52636c;color:#e9edef;font:700 clamp(30px,12vw,54px)/1 Arial,sans-serif;cursor:pointer;opacity:1}
.xo2-cell:disabled{cursor:default}
.xo2-cell:focus-visible{outline:2px solid #00a884;outline-offset:-3px}
.xo2-cell[data-mark="X"]{color:#e9edef;text-shadow:0 0 12px rgba(233,237,239,.18)}
.xo2-cell[data-mark="O"]{color:#00a884;text-shadow:0 0 12px rgba(0,168,132,.3)}
.xo2-cell[data-mark="X"],.xo2-cell[data-mark="O"]{animation:xo2-pop .2s ease-out}
.xo2-cell.win{background:rgba(0,168,132,.16)}
.xo2-cell.win[data-mark="X"]{background:rgba(233,237,239,.08)}
@keyframes xo2-pop{from{transform:scale(.7);opacity:.45}to{transform:scale(1);opacity:1}}
.xo2-levels{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;color:#8696a0;font-size:12px}
.xo2-levels-buttons{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
.xo2-level{padding:7px 10px;border:1px solid #374248;border-radius:18px;background:transparent;color:#aebac1;font:12px inherit;cursor:pointer}
.xo2-level.active{border-color:#00a884;background:#00a884;color:#07130f;font-weight:700}
.xo2-level:focus-visible{outline:2px solid #00a884;outline-offset:1px}
.xo2-reset{display:block;margin:14px auto 0;padding:8px 20px;border:0;background:transparent;color:#00a884;font:600 13px inherit;cursor:pointer}
.xo2-reset:hover{color:#e9edef}
.xo2-modal{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.35)}
.xo2-modal.open{display:flex}
.xo2-modal-card{width:100%;max-width:300px;padding:22px 20px 0;border-radius:12px;background:#202c33;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.xo2-modal-title{margin:0 0 8px;font-size:20px;font-weight:700}
.xo2-modal-text{margin:0 0 18px;color:#aebac1;font-size:13px;line-height:1.6}
.xo2-modal-button{width:100%;padding:12px;border:0;border-top:1px solid #374248;background:transparent;color:#00a884;font:700 14px inherit;cursor:pointer}
@media(max-width:360px){.xo2-game{padding:14px 10px}.xo2-score{gap:5px}.xo2-level{padding:6px 8px;font-size:11px}}
</style>
</head>
<body>
<div class="xo2-game">
  <div class="xo2-head"><div class="xo2-title">لعبة X-O</div><div class="xo2-by">بواسطة SHANKS</div></div>
  <div class="xo2-status">
    <div class="xo2-turn"><span id="dot" class="xo2-dot"></span><span id="turn">دورك الآن</span></div>
    <div class="xo2-score"><span>أنت <b id="score-x">0</b></span><span>تعادل <b id="score-d">0</b></span><span>الآلي <b id="score-o">0</b></span></div>
  </div>
  <div id="board" class="xo2-board" role="grid" aria-label="رقعة X-O"></div>
  <div class="xo2-levels"><span>الصعوبة</span><div class="xo2-levels-buttons">
    <button class="xo2-level" data-level="0">سهل</button><button class="xo2-level" data-level="1">متوسط</button><button class="xo2-level active" data-level="2">صعب</button><button class="xo2-level" data-level="3">خبير</button>
  </div></div>
  <button id="reset" class="xo2-reset">إعادة اللعب</button>
</div>
<div id="modal" class="xo2-modal" role="dialog" aria-modal="true">
  <div class="xo2-modal-card"><h2 id="result" class="xo2-modal-title"></h2><p id="result-text" class="xo2-modal-text"></p><button id="again" class="xo2-modal-button">العب جولة أخرى</button></div>
</div>
<script>
(function(){
  "use strict";
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const state={board:Array(9).fill(null),turn:"X",level:2,over:false,thinking:false,winner:"",line:[],scores:{X:0,D:0,O:0}};
  const boardEl=document.getElementById("board"),turnEl=document.getElementById("turn"),dotEl=document.getElementById("dot"),modalEl=document.getElementById("modal"),resultEl=document.getElementById("result"),resultTextEl=document.getElementById("result-text");
  function build(){boardEl.innerHTML="";for(let i=0;i<9;i++){const c=document.createElement("button");c.type="button";c.className="xo2-cell";c.setAttribute("role","gridcell");c.setAttribute("aria-label","مربع "+(i+1));c.dataset.index=String(i);c.addEventListener("click",function(){humanMove(Number(c.dataset.index))});boardEl.appendChild(c)}}
  function empties(b){const a=[];for(let i=0;i<9;i++)if(b[i]===null)a.push(i);return a}
  function outcome(b){for(const line of lines){const a=b[line[0]];if(a&&a===b[line[1]]&&a===b[line[2]])return{winner:a,line:line}}if(b.every(Boolean))return{winner:"D",line:[]};return null}
  function render(){for(let i=0;i<9;i++){const c=boardEl.children[i],v=state.board[i];c.textContent=v||"";c.dataset.mark=v||"";c.disabled=!!v||state.over||state.thinking||state.turn!=="X";c.classList.toggle("win",state.line.indexOf(i)!==-1)}if(state.over){turnEl.textContent=state.winner==="X"?"لقد فزت!":state.winner==="O"?"فاز الذكاء الاصطناعي":"تعادل";dotEl.className="xo2-dot"+(state.winner==="O"?" o":"")}else if(state.thinking){turnEl.textContent="الذكاء الاصطناعي يفكر…";dotEl.className="xo2-dot o"}else{turnEl.textContent=state.turn==="X"?"دورك الآن":"دور الذكاء الاصطناعي";dotEl.className="xo2-dot"+(state.turn==="O"?" o":"")}document.getElementById("score-x").textContent=state.scores.X;document.getElementById("score-d").textContent=state.scores.D;document.getElementById("score-o").textContent=state.scores.O}
  function immediate(b,mark){for(const line of lines){const values=line.map(i=>b[i]),empty=values.indexOf(null);if(empty!==-1&&values.filter(v=>v===mark).length===2)return line[empty]}return null}
  function minimax(b,aiTurn,depth){const r=outcome(b);if(r)return r.winner==="O"?10-depth:r.winner==="X"?depth-10:0;if(depth===0)return 0;const moves=empties(b);let best=aiTurn?-Infinity:Infinity;for(const m of moves){b[m]=aiTurn?"O":"X";const value=minimax(b,!aiTurn,depth-1);b[m]=null;best=aiTurn?Math.max(best,value):Math.min(best,value)}return best}
  function aiMove(){const moves=empties(state.board);if(!moves.length)return null;if(state.level===0)return moves[Math.floor(Math.random()*moves.length)];if(state.level===1){const win=immediate(state.board,"O");if(win!==null)return win;if(Math.random()<.8){const block=immediate(state.board,"X");if(block!==null)return block}if(state.board[4]===null)return 4;return moves[Math.floor(Math.random()*moves.length)]}const depth=state.level===2?Math.min(moves.length,5):moves.length;let bestScore=-Infinity,bestMoves=[];for(const move of moves){const b=state.board.slice();b[move]="O";const score=minimax(b,false,depth-1);if(score>bestScore){bestScore=score;bestMoves=[move]}else if(score===bestScore)bestMoves.push(move)}return bestMoves[Math.floor(Math.random()*bestMoves.length)]}
  function finish(r){state.over=true;state.thinking=false;state.winner=r.winner;state.line=r.line||[];state.scores[r.winner]++;if(r.winner==="X"){resultEl.textContent="🎉 لقد فزت!";resultTextEl.textContent="أداء ممتاز. هل تريد جولة أخرى؟"}else if(r.winner==="O"){resultEl.textContent="🤖 فاز الذكاء الاصطناعي";resultTextEl.textContent="حاول مجددًا وتحدَّه من جديد."}else{resultEl.textContent="🤝 تعادل!";resultTextEl.textContent="لا يوجد خاسر في هذه الجولة."}render();setTimeout(function(){if(state.over)modalEl.classList.add("open")},220)}
  function humanMove(i){if(state.over||state.thinking||state.turn!=="X"||state.board[i]!==null)return;state.board[i]="X";const hr=outcome(state.board);if(hr){finish(hr);return}state.turn="O";state.thinking=true;render();setTimeout(function(){if(!state.thinking)return;const move=aiMove();if(move===null){state.thinking=false;finish({winner:"D",line:[]});return}state.board[move]="O";state.thinking=false;const ar=outcome(state.board);if(ar)finish(ar);else{state.turn="X";render()}},380)}
  function resetGame(){state.board=Array(9).fill(null);state.turn="X";state.over=false;state.thinking=false;state.winner="";state.line=[];modalEl.classList.remove("open");render()}
  document.querySelectorAll(".xo2-level").forEach(function(button){button.addEventListener("click",function(){document.querySelectorAll(".xo2-level").forEach(function(x){x.classList.remove("active")});button.classList.add("active");state.level=Number(button.dataset.level);resetGame()})});
  document.getElementById("reset").addEventListener("click",resetGame);document.getElementById("again").addEventListener("click",resetGame);modalEl.addEventListener("click",function(e){if(e.target===modalEl)resetGame()});build();render();
})();
</script>
</body>
</html>`;

  try {
    if (!client || typeof client.relayMessage !== "function") {
      throw new Error("relayMessage is not available");
    }

    // بنية Meta Rich Response الكاملة: Progress + Widget HTML مضمّن.
    const unifiedResponse = {
      response_id: "PopiooNixelPopiooNixelPopiooNixel",
      sections: [
        {
          __typename: "GenAIUnifiedResponseSection",
          view_model: {
            __typename: "GenAISingleLayoutViewModel",
            primitive: {
              __typename: "GenAIBotProgressStatusPrimitive",
              title: "𝙎𝙃𝘼𝙉𝙾𝙎:*إضغط هنا*",
              is_in_progress: true
            }
          }
        }
      ],
      embedded_screens: [
        {
          title: "Preview",
          content: [
            {
              __typename: "FOAIDNixelButtonSheets",
              tabs: [
                {
                  id: "tab_0",
                  tab_header: "Widget",
                  sections: [
                    {
                      __typename: "GenAIUnifiedResponseSection",
                      view_model: {
                        __typename: "GenAISingleLayoutViewModel",
                        primitive: {
                          __typename: "GenAIaeacdsnwHtmlPrimitive",
                          payload: html,
                          url: "https://example.com",
                          trusted_sources: ["example.com"]
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

    const data = Buffer.from(JSON.stringify(unifiedResponse)).toString("base64");
    const options = {};
    if (typeof client.generateMessageTag === "function") {
      options.messageId = await client.generateMessageTag();
    }

    await client.relayMessage(
      m.chat,
      {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          botMetadata: {
            messageDisclaimerText: "",
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
                forwardedAiBotMessageInfo: { botJid: "0@bot" },
                forwardOrigin: 4
              }
            }
          }
        }
      },
      options
    );
  } catch (error) {
    console.error("[xo2] Meta rich response error:", error);
    await m.reply("❌ تعذر فتح لعبة X-O التفاعلية. تأكد من تحديث meowsab ثم أعد تشغيل البوت.");
  }
};

handler.command = ["xo2", "xoai", "تحدي_اكس"];
handler.usage = ["xo2"];
handler.category = "games";
handler.usePrefix = true;

export default handler;
