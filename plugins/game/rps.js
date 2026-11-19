/*
  ═══════════════════════════════════════════
  ✊✋✌️ حجر ورقة مقص — أفضل 3/5 تفاعلي
  الأمر: .rps / .حجر / .مقص
  ═══════════════════════════════════════════
*/
import { formatCard } from '../../system/interactiveUI.js';
import { pruneCooldown } from '../../system/cooldowns.js';

const cooldown = new Map();
const COOLDOWN_MS = 2500;

const CHOICES = [
  { id: 'rock', name: '✊ حجر', label: 'حجر', emoji: '✊', beats: 'scissors', aliases: ['rock', 'حجر', '✊', '🪨'] },
  { id: 'paper', name: '✋ ورقة', label: 'ورقة', emoji: '✋', beats: 'rock', aliases: ['paper', 'ورقة', 'ورقه', '✋', '📄'] },
  { id: 'scissors', name: '✌️ مقص', label: 'مقص', emoji: '✌️', beats: 'paper', aliases: ['scissors', 'مقص', '✌️', '✂️'] },
];

const MODES = [
  { id: '1', name: 'جولة واحدة', rounds: 1 },
  { id: '3', name: 'أفضل 3', rounds: 3 },
  { id: '5', name: 'أفضل 5', rounds: 5 },
];

function getGame(chatId) {
  global.gameRPS ??= {};
  return global.gameRPS[chatId];
}

function setGame(chatId, game) {
  global.gameRPS ??= {};
  global.gameRPS[chatId] = game;
}

function deleteGame(chatId) {
  if (global.gameRPS) delete global.gameRPS[chatId];
}

function resolveChoice(input) {
  const key = String(input || '').trim().toLowerCase();
  return CHOICES.find((c) => c.id === key || c.aliases.includes(key)) || null;
}

function getResult(player, bot) {
  if (player === bot) return 'draw';
  const p = CHOICES.find((c) => c.id === player);
  return p.beats === bot ? 'win' : 'lose';
}

function buildChoiceButtons(prefix = '.') {
  return CHOICES.map((c) => ({
    name: 'quick_reply',
    params: { display_text: c.name, id: `${prefix}rps ${c.id}` }
  }));
}

