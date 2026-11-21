import fs from 'fs'
import path from 'path'

const srcDir = path.join(process.cwd(), 'src')
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true })

const filePath = path.join(srcDir, 'sticker-s.json')
const filePath2 = path.join(srcDir, 'sticker-s2.json')
const historyPath = path.join(srcDir, 'sticker-s-history.json')
const usersPath = path.join(srcDir, 'sticker-users.json')


function getAllUsers() {
    try {
        if (fs.existsSync(usersPath)) {
            const parsed = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))
            return Array.isArray(parsed) ? parsed : []
        }
    } catch {}
    return []
}

function saveDynamicUsers(list) {
    fs.writeFileSync(usersPath, JSON.stringify(list, null, 2))
}

function getStickerFor(user) {
    try {
        if (user?.stickerFile && fs.existsSync(user.stickerFile)) {
            return JSON.parse(fs.readFileSync(user.stickerFile, 'utf-8'))
        }
    } catch {}
    return null
}

function getHistory() {
    try {
        if (fs.existsSync(historyPath)) return JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    } catch {}
    return []
}

function saveHistory(list) {
    fs.writeFileSync(historyPath, JSON.stringify(list))
}

function toBase64(v) {
    if (!v) return v
    if (Buffer.isBuffer(v)) return v.toString('base64')
    if (v instanceof Uint8Array) return Buffer.from(v).toString('base64')
    return v
}

function findSticker(obj, depth = 0, seen = new Set()) {
    if (!obj || depth > 6 || typeof obj !== 'object') return null
    if (seen.has(obj)) return null
    seen.add(obj)
    if (obj.stickerMessage) return obj.stickerMessage
    if (obj.url && obj.fileSha256 && obj.mimetype === 'image/webp') return obj
    if (obj.mtype === 'stickerMessage' && obj.msg) return obj.msg
    for (const key of Object.keys(obj)) {
        if (['key', 'chat', 'sender', 'mentionedJid'].includes(key)) continue
        const found = findSticker(obj[key], depth + 1, seen)
        if (found) return found
    }
    return null
}

function normalizeId(value) {
    return String(value || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}

function isOwner(m) {
    if (m?.isOwner) return true

    const configured = []
    const ownerSources = [
        global.config?.owners,
        global.bot?.config?.owners,
        global.settings?.owner,
    ]
    for (const source of ownerSources) {
        if (!Array.isArray(source)) continue
        for (const owner of source) {
            if (typeof owner === 'string' || typeof owner === 'number') configured.push(owner)
            else if (Array.isArray(owner)) configured.push(owner[0])
            else if (owner && typeof owner === 'object') configured.push(owner.jid, owner.lid)
        }
    }

    const senderIds = [m?.sender, m?.participant, m?.key?.participant].map(normalizeId).filter(Boolean)
    return configured.map(normalizeId).filter(Boolean).some((id) => senderIds.includes(id))
}

function getUserForMessage(m) {
    const users = getAllUsers()
    for (const u of users) {
        if (m.sender?.includes(u.number) || m.participant?.includes(u.number) || m.key?.participant?.includes(u.number)) return u
    }
    if (isOwner(m)) return users[0]
    return null
}

function getText(m) {
    return (m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim()
}

async function doSpam(m, client, user, count) {
    const quoted = m.quoted
    if (!quoted) return client.reply(m.chat, `๐ค ุงุนู…ู ุฑูุจูุงู ุนูู ุฑุณุงูุฉ ุงูุดุฎุต ุงูุฃูู`, m)
    const targetId = quoted.key?.id || quoted.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId
    if (!targetId) return client.reply(m.chat, `๐ค ูุง ูู…ูู ุงูุนุซูุฑ ุนูู ู…ุนููู…ุงุช ุงูุฑุณุงูุฉ.`, m)
    const targetKey = { remoteJid: m.chat, fromMe: quoted.key?.fromMe || false, id: targetId, participant: quoted.sender || quoted.key?.participant || undefined }
    const stickerData = getStickerFor(user)
    if (!stickerData) {
        return client.reply(m.chat, `لا يوجد ملصق محفوظ لهذا المستخدم. استخدم أمر تغيير الملصق أولاً.`, m)
    }
    let history = getHistory()
    for (let i = 0; i < count; i++) {
        try {
            const sent = await client.relayMessage(m.chat, {
                messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey: targetKey } },
                stickerMessage: stickerData
            }, {})
            const sentId = typeof sent === 'string' ? sent : sent?.id || sent?.key?.id
            if (sentId) history.push({ id: sentId, chat: m.chat, parentId: targetId, time: Date.now(), owner: user.number })
        } catch (err) {}
    }
    saveHistory(history)
}

