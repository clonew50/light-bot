function unwrapViewOnceContainer(obj) {
    let cur = obj
    let hasViewOnceWrapper = false
    for (let i = 0; i < 6 && cur && typeof cur === 'object'; i++) {
        if (cur.ephemeralMessage?.message) {
            cur = cur.ephemeralMessage.message
            continue
        }
        if (cur.viewOnceMessage?.message) {
            hasViewOnceWrapper = true
            cur = cur.viewOnceMessage.message
            continue
        }
        if (cur.viewOnceMessageV2?.message) {
            hasViewOnceWrapper = true
            cur = cur.viewOnceMessageV2.message
            continue
        }
        if (cur.viewOnceMessageV2Extension?.message) {
            hasViewOnceWrapper = true
            cur = cur.viewOnceMessageV2Extension.message
            continue
        }
        break
    }
    return { inner: cur, hasViewOnceWrapper }
}

function findMediaEntry(container) {
    if (!container || typeof container !== 'object') return null
    for (const key of ['imageMessage', 'videoMessage', 'audioMessage']) {
        if (container[key] && typeof container[key] === 'object') {
            return { mediaKey: key, node: container[key] }
        }
    }
    return null
}

var handler = async (m, { conn }) => {
    const rawQuoted = m.msg?.contextInfo?.quotedMessage || {}
    const storedMsg = m.quoted?.id && typeof conn.loadMessage === 'function' ? conn.loadMessage(m.quoted.id) : null
    const rawStored = storedMsg?.message || {}

    const unwrappedQuoted = unwrapViewOnceContainer(rawQuoted)
    const unwrappedStored = unwrapViewOnceContainer(rawStored)

    const quotedEntry = findMediaEntry(unwrappedQuoted.inner) || findMediaEntry(m.quoted?.mediaMessage)
    const storedEntry = findMediaEntry(unwrappedStored.inner)
    const mediaEntry = quotedEntry || storedEntry
    const mediaNode = (quotedEntry?.node?.url || quotedEntry?.node?.directPath)
        ? quotedEntry.node
        : (storedEntry?.node || mediaEntry?.node || m.quoted?.msg || m.quoted)

    const isViewOnce = Boolean(
        m.quoted?.viewOnce ||
        m.quoted?.msg?.viewOnce ||
        m.quoted?.mediaMessage?.[m.quoted?.mediaType]?.viewOnce ||
        mediaEntry?.node?.viewOnce ||
        storedEntry?.node?.viewOnce ||
        unwrappedQuoted.hasViewOnceWrapper ||
        unwrappedStored.hasViewOnceWrapper
    )

    if (!m.quoted || !isViewOnce)
        throw '✧✦┇*رد على فيديو أو صورة تم تعيينها للمشاهدة مرة واحدة فقط.*┇✦✧'

    const resolvedMediaType = (mediaEntry?.mediaKey || m.quoted.mediaType || m.quoted.mtype || '').replace(/Message$/i, '')
    if (!['image', 'video', 'audio'].includes(resolvedMediaType))
        throw '✧✦┇*رد على فيديو أو صورة تم تعيينها للمشاهدة مرة واحدة فقط.*┇✦✧'

    let buffer = null
    if (typeof m.quoted.download === 'function' && m.quoted.mediaMessage?.[m.quoted.mediaType]) {
        buffer = await m.quoted.download().catch(() => null)
    }
    if ((!Buffer.isBuffer(buffer) || buffer.length === 0) && typeof conn.downloadM === 'function' && mediaNode) {
        buffer = await conn.downloadM(mediaNode, resolvedMediaType, false).catch(() => null)
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0)
        throw '✧✦┇*تعذر تحميل الوسائط، ربما انتهت صلاحيتها أو لم يتم حفظها بعد.*┇✦✧'

    let caption = mediaNode?.caption || m.quoted.msg?.caption || m.quoted.caption || ''
    if (resolvedMediaType === 'image' || resolvedMediaType === 'video') {
        caption += '\n\n لا يسمح لك بإخفاء شيء هنا! هااا 🤫'
    }

    const msgPayload = resolvedMediaType === 'audio'
        ? { audio: buffer, mimetype: mediaNode?.mimetype || m.quoted.mimetype || 'audio/mp4', ptt: Boolean(mediaNode?.ptt ?? m.quoted.ptt) }
        : { [resolvedMediaType]: buffer, caption }

    await conn.sendMessage(m.chat, msgPayload, { quoted: m })
}

handler.help = ['readviewonce', 'vv']
handler.tags = ['media']
handler.command = /^فضح|readviewonce|mirar|vv$/i

export default handler
