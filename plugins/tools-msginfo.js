const MSG_WRAPPER_KEYS = [
    'deviceSentMessage',
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage',
    'associatedChildMessage',
    'botInvokeMessage',
    'groupStatusMessage',
    'groupStatusMessageV2',
    'spoilerMessage',
]

function unwrapMessage(obj) {
    let cur = obj
    const wrappers = []
    for (let i = 0; i < 8 && cur && typeof cur === 'object'; i++) {
        let stepped = false
        for (const key of MSG_WRAPPER_KEYS) {
            if (cur[key]?.message && typeof cur[key].message === 'object') {
                wrappers.push(key)
                cur = cur[key].message
                stepped = true
                break
            }
        }
        if (!stepped) break
    }
    return { inner: cur, wrappers }
}

function sanitizeForJson(value, depth = 0) {
    if (value == null) return value
    if (depth > 8) return '[MaxDepth]'
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        const buf = Buffer.from(value)
        if (buf.length > 64) return `<Buffer ${buf.length} bytes>`
        return buf.toString('base64')
    }
    if (typeof value === 'bigint') return value.toString()
    if (Array.isArray(value)) {
        if (value.length > 64 && value.every((n) => typeof n === 'number')) {
            return `<ByteArray ${value.length} bytes>`
        }
        return value.map((item) => sanitizeForJson(item, depth + 1))
    }
    if (typeof value === 'object') {
        if (value.type === 'Buffer' && Array.isArray(value.data)) {
            const buf = Buffer.from(value.data)
            if (buf.length > 64) return `<Buffer ${buf.length} bytes>`
            return buf.toString('base64')
        }
        const out = {}
        for (const [k, v] of Object.entries(value)) {
            if (typeof v === 'function' || v === undefined) continue
            if ((k === 'jpegThumbnail' || k === 'scansSidecar' || k === 'waveform' || k === 'streamingSidecar') && (typeof v === 'string' && v.length > 100)) {
                out[k] = `<Base64 ${v.length} chars>`
                continue
            }
            out[k] = sanitizeForJson(v, depth + 1)
        }
        return out
    }
    return value
}

