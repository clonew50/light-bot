async function test(m, { conn, bot, text }) {
  if (!text) return m.reply("#🫯: اكتب نص جنب الأمر")

  // البحث بالكلمات غير متاح (الواجهة السابقة ميتة) — استخدم .تيك <رابط>
  return m.reply(`❌ بحث تيك توك بالكلمات غير متاح حالياً.\n\nاستخدم أمر التحميل المباشر:\n.تيك <رابط فيديو تيك توك>`);
}

test.category = "search";
test.usage = ["بحث_تيك"];
test.command = ["بحث_تيك"];
export default test;