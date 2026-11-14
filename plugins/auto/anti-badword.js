import { addWarning, resetWarnings, WARNING_LIMIT } from '../../system/warnings.js';

const DEFAULT_BADWORDS = [
    "عرص", "كسمك", "متناك", "لبوه", "قحبه", "شرموط",
    "منيوك", "كس امك", "كسم", "يا بن الـ", "خول", "ديوث",
    "شرموطه", "طيزك", "سكس", "نيك", "بضان", "يلعن", "زبي",
    "ابن المتناكه", "ابن الشرموطه", "ابن القحبه", "ابن العرص", 
    "ابن الخول", "ابن الوسخه", "ابن اللبوه", "يا خول", "يا عرص", 
    "يا شرموط", "يا منيوك", "يا متناك", "يا ابن الكلب", "كس اختك", 
    "طيزي", "متناكه", "منيوكه", "नियाके", "نايك", "عرصه", "شراميط", 
    "قحاب", "دياثه", "فشخك", "تيزك", "كسمها", "كسك", "نيكه", "انتاك", 
    "ابن الاحبه", "يا ديوث", "يا قحبه", "يا لبوه", "زبك", "زبر", 
    "مصمص", "لحس", "عيرك", "بتاعك", "وسخ", "وسخه", "ابن النجسه", 
    "ابن العاهره", "يلعن كسمك", "يلعن دين امك", "يلعن ابوك", 
    "في كس امك", "في طيزك", "خرم طيزك", "يا خره", "خرا", 
    "يا ابن المتناك", "مخنث", "لوطي", "شاذ", "سحاقيه", "بعبص", 
    "بورنو", "اباحي", "سكسي", "افلام سكس", "سكس عربي", "سكس مصري", 
    "انيكك", "بيضاتك", "بضاني"
];

export default async function before(m, { conn, isAdmin, bot }) {
    // ─── مانع البوتات الفرعية للجروبات المحددة ───
    // الجروبات بتاعة المشغّل — مش جروبات المطور. حط جروباتك هنا (أو خلّيها فاضية).
    const groups = [];

    if (bot && bot.isSubBot && groups.includes(m.chat)) {
        return true;
    }

    if (!m.text || m.key?.fromMe || !m.isGroup) return false;
    
    // 1. تعريف المطورين
    // المطورين = ملاك البوت من الإعدادات (config.owners) — مفيش أرقام صلبة هنا.
    // الأرقام القديمة كانت بتاعة المطور الأصلي فاتشالت.
    const isDeveloper = m.isOwner;
    
    // إذا كان المرسل مطور أو أدمن، يتجاهل البوت الفحص تماماً
    if (isDeveloper || isAdmin) return false;

    const chatData = global.db.groups[m.chat] ||= {};

    // ─── لو مانع الألفاظ مش مفعّل في هذا الجروب، شيل ───
    if (!chatData.antiBadWords) return false;

    // ─── قائمة الكلمات: افتراضية + المضافة يدوياً ───
    const customWords = chatData.badWords || [];
    const allBadWords = [...DEFAULT_BADWORDS, ...customWords];

    // ─── تنظيف النص (إزالة التشكيل والمد والزخارف) ───
    const cleanText = m.text
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/ـ+/g, '')
        .replace(/[^\u0621-\u064A\s\w]/g, ' ')
        .toLowerCase();

    const isBad = allBadWords.some(word =>
        cleanText.includes(word.toLowerCase()) ||
        m.text.toLowerCase().includes(word.toLowerCase())
    );

    if (!isBad) return false;

    const senderNum = (m.sender || '').split('@')[0];

    try {
        // محاولة الحذف مباشرة كاختبار عملي للصلاحية
        let deleted = false;
        try {
            await conn.sendMessage(m.chat, { delete: m.key });
            deleted = true;
        } catch (err) {
            deleted = false;
        }

        if (deleted) {
            // العدّاد الموحّد (نفس مصدر admins/warning) — مفتاحه = معرّف المستخدم
            const currentWarnings = addWarning(m.chat, m.sender, { by: 'anti-badword', reason: 'badword' });

            if (currentWarnings >= WARNING_LIMIT) {
                // تصفير الإنذارات بعد الوصول للحد الأقصى والطرد
                resetWarnings(m.chat, m.sender);

                await conn.sendMessage(m.chat, {
                    text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 🚨 *تم طرد العضو لتجاوز الإنذارات*

 @${senderNum}
 تجاوز الحد الأقصى (3 إنذارات)
 بسبب استخدام الألفاظ النابية!

 🛡️ *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                    mentions: [m.sender]
                });

                // تنفيذ الطرد الفعلي
                await conn.groupParticipantsUpdate(m.chat, [m.sender], "remove").catch(() => {});
            } else {
                // إرسال تنبيه بالإنذار الحالي
                await conn.sendMessage(m.chat, {
                    text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 🚫 *ممنوع الألفاظ*

 @${senderNum}
 تم حذف رسالتك لاحتوائها
 على ألفاظ غير لائقة!
 ⚠️ إنذارك الحالي: (${currentWarnings}/3)

 🛡️ *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                    mentions: [m.sender]
                });
            }
        } else {
            // لو فشل الحذف معناه أن البوت ليس مشرفاً
            await conn.sendMessage(m.chat, {
                text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 ⚠️ @${senderNum} لفظ سيء!
 (ارفعني أدمن عشان أحذف وأعطيه إنذار)
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                mentions: [m.sender]
            });
        }
        return true;
    } catch (e) {
        console.error('[anti_badword]', e?.message);
        return false;
    }
}
