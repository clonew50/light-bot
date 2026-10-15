let handler = async (m, {
    conn
}) => {
    try {
        m.reply(`❐═━━━═╊⊰🩸⊱╉═━━━═❐
🩸┊ *رابـــط الـــمـــجـــمـــوعـــة:* ${(await conn.groupMetadata(m.chat)).subject}
🩸┊
🩸┊ https://chat.whatsapp.com/` + await conn.groupInviteCode(m.chat) + `
🩸┊
🩸┊ ${conn.user.name || "Bot WhatsApp"}
❐═━━━═╊⊰🩸⊱╉═━━━═❐`)
    } catch {
        m.reply(`❐═━━━═╊⊰🩸⊱╉═━━━═❐
🩸┊ حدث خطأ أثناء جلب رابط المجموعة. تأكد من أن البوت يعمل بشكل صحيح.
❐═━━━═╊⊰🩸⊱╉═━━━═❐`)
    }
}
handler.usage = ["لينك"];
handler.category = "group";
handler.command = ["لينك", "link"];
handler.group = true;
handler.admin = true;
handler.botAdmin = false;

export default handler;