function buildModeButtons(prefix = '.') {
  return MODES.map((m) => ({
    name: 'quick_reply',
    params: { display_text: m.name, id: `${prefix}rps وضع ${m.id}` }
  }));
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    const pfx = usedPrefix || '.';
    const now = Date.now();
    const chatId = m.chat;
    const sender = m.sender;
    const subCmd = (args[0] || '').toLowerCase();
    const game = getGame(chatId);

    // دعم أوامر الاختصار المباشرة مثل .حجر / .ورقة / .مقص
    const directAlias = !subCmd && ['حجر', 'ورقة', 'مقص'].includes(String(command || '').toLowerCase())
      ? resolveChoice(command)
      : null;

    const activeChoice = resolveChoice(subCmd) || (game?.active ? directAlias : null);

    // إذا كانت لعبة نشطة وانتظار اختيار
    if (game && game.active && activeChoice) {
      const playerChoice = activeChoice.id;
      const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)].id;
      const result = getResult(playerChoice, botChoice);

      const pChoice = CHOICES.find((c) => c.id === playerChoice);
      const bChoice = CHOICES.find((c) => c.id === botChoice);

      if (result === 'win') game.playerScore++;
      else if (result === 'lose') game.botScore++;

      const statusLine = result === 'win'
        ? '✅ *فزت بهذه الجولة!*'
        : result === 'lose'
          ? '❌ *البوت فاز بهذه الجولة!*'
          : '🤝 *تعادل!*';

      const roundCard = formatCard({
        title: `حجر ورقة مقص — جولة ${game.round}/${game.maxRounds}`,
        badge: '🎮',
        theme: 'game',
        fields: [
          { icon: pChoice.emoji, label: 'اختيارك', value: pChoice.label },
          { icon: bChoice.emoji, label: 'اختيار البوت', value: bChoice.label },
          { icon: '⚖️', label: 'النتيجة', value: statusLine },
          { icon: '📊', label: 'النقاط', value: `أنت ${game.playerScore} 🆚 ${game.botScore} البوت` }
        ],
        footer: ''
      });

      await m.react(result === 'win' ? '✅' : result === 'lose' ? '❌' : '🤝');

      const neededToWin = Math.floor(game.maxRounds / 2) + 1;
      if (game.round >= game.maxRounds || game.playerScore >= neededToWin || game.botScore >= neededToWin) {
        let finalBadge = '🤝';
        let finalVerdict = 'انتهت اللعبة بالتعادل!';
        if (game.playerScore > game.botScore) {
          finalBadge = '🏆';
          finalVerdict = 'تهانينا! لقد فزت بالمباراة!';
        } else if (game.botScore > game.playerScore) {
          finalBadge = '🤖';
          finalVerdict = 'فاز البوت بالمباراة! جرّب حظك مجدداً.';
        }

        const finalCard = `${roundCard}\n\n${finalBadge} *${finalVerdict}*`;
        deleteGame(chatId);
        await conn.sendMessage(m.chat, {
          text: finalCard,
          footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • RPS',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🔄 العب مجدداً', id: `${pfx}rps` } },
            { name: 'quick_reply', params: { display_text: '🎮 تغيير الوضع', id: `${pfx}rps وضع` } }
          ],
          contextInfo: { mentionedJid: [sender] }
        }, { quoted: m });
        return;
      }

      game.round++;
      await conn.sendMessage(m.chat, {
        text: `${roundCard}\n\n👇 *اختر حركتك للجولة التالية:*`,
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • RPS',
        buttons: buildChoiceButtons(pfx),
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m });
      return;
    }

    // اختيار الوضع
    if (subCmd === 'وضع' || subCmd === 'mode') {
      const modeId = args[1];
      if (!modeId) {
        return conn.sendMessage(m.chat, {
          text: formatCard({
            title: 'وضع لعبة حجر ورقة مقص',
            badge: '🎮',
            theme: 'game',
            body: 'اختر عدد الجولات التي تريد اللعب بها:',
            footer: ''
          }),
          footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • RPS',
          buttons: buildModeButtons(pfx)
        }, { quoted: m });
      }
      const mode = MODES.find((md) => md.id === modeId);
      if (!mode) return m.reply('❌ وضع غير موجود (اختر 1 أو 3 أو 5).');
      const newGame = {
        active: true,
        maxRounds: mode.rounds,
        round: 1,
        playerScore: 0,
        botScore: 0,
        players: [sender]
      };
      setGame(chatId, newGame);
      return conn.sendMessage(m.chat, {
        text: formatCard({
          title: `حجر ورقة مقص — ${mode.name}`,
          badge: '✊✋✌️',
          theme: 'game',
          body: 'بدأت المباراة! اختر حركتك من الأزرار بالأسفل:',
          footer: ''
        }),
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • RPS',
        buttons: buildChoiceButtons(pfx),
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m });
    }

    // إيقاف
    if (subCmd === 'إيقاف' || subCmd === 'ايقاف' || subCmd === 'stop' || subCmd === 'انهاء') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة حالياً.');
      deleteGame(chatId);
      return m.reply('🛑 تم إيقاف اللعبة بنجاح.');
    }

    // النقاط
    if (subCmd === 'نقاط' || subCmd === 'score') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة حالياً.');
      return m.reply(formatCard({
        title: 'نقاط المباراة الحالية',
        badge: '📊',
        theme: 'game',
        fields: [
          { icon: '👤', label: 'أنت', value: `${game.playerScore}` },
          { icon: '🤖', label: 'البوت', value: `${game.botScore}` },
          { icon: '🔄', label: 'الجولة', value: `${game.round} من ${game.maxRounds}` }
        ]
      }));
    }

    // كولداون بدء لعبة جديدة
    const last = cooldown.get(sender) || 0;
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية قبل بدء لعبة جديدة.`);
    }
    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(sender, now);

    // بدء لعبة جديدة
    const mode = MODES.find((md) => md.id === args[0]) || MODES[1]; // افتراضي أفضل 3
    const newGame = {
      active: true,
      maxRounds: mode.rounds,
      round: 1,
      playerScore: 0,
      botScore: 0,
      players: [sender]
    };
    setGame(chatId, newGame);

    await m.react('✊');
    await conn.sendMessage(m.chat, {
      text: formatCard({
        title: `حجر ورقة مقص — ${mode.name}`,
        badge: '✊✋✌️',
        theme: 'game',
        body: 'اختر حركتك من الأزرار بالأسفل لتحدي البوت:',
        footer: ''
      }),
      footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 • RPS',
      buttons: buildChoiceButtons(pfx),
      contextInfo: { mentionedJid: [sender] }
    }, { quoted: m });
  } catch (e) {
    console.error('rps:', e?.message || e);
    await m.react('❌');
    m.reply('❌ حدث خطأ أثناء تشغيل اللعبة.');
  }
};

handler.command = ['rps', 'حجر', 'مقص', 'ورقة', 'rockpaperscissors'];
handler.usage = ['rps', 'rps وضع <1|3|5>', 'rps نقاط', 'rps إيقاف'];
handler.category = 'games';
handler.cooldown = 3;
handler.group = false;
export default handler;