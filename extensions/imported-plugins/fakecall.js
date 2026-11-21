import axios from 'axios'
import FormData from 'form-data'

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const cmd = command.toLowerCase()

    if (!text || !text.includes('|')) {
        let helpText = `Halo! Format salah.\n\n`
        helpText += `*Daftar Perintah:*\n`
        helpText += `- *${usedPrefix}fakecall* (Android)\n`
        helpText += `- *${usedPrefix}fakecall-ios* (iPhone)\n\n`
        helpText += `*Cara Penggunaan:*\n`
        helpText += `Ketik Nama | Durasi\n\n`
        helpText += `*Contoh:*\n`
        helpText += `- *${usedPrefix}fakecall Zann | 03:33:33*\n`
        helpText += `- *${usedPrefix}fakecall-ios Sayangku | 12:00:00*\n\n`
        helpText += `*Tips:* Reply gambar untuk jadi avatar penelepon!`
        return m.reply(helpText)
    }

    const [nama, durasi] = text.split('|').map(s => s.trim())

    if (!nama) return m.reply(`Nama tidak boleh kosong!`)
    if (!durasi) return m.reply(`Durasi tidak boleh kosong!`)

    await conn.sendMessage(m.chat, { react: { text: '🕕', key: m.key } })

    try {
        let bufferBase

        if (m.quoted && m.quoted.mtype && m.quoted.mtype.includes('image')) {
            try { bufferBase = await m.quoted.download() } catch {}
        } else if (m.mtype && m.mtype.includes('image')) {
            try { bufferBase = await m.download() } catch {}
        }

        if (!bufferBase) {
            try {
                const ppUrl = await conn.profilePictureUrl(m.sender, 'image')
                const res = await axios.get(ppUrl, { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            } catch {
                const res = await axios.get('https://files.catbox.moe/nwvkbt.png', { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            }
        }

        const form = new FormData()
        form.append('avatarUrl', bufferBase, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
        form.append('name', nama)
        form.append('duration', durasi)

        let endpoint = 'fakecall-android'
        if (cmd === 'fakecall-ios' || cmd === 'fakecallwa-ios') {
            endpoint = 'fakecall-ios'
        }

        const apiUrl = `https://my.izuka-api.xyz/api/canvas/${endpoint}`

        const response = await axios.post(apiUrl, form, {
            headers: form.getHeaders(),
            responseType: 'arraybuffer'
        })

        await conn.sendMessage(m.chat, { image: Buffer.from(response.data), caption: `✅ Fake call: ${nama} | ${durasi}` }, { quoted: m })
        await conn.sendMessage(m.chat, { react: { text: '📞', key: m.key } })

    } catch (err) {
        console.error(err)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return m.reply(`❌ Gagal membuat fake call: ${err.message}`)
    }
}

handler.usage = ['fakecall', 'fakecall-ios']
handler.category = 'tools'
handler.command = /^(fakecall|fakecall-android|fakecall-ios|fakecallwa)$/i

export default handler