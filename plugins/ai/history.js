/*
  ═══════════════════════════════════════════
  📜 سجل محادثات AI — عرض/مسح/تصدير
  الأمر: .history / .سجل / .محادثات
  ═══════════════════════════════════════════
*/
import fs from 'fs';
import path from 'path';

const HISTORY_DIR = './database/ai_history/';
const MAX_HISTORY = 50;

function ensureDir() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function getUserFile(sender) {
  const safe = String(sender || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(HISTORY_DIR, `${safe}.json`);
}

export function loadHistory(sender) {
  ensureDir();
  const file = getUserFile(sender);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(sender, history) {
  ensureDir();
  const file = getUserFile(sender);
  fs.writeFileSync(file, JSON.stringify(history.slice(-MAX_HISTORY), null, 2));
}

export function addMessage(sender, role, content, meta = {}) {
  const history = loadHistory(sender);
  history.push({ role, content: String(content || ''), timestamp: Date.now(), ...meta });
  saveHistory(sender, history);
}

export function clearHistory(sender) {
  const file = getUserFile(sender);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function formatHistory(history, limit = 20) {
  return history.slice(-limit).map((h, i) => {
    const time = new Date(h.timestamp).toLocaleTimeString('ar-EG');
    const label = h.role === 'user' ? '👤 أنت' : '🤖 AI';
    const meta = h.persona ? ` [${h.persona}]` : '';
    const model = h.model ? ` (${h.model})` : '';
    return `${i + 1}. ${label}${meta}${model} • ${time}\n${h.content.slice(0, 200)}${h.content.length > 200 ? '...' : ''}`;
  }).join('\n\n');
}

const handler = async (m, { conn, args, usedPrefix = '.' }) => {
  try {
    const subCmd = args[0]?.toLowerCase();
    const history = loadHistory(m.sender);

    if (!subCmd || subCmd === 'عرض' || subCmd === 'show' || subCmd === 'list') {
      const limit = parseInt(args[1], 10) || 20;
      if (!history.length) return m.reply('📭 السجل فارغ');
      const formatted = formatHistory(history, limit);
      return m.reply(`📜 *آخر ${Math.min(limit, history.length)} رسالة:*\n\n${formatted}`);
    }

    if (subCmd === 'مسح' || subCmd === 'clear' || subCmd === 'delete') {
      const confirm = args[1];
      if (confirm !== 'تأكيد' && confirm !== 'yes') {
        return m.reply(`⚠️ لمسح السجل نهائياً:\n\`${usedPrefix}history مسح تأكيد\``);
      }
      clearHistory(m.sender);
      return m.reply('🗑️ تم مسح السجل بالكامل');
    }

    if (subCmd === 'تصدير' || subCmd === 'export') {
      if (!history.length) return m.reply('📭 لا يوجد سجل للتصدير');
      const json = JSON.stringify(history, null, 2);
      const txt = history.map((h) => {
        const time = new Date(h.timestamp).toLocaleString('ar-EG');
        const label = h.role === 'user' ? '👤 أنت' : '🤖 AI';
        return `[${time}] ${label}${h.persona ? ` [${h.persona}]` : ''}${h.model ? ` (${h.model})` : ''}:\n${h.content}\n`;
      }).join('\n---\n');
      await conn.sendMessage(m.chat, {
        document: Buffer.from(txt),
        mimetype: 'text/plain',
        fileName: `ai_history_${Date.now()}.txt`,
        caption: `📜 *سجل محادثات AI (نصي)*\n${history.length} رسالة`
      }, { quoted: m });
      await conn.sendMessage(m.chat, {
        document: Buffer.from(json),
        mimetype: 'application/json',
        fileName: `ai_history_${Date.now()}.json`,
        caption: `📜 *سجل محادثات AI (JSON)*\n${history.length} رسالة`
      }, { quoted: m });
      return;
    }

    if (subCmd === 'إحصائيات' || subCmd === 'احصائيات' || subCmd === 'stats') {
      const userMsgs = history.filter((h) => h.role === 'user').length;
      const aiMsgs = history.filter((h) => h.role === 'assistant').length;
      const totalChars = history.reduce((s, h) => s + String(h.content || '').length, 0);
      const personas = [...new Set(history.map((h) => h.persona).filter(Boolean))];
      const models = [...new Set(history.map((h) => h.model).filter(Boolean))];
      const first = history[0] ? new Date(history[0].timestamp).toLocaleDateString('ar-EG') : '—';
      const last = history[history.length - 1] ? new Date(history[history.length - 1].timestamp).toLocaleDateString('ar-EG') : '—';
      return m.reply(
        `📊 *إحصائيات السجل:*\n\n` +
        `💬 رسائلك: ${userMsgs}\n` +
        `🤖 ردود AI: ${aiMsgs}\n` +
        `📝 إجمالي الأحرف: ${totalChars.toLocaleString()}\n` +
        `🎭 شخصيات مستخدمة: ${personas.length || '—'}\n` +
        `🧠 نماذج مستخدمة: ${models.length || '—'}\n` +
        `📅 أول رسالة: ${first}\n` +
        `📅 آخر رسالة: ${last}`
      );
    }

    if (subCmd === 'بحث' || subCmd === 'search') {
      const q = args.slice(1).join(' ').toLowerCase();
      if (!q) return m.reply(`❌ اكتب كلمة بحث: \`${usedPrefix}history بحث كلمة\``);
      const results = history.filter((h) => String(h.content || '').toLowerCase().includes(q));
      if (!results.length) return m.reply('🔍 لا نتائج');
      const shown = results.slice(-10).map((h, i) => {
        const time = new Date(h.timestamp).toLocaleTimeString('ar-EG');
        const label = h.role === 'user' ? '👤' : '🤖';
        return `${i + 1}. ${label} ${time}\n${h.content.slice(0, 150)}...`;
      }).join('\n\n');
      return m.reply(`🔍 *نتائج البحث عن "${q}" (${results.length}):*\n\n${shown}`);
    }

    return conn.sendMessage(m.chat, {
      text: `📜 *إدارة سجل المحادثات:*\n${history.length} رسالة محفوظة`,
      footer: 'LIGHT BOT • History',
      buttons: [
        { name: 'quick_reply', params: { display_text: '📜 عرض', id: `${usedPrefix}history عرض 20` } },
        { name: 'quick_reply', params: { display_text: '📊 إحصائيات', id: `${usedPrefix}history إحصائيات` } },
        { name: 'quick_reply', params: { display_text: '📤 تصدير', id: `${usedPrefix}history تصدير` } },
        { name: 'quick_reply', params: { display_text: '🗑️ مسح', id: `${usedPrefix}history مسح تأكيد` } }
      ]
    }, { quoted: m });
  } catch (e) {
    console.error('history:', e?.message || e);
    return m.reply('❌ حدث خطأ أثناء قراءة السجل');
  }
};

handler.command = ['history', 'سجل', 'محادثات'];
handler.usage = ['history', 'history عرض [عدد]', 'history مسح تأكيد', 'history تصدير', 'history إحصائيات', 'history بحث <كلمة>'];
handler.category = 'ai';
handler.cooldown = 3;
export default handler;