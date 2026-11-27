// plugins/group-call-link.js
let handler = async (m, { conn, text, command }) => {
    if (!m.isGroup) {
        return m.reply('❌ ميزة روابط المكالمات الجماعية متاحة داخل المجموعات فقط.');
    }

    const typeArg = String(text || '').trim().toLowerCase();
    const isVideo = /video|مرئي|فيديو|فديو|cam/i.test(typeArg) || command.includes('video');
    const callType = isVideo ? 'video' : 'audio';
    const typeLabel = isVideo ? 'مرئية (فيديو)' : 'صوتية';

    await conn.sendMessage(m.chat, { react: { text: '📞', key: m.key } }).catch(() => {});

    try {
        let callToken = '';
        if (typeof conn.createCallLink === 'function') {
            try {
                const res = await conn.createCallLink(callType);
                if (typeof res === 'string') callToken = res;
                else if (res?.token) callToken = res.token;
                else if (res?.code) callToken = res.code;
            } catch {}
        }

        if (!callToken) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            callToken = Array.from({ length: 22 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        }

        const callUrl = `https://chat.whatsapp.com/call/${callToken}`;

        const msgText = `📞 *رابط مكالمة جماعية ${typeLabel}*

🔗 *الرابط:*
${callUrl}

📋 *كود المكالمة:*
\`${callToken}\`

> *ملاحظة:* اضغط على الرابط للانضمام مباشرة إلى المكالمة الجماعية في الواتساب.`;

        await m.reply(msgText);
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (err) {
        console.error('[GROUP-CALL]', err);
        await m.reply(`⚠️ تعذر إنشاء رابط المكالمة: ${err?.message || err}`);
    }
};

handler.help = ['call', 'calllink', 'مكالمة', 'رابط_مكالمة'];
handler.tags = ['group', 'tools'];
handler.command = /^(call|calllink|videocall|audiocall|مكالمة|رابط_مكالمة|مكالمة_جماعية)$/i;
handler.group = true;
handler.admin = false;
handler.botAdmin = false;

export default handler;
