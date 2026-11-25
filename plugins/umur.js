// plugins/umur.js - Alya Bot | Dev yono - NEXT BIRTHDAY INFO

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`📌 *Usage:* .umur 2/2/2010`)

    let input = args[0]
    let d, mo, y
    if (input.includes('/')) { const p = input.split('/'); d = parseInt(p[0]); mo = parseInt(p[1]); y = parseInt(p[2]) }
    else if (input.includes('-')) { const p = input.split('-'); d = parseInt(p[0]); mo = parseInt(p[1]); y = parseInt(p[2]) }
    else { y = parseInt(input); d = 2; mo = 2 }

    const birth = new Date(y, mo - 1, d)
    const now = new Date()
    let tahun = now.getFullYear() - birth.getFullYear()
    let bulan = now.getMonth() - birth.getMonth()
    let hari = now.getDate() - birth.getDate()
    if (hari < 0) { bulan--; hari += 30 }
    if (bulan < 0) { tahun--; bulan += 12 }

    const totalHari = Math.floor((now - birth) / (1000*60*60*24))

    // Calculate how much is left until the next birthday
    let nextBD = new Date(now.getFullYear(), mo - 1, d)
    if (nextBD < now) nextBD.setFullYear(now.getFullYear() + 1)
    const sisaHari = Math.ceil((nextBD - now) / (1000*60*60*24))
    const sisaBulan = Math.floor(sisaHari / 30)

    const IMAGE_URL = 'https://files.catbox.moe/qnof82.jpg'

    // This is the info that appears when you click the button
    const detailFullName = `🎂 Age: ${tahun}y ${bulan}mo ${hari}d | 📅 Born: ${d}/${mo}/${y} | ⏳ Lived: ${totalHari} days | 🎉 Next birthday: ${sisaHari} days left (${sisaBulan} months) | Next year: ${tahun+1} Years | © Alya - Dev yono`

    const richMsg = {
        messageType: 1,
        submessages: [],
        unifiedResponse: {
            data: Buffer.from(JSON.stringify({
                sections: [
                    {
                        view_model: {
                            primitives: [{
                                title: `${tahun} Years, ${bulan} Months`,
                                subtitle: `Next birthday ${sisaHari} days left`,
                                secondary_subtitle: `Lived ${totalHari} days • © Alya - Dev yono`,
                                image: { url: IMAGE_URL, mime_type: 'image/jpeg' },
                                entity_id: '123456',
                                entity_url: 'https://wa.me/',
                                entity_type: 'WEBSITE',
                                action_type: 'OPEN_URL',
                                is_verified: true,
                                __typename: 'GenAICompactEntityPrimitive'
                            }],
                            __typename: 'GenAIActionRowLayoutViewModel'
                        }
                    },
                    {
                        view_model: {
                            primitives: [{ type: 'HORIZONTAL_LINE', __typename: 'GenAIDividerPrimitive' }],
                            __typename: 'GenAIVStackLayoutViewModel'
                        }
                    },
                    {
                        view_model: {
                            primitives: [
                                { __typename: 'GenAISpacerPrimitive' },
                                {
                                    text: '# {{social_entity_1}}View Remaining Age & Birthday\0{{/social_entity_1}} ',
                                    inline_entities: [{
                                        key: 'social_entity_1',
                                        metadata: {
                                            __typename: 'GenAISocialEntityItem',
                                            entity_id: `${tahun}`,
                                            entity_name: `${sisaHari} days until birthday`,
                                            entity_full_name: detailFullName,
                                            entity_picture_url: IMAGE_URL,
                                            entity_url: 'https://wa.me/',
                                            entity_type: 'IG_PROFILE',
                                            is_verified: true
                                        }
                                    }],
                                    __typename: 'GenAIMarkdownTextUXPrimitive'
                                },
                                { __typename: 'GenAISpacerPrimitive' }
                            ],
                            __typename: 'GenAIActionRowLayoutViewModel'
                        }
                    }
                ]
            })).toString('base64')
        },
        contextInfo: { isForwarded: true, forwardOrigin: 4 }
    }

    await conn.relayMessage(m.chat, {
        botForwardedMessage: { message: { richResponseMessage: richMsg } }
    }, {})
}

handler.help = ['umur <date>']
handler.tags = ['tools']
handler.command = /^(umur|age)$/i
export default handler