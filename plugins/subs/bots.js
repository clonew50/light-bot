const handler = async (m, { conn }) => {
  // Bots handler - list or manage bots
  await m.reply('✅ قائمة البوتات');
};

handler.command = ['البوتات'];
handler.usage = ['البوتات'];
handler.category = 'subs';

export default handler;
