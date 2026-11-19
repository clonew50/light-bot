import { askAI } from "../../system/aiService.js";

const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر 🏯*");

  let loadingMsg = null;
  try {
    loadingMsg = await conn.sendMessage(m.chat, {
      contextInfo: context(m.sender),
      text: "```⏳ اطـمـن، أنـا مـوجـود هـنـا...```"
    }, { quoted: m });
  } catch {}

  const system = `
انت بوت واتساب بـ اسم [إيتاتشي، Itachi] تجسيد لـ شخصية Itachi Uchiha من انمي [Naruto Shippuden] وتكلم بـ لهجة عربية.
طريقة كلامك: غير مهتم ظاهرياً، فاهم جداً من جوه، كلامك عميق ومحسوب، بارد الأعصاب، بتتكلم بهدوء شديد وبتنهي الكلام بحكمة.
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

handler.usage = ["إيتاتشي"];
handler.category = "ai";
handler.command = ["إيتاتشي", "itachi"];

export default handler;

const context = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
  forwardedNewsletterMessageInfo: {
    newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
    newsletterName: '𝑰𝑻𝑨𝑪𝑯𝑰 ┇🏯┇ 𝑨𝑰',
    serverMessageId: 0
  },
  externalAdReply: {
    title: "𝑰𝑻𝑨𝑪𝑯𝑰 𝑭𝑹𝑶𝑴 𝑵𝑨𝑹𝑼𝑻𝑶 𝑺𝑯𝑰𝑷𝑷𝑼𝑫𝑬𝑵 🏯",
    body: "𝙷𝚖... 𝚒𝚗𝚝𝚎𝚛𝚎𝚜𝚝𝚒𝚗𝚐 🏯",
    sourceUrl: '',
    mediaType: 1
  }
});