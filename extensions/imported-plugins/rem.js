import { generateWAMessageContent, generateWAMessageFromContent } from '@whiskeysockets/baileys'

let handler = async (m, { conn }) => {
    try {
        await conn.sendMessage(m.chat, { react: { text: '🩷', key: m.key } })

        // === صورة و فيديو واحد ثابت ===
        const imageUrl = "https://files.catbox.moe/11oqt3.jpeg"
        const videoUrl = "https://files.catbox.moe/ns4el2.mp4"

        // 1 - الصورة
        const imgBuffer = (await conn.getFile(imageUrl)).data
        const imgMsg = await generateWAMessageContent(
            { image: imgBuffer },
            { upload: conn.waUploadToServer }
        )
        imgMsg.imageMessage.contextInfo = { participant: m.sender }

        const parentMsg = generateWAMessageFromContent(m.chat, { imageMessage: imgMsg.imageMessage }, { userJid: conn.user.id })
        await conn.relayMessage(m.chat, parentMsg.message, { messageId: parentMsg.key.id })
        const newParentId = parentMsg.key.id

        await new Promise(r => setTimeout(r, 600))

        // 2 - الفيديو المرتبط بالصورة
        const vidBuffer = (await conn.getFile(videoUrl)).data
        const vidMsg = await generateWAMessageContent(
            { video: vidBuffer, mimetype: 'video/mp4', gifPlayback: false },
            { upload: conn.waUploadToServer }
        )
        vidMsg.videoMessage.gifPlayback = false
        vidMsg.videoMessage.ptv = false

        const childMsg = generateWAMessageFromContent(m.chat, {
            videoMessage: vidMsg.videoMessage,
            messageContextInfo: {
                messageAssociation: {
                    associationType: 12,
                    parentMessageKey: { remoteJid: m.chat, fromMe: true, id: newParentId }
                }
            }
        }, { userJid: conn.user.id })

        await conn.relayMessage(m.chat, childMsg.message, { messageId: childMsg.key.id })

    } catch (e) {
        console.log(e)
    }
}

handler.usage = ['bot', 'rem']
handler.category = 'game'
handler.command = new RegExp
handler.customPrefix = /^(bot|rem|test3|!)$/i
export default handler