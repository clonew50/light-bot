const getImg = (bot) => {
    const { images } = bot.config?.info || {};
    return Array.isArray(images) ? images[Math.floor(Math.random() * images.length)] : images;
};

// بناء الأقسام (إعدادات الحماية والأدمنز والتحكم بالردود)
const buildSections = () => [
    {
        title: "🛡️ إعدادات الحماية والأدمنز",
        rows: [
            { title: "🚫 تشغيل مانع الروابط", description: "حذف أي رابط في الجروب", id: ".تفعيل تشغيل_مضاد_الروابط" },
            { title: "✅ ايقاف مانع الروابط", description: "السماح بالروابط", id: ".تفعيل ايقاف_مضاد_الروابط" },
            { title: "📸 تشغيل مانع الحالات", description: "حذف الرسائل المنقولة من حالة واتساب", id: ".تفعيل تشغيل_مانع_الحالات" },
            { title: "📸 ايقاف مانع الحالات", description: "السماح بنشر الحالات", id: ".تفعيل ايقاف_مانع_الحالات" },
            { title: "🤬 تشغيل مانع السب", description: "حذف الألفاظ المسيئة وإنذارات", id: ".تفعيل تشغيل_مانع_الالفاظ" },
            { title: "🤬 ايقاف مانع السب", description: "ايقاف فلتر الألفاظ المسيئة", id: ".تفعيل ايقاف_مانع_الالفاظ" },
            { title: "👑 تشغيل وضع الادمن", description: "البوت يرد على المشرفين فقط", id: ".تفعيل تشغيل_الادمن" },
            { title: "👥 ايقاف وضع الادمن", description: "البوت يرد على الجميع", id: ".تفعيل ايقاف_الادمن" }
        ]
    }
];

// دالة موحدة لإرسال المنيو + والأزرار
const sendMenu = async (conn, m, bot, resultText) => {
    const sections = buildSections();

    const caption = resultText
        ? `${resultText}\n\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n│ *اختر إعداد آخر من القائمة 👇*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`
        : `❐═━━━═╊⊰🩸⊱╉═━━━═❐
 ⚡ *نـظـام الحماية والتحكم* ⚡

 اختر الإعداد المناسب من القائمة بالأسفل 👇
❐═━━━═╊⊰🩸⊱╉═━━━═❐

> 💡 *اضغط على الزر التفاعلي بالأسفل لتصفح إعدادات الحماية.*`;

    try {
        await conn.sendButtonNormal(m.chat, {
            media: { url: getImg(bot) },
            mediaType: 'image',
            caption,
            buttons: [{
                name: "single_select",
                params: {
                    title: "📋 اخـتـر إعـداد الحماية 🩸",
                    sections: sections
                }
            }],
            mentions: [m.sender],
            newsletter: {
                name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
                jid: '120363405545946827@newsletter'
            }
        });
    } catch (e) {
        await m.reply(resultText || '*❌ حدث خطأ في عرض القائمة*');
    }
};

async function handler(m, { conn, bot, command, args }) {
    const chatId = m.chat;
    const subCmd = args[0]?.toLowerCase();

    if (!subCmd) {
        return sendMenu(conn, m, bot, null);
    }

    let result;

    switch (subCmd) {
        case 'تشغيل_مضاد_الروابط':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].antiLink = true;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم تفعيل مضاد الروابط*\n> البوت هيحذف أي رابط\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'ايقاف_مضاد_الروابط':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].antiLink = false;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم ايقاف مضاد الروابط*\n> البوت مايحذفش الروابط\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'تشغيل_مانع_الحالات':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].statusBlocker = true;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم تفعيل مانع الحالات*\n> البوت هيحذف أي رسالة منقولة من حالة واتساب\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'ايقاف_مانع_الحالات':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].statusBlocker = false;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم ايقاف مانع الحالات*\n> السماح بنشر الحالات في الجروب\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'تشغيل_مانع_الالفاظ':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].antiBadWords = true;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم تفعيل مانع السب والألفاظ*\n> البوت هيحذف الرسائل المسيئة ويعطي إنذارات\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'ايقاف_مانع_الالفاظ':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].antiBadWords = false;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم ايقاف مانع السب والألفاظ*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'تشغيل_الادمن':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].adminOnly = true;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم تفعيل وضع الادمن*\n> البوت سيتفاعل مع المشرفين فقط\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        case 'ايقاف_الادمن':
            if (!m.isOwner && !m.isAdmin) {
                result = '*❌ هذا الأمر للمشرفين فقط*';
                break;
            }
            global.db.groups[chatId].adminOnly = false;
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ✅ *تم فك وضع الادمن*\n> البوت سيتفاعل مع جميع الأعضاء\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;

        default:
            result = '❐═━━━═╊⊰🩸⊱╉═━━━═❐\n ❌ *خيار غير معروف من القائمة*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐';
            break;
    }

    await sendMenu(conn, m, bot, result);
}

handler.usage = ['تفعيل'];
handler.category = 'admin';
handler.command = ['تفعيل'];

export default handler;