/*
  ═══════════════════════════════════════════
  😀 ردود الفعل — Reactions
  الأمر: .تفاعل <إيموجي> | .إزالة_تفاعل
  (يجب الرد على رسالة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.quoted) return m.reply('📎 يجب الرد على رسالة لإضافة/إزالة تفاعل')

    const key = m.quoted.key

    if (command === 'إزالة_تفاعل' || command === 'ازالة_تفاعل') {
      await conn.sendMessage(m.chat, { react: { text: '', key } })
      return m.reply('✅ تم إزالة التفاعل')
    }

    const emoji = text.trim()
    if (!emoji) return m.reply('😀 اكتب الإيموجي: .تفاعل 👍\n🗑️ للإزالة: .إزالة_تفاعل')

    await conn.sendMessage(m.chat, { react: { text: emoji, key } })
  } catch (e) {
    console.error('reactions:', e)
    m.reply('❌ فشل إضافة التفاعل')
  }
}

handler.command = ['تفاعل', 'react', 'إزالة_تفاعل', 'ازالة_تفاعل', 'unreact']
handler.usage = ['تفاعل 👍', 'تفاعل ❤️', 'إزالة_تفاعل']
handler.category = 'messaging'
handler.description = 'إضافة أو إزالة ردود الفعل (Reactions) على الرسائل'
export default handler