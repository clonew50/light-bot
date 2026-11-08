/* ────────── Handler ────────── */
const handler = async (m, ctx) => {
  const { conn, bot } = ctx;

  /* ✅ حل مشكلة الـ prefix والـ command */
  const prefix =
    (typeof ctx.usedPrefix === 'string' && ctx.usedPrefix) ||
    (typeof m.prefix === 'string' && m.prefix) ||
    (typeof m.usedPrefix === 'string' && m.usedPrefix) ||
    (Array.isArray(bot?.config?.info?.prefix) && bot.config.info.prefix[0]) ||
    (typeof bot?.config?.info?.prefix === 'string' && bot.config.info.prefix) ||
    '.';

  const command =
    (typeof ctx.command === 'string' && ctx.command) ||
    (typeof m.command === 'string' && m.command) ||
    'عرض';

  try {
    // 1) لازم يكون فيه ردّ
    if (!hasQuoted(m)) {
      return m.reply(
        `╭─「 ⚠️ تنبيه 」─╮\n` +
        `│ الرجاء الرد على رسالة\n` +
        `│ (صورة / فيديو / صوت)\n` +
        `│ بكتابة  ${prefix}${command}\n` +
        `╰──────────────╯\n` +
        `${BOT.line}\n` +
        `> 🤖 ${BOT.name}`
      );
    }

    // 2) استخراج الوسائط
    let found = tryExtract(m);
    if (!found) found = detectFromFields(m, m.quoted);

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

    // 3) تحميل البَفر
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

    // 4) معلومات الملف
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

    // 5) الإرسال
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
