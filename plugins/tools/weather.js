/*
  ═══════════════════════════════════════════
  🌤️ الطقس — Open-Meteo (مجاني بدون مفتاح، يدعم أسماء المدن بالعربي)
  الأمر: .طقس <مدينة>  |  .جو <مدينة>  |  .weather <city>
  ═══════════════════════════════════════════
*/
import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT = 25000;
const COOLDOWN = 10 * 1000;

/* كولداون في الذاكرة زي plugins/bank/theft.js */
const cooldown = new Map();

const FOOTER = "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻";

/* أكواد WMO من Open-Meteo → وصف عربي + إيموجي */
const WMO = {
  0:  ["صافي", "☀️"], 1: ["صافي جزئياً", "🌤️"], 2: ["غائم جزئياً", "⛅"], 3: ["غائم", "☁️"],
  45: ["ضباب", "🌫️"], 48: ["ضباب متجمد", "🌫️"],
  51: ["رشات خفيفة", "🌦️"], 53: ["رشات متوسطة", "🌦️"], 55: ["رشات كثيفة", "🌦️"],
  56: ["رشات متجمدة", "🌧️"], 57: ["رشات متجمدة كثيفة", "🌧️"],
  61: ["مطر خفيف", "🌧️"], 63: ["مطر متوسط", "🌧️"], 65: ["مطر غزير", "⛈️"],
  66: ["مطر متجمد", "🌧️"], 67: ["مطر متجمد غزير", "🌧️"],
  71: ["ثلوج خفيفة", "🌨️"], 73: ["ثلوج متوسطة", "🌨️"], 75: ["ثلوج كثيفة", "❄️"], 77: ["حبيبات ثلج", "❄️"],
  80: ["زخات مطر خفيفة", "🌦️"], 81: ["زخات مطر متوسطة", "🌧️"], 82: ["زخات مطر غزيرة", "⛈️"],
  85: ["زخات ثلج خفيفة", "🌨️"], 86: ["زخات ثلج كثيفة", "❄️"],
  95: ["عواصف رعدية", "⛈️"], 96: ["عواصف رعدية مع برد", "⛈️"], 99: ["عواصف رعدية شديدة مع برد", "⛈️"]
};

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text || !text.trim())
      return m.reply(`📌 اكتب اسم المدينة بعد الأمر\nمثال: ${usedPrefix}${command} القاهرة\nأو: ${usedPrefix}${command} الرياض`);

    const city = text.trim();

    /* كولداون ضد السبام */
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN)
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية`);

    cooldown.set(m.sender, now);

    try { await m.react("🌍"); } catch (e) {}

    /* 1) البحث عن المدينة (بيفهم العربي، ولو الإملاء ناقص همزات نجرب مصدر تاني) */
    let place = await geocode(city);
    if (!place) place = await geocodeOSM(city);
    if (!place) {
      try { await m.react("❌"); } catch (e) {}
      return m.reply(`❌ ملقتش مدينة باسم "${city}"، اكتبها صح أو بالإنجليزي`);
    }

    /* 2) جلب حالة الطقس */
    const w = await getWeather(place.latitude, place.longitude);
    const code = w.current?.weather_code ?? 0;
    const [desc, icon] = WMO[code] || ["غير معروف", "🌡️"];
    const cur = w.current || {};

    const reply = `❐═━━━═╊⊰🌤️⊱╉═━━━═❐
*${icon} ┇ طقس ${place.name} ┇ ${icon}*
*📍 البلد:* ${place.country}${place.admin1 && place.admin1 !== place.name ? ` — ${place.admin1}` : ""}

🌡️ *الحرارة:* ${cur.temperature_2m}°C
🥵 *الإحساس الفعلي:* ${cur.apparent_temperature}°C
💧 *الرطوبة:* ${cur.relative_humidity_2m}%
💨 *الرياح:* ${cur.wind_speed_10m} كم/س
🔍 *الحالة:* ${desc}
🗓️ *أعلى/أقل اليوم:* ${w.daily?.temperature_2m_max?.[0] ?? "—"}° / ${w.daily?.temperature_2m_min?.[0] ?? "—"}°

🕐 ${cur.time || ""} — بتوقيت ${w.timezone || ""}
❐═━━━═╊⊰🩸⊱╉═━━━═❐
${FOOTER}`;

    try { await m.react("✅"); } catch (e) {}
    await m.reply(reply);
  } catch (error) {
    console.error("[weather]", error?.message || error);
    try { await m.react("❌"); } catch (e) {}
    await m.reply("❌ حصلت مشكلة في جلب الطقس: " + (error.message || error));
  }
};

async function geocode(name) {
  const { data } = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
    params: { name, count: 1, language: "ar", format: "json" },
    headers: { "User-Agent": UA },
    timeout: TIMEOUT
  });
  const r = data?.results?.[0];
  if (!r) return null;
  return {
    name: r.name,
    country: r.country || "",
    admin1: r.admin1 || "",
    latitude: r.latitude,
    longitude: r.longitude
  };
}

/* مصدر احتياطي بيتسامح مع الإملاء (مثلاً "الاسكندرية" من غير همزة) */
async function geocodeOSM(name) {
  const { data } = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: { q: name, format: "json", limit: 1, "accept-language": "ar" },
    headers: { "User-Agent": UA },
    timeout: TIMEOUT
  });
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  const parts = String(r.display_name || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    name: r.name || parts[0] || name,
    country: parts[parts.length - 1] || "",
    admin1: parts.length > 2 ? parts[parts.length - 2] : "",
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon)
  };
}

async function getWeather(lat, lon) {
  const { data } = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: 1
    },
    headers: { "User-Agent": UA },
    timeout: TIMEOUT
  });
  return data;
}

handler.command = ["طقس", "جو", "weather"];
handler.usage = ["طقس <مدينة>"];
handler.category = "tools";
handler.usePrefix = true;

export default handler;
