// Credits: Rem Bot - Developer 212674375708
import fetch from 'node-fetch';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

let sharp;
try { sharp = (await import('sharp')).default; } catch { sharp = null; }

const AUDIO_PTT = false;
global.lastMenuAudio = global.lastMenuAudio || null;

function getRandomNotSame(arr, last) {
    let f = arr.filter(v => v!== last);
    if (f.length === 0) f = arr;
    return f[Math.floor(Math.random() * f.length)];
}
async function downloadBuffer(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('fail');
    return Buffer.from(await r.arrayBuffer());
}
async function toOpus(buf) {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    const i = path.join(os.tmpdir(), `in_${id}`);
    const o = path.join(os.tmpdir(), `out_${id}.ogg`);
    fs.writeFileSync(i, buf);
    try {
        await new Promise((res, rej) => {
            const ff = spawn('ffmpeg', ['-y','-i',i,'-vn','-af','volume=0.7,alimiter=limit=0.9','-c:a','libopus','-b:a','64k','-vbr','on','-ar','48000','-ac','1',o]);
            let e=''; ff.stderr.on('data',d=>e+=d);
            ff.on('error',rej);
            ff.on('close',c=>c===0?res():rej(new Error(e.slice(-300))));
        });
        return fs.readFileSync(o);
    } finally {
        fs.rmSync(i,{force:true}); fs.rmSync(o,{force:true});
    }
}

async function get300Thumb(url) {
    try {
        let r = await fetch(url);
        let b = Buffer.from(await r.arrayBuffer());
        if (sharp) {
            try {
                // Here is your solution - 300x300 only
                b = await sharp(b).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
            } catch {}
        }
        return b;
    } catch { return null; }
}

let handler = async (m, { conn, usedPrefix }) => {
  let tags = {}; let total=0;
  for (let p of Object.values(global.plugins||{})) {
    if (!p || p.disabled || !p.tags || !p.help) continue;
    for (let t of p.tags) {
      if (!tags[t]) tags[t]=[];
      let h = Array.isArray(p.help)?p.help:[p.help];
      tags[t].push(...h);
    }
  }
  let footer="";
  for (let c in tags) {
    footer+=`┌─ ${c.toUpperCase()}\n`;
    for (let cmd of [...new Set(tags[c])].sort()) {
      footer+=`│ • ${usedPrefix}${cmd}\n`; total++;
    }
    footer+=`└────\n\n`;
  }
  if (!footer) footer=`┌─ MAIN\n│ • ${usedPrefix}menu\n│ • ${usedPrefix}allmenu\n│ • ${usedPrefix}boos\n└────`;

  let ppUrl = null;
  try { ppUrl = await conn.profilePictureUrl(m.sender, 'image'); } catch {
    try { ppUrl = await conn.profilePictureUrl(m.sender); } catch {}
  }
  if (!ppUrl) ppUrl = 'https://files.catbox.moe/96cm7n.jpeg';

  let thumb = await get300Thumb(ppUrl);
  if (!thumb) thumb = Buffer.alloc(0);

  // Resize them to 300 so they work
  const verifiedMenu = {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
    message: { contactMessage: {
        displayName: `Rem Bot • ${m.pushName||'User'}`,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;Rem Bot;;;\nFN:Rem Bot\nORG:Rem Bot;\nTITLE:Official\nitem1.TEL;waid=212674375708:+212674375708\nEND:VCARD`,
        jpegThumbnail: thumb
    }}
  };
  const verifiedAudio = {
    key: { participant: "0@s.whatsapp.net", remoteJid: "status@broadcast", fromMe: false, id: "OFFICIAL_VERIFIED_SERVICE" },
    message: { locationMessage: {
        degreesLatitude: 0, degreesLongitude: 0,
        name: 'By Yono',
        address: `${m.pushName||'User'} • ${total} Cmds`,
        jpegThumbnail: thumb
    }},
    participant: "0@s.whatsapp.net"
  };

  await conn.relayMessage(m.chat,{
      buttonsMessage:{
        locationMessage:{ degreesLatitude:0, degreesLongitude:0, name:"Yono Dev All Menu", address:`${total} Commands`, jpegThumbnail: thumb },
        contentText:`Yono Dev All Menu \nHello @${m.sender.split('@')[0]}`,
        footerText: footer.trim(),
        buttons:[
          { buttonId:`${usedPrefix}menu`, buttonText:{displayText:"menu"}, type:1 },
          { buttonId:`${usedPrefix}boos`, buttonText:{displayText:"boos"}, type:1 }
        ],
        headerType: 6
      }
    },{
      quoted: verifiedMenu,
      additionalNodes:[{tag:"biz",attrs:{},content:[{tag:"interactive",attrs:{type:"native_flow",v:"1"},content:[{tag:"native_flow",attrs:{v:"9",name:"mixed"}}]}]}],
      mentions:[m.sender]
    }
  );

  const audioUrls=['https://files.catbox.moe/6haz6k.mp3'];
  const randomAudio=getRandomNotSame(audioUrls,global.lastMenuAudio);
  global.lastMenuAudio=randomAudio;
  try{
    const mp3=await downloadBuffer(randomAudio);
    if (!AUDIO_PTT) await conn.sendMessage(m.chat,{audio:mp3,mimetype:'audio/mpeg',ptt:false},{quoted:verifiedAudio});
    else {
      try{
        const opus=await toOpus(mp3);
        await conn.sendMessage(m.chat,{audio:opus,mimetype:'audio/ogg; codecs=opus',ptt:true},{quoted:verifiedAudio});
      }catch{
        await conn.sendMessage(m.chat,{audio:mp3,mimetype:'audio/mpeg',ptt:false},{quoted:verifiedAudio});
      }
    }
  }catch(e){console.error(e)}
};

handler.help=['allmenu']
handler.tags=['main']
handler.command=/^(allmenu)$/i
export default handler