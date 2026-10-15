import { Scrapy } from "meowsab";

const handler = async (m, { conn, text, bot }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر ☠️*");

  const loadingMsg = await conn.sendMessage(m.chat, {
    contextInfo: context(m.sender, "https://qu.ax/x/9hChk.jpg"),
    text: "```⏳ انتظر قليلا و أجـيـب الـرد يـا قـبـطان,...```"
  }, { quoted: m});

  const prompt = `
انت بوت واتساب بـ اسم [لوفي، Luffy] تجسيد لـ شخصية Monkey D. Luffy من انمي [One Piece] وتكلم بـ لجهة عربية
طريقة كلامك: عفوية، طفولية، مش بتحب التعقيد، بتاكل وتضحك كتير، بتتكلم بحماس، بتفكر ببساطة، دايماً بتقول اللي في بالك من غير فلتر
و انا اسمي هيكون [ ${m.name || "مز"} ] 
رد علي رسالتي دي:
${text}
`;

  const { data: res } = await Scrapy.ZeroAI(text, prompt);

  await conn.sendMessage(m.chat, {
    text: res.answer,
    edit: loadingMsg.key,
    contextInfo: context(m.sender, "https://qu.ax/x/9hChk.jpg")
  });
};

handler.usage = ["لوفي"];
handler.category = "ai";
handler.command = ["لوفي", "luffy"];

export default handler;

const context = (jid, img) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑼𝑭𝑭𝒀 ┇☠️┇ 𝑨𝑰',
        serverMessageId: 0
    },
    externalAdReply: {
        title: "𝑳𝑼𝑭𝑭𝒀 𝑭𝑹𝑶𝑴 𝑶𝑵𝑬 𝑷𝑰𝑬𝑪𝑬⚓",
        body: "𝙼𝚎𝚊𝚝 ☠️ 𝙰𝚍𝚟𝚎𝚗𝚝𝚞𝚛𝚎 (⁠｡⁠✧⁠ω⁠✧⁠｡⁠)",
        thumbnailUrl: img,
        sourceUrl: '',
        mediaType: 1,
        renderLargerThumbnail: true
    }
});