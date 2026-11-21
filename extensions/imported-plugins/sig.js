let handler = async (m, { conn, args, usedPrefix, command }) => {
    const username = args[0]
    if (!username) {
        return m.reply(`📌 *Cara Penggunaan:*\n\n${usedPrefix}${command} <username>\n\nContoh:\n${usedPrefix}${command} go24.q`)
    }

    const cleanUser = username.replace(/^@/, '').replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '')

    let profilePic = ''
    let fullName = cleanUser
    let bio = 'No bio'
    let followers = '-'
    let following = '-'
    let posts = '-'
    let isVerified = false
    let isPrivate = false

    try {
        const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`, {
            headers: {
                'X-IG-App-ID': '936619743392459',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })
        const json = await res.json()
        const user = json?.data?.user
        if (user) {
            profilePic = user.hd_profile_pic_url_info?.url || user.profile_pic_url_hd || ''
            fullName = user.full_name || cleanUser
            bio = user.biography || 'No bio'
            followers = user.edge_followed_by?.count || user.follower_count || '-'
            following = user.edge_follow?.count || user.following_count || '-'
            posts = user.edge_owner_to_timeline_media?.count || '-'
            isVerified = !!user.is_verified
            isPrivate = !!user.is_private
        }
    } catch {}

    const FOOTER = `© YONO BOT - Developer Yono - 212672139914 | ${followers} Followers`

    const primitive = {
        title: fullName,
        subtitle: `@${cleanUser} • ${bio.substring(0, 40)}`,
        secondary_subtitle: FOOTER,
        entity_id: '123456',
        entity_url: 'https://instagram.com/' + cleanUser,
        entity_type: 'WEBSITE',
        action_type: 'OPEN_URL',
        is_verified: isVerified,
        __typename: 'GenAICompactEntityPrimitive'
    }
    if (profilePic) primitive.image = { url: profilePic, mime_type: 'image/jpeg' }

    const richMsg = {
        messageType: 1,
        submessages: [],
        unifiedResponse: {
            data: Buffer.from(JSON.stringify({
                sections: [
                    {
                        view_model: {
                            primitives: [primitive],
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
                                    text: '# {{social_entity_1}}Lihat Profil\0{{/social_entity_1}} ',
                                    inline_entities: [{
                                        key: 'social_entity_1',
                                        metadata: {
                                            __typename: 'GenAISocialEntityItem',
                                            entity_id: cleanUser,
                                            entity_name: cleanUser,
                                            entity_full_name: fullName,
                                            entity_picture_url: profilePic || '',
                                            entity_url: 'https://www.instagram.com/' + cleanUser,
                                            entity_type: 'IG_PROFILE',
                                            is_verified: isVerified
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

    try {
        await conn.relayMessage(m.chat, {
            botForwardedMessage: { message: { richResponseMessage: richMsg } }
        }, {})
    } catch (e) {
        m.reply('❌ Error: ' + (e.message || e))
    }
}

handler.usage = ['sig <username>']
handler.category = 'tools'
handler.command = /^(sig|cekig|lookupig)$/i
export default handler