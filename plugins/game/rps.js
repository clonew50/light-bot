/*
  ═══════════════════════════════════════════
  ✊✋✌️ حجر ورقة مقص — أفضل 3/5 تفاعلي
  الأمر: .rps / .حجر / .مقص
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 3000

const CHOICES = [
  { id: 'rock', name: '✊ حجر', emoji: '✊', beats: 'scissors' },
  { id: 'paper', name: '✋ ورقة', emoji: '✋', beats: 'rock' },
  { id: 'scissors', name: '✌️ مقص', emoji: '✌️', beats: 'paper' },
]

const MODES = [
  { id: '1', name: 'جولة واحدة', rounds: 1 },
  { id: '3', name: 'أفضل 3', rounds: 3 },
  { id: '5', name: 'أفضل 5', rounds: 5 },
]

function getGame(chatId) {
  global.gameRPS ??= {}
  return global.gameRPS[chatId]
}

function setGame(chatId, game) {
  global.gameRPS ??= {}
  global.gameRPS[chatId] = game
}

function deleteGame(chatId) {
  if (global.gameRPS) delete global.gameRPS[chatId]
}

function getResult(player, bot) {
  if (player === bot) return 'draw'
  const p = CHOICES.find(c => c.id === player)
  return p.beats === bot ? 'win' : 'lose'
}

function buildChoiceButtons() {
  return CHOICES.map(c => ({
    name: 'quick_reply',
    params: { display_text: `${c.emoji} ${c.name}`, id: `.rps ${c.id}` }
  }))
}

function buildModeButtons() {
  return MODES.map(m => ({
    name: 'quick_reply',
    params: { display_text: m.name, id: `.rps وضع ${m.id}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const chatId = m.chat
    const sender = m.sender
    const subCmd = args[0]?.toLowerCase()
    const game = getGame(chatId)

    // إذا كانت لعبة نشطة وانتظار اختيار
    if (game && game.active && CHOICES.some(c => c.id === subCmd)) {
      const playerChoice = subCmd
      const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)].id
      const result = getResult(playerChoice, botChoice)

      const pChoice = CHOICES.find(c => c.id === playerChoice)
      const bChoice = CHOICES.find(c => c.id === botChoice)

      if (result === 'win') game.playerScore++
      else if (result === 'lose') game.botScore++

      const roundText = `🎮 *جولة ${game.round}/${game.maxRounds}*\n\n` +
        `${pChoice.emoji} أنت: ${pChoice.name}\n` +
        `${bChoice.emoji} البوت: ${bChoice.name}\n\n` +
        (result === 'win' ? '✅ *فزت!*' : result === 'lose' ? '❌ *خسرت!*' : '🤝 *تعادل*') +
        `\n\n📊 النتيجة: أنت ${game.playerScore} - ${game.botScore} البوت`

      await m.react(result === 'win' ? '✅' : result === 'lose' ? '❌' : '🤝')

      if (game.round >= game.maxRounds || game.playerScore > game.maxRounds / 2 || game.botScore > game.maxRounds / 2) {
        // نهاية اللعبة
        let finalText = roundText + '\n\n'
        if (game.playerScore > game.botScore) finalText += '🏆 *تهانينا! فزت باللعبة!*'
        else if (game.botScore > game.playerScore) finalText += '😢 *البوت فاز باللعبة. جرب مرة أخرى!*'
        else finalText += '🤝 *اللعبة انتهت بالتعادل!*'

        finalText += `\n\n📈 *النتيجة النهائية:* أنت ${game.playerScore} - ${game.botScore} البوت`
        deleteGame(chatId)
        await conn.sendMessage(m.chat, { text: finalText, contextInfo: { mentionedJid: [sender] } }, { quoted: m })
        return
      }

      game.round++
      await conn.sendMessage(m.chat, {
        text: roundText + '\n\nاختر للجولة التالية:',
        buttons: buildChoiceButtons(),
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m })
      return
    }

    // اختيار الوضع
    if (subCmd === 'وضع' || subCmd === 'mode') {
      const modeId = args[1]
      if (!modeId) {
        return conn.sendMessage(m.chat, {
          text: '🎮 *اختر وضع اللعبة:*',
          footer: 'LIGHT BOT • Rock Paper Scissors',
          buttons: buildModeButtons()
        }, { quoted: m })
      }
      const mode = MODES.find(m => m.id === modeId)
      if (!mode) return m.reply('❌ وضع غير موجود')
      return m.reply(`🎮 *تم اختيار:* ${mode.name}`)
    }

    // إيقاف
    if (subCmd === 'إيقاف' || subCmd === 'stop' || subCmd === 'انهاء') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      deleteGame(chatId)
      return m.reply('🛑 تم إيقاف اللعبة')
    }

    // النقاط
    if (subCmd === 'نقاط' || subCmd === 'score') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة')
      return m.reply(`📊 *النقاط الحالية:*\nأنت ${game.playerScore} - ${game.botScore} البوت\nالجولة ${game.round}/${game.maxRounds}`)
    }

    // قائمة رئيسية
    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    cooldown.set(sender, now)

    // بدء لعبة جديدة
    const mode = MODES.find(m => m.id === args[0]) || MODES[1] // افتراضي أفضل 3
    const newGame = {
      active: true,
      maxRounds: mode.rounds,
      round: 1,
      playerScore: 0,
      botScore: 0,
      players: [sender]
    }
    setGame(chatId, newGame)

    await m.react('✊')
    await conn.sendMessage(m.chat, {
      text: `✊✋✌️ *حجر ورقة مقص — ${mode.name}*\n\nاختر حركتك:`,
      buttons: buildChoiceButtons(),
      contextInfo: { mentionedJid: [sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('rps:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['rps', 'حجر', 'مقص', 'ورقة', 'rockpaperscissors']
handler.usage = ['rps', 'rps وضع <1|3|5>', 'rps ✊|✋|✌️', 'rps نقاط', 'rps إيقاف']
handler.category = 'games'
handler.cooldown = 3
handler.group = true
export default handler