// plugins/كشف.js
// ⤹ 𝗠𝗥 𝗦𝗢𝗡𝗚 ⤾

import { downloadViewOnceMediaBuffer } from '../system/mediaService.js';

let handler = async (m, { conn }) => {
    if (!m.quoted) {
        return conn.sendMessage(m.chat, {
            text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ قم بالرد على الصورة أو الفيديو الذي عرض لمرة واحدة*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
        }, { quoted: m });
    }

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

    try {
        // ✅ محاولة استخراج الميديا المجهزة
        let res = await downloadViewOnceMediaBuffer(m, conn);

        // ✅ محاولة ثانوية مباشرة عبر conn.downloadMediaMessage
        if ((!res.ok || !res.buffer) && typeof conn?.downloadMediaMessage === 'function') {
            try {
                const altBuf = await conn.downloadMediaMessage(
                    { message: m.quoted?.message || m.message || {} },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: conn.updateMediaMessage }
                );
                if (Buffer.isBuffer(altBuf) && altBuf.length > 0) {
                    res = { ok: true, buffer: altBuf, type: res.type || 'image' };
                }
            } catch (_) {}
        }

        if (!res.ok || !res.buffer) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return conn.sendMessage(m.chat, {
                text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ ${res.error || 'فشل استخراج الميديا: تأكد من الرد على صورة أو فيديو'}*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
            }, { quoted: m });
        }

        // ✅ تحديد النوع وإرسالها
        const isImage = res.type === 'image';
        const isVideo = res.type === 'video';
        const type = isImage ? 'image' : (isVideo ? 'video' : 'audio');
        const mediaWord = isImage ? 'الصورة' : (isVideo ? 'الفيديو' : 'التسجيل الصوتي');

        const caption = `╮───━ 〘 تـم اسـتـخـراج الـمـيـديـا 〙 ━──►
*┃╻✅╹↵ تم فتح ${mediaWord} المعمول لعرض لمرة واحدة*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`;

        if (type === 'audio') {
            await conn.sendMessage(m.chat, {
                audio: res.buffer,
                mimetype: res.mimetype || 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });
            await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, {
                [type]: res.buffer,
                caption
            }, { quoted: m });
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('Reveal Error:', e);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        await conn.sendMessage(m.chat, {
            text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ ${e.message || 'فشل استخراج الميديا'}*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
        }, { quoted: m });
    }
};

handler.help = ['كشف', 'عرض'];
handler.usage = ['عرض'];
handler.tags = ['tools'];
handler.category = 'tools';
handler.usePrefix = true;
handler.command = ['كشف', 'reveal', 'كشف-صوره', 'كشف-فيديو', 'ع', 'عرض', 'viewonce', 'vv'];

export default handler;
