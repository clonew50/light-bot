const handler = async (m, { args }) => {
  const input = args?.join(' ') || '';
  await m.reply(JSON.stringify({ input, length: input.length }));
};
handler.command = ['debugyt'];
handler.usage = ['debugyt <نص>'];
handler.category = 'tools';
export default handler;