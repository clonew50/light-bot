import { runAiAgent, isBotGeneratedMessage, clearAiAgentMemory } from '../lib/aiAgent.js';

// الأمر الأساسي المعروض للمستخدم (نصي،不是 regex) لتفادي طباعة الـ regex في الرسائل.
const PRIMARY_TRIGGER = 'ai';

const handledAutoMsgIds = new Set();
function trackHandledMessage(msgId) {
	if (!msgId) return;
	handledAutoMsgIds.add(msgId);
	if (handledAutoMsgIds.size > 500) {
		const oldest = handledAutoMsgIds.values().next().value;
		handledAutoMsgIds.delete(oldest);
	}
}

function getChatRecord(chatId) {
	if (!global.db) global.db = { data: {} };
	if (!global.db.data) global.db.data = {};
	if (!global.db.data.chats) global.db.data.chats = {};
	if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {};
	return global.db.data.chats[chatId];
}

const handler = async (m, extra) => {
	const { conn, text, usedPrefix, isAdmin, isOwner } = extra;
	const trimmed = String(text || '').trim();
	const chat = getChatRecord(m.chat);

	// 1. وضع التشغيل/الإيقاف عند استدعاء بدون نص/اقتباس، أو بمفاتيح التشغيل/الإيقاف/المسح.
	const isExplicitOn = /^(on|enable|تفعيل|تشغيل|فتح|1)$/i.test(trimmed);
	const isExplicitOff = /^(off|disable|تعطيل|ايقاف|إيقاف|قفل|0)$/i.test(trimmed);
	const isReset = /^(reset|clear|مسح|تصفير)$/i.test(trimmed);
	const isBareToggle = !trimmed && !m.quoted?.text;

	if (isBareToggle || isExplicitOn || isExplicitOff || isReset) {
		if (m.isGroup && !(isAdmin || isOwner)) {
			if (typeof global.dfail === 'function') {
				return global.dfail('admin', m, conn);
			}
			return m.reply('❌ تشغيل أو إيقاف وضع الذكاء الاصطناعي في الجروب متاح للمشرفين فقط.');
		}

		if (isReset) {
			clearAiAgentMemory(m.chat, m.sender);
			chat.aiAgent = false;
			return m.reply('🗑️ *تم مسح ذاكرة الوكيل الذكي وإيقاف الوضع في هذا الشات.*');
		}

		const nextState = isExplicitOn ? true : isExplicitOff ? false : !chat.aiAgent;
		chat.aiAgent = nextState;

		const trig = `${usedPrefix || '.'}${PRIMARY_TRIGGER}`;
		if (nextState) {
			return m.reply(
				`🤖 *تم تفعيل وضع الوكيل الذكي في هذا الشات!*\n` +
				`اكتب أي طلب مباشرة من غير ما تكتب أمر، وأنا هفهمه وأشغله لك تلقائياً.\n\n` +
				`• لإيقاف الوضع اكتب: *${trig}*\n` +
				`• لمسح الذاكرة اكتب: *${trig} reset*`
			);
		}
		return m.reply(`🛑 *تم إيقاف وضع الوكيل الذكي في هذا الشات.*\nلتشغيله مرة تانية اكتب: *${trig}*`);
	}

	// 2. طلب واحد (مباشر أو عبر رد على رسالة).
	const prompt = trimmed || String(m.quoted?.text || '').trim();
	if (!prompt) return false;

	try {
		await conn.sendMessage(m.chat, { react: { text: '🤖', key: m.key } }).catch(() => {});
		const result = await runAiAgent(prompt, m, extra);
		if (result?.text) {
			await m.reply(result.text);
		}
		await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
	} catch (err) {
		console.error('[AI-AGENT]', err);
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		const msg = err?.message || String(err);
		await m.reply(`⚠️ تعذر تنفيذ الطلب بالوكيل الذكي:\n${msg}`);
	}

	return true;
};

handler.before = async function (m, extra) {
	if (!m || m.isBaileys) return false;
	const text = typeof m.text === 'string' ? m.text.trim() : '';
	if (!text) return false;

	// لا نعترض الأوامر prefixes (مثل .ai، .menu، .ping، > ...) حتى تُكمل سيرها الطبيعي.
	// match[0][0] هو أول مجموعة capturing من exec؛ لو فاضي/Null فالرسالة ليست أمر.
	if (extra?.match?.[0]?.[0]) return false;
	if (/^=?>\s/.test(text)) return false;

	const chat = global.db?.data?.chats?.[m.chat];
	if (!chat?.aiAgent) return false;

	// لا تُرد على رسالة لبوت آخر — يمنع حلقات الصدى بين البوتات في الجروب.
	try {
		if (isBotGeneratedMessage(m, this)) return false;
	} catch {}

	const msgId = m.key?.id;
	if (msgId && handledAutoMsgIds.has(msgId)) return false;
	trackHandledMessage(msgId);

	try {
		const result = await runAiAgent(text, m, { ...extra, conn: this, sock: this }, { maxTurns: 4 });
		if (result?.text) {
			await m.reply(result.text);
		}
		await this.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
	} catch (err) {
		console.error('[AI-AGENT:AUTO]', err);
		await this.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
		await m.reply(`⚠️ حصل خطأ في الوكيل الذكي:\n${err?.message || err}`);
	}

	return true;
};

handler.help = ['ai (تفعيل/إيقاف/مسح)', 'ai <طلب>', 'ذكي', 'وكيل', 'مساعد'];
handler.tags = ['ai', 'tools'];
handler.command = new RegExp(`^(ai|agent|aiagent|ذكاء|ذكي|وكيل|مساعد)$`, 'i');

export default handler;
