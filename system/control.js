import fs from "fs";
import path from "path";

const group = async (ctx, event, eventType) => {
    try {
        if (!event?.participants) return null;

        const participants = event.participants.filter(p => p?.phoneNumber).map(p => p.phoneNumber);
        const author = event.author;
        let txt;

        const users = participants.length 
            ? participants.map(p => '@' + p.split('@')[0]).join(' and ') 
            : 'No users';
        const authorTag = author ? '@' + author.split('@')[0] : 'Unknown';

        // تحديد طريقة الدخول أو المغادرة بناءً على وجود الـ author
        let addMethod = "";
        if (eventType === "add") {
            if (!author || participants.includes(author)) {
                addMethod = "\n🔗 دَخَـلَ عَبْـرَ رَابِـطِ الـدَّعْـوَةِ";
            } else {
                addMethod = `\n📥 تَمَّتْ إِضَافَتُهُ بِوَاسِطَةِ: ${authorTag}`;
            }
        }

        let removeMethod = "";
        if (eventType === "remove") {
            if (!author || participants.includes(author)) {
                removeMethod = "\n🚶 غَادَرَ الـمَجْـمُوعَـةَ تِلْقَائِيّاً";
            } else {
                removeMethod = `\n❌ تَمَّ طَرْدُهُ بِوَاسِطَةِ: ${authorTag}`;
            }
        }

        const messages = {
            add: `♡゙ مـنـور/ه ${users}${addMethod}`,
            remove: `${users} ${removeMethod}`,
            promote: `📜゙ مـبـروك الادمـن ${users}\nby ${authorTag}`,
            demote: `📜 بـقـيـت عـضـو خـلاص ${users}\nby ${authorTag}`
        };

        txt = messages[eventType];
        if (!txt) return null;
        
        // كان بيكتب إدخال في الداتابيز من أي حدث جروب — نقرأ آمن بس
        const groupInfo = global.db.groups[event.chat];
        if (groupInfo && groupInfo.noWelcome === true) return 9999;

        const img = ["remove", "add"].includes(eventType) 
            ? (event.userUrl || "https://files.catbox.moe/hm9iq4.jpg") 
            : "https://files.catbox.moe/hm9iq4.jpg";

        // إرسال صورة عادية بدلاً من msgUrl
        await ctx.sock.sendMessage(event.chat, {
            image: { url: img },
            caption: txt,
            mentions: author ? [author, ...participants] : participants
        });

    } catch (e) {
        console.error(e);
    }
    return null;
};

const access = async (msg, checkType, time) => {
    // fail-closed: أي خطأ هنا بيرجع false = الأمر مش هينفذ
    // (الكود القديم كان من غير try/catch — أي خطأ في msg.client() كان بيطلع unhandled)
    try {
        const conn = await msg.client();
        
        const messages = {
            cooldown: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*📜📖 انتظر ${time || 'بعض كام ثانيه'} ثانية وكمل الأمر 📜📖*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            owner: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر للمطور فقط*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            group: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر يمكن استخدامه في المجموعات فقط*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            admin: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر مخصص للمشرفين فقط*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
            private: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر يعمل فقط في الخاص\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            botAdmin: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*لاستخدام هذا الامر يجب ان يكون البوت مشرفا*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            noSub: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر مخصص للأستحدام في البوت الاساسي فقط\n*ادخل مجموعة البوت لأستخدام الامر:https://chat.whatsapp.com/D3TD0OUJcApJJ1NMTtDXzj*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            disabled: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*البوت حاليا في الصيانة يرجى الانتظار حتى تتم صيانة البوت*\n*❐═━━━═╊⊰🩸⊱╉═━━━═❐*`,
            error: `*❐═━━━═╊⊰🩸⊱╉═━━━═❐*\n*هذا الامر به اخطاء تواصل مع المطور ليتم اصلاح الامر*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`
        };
        
        if (conn && messages[checkType]) {
            // إرسال صورة عادية لرسائل الصلاحيات بدون كروت
            try {
                await conn.sendMessage(msg.chat, {
                    image: { url: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg" },
                    caption: messages[checkType]
                });
            } catch (e) {
                console.error('⚠️ [ACCESS] فشل إرسال رسالة الصلاحية:', e?.message || e);
            }
            return false;  
        }
        return null;  
    } catch (e) {
        console.error('⚠️ [ACCESS] خطأ في فحص الصلاحية — منع تنفيذ الأمر:', e?.message || e);
        return false; // منع التنفيذ بدل أي سلوك غامض
    }
};

export { access, group };
