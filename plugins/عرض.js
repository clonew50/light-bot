// plugins/tools/viewonce.js
'use strict';

import { downloadMediaMessage } from '@whiskeysockets/baileys';

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage'];

/* إزالة غلاف view-once للوصول للرسالة الحقيقية */
function unwrap(message) {
  if (!message || typeof message !== 'object') return {};
  if (message.viewOnceMessage) return message.viewOnceMessage.message || {};
  if (message.viewOnceMessageV2) return message.viewOnceMessageV2.message || {};
  if (message.viewOnceMessageV2Extension) return message.viewOnceMessageV2Extension.message || {};
  return message;
}

/* البحث عن نوع الوسائط في الرسالة المقتبسة (يدعم أشكال متعددة) */
function findMedia(quoted) {
  if (!quoted) return null;

  const candidates = [quoted];

  if (quoted.message && typeof quoted.message === 'object') candidates.push(quoted.message);
  if (quoted.msg && typeof quoted.msg === 'object') candidates.push(quoted.msg);
  if (quoted.msg?.message) candidates.push(quoted.msg.message);
  if (quoted.fakeObj?.message) candidates.push(quoted.fakeObj.message);

  for (const cand of candidates) {
    const inner = unwrap(cand);
    for (const type of MEDIA_TYPES) {
      if (inner?.[type]) {
        return { type, content: inner[type], inner };
      }
    }
  }
  return null;
}

const handler = async (m, { conn, usedPrefix, command }) => {
  try {
    if (!m.quoted) {
      return m.reply(`📌 الرجاء الرد على رسالة (صورة / فيديو / صوت) بكتابة ${usedPrefix}${command}`);
    }

    const found = findMedia(m.quoted);
    if (!found) {
      return m.reply('❌ هذه الرسالة ليست صورة أو فيديو أو صوت');
    }

    const { type: mediaType, content: mediaContent, inner } = found;

    /* 1) جرّب download() من الإطار أولاً */
    let buffer = null;
    if (typeof m.quoted.download === 'function') {
      try {
        buffer = await m.quoted.download();
      } catch {
        buffer = null;
      }
    }

    /* 2) السقوط إلى downloadMediaMessage */
    if (!buffer) {
      const contextInfo = m.message?.extendedTextMessage?.contextInfo || {};
      const quotedKey = m.quoted.key || {
        remoteJid: m.chat,
        fromMe: false,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant,
      };

      buffer = await downloadMediaMessage(
        { key: quotedKey, message: inner },
        'buffer',
        {},
        { logger: console, reuploadRequest: conn.updateMediaMessage }
      );
    }

    if (!buffer) {
      return m.reply('❌ فشل تحميل الوسائط');
    }

    if (mediaType === 'imageMessage') {
      return await conn.sendMessage(
        m.chat,
        { image: buffer, caption: mediaContent.caption || '' },
        { quoted: m }
      );
    }

    if (mediaType === 'videoMessage') {
      return await conn.sendMessage(
        m.chat,
        { video: buffer, caption: mediaContent.caption || '' },
        { quoted: m }
      );
    }

    if (mediaType === 'audioMessage') {
      const isVoiceNote = !!mediaContent.ptt;
      return await conn.sendMessage(
        m.chat,
        {
          audio: buffer,
          mimetype: isVoiceNote
            ? 'audio/ogg; codecs=opus'
            : (mediaContent.mimetype || 'audio/mp4'),
          ptt: isVoiceNote,
        },
        { quoted: m }
      );
    }
  } catch (error) {
    console.error('[VIEWONCE ERROR]', error);
    await m.reply(`❌ عذراً، حدث خطأ أثناء معالجة الوسائط: ${error.message || error}`);
  }
};

handler.command = ['ع', 'عرض', 'viewonce', 'vv'];
handler.usage = ['عرض'];
handler.category = 'tools';
handler.usePrefix = true;

export default handler;
