// ─── plugins/kickall.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Instant Kick Everyone (Including Admins) Plugin ⚡

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

const handler = async (m, { conn, bot, isBotAdmin, participants }) => {
    // 1️⃣ التأكد أن الرسالة داخل مجموعة
    if (!m.isGroup) {
        return conn.sendMessage(m.chat, { 
            text: `${HEADER}\n🩸 *هذا الأمر يعمل داخل المجموعات فقط!*\n${HEADER}`,
            contextInfo: context(m.sender) 
        }, { quoted: m });
    }

    // 2️⃣ التحقق من أن الرقم صاحب البوت الفرعي (مُفعّل البوت) أو الآدمن الرئيسي
    const botOwnerJid = conn.user.jid.split(':')[0] + '@s.whatsapp.net';
    const senderJid = m.sender.split(':')[0] + '@s.whatsapp.net';

    const isBotOwner = senderJid === botOwnerJid || (bot?.config?.owners && bot.config.owners.includes(m.sender.split('@')[0]));

    if (!isBotOwner) {
        return conn.sendMessage(m.chat, { 
            text: `${HEADER}\n🩸 *عذراً! هذا الأمر مخصص لمالك البوت الفرعي/المطور فقط!*\n${HEADER}`,
            contextInfo: context(m.sender) 
        }, { quoted: m });
    }

    // 3️⃣ التأكد أن البوت مشرف في المجموعة
    if (!isBotAdmin) {
        return conn.sendMessage(m.chat, { 
            text: `${HEADER}\n📖 *يجب ترقية البوت مشرفاً لتنفيذ هذا الأمر!*\n${HEADER}`,
            contextInfo: context(m.sender) 
        }, { quoted: m });
    }

    // 4️⃣ تجميع معرفات جميع الأعضاء والمشرفين (باستثناء البوت والمنفّذ فقط)
    const usersToKick = participants
        .filter(p => p.id !== conn.user.jid && p.id !== m.sender)
        .map(p => p.id);

    if (usersToKick.length === 0) {
        return conn.sendMessage(m.chat, { 
            text: `${HEADER}\n📖 *لا يوجد أعضاء لطردك لهم في الروم!*\n${HEADER}`,
            contextInfo: context(m.sender) 
        }, { quoted: m });
    }

    m.react('🩸');

    try {
        // 5️⃣ إرسال أمر الطرد الشامل دفعة واحدة
        await conn.groupParticipantsUpdate(m.chat, usersToKick, 'remove');

        m.react('📖');
        const successCard = `${HEADER}\n🩸 *تم طرد ${usersToKick.length} عضو ومشرف بنجاح!*\n📖 *تم تنظيف المجموعة بالكامل*\n${HEADER}`.trim();

        await conn.sendMessage(m.chat, { text: successCard, contextInfo: context(m.sender) }, { quoted: m });

    } catch (e) {
        console.log(e);
        m.react('❌');
        const errorCard = `${HEADER}\n🩸 *حدث خطأ أثناء عملية الطرد الجماعي.*\n${HEADER}`.trim();

        await conn.sendMessage(m.chat, { text: errorCard, contextInfo: context(m.sender) }, { quoted: m });
    }
};

handler.usage = ['طرد_الكل'];
handler.category = 'tools';
handler.command = ['طرد_الكل', 'kickall', 'احذفهم'];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
