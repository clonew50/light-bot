export default async function before(m, { conn }) {
    if (!global.db?.users[m.sender]) return false;
    
    const user = global.db.users[m.sender];
    let xp = user.xp || 0;
    let level = user.level || 0;
    let nameLevel = user.nameLevel || '🏙️ مواطن';
    
    // قائمة الرتب المخفضة والجديدة
    const levels = [
        { min: 0, max: 499, name: '🏙️ مواطن' },
        { min: 500, max: 1499, name: '💼 موظف' },
        { min: 1500, max: 3499, name: '👨‍💼 مدير قسم' },
        { min: 3500, max: 6999, name: '📈 رجل أعمال' },
        { min: 7000, max: 11999, name: '🏛️ مستثمر' },
        { min: 12000, max: Infinity, name: '👑 ملياردير' }
    ];
    
    let newLevel = level;
    let newNameLevel = nameLevel;
    let levelUp = false;
    let oldLevel = level;
    
    for (const lvl of levels) {
        if (xp >= lvl.min && xp <= lvl.max) {
            const currentLevelNum = levels.findIndex(l => l.min === lvl.min);
            if (currentLevelNum !== level) {
                newLevel = currentLevelNum;
                newNameLevel = lvl.name;
                levelUp = true;
                oldLevel = level;
            }
            break;
        }
    }
    
    if (levelUp) {
        user.level = newLevel;
        user.nameLevel = newNameLevel;
        
        const msg = `╭─┈─┈─┈─⟞📊⟝─┈─┈─┈─╮
┃ *📈 تـرقـيـة جـديـدة 📈*
╰─┈─┈─┈─⟞💼⟝─┈─┈─┈─╯

┃ @${m.sender.split('@')[0]}
┃ المستوى السابق: *${oldLevel}*
┃ المستوى الجديد: *${newLevel}*

┃ 🏷️ *لقبك الجديد:*
┃ ✦ ${newNameLevel} ✦

╭─┈─┈─┈─⟞👑⟝─┈─┈─┈─╮
┃ *استمر في التقدم نحو القمة* ✨
╰─┈─┈─┈─⟞🚀⟝─┈─┈─┈─╯`;
        
        await conn.sendMessage(m.chat, {
            text: msg,
            contextInfo: {
                mentionedJid: [m.sender],
                isForwarded: true,
                forwardingScore: 1,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363405545946827@newsletter',
                    newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
                    serverMessageId: 0
                },
                externalAdReply: {
                    title: "𝐋𝐈𝐆𝐇𝐓 𝐁𝐎𝐓 ┇🩸┇ نظام الرتب",
                    body: "تـرقـيـة فـي الـمـسـتـوى",
                    thumbnailUrl: "https://i.pinimg.com/originals/81/89/fd/8189fd909bbae4ba4e8f1d940f500a60.jpg",
                    sourceUrl: '',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m }); // تم استبدال reply_status بـ m لتجنب أخطاء المتغيرات غير المعرفة
    }
    
    return false;
}
