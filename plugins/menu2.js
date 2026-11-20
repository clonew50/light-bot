import { sendNativeMenu } from './native/quickmenu.js';

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
    [18, 'الاسلاميات', 'islamic', '🕌'],
    [19, 'الأوامـر الـتـفـاعـلـيـة', 'native', '🧩']
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
        newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

const resolveConn = (conn, bot, m) =>
    conn || bot?.sock || (typeof m?.client === 'function' ? m.client() : null) || null;

async function safeSendMenuInteractive(activeConn, m, payload) {
    if (activeConn && typeof activeConn.sendButtonNormal === 'function') {
        try {
            return await activeConn.sendButtonNormal(m.chat, payload, m);
        } catch (err) {
            console.error('[menu2] sendButtonNormal fallback:', err?.message || err);
        }
    }
    if (activeConn && typeof activeConn.sendMessage === 'function') {
        try {
            return await activeConn.sendMessage(m.chat, {
                ...(payload.media ? { image: payload.media } : {}),
                caption: payload.caption,
                text: payload.media ? undefined : payload.caption,
                footer: payload.footer,
                buttons: payload.buttons,
                mentions: payload.mentions,
                contextInfo: payload.contextInfo
            }, { quoted: m });
        } catch (err) {
            console.error('[menu2] sendMessage fallback:', err?.message || err);
        }
    }
    if (typeof m?.reply === 'function') {
        return await m.reply(payload.caption);
    }
    return null;
}

async function safeSendMediaCaption(activeConn, m, imageUrl, caption, contextInfo) {
    if (activeConn && typeof activeConn.sendMessage === 'function') {
        try {
            return await activeConn.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption,
                contextInfo
            }, { quoted: m });
        } catch {}
    }
    if (typeof m?.reply === 'function') {
        return await m.reply(caption);
    }
    return null;
}

async function handler(m, { conn, bot, command, args = [] }) {
    const activeConn = resolveConn(conn, bot, m);
    const senderJid = String(m?.sender || m?.chat || 'user@s.whatsapp.net');
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

    // ── .menu native (todo 22): native interactive surface, single-sourced ──
    if (String(args[0] || '').trim().toLowerCase() === 'native') {
        const info = (bot && bot.config && bot.config.info) || {};
        const img = getImg(bot);
        const res = await sendNativeMenu(activeConn, m.chat, {
            bot,
            info,
            images: img ? [img] : [],
            quoted: m
        });
        if (!res?.sent && typeof m?.reply === 'function') {
            await m.reply('❌ خدمة الأزرار التفاعلية غير متاحة في هذا الاتصال حالياً.');
        }
        return;
    }

    // 1️⃣ القائمة الرئيسية بالأزرار عند كتابة الأمر بدون أرقام
    if (!selected && !args[0]) {
        const menuText =
            `╭─┈──┈─⟞🩸⟝─┈──┈─╮\n` +
            `┃ *لايت في الخدمة 📜*\n` +
            `╰─┈──┈─⟞🩸⟝─┈──┈─╯\n\n` +
            `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n` +
            `┃ 👤 *المستخدم:* @${senderJid.split("@")[0]}\n` +
            `┃ ⚙️ *التشغيل:* ${uptimeFormatted}\n` +
            `┃ 📅 *التاريخ:* ${date}\n` +
            `┃ ⏰ *الوقت:* ${time}\n` +
            `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n\n` +
            `✨ *اختر قسماً من القائمة أو اكتب (.شرح)*`;
        
        await safeSendMenuInteractive(activeConn, m, {
            media: { url: getImg(bot) },
            mediaType: 'image',
            caption: menuText,
            footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
            buttons: [
                {
                    name: "single_select",
                    params: {
                        title: "📜 قائمة الأوامر",
                        sections: sections
                    }
                },
                {
                    name: "cta_url",
                    params: {
                        display_text: "📢 مستودع البوت",
                        url: "https://github.com/clonew50/light-bot"
                    }
                },
                {
                    name: "quick_reply",
                    params: {
                        display_text: "⚡ تنصيب البوت",
                        id: ".تنصيب"
                    }
                },
                // Native quick-reply surface (todo 22): one tap -> .قائمة
                {
                    name: "quick_reply",
                    params: {
                        display_text: "🧩 الأوامر التفاعلية",
                        id: ".قائمة"
                    }
                }
            ],
            mentions: [senderJid],
            contextInfo: cleanContext(senderJid)
        });
        return;
    }

    // 2️⃣ عرض أسطر وأوامر القسم المحدد
    const cat = getCat(selected);
    const botImg = getImg(bot);

    if (!cat) {
        await safeSendMediaCaption(
            activeConn,
            m,
            botImg,
            '❌ ┇ *اخـتـر رقـمـاً صـحـيـحـاً مـن الـقـائمة فـقـط.*',
            cleanContext(senderJid)
        );
        return;
    }

    const cmds = (typeof bot?.getAllCommands === 'function') ? await bot.getAllCommands() : [];
    const categoryCmds = cmds.filter(c => c.category === cat[2]);
    
    if (!categoryCmds.length) {
        await safeSendMediaCaption(
            activeConn,
            m,
            botImg,
            `❌ ┇ *هـذا الـقـسـم لا يـحـتـوي عـلـى أوامـر حـالـيـاً.*`,
            cleanContext(senderJid)
        );
        return;
    }

    const PAGE_SIZE = 20;
    const totalCmds = categoryCmds.length;
    const totalPages = Math.max(1, Math.ceil(totalCmds / PAGE_SIZE));
    const page = Math.min(totalPages, Math.max(1, parseInt(args[1] || '1', 10) || 1));
    const pageSlice = categoryCmds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const cmdsList = pageSlice.map(c => {
        const usages = Array.isArray(c.usage) ? c.usage : [c.usage];
        return usages
            .filter(Boolean)
            .slice(0, 1)
            .map(cmd => `┃ ${cat[3]} *.${cmd}*`)
            .join('\n');
    }).join('\n');

    const pagerNote = totalPages > 1 ? `\n📄 *صفحة ${page} من ${totalPages}* (${totalCmds.toLocaleString()} أمر) — اكتب \`.${command} ${selected} ${page < totalPages ? page + 1 : 1}\`` : '';

    const resultText =
        `╭─┈──┈─⟞${cat[3]}⟝─┈──┈─╮\n` +
        `┃ *قسم ${cat[1]}*\n` +
        `╰─┈──┈─⟞${cat[3]}⟝─┈──┈─╯\n\n` +
        `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n` +
        `${cmdsList}\n` +
        `❐═━━━═╊⊰🩸⊱╉═━━━═❐${pagerNote}`;

    // إرسال كرسالة قائمة تفاعلية تحتوي على الأوامر مع إدراج زر تصفح بقية الأقسام
    await safeSendMenuInteractive(activeConn, m, {
        media: { url: botImg },
        mediaType: 'image',
        caption: resultText.trim(),
        footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
        buttons: [
            {
                name: "single_select",
                params: {
                    title: "📜 تصفح الأقسام الأخرى",
                    sections: sections
                }
            }
        ],
        contextInfo: cleanContext(senderJid)
    });
}

handler.command = ['اوامر','menu'];
handler.usage = ['menu', 'menu <رقم القسم>', 'menu native'];
handler.category = 'info';
export default handler;
