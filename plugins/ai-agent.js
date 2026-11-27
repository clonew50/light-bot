import { runAiAgent, isBotGeneratedMessage } from '../lib/aiAgent.js';

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
	const { conn, text, usedPrefix, command, isAdmin, isOwner } = extra;
	const trimmed = String(text || '').trim();
	const chat = getChatRecord(m.chat);

	// 1. Toggle mode when called without text/quote, or with explicit on/off keywords
	const isExplicitOn = /^(on|enable|تفعيل|تشغيل|فتح|1)$/i.test(trimmed);
	const isExplicitOff = /^(off|disable|تعطيل|ايقاف|إيقاف|قفل|0)$/i.test(trimmed);
	const isBareToggle = !trimmed && !m.quoted?.text;

	if (isBareToggle || isExplicitOn || isExplicitOff) {
		if (m.isGroup && !(isAdmin || isOwner)) {
			if (typeof global.dfail === 'function') {
				return global.dfail('admin', m, conn);
			}
			return m.reply('❌ تشغيل أو إيقاف وضع الذكاء الاصطناعي في الجروب متاح للمشرفين فقط.');
		}

		const nextState = isExplicitOn ? true : isExplicitOff ? false : !chat.aiAgent;
		chat.aiAgent = nextState;

		if (nextState) {
			return m.reply(
				`🤖 *تم تفعيل وضع الوكيل الذكي في هذا الشات!*\n` +
					`اكتب أي طلب مباشرة من غير ما تكتب أمر، وأنا هفهمه وأشغله لك تلقائياً.\n\n` +
					`• لإيقاف الوضع اكتب: *${usedPrefix + command}*\n` +
					`• لمسح الذاكرة اكتب: *${usedPrefix + command} reset*`
			);
		}
		return m.reply(`🛑 *تم إيقاف وضع الوكيل الذكي في هذا الشات.*\nلتشغيله مرة تانية اكتب: *${usedPrefix + command}*`);
	}

	// 2. One-shot prompt mode when called with direct text or quoted message
	const prompt = trimmed || String(m.quoted?.text || '').trim();
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
};

handler.before = async function (m, extra) {
	if (!m || m.isBaileys) return false;
	const text = typeof m.text === 'string' ? m.text.trim() : '';
	if (!text) return false;

	// Never intercept bot commands or owner-exec lines (so .ai, .menu, .ping, > ... still work normally)
	if (extra?.match?.[0]?.[0] || /^=?>\s/.test(text)) return false;

	const chat = global.db?.data?.chats?.[m.chat];
	if (!chat?.aiAgent) return false;

	// Never reply to another bot's message — prevents bot-to-bot echo loops in the group.
	if (isBotGeneratedMessage(m, this)) return false;

	const msgId = m.key?.id;
	if (msgId && handledAutoMsgIds.has(msgId)) return false;
	trackHandledMessage(msgId);

	try {
		await this.sendMessage(m.chat, { react: { text: '🤖', key: m.key } }).catch(() => {});
		const result = await runAiAgent(text, m, { ...extra, conn: this, sock: this });
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

handler.help = ['ai (تفعيل/إيقاف)', 'ai <طلب>', 'ذكي', 'وكيل', 'مساعد'];
handler.tags = ['ai', 'tools'];
handler.command = /^(ai|agent|aiagent|ذكاء|ذكي|وكيل|مساعد)$/i;

export default handler;
