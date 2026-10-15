const handler = async (m, { conn, args }) => {
    const metadata = await conn.groupMetadata(m.chat);
    const participants = metadata.participants;
    const groupMembers = participants.filter(p => !p.admin).map(p => p.id);

    const shuffledMembers = [...groupMembers].sort(() => Math.random() - 0.5);

    const pesan = args.join(' ');
    let messageText = "";
    messageText += `👤│ الـاســم: ${metadata.subject}\n`;
    messageText += `📜│ تـاريـخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    if (pesan) messageText += `📝│ الـرسـالـة: ${pesan}\n`;
    messageText += `\n`;

    messageText += `↓👥 *الاعـضـاء فـقـط (${shuffledMembers.length})* 👥↓\n`;
    messageText += "```❐═━━━═╊⊰🩸⊱╉═━━━═❐\n";
    shuffledMembers.forEach((member, index) => {
        messageText += `│ ${index + 1}. @${member.split('@')[0]}\n`;
    });
    messageText += "❐═━━━═╊⊰🩸⊱╉═━━━═❐```\n\n";

    messageText += `> *إجمالي الأعضاء المستهدفين — ${shuffledMembers.length}*`;

    return conn.sendMessage(m.chat, { 
        text: messageText, 
        mentions: groupMembers
    }, { quoted: m });
};

handler.usage = ["منشن_اعضاء"];
handler.category = "admin";
handler.command = ["منشن_اعضاء"];
handler.admin = true;
handler.group = true;

export default handler;
