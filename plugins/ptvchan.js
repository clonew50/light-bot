// plugins/owner-ptvchan.js - Elaina-Multidevice FIX | ALYA 2026
import { readFileSync } from 'fs'

let handler = async (m, { sock, config }) => {
    // Elaina كتستعمل sock ماشي conn
    let q = m.quoted? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mediaType || ''

    if (!/video/.test(mime)) {
        return m.reply(
            `⚠️ *How to Use PTV Channel*\n\n` +
            `Reply to a video with the command:\n` +
            `*.ptvchan*\n\n` +
            `Example: reply to a video >.ptvchan`
        )
    }

    await m.reply(`⏳ _Sending round PTV to the Channel..._`)

    try {
        let videoBuffer = await q.download()
        if (!videoBuffer) throw new Error('Failed to download')

        // ID Channel - بدلو هنا إلا بغيتي
        let channelId = '120363404849776664@newsletter'
        try {
            let cfg = JSON.parse(readFileSync('./config.js', 'utf-8').match(/saluran\s*:\s*\{[^}]+\}/)?.[0] || '{}')
        } catch {}
        if (config?.saluran?.id) channelId = config.saluran.id
        if (global.config?.saluran?.id) channelId = global.config.saluran.id

        // طريقة Elaina-Baileys الصحيحة لـ PTV
        await sock.sendMessage(channelId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            ptv: true
        })

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return m.reply(`✅ *Success!*\nRound PTV successfully sent to the Channel\nID: ${channelId}\n\n© 2026 ALYA BOT | YONO`)

    } catch (e) {
        console.error('[ptvchan elaina]', e)
        await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return m.reply(`❌ *Failed!*\n\nMake sure the bot is already an ADMIN in the Channel.\nError: ${e.message}`)
    }
}

handler.help = ['ptvchan']
handler.tags = ['owner']
handler.command = /^(ptvchan|ptvch|ptvchanel)$/i
handler.owner = true
handler.rowner = false

export default handler