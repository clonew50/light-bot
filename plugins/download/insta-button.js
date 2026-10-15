const handler = async (m, { conn, text }) => {
    // التحقق من إدخال نص للبحث
    if (!text) return m.reply("*اكتب ما تريد البحث عنه في إنستغرام بعد الأمر 🔍*");
    
    try {
        // إشعار المستخدم ببدء البحث
        await m.reply("*جاري البحث في إنستغرام... ⏳*");

        // استدعاء API للبحث في إنستغرام (يمكنك استبدال الـ API بآخر إن لزم الأمر)
        const res = await fetch(`apify/instagram-search-scraper=${encodeURIComponent(text)}`);
        const json = await res.json();
        
        // التحقق من وجود نتائج (نفترض أن الـ API يعيد مصفوفة نتائج في json.result أو json.data)
        const results = json.result || json.data || [];
        if (!results || results.length === 0) return m.reply("*لم يتم العثور على نتائج للبحث المكتوب ❌*");

        // أخذ أول 4 نتائج فقط
        const topResults = results.slice(0, 4);
        
        // تجهيز الأزرار للنتائج الأربعة
        const buttons = topResults.map((item, index) => {
            // استخراج العنوان والرابط (تأكد من مطابقة الأسماء مع الـ API الخاص بك)
            const title = item.title || item.caption || item.username || `نتيجة بحث ${index + 1}`;
            const url = item.url || item.link;

            return {
                name: "quick_reply",
                params: {
                    display_text: `🎬 ╎ ${title.substring(0, 20)}...`, // تقصير النص ليتناسب مع الزر
                    id: `.انستا ${url}` // الأمر الذي سيُنفذ عند الضغط
                }
            };
        });

        // إرسال الرسالة التفاعلية مع الأزرار الأربعة
        await conn.sendButton(m.chat, {
            imageUrl: topResults[0].image || topResults[0].thumbnail || "https://i.imgur.com/7bN8tYf.png", // صورة أول نتيجة أو صورة افتراضية
            bodyText: `📥 *نتائج البحث عن:* _${text}_\n\nإختر أحد الفيديوهات أدناه لتحميله مباشرة عبر البوت:`,
            footerText: "𝑰𝑵𝑺𝑻𝑨𝑮𝑹𝑨𝑴 𝑺𝑬𝑨𝑹𝑪𝑯",
            buttons: buttons,
            mentions: [m.sender],
            newsletter: { name: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳", jid: "120363405545946827@newsletter" },
            interactiveConfig: { 
                buttons_limits: 10, 
                list_title: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻", 
                button_title: "نتائج بحث إنستا 📱", 
                canonical_url: topResults[0].url || topResults[0].link 
            }
        }, m);

    } catch (e) {
        console.error(e);
        m.reply("*حدث خطأ أثناء البحث، تأكد من الـ API أو جرب لاحقاً ❌*");
    }
};

// إعدادات الأمر
handler.usage = ["ابحث_انستا", "انستا_بحث"];
handler.category = "downloads";
handler.command = ["انستا_بحث", "ابحث_انستا", "igsearch", "searchig"];

export default handler;
