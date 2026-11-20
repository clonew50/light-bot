/*
  ═══════════════════════════════════════════
  🃏 ستكر + تعليق (sticker annotation)
  بيبني ملصق من ميديا البوت نفسه (بيحمّلها من الرسالة اللي بترد عليها،
  يعملها ملصق عبر createSticker، ويرفعها عبر uploadToCatbox — مفيش أي
  mediaKey / directPath / fileSha256 / رابط mmg مستعار من أي مكان تاني)،
  وبعدين بيبعت تعليق نصي مربوط بالملصق عبر MessageAssociation type 11
  (STICKER_ANNOTATION) اللي بيعرفه بروتوكول واتساب.

  الأوامر:
    .ستكر <نص التعليق>   (رد على صورة)
    .annotate <نص>
  ═══════════════════════════════════════════
*/
import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { createSticker, uploadToCatbox } from '../../system/utils.js';

const STICKER_ANNOTATION = 11; // WAProto.MessageAssociation.AssociationType.STICKER_ANNOTATION

const say = async (m, text) => {
  try {
    if (typeof m?.reply === 'function') return await m.reply(text);
    return undefined;
  } catch {
    return undefined;
  }
};

function quotedMedia(m) {
  const q = m?.quoted;
  if (!q) return null;
  const mime = String(q.msg?.mimetype || q.mimetype || '').toLowerCase();
  if (mime && !mime.startsWith('image/')) return null;
  if (typeof q.download !== 'function') return null;
  return { q, mime };
}

const handler = async (m, ctx = {}) => {
  const { conn } = ctx;
  const annotation = String(ctx.text ?? (ctx.args || []).join(' ')).trim();

  try {
    if (!conn?.relayMessage) {
      await say(m, '❌ خدمة الملصقات غير متاحة في هذا الاتصال.');
      return;
    }

    const media = quotedMedia(m);
    if (!media) {
      await say(m, '🖼️ رد على صورة الأول، وبعدين اكتب التعليق:\n.ستكر تعليق على الصورة');
      return;
    }
    if (!annotation) {
      await say(m, '✍️ اكتب نص التعليق بعد الأمر:\n.ستكر أحلى صورة');
      return;
    }

    const info = ctx.bot?.config?.info || conn.config?.info || {};
    const pack = String(info.nameBot || 'LIGHT BOT');
    const author = String(info.nameChannel || info.nameBot || '');

    // 1) وسائط البوت نفسه: تحميل → ملصق → رفع عبر مساعد البوت.
    const input = await media.q.download();
    const makeSticker = typeof ctx.createSticker === 'function' ? ctx.createSticker : createSticker;
    const upload = typeof ctx.upload === 'function' ? ctx.upload : uploadToCatbox;
    const sticker = await makeSticker(input, { mime: media.mime, pack, author });
    const ownUrl = await upload(sticker); // مساعد الرفع الخاص بالبوت (بايتس الملصق اللي عملناه)

    // 2) الملصق بيتبعت من الرابط اللي رُفع ببوتنا — مفيش وسائط خارجية.
    const sent = await conn.sendMessage(m.chat, { sticker: ownUrl }, { quoted: m });
    const stickerKey = sent?.key || sent;
    const stickerId = stickerKey?.id || m?.message?.key?.id;
    if (!stickerId) {
      await say(m, '❌ تعذّر إرسال الملصق.');
      return;
    }

    // 3) تعليق نصي مربوط بالملصق: association type 11 على رسالة نصية.
    //    (sendMessage بتتجاهل messageContextInfo، فبنبني الرسالة الخام ونعمل relay.)
    const association = {
      associationType: STICKER_ANNOTATION,
      parentMessageKey: {
        remoteJid: stickerKey?.remoteJid || m.chat,
        fromMe: true,
        id: stickerId
      }
    };
    const build = typeof ctx.buildMessage === 'function' ? ctx.buildMessage : generateWAMessageFromContent;
    const wa = build(m.chat, {
      conversation: annotation,
      messageContextInfo: { messageAssociation: association }
    }, { userJid: conn.user?.id });

    await conn.relayMessage(m.chat, wa.message, { messageId: wa.key.id });

    return { stickerUrl: ownUrl, stickerKey: { ...association.parentMessageKey }, annotation };
  } catch (e) {
    console.error('❌ [ستكر]', e?.message || e);
    await say(m, '❌ حصلت مشكلة في تجهيز الملصق. جرب تاني بعد شوية.');
    return undefined;
  }
};

handler.command = ['ستكر', 'annotate'];
handler.usage = ['.ستكر <نص التعليق> (رد على صورة)'];
handler.category = 'sticker';

export default handler;