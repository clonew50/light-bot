import { MAX_MENTIONS } from "../../system/text-chunks.js";
import { pickRandom } from "../../system/utils.js";

const h =  async (m, { text, bot, conn }) => {
    
    try {
        const { images } = bot.config.info;
        const adReply = {
            title: bot.config.info.nameBot || "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻",
            body: null,
            thumbnailUrl: pickRandom(images),
            mediaType: 1,
            renderLargerThumbnail: false
        };
        
        const customText = text || "𝑳𝑰𝑮𝑯𝑻 𝒀𝑨𝑮𝑨𝑴𝑰 𝑰𝑺 𝑻𝑯𝑬𝑹𝑬🩸";
        
        if (!m.quoted) {
            return await conn.sendMessage(m.chat, { 
                text: customText, 
                contextInfo: { externalAdReply: adReply }
            });
        }
        
        
        const groupMetadata = await conn.groupMetadata(m.chat);
        const participants = groupMetadata.participants.map(v => v.id);
        
        // قائمة المنشنات الضخمة بتقفل الرسالة، فنقصرها على حد آمن.
        await conn.sendMessage(m.chat, {
            forward: m.quoted.fakeObj(),
            mentions: participants.slice(0, MAX_MENTIONS),
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999, 
                externalAdReply: adReply
            }
        });
    } catch (err) {
        await m.reply(err.message);
    }
}

h.usage = ["مخفي"]
h.category = "admin";
h.command = ['م', 'h']
h.group = true;
h.admin = true;
h.usePrefix = false

export default h;