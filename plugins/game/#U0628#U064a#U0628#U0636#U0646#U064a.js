// بلوجن: بيبضني – يختار عضوين عشوائيين من المجموعة ويذكرهم
// الفئة: games
// لا يحتاج أي إعدادات خاصة، فقط يجب أن يكون البوت مشرفًا في المجموعة

const toM = a => '@' + a.split('@')[0];

/**
 * handler
 * @param {Object} m   رسالة الواتساب الواردة
 * @param {Object} ctx سياق التنفيذ (conn, args …)
 */
const handler = async (m, { conn }) => {
  // التأكد أن الأمر يُستَخدم داخل مجموعة
  if (!m.isGroup) return m.reply('هذا الأمر يعمل فقط في المجموعات');

  try {
    // جلب معلومات المجموعة (participants)
    const groupMetadata = await conn.groupMetadata(m.chat);
    if (!groupMetadata || !Array.isArray(groupMetadata.participants)) {
      throw new Error('groupMetadata غير متوفر أو لا يحتوي على participants');
    }
    const participants = groupMetadata.participants.map(p => p.id);
    if (participants.length < 2) return m.reply('المجموعة تحتاج إلى عضوين على الأقل');

    // اختيار عضوين عشوائيين مختلفين
    const a = participants.getRandom();
    let b;
    do {
      b = participants.getRandom();
    } while (b === a);

    const resultText = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*⚔️ ┇ أكـثـر واحـد هـنـا بـيـبـيـض عـلـيـك:* \n\n➤ ${toM(a)}\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

    // إرسال النتيجة مع المنشن للعضوين
    await conn.sendMessage(m.chat, {
      text: resultText,
      mentions: [a, b]
    }, { quoted: m });
  } catch (e) {
    console.error('[بيبضني] error:', e);
    m.reply('❌ حدث خطأ أثناء تنفيذ الأمر. تأكد أن البوت مشرف في المجموعة ويمكنه قراءة الأعضاء.');
  }
};

// إضافة دالة عشوائية للمصفوفة إذا لم تكن موجودة مسبقًا
if (!Array.prototype.getRandom) {
  Array.prototype.getRandom = function () {
    return this[Math.floor(Math.random() * this.length)];
  };
}

handler.command = ['بيبضني'];
handler.usage = ['بيبضني'];
handler.category = 'games';
handler.group = true; // يوضح أن الأمر مخصص للمجموعات
export default handler;