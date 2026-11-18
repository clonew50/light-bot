/*
  ═══════════════════════════════════════════
  🟩 Wordle عربي — 6 محاولات، لوحة مفاتيح تفاعلية
  الأمر: .wordle / .وردل
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 5000

// كلمات عربية من 5 حروف
const WORDS = [
  'قمر', 'شمس', 'بحر', 'جبل', 'نهر', 'شجر', 'طير', 'أسد', 'فرس', 'كلب',
  'قلم', 'كتاب', 'مدرسة', 'بيت', 'باب', 'نافذة', 'سرير', 'كرسي', 'مكتب', 'حاسوب',
  'هاتف', 'ساعة', 'نظارة', 'حذاء', 'قميص', 'بنطال', 'فستان', 'معطف', 'قبعة', 'قفاز',
  'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'فراولة', 'مانجو', 'أناناس', 'كيوي', 'كمثرى',
  'سيارة', 'قطار', 'طائرة', 'سفينة', 'دراجة', 'حافلة', 'شاحنة', 'جرار', 'مترو', 'ترام',
  'طبيب', 'ممرض', 'معلم', 'مهندس', 'محامي', 'قاضي', 'شرطي', 'رجل', 'امرأة', 'طفل',
  'أب', 'أم', 'أخ', 'أخت', 'جد', 'جدة', 'عم', 'عمة', 'خال', 'خالة',
  'صباح', 'مساء', 'ظهر', 'ليل', 'نهار', 'أسبوع', 'شهر', 'سنة', 'دقيقة', 'ثانية',
  'أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض', 'بني', 'وردي', 'بنفسجي', 'برتقالي'
]

function getGame(chatId) {
  global.gameWordle ??= {}
  return global.gameWordle[chatId]
}

function setGame(chatId, game) {
  global.gameWordle ??= {}
  global.gameWordle[chatId] = game
}

function deleteGame(chatId) {
  if (global.gameWordle) delete global.gameWordle[chatId]
}

function checkGuess(guess, answer) {
  const result = []
  const answerChars = answer.split('')
  const guessChars = guess.split('')

  // أول تمريرة: أخضر
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = '🟩'
      answerChars[i] = null
      guessChars[i] = null
    }
  }

  // ثانية تمريرة: أصفر/رمادي
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === null) continue
    const idx = answerChars.indexOf(guessChars[i])
    if (idx !== -1) {
      result[i] = '🟨'
      answerChars[idx] = null
    } else {
      result[i] = '⬜'
    }
  }

  return result
}

function formatBoard(guesses, results) {
  return guesses.map((g, i) => results[i].join(' ')).join('\n')
}

function buildKeyboard(guesses, results) {
  const rows = [
    ['ق', 'و', 'ف', 'ذ', 'ه', 'خ', 'ح', 'ج', 'د', 'ل'],
    ['ش', 'س', 'ي', 'ب', 'ن', 'م', 'ك', 'ط', 'ظ', 'ع'],
    ['غ', 'ز', 'و', 'ة', 'ء', 'ؤ', 'إ', 'أ', 'آ', 'ئ']
  ]

  // حساب حالة كل حرف
  const keyStates = {}
  guesses.forEach((g, i) => {
    const r = results[i]
    g.split('').forEach((ch, j) => {
      const curr = keyStates[ch]
      const next = r[j]
      if (!curr || (next === '🟩') || (curr === '🟨' && next === '⬜')) {
        keyStates[ch] = next
      }
    })
  })

  return rows.map(row => row.map(ch => {
    const state = keyStates[ch]
    if (state === '🟩') return `${ch}🟩`
    if (state === '🟨') return `${ch}🟨`
    if (state === '⬜') return `${ch}⬜`
    return ch
  }).join(' ')).join('\n')
}

function buildGuessButtons() {
  // أزرار للحروف الشائعة
  const common = ['ا', 'ل', 'م', 'ن', 'ر', 'ت', 'ب', 'س', 'ي', 'ه']
  return common.slice(0, 5).map(ch => ({
    name: 'quick_reply',
    params: { display_text: ch, id: `.wordle حرف ${ch}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const chatId = m.chat
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const game = getGame(chatId)

    // إدخال حرف/كلمة
    if (subCmd === 'حرف' || subCmd === 'letter') {
      const letter = args[1]
      if (!letter || letter.length !== 1) return m.reply('❌ حرف واحد فقط')

      if (!game || !game.active) {
        return m.reply('❌ لا توجد لعبة نشطة. ابدأ بـ `.wordle`')
      }

      // إضافة للحروف المدخلة الحالية
      game.currentGuess = (game.currentGuess || '') + letter

      if (game.currentGuess.length < 5) {
        return m.reply(`⌨️ *الكلمة الحالية:* ${game.currentGuess}_\n(أكمل 5 حروف ثم اضغط دخول)`)
      }

      // تحقق من الكلمة
      const guess = game.currentGuess
      if (!WORDS.includes(guess)) {
        game.currentGuess = ''
        return m.reply('❌ كلمة غير موجودة في القاموس. جرب أخرى.')
      }

      game.currentGuess = ''
      const result = checkGuess(guess, game.answer)
      game.guesses.push(guess)
      game.results.push(result)

      const isWin = result.every(r => r === '🟩')
      const isGameOver = isWin || game.guesses.length >= 6

      const board = formatBoard(game.guesses, game.results)
      const keyboard = buildKeyboard(game.guesses, game.results)

      let text = `🟩 *Wordle عربي — محاولة ${game.guesses.length}/6*\n\n\`\`\`\n${board}\n\`\`\`\n\n⌨️ *اللوحة:*\n\`\`\`\n${keyboard}\n\`\`\``

      if (isWin) {
        text += `\n\n🎉 *ممتاز! اكتشفت الكلمة: ${game.answer}*`
        await m.react('🎉')
        deleteGame(chatId)
      } else if (isGameOver) {
        text += `\n\n😢 *انتهت المحاولات. الكلمة كانت: ${game.answer}*`
        await m.react('😢')
        deleteGame(chatId)
      } else {
        await m.react('🟩')
      }

      await conn.sendMessage(m.chat, { text, contextInfo: { mentionedJid: [sender] } }, { quoted: m })
      return
    }

    // دخول (إرسال الكلمة الحالية)
    if (subCmd === 'دخول' || subCmd === 'enter' || subCmd === 'submit') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (!game.currentGuess || game.currentGuess.length !== 5) {
        return m.reply('❌ اكمل 5 حروف أولاً')
      }
      // محاكاة أمر حرف
      return handler(m, { conn, text: `${usedPrefix}wordle حرف ${game.currentGuess}`, args: ['حرف', game.currentGuess], usedPrefix })
    }

    // مسح الحرف الأخير
    if (subCmd === 'مسح' || subCmd === 'backspace' || subCmd === 'delete') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (game.currentGuess) {
        game.currentGuess = game.currentGuess.slice(0, -1)
        return m.reply(`⌨️ *الكلمة الحالية:* ${game.currentGuess || '_'}`)
      }
      return m.reply('❌ لا يوجد شيء للمسح')
    }

    // إيقاف
    if (subCmd === 'إيقاف' || subCmd === 'stop' || subCmd === 'انهاء') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      deleteGame(chatId)
      return m.reply('🛑 تم إيقاف اللعبة')
    }

    // تلميح
    if (subCmd === 'تلميح' || subCmd === 'hint') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (game.hintsUsed >= 2) return m.reply('❌ استنفدت التلميحات (2 فقط)')
      game.hintsUsed++
      // كشف حرف عشوائي غير مكتشف
      const revealed = new Set(game.guesses.flatMap((g, i) => g.split('').filter((ch, j) => game.results[i][j] === '🟩')))
      const hidden = game.answer.split('').filter(ch => !revealed.has(ch))
      if (!hidden.length) return m.reply('💡 كل الحروف مكتشفة!')
      const hint = hidden[Math.floor(Math.random() * hidden.length)]
      return m.reply(`💡 *تلميح:* الكلمة تحتوي على حرف "${hint}"`)
    }

    // قائمة رئيسية / لعبة جديدة
    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    // لعبة جديدة
    cooldown.set(sender, now)
    const answer = WORDS[Math.floor(Math.random() * WORDS.length)]
    const newGame = {
      active: true,
      answer,
      guesses: [],
      results: [],
      currentGuess: '',
      hintsUsed: 0,
      startTime: Date.now()
    }
    setGame(chatId, newGame)

    await m.react('🟩')
    const keyboard = buildKeyboard([], [])
    await conn.sendMessage(m.chat, {
      text: `🟩 *Wordle عربي — لعبة جديدة!*\n\n` +
        `🎯 خمن الكلمة (5 حروف عربية)\n` +
        `🟩 = حرف صحيح في المكان الصحيح\n` +
        `🟨 = حرف صحيح في المكان الخطأ\n` +
        `⬜ = حرف غير موجود\n\n` +
        `⌨️ *اللوحة:*\n\`\`\`\n${keyboard}\n\`\`\`\n\n` +
        `استخدم الأزرار أو اكتب: `.wordle حرف ق``,
      footer: 'LIGHT BOT • Wordle',
      buttons: [
        { name: 'quick_reply', params: { display_text: '💡 تلميح', id: `${usedPrefix}wordle تلميح` } },
        { name: 'quick_reply', params: { display_text: '🛑 إيقاف', id: `${usedPrefix}wordle إيقاف` } }
      ],
      contextInfo: { mentionedJid: [sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('wordle:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['wordle', 'وردل', 'wordle-ar']
handler.usage = ['wordle', 'wordle حرف <حرف>', 'wordle دخول', 'wordle مسح', 'wordle تلميح', 'wordle إيقاف']
handler.category = 'games'
handler.cooldown = 5
handler.group = true
export default handler