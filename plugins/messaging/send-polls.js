/*
  ═══════════════════════════════════════════
  📊 استطلاعات الرأي — Polls
  الأمر: .استطلاع <سؤال> | <خيار1> | <خيار2> | ...
  .استطلاع_متعدد <سؤال> | <خيار1> | <خيار2> | ... | <عدد_الاختيارات>
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!text) {
      return m.reply(
        '📊 الاستخدام:\n' +
        '.استطلاع ما أفضل لغة؟ | Python | JavaScript | Go\n' +
        '.استطلاع_متعدد اختر لونين | أحمر | أزرق | أخضر | أصفر | 2'
      )
    }

    const parts = text.split('|').map(p => p.trim())
    if (parts.length < 3) return m.reply('❌ تحتاج لسؤال وخيارين على الأقل')

    const name = parts[0]
    const values = parts.slice(1, -1).filter(v => v)
    const lastPart = parts[parts.length - 1].trim()

    let selectableCount = 1
    if (command === 'استطلاع_متعدد' || command === 'استطلاع_متعدد_اختيارات') {
      const num = parseInt(lastPart)
      if (!isNaN(num) && num > 0 && num <= values.length) {
        selectableCount = num
      } else {
        values.push(lastPart)
      }
    } else {
      values.push(lastPart)
    }

    if (values.length < 2) return m.reply('❌ تحتاج لخيارين على الأقل')
    if (selectableCount > values.length) selectableCount = values.length

    await conn.sendMessage(m.chat, {
      poll: {
        name,
        values,
        selectableCount,
        toAnnouncementGroup: false
      }
    })
  } catch (e) {
    console.error('polls:', e)
    m.reply('❌ فشل إنشاء الاستطلاع')
  }
}

handler.command = ['استطلاع_رأي', 'poll_create', 'استطلاع_متعدد_اختيارات', 'poll_multi_create']
handler.usage = ['استطلاع ما تفضل؟ | خيار1 | خيار2', 'استطلاع_متعدد اختر 2 | أ | ب | ج | 2']
handler.category = 'messaging'
handler.description = 'إنشاء استطلاعات رأي (Poll) مع دعم الاختيار المتعدد'
export default handler