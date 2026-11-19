/*
  ═══════════════════════════════════════════
  🎯 اختيار عشوائي — من قائمة مفصولة بفواصل
  الأمر: .اختر <خيار1>, <خيار2>, ...
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text }) => {
  try {
    if (!text) return m.reply('📝 اكتب الخيارات مفصولة بفواصل:\n.اختر بيتزا, برجر, مكرونة')
    const items = text.split(',').map(s => s.trim()).filter(Boolean)
    if (items.length < 2) return m.reply('❌ تحتاج خيارين على الأقل')
    const pick = items[Math.floor(Math.random() * items.length)]
    const idx = items.indexOf(pick) + 1
    await m.reply(`🎯 *اختيارك:* ${pick}\n📋 *الخيار رقم:* ${idx} من ${items.length}`)
  } catch (e) {
    console.error('pick:', e)
    m.reply('❌ خطأ')
  }
}

handler.command = ['pick', 'choose', 'اختار']
handler.usage = ['اختار خيار1, خيار2, خيار3']
handler.category = 'tools'
export default handler