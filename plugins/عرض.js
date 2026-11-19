// plugins/عرض.js
// ⤹ 𝗠𝗥 𝗦𝗢𝗡𝗚 ⤾

function unwrapQuotedMedia(quoted, rawMessage) {
    const mime = String(quoted?.mediaType || quoted?.mimetype || quoted?.mtype || '');
    if (/image/i.test(mime)) {
        return {
            isImage: true,
            isVideo: false,
            mediaNode: quoted?.msg || quoted?.message || quoted,
        };
    }
    if (/video/i.test(mime)) {
        return {
            isImage: false,
            isVideo: true,
            mediaNode: quoted?.msg || quoted?.message || quoted,
        };
    }

    const containers = [
        quoted?.message,
        quoted?.msg,
        rawMessage?.extendedTextMessage?.contextInfo?.quotedMessage,
        rawMessage?.contextInfo?.quotedMessage,
    ].filter(Boolean);

    const queue = [...containers];
    const seen = new WeakSet();
    while (queue.length > 0) {
        const cur = queue.shift();
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
        seen.add(cur);

        if (cur.imageMessage && typeof cur.imageMessage === 'object') {
            return { isImage: true, isVideo: false, mediaNode: cur.imageMessage };
        }
        if (cur.videoMessage && typeof cur.videoMessage === 'object') {
            return { isImage: false, isVideo: true, mediaNode: cur.videoMessage };
        }

        for (const key of [
            'viewOnceMessage',
            'viewOnceMessageV2',
            'viewOnceMessageV2Extension',
            'ephemeralMessage',
            'documentWithCaptionMessage',
            'message',
        ]) {
            if (cur[key] && typeof cur[key] === 'object') {
                queue.push(cur[key]);
            }
        }
    }

    return { isImage: false, isVideo: false, mediaNode: null };
}

let handler = async (m, { conn }) => {
    if (!m.quoted) {
        return conn.sendMessage(m.chat, {
            text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ قم بالرد على الصورة أو الفيديو الذي عرض لمرة واحدة*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
        }, { quoted: m });
    }

    // ✅ التحقق من نوع الميديا (يدعم المباشر و viewOnceMessageV2)
    const { isImage, isVideo, mediaNode } = unwrapQuotedMedia(m.quoted, m.message || m.msg);

    if (!isImage && !isVideo) {
        return conn.sendMessage(m.chat, {
            text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ الرجاء الرد على صورة أو فيديو فقط*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
        }, { quoted: m });
    }

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

    const caption = `╮───━ 〘 تـم اسـتـخـراج الـمـيـديـا 〙 ━──►
*┃╻✅╹↵ تم فتح ${isImage ? 'الصورة' : 'الفيديو'} المعمول لعرض لمرة واحدة*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`;

    try {
        // ✅ محاولة التحميل
        let media = typeof m.quoted.download === 'function' ? await m.quoted.download() : null;

        if (!Buffer.isBuffer(media) || media.length === 0) {
            throw new Error('فشل تحميل الميديا');
        }

        // ✅ تحديد النوع وإرسالها
        const type = isImage ? 'image' : 'video';

        await conn.sendMessage(m.chat, {
            [type]: media,
            caption
        }, { quoted: m });

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('Reveal Error:', e);

        // ✅ طريقة بديلة
        try {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
            const quoted = m.quoted;
            const mediaType = isImage ? 'image' : 'video';

            const stream = await downloadContentFromMessage(
                mediaNode || quoted.msg || quoted.message || quoted,
                mediaType
            );
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            if (!buffer.length) throw new Error('فشل استخراج الميديا');

            await conn.sendMessage(m.chat, {
                [mediaType]: buffer,
                caption
            }, { quoted: m });

            await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

        } catch (e2) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            await conn.sendMessage(m.chat, {
                text: `╮───━ 〘 خـطـأ 〙 ━──►
*┃╻❌╹↵ ${e2?.message || e?.message || 'فشل استخراج الميديا'}*
╰─────━─━───━───►
> 𝙎𝙊𝙉𝙂 𝘽𝙊𝙏`
            }, { quoted: m });
        }
    }
};

handler.help = ['كشف', 'عرض'];
handler.tags = ['tools'];
handler.category = 'tools';
handler.usePrefix = true;
handler.command = ['كشف', 'reveal', 'كشف-صوره', 'كشف-فيديو', 'ع', 'عرض', 'viewonce', 'vv'];

export default handler;
