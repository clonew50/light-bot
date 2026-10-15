import axios from 'axios';

const apkpureApi = 'https://apkpure.com/api/v2/search?q=';
const apkpureDownloadApi = 'https://apkpure.com/api/v2/download?id=';

const handler = async (m, { conn, text, command }) => {

    if (!text) {
        await conn.sendMessage(m.chat, {
            text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n⚠️ *يرجى كتابة اسم التطبيق للبحث عنه.* \n\n_طريقة الاستعمال:_\n.${command} Instagram`
        }, { quoted: m });
        return;
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: "📥", key: m.key } });

        // 1. البحث عن التطبيق في APKPure
        const results = await searchApk(text);

        if (!results || !results.length) {
            await conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n❌ *لم يتم العثور على التطبيق في APKPure، تأكد من الاسم.*`
            }, { quoted: m });
            await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
            return;
        }

        const app = results[0];

        // 2. جلب رابط التحميل وبيانات الملف
        const downloadData = await downloadApk(app.id);

        if (!downloadData || (!downloadData.download_link && !downloadData.dllink && !downloadData.url)) {
            await conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n\n❌ *تعذر جلب رابط تحميل هذا التطبيق حالياً.*`
            }, { quoted: m });
            await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
            return;
        }

        // استخراج البيانات بأمان ودعم المسميات المختلفة
        const appName = app.title || app.name || text;
        const appPackage = app.id || app.package || 'غير معروف';
        const appIcon = app.icon || app.image || '';
        const appSize = downloadData.size || downloadData.file_size || 'غير معروف';
        const apkLink = downloadData.download_link || downloadData.dllink || downloadData.url;
        const appVersion = app.version || downloadData.version || 'محدث';

        // صياغة النص بأسلوب زخارف لايت بوت الشهير
        const caption = `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢
┃ *📱 ┇ مـعـلـومـات الـتـطـبـيـق (APKPure)*
❐═━━━═╊⊰🩸⊱╉═━━━═❐

🌟 *┇ الـاســم:* ${appName}
📦 *┇ الـحـزمــة:* ${appPackage}
🕒 *┇ الـاصــدار:* ${appVersion}
💪 *┇ الـحـجــم:* ${appSize}

❐═━━━═╊⊰🩸⊱╉═━━━═❐
⏳ *جاري إرسال ملف الـ APK، يرجى الانتظار...*`;

        // 3. إرسال الأيقونة كصورة عادية جداً مع النص بستايل لايت بوت
        if (appIcon) {
            await conn.sendMessage(m.chat, {
                image: { url: appIcon },
                caption: caption
            }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
        }

        // تأخير بسيط لمدة ثانيتين للتأكد من إرسال الصورة أولاً دون تجميد البوت
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. إرسال ملف الـ APK النظيف والمستقر
        await conn.sendMessage(m.chat, {
            document: { url: apkLink },
            fileName: `${appName}.apk`,
            mimetype: 'application/vnd.android.package-archive'
        }, { quoted: m });

        await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    }
};

// إعدادات الأمر الخاصة بك بالملي
handler.usage = ['apk <اسم التطبيق']; 
handler.category = 'downloads';
handler.command = ['apk']; 
handler.limit = true;

export default handler;

// دالات البحث والتحميل الخاصة بـ APKPure
async function searchApk(text) {
  const response = await axios.get(`${apkpureApi}${encodeURIComponent(text)}`);
  const data = response.data;
  return data.results;
}

async function downloadApk(id) {
  const response = await axios.get(`${apkpureDownloadApi}${id}`);
  const data = response.data;
  return data;
}
