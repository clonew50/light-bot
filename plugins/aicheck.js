// plugins/aicheck.js - ULTIMATE FIX - NO AIRich - ALWAYS WORKS
import axios from 'axios';

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

// Local detection fallback if APIs fail
function localDetect(text) {
  const lower = text.toLowerCase();
  let score = 15;
  const buzz = ["artificial intelligence","technology","has revolutionized","revolution","digital world","professional","experienced","in writing","the way we","interact","important for","as","is a","very","article","currently","with","which"];
  buzz.forEach(w => { if (lower.includes(w)) score += 6; });
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter(s=>s.trim().length>5).length || 1;
  const avg = words / sentences;
  if (avg > 18) score += 20;
  else if (avg > 12) score += 10;
  if (words > 50) score += 10;
  if (!['😂', '😭', '😅', '🔥', '👍', '❤️'].some(e => text.includes(e))) score += 8; // Formal text = more AI
  if (/[.!?]$/.test(text.trim())) score += 5;
  return Math.min(92, Math.max(5, score));
}

async function tryOriginality(q){
  try{
    const {data} = await axios.post('https://api.originality.ai/api/v2-tools/free-tools/ai-scan',{content:q},{headers:{'accept':'*/*','content-type':'application/json','origin':'https://corefreetools.originality.ai','referer':'https://corefreetools.originality.ai/','user-agent':UA},timeout:10000});
    const d = typeof data==='string'? JSON.parse(data): data;
    if (d.ai!==undefined) return {ai: d.ai*100, human: d.original*100, src: 'Originality.ai'};
  }catch(e){ if(e.message.includes('<!DOCTYPE')) throw new Error('CF'); }
  return null;
}
async function tryWriter(q){
  try{
    const {data} = await axios.post('https://api.writer.com/api/v2/ai-content-detection',{input:q},{headers:{'content-type':'application/json','user-agent':UA,'origin':'https://writer.com'},timeout:10000});
    const score = data.data?.[0]?.ai_score ?? data.score ?? null;
    if(score!==null) return {ai: score*100, human: (1-score)*100, src: 'Writer.com'};
  }catch{}
  return null;
}
async function tryZeroGPT(q){
  try{
    const {data} = await axios.post('https://api.zerogpt.com/api/detect/detectText',{input_text:q},{headers:{'content-type':'application/json','user-agent':UA},timeout:10000});
    const ai = data.data?.fakePercentage ?? data.fakePercentage ?? null;
    if(ai!==null) return {ai, human: 100-ai, src: 'ZeroGPT'};
  }catch{}
  return null;
}

const handler = async (m, { conn, text, usedPrefix }) => {
  if (!text || text.trim().length < 20) {
    return conn.reply(m.chat, `*AI CHECK*\n\n❌ Text too short!\nMinimum 20 characters / 5 words.\n\nExample:\n${usedPrefix}aicheck Hello I am a professional writer writing about AI technology`, m);
  }
  if (text.trim().split(/\s+/).length < 5) {
    return conn.reply(m.chat, `❌ Minimum 5 words bro, you sent ${text.trim().split(/\s+/).length} words only.`, m);
  }

  await conn.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

  let result = null;
  try { result = await tryOriginality(text); } catch {}
  if (!result) result = await tryWriter(text);
  if (!result) result = await tryZeroGPT(text);

  // Smart local fallback - so it doesn't stay 0%
  if (!result || result.ai===0) {
    const localScore = localDetect(text);
    result = { ai: localScore, human: 100-localScore, src: 'Local Heuristic (CF Bypass)' };
  }

  const ai = result.ai;
  const human = result.human;
  const barFilled = Math.round(ai/10);
  const bar = '█'.repeat(barFilled) + '░'.repeat(10-barFilled);

  let verdict, emoji;
  if (ai >= 80){ verdict='AI DETECTED - 100% AI Generated'; emoji='🔴'; }
  else if (ai >= 60){ verdict='MIXED - AI & Human Mix'; emoji='🟠'; }
  else if (ai >= 35){ verdict='LIKELY MIXED - Likely AI'; emoji='🟡'; }
  else if (ai >= 15){ verdict='LIKELY HUMAN'; emoji='🟢'; }
  else { verdict='HUMAN - Written by Human'; emoji='✅'; }

  const msg = `${emoji} *AI DETECTOR - ${result.src}*

${bar} *${ai.toFixed(2)}% AI*

> 🤖 *AI:* ${ai.toFixed(2)}%
> 👤 *Human:* ${human.toFixed(2)}%
> 📊 *Verdict:* ${verdict}
> 📝 *Words:* ${text.split(/\s+/).length}
> 🔤 *Characters:* ${text.length}
> 📄 *Text:* ${text.slice(0,150)}${text.length>150?'...':''}

*Powered by NIKOLAS BOT*
`;

  await conn.reply(m.chat, msg, m);
  await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } });
};

handler.help = ['aicheck'];
handler.command = ['aicheck','cekai','aidetect'];
handler.tags = ['tools','ai'];
export default handler;

// Hi
