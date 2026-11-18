/*
  ═══════════════════════════════════════════
  📊 جدول ميتا AI — كارت جدول حي من سجل الأوامر الحقيقي
  بيستخدم قسم sendAiMessage type 4 (tableMetadata) اللي الإطار بيحوّله
  لـ GenATableUXPrimitive. البيانات كلها حية: كل صف = قسم موجود فعلاً
  في السجل + عدد أوامره + أول أمر فيه. مفيش أي بيانات ثابتة.

  الأمر:
    .جدول
  ═══════════════════════════════════════════
*/
import { collectCategories, infoOf, nonEmpty, resolvePrefix } from '../native/_native.js';

const MAX_ROWS = 40; // سقف معقول لكارت واحد؛ الإطار مبيحددش صراحة لكن بنحترم الحد العملي.

const handler = async (m, ctx = {}) => {
  try {
    const { conn, bot } = ctx;
    if (typeof conn?.sendAiMessage !== 'function') {
      await (typeof m?.reply === 'function' ? m.reply('❌ خدمة كروت ميتا AI غير متاحة في هذا الاتصال.') : undefined);
      return;
    }

    const cats = await collectCategories(bot);
    if (!cats.length) {
      await (typeof m?.reply === 'function' ? m.reply('❌ لا توجد بيانات لعرضها في الجدول بعد.') : undefined);
      return;
    }

    const info = infoOf(ctx);
    const prefix = resolvePrefix(ctx, info);
    const title = nonEmpty(info?.nameBot, 'البوت') + ' — إحصائيات الأقسام';

    const rows = [{ isHeading: true, items: ['القسم', 'عدد الأوامر', 'أول أمر'] }];
    let total = 0;
    for (const c of cats.slice(0, MAX_ROWS)) {
      const count = c.commands.length;
      total += count;
      const sample = prefix + nonEmpty(c.commands[0], '');
      rows.push({ isHeading: false, items: [nonEmpty(c.label, c.key), String(count), sample] });
    }
    // صف إجمالي حي كمان (آخر صف بيانات).
    rows.push({ isHeading: false, items: ['الإجمالي', String(total), '—'] });

    // قسم واحد فقط (type 4) — مفيش زيادة عن الحد المسموح.
    await conn.sendAiMessage(m.chat, [{ type: 4, tableMetadata: { title, rows } }]);
  } catch (e) {
    console.error('❌ [جدول]', e?.message || e);
    try {
      if (typeof m?.reply === 'function') await m.reply('❌ حصلت مشكلة في تجهيز الجدول.');
    } catch { /* ميك مايكسرش */ }
  }
};

handler.command = ['جدول', 'table'];
handler.usage = ['جدول'];
handler.category = 'info';
handler.cooldown = 6;

export default handler;