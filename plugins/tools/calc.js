/*
  ═══════════════════════════════════════════
  🧮 آلة حاسبة بسيطة — تعبيرات رياضية آمنة
  الأمر: .حسب <تعبير>
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text }) => {
  try {
    if (!text) return m.reply('🧮 اكتب عملية حسابية:\n.حسب 2 + 3 * 4\n.حسب (100 / 5) + 10')
    // تعبير آمن: أرقام، عمليات، أقواس، مسافات، نقاط عشرية فقط
    if (!/^[\d\s+\-*/().%]+$/.test(text)) return m.reply('❌ تعبير غير مسموح (أرقام وعمليات فقط)')
    // eval آمن للتعبيرات الحسابية البسيطة
    const result = Function('"use strict"; return (' + text + ')')()
    if (!Number.isFinite(result)) return m.reply('❌ نتيجة غير صالحة (قسمة على صفر؟)')
    const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(6))
    await m.reply(`🧮 *الحساب:* ${text}\n✅ *النتيجة:* ${formatted}`)
  } catch (e) {
    console.error('calc:', e)
    m.reply('❌ تعبير خاطئ')
  }
}

handler.command = ['حسب', 'calc', 'حساب']
handler.usage = ['حسب 2+3*4', 'حسب (100/5)+10', 'حسب 2^3 (لا يعمل، استخدم ** في JS)']
handler.category = 'tools'
export default handler