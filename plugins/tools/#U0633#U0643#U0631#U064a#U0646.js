import fetch from 'node-fetch';

const run = async (m, { conn, command, args }) => {
    // التحقق من إدخال الرابط
    if (!args[0]) {
        return m.reply(`*⚠️ طـريـقـة الاسـتـخـدام:* \n- أرسل الأمر متبوعاً برابط الموقع المطلوب تصويره.\n\n*مثال:* \n\`.${command} https://google.com\``);
    }
    
    await m.react('⏳');

    try {
        // جلب لقطة الشاشة للموقع كـ Buffer
        let response = await fetch(`https://image.thum.io/get/fullpage/${args[0]}`);
        let ssBuffer = await response.buffer();
        
        // إرسال لقطة الشاشة كصورة طبيعية صافية
        await conn.sendMessage(m.chat, {
            image: ssBuffer,
            caption: `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*📸 ┇ تـم الـتـصـويـر بـنـجـاح!*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻`
        }, { quoted: m });

        await m.react('✅');
    } catch (err) {
        console.error(err);
        await m.react('❌');
        await m.reply('❌ *حدث خطأ أثناء محاولة تصوير الموقع، تأكد من صحة الرابط!*');
    }
};

run.command = ['سكرين', 'اسكرين', 'ss', 'screenshot'];
run.usage = ['سكرين <الرابط>'];
run.category = 'tools';

export default run;
