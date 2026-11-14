const handler = async (m, { conn, args }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس');
const res = await (await import("meowsab")).Scrapy.Matching();
const { data } = JSON.parse(res);


 await conn.sendButtonNormal(m.chat, {
  media: { url: data.boy },
  mediaType: 'image', 
  caption: `# Boy 🚹`,
  buttons: [

        { name: "cta_url", params: { display_text: "📎╎ مــســتــودع الـبــوت ", url: "https://github.com/clonew50/light-bot" } },

  ], 
  mentions: [m.sender],
  newsletter: {
      name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      jid: (process.env.BOT_NEWSLETTER_JID || '')
    },
}, global.reply_status)



return await conn.sendButtonNormal(m.chat, {
  media: { url: data.girl },
  mediaType: 'image', 
  caption: `# girl 🚺`,
  buttons: [

        { name: "quick_reply", params: { display_text: "▶️ ╎ الـتـالـي ", id: ".تطقيم" } },

  ], 
  mentions: [m.sender],
  newsletter: {
      name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      jid: (process.env.BOT_NEWSLETTER_JID || '')
    },
}, global.reply_status)

};
handler.usage =  ["تطقيم"];
handler.category = "group";
handler.group = true;
handler.command = ["ماتشينج", "تطقيم"];

export default handler;