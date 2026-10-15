// ─── plugins/profile.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Fetch Profile Picture

const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";

const context = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

const handler = async (m, { conn, args, usedPrefix, command }) => {
    const prefix = usedPrefix || '.';

    // 1️⃣ التحقق من إدخال الرقم
    if (!args[0]) {
        const usageCard = `
❐═━━━═╊⊰🩸⊱╉═━━━═❐
│
│ *يرجى كتابة الرقم بعد الأمر مباشرة!*
│ 
│ 💡 *طـريـقـة الاسـتـخـدام:*
│ \`${prefix}${command} 201234567890\`
│
│ ⚠️ *بدون علامة (+) وبدون مسافات*
│
❐═━━━═╊⊰🩸⊱╉═━━━═❐`.trim();

        await conn.sendMessage(m.chat, { text: usageCard, contextInfo: context(m.sender) }, { quoted: m });
        return;
    }

    // 2️⃣ تنظيف الرقم من أي رموز أو مسافات إضافية
    const cleanNumber = args[0].replace(/[^0-9]/g, '');
    const userJid = `${cleanNumber}@s.whatsapp.net`;

    m.react('🔍');

    try {
        // 3️⃣ جلب رابط صورة البروفايل بحجم عالي (High Quality)
        let pfpUrl;
        try {
            pfpUrl = await conn.profilePictureUrl(userJid, 'image');
        } catch (e) {
            // صورة افتراضية في حال عدم وجود صورة أو خصوصية الحساب مقفولة
            pfpUrl = 'https://i.ibb.co/3p32y3d/default-avatar.png';
        }

        const caption = `
 🖼️ *[ صـورة الـبـروﻓـايـل ]* 
│
│ 📞 *الـرﻗـم:* +${cleanNumber}
│ 🌐 *الـمـسـتـخـدم:* @${cleanNumber}
│
`.trim();

        // 4️⃣ إرسال صورة البروفايل
        await conn.sendMessage(m.chat, {
            image: { url: pfpUrl },
            caption: caption,
            mentions: [userJid],
            contextInfo: context(m.sender)
        }, { quoted: m });

        m.react('✅');

    } catch (e) {
        console.log(e);
        m.react('❌');
        const errorCard = `
 ❌ *[ خـطـأ ]* 
│
│ *تعذر جلب صورة البروفايل لهذا الرقم.*
│ *تأكد من صحة الرقم أو أن الحساب موجود.*
│
`.trim();

        await conn.sendMessage(m.chat, { text: errorCard, contextInfo: context(m.sender) }, { quoted: m });
    }
};

handler.usage = ['بروفايل'];
handler.category = 'tools';
handler.command = ['بروفايل', 'pfp', 'profile'];

export default handler;
