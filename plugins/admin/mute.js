const isOwner = (userId, bot) => bot.config?.owners?.some(o => o.jid === userId || o.lid === userId);

const handler = async (m, { conn, command, bot }) => {
    let target = m.mentionedJid?.[0];
    
    if (target && typeof m.lid2jid === 'function') {
        target = await m.lid2jid(target);
    }
    
    if (!target && m.quoted) {
        target = typeof m.lid2jid === 'function'
            ? await m.lid2jid(m.quoted.sender)
            : m.quoted.sender;
    }
    
    if (!target) return m.reply('╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n
*🔇 ┇ كتم/فك_كتم @user*
أو رد على رسالة المستخدم لكتمه.');
    if (typeof target !== 'string') return m.reply('*❌ حدث خطأ في تحديد المستخدم*');
    if (isOwner(target, bot)) return m.reply('*❌ لا يمكن كتم المطور*');
    
    const group = global.db.groups[m.chat] ||= {};
    const muteList = group.mute ||= [];
    const isMuted = muteList.includes(target);
    
    if (command === 'كتم') {
        if (isMuted) {
            return conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n
💡 *العضو @${target.split('@')[0]} مكتوم بالفعل مسبقاً.*`,
                mentions: [target]
            });
        }
        muteList.push(target);
        return conn.sendMessage(m.chat, {
            text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n
*✅ تم كتم @${target.split('@')[0]} بنجاح.*
*🔒 سيتم حذف أي رسالة يرسلها فوراً.*`,
            mentions: [target]
        });
    }
    
    if (command === 'فك_كتم') {
        if (!isMuted) {
            return conn.sendMessage(m.chat, {
                text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n
💡 *العضو @${target.split('@')[0]} ليس مكتوماً.*`,
                mentions: [target]
            });
        }
        group.mute = muteList.filter(userId => userId !== target);
        return conn.sendMessage(m.chat, {
            text: `╭───⟢❲ 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 ❳╰───⟢\n
*🔓 تم فك الكتم عن @${target.split('@')[0]}.*
*✨ يمكنه التحدث والإرسال الآن بحرية.*`,
            mentions: [target]
        });
    }
};

handler.before = async (m, { conn, bot }) => {
    if (!m.isGroup || m.isOwner || m.isAdmin || isOwner(m.sender, bot)) return;
    
    const muteList = global.db?.groups[m.chat]?.mute;
    if (!Array.isArray(muteList) || !muteList.includes(m.sender)) return;
    
    try {
        await conn.sendMessage(m.chat, { delete: m.key });
        return true;
    } catch (error) {
        console.error('خطأ أثناء محاولة حذف رسالة عضو مكتوم:', error);
    }
};

handler.command = ['كتم', 'فك_كتم'];
handler.usage = ['كتم @user', 'فك_كتم @user'];
handler.category = 'admin';
handler.admin = true;

export default handler;
