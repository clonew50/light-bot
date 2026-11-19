/*
  ═══════════════════════════════════════════
  🟩 Wordle عربي — 6 محاولات، لوحة مفاتيح تفاعلية
  الأمر: .wordle / .وردل
  ═══════════════════════════════════════════
*/
import { pruneCooldown } from '../../system/cooldowns.js'

const cooldown = new Map()
const COOLDOWN_MS = 5000

// كلمات عربية من 5 حروف تماماً
const RAW_WORDS = [
  'سيارة', 'طائرة', 'سفينة', 'دراجة', 'حافلة', 'شاحنة', 'مدرسة', 'نافذة', 'حاسوب', 'نظارة',
  'فستان', 'برتقال', 'فراشة', 'حديقة', 'مكتبة', 'جامعة', 'صداقة', 'سعادة', 'طبيعة', 'رياضة',
  'مفتاح', 'مصباح', 'تلفاز', 'ثلاجة', 'بركان', 'صحراء', 'جزيرة', 'غابات', 'أنهار', 'بحيرة',
  'مستوى', 'تجربة', 'حقيقة', 'ابتسم', 'انتظر', 'مسافة', 'سرعة', 'قراءة', 'كتابة', 'تاريخ',
  'ثقافة', 'أخلاق', 'كرامة', 'شجاعة', 'بطولة', 'نهاية', 'بداية', 'سفارة', 'دولة', 'خريطة',
  'زراعة', 'صناعة', 'تجارة', 'عمارة', 'هندسة', 'دراسة', 'معرفة', 'وسيلة', 'رسالة', 'قصيدة',
  'أغنية', 'لوحة', 'مسرح', 'موسيق', 'كوكبة', 'شمسية', 'فضاء', 'نجوم', 'عاصفة', 'أبيض'
]
const WORDS = [...new Set(RAW_WORDS.filter(w => [...w].length === 5))]

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

  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = '🟩'
      answerChars[i] = null
      guessChars[i] = null
    }
  }

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
  return guesses.map((g, i) => `${g}  ${results[i].join(' ')}`).join('\n')
}

