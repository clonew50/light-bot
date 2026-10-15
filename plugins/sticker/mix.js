import fetch from 'node-fetch';
import { Sticker } from 'wa-sticker-formatter';

const run = async (m, { conn, text, command }) => {
    // فصل الإيموجيين باستخدام علامة +
    let [emo1, emo2] = text.split('+');
    
    // التحقق من إدخال الإيموجيات بشكل صحيح
    if (!(emo1 && emo2)) {
        return m.reply(`*⚠️ طـريـقـة الاسـتـخـدام:* \n- أرسل الأمر متبوعاً بإيموجيين بينهما علامة (+)\n\n*مثال:* \n\`.${command} 🗿+🔥\``);
    }

    try {
        let url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${emo1.trim()}_${emo2.trim()}`;
        
        let response = await fetch(url);
        let res = await response.json();
        
        if (!res.results || !res.results.length) {
            return m.reply('❌ *عذراً، هذا الدمج غير مدعوم في مطبخ الإيموجيات، جرب دمجاً آخر!*');
        }

        // تحويل النتيجة لملصق وإرسالها
        for (let x of res.results) {
            let stiker = await (new Sticker(x.url, { 
                type: 'full', 
                categories: x.tags,
                pack: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻', 
                author: '𝑬𝑴𝑶𝑱𝑰 𝑴𝑰𝑿' 
            })).toMessage();
            
            await conn.sendMessage(m.chat, stiker, { quoted: m });
        }

    } catch (error) {
        await m.reply(`❌ *حدث خطأ أثناء دمج الإيموجيات:* ${error.message}`);
    }
};

run.command = ['مكس', 'ملصق-ايموجي', 'emojimix'];
run.usage = ['مكس <ايموجي+ايموجي>'];
run.category = 'sticker';
run.limit = true;

export default run;
