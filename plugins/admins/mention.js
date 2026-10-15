// سياق رسالة متوافق مع قنواتك ومحمي من الكراش والتأخير
const cleanContext = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

async function handler(m, { conn }) {
    const coverImageUrl = 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg';

    const sections = [{
        title: "📢 ┇ خيارات الاستدعاء المتاحة",
        rows: [
            {
                title: "📢 ┇ منشن الكل",
                description: "استدعاء كافة المشرفين والأعضاء بالترتيب",
                id: ".منشن_الكل"
            },
            {
                title: "👥 ┇ منشن الأعضاء",
                description: "استدعاء الأعضاء العاديين فقط دون الإدارة",
                id: ".منشن_اعضاء"
            },
            {
                title: "👑 ┇ منشن المشرفين",
                description: "استدعاء طاقم الإدارة والمشرفين فقط",
                id: ".منشن_مشرفين"
            }
        ]
    }];

    const menuText = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*⚙️ ┇ نـظـام الـمـنـشـن الـتـفـاعـلـي*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n✨ *مرحباً بك يا مشرف، اضغط على القائمة أدناه لتنبيه المجموعة فوراً.*`;
    
    // استخدام الدالة المخصصة والناجحة في بوتك
    await conn.sendButtonNormal(m.chat, {
        media: { url: coverImageUrl },
        mediaType: 'image',
        caption: menuText,
        buttons: [
            {
                name: "single_select",
                params: {
                    title: "اختر نوع المنشن📜",
                    sections: sections
                }
            }
        ],
        mentions: [m.sender],
        contextInfo: cleanContext(m.sender)
    }, m);
}

handler.usage = ["منشن"];
handler.category = "admin";
handler.command = ["منشن", "منشنز", "mention"];
handler.admin = true;
handler.group = true;

export default handler;
