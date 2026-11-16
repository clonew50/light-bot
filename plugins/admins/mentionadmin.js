import { splitText, mentionsIn, MAX_MENTIONS } from "../../system/text-chunks.js";

const handler = async (m, { conn, args }) => {
    const metadata = await conn.groupMetadata(m.chat);
    const participants = metadata.participants;
    const groupAdmins = participants.filter(p => p.admin).map(p => p.id);

    const shuffledAdmins = [...groupAdmins].sort(() => Math.random() - 0.5);

    const pesan = args.join(' ');
    let messageText = "";
    messageText += `👤│ الـاســم: ${metadata.subject}\n`;
    messageText += `📜│ تـاريـخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    if (pesan) messageText += `📝│ الـرسـالـة: ${pesan}\n`;
    messageText += `\n`;

    messageText += `↓👑 *الـمـشـرفـيـن فـقـط (${shuffledAdmins.length})* 👑↓\n`;
    messageText += "```❐═━━━═╊⊰🩸⊱╉═━━━═❐\n";
    shuffledAdmins.forEach((admin, index) => {
        messageText += `📒│ ${index + 1}. @${admin.split('@')[0]}\n`;
    });
    messageText += "❐═━━━═╊⊰🩸⊱╉═━━━═❐```\n\n";

    messageText += `> *إجمالي المشرفين المستهدفين — ${shuffledAdmins.length}*`;

    // واتساب بيرفض الرسائل الأطول من 4096 حرف، فبنقسّم القائمة لرسائل
    // وكل رسالة بتاخد منشناتها هي بس (بدون ما حد يختفي من العرض).
    const parts = splitText(messageText);
    for (const part of parts) {
        await conn.sendMessage(m.chat, {
            text: part,
            mentions: mentionsIn(part, groupAdmins).slice(0, MAX_MENTIONS)
        }, { quoted: m });
    }
};

handler.usage = ["منشن_مشرفين"];
handler.category = "admin";
handler.command = ["منشن_مشرفين"];
handler.admin = true;
handler.group = true;

export default handler;