function formatBytes(bytes) {
    const n = Number(bytes || 0)
    if (!Number.isFinite(n) || n <= 0) return '0 B'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB (${n} B)`
    return `${(n / (1024 * 1024)).toFixed(2)} MB (${n} B)`
}

function toBase64Preview(val) {
    if (!val) return null
    if (typeof val === 'string') return val
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) return Buffer.from(val).toString('base64')
    if (Array.isArray(val?.data)) return Buffer.from(val.data).toString('base64')
    if (typeof val === 'object') {
        const keys = Object.keys(val).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))
        if (keys.length) return Buffer.from(keys.map((k) => val[k])).toString('base64')
    }
    return String(val)
}

const handler = async (m, { conn }) => {
    const isQuoted = Boolean(m.quoted)
    const msgId = isQuoted ? m.quoted.id : m.id
    const sender = isQuoted ? m.quoted.sender : m.sender
    const chat = isQuoted ? (m.quoted.chat || m.chat) : m.chat
    const rawMsg = isQuoted ? (m.msg?.contextInfo?.quotedMessage || {}) : (m.message || {})
    const storedMsg = msgId && typeof conn.loadMessage === 'function' ? conn.loadMessage(msgId) : null

    const unwrappedRaw = unwrapMessage(rawMsg)
    const unwrappedStored = unwrapMessage(storedMsg?.message || {})

    const primaryObj = unwrappedRaw.inner && typeof unwrappedRaw.inner === 'object' ? unwrappedRaw.inner : {}
    const storedObj = unwrappedStored.inner && typeof unwrappedStored.inner === 'object' ? unwrappedStored.inner : {}

    const mediaKeyName = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find(
        (k) => primaryObj[k] || storedObj[k]
    )
    const activeNode =
        (mediaKeyName && { ...(primaryObj[mediaKeyName] || {}), ...(storedObj[mediaKeyName] || {}) }) ||
        (isQuoted ? m.quoted?.msg : m.msg) ||
        primaryObj

    const mtype = isQuoted ? (m.quoted.mediaType || m.quoted.mtype || mediaKeyName || 'unknown') : (m.mediaType || m.mtype || mediaKeyName || 'unknown')
    const url = activeNode?.url || storedObj?.[mediaKeyName]?.url || null
    const directPath = activeNode?.directPath || storedObj?.[mediaKeyName]?.directPath || null
    const cdnUrl = url || (directPath ? `https://mmg.whatsapp.net${directPath}` : null)

    const textContent = (isQuoted ? m.quoted.text : m.text) || activeNode?.caption || activeNode?.text || ''
    const embeddedLinks = [...new Set((String(textContent).match(/https?:\/\/[^\s]+/gi) || []))]

    const isViewOnce = Boolean(
        (isQuoted ? m.quoted?.viewOnce : m.msg?.viewOnce) ||
        activeNode?.viewOnce ||
        unwrappedRaw.wrappers.some((w) => /viewOnce/i.test(w)) ||
        unwrappedStored.wrappers.some((w) => /viewOnce/i.test(w))
    )

    const lines = [
        `📋 *معلومات الرسالة الكاملة (${isQuoted ? 'الرسالة المقتبسة' : 'الرسالة الحالية'})*`,
        '',
        `• *ID:* \`${msgId || '-'}\``,
        `• *النوع:* ${mtype}${unwrappedRaw.wrappers.length ? ` (${unwrappedRaw.wrappers.join(' → ')})` : ''}`,
        `• *المرسل:* @${String(sender || '').split('@')[0]}`,
        `• *الشات:* ${chat || '-'}`,
        `• *عرض لمرة واحدة (ViewOnce):* ${isViewOnce ? 'نعم ✅' : 'لا ❌'}`,
        `• *محفوظة بذاكرة البوت:* ${storedMsg ? 'نعم ✅' : 'لا ❌'}`,
    ]

    if (cdnUrl || directPath) {
        lines.push('', '🔗 *روابط الوسائط:*')
        if (url) lines.push(`• *URL:* ${url}`)
        if (directPath) lines.push(`• *DirectPath:* ${directPath}`)
        if (!url && cdnUrl) lines.push(`• *CDN Link:* ${cdnUrl}`)
    }

    if (embeddedLinks.length) {
        lines.push('', '🌐 *روابط داخل النص:*')
        for (const l of embeddedLinks) lines.push(`• ${l}`)
    }

    if (activeNode && typeof activeNode === 'object' && (mediaKeyName || activeNode.mimetype || activeNode.fileLength)) {
        lines.push('', '📦 *تفاصيل الملف والتشفير:*')
        if (activeNode.mimetype) lines.push(`• *Mimetype:* ${activeNode.mimetype}`)
        if (activeNode.fileName) lines.push(`• *FileName:* ${activeNode.fileName}`)
        if (activeNode.fileLength) lines.push(`• *Size:* ${formatBytes(activeNode.fileLength)}`)
        if (activeNode.width || activeNode.height) lines.push(`• *Dimensions:* ${activeNode.width || '?'} × ${activeNode.height || '?'}`)
        if (activeNode.seconds != null) lines.push(`• *Duration:* ${activeNode.seconds}s`)
        if (activeNode.ptt != null) lines.push(`• *Voice Note (PTT):* ${activeNode.ptt ? 'نعم' : 'لا'}`)
        if (activeNode.mediaKey) lines.push(`• *MediaKey:* \`${toBase64Preview(activeNode.mediaKey)}\``)
        if (activeNode.fileSha256) lines.push(`• *FileSHA256:* \`${toBase64Preview(activeNode.fileSha256)}\``)
        if (activeNode.fileEncSha256) lines.push(`• *FileEncSHA256:* \`${toBase64Preview(activeNode.fileEncSha256)}\``)
        if (activeNode.mediaKeyTimestamp) lines.push(`• *KeyTimestamp:* ${activeNode.mediaKeyTimestamp}`)
    }

    if (textContent) {
        lines.push('', `💬 *النص / الوصف:*\n${textContent}`)
    }

    const dumpObj = {
        rawKeys: Object.keys(rawMsg || {}),
        quotedPayload: sanitizeForJson(rawMsg),
        ...(storedMsg?.message ? { storedPayload: sanitizeForJson(storedMsg.message) } : {}),
    }
    let jsonDump = JSON.stringify(dumpObj, null, 2)
    if (jsonDump.length > 2600) {
        jsonDump = jsonDump.slice(0, 2600) + '\n... (truncated)'
    }
    lines.push('', '🧾 *البيانات الخام (JSON):*', '```json\n' + jsonDump + '\n```')

    await conn.sendMessage(
        m.chat,
        {
            text: lines.join('\n'),
            mentions: sender ? [sender] : [],
        },
        { quoted: m }
    )
}

handler.help = ['msginfo', 'معلومات', 'تفاصيل', 'رابط']
handler.tags = ['tools']
handler.command = /^msginfo|minfo|inspect|معلومات|تفاصيل|رابط_الرسالة|رابط|فحص$/i

export default handler
