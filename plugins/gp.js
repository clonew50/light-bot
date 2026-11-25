// plugins/gp.js - Yono BOT - 2 MESSAGES - COPY FROM ABOVE
import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';
import { generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';
import crypto from 'crypto';
let exec = promisify(_exec).bind(cp);

class AIRich {
   #client
   constructor(client){ this.#client=client; this._title=''; this._footer=''; this._sections=[]; this._submessages=[] }
   setTitle(t){ this._title=t; return this }
   setFooter(t){ this._footer=t; return this }
   static L(n,d){ return { view_model:{ [Array.isArray(d)?'primitives':'primitive']: d, __typename:`GenAI${n}LayoutViewModel` } } }
   addText(t){ this._submessages.push({messageType:2,messageText:t}); this._sections.push(AIRich.L('Single',{text:t,__typename:'GenAIMarkdownTextUXPrimitive'})); return this }
   addTip(t){ this._submessages.push({messageType:2,messageText:t}); this._sections.push(AIRich.L('Single',{text:t,__typename:'GenAIMetadataTextPrimitive'})); return this }
   addSuggest(a){ const arr=Array.isArray(a)?a:[a]; this._sections.push(AIRich.L('ActionRow', arr.map(x=>({prompt_text:x,prompt_type:'SUGGESTED_PROMPT',__typename:'GenAIFollowUpSuggestionPillPrimitive'})))); return this }

   // ===== full code + copy button on top =====
   addCodeFull(c){
     const tk=[{codeContent:c,highlightType:0}];
     this._submessages.push({messageType:5,codeMetadata:{codeLanguage:'javascript',codeBlocks:tk}});
     // 1 - the copy button is the trick to appear at the top
     this._sections.push({
       view_model: {
         __typename: 'GenAIAddonActionLayoutViewModel',
         addon_action_type: 'COPY_TO_CLIPBOARD',
         addon_action_alignment: 'END',
         primitives: [{ __typename: 'GenAIMarkdownTextUXPrimitive', text: `\`${c}\``, inline_entities: [] }]
       }
     });
     // 2 - then the full code
     this._sections.push(AIRich.L('Single',{language:'javascript',code_blocks:tk.map(x=>({content:x.codeContent,type:'DEFAULT'})),__typename:'GenAICodeUXPrimitive'}));
     return this;
   }

   addTable(arr){ const [h,...r]=arr; const u=[{is_header:true,cells:h},...r.map(x=>({is_header:false,cells:x}))]; this._submessages.push({messageType:4,tableMetadata:{title:'',rows:u.map(x=>({items:x.cells,isHeading:x.is_header}))}}); this._sections.push(AIRich.L('Single',{rows:u,__typename:'GenATableUXPrimitive'})); return this }
   addEntity(o){ this._submessages.push({messageType:2,messageText:o.title}); this._sections.push(AIRich.L('Single',{title:o.title,subtitle:o.subtitle,secondary_subtitle:o.secondary,entity_id:o.id,entity_url:`https://wa.me/${o.id}`,entity_type:"PAGE",action_type:"FOLLOW",is_verified:true,image:{url:o.imageUrl,url_fallback:o.imageUrl},__typename:"GenAICompactEntityPrimitive"})); return this; }
   addSource(s){ const src=s.map(x=>({source_type:'THIRD_PARTY',source_display_name:x.title,source_subtitle:x.subtitle,source_url:x.url,favicon:{url:x.icon,mime_type:'image/jpeg',width:16,height:16}})); this._sections.push(AIRich.L('Single',{sources:src,__typename:'GenAISearchResultPrimitive'})); return this }

   build(jid){
     const finalSections = this._footer? [...this._sections, AIRich.L('Single',{text:this._footer,__typename:'GenAIMetadataTextPrimitive'})] : this._sections;
     const unifiedData = { response_id: crypto.randomUUID(), sections: finalSections };
     const messageContent = {
       messageContextInfo: {
         deviceListMetadata: {},
         deviceListMetadataVersion: 2,
         botMetadata: { messageDisclaimerText: this._title },
         limitSharingV2: { sharingLimited: false, trigger: 1, limitSharingSettingTimestamp: Date.now(), initiatedByMe: false }
       },
       botForwardedMessage: {
         message: {
           richResponseMessage: {
             messageType: 1,
             submessages: this._submessages,
             unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedData)).toString('base64') },
             contextInfo: {
               forwardingScore: 2, isForwarded: true, forwardOrigin: 4,
               expiration: 7776000,
               disappearingMode: { initiator: 0, trigger: 0, initiatedByMe: false },
               botMessageSharingInfo: { forwardScore: 2 }
             }
           }
         }
       }
     };
     return generateWAMessageFromContent(jid, messageContent, {messageId: generateMessageIDV2()});
   }
   async send(jid,opts){ const m=this.build(jid); return this.#client.relayMessage(jid,m.message,{messageId:m.key.id,...opts}) }
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
   const dev = '201212446299';
   let devPp = 'https://litter.catbox.moe/4evj2u.jpg';
   try{ devPp = await conn.profilePictureUrl(dev+'@s.whatsapp.net','image') }catch{}

   let ar = Object.keys(plugins);
   let ar1 = ar.map(v=>v.replace('.js',''));

   if (!text) {
     let rows = ar1.map((name,i)=>{
       let p = plugins[name+'.js'] || {};
       let tag = p.tags? p.tags[0] : 'tools';
       let own = p.owner? 'Owner' : 'Public';
       return [(i+1).toString(), name, tag, own];
     });

     const r = new AIRich(conn)
    .setTitle(`PLUGIN LIST - ${ar1.length} FILE`)
    .setFooter(`Yono BOT - Developer ${dev} - ${ar1.length} plugin`)
    .addEntity({title:`${ar1.length} Plugins Available`, subtitle:`Owner of Yono BOT`, secondary:`${dev} - Verified`, id:dev, imageUrl:devPp})
    .addText(`COMPLETE PLUGIN LIST\nTotal: ${ar1.length} file\nDeveloper: ${dev}\nBot: Yono BOT`)
    .addTable([
         ['No','Plugin Name','Tag','Access'],
      ...rows.slice(0,50)
       ])
    .addSource([{icon:devPp, url:`https://wa.me/${dev}`, title:`Developer ${dev}`, subtitle:`${ar1.length} plugin`}])
    .addSuggest(ar1.slice(0,5).map(v=>`${usedPrefix+command} ${v}`))
    .addTip(`Type ${usedPrefix+command} plugin_name to view code - Yono BOT`);

     return await r.send(m.chat,{quoted:m});
   }

   if (!ar1.includes(text)) {
     const rnf = new AIRich(conn)
    .setTitle('NOT FOUND')
    .setFooter(`Yono BOT - ${dev}`)
    .addEntity({title:`${text} - Not Found`, subtitle:`Plugin not found`, secondary:dev, id:dev, imageUrl:devPp})
    .addText(`Plugin ${text} not found\nCheck list with ${usedPrefix+command}`)
    .addTable([['No','Plugin Name','Status'],...ar1.slice(0,30).map((v,i)=>[(i+1).toString(), v, 'OK'])]);
     return await rnf.send(m.chat,{quoted:m});
   }

   try{
     let o = await exec('cat plugins/' + text + '.js');
     let content = (o.stdout || '').trim();
     let lines = content.split('\n').length;
     let size = content.length;

     // ===== message 1 - info + table =====
     const rfile = new AIRich(conn)
    .setTitle(`PLUGIN: ${text}.js`)
    .setFooter(`Yono BOT - ${dev} - ${size} chars`)
    .addEntity({title:`${text}.js`, subtitle:`${size} chars - ${lines} lines`, secondary:`Developer ${dev}`, id:dev, imageUrl:devPp})
    .addTable([
         ['Info','Detail'],
         ['File Name', `${text}.js`],
         ['Size', `${size} char`],
         ['Lines', `${lines} lines`],
         ['Developer', dev],
         ['Bot', 'Yono BOT'],
         ['Status', 'Active']
       ])
    .addText(`Full code sent in the next message with the copy button above.`)
    .addSource([{icon:devPp, url:`https://wa.me/${dev}`, title:`Developer ${dev}`}])
    .addSuggest([`${usedPrefix+command} ${text}`]);

     await rfile.send(m.chat,{quoted:m});

     // ===== message 2 - full code as one + copy button on top =====
     const rcode = new AIRich(conn)
      .setTitle(`CODE: ${text}.js`)
      .setFooter(`Yono BOT - ${text}.js - ${size} chars`)
      .addCodeFull(content); // complete - not truncated

     await rcode.send(m.chat,{quoted:m});

   }catch(e){
     await conn.sendMessage(m.chat, {text:`Error: ${e.message}`}, {quoted:m});
   }
};

handler.help = ['getplugin'];
handler.tags = ['owner'];
handler.command = /^(getplugin|gp)$/i;
handler.owner = true;
export default handler;