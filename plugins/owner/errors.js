const run = async (m, { bot, conn }) => {
  const errors = await bot.errors();
  if (!Array.isArray(errors) || errors.length === 0) {
    return m.reply("✅ مفيش أخطاء مسجلة.");
  }

  // بنبعت الأحدث أولاً، وبنقصر العرض على آخر 50 عيرور عشان منبعتش
  // مئات الرسائل لو السجل طويل.
  const MAX_SHOWN = 50;
  const ordered = [...errors].reverse().slice(0, MAX_SHOWN);
  const hidden = errors.length - ordered.length;

  const header = () => `📋 سجل الأخطاء (الأحدث أولاً — معروض ${ordered.length} من ${errors.length}):\n`;
  const lineOf = (x) => `\n#📂 الملف: ${x.file}\n#🌱 الأمر: ${x.command}\n#❌ الايرور: ${x.error}\n==============`;

  // كل رسالة ≤ 4096 حرف (حد الواتساب)، واللي اتخبى اتذكر صراحة.
  const batches = [];
  let current = header();
  for (const entry of ordered) {
    const candidate = current + lineOf(entry);
    if (candidate.length > 4096) {
      batches.push(current);
      current = header() + lineOf(entry);
    } else {
      current = candidate;
    }
  }
  if (current.trim()) batches.push(current);
  if (hidden > 0) batches.push(`> ⏳ و${hidden} إيرور أقدم مش معروض في السجل ده.`);

  for (const batch of batches) {
    await conn.sendMessage(m.chat, { text: batch }, { quoted: m });
  }
};

run.command = ["الاخطاء"]
run.usage = ["الاخطاء"];
run.category = "owner";
run.owner = true;
export default run