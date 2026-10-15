/*
code: game eye anime
by: 𝐓𝐨جي
format: text based + strict reply mandatory + lock only during 60s + auto unlock on timeout
*/

const NAMES = [
  "ايرين","نيزوكو","سوكونا","موازن","كيلوا","غون","ايتاتشي","ساسكي","دابي","اوبيتو",
  "نوبارا","ليفاي","يوتا","فريدا","شيده","ياماتو","نامي","ايمو","انيا","جينبي",
  "بوروتو","شانكس","لاو","لوفي","زورو","اكازا","ميكاسا","رين","دوما","كانيكي",
  "غوجو","ساي","نيجي","انمي","ساكورا","اوريتشمارو","ماهيتو","جيرايا","روبين",
  "سانجي","ميهوك","كايدو","مايكي","كورابيكا","شيغاراكي","تينغن","تانجيرو",
  "ميدوريا","كونان","الكيورا","شوتو","غاتارو","بارو","غارا","باكوغو","ماكيما",
  "توجا","باين","كوراما"
];

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

const handler = async (m, { conn }) => {
  const chatId = m.chat;
  if (!global.gameEye) global.gameEye = {};
  
  // منع استدعاء سؤال جديد فقط إذا كان السؤال الحالي لا يزال في فترة الـ 60 ثانية ولم ينتهِ وقته
  if (global.gameEye[chatId]?.current) {
    return await conn.sendMessage(chatId, {
      text: `⚠️ *عذراً! لا يمكن استدعاء سؤال جديد حالياً.*\nهناك سؤال قائم بالفعل لم تنتهِ مدته (60 ثانية) بعد!\n\n💡 انتظر انتهاء الوقت أو قم بالرد عليه وحله لفتح الجولة.`,
    }, { quoted: m });
  }

  try {
    await m.react('👁️');
    
    const data = await fetch("https://raw.githubusercontent.com/fjfilhfjjg-boop/Pomni-AI/refs/heads/main/%D8%B9%D9%8A%D9%86.md").then(r => r.json());
    const char = data[Math.floor(Math.random() * data.length)];
    
    const wrong = shuffle([...NAMES]).filter(n => n !== char.name).slice(0, 3);
    const opts = shuffle([char.name, ...wrong]);
    
    const caption = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*👁 ┇ مسابقة تخمين شخصية الأنمي من العين ┇ 👁*\n\n*الخيارات:*\n1. ≺ ${opts[0]} ≺\n2. ≺ ${opts[1]} ≺\n3. ≺ ${opts[2]} ≺\n4. ≺ ${opts[3]} ≺\n\n⏳ الوقت: 60 ثانية\n🪙 الجائزة: 500xp + 10 كوكيز\n\n⚠️ *ملاحظة:* يجب الرد (ريبلاي) على هذه الرسالة بالإجابة لكي تُحتسب!\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`;
    
    const msg = await conn.sendMessage(chatId, {
      image: { url: char.img },
      caption
    }, { quoted: m });
    
    global.gameEye[chatId] = {
      current: {
        answer: char.name.toLowerCase().trim(),
        opts: opts.map(o => o.toLowerCase().trim()),
        img: char.img,
        caption,
        id: msg.key.id,
        timer: setTimeout(async () => {
          if (global.gameEye[chatId]?.current) {
            const ans = global.gameEye[chatId].current.answer;
            global.gameEye[chatId] = null; // تصفير الجلسة تلقائياً هنا فور انتهاء الـ 60 ثانية لفتح القفل واستقبال أمر جديد
            await conn.sendMessage(chatId, { 
              text: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n⏰ *الوقت انتهى (60 ثانية)!*\nلم يقم أحد بتخمين الشخصية في الوقت المحدد.\n\n💡 الإجابة الصحيحة هي: *${ans}*\n\n📥 فتح القفل تلقائياً! يمكنك الآن كتابة *.عين* لاستدعاء سؤال جديد.\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`
            });
          }
        }, 60000)
      }
    };

  } catch (e) {
    console.error(e);
    conn.reply(m.chat, '❌ حدث خطأ فني أثناء جلب الصورة.', m);
  }
};

handler.before = async (m, { conn }) => {
  const g = global.gameEye?.[m.chat];
  if (!g?.current) return false;
  
  const cur = g.current;
  
  // شرط الرد الصارم (الريبلاي) على رسالة السؤال تحديداً
  const isReply = m.quoted ? m.quoted.id : null;
  if (!isReply || isReply !== cur.id) return false;
  
  if (!m.text) return false;
  const answer = m.text.toLowerCase().trim();

  if (answer === cur.answer) {
    clearTimeout(cur.timer);
    global.gameEye[m.chat] = null; // تصفير وقتل الجلسة عند الإجابة الصحيحة قبل انتهاء الوقت

    if (global.db?.data?.users?.[m.sender]) {
      global.db.data.users[m.sender].xp = (global.db.data.users[m.sender].xp || 0) + 500;
      global.db.data.users[m.sender].cookies = (global.db.data.users[m.sender].cookies || 0) + 10;
    }
    
    await conn.sendMessage(m.chat, {
      text: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n🎉 *إجابة صحيحة وتخمين أسطوري! 🥇*\n👤 الفائز: @${m.sender.split('@')[0]}\n💡 الشخصية هي: *${m.text}*\n💰 الجائزة: +500xp 🪙 | +10 كوكيز 🍪\n\n📥 يمكنك الآن كتابة *.عين* بحرية لاستدعاء سؤال جديد.\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
      mentions: [m.sender]
    }, { quoted: m });
    await m.react('✅');
  } else {
    if (cur.opts.includes(answer)) {
      await conn.sendMessage(m.chat, { 
         text: "❌ إجابة خاطئة! ركز في تفاصيل العين وحاول مجدداً.",
      }, { quoted: m });
      await m.react('❌');
    }
  }
  return true;
};

handler.command = ['عين', 'eye'];
handler.category = "games";
handler.group = true; 

export default handler;
