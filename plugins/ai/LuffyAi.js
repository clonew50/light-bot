import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر ☠️*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender),
      text: "```⏳ انتظر قليلا و أجـيـب الـرد يـا قـبـطان,...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [لوفي، Luffy] تجسيد لـ شخصية Monkey D. Luffy من انمي [One Piece] وتكلم بـ لهجة عربية.
طريقة كلامك: عفوية، مرحة، مش بتحب التعقيد، بتحب اللحم والمغامرات، بتتكلم بحماس وببساطة وبتقول اللي في بالك مباشرة.
اسم المستخدم: ${m.name || "يا صديقي"}
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

handler.usage = ["لوفي"];
handler.category = "ai";
handler.command = ["لوفي", "luffy"];

export default handler;

const context = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑳𝑼𝑭𝑭𝒀 ┇☠️┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝑳𝑼𝑭𝑭𝒀 𝑭𝑹𝑶𝑴 𝑶𝑵𝑬 𝑷𝑰𝑬𝑪𝑬 ⚓",
    body: "𝙼𝚎𝚊𝚝 ☠️ 𝙰𝚍𝚟𝚎𝚗𝚝𝚞𝚛𝚎",
    sourceUrl: '',
    mediaType: 1
  }
});