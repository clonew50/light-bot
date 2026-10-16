import { pullOnce, checkUpdate, syncOnce, initState, getStatus } from '../../system/autoSync.mjs';

const PULL_CMDS = ['تحديث', 'دونلود', 'pull', 'update'];
const PUSH_CMDS = ['رفع', 'مزامنة', 'sync', 'push'];

let handler = async (m, { conn, text, command }) => {
  const cmd = (command || '').toLowerCase();
  const arg = (text || '').trim().toLowerCase();
  const isPush = PUSH_CMDS.includes(cmd);

  // ============ رفع (local → GitHub) ============
  if (isPush) {
    if (['حالة', 'status'].includes(arg)) {
      const s = getStatus();
      if (!s.ready) return m.reply('ℹ️ مفيش حالة رفع لسه. ابعت `.رفع تجهيز` الأول.');
      const lines = [`📤 *حالة الرفع*`, `تعديلات معلّقة: *${s.changed.length}* | محذوف: *${s.deleted.length}*`];
      lines.push('', ...s.changed.slice(0, 15).map((p) => `✏️ ${p}`));
      lines.push('', ...s.deleted.slice(0, 15).map((p) => `🗑️ ${p}`));
      return m.reply(lines.join('\n'));
    }
    if (['تجهيز', 'init'].includes(arg)) {
      await m.reply('⏳ جاري التجهيز...');
      const r = await initState({ log: () => {} });
      if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One (ONE_SECRET أو system/one-config.json).');
      if (r.error) return m.reply(`❌ فشل: ${r.error}`);
      return m.reply(`✅ تم التجهيز — ${r.files} ملف.`);
    }
    await m.reply('⏳ جاري رفع التعديلات على GitHub...');
    const r = await syncOnce({ quiet: true, log: () => {} });
    if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One.');
    if (r.error === 'busy') return m.reply('⏳ في عملية شغّالة، استنى ثانية.');
    if (r.error) return m.reply(`❌ فشل الرفع: ${r.error}`);
    if (!r.changes) return m.reply('✅ الريبو متزامن — مفيش تغييرات للرفع.');
    return m.reply(`✅ تم رفع *${r.changes}* تغيير\n${r.url}`);
  }

  // ============ تحديث (GitHub → local) ============
  if (['حالة', 'status', 'فحص'].includes(arg)) {
    const r = await checkUpdate();
    if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One.');
    if (r.error) return m.reply(`❌ فشل الفحص: ${r.error}`);
    if (r.upToDate) return m.reply('✅ انت على آخر نسخة من الريبو — مفيش تحديثات.');
    const lines = [
      `⬇️ *فيه تحديث متاح* (${r.download.length + r.deleted.length} ملف)`,
      `من كوميت: ${r.commit.slice(0, 8)}`,
      '',
      ...r.download.slice(0, 15).map((p) => `📥 ${p}`),
    ];
    if (r.deleted.length) lines.push('', ...r.deleted.slice(0, 15).map((p) => `🗑️ ${p}`));
    lines.push('', 'اكتب `.تحديث` عشان ينزّله.');
    return m.reply(lines.join('\n'));
  }

  await m.reply('⏳ جاري تنزيل تحديثات الريبو...');
  const r = await pullOnce({ log: () => {} });
  if (r.error === 'no-secret') return m.reply('❌ مفيش مفتاح One.');
  if (r.error) return m.reply(`❌ فشل التحديث: ${r.error}`);
  if (!r.changes) return m.reply('✅ انت على آخر نسخة من الريبو — مفيش تحديثات.');

  const lines = [
    `✅ تم تنزيل *${r.changes}* ملف من الريبو`,
    `كوميت: ${r.commit.slice(0, 8)}`,
    '',
    ...r.downloaded.slice(0, 15).map((p) => `📥 ${p}`),
    ...r.deleted.slice(0, 15).map((p) => `🗑️ ${p}`),
  ];
  if (r.needsRestart) lines.push('', '🔄 جاري إعادة التشغيل لتطبيق التحديث...');
  await m.reply(lines.join('\n'));

  if (r.needsRestart) {
    setTimeout(() => {
      if (global.restartBot) global.restartBot('تحديث من الريبو');
      else process.exit(0);
    }, 1500);
  }
};

handler.usage = ['تحديث', 'تحديث حالة', 'رفع', 'رفع حالة'];
handler.command = [...PULL_CMDS, ...PUSH_CMDS];
handler.category = 'owner';
handler.owner = true;

export default handler;
