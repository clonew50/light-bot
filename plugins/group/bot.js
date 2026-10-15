const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('❌ الأمر ده داخل الجروبات بس.');

  await conn.sendMessage(m.chat, {
    video: {
      url: 'https://files.catbox.moe/bqxzcl.mp4',
      caption: '💥 *بوم!*'
    },
    mentions: [m.sender]
  }, { quoted: m });
};

handler.command = ['بوم'];
handler.usage = ['بوم'];
handler.category = 'group';
handler.group = true;
handler.usePrefix = false;

export default handler;
