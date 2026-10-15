import { toDataURL } from 'qrcode';

const run = async (m, { conn, text, command }) => {
    let commandText = command.includes('code') || command.includes('لباركود') ? 'لباركود' : 'رمز QR';

    // التحقق من النص
    if (!text) {
        return conn.reply(m.chat, `*طريقة الاستخدام:* \n- أرسل الأمر *\`.${command} <النص>\`*\n- سيتم تحويل النص إلى ${commandText} وإرساله إليك.\n\n*مثال:* \n\`.${command} Light Bot\``, m);
    }

    try {
        // تحويل النص إلى باركود كـ Buffer وإرساله كصورة طبيعية صافية
        const qrBuffer = await toDataURL(text.slice(0, 2048), { scale: 8 });
        
        await conn.sendMessage(m.chat, {
            image: { url: qrBuffer },
            caption: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*تـم إنـشـاء الـ ${commandText} بـنـجـاح!* \n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻`
        }, { quoted: m });

    } catch (error) {
        await m.reply(`❌ *حدث خطأ أثناء إنشاء الرمز:* ${error.message}`);
    }
};

run.command = ['qr', 'qrcode', 'لباركود'];
run.usage = ['qr <النص>'];
run.category = "tools";
run.register = true;

export default run;