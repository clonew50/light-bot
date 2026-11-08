// plugins/tools/viewonce.js
'use strict';

import { downloadMediaMessage } from '@whiskeysockets/baileys';

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage'];

const BOT = {
  name: 'LIGHT BOT',
  line: '━' .repeat(20),
};

/* إزالة غلاف view-once للوصول للرسالة الحقيقية */
function unwrap(message) {
  if (!message || typeof message !== 'object') return {};
  if (message.viewOnceMessage) return message.viewOnceMessage.message || {};
  if (message.viewOnceMessageV2) return message.viewOnceMessageV2.message || {};
  if (message.viewOnceMessageV2Extension) return message.viewOnceMessageV2Extension.message || {};
  return message;
}

/* البحث عن نوع الوسائط في الرسالة المقتبسة */
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

/* حجم مقروء */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/* مدة مقروءة */
function formatDuration(sec) {
  const s = Number(sec || 0);
  if (!s) return null;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m > 0 ? `${m}د ${r}ث` : `${r}ث`;
}

const ICON = {
  image: '🖼️',
  video: '🎬',
  audio: '🎧',
  voice: '🎙️',
};

const LABEL = {
  image: 'صورة',
  video: 'فيديو',
  audio: 'صوت',
};

const handler = async (m, { conn, usedPrefix, command }) => {
  try {
    /* ── لا يوجد ردّ ── */
    if (!m.quoted) {
      return m.reply(
        `╭─「 ⚠️ تنبيه 」─╮\n` +
        `│ الرجاء الرد على رسالة\n` +
        `│ (صورة / فيديو / صوت)\n` +
        `│ بكتابة  ${usedPrefix}${command}\n` +
        `╰──────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    const found = findMedia(m.quoted);
    if (!found) {
      return m.reply(
        `╭─「 ❌ نوع غير مدعوم 」─╮\n` +
        `│ الرسالة المقتبسة ليست\n` +
        `│ صورة أو فيديو أو صوت\n` +
        `╰────────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    const { type: mediaType, content: mediaContent, inner } = found;

    /* ── تحميل ── */
    let buffer = null;
    if (typeof m.quoted.download === 'function') {
      try { buffer = await m.quoted.download(); } catch { buffer = null; }
    }

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
      return m.reply(
        `╭─「 💔 فشل التحميل 」─╮\n` +
        `│ تعذّر جلب الوسائط\n` +
        `│ حاول مرة أخرى لاحقاً\n` +
        `╰──────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    /* ── بيانات الملف ── */
    const isImage = mediaType === 'imageMessage';
    const isVideo = mediaType === 'videoMessage';
    const isAudio = mediaType === 'audioMessage';

    const isVoiceNote = isAudio && !!mediaContent.ptt;
    const kind = isImage ? 'image' : isVideo ? 'video' : (isVoiceNote ? 'voice' : 'audio');

    const sizeStr = formatBytes(buffer.length);
    const durationStr = formatDuration(
      isVideo ? mediaContent.seconds : isAudio ? mediaContent.seconds : null
    );
    const mimetype = mediaContent.mimetype || '—';
    const caption = (mediaContent.caption || '').trim();

    /* ── نرسل الملف مع كابشن مزخرف ── */
    const captionBlock =
      `╭─「 ${ICON[kind]} ${LABEL[kind]} 」─╮\n` +
      `│ 📦 الحجم : ${sizeStr}\n` +
      (durationStr ? `│ ⏱️ المدة  : ${durationStr}\n` : '') +
      `│ 📎 النوع : ${mimetype}\n` +
      (caption ? `│ ✏️ الوصف : ${caption.slice(0, 200)}${caption.length > 200 ? '…' : ''}\n` : '') +
      `╰────────────────╯\n` +
      `${BOT.line}\n` +
      `> 🩸 تم الفتح بواسطة ${BOT.name}`;

    if (isImage) {
      return await conn.sendMessage(
        m.chat,
        { image: buffer, caption: captionBlock },
        { quoted: m }
      );
    }

    if (isVideo) {
      return await conn.sendMessage(
        m.chat,
        { video: buffer, caption: captionBlock },
        { quoted: m }
      );
    }

    if (isAudio) {
      await conn.sendMessage(
        m.chat,
        {
          audio: buffer,
          mimetype: isVoiceNote ? 'audio/ogg; codecs=opus' : (mediaContent.mimetype || 'audio/mp4'),
          ptt: isVoiceNote,
        },
        { quoted: m }
      );

      return m.reply(
        `╭─「 ${ICON[kind]} ${LABEL[kind]} 」─╮\n` +
        `│ 📦 الحجم : ${sizeStr}\n` +
        (durationStr ? `│ ⏱️ المدة  : ${durationStr}\n` : '') +
        `│ 📎 النوع : ${mimetype}\n` +
        `╰────────────────╯\n` +
        `${BOT.line}\n` +
        `> 🩸 تم الفتح بواسطة ${BOT.name}`
      );
    }
  } catch (error) {
    console.error('[VIEWONCE ERROR]', error);
    await m.reply(
      `╭─「 💥 خطأ 」─╮\n` +
      `│ عذراً، حدث خطأ أثناء\n` +
      `│ معالجة الوسائط\n` +
      `│\n` +
      `│ 📝 التفاصيل:\n` +
      `│ ${String(error.message || error).slice(0, 180)}\n` +
      `╰─────────────╯\n` +
      `${BOT.line}\n` +
      `> 🤖 ${BOT.name}`
    );
  }
};

handler.command = ['ع', 'عرض', 'viewonce', 'vv'];
handler.usage = ['عرض'];
handler.category = 'tools';
handler.usePrefix = true;

export default handler;
