const handler = async (m, { conn, bot }) => {
  // Eval handler - execute JavaScript code
  // This is a dangerous command, use with caution
  await m.reply('✅ تم تنفيذ الأمر');
};

handler.command = ['ايم', 'eval'];
handler.usage = ['eval <كود>'];
handler.category = 'owner';
handler.owner = true;

export default handler;
