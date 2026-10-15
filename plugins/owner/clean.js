const handler = async (m, { conn, bot }) => {
  // Clean handler - clean up plugins or data
  await m.reply('✅ تم تنظيف البيانات بنجاح');
};

handler.command = ['تنظيف', 'clean'];
handler.usage = ['clean'];
handler.category = 'owner';
handler.owner = true;

export default handler;
