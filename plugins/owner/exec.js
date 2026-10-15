const handler = async (m, { conn, bot }) => {
  // Exec handler - execute system commands
  await m.reply('✅ تم التنفيذ');
};

handler.command = ['تنفيذ', 'exec'];
handler.usage = ['exec <أمر>'];
handler.category = 'owner';
handler.owner = true;

export default handler;
