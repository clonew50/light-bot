/*
  ═══════════════════════════════════════════
  🎲 رمية نرد — 1-6 أو نطاق مخصص
  الأمر: .نرد [من] [إلى]
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, args }) => {
  try {
    let min = 1, max = 6
    if (args.length >= 1) min = parseInt(args[0]) || 1
    if (args.length >= 2) max = parseInt(args[1]) || 6
    if (min > max) [min, max] = [max, min]
    if (max - min > 10000) return m.reply('❌ النطاق كبير جداً (الحد 10000)')
    const roll = Math.floor(Math.random() * (max - min + 1)) + min
    const dice = ['⚀','⚁','⚂','⚃','⚄','⚅']
    const face = roll <= 6 ? dice[roll-1] : '🎲'
    await m.reply(`${face} *نتيجتك:* ${roll} (${min}–${max})`)
  } catch (e) {
    console.error('dice:', e)
    m.reply('❌ خطأ')
  }
}

handler.command = ['نرد', 'dice', 'roll']
handler.usage = ['نرد', 'نرد 1 10', 'نرد 1 100']
handler.category = 'games'
export default handler