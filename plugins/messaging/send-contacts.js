/*
  ═══════════════════════════════════════════
  👤 إرسال جهات الاتصال — Contact Messages (vCard)
  الأمر: .جهة <رقم> <اسم> [منظمة] | .جهات <رقم1,اسم1> | <رقم2,اسم2> | ...
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!text) {
      return m.reply(
        '👤 الاستخدام:\n' +
        '.جهة 201001234567 أحمد شركة_أحمد\n' +
        '.جهات 201001234567,أحمد | 201009876543,سارة_شركة_سارة'
      )
    }

    const contacts = []

    if (command === 'جهات' || command === 'جهات_اتصال' || command === 'contacts') {
      // تنسيق: رقم,اسم | رقم,اسم | ...
      const entries = text.split('|').map(e => e.trim())
      for (const entry of entries) {
        const [phone, name, org] = entry.split(',').map(s => s.trim())
        if (!phone || !name) continue
        const cleanPhone = phone.replace(/[^0-9]/g, '')
        if (!/^\d{8,15}$/.test(cleanPhone)) continue
        const vcard = buildVCard(cleanPhone, name, org)
        contacts.push({ vcard })
      }
    } else {
      // تنسيق: رقم اسم [منظمة]
      const parts = text.split(' ')
      const phone = parts[0].replace(/[^0-9]/g, '')
      const name = parts[1] || 'جهة اتصال'
      const org = parts[2] || ''
      if (!/^\d{8,15}$/.test(phone)) return m.reply('❌ رقم غير صالح')
      const vcard = buildVCard(phone, name, org)
      contacts.push({ vcard })
    }

    if (!contacts.length) return m.reply('❌ لا توجد جهات اتصال صالحة')

    await conn.sendMessage(m.chat, {
      contacts: {
        displayName: contacts.length === 1 ? contacts[0].vcard.match(/FN:(.+)/)?.[1] || 'جهة اتصال' : `${contacts.length} جهة اتصال`,
        contacts
      }
    })
  } catch (e) {
    console.error('contacts:', e)
    m.reply('❌ فشل إرسال جهة الاتصال')
  }
}

function buildVCard(phone, name, org = '') {
  const waid = phone.startsWith('20') ? phone : phone // افتراض مصري، يمكن تعديله
  return (
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    `FN:${name}\n` +
    (org ? `ORG:${org};\n` : '') +
    `TEL;type=CELL;type=VOICE;waid=${waid}:+${phone}\n` +
    'END:VCARD'
  )
}

handler.command = ['جهة', 'contact', 'جهات', 'جهات_اتصال', 'contacts']
handler.usage = ['جهة 201001234567 أحمد', 'جهة 201001234567 أحمد شركة_أحمد', 'جهات 201001234567,أحمد | 201009876543,سارة']
handler.category = 'messaging'
handler.description = 'إرسال جهات اتصال بصيغة vCard (بطاقة اتصال)'
export default handler