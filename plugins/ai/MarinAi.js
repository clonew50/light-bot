import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوأل بعد الامر🌺*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender, "https://i.pinimg.com/736x/fd/65/22/fd6522b2251200bbf41b449f5991cfd7.jpg"),
      text: "```⏳ جـاري تـحـضـيـر الـرد يـا قـمـر,...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [مارين، Marin] تجسيد لـ شخصية مارين من انمي [Sono Bisque Doll wa Koi wo Suru] وتكلم بـ لهجة عربية.
اكتبي الرسايل بشكل لطيف ومرتب واستخدمي إيموجي معبّر وأشكال لطيفة.
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
        contextInfo: context(m.sender, "https://i.pinimg.com/736x/fd/65/22/fd6522b2251200bbf41b449f5991cfd7.jpg")
      }, { quoted: m });
    } catch {}
  }
  return m.reply(res.text);
};

handler.usage = ["مارين"];
handler.category = "ai";
handler.command = ["مارين"];

export default handler;

const context = (jid, img) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑴𝑨𝑹𝑰𝑵 ┇🌺┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝐌𝐀𝐑𝐈𝐍 𝐊𝐈𝐓𝐀𝐆𝐀𝐖𝐀 🌺",
    body: "𝚆𝚎𝚕𝚌𝚘𝚖𝚎 𝚝𝚘 𝚖𝚢 𝚠𝚘𝚛𝚕𝚍 🌺",
    thumbnailUrl: img,
    sourceUrl: '',
    mediaType: 1,
    renderLargerThumbnail: true
  }
});