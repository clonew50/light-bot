// ─── plugins/native/carousel.js ───
// Native carousel of plugin categories (todo 17).
//   .عجلة / .كاروسيل / .carousel
//
// One card per category (2..6 cards), every card carrying the bot's OWN image,
// a non-empty bodyText, the bot name as footerText, and 2-3 quick_reply buttons
// whose ids are real command strings. conn.sendCarousel throws when a card has
// neither imageUrl nor mediaUrl, so that case is handled explicitly.

import {
  collectCategories,
  infoOf,
  resolvePrefix,
  resolveImages,
  quickReply,
  say,
  nonEmpty
} from './_native.js';

const MAX_CARDS = 6;

function cardButtons(commands, prefix) {
  const buttons = commands.slice(0, 3).map((u) => quickReply(u, u, prefix));
  if (buttons.length === 1) buttons.push(quickReply('قائمة', '📜 القائمة', prefix));
  return buttons.slice(0, 3);
}

const handler = async (m, ctx = {}) => {
  try {
    const { conn, bot } = ctx;
    if (!conn?.sendCarousel) return say(m, '❌ خدمة العجلة التفاعلية غير متاحة في هذا الاتصال.');

    const info = infoOf(ctx);
    const prefix = resolvePrefix(ctx, info);
    const images = resolveImages(info);
    const cats = await collectCategories(bot);

    if (cats.length < 2) {
      return say(m, '❌ لا توجد أقسام كافية لعرض العجلة.');
    }
    if (!images.length) {
      // Card schema requires imageUrl/mediaUrl; without the bot's own image we
      // cannot fabricate a card, so answer in Arabic instead of throwing.
      return say(m, '❌ لا توجد صور للقائمة. أضف صور البوت في الإعدادات ثم أعد المحاولة.');
    }

    const selected = cats.slice(0, MAX_CARDS);
    const cards = [];
    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      const buttons = cardButtons(c.commands, prefix);
      if (buttons.length < 2) continue; // keep every card useful
      cards.push({
        imageUrl: images[i % images.length],
        mediaType: 'image',
        bodyText: `${c.emoji} ${c.label}\n${c.commands.length} أمر — اختر أمراً للتنفيذ:`,
        footerText: nonEmpty(info?.nameBot, '🤖'),
        buttons
      });
    }

    if (cards.length < 2) {
      return say(m, '❌ لا توجد أقسام كافية لعرض العجلة.');
    }

    const payload = {
      headerText: nonEmpty(info?.nameBot, 'الأقسام'),
      globalFooterText: nonEmpty(info?.nameChannel || info?.nameBot, ''),
      cards
    };
    if (typeof m?.sender === 'string' && m.sender) payload.mentions = [m.sender];

    await conn.sendCarousel(m.chat, payload, m);
    return undefined;
  } catch (error) {
    console.error('[native/carousel]', error);
    await say(m, `❌ حدث خطأ أثناء بناء العجلة: ${(error && error.message) || error}`);
    return undefined;
  }
};

handler.usage = ['عجلة'];
handler.command = ['عجلة', 'كاروسيل', 'carousel'];
handler.category = 'native';

export default handler;