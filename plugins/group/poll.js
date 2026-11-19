/*
  ═══════════════════════════════════════════
  📊 استطلاعات رأي — إنشاء/تصويت/نتائج
  الأمر: .poll / .استطلاع / .تصويت
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 3000
const MAX_OPTIONS = 10
const MAX_QUESTION_LEN = 256

if (!global.polls) global.polls = new Map()

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()
    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const chatPolls = global.polls.get(m.chat) || new Map()
    global.polls.set(m.chat, chatPolls)

    // إنشاء استطلاع
    if (!subCmd || subCmd === 'أنشئ' || subCmd === 'create') {
      // تنسيق: .poll "سؤال" "خيار1" "خيار2" ...
      const match = text?.match(/(?:أنشئ|create)?\s*"([^"]+)"(?:\s*"([^"]+)")+/)
      if (!match && !subCmd) {
        return conn.sendMessage(m.chat, {
          text: `📊 *إنشاء استطلاع رأي*\\n\\n` +
            `التنسيق:\\n` +
            `\`${usedPrefix}poll "سؤالك؟" "خيار 1" "خيار 2" "خيار 3"\`\\n\\n` +
            `مثال:\\n` +
            `\`${usedPrefix}poll "ما لغة البرمجة المفضلة؟" "JavaScript" "Python" "TypeScript" "Rust"\`\\n\\n` +
            `الحد الأقصى: ${MAX_OPTIONS} خيارات`,
          footer: 'LIGHT BOT • Poll',
          buttons: [
            { name: 'quick_reply', params: { display_text: '📊 استطلاعاتي', id: `${usedPrefix}poll قائمة` } },
            { name: 'quick_reply', params: { display_text: '🗑️ حذف الكل', id: `${usedPrefix}poll حذف_الكل` } }
          ]
        }, { quoted: m })
      }

      // استخراج السؤال والخيارات
      const regex = /"([^"]+)"/g
      const parts = []
      let m2
      while ((m2 = regex.exec(text)) !== null) {
        parts.push(m2[1])
      }

      if (parts.length < 3) return m.reply(`❌ تحتاج لسؤال + خيارين على الأقل (المجموع ${parts.length})`)
      if (parts.length > MAX_OPTIONS + 1) return m.reply(`❌ الحد الأقصى ${MAX_OPTIONS} خيارات`)

      const question = parts[0]
      const options = parts.slice(1)

      if (question.length > MAX_QUESTION_LEN) return m.reply(`❌ السؤال طويل جداً (الحد ${MAX_QUESTION_LEN} حرف)`)

      cooldown.set(sender, now)

      const pollId = `poll_${Date.now()}_${sender.split('@')[0]}`
      const poll = {
        id: pollId,
        question,
        options: options.map((opt, i) => ({ text: opt, votes: 0, voters: [] })),
        creator: sender,
        createdAt: now,
        endsAt: null, // لا ينتهي تلقائياً
        allowMultiple: false,
        anonymous: false
      }

      chatPolls.set(pollId, poll)

      // إرسال الاستطلاع
      const buttons = options.map((opt, i) => ({
        name: 'quick_reply',
        params: { display_text: `${i + 1}. ${opt.text}`, id: `.poll صوت ${pollId} ${i}` }
      }))

      await conn.sendMessage(m.chat, {
        text: `📊 *استطلاع رأي جديد!*\\n\\n❓ *${question}*\\n\\n` +
          options.map((opt, i) => `${i + 1}. ${opt.text}`).join('\\n') +
          `\\n\\n👤 بواسطة: @${sender.split('@')[0]}\\n` +
          `🆔 \`${pollId}\``,
        mentions: [sender],
        buttons: buttons.slice(0, 12) // حد الأزرار
      }, { quoted: m })

      return m.reply(`✅ تم إنشاء الاستطلاع!\\n🆔 المعرف: \`${pollId}\`\\nاستخدم \`.poll نتيجة ${pollId}\` لعرض النتائج`)

    }

    // التصويت
    if (subCmd === 'صوت' || subCmd === 'vote') {
      const pollId = args[1]
      const optionIndex = parseInt(args[2])

      if (!pollId || isNaN(optionIndex)) return m.reply('❌ الاستخدام: `.poll صوت <poll_id> <رقم_الخيار>`')

      const poll = chatPolls.get(pollId)
      if (!poll) return m.reply('❌ استطلاع غير موجود')
      if (optionIndex < 0 || optionIndex >= poll.options.length) return m.reply('❌ رقم خيار غير صحيح')

      // التحقق من التصويت المسبق
      const option = poll.options[optionIndex]
      if (option.voters.includes(sender)) {
        return m.reply('❌ لقد صوتت لهذا الخيار بالفعل!')
      }

      if (!poll.allowMultiple) {
        // إزالة تصويت سابق إن وجد
        poll.options.forEach(opt => {
          const idx = opt.voters.indexOf(sender)
          if (idx !== -1) {
            opt.votes--
            opt.voters.splice(idx, 1)
          }
        })
      }

      option.votes++
      option.voters.push(sender)

      await m.react('✅')
      return m.reply(`✅ تم تصويتك لـ: *${option.text}*`)

    }

    // عرض النتائج
    if (subCmd === 'نتيجة' || subCmd === 'نتائج' || subCmd === 'results') {
      const pollId = args[1]
      if (!pollId) {
        // عرض آخر استطلاع
        const polls = [...chatPolls.values()].sort((a, b) => b.createdAt - a.createdAt)
        if (!polls.length) return m.reply('📭 لا توجد استطلاعات')
        return showResults(m, polls[0])
      }
      const poll = chatPolls.get(pollId)
      if (!poll) return m.reply('❌ استطلاع غير موجود')
      return showResults(m, poll)
    }

    // قائمة الاستطلاعات
    if (subCmd === 'قائمة' || subCmd === 'list') {
      const polls = [...chatPolls.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)
      if (!polls.length) return m.reply('📭 لا توجد استطلاعات في هذه المجموعة')
      let msg = `📊 *استطلاعات المجموعة (${polls.length}):*\\n\\n`
      polls.forEach((p, i) => {
        const totalVotes = p.options.reduce((s, o) => s + o.votes, 0)
        msg += `${i + 1}. *${p.question.slice(0, 50)}*\\n`
        msg += `   🆔 \`${p.id}\` | 🗳️ ${totalVotes} تصويت | ${p.options.length} خيارات\\n\\n`
      })
      return m.reply(msg)
    }

    // إنهاء استطلاع
    if (subCmd === 'انهاء' || subCmd === 'end' || subCmd === 'close') {
      const pollId = args[1]
      if (!pollId) return m.reply('❌ حدد المعرف: `.poll انهاء <poll_id>`')
      const poll = chatPolls.get(pollId)
      if (!poll) return m.reply('❌ استطلاع غير موجود')
      if (poll.creator !== sender && !isAdmin) return m.reply('❌ فقط المنشئ أو الأدمن يمكنه إنهاء الاستطلاع')

      poll.ended = true
      poll.endsAt = now
      return showResults(m, poll, true)
    }

    // حذف استطلاع
    if (subCmd === 'احذف' || subCmd === 'delete') {
      const pollId = args[1]
      if (!pollId) return m.reply('❌ حدد المعرف')
      const poll = chatPolls.get(pollId)
      if (!poll) return m.reply('❌ استطلاع غير موجود')
      if (poll.creator !== sender && !isAdmin) return m.reply('❌ ليس لديك صلاحية')
      chatPolls.delete(pollId)
      return m.reply('🗑️ تم حذف الاستطلاع')
    }

    // حذف الكل
    if (subCmd === 'حذف_الكل' || subCmd === 'clear_all') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      const count = chatPolls.size
      chatPolls.clear()
      return m.reply(`🗑️ تم حذف ${count} استطلاع`)
    }

    // إعدادات استطلاع
    if (subCmd === 'إعدادات' || subCmd === 'settings') {
      const pollId = args[1]
      if (!pollId) return m.reply('❌ حدد المعرف')
      const poll = chatPolls.get(pollId)
      if (!poll) return m.reply('❌ استطلاع غير موجود')
      if (poll.creator !== sender && !isAdmin) return m.reply('❌ ليس لديك صلاحية')

      const setting = args[2]
      if (setting === 'متعدد' || setting === 'multiple') {
        poll.allowMultiple = !poll.allowMultiple
        return m.reply(`${poll.allowMultiple ? '✅' : '🔴'} تصويت متعدد: ${poll.allowMultiple ? 'مفعل' : 'معطل'}`)
      }
      if (setting === 'مجهول' || setting === 'anonymous') {
        poll.anonymous = !poll.anonymous
        return m.reply(`${poll.anonymous ? '✅' : '🔴'} تصويت مجهول: ${poll.anonymous ? 'مفعل' : 'معطل'}`)
      }
      if (setting === 'مدة' || setting === 'duration') {
        const minutes = parseInt(args[3])
        if (!minutes) return m.reply('❌ حدد المدة بالدقائق')
        poll.endsAt = now + minutes * 60000
        return m.reply(`⏱️ سينتهي الاستطلاع خلال ${minutes} دقيقة`)
      }

      return m.reply(
        `⚙️ *إعدادات الاستطلاع:*\\n` +
        `🆔 ${poll.id}\\n` +
        `🗳️ متعدد: ${poll.allowMultiple ? '✅' : '🔴'}\\n` +
        `🕵️ مجهول: ${poll.anonymous ? '✅' : '🔴'}\\n` +
        `⏰ ينتهي: ${poll.endsAt ? new Date(poll.endsAt).toLocaleString('ar-EG') : 'لا ينتهي'}`
      )
    }

  } catch (e) {
    console.error('poll:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

function showResults(m, poll, ended = false) {
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0)
  const sorted = [...poll.options].sort((a, b) => b.votes - a.votes)

  let msg = `${ended ? '🏁 *انتهى الاستطلاع*' : '📊 *نتائج الاستطلاع*'}\\n\\n`
  msg += `❓ *${poll.question}*\\n\\n`

  sorted.forEach((opt, i) => {
    const pct = totalVotes > 0 ? ((opt.votes / totalVotes) * 100).toFixed(1) : '0.0'
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
    msg += `${i + 1}. *${opt.text}*\\n`
    msg += `   ${opt.votes} صوت (${pct}%)\\n`
    msg += `   \`${bar}\`\\n\\n`
  })

  msg += `📊 إجمالي: ${totalVotes} تصويت\\n`
  msg += `👤 المنشئ: @${poll.creator.split('@')[0]}\\n`
  msg += `📅 الإنشاء: ${new Date(poll.createdAt).toLocaleString('ar-EG')}`
  if (poll.endsAt) msg += `\\n⏰ ينتهي: ${new Date(poll.endsAt).toLocaleString('ar-EG')}`

  return m.reply(msg, null, { mentions: [poll.creator] })
}

handler.command = ['poll', 'استطلاع', 'تصويت', 'poll_vote']
handler.usage = ['poll "سؤال" "خيار1" "خيار2" ...', 'poll صوت <id> <رقم>', 'poll نتيجة [id]', 'poll قائمة', 'poll انهاء <id>', 'poll احذف <id>', 'poll إعدادات <id> <متعدد|مجهول|مدة> <قيمة>']
handler.category = 'group'
handler.cooldown = 3
handler.group = true
export default handler