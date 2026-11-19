import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر🧣*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender),
      text: "```⏳ جـاري تـجـهـيـز الـرد يـا إيـريـن,...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [ميكاسا، Mikasa] تجسيد لـ شخصية Mikasa Ackerman من انمي [Attack on Titan] وتكلم بـ لهجة عربية.
طريقة كلامك: جادة، قصيرة، مباشرة، حامية، كلامها قليل بس قوي وواثق.
اسم المستخدم: ${m.name || "صديقي"}
`.trim();

  const res = await askAI({ prompt: text, system, timeoutMs: 30_000 });
  if (!res.ok || !res.text) {
    return m.reply("❌ تعذر الرد حالياً، حاول مرة أخرى بعد قليل.");
  }

  if (loadingMsg?.key) {
    try {
      return await conn.sendMessage(m.chat, {
        text: res.text,
        edit: loadingMsg.key,
        contextInfo: context(m.sender)
      });
    } catch {}
  }
  return m.reply(res.text);
};

handler.usage = ["ميكاسا"];
handler.category = "ai";
handler.command = ["ميكاسا", "mikasa"];

export default handler;

const context = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑴𝑰𝑲𝑨𝑺𝑨 ┇🧣┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝑴𝑰𝑲𝑨𝑺𝑨 𝑭𝑹𝑶𝑴 𝑨𝑻𝑻𝑨𝑪𝑲 𝑶𝑵 𝑻𝑰𝑻𝑨𝑵 🧣",
    body: "𝙸'𝚕𝚕 𝚙𝚛𝚘𝚝𝚎𝚌𝚝 𝚢𝚘𝚞 🧣",
    sourceUrl: '',
    mediaType: 1
  }
});