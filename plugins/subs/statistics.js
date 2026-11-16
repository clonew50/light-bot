const run = async (m, { conn, bot }) => {
  const sub = global.subBots;
  if (!sub) return m.reply("❌ نـظـام الـبـوتـات الـفـرعـيـه غير متاح");

  // حرس وصول الداتابيز/الجلسة (todo 29f): الجلسة أو الإحصاءات ممكن تكون
  // مش جاهزة وقت النداء → ردود عربية بدل الـ TypeError.
  let stats = null;
  try {
    stats = sub.stats();
  } catch (e) {
    return m.reply("❌ تعذّر حساب إحصاءات البوتات الفرعية، جرب تاني بعد شوية.");
  }

  const mainId = bot?.sock?.user?.id;
  const mainNum = mainId ? mainId.split('@')[0] : 'غير معروف';

  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const text = `📊 احـصـائـيـات الـبـوتـات الـفـرعـيـه 
❐═━━━═╊⊰📖⊱╉═━━━═❐
📈 — المجموع: ${stats.total}
🟢 — متصل: ${stats.connected}
🔴 — غير متصل: ${stats.disconnected}
💬 — الرسائل: ${stats.totalMessages}
❐═━━━═╊⊰📖⊱╉═━━━═❐
⏱️ — مدة التشغيل: ${days} يوم ${hours} ساعة ${minutes} دقيقة
❐═━━━═╊⊰🩸⊱╉═━━━═❐
🆔 — البوت الرئيسي: ${mainNum}
❐═━━━═╊⊰🩸⊱╉═━━━═❐
> *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*`;

  await m.reply(text);
};

run.command = ["احصائيات"];
run.noSub = true;
run.usage =  ["احصائيات"];
run.category = "sub";
export default run;