import { syncOnce, initState, getStatus } from '../../system/autoSync.mjs';

let handler = async (m, { conn, text }) => {
  const arg = (text || '').trim().toLowerCase();

  // .تحديث حالة  → عرض التعديلات المعلّقة
  if (['حالة', 'الحالة', 'status', 'ستاتس'].includes(arg)) {
    const s = getStatus();
    if (!s.ready) return m.reply('ℹ️ مفيش حالة مزامنة لسه. ابعت `.تحديث تجهيز` الأول.');
    const lines = [
      `📊 *حالة المزامنة*`,
      `آخر مزامنة: ${s.at ? new Date(s.at).toLocaleString('ar-EG') : '-'}`,
      `تعديلات معلّقة: *${s.changed.length}* | محذوف: *${s.deleted.length}*`,
    ];
    if (s.changed.length) lines.push('', ...s.changed.slice(0, 15).map((p) => `✏️ ${p}`));
    if (s.deleted.length) lines.push('', ...s.deleted.slice(0, 15).map((p) => `🗑️ ${p}`));
    return m.reply(lines.join('\n'));
  }

  // .تحديث تجهيز  → تجهيز الحالة من الريبو
  if (['تجهيز', 'تهيئة', 'init'].includes(arg)) {
    await m.reply('⏳ جاري تجهيز حالة المزامنة...');
    const r = await initState();
    if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One متظبّط (ONE_SECRET أو system/one-config.json).');
    if (r.error) return m.reply(`❌ فشل: ${r.error}`);
    return m.reply(`✅ تم التجهيز — ${r.files} ملف من الريبو.`);
  }

  // الافتراضي: مزامنة ورفع التعديلات
  await m.reply('⏳ جاري رفع التعديلات على GitHub...');
  try {
    const r = await syncOnce({ quiet: true, log: () => {} });
    if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One متظبّط (ONE_SECRET أو system/one-config.json).');
    if (r.error === 'busy') return m.reply('⏳ في مزامنة شغّالة بالفعل، استنى ثانية.');
    if (r.error) return m.reply(`❌ فشل الرفع: ${r.error}`);
    if (!r.changes) return m.reply('✅ الريبو متزامن — مفيش تغييرات.');
    return m.reply(`✅ تم رفع *${r.changes}* تغيير على GitHub\n${r.url}\n\nhttps://github.com/clonew50/light-bot`);
  } catch (e) {
    m.reply(`❌ فشل: ${e.message}`);
  }
};

handler.usage = ['تحديث', 'تحديث حالة', 'تحديث تجهيز'];
handler.command = ['تحديث', 'مزامنة', 'رفع', 'sync', 'push'];
handler.category = 'owner';
handler.owner = true;

export default handler;
