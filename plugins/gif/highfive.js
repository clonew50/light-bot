import { fetchAnimeGif } from "../../system/mediaService.js";
import { gifToMp4 } from "../../system/utils.js";

let handler = async (m, { conn, command }) => {
    try {
        let target = m.mentionedJid?.[0] || m.quoted?.sender;
        if (!target) return m.reply(`*منشن شخص مثل /${command} @${m.sender.split('@')[0]}*`);

        if (m.isGroup) {
            let group = await conn.groupMetadata(m.chat);
            if (!group.participants.find(p => p.id === target)) {
                return m.reply(`*العضو ليس في المجموعة*`);
            }
        }

        const { url, anime_name } = await fetchAnimeGif("highfive");
        const video = await gifToMp4(url);

        await conn.sendMessage(m.chat, {
            caption: `*_@${m.sender.split('@')[0]} يصافحك @${target.split('@')[0]}_*\n> *_الانمي: ${anime_name}_*`,
            video,
            gifPlayback: true,
            mentions: [target, m.sender]
        });
    } catch (e) {
        m.reply(`❌ ${e?.message || 'تعذر جلب الأنيمي GIF'}`);
    }
};

handler.usage = ["مصافحه @منشن"];
handler.category = "gif";
handler.command = ["مصافحه"];
export default handler;