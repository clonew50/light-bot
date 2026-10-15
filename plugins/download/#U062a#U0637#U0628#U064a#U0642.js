import axios from 'axios';

const handler = async (m, { conn, text, command }) => {

    if (!text) {
        await conn.sendMessage(m.chat, {
            text: `*🔍 كتب اسم التطبيق باش نقلب ليك عليه.*\n\n_طريقة الاستعمال:_\n.${command} Instagram`
        }, { quoted: m });
        return;
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: "📥", key: m.key } });

        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(text)}/limit=1`;

        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
            await conn.sendMessage(m.chat, {
                text: "❌ *مالقيتش التطبيق، تأكد من الاسم.*"
            }, { quoted: m });
            return;
        }

        const app = data.datalist.list[0];
        const sizeMB = (app.size / (1024 * 1024)).toFixed(2);

        // نص معلومات التطبيق نظيف تماماً بدون حقوق أو جمل إضافية
        const caption = `🎮 *الاسم:* ${app.name}\n📦 *الحزمة:* ${app.package}\n📅 *التحديث:* ${app.updated}\n📁 *الحجم:* ${sizeMB} MB`;

        // 1. إرسال الأيقونة كصورة عادية جداً مع النص
        if (app.icon) {
            await conn.sendMessage(m.chat, {
                image: { url: app.icon },
                caption: caption
            }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
        }

        // تأخير بسيط لمدة ثانيتين للتأكد من إرسال الصورة أولاً
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. إرسال ملف الـ APK النظيف والمستقر
        await conn.sendMessage(m.chat, {
            document: { url: app.file.path_alt },
            fileName: `${app.name}.apk`,
            mimetype: 'application/vnd.android.package-archive'
        }, { quoted: m });

        await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    }
};

// إعدادات الأمر
handler.usage = ['تطبيق <اسم التطبيق>']; 
handler.category = 'downloads';
handler.command = ['تطبيق']; 
handler.limit = 10; // تحديد 10 استخدامات مسموحة للمستخدم في النظام

export default handler;
