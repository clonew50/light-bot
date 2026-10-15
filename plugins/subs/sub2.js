const run = async (m, { args, conn, bot }) => {
/*
if (subBots.list().length >= 30) {
  return m.reply("خلاص العدد اكتمل");
} // عدد البوتات الي مسموح ب ربطهم فقط
*/
  if (global.db.noSub) return m.reply("المطور قافل التنصيب");

  // التحقق من إدخال الرقم بعد الأمر
  if (!args[0]) {
    return m.reply(`⚠️ *يرجى إدخال رقم الهاتف مع رمز الدولة.*\n\n_طريقة الاستعمال:_\n.تنصيب2 218945778513`);
  }

  try {
    // تنظيف الرقم المدخل من المسافات أو الرموز الزائدة
    const num = args[0].replace(/[+\s-]/g, '');

    if (!/^\d+$/.test(num)) return m.reply("⚠️ رقم الهاتف غير صالح، تأكد من كتابة أرقام صحيحة.");

    const sub = global.subBots;
    if (!sub) return m.reply("❌ نظام البوتات الفرعية غير متاح");

    const init = await m.reply(`⏳ جاري تنصيب بوت للرقم *${num}*...`);

    const state = { uid: null, pairDone: false, resolved: false, pending: null };

    const { images: img } = bot.config.info;

    const cleanup = () => {
      sub.off('pair', handlers.pair);
      sub.off('ready', handlers.ready);
      sub.off('error', handlers.error);
    };

    const handlers = {
      pair: (id, code) => {
        if (state.pairDone) return;
        if (!state.uid) { 
          state.pending = { id, code }; 
          return; 
        }
        if (id !== state.uid) return;
        state.pairDone = true;
        Func.pair(conn, code, num, m, init);
      },
      ready: (id) => {
        if (id !== state.uid || state.resolved) return;
        state.resolved = true;
        Func.ready(conn, num, m, img[Math.floor(Math.random() * img.length)]);
        cleanup();
      },
      error: (id, err) => {
        if (id !== state.uid || state.resolved) return;
        state.resolved = true;
        Func.error(conn, num, err, m);
        cleanup();
      },
    };

    sub.on('pair', handlers.pair);
    sub.on('ready', handlers.ready);
    sub.on('error', handlers.error);

    state.uid = await sub.add(num);

    if (state.pending?.id === state.uid && !state.pairDone) {
      state.pairDone = true;
      Func.pair(conn, state.pending.code, num, m, init);
    }

    setTimeout(() => {
      if (state.resolved) return;
      state.resolved = true;
      Func.timeout(conn, m, state.pairDone);
      cleanup();
    }, 120000);

  } catch (error) {
    await m.reply(error.message);
  }
};

run.command = ["تنصيب2"];
run.noSub = false;
run.usage = ["تنصيب <الرقم>"];
run.category = "sub";
export default run;

const Func = {
  pair: async (conn, code, num, m, reply_status) => {
    await conn.sendButton(m.chat, {
      imageUrl: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/df4a4068-978a-4f77-afa8-bb5dd22968e1.jpg",
      bodyText: `🔐⤿ نـظـام الـبـوتـات الـفـرعـيـه 
❐═━━━═╊⊰🩸⊱╉═━━━═❐
📱 — الرقم: ${num}
🔑 — الكود: ${code}
❐═━━━═╊⊰🩸⊱╉═━━━═❐
خطوات ربط البوت:
1️⃣ افتح تطبيق واتساب.
2️⃣ اذهب إلى الإعدادات ثم الأجهزة المرتبطة.
3️⃣ اضغط على ربط جهاز ثم اختر (ربط برقم الهاتف بدلاً من ذلك).
4️⃣ أدخل الكود الظاهر أعلاه في هاتفك.`,
      footerText: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻",
      buttons: [
        { name: "cta_copy", params: { display_text: "🩸┇انسخ الكود┇📖", copy_code: code } }
      ],
      mentions: [m.sender],
      newsletter: {
        name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        jid: '120363405545946827@newsletter'
      },
      interactiveConfig: {
        buttons_limits: 10,
        list_title: "𝑳𝑰𝑮𝑯𝑻 𝑺𝑼𝑩 𝑩𝑶𝑻",
        button_title: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻",
        canonical_url: `https://code.com/${code}`
      }
    }, global.reply_status);
  },

  ready: async (conn, num, m, img) => {
    await m.react("✅");
    await conn.sendMessage(m.chat, {
      image: { url: img },
      caption: `✅ — *تـم الاتـصـال بـنـجـاح*\n\n📱 الرقم: ${num}\n> *البوت جاهز للاستخدام الآن*`
    }, { quoted: m });
  },

  error: async (conn, num, err, m) => {
    await m.reply(`❌ *فشل الاقتران!*\n\n📱 الرقم: ${num}\n⚠️ الخطأ: ${err?.message || 'غير معروف'}`);
  },

  timeout: async (conn, m, pairDone) => {
    await m.reply(pairDone
      ? `⏰ تم إرسال الكود لكن لم يتم تأكيد الاتصال.\nتأكد من إدخال الكود في واتساب.`
      : `⏰ لم يتم استلام كود الاقتران خلال 120 ثانية.\nالرجاء المحاولة مرة أخرى.`
    );
  }
};
