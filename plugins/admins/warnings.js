import { getWarnings } from '../../system/warnings.js';

const handler = async (m, { conn }) => {
  const id = m.sender;
  const count = getWarnings(m.chat, id);

  if (!count) {
    return conn.sendMessage(m.chat, {
      text: `*📊 @${id.split("@")[0]} معندكش أي إنذارات*`,
      mentions: [id]
    }, { quoted: global.reply_status });
  }

  await conn.sendMessage(m.chat, {
    text: `*📊 @${id.split("@")[0]} إنذاراتك: ${count}\n⚠️ عند 3 إنذارات سيتم طردك*`,
    mentions: [id]
  }, { quoted: global.reply_status });
};

handler.command = ["انذاراتي", "warns", "warnings", "الانذارات"];
handler.usage = ['الانذارات'];
handler.category = "admin";

export default handler;