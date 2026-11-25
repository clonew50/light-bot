import { downloadMediaMessage, downloadContentFromMessage, proto } from 'baileys'

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

function normalizeBinaryKey(val) {
    if (!val) return val
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) return Buffer.from(val)
    if (Array.isArray(val?.data)) return Buffer.from(val.data)
    if (typeof val === 'object') {
        const keys = Object.keys(val).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))
        if (keys.length) return Buffer.from(keys.map((k) => val[k]))
    }
    return val
}

async function streamToBuffer(stream) {
    const chunks = []
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

var handler = async (m, { conn }) => {
    const rawQuoted = m.msg?.contextInfo?.quotedMessage || {}
    const storedMsg = m.quoted?.id && typeof conn.loadMessage === 'function' ? conn.loadMessage(m.quoted.id) : null
    const rawStored = storedMsg?.message || {}

    const unwrappedQuoted = unwrapViewOnceContainer(rawQuoted)
    const unwrappedStored = unwrapViewOnceContainer(rawStored)

    const quotedEntry = findMediaEntry(unwrappedQuoted.inner) || findMediaEntry(m.quoted?.mediaMessage)
    const storedEntry = findMediaEntry(unwrappedStored.inner)
    const mediaEntry = (storedEntry?.node?.url || storedEntry?.node?.directPath) ? storedEntry : (quotedEntry || storedEntry)

    const mergedNode = {
        ...(quotedEntry?.node || {}),
        ...(storedEntry?.node || {}),
    }
    if (!mergedNode.url && m.quoted?.url) mergedNode.url = m.quoted.url
    if (!mergedNode.directPath && m.quoted?.directPath) mergedNode.directPath = m.quoted.directPath
    if (!mergedNode.mediaKey && m.quoted?.mediaKey) mergedNode.mediaKey = m.quoted.mediaKey
    if (mergedNode.mediaKey) mergedNode.mediaKey = normalizeBinaryKey(mergedNode.mediaKey)

    const isViewOnce = Boolean(
        m.quoted?.viewOnce ||
        m.quoted?.msg?.viewOnce ||
        m.quoted?.mediaMessage?.[m.quoted?.mediaType]?.viewOnce ||
        quotedEntry?.node?.viewOnce ||
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
    let lastError = null

    if (typeof m.quoted.download === 'function' && m.quoted.mediaMessage?.[m.quoted.mediaType]) {
        try {
            buffer = await m.quoted.download()
        } catch (err) {
            lastError = err
        }
    }

    if ((!Buffer.isBuffer(buffer) || buffer.length === 0) && typeof conn.downloadM === 'function' && (mergedNode.url || mergedNode.directPath)) {
        try {
            buffer = await conn.downloadM(mergedNode, resolvedMediaType, false)
        } catch (err) {
            lastError = err
        }
    }

    if ((!Buffer.isBuffer(buffer) || buffer.length === 0) && (mergedNode.url || mergedNode.directPath)) {
        try {
            const stream = await downloadContentFromMessage(mergedNode, resolvedMediaType)
            buffer = await streamToBuffer(stream)
        } catch (err) {
            lastError = err
        }
    }

    if ((!Buffer.isBuffer(buffer) || buffer.length === 0) && (storedMsg || m.quoted?.vM) && typeof conn.updateMediaMessage === 'function') {
        try {
            const webMsg = proto.WebMessageInfo.create(
                storedMsg?.message
                    ? storedMsg
                    : {
                        key: {
                            remoteJid: m.chat,
                            fromMe: m.quoted.fromMe,
                            id: m.quoted.id,
                            ...(m.isGroup ? { participant: m.quoted.sender } : {}),
                        },
                        message: rawQuoted,
                    }
            )
            buffer = await downloadMediaMessage(webMsg, 'buffer', {}, {
                logger: conn.logger,
                reuploadRequest: (msg) => conn.updateMediaMessage(msg),
            })
        } catch (err) {
            lastError = err
        }
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const hasPath = Boolean(mergedNode.url || mergedNode.directPath)
        const hasKey = Boolean(mergedNode.mediaKey)
        const reason = lastError?.message
            || (!hasPath ? 'واتساب لم يُرسل رابط أو مسار الوسائط داخل الاقتباس ولم تكن الرسالة محفوظة مسبقاً'
                : !hasKey ? 'مفتاح فك التشفير mediaKey مفقود'
                    : 'الوسائط غير متاحة على خادم واتساب')
        throw `✧✦┇*تعذر تحميل الوسائط، ربما انتهت صلاحيتها أو لم يتم حفظها بعد.*┇✦✧\n\n_السبب: ${reason}_`
    }

    let caption = mergedNode?.caption || m.quoted.msg?.caption || m.quoted.caption || ''
    if (resolvedMediaType === 'image' || resolvedMediaType === 'video') {
        caption += '\n\n لا يسمح لك بإخفاء شيء هنا! هااا 🤫'
    }

    const msgPayload = resolvedMediaType === 'audio'
        ? { audio: buffer, mimetype: mergedNode?.mimetype || m.quoted.mimetype || 'audio/mp4', ptt: Boolean(mergedNode?.ptt ?? m.quoted.ptt) }
        : { [resolvedMediaType]: buffer, caption }

    await conn.sendMessage(m.chat, msgPayload, { quoted: m })
}

handler.help = ['readviewonce', 'vv']
handler.tags = ['media']
handler.command = /^فضح|readviewonce|mirar|vv$/i

export default handler
