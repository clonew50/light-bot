// plugins/owner/maintenance.js
import { updateMainBotSettings, getMainBotSettings } from '../../system/botRegistry.js';

const handler = async (m, { conn, args, client }) => {
  if (!m.isOwner) {
    return m.reply('❌ هذا الأمر مخصص للمطور/الأدمن فقط.');
  }

  const currentSettings = getMainBotSettings(client);
  const isCurrentActive = Boolean(global.db?.maintenance ?? currentSettings?.maintenance);

  let nextState = !isCurrentActive;
  const sub = (args[0] || '').toLowerCase().trim();

  if (['تشغيل', 'تفعيل', 'on', '1', 'قفل'].includes(sub)) {
    nextState = true;
  } else if (['ايقاف', 'إيقاف', 'تعطيل', 'off', '0', 'فتح'].includes(sub)) {
    nextState = false;
  }

  if (global.db) {
    global.db.maintenance = nextState;
  }
  updateMainBotSettings(client, { maintenance: nextState });

  if (nextState) {
    return m.reply(
      `🛠️ *تم تفعيل وضع الصيانة بنجاح!*\n\n` +
      `• تم إغلاق الموقع أمام الزوار وتظهر لهم الآن شاشة الصيانة اللطيفة.\n` +
      `• يمكنك الدخول للوحة التحكم في أي وقت من زر "دخول الإدارة" في شاشة الصيانة.\n` +
      `• لإلغاء الصيانة لاحقاً: أرسل *.صيانة إيقاف* أو ألغها من لوحة التحكم.`
    );
  } else {
    return m.reply(
      `✅ *تم إيقاف وضع الصيانة وفتح الموقع!*\n\n` +
      `• الموقع متاح الآن للجميع بشكل طبيعي، وتم تحديث الصفحات تلقائياً للزوار.\n` +
      `• لتفعيل الصيانة مجدداً: أرسل *.صيانة تشغيل*.`
    );
  }
};

handler.help = ['صيانة'];
handler.usage = ['صيانة'];
handler.category = 'owner';
handler.owner = true;
handler.command = ['صيانة', 'maintenance', 'وضع-الصيانة'];

export default handler;
