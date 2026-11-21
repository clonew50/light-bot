import syntaxerror from 'syntax-error';
import { format } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
import * as baileys from '@whiskeysockets/baileys';
import { generateWAMessageFromContent, generateWAMessage } from '@whiskeysockets/baileys';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);

// كيصلح أي رسالة باش تخدم بلا تحديث واتساب
function deepFix(obj) {
  if (!obj || typeof obj!== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepFix);
  let out = {...obj };
  // 1- حيد url الميت ديال الصور
  if (out.imageMessage?.url?.includes('mmg.whatsapp.net')) delete out.imageMessage.url;
  if (out.videoMessage?.url?.includes('mmg.whatsapp.net')) delete out.videoMessage.url;
  if (out.documentMessage?.url?.includes('mmg.whatsapp.net')) delete out.documentMessage.url;
  // 2- حيد bottom_sheet اللي كيسبب تحديث
  if (out.nativeFlowMessage?.messageParamsJson) {
    try {
      let p = JSON.parse(out.nativeFlowMessage.messageParamsJson);
      if (p.bottom_sheet) {
        // نخليوها simple list باش تخدم فأي واتساب
        p.bottom_sheet = undefined;
        // إلا بغينا نحيدوها كامل
        // delete p.bottom_sheet
        out.nativeFlowMessage.messageParamsJson = JSON.stringify(p);
      }
    } catch {}
  }
  // 3- حيد messageContextInfo خاوي
  if (out.messageContextInfo && Object.keys(out.messageContextInfo).length === 0) delete out.messageContextInfo;
  for (const k in out) if (out[k] && typeof out[k] === 'object') out[k] = deepFix(out[k]);
  return out;
}

let handler = async (m, { conn, usedPrefix, noPrefix, args, groupMetadata }) => {
  let _return;
  let _syntax = '';
  let _text = noPrefix.trim();

  // حيد > و => اللي كيجيو من crm
  _text = _text.replace(/^>\s*/, '').replace(/^=>\s*/, '').trim();
  if (!/^return/.test(_text) && /conn\.(relayMessage|sendMessage)/.test(_text)) {
    // إلا كان كود crm كامل بلا return نزيدوها
    if (!/return/.test(_text.slice(-100))) _text = 'return ' + _text;
  }
  if (/^conn\.relayMessage/.test(_text.trim())) {
    _text = 'return ' + _text.trim();
  }

  let old = m.exp * 1;
  try {
    let f = { exports: {} };
    const execFn = new (async () => {}).constructor(
      'print', 'm', 'require', 'conn', '@whiskeysockets/baileys', 'groupMetadata', 'generateWAMessageFromContent', 'generateWAMessage', 'deepFix', 'module', 'exports', 'args', 'argument', _text
    );
    _return = await execFn.call(
      conn,
      (...a) => { console.log(...a); return conn.reply(m.chat, format(...a), m); },
      m,
      require,
      conn,
      baileys,
      groupMetadata,
      async (jid, content, opts = {}) => {
        // wrapper كيصلح الرسالة تلقائيا
        const fixed = deepFix(content);
        const waMsg = await generateWAMessageFromContent(jid, fixed, { quoted: m,...opts });
        return conn.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id,...opts });
      },
      generateWAMessage,
      deepFix,
      f,
      f.exports,
      args,
      [conn, { conn }]
    );
  } catch (e) {
    let err = syntaxerror(_text, 'Exec', { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, sourceType: 'module' });
    if (err) _syntax = '```' + err + '```\n\n';
    _return = e;
  } finally {
    if (_return == null) _return = '✅ Done - تم الإرسال';
    if (_return?.key?.id || typeof _return === 'string' && _return.length === 20) {
      // إلا رجع ID ديال رسالة
      conn.reply(m.chat, `✅ Relay ID: ${_return?.key?.id || _return}`, m);
    } else {
      conn.reply(m.chat, _syntax + format(_return).slice(0, 4000), m);
    }
    m.exp = old;
  }
};

handler.usage = ['>', '=>'];
handler.category = 'owner';
handler.customPrefix = /^=?> /;
handler.command = /(?:)/i;
handler.owner = true;

export default handler;