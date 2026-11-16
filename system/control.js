import fs from "fs";
import path from "path";
import { pushEvent } from "./events.js";

/*
  ═══════════════ عقد الإرجاع المبكر ═══════════════
  group() بترجّع EVENT_HANDLED لما الكارت اتبعَت فعلاً (أو اتمنعت لسبب
  مسجّل زي noWelcome). القيمة دي مش "عدد" ولا رقم منطقي — دي إشارة
  "الحدث اتمسك، متكلّمش عنه تاني". المستدعي بيقارن بيها بالاسم بس.
*/
const EVENT_HANDLED = 9999;

const group = async (ctx, event, eventType) => {
    try {
        if (!event?.participants) return null;

        // (todo 30a) واتساب بقى يبعت LID ids — الفلتر القديم على phoneNumber
        // كان بيخلّي الكارت يقول "No users" ومفيش منشن. بناخد p.id الأول
        // ورقم الهاتف كـ fallback بس.
        const participants = event.participants
            .map(p => p?.id || p?.phoneNumber)
            .filter(Boolean);
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
        if (groupInfo && groupInfo.noWelcome === true) return EVENT_HANDLED;

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
        // (todo 30b) أحداث الجروب الفاشلة كانت بتضيع في stdout بس — بقت
        // بتوصل مجرى أحداث اللوحة كمان.
        const text = `⚠️ [GROUP] فشل كارت ${eventType}: ${e?.message || e}`;
        console.error(text);
        pushEvent('group', text);
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
            // (todo 30c) الرد كان بينزّل صورة من الإنترنت مع كل رفض —
            // كل رفض لأمر = نداء شبكة. بقى رد نصي بس: صفر نداءات.
            try {
                await conn.sendMessage(msg.chat, { text: messages[checkType] });
            } catch (e) {
                console.error('⚠️ [ACCESS] فشل إرسال رسالة الصلاحية:', e?.message || e);
                pushEvent('access', `⚠️ [ACCESS] فشل إرسال رسالة الرفض (${checkType}): ${e?.message || e}`);
            }
            return false;
        }
        return null;
    } catch (e) {
        const text = `⚠️ [ACCESS] خطأ في فحص الصلاحية — منع تنفيذ الأمر: ${e?.message || e}`;
        console.error(text);
        pushEvent('access', text);
        return false; // منع التنفيذ بدل أي سلوك غامض
    }
};

export { access, group };
