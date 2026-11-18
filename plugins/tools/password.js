/*
  ═══════════════════════════════════════════
  🔐 مولد كلمة مرور قوية
  الأمر: .باسورد [طول] [رموز؟]
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, args }) => {
  try {
    const len = Math.min(Math.max(parseInt(args[0]) || 16, 8), 64)
    const symbols = args[1] !== 'لا' && args[1] !== 'no'
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const sym = '!@#$%^&*_-+='
    let pool = upper + lower + digits + (symbols ? sym : '')
    let pwd = ''
    // ضمان تنوع
    pwd += upper[Math.floor(Math.random() * upper.length)]
    pwd += lower[Math.floor(Math.random() * lower.length)]
    pwd += digits[Math.floor(Math.random() * digits.length)]
    if (symbols) pwd += sym[Math.floor(Math.random() * sym.length)]
    for (let i = pwd.length; i < len; i++) pwd += pool[Math.floor(Math.random() * pool.length)]
    // خلط
    pwd = pwd.split('').sort(() => Math.random() - 0.5).join('')
    const strength = len >= 20 ? '🔒 قوي جداً' : len >= 16 ? '🔐 قوي' : len >= 12 ? '🔓 متوسط' : '⚠️ ضعيف'
    await m.reply(`🔐 *كلمة مرور جديدة:*\n\`${pwd}\`\n\n${strength} | ${len} حرف${symbols ? ' + رموز' : ''}\n⚠️ *لا تشاركها مع أحد*`)
  } catch (e) {
    console.error('password-gen:', e)
    m.reply('❌ خطأ')
  }
}

handler.command = ['باسورد', 'password', 'passgen']
handler.usage = ['باسورد', 'باسورد 20', 'باسورد 16 لا']
handler.category = 'tools'
export default handler