async function doChangeSticker(m, client, user) {
    const quoted = m.quoted
    if (!quoted) return client.reply(m.chat, `๐ค ุงุนู…ู ุฑูุจูุงู ุนูู ุงูุงุณุชููุฑ ุงููู ุนุงูุฒ ุชุจุฏู ุจูู ุงูุฃูู`, m)
    const stickerMsg = findSticker(quoted)
    if (!stickerMsg) return client.reply(m.chat, `๐ค ุงูุฑุณุงูุฉ ุงููู ุนู…ูุช ุนูููุง ุฑูุจูุงู ู…ุด ุณุชููุฑ โ`, m)
    const newSticker = {
        url: stickerMsg.url,
        fileSha256: toBase64(stickerMsg.fileSha256),
        fileEncSha256: toBase64(stickerMsg.fileEncSha256),
        mediaKey: toBase64(stickerMsg.mediaKey),
        mimetype: stickerMsg.mimetype || "image/webp",
        height: 512, width: 512,
        directPath: stickerMsg.directPath,
        fileLength: stickerMsg.fileLength,
        mediaKeyTimestamp: stickerMsg.mediaKeyTimestamp,
        firstFrameLength: stickerMsg.firstFrameLength,
        firstFrameSidecar: toBase64(stickerMsg.firstFrameSidecar),
        isAnimated: stickerMsg.isAnimated || false,
        contextInfo: {},
        stickerSentTs: Date.now(),
        isAvatar: false, isAiSticker: false, isLottie: false
    }
    fs.writeFileSync(user.stickerFile, JSON.stringify(newSticker, null, 2))
    return client.reply(m.chat, `๐ค ุชู… โ…\nุงุชุจุฏู ุงูุณุชููุฑ ุฏูุงูู ุจูุฌุงุญ`, m)
}

