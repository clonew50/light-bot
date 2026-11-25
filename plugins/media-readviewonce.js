var handler = async (m, { conn }) => {
    const rawQuoted = m.msg?.contextInfo?.quotedMessage || {}
    const isViewOnce = Boolean(
        m.quoted?.viewOnce ||
        m.quoted?.msg?.viewOnce ||
        m.quoted?.mediaMessage?.[m.quoted?.mediaType]?.viewOnce ||
        rawQuoted.viewOnceMessage ||
        rawQuoted.viewOnceMessageV2 ||
        rawQuoted.viewOnceMessageV2Extension
    )

    if (!m.quoted || !isViewOnce)
        throw '✧✦┇*رد على فيديو أو صورة تم تعيينها للمشاهدة مرة واحدة فقط.*┇✦✧'

    let buffer = await m.quoted.download()
    let caption = m.quoted.msg?.caption || m.quoted.caption || ''
    let mtype = (m.quoted.mediaType || m.quoted.mtype || '').replace(/Message$/, '')

    if (mtype === 'image' || mtype === 'video') {
        caption += '\n\n لا يسمح لك بإخفاء شيء هنا! هااا 🤫'
    }

    const msgPayload = mtype === 'audio'
        ? { audio: buffer, mimetype: m.quoted.mimetype || 'audio/mp4', ptt: Boolean(m.quoted.ptt) }
        : { [mtype]: buffer, caption }

    await conn.sendMessage(m.chat, msgPayload, { quoted: m })
}

handler.help = ['readviewonce']
handler.tags = ['media']
handler.command = /^فضح|readviewonce|mirar$/i

export default handler
