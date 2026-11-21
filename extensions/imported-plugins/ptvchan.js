// plugins/owner-ptvchan.js - Elaina-Multidevice FIX | ALYA 2026
import { readFileSync } from 'fs'

let handler = async (m, { sock, config }) => {
    // Elaina كتستعمل sock ماشي conn
    let q = m.quoted? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mediaType || ''

    if (!/video/.test(mime)) {
        return m.reply(
            `⚠️ *Cara Pakai PTV Channel*\n\n` +
            `Balas video dengan perintah:\n` +
            `*.ptvchan*\n\n` +
            `Contoh: reply video >.ptvchan`
        )
    }

    await m.reply(`⏳ _Mengirim PTV bulat ke Channel..._`)

    try {
        let videoBuffer = await q.download()
        if (!videoBuffer) throw new Error('Gagal download')

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
        return m.reply(`✅ *Berhasil!*\nPTV bulat berhasil dikirim ke Channel\nID: ${channelId}\n\n© 2026 ALYA BOT | YONO`)

    } catch (e) {
        console.error('[ptvchan elaina]', e)
        await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return m.reply(`❌ *Gagal!*\n\nPastikan bot sudah jadi ADMIN di Channel.\nError: ${e.message}`)
    }
}

handler.usage = ['ptvchan']
handler.category = 'owner'
handler.command = /^(ptvchan|ptvch|ptvchanel)$/i
handler.owner = true
handler.rowner = false

export default handler