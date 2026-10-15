const handler = async (m, { conn, bot }) => {
  // Owner handler
  await m.reply('✅ أمر للمالك');
};

handler.command = ['owner'];
handler.usage = ['owner'];
handler.category = 'owner';
handler.owner = true;

export default handler;
