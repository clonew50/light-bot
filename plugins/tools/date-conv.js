/*
  ═══════════════════════════════════════════
  📅 محول التاريخ — ميلادي ↔ هجري
  الأمر: .تاريخ [yyyy-mm-dd]
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, args }) => {
  try {
    const input = args[0] || new Date().toISOString().slice(0, 10)
    const [y, m, d] = input.split('-').map(Number)
    if (!y || !m || !d) return m.reply('❌ صيغة: yyyy-mm-dd (مثال: 2026-11-18)')
    const g = new Date(y, m - 1, d)
    const arMonths = ['محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة']
    // خوارزمية تقريبية للتقويم الهجري (مضبوطة ± يوم)
    const jd = Math.floor((g.getTime() / 86400000) + 2440587.5)
    const l = jd - 1948440 + 10632
    const n = Math.floor((l - 1) / 10631)
    const l2 = l - 10631 * n + 354
    const j = Math.floor((10985 - l2) / 5316) * Math.floor(50 * l2 / 17719) + Math.floor(l2 / 5670) * Math.floor(43 * l2 / 15238)
    const h = 30 * j + Math.floor((11 * j + 3) / 30)
    const hy = 30 * n + j - 30
    const hm = Math.floor((l2 - h) / 29.5) + 1
    const hd = l2 - Math.floor(29.5 * (hm - 1)) + 1
    const arDay = g.toLocaleDateString('ar-EG', { weekday: 'long' })
    await m.reply(
      `📅 *تحويل التاريخ*\n\n` +
      `🗓️ *ميلادي:* ${input} (${arDay})\n` +
      `☪️ *هجري:* ${hd} ${arMonths[hm-1]} ${hy} هـ`
    )
  } catch (e) {
    console.error('date-conv:', e)
    m.reply('❌ خطأ في التحويل')
  }
}

handler.command = ['تاريخ', 'date', 'hijri']
handler.usage = ['تاريخ', 'تاريخ 2026-11-18']
handler.category = 'tools'
export default handler