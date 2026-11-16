import { splitText, mentionsIn, MAX_MENTIONS } from "../../system/text-chunks.js";

const handler = async (m, { conn, args }) => {
    const metadata = await conn.groupMetadata(m.chat);
    const participants = metadata.participants;
    const groupAdmins = participants.filter(p => p.admin).map(p => p.id);
    const groupMembers = participants.filter(p => !p.admin).map(p => p.id);

    const shuffledAdmins = [...groupAdmins].sort(() => Math.random() - 0.5);
    const shuffledMembers = [...groupMembers].sort(() => Math.random() - 0.5);

    const pesan = args.join(' ');
    let messageText = "";
    messageText += `👤│ الـاســم: ${metadata.subject}\n`;
    messageText += `📜│ تـاريـخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    if (pesan) messageText += `📝│ الـرسـالـة: ${pesan}\n`;
    messageText += `\n`;

    messageText += `↓👑 *الـمـشـرفـيـن (${shuffledAdmins.length})* 👑↓\n`;
    messageText += "```❐═━━━═╊⊰🩸⊱╉═━━━═❐\n";
    shuffledAdmins.forEach((admin, index) => {
        messageText += `📒│ ${index + 1}. @${admin.split('@')[0]}\n`;
    });
    messageText += "❐═━━━═╊⊰🩸⊱╉═━━━═❐```\n\n";

    messageText += `↓👥 *الاعـضـاء (${shuffledMembers.length})* 👥↓\n`;
    messageText += "```❐═━━━═╊⊰🩸⊱╉═━━━═❐\n";
    shuffledMembers.forEach((member, index) => {
        messageText += `│ ${index + 1}. @${member.split('@')[0]}\n`;
    });
    messageText += "❐═━━━═╊⊰🩸⊱╉═━━━═❐```\n\n";

    messageText += `> *إجمالي المشاركين — ${participants.length}*`;

    // واتساب بيرفض الرسائل الأطول من 4096 حرف، فبنقسّم القائمة لرسائل
    // وكل رسالة بتاخد منشناتها هي بس (بدون ما حد يختفي من العرض).
    const parts = splitText(messageText);
    for (const part of parts) {
        await conn.sendMessage(m.chat, {
            text: part,
            mentions: mentionsIn(part, participants).slice(0, MAX_MENTIONS)
        }, { quoted: m });
    }
};

handler.usage = ["منشن_الكل"];
handler.category = "admin";handler.command = ["منشن_الكل"];
handler.admin = true;
handler.group = true;

export default handler;
