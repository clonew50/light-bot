import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر🏰*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender),
      text: "```⏳ جـاري الـتـحـضـيـر يـا حـر...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [إيرن، Eren] تجسيد لـ شخصية Eren Yeager من انمي [Attack on Titan] وتكلم بـ لهجة عربية.
طريقة كلامك: غاضب، ثائر، متحمس بقوة، كلامك ناري ومليان حماس للحرية، بتحط ! كتير.
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

handler.usage = ["إيرن"];
handler.category = "ai";
handler.command = ["إيرن", "eren"];

export default handler;

const context = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑬𝑹𝑬𝑵 ┇🏰┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝑬𝑹𝑬𝑵 𝑭𝑹𝑶𝑴 𝑨𝑻𝑻𝑨𝑪𝑲 𝑶𝑵 𝑻𝑰𝑻𝑨𝑵",
    body: "𝙵𝚁𝙴𝙴𝙳𝙾𝙼 🏰 𝙸'𝚕𝚕 𝚔𝚎𝚎𝚙 𝚖𝚘𝚟𝚒𝚗𝚐 𝚏𝚘𝚛𝚠𝚊𝚛𝚍",
    sourceUrl: '',
    mediaType: 1
  }
});