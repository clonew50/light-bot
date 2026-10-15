// مصفوفة مؤقتة في الذاكرة لحفظ إنذارات المستخدمين
const userWarns = {};

// قائمة الجروبات التي لا تريد للبوتات الفرعية أن تعمل فيها
const blockedGroups = [
    "12468323841-1619736833@g.us",
    "12468323841-1619736833@g.us"
];

export default async function before(m, { conn, bot }) {
    // 1. فحص أولاً: إذا كان البوت فرعي والجروب متواجد في قائمة الحظر، يتم إيقاف التنفيذ فوراً
    if (bot?.isSubBot && blockedGroups.includes(m.chat)) {
        return false; 
    }

    // 2. كود منع الروابط (Anti-Link)
    const g = global.db?.groups[m.chat];

    if (g?.antiLink && !m.isOwner && !m.isAdmin) {
        const groupLinkRegex = /(https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/[A-Za-z0-9]+/gi;

        if (groupLinkRegex.test(m.text)) {

            // حذف الرسالة التي تحتوي على الرابط
            await conn.sendMessage(m.chat, {
                delete: m.key
            });

            // تعريف معرف فريد للمستخدم داخل هذا الجروب
            const warnKey = `${m.chat}_${m.sender}`;
            if (!userWarns[warnKey]) userWarns[warnKey] = 0;
            
            // زيادة عدد الإنذارات
            userWarns[warnKey] += 1;
            const currentWarns = userWarns[warnKey];

            // تخصيص الرسالة بناءً على عدد الإنذارات
            if (currentWarns === 1) {
                await conn.sendMessage(m.chat, { 
                    text: `⚠️ *الإنذار الأول* ┃ @${m.sender.split('@')[0]}\n\nممنوع نشر روابط الجروبات أو القنوات. تم حذف الرابط.`,
                    mentions: [m.sender]
                });
            } 
            else if (currentWarns === 2) {
                await conn.sendMessage(m.chat, { 
                    text: `⚠️ *الإنذار الثاني* ┃ @${m.sender.split('@')[0]}\n\nتنبيه ثانٍ! الرجاء الالتزام بقوانين المجموعة وعدم نشر الروابط.`,
                    mentions: [m.sender]
                });
            } 
            else if (currentWarns === 3) {
                await conn.sendMessage(m.chat, { 
                    text: `🚨 *الإنذار الثالث والأخير!* ┃ @${m.sender.split('@')[0]}\n\nتم حذف الرابط. أي نشر قادم سيؤدي إلى طردك فوراً!`,
                    mentions: [m.sender]
                });
            } 
            else if (currentWarns >= 4) {
                await conn.sendMessage(m.chat, { 
                    text: `❌ *تم الطرد!* ┃ @${m.sender.split('@')[0]}\n\nلقد تلقيت ثلاثة إنذارات مسبقاً وسوف يتم طردك من المجموعة الآن.`,
                    mentions: [m.sender]
                });

                // أمر الطرد من المجموعة
                await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
                
                // تصفير الإنذارات بعد الطرد
                userWarns[warnKey] = 0;
            }

            return true;
        }
    }

    return false;
}
