/*
  ═══════════════════════════════════════════
  🔊 تحويل النص لصوت عربي (TTS) — Google Translate TTS (مجاني بدون مفتاح)
  الأمر: .اقرأ <نص>  |  .قول <نص>  |  .tts <نص>
  بيبعت الرسالة الصوتية PTT (زي الواتس العادي)
  ═══════════════════════════════════════════
*/
import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/* حدود */
const MAX_TEXT = 1500;        // أقصى طول للنص
const CHUNK = 200;            // حد جوجل للنص الواحد (tw-ob)
const TIMEOUT = 30000;
const COOLDOWN = 10 * 1000;   // 10 ثواني لكل مستخدم

/* كولداون في الذاكرة زي plugins/bank/theft.js */
const cooldown = new Map();

/* لغات مدعومة بالاختصارات (الافتراضي عربي) */
const LANGS = {
  عربي: "ar", انجليزي: "en", انجليش: "en", فرنسي: "fr", الماني: "de",
  تركي: "tr", اسباني: "es", هندي: "hi", ياباني: "ja", روسي: "ru"
};

const handler = async (m, { conn, text, args, usedPrefix, command }) => {
  try {
    if (!text || !text.trim())
      return m.reply(`📌 اكتب النص اللي عايز البوت يقوله بعد الأمر\nمثال: ${usedPrefix}${command} اهلا بيكم في لايت بوت\nولغه تانية: ${usedPrefix}${command} انجليزي Hello world`);

    let lang = "ar";
    let content = text.trim();

    /* دعم تحديد اللغة: .اقرأ انجليزي Hello */
    const first = (args[0] || "").replace(/[:،.]/g, "").toLowerCase();
    if (LANGS[first]) {
      lang = LANGS[first];
      content = args.slice(1).join(" ").trim();
    }

    if (!content)
      return m.reply("📌 اكتب النص بعد اللغة، مثال: .اقرأ انجليزي Hello world");

    if (content.length > MAX_TEXT)
      return m.reply(`❌ النص طويل أوي، أقصى حد ${MAX_TEXT} حرف`);

    /* كولداون ضد السبام */
    const now = Date.now();
    const last = cooldown.get(m.sender) || 0;
    if (now - last < COOLDOWN)
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية`);

    cooldown.set(m.sender, now);

    try { await m.react("⏳"); } catch (e) {}

    const audio = await synthesize(content, lang);
    if (!audio || !audio.length) {
      try { await m.react("❌"); } catch (e) {}
      return m.reply("❌ فشل تحويل النص لصوت، جرب تاني");
    }

    try { await m.react("✅"); } catch (e) {}
    await conn.sendMessage(m.chat, {
      audio: audio,
      mimetype: "audio/mpeg",
      ptt: true
    }, { quoted: m });
  } catch (error) {
    console.error("[tts]", error?.message || error);
    try { await m.react("❌"); } catch (e) {}
    await m.reply("❌ حصلت مشكلة في تحويل النص لصوت: " + (error.message || error));
  }
};

/* تقسيم النص لأجزاء ≤ 200 حرف عند حدود الكلمات وتجميع الـ MP3 */
async function synthesize(text, lang) {
  const parts = chunkText(text, CHUNK);
  const buffers = [];

  for (const part of parts) {
    const res = await axios.get("https://translate.google.com/translate_tts", {
      params: { ie: "UTF-8", q: part, tl: lang, client: "tw-ob" },
      headers: { "User-Agent": UA, Referer: "https://translate.google.com/" },
      responseType: "arraybuffer",
      timeout: TIMEOUT,
      maxContentLength: 10 * 1024 * 1024
    });
    const buf = Buffer.from(res.data);
    if (!buf.length) throw new Error("رد فاضي من خدمة الصوت");
    buffers.push(buf);
  }

  return Buffer.concat(buffers);
}

function chunkText(text, size) {
  const words = text.split(/\s+/);
  const out = [];
  let cur = "";

  for (const w of words) {
    if ((cur + " " + w).trim().length > size) {
      if (cur) out.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur.trim());
  return out.filter(Boolean);
}

handler.command = ["اقرأ", "قول", "tts"];
handler.usage = ["اقرأ <نص>", "اقرأ انجليزي <نص>"];
handler.category = "voices";
handler.usePrefix = true;
handler.limit = true;

export default handler;
