/*
  ═══════════════════════════════════════════
  💱 تحويل العملات — open.er-api.com (مجاني بدون مفتاح، بيتحدث يومياً)
  الأمر: .عملة 100 دولار جنيه  |  .عملة 50 usd egp  |  .currency 10 eur
  ═══════════════════════════════════════════
*/
import axios from "axios";

const TIMEOUT = 25000;
const COOLDOWN = 10 * 1000;

/* كولداون في الذاكرة زي plugins/bank/theft.js */
const cooldown = new Map();

const FOOTER = "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻";

/* أسماء العملات بالعربي (كلمة واحدة) → كود ISO */
const CURRENCIES = {
  دولار: "USD", امريكي: "USD", جنيه: "EGP", مصري: "EGP",
  باوند: "GBP", استرليني: "GBP", بريطاني: "GBP",
  ريال: "SAR", سعودي: "SAR", درهم: "AED", اماراتي: "AED",
  دينار: "KWD", كويتي: "KWD", اردني: "JOD",
  يورو: "EUR", فرنسي: "EUR", ليرة: "TRY", تركي: "TRY",
  فرنك: "CHF", سويسري: "CHF", قطري: "QAR",
  يوان: "CNY", صيني: "CNY", ين: "JPY", ياباني: "JPY",
  روبل: "RUB", روسي: "RUB", روبيه: "INR", هندي: "INR",
  مغربي: "MAD", عراقي: "IQD", ليبي: "LYD",
  عماني: "OMR", بحريني: "BHD", يمني: "YER"
};

/* أسماء العرض للعملات الشهيرة */
const NAMES = {
  USD: "دولار أمريكي 💵", EGP: "جنيه مصري 🇪🇬", EUR: "يورو 🇪🇺",
  GBP: "جنيه إسترليني 🇬🇧", SAR: "ريال سعودي 🇸🇦", AED: "درهم إماراتي 🇦🇪",
  KWD: "دينار كويتي 🇰🇼", TRY: "ليرة تركية 🇹🇷", JPY: "ين ياباني 🇯🇵"
};

const handler = async (m, { conn, args, text, usedPrefix, command }) => {
  try {
    if (args.length < 2)
      return m.reply(`📌 الاستخدام: ${usedPrefix}${command} <المبلغ> <من> <إلى>\nمثال: ${usedPrefix}${command} 100 دولار جنيه\nأو: ${usedPrefix}${command} 50 usd egp\n\n💡 العملات المدعومة بالعربي: دولار، جنيه، ريال، درهم، دينار، يورو، ليرة، باوند...`);

    const amount = parseFloat(String(args[0]).replace(/[,\s]/g, ""));
    if (!isFinite(amount) || amount <= 0)
      return m.reply("❌ اكتب مبلغ صحيح أكبر من صفر، مثال: .عملة 100 دولار جنيه");

    const from = codeOf(args[1]);
    const to = codeOf(args[2] || "EGP");
    if (!from) return m.reply(`❌ مش عارف العملة "${args[1]}"، استخدم اسم عربي (دولار، جنيه، ريال...) أو كود ISO (USD, EGP...)`);
    if (!to) return m.reply(`❌ مش عارف العملة "${args[2]}"، استخدم اسم عربي أو كود ISO`);

    /* كولداون ضد السبام */
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN)
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية`);

    cooldown.set(m.sender, now);

    try { await m.react("💱"); } catch (e) {}

    const rate = await getRate(from, to);
    if (!rate) {
      try { await m.react("❌"); } catch (e) {}
      return m.reply("❌ خدمة أسعار الصرف مش متاحة دلوقتي، جرب بعدين");
    }

    const result = amount * rate;
    const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 2 : 4 });

    try { await m.react("✅"); } catch (e) {}
    await m.reply(`❐═━━━═╊⊰💱⊱╉═━━━═❐
*💱 ┇ تحويل العملات ┇ 💱*

💰 ${fmt(amount)} ${NAMES[from] || from} =
✅ *${fmt(result)}* ${NAMES[to] || to}

📈 *سعر الصرف:* 1 ${from} = ${fmt(rate)} ${to}
🕐 بيانات محدثة يومياً من ExchangeRate-API

❐═━━━═╊⊰🩸⊱╉═━━━═❐
${FOOTER}`);
  } catch (error) {
    console.error("[currency]", error?.message || error);
    try { await m.react("❌"); } catch (e) {}
    await m.reply("❌ حصلت مشكلة في تحويل العملة: " + (error.message || error));
  }
};

function codeOf(word) {
  if (!word) return null;
  const w = String(word).trim().toLowerCase();
  if (CURRENCIES[w]) return CURRENCIES[w];
  const upper = String(word).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

async function getRate(from, to) {
  if (from === to) return 1;
  const { data } = await axios.get(`https://open.er-api.com/v6/latest/${from}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: TIMEOUT
  });
  if (data?.result !== "success" || !data?.rates?.[to]) return null;
  return data.rates[to];
}

handler.command = ["عملة", "اسعار", "currency"];
handler.usage = ["عملة <مبلغ> <من> <إلى>"];
handler.category = "tools";
handler.usePrefix = true;

export default handler;
