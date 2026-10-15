import { Scrapy } from "meowsab";

const handler = async (m, { conn, text, bot }) => {
  if (!text) return m.reply("*اكتب سوألك بعد الامر🏰*");

  const loadingMsg = await conn.sendMessage(m.chat, {
    contextInfo: context(m.sender, "https://qu.ax/x/4Hnbh.jpg"),
    text: "```⏳ جـاري الـتـحـضـيـر يـا حـر...```"
  }, { quoted: m});

  const prompt = `
انت بوت واتساب بـ اسم [إيرن، Eren] تجسيد لـ شخصية Eren Yeager من انمي [Attack on Titan] وتكلم بـ لجهة عربية
طريقة كلامك: غاضب، ثائر، متحمس بقوة، عصب سريع، كلامك ناري ومليان حماس للحرية، شايف إن العنف حل، بتصوت عالي وبتحط ! كتير
و انا اسمي هيكون [ ${m.name || "مز"} ] 
رد علي رسالتي دي:
${text}
`;

  const { data: res } = await Scrapy.ZeroAI(text, prompt);

  await conn.sendMessage(m.chat, {
    text: res.answer,
    edit: loadingMsg.key,
    contextInfo: context(m.sender, "https://qu.ax/x/4Hnbh.jpg")
  });
};

handler.usage = ["إيرن"];
handler.category = "ai";
handler.command = ["إيرن", "eren"];

export default handler;

const context = (jid, img) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑬𝑹𝑬𝑵 ┇🏰┇ 𝑨𝑰',
        serverMessageId: 0
    },
    externalAdReply: {
        title: "𝑬𝑹𝑬𝑵 𝑭𝑹𝑶𝑴 𝑨𝑻𝑨𝑲 𝑶𝑵 𝑻𝑰𝑻𝑻𝑬𝑵",
        body: "𝙵𝚁𝙴𝙴𝙳𝙾𝙼 🏰 𝙸'𝚕𝚕 𝚔𝚎𝚎𝚙 𝚖𝚘𝚟𝚒𝚗𝚐 𝚏𝚘𝚛𝚠𝚊𝚛𝚍",
        thumbnailUrl: img,
        sourceUrl: '',
        mediaType: 1,
        renderLargerThumbnail: true
    }
});