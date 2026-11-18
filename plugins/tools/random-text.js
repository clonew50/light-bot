/*
  ═══════════════════════════════════════════
  🔤 مولد نص عشوائي — حروف/أرقام/رموز
  الأمر: .نص <طول> [نوع]
  الأنواع: all | alpha | numeric | alphanum | hex
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, args }) => {
  try {
    const len = parseInt(args[0]) || 16
    if (len < 1 || len > 200) return m.reply('❌ الطول 1–200')
    const type = (args[1] || 'alphanum').toLowerCase()
    const pools = {
      all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
      alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      alphanum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      hex: '0123456789abcdef'
    }
    const pool = pools[type] || pools.alphanum
    let out = ''
    for (let i = 0; i < len; i++) out += pool[Math.floor(Math.random() * pool.length)]
    await m.reply(`🔤 *نص عشوائي (${type}, ${len} حرف):*\n\`${out}\``)
  } catch (e) {
    console.error('random-text:', e)
    m.reply('❌ خطأ')
  }
}

handler.command = ['نص', 'random', 'randstr']
handler.usage = ['نص 10', 'نص 32 hex', 'نص 50 all']
handler.category = 'tools'
export default handler