function buildKeyboard(guesses, results) {
  const rows = [
    ['ق', 'و', 'ف', 'ذ', 'ه', 'خ', 'ح', 'ج', 'د', 'ل'],
    ['ش', 'س', 'ي', 'ب', 'ن', 'م', 'ك', 'ط', 'ظ', 'ع'],
    ['غ', 'ز', 'ة', 'ء', 'ؤ', 'إ', 'أ', 'آ', 'ئ', 'ا']
  ]

  const keyStates = {}
  guesses.forEach((g, i) => {
    const r = results[i]
    g.split('').forEach((ch, j) => {
      const curr = keyStates[ch]
      const next = r[j]
      if (!curr || next === '🟩' || (curr === '🟨' && next === '⬜')) {
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

async function submitGuess(m, conn, game, guess, chatId, sender) {
  if (!WORDS.includes(guess)) {
    game.currentGuess = ''
    return m.reply('❌ كلمة غير موجودة في القاموس أو ليست من 5 حروف. جرب كلمة عربية من 5 حروف.')
  }

  game.currentGuess = ''
  const result = checkGuess(guess, game.answer)
  game.guesses.push(guess)
  game.results.push(result)

  const isWin = result.every(r => r === '🟩')
  const isGameOver = isWin || game.guesses.length >= 6

  const board = formatBoard(game.guesses, game.results)
  const keyboard = buildKeyboard(game.guesses, game.results)

  let msg = `🟩 *Wordle عربي — محاولة ${game.guesses.length}/6*\n\n\`\`\`\n${board}\n\`\`\`\n\n⌨️ *اللوحة:*\n\`\`\`\n${keyboard}\n\`\`\``

  if (isWin) {
    msg += `\n\n🎉 *ممتاز! اكتشفت الكلمة: ${game.answer}*`
    await m.react('🎉')
    deleteGame(chatId)
  } else if (isGameOver) {
    msg += `\n\n😢 *انتهت المحاولات. الكلمة كانت: ${game.answer}*`
    await m.react('😢')
    deleteGame(chatId)
  } else {
    await m.react('🟩')
  }

  return conn.sendMessage(m.chat, { text: msg, contextInfo: { mentionedJid: [sender] } }, { quoted: m })
}

const handler = async (m, { conn, text, args, usedPrefix = '.' }) => {
  try {
    const now = Date.now()
    const chatId = m.chat
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const game = getGame(chatId)

    pruneCooldown(cooldown, COOLDOWN_MS)

    if (subCmd === 'حرف' || subCmd === 'letter') {
      const val = (args[1] || '').trim()
      if (!game || !game.active) {
        return m.reply('❌ لا توجد لعبة نشطة. ابدأ بـ `.wordle`')
      }
      if ([...val].length === 5) {
        return submitGuess(m, conn, game, val, chatId, sender)
      }
      if ([...val].length !== 1) return m.reply('❌ أدخل حرفاً واحداً أو كلمة كاملة من 5 حروف')

      game.currentGuess = (game.currentGuess || '') + val
      if ([...game.currentGuess].length < 5) {
        return m.reply(`⌨️ *الكلمة الحالية:* ${game.currentGuess}_\n(أكمل 5 حروف أو اكتب \`.wordle <كلمة من 5 حروف>\`)`)
      }
      return submitGuess(m, conn, game, game.currentGuess, chatId, sender)
    }

    if (subCmd === 'دخول' || subCmd === 'enter' || subCmd === 'submit') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (!game.currentGuess || [...game.currentGuess].length !== 5) {
        return m.reply('❌ اكمل 5 حروف أولاً')
      }
      return submitGuess(m, conn, game, game.currentGuess, chatId, sender)
    }

    if (subCmd === 'مسح' || subCmd === 'backspace' || subCmd === 'delete') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (game.currentGuess) {
        game.currentGuess = game.currentGuess.slice(0, -1)
        return m.reply(`⌨️ *الكلمة الحالية:* ${game.currentGuess || '_'}`)
      }
      return m.reply('❌ لا يوجد شيء للمسح')
    }

    if (subCmd === 'إيقاف' || subCmd === 'stop' || subCmd === 'انهاء') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      deleteGame(chatId)
      return m.reply('🛑 تم إيقاف اللعبة')
    }

    if (subCmd === 'تلميح' || subCmd === 'hint') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      if (game.hintsUsed >= 2) return m.reply('❌ استنفدت التلميحات (2 فقط)')
      game.hintsUsed++
      const revealed = new Set(game.guesses.flatMap((g, i) => g.split('').filter((_, j) => game.results[i][j] === '🟩')))
      const hidden = game.answer.split('').filter(ch => !revealed.has(ch))
      if (!hidden.length) return m.reply('💡 كل الحروف مكتشفة!')
      const hint = hidden[Math.floor(Math.random() * hidden.length)]
      return m.reply(`💡 *تلميح:* الكلمة تحتوي على حرف "${hint}"`)
    }

    // تخمين كلمة كاملة مباشرة أثناء لعبة نشطة: .wordle سيارة
    const directGuess = (text || '').trim()
    if (game?.active && [...directGuess].length === 5 && !directGuess.includes(' ')) {
      return submitGuess(m, conn, game, directGuess, chatId, sender)
    }

    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

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
        `اكتب كلمة مباشرة مثل: \`.wordle سيارة\``,
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
handler.usage = ['wordle', 'wordle <كلمة من 5 حروف>', 'wordle حرف <حرف>', 'wordle دخول', 'wordle مسح', 'wordle تلميح', 'wordle إيقاف']
handler.category = 'games'
handler.cooldown = 5
handler.group = true
export default handler