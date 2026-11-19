/*
  ═══════════════════════════════════════════
  🎭 لعبة المشنقة — فئات كلمات، رسم تدريجي
  الأمر: .hangman / .مشنقة / .شنق
  ═══════════════════════════════════════════
*/

import { pruneCooldown } from '../../system/cooldowns.js'

const cooldown = new Map()
const COOLDOWN_MS = 5000

const HANGMAN_STAGES = [
  `
   +---+
   |   |
       |
       |
       |
       |
 =========`,
  `
   +---+
   |   |
   O   |
       |
       |
       |
 =========`,
  `
   +---+
   |   |
   O   |
   |   |
       |
       |
 =========`,
  `
   +---+
   |   |
   O   |
  /|   |
       |
       |
 =========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
       |
       |
 =========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
  /    |
       |
 =========`,
  `
   +---+
   |   |
   O   |
  /|\\  |
  / \\  |
       |
 =========`
]

const CATEGORIES = {
  animals: { name: '🐾 حيوانات', words: ['أسد', 'فيل', 'نمر', 'دب', 'قرد', 'زرافة', 'حمار', 'حصان', 'بقر', 'غنم', 'جمل', 'ثعلب', 'ذئب', 'أرنب', 'قط', 'كلب', 'فأر', 'طير', 'سمك', 'تمساح'] },
  fruits: { name: '🍎 فواكه', words: ['تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'فراولة', 'مانجو', 'أناناس', 'كيوي', 'كمثرى', 'خوخ', 'مشمش', 'تمر', 'تين', 'رمان', 'ليمون', 'يوسفي', 'جريب فروت', 'بابايا', 'جواتشوبا'] },
  countries: { name: '🌍 دول', words: ['مصر', 'سعودية', 'إمارات', 'قطر', 'كويت', 'بحرين', 'عمان', 'أردن', 'لبنان', 'سوريا', 'عراق', 'فلسطين', 'ليبيا', 'تونس', 'جزائر', 'مغرب', 'سودان', 'صومال', 'جيبوتي', 'جزر القمر'] },
  objects: { name: '📦 أشياء', words: ['قلم', 'كتاب', 'مدرسة', 'بيت', 'باب', 'نافذة', 'سرير', 'كرسي', 'مكتب', 'حاسوب', 'هاتف', 'ساعة', 'نظارة', 'حذاء', 'قميص', 'بنطال', 'فستان', 'معطف', 'قبعة', 'قفاز'] },
  colors: { name: '🎨 ألوان', words: ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض', 'بني', 'وردي', 'بنفسجي', 'برتقالي', 'رمادي', 'فيروزي', 'ذهبي', 'فضي', 'كحلي', 'زيتي', 'خاكي', 'بيج', 'كريمي', 'سماوي'] },
}

function getGame(chatId) {
  global.gameHangman ??= {}
  return global.gameHangman[chatId]
}

function setGame(chatId, game) {
  global.gameHangman ??= {}
  global.gameHangman[chatId] = game
}

function deleteGame(chatId) {
  if (global.gameHangman) delete global.gameHangman[chatId]
}

function buildCategoryButtons() {
  return Object.entries(CATEGORIES).map(([key, cat]) => ({
    name: 'quick_reply',
    params: { display_text: `${cat.name}`, id: `.hangman فئة ${key}` }
  }))
}

function buildLetterButtons(guessed) {
  const letters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
  return letters.split('').filter(l => !guessed.includes(l)).slice(0, 12).map(l => ({
    name: 'quick_reply',
    params: { display_text: l, id: `.hangman حرف ${l}` }
  }))
}

function formatWord(word, guessed) {
  return word.split('').map(ch => guessed.includes(ch) ? ch : '_').join(' ')
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const chatId = m.chat
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const game = getGame(chatId)
    pruneCooldown(cooldown, COOLDOWN_MS)

    // تخمين حرف
    if (subCmd === 'حرف' || subCmd === 'letter') {
      const letter = args[1]
      if (!letter || letter.length !== 1) return m.reply('❌ حرف واحد فقط')

      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')

      if (game.guessed.includes(letter)) return m.reply('❌ هذا الحرف مستخدم بالفعل')

      game.guessed.push(letter)
      const correct = game.word.includes(letter)

      if (!correct) {
        game.wrong++
        await m.react('❌')
      } else {
        await m.react('✅')
      }

      const displayed = formatWord(game.word, game.guessed)
      const stage = HANGMAN_STAGES[game.wrong]
      const remaining = 6 - game.wrong
      const lettersBtns = buildLetterButtons(game.guessed)

      let text = `🎭 *المشنقة — ${CATEGORIES[game.category].name}*\n\n` +
        `\`\`\`\n${stage}\n\`\`\`\n\n` +
        `🔤 *الكلمة:* ${displayed}\n` +
        `💀 *أخطاء:* ${game.wrong}/6 (متبقي: ${remaining})\n` +
        `📝 *مستخدمة:* ${game.guessed.join(', ') || '—'}\n\n` +
        `⌨️ *اختر حرفاً:*`

      const isWin = !displayed.includes('_')
      const isLose = game.wrong >= 6

      if (isWin) {
        text += `\n\n🎉 *ممتاز! الكلمة: ${game.word}*`
        await m.react('🎉')
        deleteGame(chatId)
      } else if (isLose) {
        text += `\n\n💀 *انتهت المحاولات! الكلمة كانت: ${game.word}*`
        await m.react('💀')
        deleteGame(chatId)
      }

      await conn.sendMessage(m.chat, {
        text,
        buttons: lettersBtns.length > 0 ? lettersBtns : [{ name: 'quick_reply', params: { display_text: '🔄 لعبة جديدة', id: `${usedPrefix}hangman` } }],
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m })
      return
    }

    // اختيار الفئة
    if (subCmd === 'فئة' || subCmd === 'category' || subCmd === 'cat') {
      const catKey = args[1]
      if (!catKey || !CATEGORIES[catKey]) {
        return conn.sendMessage(m.chat, {
          text: '🎭 *اختر فئة للكلمات:*',
          footer: 'LIGHT BOT • Hangman',
          buttons: buildCategoryButtons()
        }, { quoted: m })
      }
      return m.reply(`📂 *تم اختيار الفئة:* ${CATEGORIES[catKey].name}`)
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
      const hidden = game.word.split('').filter(ch => !game.guessed.includes(ch))
      if (!hidden.length) return m.reply('💡 كل الحروف مكتشفة!')
      const hint = hidden[Math.floor(Math.random() * hidden.length)]
      game.guessed.push(hint) // كشف الحرف مباشرة
      return m.reply(`💡 *تلميح:* الحرف "${hint}" موجود في الكلمة`)
    }

    // لعبة جديدة / قائمة رئيسية
    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    // بدء لعبة جديدة
    cooldown.set(sender, now)
    const category = args[0] && CATEGORIES[args[0]] ? args[0] : Object.keys(CATEGORIES)[Math.floor(Math.random() * Object.keys(CATEGORIES).length)]
    const word = CATEGORIES[category].words[Math.floor(Math.random() * CATEGORIES[category].words.length)]

    const newGame = {
      active: true,
      category,
      word,
      guessed: [],
      wrong: 0,
      hintsUsed: 0,
      startTime: Date.now()
    }
    setGame(chatId, newGame)

    await m.react('🎭')
    const displayed = formatWord(word, [])
    const lettersBtns = buildLetterButtons([])

    await conn.sendMessage(m.chat, {
      text: `🎭 *لعبة المشنقة — ${CATEGORIES[category].name}*\n\n` +
        `\`\`\`\n${HANGMAN_STAGES[0]}\n\`\`\`\n\n` +
        `🔤 *الكلمة:* ${displayed}\n` +
        `💀 *أخطاء:* 0/6\n\n` +
        `⌨️ *اختر حرفاً للبدء:*`,
      buttons: lettersBtns,
      contextInfo: { mentionedJid: [sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('hangman:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['hangman', 'مشنقة', 'شنق', 'hangman-ar']
handler.usage = ['hangman', 'hangman فئة <animals|fruits|countries|objects|colors>', 'hangman حرف <حرف>', 'hangman تلميح', 'hangman إيقاف']
handler.category = 'games'
handler.cooldown = 5
handler.group = true
export default handler