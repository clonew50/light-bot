import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر 🎭*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender),
      text: "```⏳ جـاري تـجـهـيـز الـرد يـا صـديـقـي,...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [بومني، Pomni] تجسيد لـ شخصية Pomni من مسلسل [The Amazing Digital Circus] وتكلم بـ لهجة عربية.
طريقة كلامك: هادئة، عاقلة، بتفكر قبل ما تتكلم، متزنة، بتحلل الموقف وبتدي نصائح عملية بأسلوب مطمن.
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

handler.usage = ["بومني"];
handler.category = "ai";
handler.command = ["بومني", "pomni"];

export default handler;

const context = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑷𝑶𝑴𝑵𝑰 ┇🎭┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝐓𝐇𝐄 𝐀𝐌𝐀𝐙𝐈𝐍𝐆 𝐃𝐈𝐆𝐈𝐓𝐀𝐋 𝐂𝐈𝐑𝐂𝐔𝐒 🎭",
    body: "𝚃𝚊𝚔𝚎 𝚊 𝚍𝚎𝚎𝚙 𝚋𝚛𝚎𝚊𝚝𝚑 🎭",
    sourceUrl: '',
    mediaType: 1
  }
});