/*
 * crm plugins - MERGED + AIRICH WORKING FROM advanced.js
 * Your bot supports Rich so this will work 100%
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import { proto, generateWAMessage, generateWAMessageFromContent, generateMessageIDV2 } from 'baileys'

// ========== CRMSTORE MERGED ==========
const dbPath = './data/crmdb.db'
fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('busy_timeout = 5000')
db.exec(`CREATE TABLE IF NOT EXISTS messages (rowid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, chat TEXT NOT NULL, sender TEXT, timestamp INTEGER, data BLOB NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat);
CREATE TABLE IF NOT EXISTS nodes (id TEXT NOT NULL, chat TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s','now')), PRIMARY KEY(id, chat));`)

function serializeNode(v){ return JSON.stringify(v, (_, v) => { if (Buffer.isBuffer(v)) return {type:'Buffer', data:v.toString('base64')}; if (v instanceof Uint8Array) return {type:'Buffer', data:Buffer.from(v).toString('base64')}; return v }) }
function deserializeNode(v){ if(!v) return null; return JSON.parse(v, (_, v) => { if(v&&v.type==='Buffer'){ if(typeof v.data==='string') return Buffer.from(v.data,'base64'); if(Array.isArray(v.data)) return Buffer.from(v.data) } return v }) }
const insertMessage = db.prepare(`INSERT INTO messages (id,chat,sender,timestamp,data) VALUES (?,?,?,?,?)`)
const getMessage = db.prepare(`SELECT data FROM messages WHERE id =? AND chat =? ORDER BY rowid DESC LIMIT 1`)
const getMessageById = db.prepare(`SELECT data FROM messages WHERE id =? ORDER BY rowid DESC LIMIT 1`)
const insertNodeStmt = db.prepare(`INSERT INTO nodes (id,chat,data) VALUES (?,?,?) ON CONFLICT(id, chat) DO UPDATE SET data = excluded.data, created_at = strftime('%s','now')`)
const getNodeStmt = db.prepare(`SELECT data FROM nodes WHERE id =? AND chat =? ORDER BY created_at DESC LIMIT 1`)
const getNodeByIdStmt = db.prepare(`SELECT data FROM nodes WHERE id =? ORDER BY created_at DESC LIMIT 1`)
function saveMessage(message, chat){ if(!message||!chat) return false; try{ const id=message?.key?.id; if(!id) return false; const encoded=proto.WebMessageInfo.encode(message).finish(); insertMessage.run(id, chat, message.participant||message.key?.participant||null, Number(message.messageTimestamp||Math.floor(Date.now()/1000)), Buffer.from(encoded)); return true }catch{ return false } }
function loadMessage(id, chat){ if(!id) return null; try{ const row=chat? getMessage.get(id, chat): getMessageById.get(id); if(!row?.data) return null; return proto.WebMessageInfo.decode(row.data) }catch{ return null } }
function saveNode(id, chat, node){ if(!id||!chat||!node) return false; try{ insertNodeStmt.run(String(id), String(chat), serializeNode(node)); return true }catch{ return false } }
function loadNode(messageId, jid){ if(!messageId) return null; try{ let row=null; if(jid) row=getNodeStmt.get(String(messageId), String(jid)); if(!row?.data) row=getNodeByIdStmt.get(String(messageId)); if(!row?.data) return null; return deserializeNode(row.data) }catch{ return null } }
function saveAdditionalNode(id, chat, content, attrs={}){ if(!id||!chat) return false; try{ insertNodeStmt.run(String(id), String(chat), serializeNode({tag:'message', attrs:{id:String(id), from:String(chat), t:String(Math.floor(Date.now()/1000)), type:'text',...attrs}, content})); return true }catch{ return false } }
function persist(message, id, jid, options){ queueMicrotask(()=>{ try{ saveMessage(proto.WebMessageInfo.fromObject(message), jid); saveAdditionalNode(id, jid, options.additionalNodes||[], {t:String(Math.floor(Date.now()/1000)),...options.additionalAttributes}) }catch{} }) }
if(!global.__crmStoreBoundConns) global.__crmStoreBoundConns=new WeakSet()
function bind(conn){ if(!conn) return conn; if(global.__crmStoreBoundConns.has(conn)) return conn; global.__crmStoreBoundConns.add(conn); conn.ev.on('messages.upsert', ({messages})=>{ try{ for(const message of messages||[]){ if(!message?.key?.id) continue; const chat=message.key.remoteJid; if(!chat) continue; saveMessage(message, chat) } }catch{} }); conn.ws.on('CB:message', node=>{ try{ const id=node?.attrs?.id; if(!id) return; const chat=node?.attrs?.from||node?.attrs?.recipient||node?.attrs?.participant; if(!chat) return; saveNode(id, chat, node) }catch{} }); if(typeof conn.sendMessage==='function'&&!conn.sendMessage.__crmStorePatched){ const orig=conn.sendMessage.bind(conn); const patched=async(jid, content, options={})=>{ const messageId=options.messageId||generateMessageIDV2(); const generated=await generateWAMessage(jid, content, {...options, messageId, userJid:conn.user?.id, upload:conn.waUploadToServer}); const sent=await orig(jid, content, {...options, messageId}); persist(generated.message, messageId, jid, options); return sent }; patched.__crmStorePatched=true; conn.sendMessage=patched } if(typeof conn.relayMessage==='function'&&!conn.relayMessage.__crmStorePatched){ const orig=conn.relayMessage.bind(conn); const patched=async(jid, content, options={})=>{ const messageId=options.messageId||generateMessageIDV2(); const generated=generateWAMessageFromContent(jid, content, {...options, messageId, userJid:conn.user?.id, upload:conn.waUploadToServer}); const res=orig(jid, content, {...options, messageId}); persist(generated, messageId, jid, options); return res }; patched.__crmStorePatched=true; conn.relayMessage=patched } return conn }
const crmstore={ db, bind, saveMessage, loadMessage, loadNode, saveNode, saveAdditionalNode }

// ========== AIRICH اللي خدام عندك فـ متقدم.js ==========
class AIRich {
   #client
   constructor(client) { this.#client = client; this._title=''; this._footer=''; this._sections=[]; this._submessages=[] }
   setTitle(t){ this._title=t; return this }
   setFooter(t){ this._footer=t; return this }
   static L(name, data){ return { view_model: { [Array.isArray(data)?'primitives':'primitive']: data, __typename: `GenAI${name}LayoutViewModel` } } }
   addText(t){ this._submessages.push({messageType:2,messageText:t}); this._sections.push(AIRich.L('Single',{text:t,__typename:'GenAIMarkdownTextUXPrimitive'})); return this }
   addTip(t){ this._submessages.push({messageType:2,messageText:t}); this._sections.push(AIRich.L('Single',{text:t,__typename:'GenAIMetadataTextPrimitive'})); return this }
   addMetadata(t){ return this.addTip(t) }
   addSuggest(a){ const arr=Array.isArray(a)?a:[a]; this._sections.push(AIRich.L('ActionRow', arr.map(x=>({prompt_text:x,prompt_type:'SUGGESTED_PROMPT',__typename:'GenAIFollowUpSuggestionPillPrimitive'})))); return this }
   addCode(l,c){ const tk=[{codeContent:c,highlightType:0}]; this._submessages.push({messageType:5,codeMetadata:{codeLanguage:l,codeBlocks:tk}}); this._sections.push(AIRich.L('Single',{language:l,code_blocks:tk.map(x=>({content:x.codeContent,type:'DEFAULT'})),__typename:'GenAICodeUXPrimitive'})); return this }
   build(jid){ const secs=this._footer?[...this._sections,AIRich.L('Single',{text:this._footer,__typename:'GenAIMetadataTextPrimitive'})]:this._sections; const msg={messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2,botMetadata:{messageDisclaimerText:this._title}},botForwardedMessage:{message:{richResponseMessage:{messageType:1,submessages:this._submessages,unifiedResponse:{data:Buffer.from(JSON.stringify({response_id:crypto.randomUUID(),sections:secs})).toString('base64')},contextInfo:{forwardingScore:1,isForwarded:true,forwardedAiBotMessageInfo:{botJid:'0@bot'},forwardOrigin:4}}}}}; return generateWAMessageFromContent(jid,msg,{messageId:generateMessageIDV2()}) }
   async send(jid,opts){ const m=this.build(jid); return this.#client.relayMessage(jid,m.message,{messageId:m.key.id,...opts}) }
}

class Button {
   #client; #title=''; #body=''; #media=null; #buttons=[];
   constructor(c){ this.#client=c }
   setTitle(t){ this.#title=t; return this }
   setBody(t){ this.#body=t; return this }
   setMedia(m){ this.#media=m; return this }
   setParams(p){ return this }
   addCopy(d,i){ this.#buttons.push({name:'cta_copy',buttonParamsJson:JSON.stringify({display_text:d,copy_code:i||d})}); return this }
   async send(jid, opts={}){
      let content={};
      if(this.#media?.document) content={document:this.#media.document,mimetype:this.#media.mimetype,fileName:this.#media.fileName,caption:`*${this.#title}*\n\n${this.#body}`,footer:this.#title,buttons:this.#buttons,headerType:1};
      else content={text:`*${this.#title}*\n\n${this.#body}`,footer:this.#title,buttons:this.#buttons,headerType:1};
      const waMsg=generateWAMessageFromContent(jid,{viewOnceMessage:{message:content}}, {messageId:generateMessageIDV2(),...opts});
      return this.#client.relayMessage(jid, waMsg.message, {messageId:waMsg.key.id});
   }
}

const handler = async (m, { conn, text, command }) => {
	const args = String(text || '').trim().split(/\s+/).filter(Boolean);
	if (command === 'lastchat') {
		const parsed = Number(args[0] || 10);
		const limit = Math.min(Math.max(Number.isFinite(parsed)? parsed : 10, 1), 100);
		const rows = getLastChatRows(crmstore, m, limit);
		if (!rows.length) return m.reply('No messages found.');
		return m.reply(formatLastChat(rows));
	}
	const rowMatch = args[0]?.match(/^#(\d+)$/);
	const rowid = rowMatch? Number(rowMatch[1]) : null;
	let chatId, targetId, msgSource, rmsg;
	if (rowid!== null) {
		const row = crmstore.db.prepare(`SELECT rowid, id, chat, sender, timestamp, data FROM messages WHERE rowid =? LIMIT 1`).get(rowid);
		if (!row) return m.reply(`Message with rowid #${rowid} not found.`);
		try { rmsg = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), { enums: Number, longs: Number, bytes: String, defaults: false }); } catch (e) { return m.reply(`Failed to decode rowid #${rowid}:\n${e.message}`); }
		chatId = row.chat; targetId = row.id; msgSource = `rowid:${rowid}`;
	} else {
		if (!m.quoted) return m.reply(`📌 *.${command}* needs a replied message.\n\n•.crm → file relay\n•.crm -snip → AIRich snippet\n•.crm2 → button\n•.adn → AdditionalNodes\n•.insp → raw payload\n•.relay → relay again`);
		chatId = m.quoted.chat || m.chat; targetId = m.quoted.id;
		const sources = [{ type: 'crmstore', data: crmstore.loadMessage(targetId, chatId) }, { type: 'quotedObj', data: await m.getQuotedObj?.() }, { type: 'fakeObj', data: m.quoted?.fakeObj }];
		const source = sources.find((v) => v.data?.message || v.data?.key);
		msgSource = source?.type; rmsg = source?.data;
	}
	let msg; if (rmsg) msg = await normalizeMessage(rmsg, crmstore, chatId);
	if (!msg?.message) return m.reply(`⛓️‍💥 Invalid message`);
	const messageId = msg.key?.id || targetId;
	const rawNode = loadBestNode(crmstore, messageId, chatId, msg);
	const nodeAttrs = getNodeAttributes(rawNode);
	const nodeContent = getNodeContent(rawNode);
	const type = Object.keys(msg.message).find((v) =>!['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || 'unknown';
	const additionalNodes = filterAdditionalNodes(nodeContent);
	const relayOptions = getRelayOptions(rawNode);
	const parentSender = getSenderIdentity(msg.key);
	const noChild = text.includes('-nochild');
	const noProto = text.includes('-noproto');
	const stats = { fails: 0 };
	const childTree = noChild? [] : await buildChildTree(crmstore, chatId, messageId, parentSender, 50, 0, 5, new Set(),!noProto, stats);
	if (command === 'relay') {
		const newParentId = await conn.relayMessage(m.chat, structuredClone(msg.message), relayOptions);
		await relayChildTree(conn, m.chat, childTree, newParentId);
		return m.reply(newParentId);
	}
	const rawPayload = { message: msg, node: rawNode, additionalAttributes: nodeAttrs, additionalNodes };
	const raw = stringify(rawPayload);
	const message = stringify(msg.message);
	const key = stringify(msg.key);
	const options = stringifySnippet(relayOptions);
	const participant = msg.key?.remoteJid || msg.key?.participant || msg.key?.participantAlt || '-';
	const msgId = msg.key?.id || targetId || '-';
	const snippetMessage = stringifySnippet(msg.message);
	const relayCode = buildRelayScript(snippetMessage, stringifySnippet(relayOptions), childTree);
	const files = { raw, message, relay: relayCode };
	const exportType = ['raw', 'message', 'relay'].find((v) => text.includes(`-${v}`));
	if (exportType) {
		if (text.includes('-file')) return conn.sendMessage(m.chat, { document: Buffer.from(files[exportType]), fileName: exportType === 'relay'? `${type}.js` : `${exportType}.json`, mimetype: exportType === 'relay'? 'application/javascript' : 'application/json' }, { quoted: m });
		return m.reply(files[exportType]);
	}
	const isSnip = text.includes('-snip');
	const formatChat = (chat) => { if (!chat) return '-'; return isSnip? `${chat.slice(0, 7)}.....${chat.split('@')[1] || ''}` : chat; };
	const formatId = (id) => { if (!id) return '-'; return isSnip? `${id.slice(0, 7)}.....` : id; };
	const childrenCount = countTree(childTree);
	const childrenLine = stats.fails? `${childrenCount} (${stats.fails} fail)` : `${childrenCount}`;
	const sender = msg.key?.participant || msg.key?.participantAlt || msg.key?.remoteJid || m.quoted?.sender || '-';
	const nodeChat = rawNode?.attrs?.from || rawNode?.attrs?.to || rawNode?.attrs?.recipient || '-';
	const metadata = `• Type : ${type}\n• Source : ${msgSource || '-'}\n• Chat : ${formatChat(chatId)}\n• Node Chat: ${formatChat(nodeChat)}\n• ID : ${formatId(messageId)}\n• Node ID : ${formatId(rawNode?.attrs?.id || '-')}\n• Sender : ${sender.split('@')[0]}\n• Node Tag : ${rawNode?.tag || '-'}\n• Attrs : ${Object.keys(nodeAttrs).length}\n• Children : ${childrenLine}`;

	if (command === 'insp') {
		const inspPayload = attachChildren(rawPayload, childTree);
		const imsg = stringify(inspPayload);
		if (isSnip) {
			if (imsg.length > 20000) { await m.react('❌'); return m.reply('Payload too large for snip.'); }
			return new AIRich(conn).setTitle('📥️ Raw Snippet').setFooter(metadata).addText(`# 📥️ Raw Snippet\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', imsg).send(m.chat, { quoted: m });
		}
		return conn.sendMessage(m.chat, { document: Buffer.from(imsg), fileName: `${type}.json`, mimetype: 'application/json', caption: metadata }, { quoted: m });
	}
	const adn = text.includes('-nofilter')? additionalNodes : filterAdditionalNodes(additionalNodes);
	if (command === 'adn' &&!adn.length) return m.reply('No AdditionalNodes captured 📷');
	if (command === 'crm') {
		if (isSnip) {
			if (relayCode.length > 20000) { await m.react('❌'); return m.reply('Payload too large for snip.'); }
			return new AIRich(conn).setTitle('⚡ Relay Snippet').setFooter(metadata).addText(`# ⚡ Relay Snippet\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', relayCode).send(m.chat, { quoted: m });
		}
		return conn.sendMessage(m.chat, { document: Buffer.from(relayCode), fileName: `${type}.js`, mimetype: 'application/javascript', caption: metadata }, { quoted: m });
	}
	if (command === 'adn') {
		if (isSnip) return new AIRich(conn).setTitle('📸 AdditionalNode').setFooter(metadata).addText(`# 📸 AdditionalNode\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', stringifySnippet(adn)).send(m.chat, { quoted: m });
		return conn.sendMessage(m.chat, { document: Buffer.from(stringify(adn)), fileName: 'additionalNodes.json', mimetype: 'application/json' }, { quoted: m });
	}
	if (command === 'crm2') {
		return new Button(conn).setTitle(capitalize(type)).setBody(metadata + '\n\n' + raw).setMedia({ document: Buffer.from(relayCode), mimetype: 'application/javascript', fileName: `${type}.js` }).addCopy('Copy Full Raw', raw).addCopy('Copy Relay Code', relayCode).send(m.chat, { quoted: m });
	}
};
handler.command = ['crm', 'crm2', 'insp', 'adn', 'relay', 'lastchat'];
handler.tags = 'owner';
handler.owner = true;
export default handler;

const ignoredTags = new Set(['device-identity', 'quality_control', 'enc', 'hsm', 'verified_name', 'multicast', 'reporting', 'unavailable', 'rcat']);
const ignoredAttributes = new Set(['id', 'from', 'to', 'participant', 'recipient', 'type', 'sts', 'verified_level', 'notify', 'addressing_mode', 'verified_name', 'participant_pn', 't', 'count']);
const SECRET_CONTEXT = { EVENT_EDIT: 'Event Edit', MESSAGE_EDIT: 'Message Edit', POLL_EDIT: 'Poll Edit', POLL_ADD_OPTION: 'Poll Edit' };
function loadBestNode(crmstore, messageId, chatId, msg){ if(!crmstore||!messageId) return null; let node=null; try{ node=crmstore.loadNode(messageId, chatId);}catch{} if(node) return node; try{ const raw=crmstore.loadNode(messageId); if(raw) return raw;}catch{} return null; }
function getNodeAttributes(node){ if(!node?.attrs||typeof node.attrs!=='object'||Array.isArray(node.attrs)) return {}; const attrs={...node.attrs}; for(const key of ignoredAttributes) delete attrs[key]; return attrs; }
function getNodeContent(node){ if(!node||!Array.isArray(node.content)) return []; return node.content; }
function normalizeMessage(rmsg, crmstore, chat){ const normalized=proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(rmsg),{enums:Number,longs:Number,bytes:String,defaults:false}); return decryptSecretEnvelope(normalized, crmstore, chat); }
async function decryptSecretEnvelope(msg, crmstore, chat){ const secret=msg?.message?.secretEncryptedMessage; if(!secret) return msg; const type=secretEncTypeName(secret.secretEncType); if(!['MESSAGE_EDIT','EVENT_EDIT','POLL_EDIT','POLL_ADD_OPTION'].includes(type)) return msg; const targetKey=secret.targetMessageKey; if(!targetKey?.id) return msg; const target=loadTargetSecret(crmstore, chat, targetKey); if(!target) return msg; const decrypted=decryptSecretMessage(secret, target, type); if(!decrypted) return msg; return {...msg, message:decrypted}; }
function getSenderIdentity(key){ if(!key) return {me:false,jids:new Set()}; if(key.fromMe) return {me:true,jids:new Set()}; const jids=new Set([key.participant, key.participantAlt].filter(Boolean)); if(!jids.size&&key.remoteJid) jids.add(key.remoteJid); return {me:false,jids}; }
function collectDeepKeys(node,depth=0,maxDepth=12,out=[]){ if(!node||typeof node!=='object'||depth>maxDepth) return out; if(node.protocolMessage?.key) out.push(node.protocolMessage.key); if(node.secretEncryptedMessage?.targetMessageKey) out.push(node.secretEncryptedMessage.targetMessageKey); for(const value of Object.values(node)) if(value&&typeof value==='object') collectDeepKeys(value,depth+1,maxDepth,out); return out; }
function collectSecretMessages(node,depth=0,maxDepth=12,out=[]){ if(!node||typeof node!=='object'||depth>maxDepth) return out; if(node.secretEncryptedMessage) out.push(node.secretEncryptedMessage); for(const value of Object.values(node)) if(value&&typeof value==='object') collectSecretMessages(value,depth+1,maxDepth,out); return out; }
function findMessageSecret(node,depth=0,maxDepth=12){ if(!node||typeof node!=='object'||depth>maxDepth) return null; if(node.messageContextInfo?.messageSecret) return node.messageContextInfo.messageSecret; for(const value of Object.values(node)) if(value&&typeof value==='object'){ const found=findMessageSecret(value,depth+1,maxDepth); if(found) return found; } return null; }
function loadTargetSecret(crmstore, chat, targetKey){ try{ const row=crmstore.loadMessage(targetKey.id, chat); if(!row) return null; const normalized=proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(row),{enums:Number,longs:Number,bytes:String,defaults:false}); const secretB64=findMessageSecret(normalized.message); if(!secretB64) return null; const key=normalized.key||{}; const senderJid=key.participant||targetKey.participant||key.remoteJid||targetKey.remoteJid; if(!senderJid) return null; return {messageSecret:Buffer.from(secretB64,'base64'),senderJid}; }catch{ return null; } }
function secretEncTypeName(value){ if(typeof value==='string') return value; try{ return proto.Message.SecretEncryptedMessage.SecretEncType[value]??value;}catch{ return value; } }
function getSecretContext(type){ return SECRET_CONTEXT[type]||null; }
function decryptSecretMessage(secretMsg, target, type){ try{ const targetId=secretMsg?.targetMessageKey?.id; if(!targetId||!secretMsg?.encPayload||!secretMsg?.encIv||!target?.messageSecret) return null; const context=getSecretContext(type); if(!context) return null; const messageSecret=target.messageSecret; if(messageSecret.length!==32) return null; const senderJid=target.senderJid; const info=Buffer.concat([Buffer.from(targetId,'utf8'),Buffer.from(senderJid,'utf8'),Buffer.from(senderJid,'utf8'),Buffer.from(context,'utf8')]); const key=crypto.hkdfSync('sha256',messageSecret,Buffer.alloc(0),info,32); const encPayload=Buffer.from(secretMsg.encPayload,'base64'); const encIv=Buffer.from(secretMsg.encIv,'base64'); if(encIv.length!==12||encPayload.length<16) return null; const authTag=encPayload.subarray(-16); const ciphertext=encPayload.subarray(0,-16); const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key),encIv); decipher.setAuthTag(authTag); const plaintext=Buffer.concat([decipher.update(ciphertext),decipher.final()]); const decoded=proto.Message.decode(plaintext); return proto.Message.toObject(decoded,{enums:Number,longs:Number,bytes:String,defaults:false}); }catch{ return null; } }
async function decryptChildMessage(crmstore, chat, msgObj){ const secrets=collectSecretMessages(msgObj); if(!secrets.length) return {message:msgObj,fails:0}; let current=msgObj; let fails=0; for(const secretMsg of secrets){ const targetKey=secretMsg?.targetMessageKey; if(!targetKey?.id){ fails++; continue; } const target=loadTargetSecret(crmstore, chat, targetKey); if(!target){ fails++; continue; } const type=secretEncTypeName(secretMsg.secretEncType); const decrypted=decryptSecretMessage(secretMsg, target, type); if(!decrypted){ fails++; continue; } current=replaceSecretEnvelope(current, secretMsg, decrypted); } return {message:current,fails}; }
function replaceSecretEnvelope(node, targetSecret, decrypted){ if(!node||typeof node!=='object') return node; if(node.secretEncryptedMessage===targetSecret) return decrypted; if(node.secretEncryptedMessage&&sameSecretEnvelope(node.secretEncryptedMessage,targetSecret)) return decrypted; if(Array.isArray(node)) return node.map((value)=>replaceSecretEnvelope(value,targetSecret,decrypted)); const out={...node}; for(const [key,value] of Object.entries(out)) if(value&&typeof value==='object') out[key]=replaceSecretEnvelope(value,targetSecret,decrypted); return out; }
function sameSecretEnvelope(a,b){ return a?.targetMessageKey?.id===b?.targetMessageKey?.id&&a?.encPayload===b?.encPayload&&a?.encIv===b?.encIv&&a?.secretEncType===b?.secretEncType; }
function getParentKey(key,chat){ if(!key?.id) return null; return {id:key.id,remoteJid:key.remoteJid||chat,fromMe:!!key.fromMe,participant:key.participant,participantAlt:key.participantAlt}; }
function matchesParentKey(keyObj,parentKey,chat){ if(!keyObj||!parentKey) return false; if(!keyObj.id||keyObj.id!==parentKey.id) return false; const keyRemoteJid=keyObj.remoteJid||keyObj.remoteJidAlt; const parentRemoteJid=parentKey.remoteJid||chat; if(keyRemoteJid&&parentRemoteJid&&keyRemoteJid!==parentRemoteJid) return false; return true; }
async function findDirectChildren(crmstore, chat, parentId, parentSender, radius=50, useProto=true){ const base=crmstore.db.prepare(`SELECT timestamp, data FROM messages WHERE id =? AND chat =? LIMIT 1`).get(parentId, chat); if(!base) return []; let parentMessage; try{ parentMessage=proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(base.data),{enums:Number,longs:Number,bytes:String,defaults:false}); }catch{ return []; } const parentKey=getParentKey(parentMessage.key, chat); if(!parentKey) return []; const older=crmstore.db.prepare(`SELECT id, data FROM messages WHERE chat =? AND timestamp <=? ORDER BY timestamp DESC LIMIT?`).all(chat, base.timestamp, radius); const newer=crmstore.db.prepare(`SELECT id, data FROM messages WHERE chat =? AND timestamp >? ORDER BY timestamp ASC LIMIT?`).all(chat, base.timestamp, radius); const children=[]; for(const row of [...older,...newer]){ if(row.id===parentId) continue; let decoded; try{ decoded=proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data),{enums:Number,longs:Number,bytes:String,defaults:false}); }catch{ continue; } const assocKey=decoded?.message?.messageContextInfo?.messageAssociation?.parentMessageKey; const matchedAssoc=matchesParentKey(assocKey, parentKey, chat); const matchedDeep=useProto?collectDeepKeys(decoded?.message).some((key)=>matchesParentKey(key, parentKey, chat)):false; if(!matchedAssoc&&!matchedDeep) continue; children.push(decoded); } return children; }
async function buildChildTree(crmstore, chat, parentId, parentSender, radius=50, depth=0, maxDepth=5, visited=new Set(), useProto=true, stats={fails:0}){ if(depth>=maxDepth) return []; const visitKey=`${chat}:${parentId}:${serializeSender(parentSender)}`; if(visited.has(visitKey)) return []; visited.add(visitKey); const rawChildren=await findDirectChildren(crmstore, chat, parentId, parentSender, radius, useProto); const result=[]; for(const rawChild of rawChildren){ const normalized=await normalizeMessage(rawChild, crmstore, chat); const decrypted=await decryptChildMessage(crmstore, chat, normalized.message); stats.fails+=decrypted.fails; const finalRaw={...normalized, message:decrypted.message}; const msg=unwrapAssociatedChild(finalRaw); if(!msg?.key?.id||!msg?.message) continue; const childId=msg.key.id; const childSender=getSenderIdentity(msg.key); const childNode=loadBestNode(crmstore, childId, chat, msg); const relayOptions=getRelayOptions(childNode); const children=await buildChildTree(crmstore, chat, childId, childSender, radius, depth+1, maxDepth, visited, useProto, stats); result.push({raw:finalRaw,node:childNode,msg,relayOptions,children}); } return result; }
function serializeSender(sender){ if(!sender) return ''; if(sender.me) return 'me'; return [...sender.jids].sort().join(','); }
async function relayChildTree(conn, chat, nodes, parentId){ for(const node of nodes){ const message=structuredClone(node.msg.message); const assoc=message?.messageContextInfo?.messageAssociation; if(assoc?.parentMessageKey){ assoc.parentMessageKey.id=parentId; assoc.parentMessageKey.remoteJid=chat; assoc.parentMessageKey.fromMe=true; } const protocolKeys=collectProtocolKeys(message); for(const key of protocolKeys){ key.id=parentId; key.remoteJid=chat; key.fromMe=true; } const options={...node.relayOptions}; const newChildId=await conn.relayMessage(chat, message, options); await relayChildTree(conn, chat, node.children, newChildId); } }
function collectProtocolKeys(node,depth=0,maxDepth=12,out=[]){ if(!node||typeof node!=='object'||depth>maxDepth) return out; if(node.protocolMessage?.key) out.push(node.protocolMessage.key); for(const value of Object.values(node)) if(value&&typeof value==='object') collectProtocolKeys(value,depth+1,maxDepth,out); return out; }
function filterAdditionalNodes(nodes){ return (nodes||[]).filter((v)=>!ignoredTags.has(v?.tag)); }
function getRelayOptions(node=null){ const additionalAttributes=getNodeAttributes(node); const additionalNodes=filterAdditionalNodes(getNodeContent(node)); const options={}; if(Object.keys(additionalAttributes).length) options.additionalAttributes=additionalAttributes; if(additionalNodes.length) options.additionalNodes=additionalNodes; return options; }
function countTree(nodes){ return nodes.reduce((sum,node)=>sum+1+countTree(node.children),0); }
function attachChildren(base,tree){ if(!tree.length) return base; return {...base, __children: tree.map((node)=>{ const child=attachChildren(node.raw, node.children); if(node.node) return {...child, __node:node.node}; return child; })}; }
function unwrapAssociatedChild(msg){ const contextInfo=msg?.message?.messageContextInfo; const inner=msg?.message?.associatedChildMessage?.message; if(!inner) return msg; return {...msg, message:{...inner, messageContextInfo:contextInfo}}; }
function findBlockEnd(str,openIndex){ let depth=0; for(let i=openIndex;i<str.length;i++){ if(str[i]==='{') depth++; if(str[i]==='}'){ depth--; if(depth===0) return i; } } return -1; }
function injectKeyBlock(snippet,marker,parentIdExpr){ const start=snippet.indexOf(marker); if(start===-1) return snippet; const braceIndex=start+marker.length-1; const end=findBlockEnd(snippet,braceIndex); if(end===-1) return snippet; const indentMatch=snippet.slice(0,start).match(/([ \t]*)$/); const indent=indentMatch?indentMatch[1]:''; const replacement=`${marker.slice(0,-1)}{\n${indent} remoteJid: m.chat,\n${indent} fromMe: true,\n${indent} id: ${parentIdExpr}\n${indent}}`; return snippet.slice(0,start)+replacement+snippet.slice(end+1); }
function injectParentKey(childSnippet,parentIdExpr='newParentId'){ return injectKeyBlock(childSnippet,'parentMessageKey: {',parentIdExpr); }
function injectTargetKey(childSnippet,parentIdExpr='newParentId'){ return injectKeyBlock(childSnippet,'targetMessageKey: {',parentIdExpr); }
function injectProtocolKey(childSnippet,parentIdExpr='newParentId'){ const marker='protocolMessage: {'; const start=childSnippet.indexOf(marker); if(start===-1) return childSnippet; const braceIndex=start+marker.length-1; const blockEnd=findBlockEnd(childSnippet,braceIndex); if(blockEnd===-1) return childSnippet; const before=childSnippet.slice(0,start); const block=childSnippet.slice(start,blockEnd+1); const after=childSnippet.slice(blockEnd+1); const patchedBlock=injectKeyBlock(block,'key: {',parentIdExpr); return before+patchedBlock+after; }
function buildChildScript(nodes,parentVar,path=[]){ const blocks=[]; nodes.forEach((node,i)=>{ const varName=`id_${[...path,i].join('_')}`; const rawChildSnippet=stringifySnippet(node.msg.message); let childSnippet=injectParentKey(rawChildSnippet,parentVar); childSnippet=injectProtocolKey(childSnippet,parentVar); childSnippet=injectTargetKey(childSnippet,parentVar); const childOptions=stringifySnippet(node.relayOptions); blocks.push(`const ${varName} = await conn.relayMessage(\n m.chat,\n ${indentBlock(childSnippet)},\n ${indentBlock(childOptions)}\n);`); if(node.children.length) blocks.push(...buildChildScript(node.children,varName,[...path,i])); }); return blocks; }
function buildRelayScript(snippetMessage,options,childTree){ if(!childTree.length) return `=> conn.relayMessage(\n m.chat,\n ${indentBlock(snippetMessage)},\n ${indentBlock(options)}\n)`; const parentBlock=`const newParentId = await conn.relayMessage(\n m.chat,\n ${indentBlock(snippetMessage)},\n ${indentBlock(options)}\n);`; const childBlocks=buildChildScript(childTree,'newParentId'); return '> '+[parentBlock,...childBlocks,'return newParentId;'].join('\n\n'); }
function getTimestampFromMessage(message){ if(!message) return 0; if(typeof message.messageTimestamp==='number') return message.messageTimestamp; if(typeof message.messageTimestamp==='object'&&message.messageTimestamp!==null) return Number(message.messageTimestamp.low??message.messageTimestamp); return 0; }
function getReferenceMessage(m,crmstore){ const chat=m.quoted?.chat||m.chat; const messageId=m.quoted?.id; if(messageId){ const row=crmstore.db.prepare(`SELECT timestamp FROM messages WHERE id =? AND chat =? LIMIT 1`).get(messageId, chat); if(row) return {chat,timestamp:Number(row.timestamp)||0}; } return {chat,timestamp:getTimestampFromMessage(m)||Math.floor(Date.now()/1000)}; }
function getLastChatRows(crmstore,m,limit){ const reference=getReferenceMessage(m,crmstore); if(!reference.timestamp) return []; return crmstore.db.prepare(`SELECT rowid, id, chat, sender, timestamp, data FROM messages WHERE chat =? AND timestamp <=? ORDER BY timestamp DESC, rowid DESC LIMIT?`).all(reference.chat, reference.timestamp, limit).reverse(); }
function getMessageType(message){ if(!message) return '-'; return Object.keys(message).find((v)=>!['messageContextInfo','senderKeyDistributionMessage'].includes(v))||'-'; }
function getPreviewText(message){ if(!message) return '-'; if(typeof message.conversation==='string') return message.conversation; if(message.extendedTextMessage?.text) return message.extendedTextMessage.text; if(message.imageMessage) return message.imageMessage.caption?`📷 ${message.imageMessage.caption}`:'📷 Image'; if(message.videoMessage) return message.videoMessage.caption?`🎥 ${message.videoMessage.caption}`:'🎥 Video'; if(message.audioMessage) return '🎵 Audio'; if(message.stickerMessage) return '🎨 Sticker'; if(message.documentMessage) return message.documentMessage.fileName||'📄 Document'; if(message.reactionMessage) return `💬 Reaction ${message.reactionMessage.text||''}`.trim(); if(message.protocolMessage){ const type=message.protocolMessage.type; if(type===proto.Message.ProtocolMessage.Type.REVOKE) return '🗑️ Revoke'; if(type===proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) return '✏️ Edit'; return `⚙️ Protocol ${type}`; } if(message.secretEncryptedMessage) return '🔐 SecretEncryptedMessage'; return getMessageType(message); }
function getDisplaySender(message,row){ const key=message?.key||{}; if(key.fromMe) return 'Me'; return key.participantAlt||key.participant||row?.sender||key.remoteJid||'Unknown'; }
function formatTimestamp(timestamp){ if(!timestamp) return '--:--:--'; const date=new Date(Number(timestamp)*1000); if(Number.isNaN(date.getTime())) return '--:--:--'; return new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(date); }
function formatLastChat(rows){ const lines=[`╭─〔 LAST CHAT • ${rows.length} MESSAGES 〕`,'│']; for(let i=0;i<rows.length;i++){ const row=rows[i]; let message; try{ message=proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data),{enums:Number,longs:Number,bytes:String,defaults:false}); }catch{ message=null; } const type=getMessageType(message?.message); const sender=getDisplaySender(message,row); const preview=getPreviewText(message?.message); lines.push(`│ ${String(i+1).padStart(2,'0')} ${formatTimestamp(row.timestamp)} ${sender}`); lines.push(`│ ${type} • #${row.rowid}`); lines.push(`│ ${String(preview).replace(/\n/g,' ').slice(0,180)}`); if(i!==rows.length-1) lines.push('│'); } lines.push('│'); lines.push(`╰─ ${rows[0]?.chat||'-'}`); return lines.join('\n'); }
function stringify(obj){ return JSON.stringify(obj,(key,value)=>{ if(Buffer.isBuffer(value)) return value.toString('base64'); if(value?.type==='Buffer'&&Array.isArray(value.data)) return Buffer.from(value.data).toString('base64'); return value; },2); }
function indentBlock(str,level=1){ const pad=' '.repeat(level); return str.split('\n').map((line,i)=>(i===0?line:pad+line)).join('\n'); }
function stringifySnippet(obj){ const raws=[]; const json=JSON.stringify(obj,(key,value)=>{ if(key==='unifiedResponse'&&value&&typeof value==='object'&&typeof value.data==='string'){ try{ const decoded=Buffer.from(value.data,'base64').toString('utf8'); const parsed=JSON.parse(decoded); const id=raws.length; raws.push(`Buffer.from(JSON.stringify(${JSON.stringify(parsed,null,2)})).toString('base64')`); return {data:`__RAW_${id}__`}; }catch{} } if(key==='buttonParamsJson'&&typeof value==='string'){ try{ const parsed=JSON.parse(value); const id=raws.length; raws.push(`JSON.stringify(${JSON.stringify(parsed,null,2)})`); return `__RAW_${id}__`; }catch{} } if(Buffer.isBuffer(value)) return value.toString('base64'); if(value?.type==='Buffer'&&Array.isArray(value.data)) return Buffer.from(value.data).toString('base64'); return value; },2); let code=json.replace(/^(\s*)"([^"]+)":/gm,(_,indent,key)=>`${indent}${key}:`); code=code.split('\n').map((line)=>{ const match=line.match(/^(\s*).*"__RAW_(\d+)__"/); if(!match) return line; const [,indent,id]=match; const block=raws[Number(id)].split('\n').map((l,i)=>(i===0?l:indent+l)).join('\n'); return line.replace(`"__RAW_${id}__"`,block); }).join('\n'); return code; }
function capitalize(str){ return str.charAt(0).toUpperCase()+str.slice(1); }