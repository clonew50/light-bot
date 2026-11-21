let handler = async (m, { conn, isBotAdmin, isAdmin }) => {
    if (!m.isGroup) return m.reply('❌ Perintah ini hanya untuk di dalam grup')
    if (!isBotAdmin) return m.reply('❌ Bot harus jadi admin untuk menerima permintaan')
    if (!isAdmin) return m.reply('❌ Kamu harus jadi admin grup')

    try {
        // Ambil daftar permintaan tertunda
        const pending = await conn.groupRequestParticipantsList(m.chat)

        if (!pending || pending.length === 0) {
            return await conn.sendMessage(m.chat, { text: '✅ Tidak ada permintaan tertunda saat ini' }, { quoted: m })
        }

        let count = 0
        // Terima semua permintaan
        for (let req of pending) {
            try {
                await conn.groupRequestParticipantsUpdate(m.chat, [req.jid || req], "approve")
                count++
                await new Promise(r => setTimeout(r, 500))
            } catch {}
        }

        // Kirim info jumlah yang diterima
        await conn.relayMessage(
            m.chat,
            {
                requestPaymentMessage: {
                    currencyCodeIso4217: "USD",
                    amount1000: count * 1000,
                    requestFrom: "0@lid",
                    noteMessage: {
                        extendedTextMessage: {
                            text: `✅ Berhasil menerima *${count}* permintaan bergabung ke grup ✅`,
                            contextInfo: {
                                remoteJid: m.chat,
                                mentionedJid: []
                            }
                        }
                    },
                    expiryTimestamp: 0
                },
                messageContextInfo: {
                    }
            },
            {}
        )

        await conn.sendMessage(m.chat, { text: `✅ Diterima *${count}* dari total ${pending.length} permintaan` }, { quoted: m })

    } catch (e) {
        console.log(e)
        m.reply(`❌ Error: ${e.message}\nPastikan fitur permintaan bergabung diaktifkan di pengaturan grup`)
    }
}

handler.command = ['قبول', 'acceptall', 'terima']
handler.category = 'group'
handler.group = true
handler.admin = true
handler.botAdmin = true

handler.usage = ['قبول', 'acceptall', 'terima'];

export default handler