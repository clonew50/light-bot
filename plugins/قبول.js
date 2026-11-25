let handler = async (m, { conn, isBotAdmin, isAdmin }) => {
    if (!m.isGroup) return m.reply('❌ This command is only for use inside a group')
    if (!isBotAdmin) return m.reply('❌ The bot must be an admin to accept requests')
    if (!isAdmin) return m.reply('❌ You must be a group admin')

    try {
        // Get the list of pending requests
        const pending = await conn.groupRequestParticipantsList(m.chat)
        
        if (!pending || pending.length === 0) {
            return await conn.sendMessage(m.chat, { text: '✅ There are no pending requests right now' }, { quoted: m })
        }

        let count = 0
        // Accept all requests
        for (let req of pending) {
            try {
                await conn.groupRequestParticipantsUpdate(m.chat, [req.jid || req], "approve")
                count++
                await new Promise(r => setTimeout(r, 500))
            } catch {}
        }

        // Send info about the number accepted
        await conn.relayMessage(
            m.chat,
            {
                requestPaymentMessage: {
                    currencyCodeIso4217: "USD",
                    amount1000: count * 1000,
                    requestFrom: "0@lid",
                    noteMessage: {
                        extendedTextMessage: {
                            text: `✅ Successfully accepted *${count}* join requests to the group ✅`,
                            contextInfo: {
                                remoteJid: m.chat,
                                mentionedJid: []
                            }
                        }
                    },
                    expiryTimestamp: 0
                },
                messageContextInfo: {
                    messageSecret: "IDU9Ui201V3616ZVHI/Hv94aQdbFhXI8fVO1R9UgB10="
                }
            },
            {}
        )

        await conn.sendMessage(m.chat, { text: `✅ Accepted *${count}* out of ${pending.length} requests` }, { quoted: m })

    } catch (e) {
        console.log(e)
        m.reply(`❌ Error: ${e.message}\nMake sure the join request feature is enabled in the group settings`)
    }
}

handler.command = ['قبول', 'acceptall', 'terima']
handler.tags = ['group']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler