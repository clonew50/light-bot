/*
code: game guess character
format: text based + strict reply mandatory + custom borders + pure channel forward status
*/

// سياق التوجيه الصافي من القناة بدون إعلان أسفل الرسالة
const context = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

// قائمة الشخصيات المحلية
const characters = [
    { name: 'يوتا', img: 'https://files.catbox.moe/q23lo1.jpg' },
    { name: 'مليودس', img: 'https://files.catbox.moe/n5j25b.jpg' },
    { name: 'ساسكي', img: 'https://files.catbox.moe/lbas99.jpg' },
    { name: 'سونغ', img: 'https://files.catbox.moe/f4uttg.jpg' },
    { name: 'كرولو', img: 'https://files.catbox.moe/ljik7x.jpg' },
    { name: 'ايتشيغو', img: 'https://files.catbox.moe/um1njn.jpg' },
    { name: 'باين', img: 'https://files.catbox.moe/in6tnh.jpg' },
    { name: 'ايزن', img: 'https://files.catbox.moe/42w2t0.jpg' },
    { name: 'ايساغي', img: 'https://files.catbox.moe/sx7x6w.jpg' },
    { name: 'غوجو', img: 'https://files.catbox.moe/66kbtt.jpg' },
    { name: 'ناغي', img: 'https://files.catbox.moe/yuz0lj.jpg' },
    { name: 'سوكونا', img: 'https://files.catbox.moe/pkc624.jpg' },
    { name: 'ساي', img: 'https://files.catbox.moe/3w7y72.jpg' },
    { name: 'رين', img: 'https://files.catbox.moe/gz4xpg.jpg' },
    { name: 'تشيغري', img: 'https://files.catbox.moe/sq330s.jpg' },
    { name: 'شيدو', img: 'https://files.catbox.moe/bawp0a.jpg' },
    { name: 'كايزر', img: 'https://files.catbox.moe/tpdpg4.jpg' },
    { name: 'مايكي', img: 'https://files.catbox.moe/byc2tt.jpg' },
    { name: 'دراكن', img: 'https://files.catbox.moe/5sfl1s.jpg' }
];

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

const handler = async (m, { conn }) => {
  const chatId = m.chat;
  if (!global.gameMonte) global.gameMonte = {};
  
  if (global.gameMonte[chatId]?.current) {
    return await conn.sendMessage(chatId, {
      image: { url: global.gameMonte[chatId].current.img },
      caption: global.gameMonte[chatId].current.caption,
      contextInfo: context(m.sender)
    }, { quoted: m });
  }

  try {
    await m.react('🧩');
    const char = characters[Math.floor(Math.random() * characters.length)];
    const wrong = shuffle([...characters]).filter(c => c.name !== char.name).slice(0, 3).map(c => c.name);
    const opts = shuffle([char.name, ...wrong]);
    
    const caption = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*لعبة تعرف على شخصية الأنمي من صورته 🥢*\n\n1. ≺ ${opts[0]} ≺\n2. ≺ ${opts[1]} ≺\n3. ≺ ${opts[2]} ≺\n4. ≺ ${opts[3]} ≺\n\n⏳ الوقت: 60 ثانية\n🪙 الجائزة: 500xp + 10 كوكيز\n\n⚠️ *ملاحظة:* يجب الرد (ريبلاي) على هذه الرسالة بالإجابة الصحيحة لكي تُحتسب!\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`;
    
    // إرسال صورة السؤال مع حالة التوجيه الصافية من القناة
    const msg = await conn.sendMessage(chatId, {
      image: { url: char.img },
      caption,
      contextInfo: context(m.sender)
    }, { quoted: m });
    
    global.gameMonte[chatId] = {
      current: {
        answer: char.name.toLowerCase().trim(),
        opts: opts.map(o => o.toLowerCase().trim()),
        img: char.img,
        caption,
        id: msg.key.id,
        timer: setTimeout(async () => {
          if (global.gameMonte[chatId]?.current) {
            const ans = global.gameMonte[chatId].current.answer;
            global.gameMonte[chatId] = null; 
            await conn.sendMessage(chatId, { 
              text: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n⏰ *الوقت انتهى!*\nلم يتمكن أحد من الإجابة.\n💡 الإجابة الصحيحة هي: *${ans}*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
              contextInfo: context(m.sender)
            });
          }
        }, 60000)
      }
    };

  } catch (e) {
    console.error(e);
    conn.reply(m.chat, '❌ حدث خطأ فني أثناء تشغيل اللعبة.', m);
  }
};

handler.before = async (m, { conn }) => {
  const g = global.gameMonte?.[m.chat];
  if (!g?.current) return false;
  
  const cur = g.current;
  
  // شرط الريبلاي الصارم على رسالة السؤال
  const isReply = m.quoted ? m.quoted.id : null;
  if (!isReply || isReply !== cur.id) return false;
  
  if (!m.text) return false;
  const answer = m.text.toLowerCase().trim();

  if (answer === cur.answer) {
    clearTimeout(cur.timer);
    global.gameMonte[m.chat] = null; 

    if (global.db?.data?.users?.[m.sender]) {
      global.db.data.users[m.sender].xp = (global.db.data.users[m.sender].xp || 0) + 500;
      global.db.data.users[m.sender].cookies = (global.db.data.users[m.sender].cookies || 0) + 10;
    }
    
    await conn.sendMessage(m.chat, {
      text: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n🎉 *إجابة صحيحة وممتازة!*\n👤 الفائز: @${m.sender.split('@')[0]}\n💡 الجواب هو: *${m.text}*\n💰 الجائزة: +500xp 🪙 | +10 كوكيز 🍪\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
      mentions: [m.sender],
      contextInfo: context(m.sender)
    }, { quoted: m });
    await m.react('✅');
  } else {
    if (cur.opts.includes(answer)) {
      await conn.sendMessage(m.chat, { 
         text: "❌ إجابة خاطئة! حاول مرة أخرى.",
         contextInfo: context(m.sender)
      }, { quoted: m });
      await m.react('❌');
    }
  }
  return true;
};

handler.usage = ["احزر"];
handler.command = ['احزر'];
handler.category = "games";
export default handler;