let handler = async (m, { conn, text, args, command, usedPrefix }) => {
    const client = conn;
    const isPrefix = usedPrefix || '.';

    if (command === 'ุงุถูุณ') {
        if (!isOwner(m)) return client.reply(m.chat, `๐ค ุบูุฑ ุงูู…ุงูู ููุฏุฑ ูุฒูุฏ ูุงุณ`, m)
        const raw = (text || '') + ' ' + (args || []).join(' ')
        const numberMatch = raw.match(/\+?(\d{10,15})/)
        if (!numberMatch) return client.reply(m.chat, `๐ค ูุชุจ ุงูุฑูู…\n\nู…ุซุงู: ${isPrefix}ุงุถูุณ <number>\nู…ุซุงู: ${isPrefix}ุงุถูุณ <number> ุณ7 ุณ8`, m)
        let number = numberMatch[1].replace(/^\+/, '')
        if (number.startsWith('0')) number = '212' + number.slice(1)

        const users = getAllUsers()
        if (users.find(u => u.number === number)) {
            const u = users.find(u => u.number === number)
            return client.reply(m.chat, `๐ค ูุงุฏ ุงูุฑูู… ูุงูู ุฃุตูุง\nุงูุฃูุงู…ุฑ ุฏูุงูู: .${u.cmdSpam} ู .${u.cmdChange}`, m)
        }

        const cmdMatch = raw.match(/ุณ\d+/g) || []
        let cmdSpam, cmdChange
        if (cmdMatch.length >= 2) {
            cmdSpam = cmdMatch[0]; cmdChange = cmdMatch[1]
            if (users.find(u => u.cmdSpam === cmdSpam || u.cmdChange === cmdSpam || u.cmdSpam === cmdChange || u.cmdChange === cmdChange)) {
                return client.reply(m.chat, `๐ค ูุงุฏ ุงูุฃูุงู…ุฑ ู…ุณุชุนู…ููู ุฃุตูุงุ ุฎุชุงุฑ ูุญุฏูู ุขุฎุฑูู`, m)
            }
        } else {
            let max = 0
            for (const u of users) {
                const n1 = parseInt(u.cmdSpam.replace('ุณ','')); const n2 = parseInt(u.cmdChange.replace('ุณ',''))
                max = Math.max(max, n1, n2)
            }
            cmdSpam = 'ุณ' + (max + 1)
            cmdChange = 'ุณ' + (max + 2)
        }

        const newUser = {
            number,
            cmdSpam,
            cmdChange,
            stickerFile: path.join(srcDir, `sticker-${number}.json`),
            name: 'user-' + number
        }
        users.push(newUser)
        saveDynamicUsers(users)
        return client.reply(m.chat, `๐ค ุชู… โ…\nุงูุฑูู… ${number} ุชุฒุงุฏ\nุงูุฃูุงู…ุฑ ุฏูุงูู: .${cmdSpam} ู .${cmdChange}\n\nู…ุซุงู: .${cmdSpam} 5\nู…ุซุงู: .${cmdChange} (ุฑูุจูุงู ุนูู ุณุชููุฑ)`, m)
    }

    const user = getUserForMessage(m)
    if (!user) return

    if (command && command.startsWith('ุณ')) {
        const all = getAllUsers()
        const ownerOfCmd = all.find(u => u.cmdSpam === command || u.cmdChange === command)
        if (ownerOfCmd && ownerOfCmd.number !== user.number) {
            return client.reply(m.chat, `๐ค ูุงุฏ ุงูุฃู…ุฑ ู…ุงุดู ุฏูุงููุ ุงูุฃูุงู…ุฑ ุฏูุงูู ูู…ุง .${user.cmdSpam} ู .${user.cmdChange}`, m)
        }
        if (command === user.cmdChange) return doChangeSticker(m, client, user)
        if (command === user.cmdSpam) {
            const quoted = m.quoted
            if (!quoted) return client.reply(m.chat, `๐ค ุงุนู…ู ุฑูุจูุงู ุนูู ุฑุณุงูุฉ ุงูุดุฎุต ุงูุฃูู\n\nู…ุซุงู: ${isPrefix}${user.cmdSpam} 5`, m)
            let count = parseInt(args?.[0] || text?.trim())
            if (isNaN(count) || count < 1) count = 3
            await doSpam(m, client, user, count)
            return
        }
    }

    if (command === 'ุฎุฑุง') {
        const quoted = m.quoted
        let history = getHistory().filter(x => x.chat === m.chat)
        const qid = quoted?.key?.id || quoted?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId
        if (qid) {
            history = history.filter(x => x.parentId === qid || x.id === qid)
            if (!history.length) return client.reply(m.chat, `๐ค ู…ููุด ุงุณุชููุฑุงุช ุนูู ุงูุฑุณุงูุฉ ุฏู ุนุดุงู ุชุชู…ุณุญ`, m)
        } else {
            if (!history.length) return client.reply(m.chat, `๐ค ู…ููุด ุงุณุชููุฑุงุช ู…ุญููุธุฉ ุชุชู…ุณุญ ูู ุงูุดุงุช ุฏู`, m)
        }
        let count = parseInt(args?.[0] || text?.trim())
        let toDelete = []
        if (isNaN(count) || count < 1) toDelete = history
        else toDelete = history.slice(-count)
        let deleted = 0
        for (const item of toDelete) {
            try {
                await client.sendMessage(m.chat, { delete: { id: item.id, remoteJid: m.chat, fromMe: true, participant: client.user?.id } })
                deleted++
            } catch (e) {}
        }
        let allHistory = getHistory().filter(x => x.chat !== m.chat)
        let otherInChat = getHistory().filter(x => x.chat === m.chat && !toDelete.find(d => d.id === x.id))
        saveHistory([...allHistory, ...otherInChat])
        if (deleted === 0) return client.reply(m.chat, `๐ค ุญุงููุช ุงู…ุณุญ ุจุณ ูุงุชุณุงุจ ุฑูุถ โ`, m)
        return client.reply(m.chat, `๐ค ุชู… โ…\nุงุชู…ุณุญ ${deleted} ุณุชููุฑ`, m)
    }
}

handler.before = async (m, { conn }) => {
    const txt = getText(m)
    if (txt.startsWith('.ุงุถูุณ') || txt.startsWith('.ุฎุฑุง') || /^.ุณ\d+/.test(txt)) {
        return false
    }
    const user = getUserForMessage(m)
    if (user) {
        const stickerData = getStickerFor(user)
        if (!stickerData) return false
        try {
            await conn.relayMessage(m.chat, {
                messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey: m.key } },
                stickerMessage: stickerData
            }, {})
        } catch (error) {}
        return true
    }
    return false
}

// ===== ู…ู ุณ3 ุญุชู ุณ100 =====
const allSCommands = []
for (let i = 3; i <= 100; i++) {
    allSCommands.push('ุณ' + i)
}

handler.usage = [...allSCommands, 'ุฎุฑุง', 'ุงุถูุณ'];
handler.category = 'tools';
handler.command = [...allSCommands, 'ุฎุฑุง', 'ุงุถูุณ'];
handler.owner = false;
handler.group = false;
handler.admin = false;
handler.limit = false;

export default handler