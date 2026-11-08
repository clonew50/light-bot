// plugins/tools/viewonce.js
'use strict';

import { downloadMediaMessage } from '@whiskeysockets/baileys';

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage'];

const BOT = {
  name: 'LIGHT BOT',
  line: '━'.repeat(20),
};

const ICON = { image: '🖼️', video: '🎬', audio: '🎧', voice: '🎙️' };
const LABEL = { image: 'صورة', video: 'فيديو', audio: 'صوت' };
const KIND_BY_TYPE = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
};

/* ────────── بحث عميق عن الوسائط في أي كائن ────────── */
function findMediaDeep(obj, depth = 0, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object' || depth > 12) return null;
  if (seen.has(obj)) return null;
  seen.add(obj);

  // 1) فحص مباشر للنوع
  for (const type of MEDIA_TYPES) {
    if (obj[type] && typeof obj[type] === 'object') {
      return { type, content: obj[type], container: obj };
    }
  }

  // 2) تعمّق في كل الخصائص (يمسك extendedTextMessage, contextInfo, viewOnceMessageV2, ...)
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      const found = findMediaDeep(val, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

/* ────────── اكتشاف النوع من حقول مساعدة ────────── */
function detectFromFields(m, quoted) {
  const mt = quoted?.mtype || quoted?.type || quoted?.messageType;
  if (mt === 'imageMessage') return { type: 'imageMessage', content: quoted };
  if (mt === 'videoMessage') return { type: 'videoMessage', content: quoted };
  if (mt === 'audioMessage') return { type: 'audioMessage', content: quoted };

  const mime = quoted?.mimetype || m?.msg?.mimetype || m?.quoted?.mimetype;
  if (mime) {
    if (mime.startsWith('image/')) return { type: 'imageMessage', content: quoted };
    if (mime.startsWith('video/')) return { type: 'videoMessage', content: quoted };
    if (mime.startsWith('audio/')) return { type: 'audioMessage', content: quoted };
  }
  return null;
}

/* ────────── استخراج موحّد ────────── */
function tryExtract(m) {
  if (m.quoted) {
    const f = findMediaDeep(m.quoted);
    if (f) return f;
  }
  if (m.message) {
    const f = findMediaDeep(m.message);
    if (f) return f;
  }
  if (m.msg) {
    const f = findMediaDeep(m.msg);
    if (f) return f;
  }
  return null;
}

/* ────────── تحقق من وجود رسالة مقتبسة ────────── */
function hasQuoted(m) {
  if (m.quoted && typeof m.quoted === 'object' && Object.keys(m.quoted).length > 0) return true;
  if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) return true;
  if (m.msg?.contextInfo?.quotedMessage) return true;
  if (m.message?.contextInfo?.quotedMessage) return true;
  return false;
}

/* ────────── تنسيقات مساعدة ────────── */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
function formatDuration(sec) {
  const s = Number(sec || 0);
  if (!s) return null;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m > 0 ? `${m}د ${r}ث` : `${r}ث`;
}

/* ────────── تحميل البَفر بعدة استراتيجيات ────────── */
async function downloadMediaBuffer(m, conn, found) {
  // (1) جرّب download() اللي بيوفّره الإطار أولاً
  if (typeof m.quoted?.download === 'function') {
    try {
      const buf = await m.quoted.download();
      if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
    } catch (e) {
      console.error('[viewonce] quoted.download failed:', e.message);
    }
  }

  // (2) استخرج الـ key من contextInfo
  const ci =
    m.message?.extendedTextMessage?.contextInfo ||
    m.msg?.contextInfo ||
    m.message?.contextInfo ||
    {};

  const quotedKey = m.quoted?.key || {
    remoteJid: m.chat,
    fromMe: false,
    id: ci.stanzaId,
    participant: ci.participant,
  };

  const { type, content, container } = found;

  // (3) جرّب أشكال متعددة من downloadMediaMessage
  const variants = [
    { key: quotedKey, message: { [type]: content } },
    { message: { [type]: content } },
  ];
  if (container) {
    variants.push({ key: quotedKey, message: container });
    variants.push({ message: container });
  }

  for (const variant of variants) {
    try {
      const buf = await downloadMediaMessage(
        variant,
        'buffer',
        {},
        { logger: console, reuploadRequest: conn.updateMediaMessage }
      );
      if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
    } catch (e) {
      console.error('[viewonce] downloadMediaMessage variant failed:', e.message);
    }
  }

  return null;
}

/* ────────── Handler ────────── */
const handler = async (m, { conn, usedPrefix, command }) => {
  try {
    // 1) لازم يكون فيه ردّ
    if (!hasQuoted(m)) {
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

    // 2) استخراج الوسائط
    let found = tryExtract(m);

    // 3) لو ما لقيناش، جرّب نستنتج النوع من الحقول
    if (!found) {
      found = detectFromFields(m, m.quoted);
    }

    if (!found) {
      console.error(
        '[viewonce] ✗ No media found. m.quoted =',
        JSON.stringify(m.quoted || null)?.slice(0, 1500)
      );
      return m.reply(
        `╭─「 ❌ نوع غير مدعوم 」─╮\n` +
        `│ الرسالة المقتبسة ليست\n` +
        `│ صورة أو فيديو أو صوت\n` +
        `╰────────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    const { type: mediaType, content: mediaContent } = found;
    const kind = KIND_BY_TYPE[mediaType];

    if (!kind) {
      return m.reply(
        `╭─「 ❌ نوع غير مدعوم 」─╮\n` +
        `│ النوع: ${mediaType || 'غير معروف'}\n` +
        `╰────────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    // 4) تحميل البَفر
    const buffer = await downloadMediaBuffer(m, conn, found);
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

    // 5) معلومات الملف
    const isVoiceNote = kind === 'audio' && !!mediaContent.ptt;
    const finalKind = isVoiceNote ? 'voice' : kind;

    const sizeStr = formatBytes(buffer.length);
    const durationStr = formatDuration(mediaContent.seconds);
    const mimetype = mediaContent.mimetype || '—';
    const caption = String(mediaContent.caption || '').trim();

    const captionBlock =
      `╭─「 ${ICON[finalKind]} ${LABEL[kind]} 」─╮\n` +
      `│ 📦 الحجم : ${sizeStr}\n` +
      (durationStr ? `│ ⏱️ المدة  : ${durationStr}\n` : '') +
      `│ 📎 النوع : ${mimetype}\n` +
      (caption ? `│ ✏️ الوصف : ${caption.slice(0, 200)}${caption.length > 200 ? '…' : ''}\n` : '') +
      `╰────────────────╯\n` +
      `${BOT.line}\n` +
      `> 🩸 تم الفتح بواسطة ${BOT.name}`;

    // 6) الإرسال
    if (kind === 'image') {
      return await conn.sendMessage(
        m.chat,
        { image: buffer, caption: captionBlock },
        { quoted: m }
      );
    }

    if (kind === 'video') {
      return await conn.sendMessage(
        m.chat,
        { video: buffer, caption: captionBlock },
        { quoted: m }
      );
    }

    if (kind === 'audio') {
      await conn.sendMessage(
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
      return m.reply(captionBlock);
    }
  } catch (error) {
    console.error('[VIEWONCE ERROR]', error);
    await m.reply(
      `╭─「 💥 خطأ 」─╮\n` +
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
