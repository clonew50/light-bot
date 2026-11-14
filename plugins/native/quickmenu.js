// ─── plugins/native/quickmenu.js ───
// Native quick-reply menu (todo 16).
//   .قائمة / .القائمة  -> categories as quick_reply buttons
//   .قسم <category>    -> that category's commands as quick_reply buttons
//
// Uses conn.sendButtonNormal (never conn.sendButton, which injects a third
// party's promo). Every button id is a REAL command string with the bot prefix,
// so tapping it runs the command.

import {
  collectCategories,
  chunk,
  infoOf,
  resolvePrefix,
  resolveImages,
  mediaFor,
  quickReply,
  say,
  nonEmpty
} from './_native.js';

const MAX_BUTTONS = 10;

function captionFor(info, cats) {
  const name = nonEmpty(info?.nameBot, 'القائمة');
  const total = cats.reduce((n, c) => n + c.commands.length, 0);
  return `${name}\n\n📜 الأقسام (${cats.length}) — الأوامر (${total})\nاختر قسماً لعرض أوامره:`;
}

async function sendChunks(conn, chat, images, caption, footer, buttons, quoted) {
  const chunks = chunk(buttons, MAX_BUTTONS);
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1;
    await conn.sendButtonNormal(chat, {
      media: mediaFor(images, i),
      mediaType: 'image',
      caption: last ? caption : `${caption}\n\n⏭️ أكمل في الرسالة التالية`,
      footer,
      buttons: chunks[i]
    }, quoted);
  }
  return chunks.length;
}

const handler = async (m, ctx = {}) => {
  try {
    const { conn, bot } = ctx;
    if (!conn?.sendButtonNormal) return say(m, '❌ خدمة الأزرار التفاعلية غير متاحة في هذا الاتصال.');

    const info = infoOf(ctx);
    const prefix = resolvePrefix(ctx, info);
    const images = resolveImages(info);
    const footer = nonEmpty(info?.nameChannel || info?.nameBot, '');
    const cats = await collectCategories(bot);
    const sub = nonEmpty(ctx.args?.[0] ?? ctx.text, '').trim();

    // ── .قسم <category> ──────────────────────────────────────────────
    if (sub) {
      const needle = sub.toLowerCase();
      const found = cats.find((c) =>
        c.key.toLowerCase() === needle ||
        c.label.toLowerCase() === needle ||
        c.commands.some((u) => u.toLowerCase() === needle)
      );

      if (!found) {
        return say(m, '❌ القسم غير موجود. اكتب .قائمة لعرض كل الأقسام.');
      }

      const buttons = found.commands.map((u) => quickReply(u, u, prefix));
      if (!buttons.length) {
        return say(m, `❌ لا توجد أوامر في قسم ${found.label}.`);
      }

      const caption = `${nonEmpty(info?.nameBot, 'القائمة')}\n\n${found.emoji} ${found.label}\nعدد الأوامر: ${buttons.length}\nاختر أمراً:`;
      await sendChunks(conn, m.chat, images, caption, footer, buttons, m);
      return undefined;
    }

    // ── .قائمة ──────────────────────────────────────────────────────
    if (!cats.length) {
      return say(m, '❌ لا توجد أقسام لعرضها بعد.');
    }

    // Each button runs `.قسم <key>`, a command this plugin registers.
    const buttons = cats.map((c) => quickReply(`قسم ${c.key}`, `${c.emoji} ${c.label}`, prefix));

    await sendChunks(conn, m.chat, images, captionFor(info, cats), footer, buttons, m);
    return undefined;
  } catch (error) {
    console.error('[native/quickmenu]', error);
    await say(m, `❌ حدث خطأ أثناء بناء القائمة: ${(error && error.message) || error}`);
    return undefined;
  }
};

handler.usage = ['قائمة', 'قسم <القسم>'];
handler.command = ['قائمة', 'القائمة', 'قسم']; // 'menu' is already owned by plugins/menu2.js
handler.category = 'native';
handler.group = true;
handler.private = true;

export default handler;