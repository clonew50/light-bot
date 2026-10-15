const CATEGORIES = [
    [1, 'التـحـمـيـل', 'downloads', '📂'],
    [2, 'الـمـجـمـوعـات', 'group', '🛡️'],
    [3, 'الـمـلـصـقـات', 'sticker', '🃏'],
    [4, 'الـمـطـوريـن', 'owner', '👑'],
    [5, 'الدعــــــم', 'support', '✳️'],
    [6, 'الـادوات', 'tools', '⚙️'],
    [7, 'الـبـحـث', 'search', '🔍'],
    [8, 'الادمــن', 'admin', '⚔️'],
    [9, 'الالــعـاب', 'games', '🎮'],
    [10, 'الچيف', 'gif', '🖼️'],
    [11, 'الـبــنـك', 'bank', '💳'],
    [12, 'الـذكـاء الاصـطـنـاعـي', 'ai', '🤖'],
    [13, 'الـبـوتـات الـفـرعـي', 'sub', '⛓️'],
    [14, 'مـعـلومـات الـبـوت', 'info', '📜'],
    [15, 'الـنقابـــــات', 'nicknames', '🏷️'],
    [16, 'الـلـوجـوهــات', 'logos', '🎨'],
    [17, 'تـغـيـر الاصـوات', 'voices', '🎙️'],
    [18, 'الاسلاميات', 'islamic', '🕌']
];

const getCat = n => CATEGORIES.find(c => c[0] === n);

const getImg = (bot) => {
    const images = bot?.config?.info?.images || global.config?.info?.images;
    if (!images) return "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg";
    return Array.isArray(images) ? images[Math.floor(Math.random() * images.length)] : images;
};

const cleanContext = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

async function handler(m, { conn, bot, command, args }) {
    const selected = parseInt(args[0]);
    const now = new Date();
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const uptimeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const date = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // مصفوفة قائمة الأقسام المشتركة لإعادة استخدامها
    const sections = [{
        title: "📖 ┇ اقسام البوت ┇ 🩸",
        rows: CATEGORIES.map(c => ({
            title: `${c[0]} ┇ ${c[1]} ${c[3]}`,
            description: `اضغط لعرض أوامر قسم ${c[1]}`,
            id: `.${command} ${c[0]}`
        }))
    }];

    // 1️⃣ القائمة الرئيسية بالأزرار عند كتابة الأمر بدون أرقام
    if (!selected && !args[0]) {
        const menuText = `*لايت في الخدمة 📜*\n\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n┇ 👤  الـمـسـتـخـدم: @${m.sender.split("@")[0]}\n┇ ⚙️  الـتـشـغـيـل: ${uptimeFormatted}\n┇ 📜  الـوقـت: ${date} ⁝ ${time}\n❐═━━━═╊⊰🩸⊱╉═━━━═❐

*لمعرفة اوامر وامكانيات البوت اكتب (.شرح)*
`;
        
        await conn.sendButtonNormal(m.chat, {
            media: { url: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg" },
            mediaType: 'image',
            caption: menuText,
            buttons: [
                {
                    name: "single_select",
                    params: {
                        title: "قائمة 📜 الاوامر",
                        sections: sections
                    }
                },
                {
                    name: "cta_url",
                    params: {
                        display_text: "📢 قناة المطور",
                        url: "https://whatsapp.com/channel/0029Vb7dTmNJENy9sp5yqi3T"
                    }
                },
                {
                    name: "quick_reply",
                    params: {
                        display_text: "⚡ تنصيب البوت",
                        id: ".تنصيب"
                    }
                }
            ],
            mentions: [m.sender],
            contextInfo: cleanContext(m.sender)
        }, m);
        return;
    }

    // 2️⃣ عرض أسطر وأوامر القسم المحدد
    const cat = getCat(selected);
    const botImg = getImg(bot);

    if (!cat) {
        await conn.sendMessage(m.chat, { 
            image: { url: botImg },
            caption: '❌ ┇ *اخـتـر رقـمـاً صـحـيـحـاً مـن الـقـائمة فـقـط.*', 
            contextInfo: cleanContext(m.sender) 
        }, { quoted: m });
        return;
    }

    const cmds = await bot.getAllCommands();
    const categoryCmds = cmds.filter(c => c.category === cat[2]);
    
    if (!categoryCmds.length) {
        await conn.sendMessage(m.chat, { 
            image: { url: botImg },
            caption: `❌ ┇ *هـذا الـقـسـم لا يـحـتـوي عـلـى أوامـر حـالـيـاً.*`, 
            contextInfo: cleanContext(m.sender) 
        }, { quoted: m });
        return;
    }

    const cmdsList = categoryCmds.map(c => {
        const usages = Array.isArray(c.usage) ? c.usage : [c.usage];
        return usages
            .filter(Boolean)
            .map(cmd => ` ${cat[3]} ┇ \`.${cmd}\``)
            .join('\n');
    }).join('\n');

    const resultText = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n┃ *قـسـم ${cat[1]} ${cat[3]}*\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n${cmdsList}\n\n❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻`;

    // إرسال كرسالة قائمة تفاعلية تحتوي على الأوامر مع إدراج زر تصفح بقية الأقسام
    await conn.sendButtonNormal(m.chat, {
        media: { url: botImg },
        mediaType: 'image',
        caption: resultText.trim(),
        buttons: [
            {
                name: "single_select",
                params: {
                    title: "تصفح الاقسام الاخرى 📜",
                    sections: sections
                }
            }
        ],
        contextInfo: cleanContext(m.sender)
    }, m);
}

handler.command = ['اوامر','menu'];
export default handler;
