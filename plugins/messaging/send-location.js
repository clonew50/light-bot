/*
  ═══════════════════════════════════════════
  📍 إرسال الموقع — Location Messages
  الأمر: .موقع <خط_العرض> <خط_الطول> [عنوان]
  .موقع_هنا (يرسل موقع عشوائي للاختبار)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (command === 'موقع_هنا' || command === 'location_here') {
      // موقع عشوائي في القاهرة للاختبار
      const lat = 30.0444 + (Math.random() - 0.5) * 0.1
      const lon = 31.2357 + (Math.random() - 0.5) * 0.1
      await conn.sendMessage(m.chat, {
        location: {
          degreesLatitude: lat,
          degreesLongitude: lon
        }
      })
      return m.reply(`📍 تم إرسال موقع تجريبي: ${lat.toFixed(4)}, ${lon.toFixed(4)}`)
    }

    const parts = text.trim().split(' ')
    if (parts.length < 2) {
      return m.reply('📍 الاستخدام: .موقع 30.0444 31.2357 عنوان_المكان')
    }

    const lat = parseFloat(parts[0])
    const lon = parseFloat(parts[1])
    const address = parts.slice(2).join(' ') || 'موقع مشترك'

    if (isNaN(lat) || isNaN(lon)) return m.reply('❌ إحداثيات غير صالحة')
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return m.reply('❌ إحداثيات خارج النطاق')

    await conn.sendMessage(m.chat, {
      location: {
        degreesLatitude: lat,
        degreesLongitude: lon,
        address
      }
    })
  } catch (e) {
    console.error('location:', e)
    m.reply('❌ فشل إرسال الموقع')
  }
}

handler.command = ['موقع', 'location', 'موقع_هنا', 'location_here']
handler.usage = ['موقع 30.0444 31.2357 القاهرة', 'موقع_هنا']
handler.category = 'messaging'
handler.description = 'إرسال موقع جغرافي (خط عرض، خط طول)'
export default handler