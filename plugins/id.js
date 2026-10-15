const handler = async (m, { conn }) => {
  try {
    if (!m.isGroup) {
      return m.reply(`🆔 *رقمك:* ${m.sender.split('@')[0]}\n🪪 *الـLID:* ${m.lid || m.sender}`);
    }

    const metadata = await conn.groupMetadata(m.chat);
    const senderBase = m.sender.split('@')[0];
    const participant = metadata.participants?.find(item =>
      item.id === m.sender ||
      item.phoneNumber === m.sender ||
      item.id?.split('@')[0] === senderBase ||
      item.phoneNumber?.split('@')[0] === senderBase
    );

    if (!participant) return m.reply('❌ مستخدمك مش موجود في بيانات الجروب.');

    const info = {
      name: m.pushName || m.name || 'غير معروف',
      jid: participant.phoneNumber || participant.id,
      lid: participant.id || m.lid || m.sender
    };

    return m.reply(`🆔 *بياناتك في الجروب*
\n` +
      `🏷️ الاسم: ${info.name}\n` +
      `📱 الرقم: ${info.jid}\n` +
      `🪪 الـLID: ${info.lid}`);
  } catch (error) {
    console.error(error);
    await m.reply(`❌ ${error.message || error}`);
  }
};

handler.command = ['لمطور', 'id'];
handler.usage = ['id'];
handler.category = 'info';

export default handler;
