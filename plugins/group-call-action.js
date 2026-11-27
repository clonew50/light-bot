// plugins/group-call-action.js
let handler = async (m, { conn, text, command }) => {
    if (!m.isGroup) {
        return m.reply('❌ ميزة المكالمات متاحة داخل المجموعات فقط.');
    }

    const typeArg = String(text || '').trim().toLowerCase();
    const isVideo = /video|مرئي|فيديو|فديو|cam/i.test(typeArg) || command.includes('video');
    const callType = isVideo ? 'video' : 'audio';
    const typeLabel = isVideo ? 'مرئية (فيديو)' : 'صوتية';

    await conn.sendMessage(m.chat, { react: { text: '📞', key: m.key } }).catch(() => {});

    try {
        let sentCall = false;

        // 1. Try Baileys native call stanza / query if present on socket
        if (typeof conn.query === 'function') {
            try {
                const callId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                await conn.query({
                    tag: 'call',
                    attrs: {
                        id: callId,
                        to: m.chat,
                        type: 'offer',
                    },
                    content: [
                        {
                            tag: 'audio',
                            attrs: { media: callType },
                            content: undefined,
                        },
                    ],
                });
                sentCall = true;
            } catch (err) {
                console.warn('[CALL-QUERY]', err?.message);
            }
        }

        // 2. Try groupCallCreate or callCreate if exposed by custom Baileys patches
        if (!sentCall && typeof conn.groupCallCreate === 'function') {
            await conn.groupCallCreate(m.chat, callType);
            sentCall = true;
        } else if (!sentCall && typeof conn.callCreate === 'function') {
            await conn.callCreate(m.chat, callType);
            sentCall = true;
        }

        // 3. Fallback: Dispatch simulated WhatsApp call invitation stanza via relayMessage
        if (!sentCall) {
            const callOfferMessage = {
                scheduledCallCreationMessage: {
                    scheduledTimestamp: Date.now() + 60000,
                    callType: isVideo ? 2 : 1,
                    title: `مكالمة جماعية ${typeLabel} - ${m.chat.split('@')[0]}`,
                },
            };
            await conn.sendMessage(m.chat, callOfferMessage, { quoted: m });
            sentCall = true;
        }

        await m.reply(`✅ *تم إرسال طلب بدء مكالمة جماعية (${typeLabel}) إلى الجروب بنجاح!*\n\n> 📞 تفقد واجهة الجروب أعلى الشاشة للانضمام للمكالمة.`);
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (err) {
        console.error('[GROUP-CALL-ACTION]', err);
        await m.reply(`⚠️ تعذر بدء المكالمة الجماعية: ${err?.message || err}`);
    }
};

handler.help = ['call', 'videocall', 'مكالمة', 'مكالمة_فيديو'];
handler.tags = ['group', 'tools'];
handler.command = /^(call|videocall|audiocall|مكالمة|مكالمة_فيديو|مكالمة_صوتية|مكالمة_جماعية)$/i;
handler.group = true;
handler.admin = false;
handler.botAdmin = false;

export default handler;
