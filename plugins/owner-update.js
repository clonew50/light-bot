/**
 * plugins/owner-update.js — أمر التحديث (المالك فقط)
 * ==================================================
 * الأوامر: .update / .تحديث
 * بيفحص التحديثات من الريبو (system/autoUpdate.mjs) ويطبّقها.
 * بعد التطبيق بيعمل إعادة تشغيل كاملة نظيفة لتطبيق الكود الجديد.
 */
import { checkUpdate, applyUpdate } from '../system/autoUpdate.mjs';

const handler = async (m, { conn }) => {
	const send = (text) => conn.sendMessage(m.chat, { text }, { quoted: m }).catch(() => {});

	await send('🔄 جاري فحص التحديثات من الريبو...');

	let chk;
	try {
		chk = await checkUpdate();
	} catch (e) {
		return send('⚠️ تعذّر الفحص: ' + (e && e.message));
	}
	if (chk.error) return send('⚠️ تعذّر الفحص: ' + chk.error);
	if (chk.upToDate) return send('✅ لا يوجد تحديث — أنت على آخر نسخة من الريبو.');

	const bits = [`⬇️ تحديث متاح: ${chk.download.length} ملف`];
	if (chk.deleted && chk.deleted.length) bits.push(`إزالة ${chk.deleted.length}`);
	await send(bits.join(' · ') + '\n\nجاري التطبيق وإعادة التشغيل...');

	// نطبّق في الخلفية عشان رسالة "جاري التطبيق" توصل قبل إعادة التشغيل
	setTimeout(async () => {
		try {
			await applyUpdate({
				log: (t) => send(t),
				event: (t) => send('📣 ' + t),
				delayMs: 1500,
			});
		} catch (e) {
			send('⚠️ فشل التحديث: ' + (e && e.message));
		}
	}, 600);
};

handler.help = ['update'];
handler.tags = ['owner'];
handler.command = ['update', 'تحديث'];
handler.owner = true;

export default handler;