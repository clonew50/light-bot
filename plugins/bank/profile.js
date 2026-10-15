async function handler(m, { conn, bot }) {
    const user = global.db?.users[m.sender] || {};
    const xp = Number(user.xp) || 0;
    const level = Number(user.level) || 0;
    const nameLevel = user.nameLevel || 'مواطن🏙️';
    const cookies = Number(user.cookies) || 0;
    const warnings = Number(user.warnings) || 0;
    const banned = Boolean(user.banned);
    const premium = Boolean(user.premium);
    const name = user.name || 'غير مسجل';
    const age = user.age || 'غير مسجل';
    
    const pushName = String(m.pushName || m.sender.split('@')[0]);
    const phoneNumber = m.sender.split('@')[0];
    const levels = [100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5700, 6800, 8000, 9300, 10700, 12200, 13800, 15500, 17500, 20000];
    const nextLevelXp = levels[level] || levels[levels.length - 1];
    const filled = Math.min(10, Math.floor((xp / nextLevelXp) * 10));
    const xpProgress = Math.min(100, Math.floor((xp / nextLevelXp) * 100));
    const status = banned ? '🚫 مـحـظـور' : (premium ? '👑 بـريـمـيـوم' : '🟢 عـادي');
    
    const defaultPic = 'https://i.pinimg.com/originals/11/26/97/11269786cdb625c60213212aa66273a9.png';
    let profilePic = defaultPic;
    try {
        const result = await conn.profilePictureUrl(m.sender, 'image');
        if (typeof result === 'string' && result.trim()) profilePic = result;
    } catch {}
    
    const msg = `╭─┈─┈─┈─┇🗃┇─┈─┈─┈─╮
┃ *🩸 بـروفـايـل ${pushName} 📖*
╰─┈─┈─┈─┇🗃┇─┈─┈─┈─╯

┃ 📱 *الـرقـم:* ${phoneNumber}
┃ 🏷️ *الـاسـم:* ${pushName}
┃ 📝 *الـاسـم الـمـسـجـل:* ${name}
┃ 📅 *الـعـمـر:* ${age}
┃ 🎭 *الـلـقـب:* ${nameLevel}
┃ 📊 *الـمـسـتـوى:* ${level}
┃ ⭐ *الـنـقـاط:* ${xp} / ${nextLevelXp}
┃ 📈 *التـقـدم:* [${'⬜'.repeat(filled)}${'⬛'.repeat(10 - filled)}] ${xpProgress}%
┃ 🍪 *الـكـوكـيـز:* ${cookies}
┃ ⚠️ *الـتـحـذيـرات:* ${warnings}
┃ 🏷️ *الـحـالـة:* ${status}

╭─┈─┈─┈─⟞🩸⟝─┈─┈─┈─╮
┃ *اسـتـمـر فـي الـتـفـاعـل لـتـتـرفـع مـسـتـوك* 🚀
╰─┈─┈─┈─⟞📖⟝─┈─┈─┈─╯`;
    
    const cfg = bot.config?.info || {};
    await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption: msg,
        contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardingScore: 1,
            forwardedNewsletterMessageInfo: {
                newsletterJid: cfg.idChannel || '120363405545946827@newsletter',
                newsletterName: cfg.nameChannel || cfg.nameBot || 'LIGHT BOT',
                serverMessageId: 0
            }
        }
    }, { quoted: m });
}


handler.usage = ["بروفايل"];
handler.category = "bank";
handler.command = ["بروفايل", "profile", "my"];

export default handler;