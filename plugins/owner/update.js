import { pullOnce, checkUpdate } from '../../system/autoUpdate.mjs';

let handler = async (m, { conn, text, command }) => {
  const arg = (text || '').trim().toLowerCase();

  // .تحديث حالة  → عرض التحديثات المتاحة (من غير تنزيل)
  if (['حالة', 'status', 'فحص'].includes(arg)) {
    const r = await checkUpdate();
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

  // .تحديث  → تنزيل وتطبيق تحديثات الريبو
  await m.reply('⏳ جاري تنزيل تحديثات الريبو...');
  const r = await pullOnce({ log: () => {} });
  if (r.error) return m.reply(`❌ فشل التحديث: ${r.error}`);
  if (!r.changes) return m.reply('✅ انت على آخر نسخة من الريبو — مفيش تحديثات.');

  const lines = [
    `✅ تم تنزيل *${r.changes}* ملف من الريبو`,
    `كوميت: ${r.commit.slice(0, 8)}`,
    '',
    ...r.downloaded.slice(0, 15).map((p) => `📥 ${p}`),
    ...r.deleted.slice(0, 15).map((p) => `🗑️ ${p}`),
  ];
  if (r.needsInstall) lines.push('', '⚠️ `package.json` اتغيّر — شغّل `npm install` بعدين.');
  if (r.needsRestart) lines.push('', '🔄 جاري إعادة التشغيل لتطبيق التحديث...');
  await m.reply(lines.join('\n'));

  if (r.needsRestart) {
    setTimeout(() => {
      if (global.restartBot) global.restartBot('تحديث من الريبو');
      else process.exit(0);
    }, 1500);
  }
};

handler.usage = ['تحديث', 'تحديث حالة'];
handler.command = ['تحديث', 'دونلود', 'تحديثات', 'pull', 'update'];
handler.category = 'owner';
handler.owner = true;

export default handler;
