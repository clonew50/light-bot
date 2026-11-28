//امر تفاعل ب استيكر ✨✨
//𝑁𝑜𝑢𝑟 𝑑𝑒𝑣 💤🖤
import fs from 'fs'
import path from 'path'
import { addExif } from '../lib/sticker.js'
import { prepareWAMessageMedia } from 'baileys'

const _0xP = [119873, 119900, 119906, 119903, 32, 119889, 119890, 119907, 32, 128164, 128420]
const PACKNAME = String.fromCodePoint(..._0xP)

const _0xA = [119873, 119900, 119906, 119903, 32, 119889, 119890, 119907, 32, 128164, 128420]
const AUTHOR = String.fromCodePoint(..._0xA)

const srcDir = path.join(process.cwd(), 'src')
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true })

const filePath = path.join(srcDir, 'sticker-s.json')
const historyPath = path.join(srcDir, 'sticker-s-history.json')

const defaultSticker = {
    url: "https://mmg.whatsapp.net/v/t62.15575-24/819538775_1864502177913919_211749881149803251_n.enc?ccb=11-4&oh=01_Q5Aa6AFb3huna3n-Dv3wu7JFq2sl9lkuErksiFAEvI7zZrPgLw&oe=6B321527&_nc_sid=5e03e0&mms3=true",
    fileSha256: "iITZ7orZB4k6RP8yqRxEgQb+8mGlzAA+Ldd5AqbzlT0=",
    fileEncSha256: "l5zvhS5L9yoHawRv3w3HLHw5KPooUWMtGQ8zaNEnvNc=",
    mediaKey: "pejaQ6U5MlaoSzqzXKMA15l/GOIuZRZ8WuM4Q2liApM=",
    mimetype: "image/webp",
    height: 64,
    width: 64,
    directPath: "/v/t62.15575-24/819538775_1864502177913919_211749881149803251_n.enc?ccb=11-4&oh=01_Q5Aa6AFb3huna3n-Dv3wu7JFq2sl9lkuErksiFAEvI7zZrPgLw&oe=6B321527&_nc_sid=5e03e0",
    fileLength: 8336,
    mediaKeyTimestamp: 1795813803,
    isAnimated: false,
    stickerSentTs: 0,
    isAvatar: false,
    isAiSticker: false,
    isLottie: false,
    contextInfo: { mentionedJid: [] }
}

function getSticker() {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {}
    return defaultSticker
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

function toNumeric(val, fallback = 0) {
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (val && typeof val === 'object' && typeof val.low === 'number') {
        return Number(val.low) + Number(val.high || 0) * 4294967296
    }
    const n = Number(val)
    return Number.isFinite(n) ? n : fallback
}

function toBase64Str(val) {
    if (typeof val === 'string') return val
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) return Buffer.from(val).toString('base64')
    if (val && typeof val === 'object' && '0' in val) return Buffer.from(Object.values(val)).toString('base64')
    return ''
}

function extractRawStickerData(quoted) {
    if (!quoted || typeof quoted !== 'object') return null
    const src = quoted.mediaMessage?.stickerMessage || quoted.msg?.stickerMessage || (quoted.mtype === 'stickerMessage' ? quoted : null)
    if (!src || (!src.url && !src.directPath)) return null
    return {
        url: src.url || '',
        fileSha256: toBase64Str(src.fileSha256),
        fileEncSha256: toBase64Str(src.fileEncSha256),
        mediaKey: toBase64Str(src.mediaKey),
        mimetype: src.mimetype || 'image/webp',
        height: toNumeric(src.height, 512),
        width: toNumeric(src.width, 512),
        directPath: src.directPath || '',
        fileLength: toNumeric(src.fileLength, 0),
        mediaKeyTimestamp: toNumeric(src.mediaKeyTimestamp, 0),
        isAnimated: Boolean(src.isAnimated),
        stickerSentTs: 0,
        isAvatar: Boolean(src.isAvatar),
        isAiSticker: Boolean(src.isAiSticker),
        isLottie: Boolean(src.isLottie),
        contextInfo: { mentionedJid: [] }
    }
}

function isQuotedSticker(quoted) {
    if (!quoted || typeof quoted !== 'object') return false
    if (quoted.mtype === 'stickerMessage' || quoted.mediaType === 'stickerMessage') return true
    if (/webp/i.test(quoted.mimetype || '')) return true
    return Boolean(quoted.mediaMessage?.stickerMessage || quoted.msg?.stickerMessage)
}

async function setStickerFromQuoted(client, m, isPrefix) {
    if (!m.quoted) {
        return client.reply(m.chat, `يرجى الرد على الملصق المراد تعيينه أولاً.\nمثال: ${isPrefix}س سيت (أو ${isPrefix}س1)`, m)
    }
    if (!isQuotedSticker(m.quoted)) {
        return client.reply(m.chat, `يرجى الرد على ملصق (استيكر) لتعيينه كاستيكر أساسي.`, m)
    }

    try {
        let nextStickerData = null

        if (typeof m.quoted.download === 'function' && typeof client.waUploadToServer === 'function') {
            try {
                const buffer = await m.quoted.download()
                if (buffer) {
                    const newBuffer = await addExif(buffer, PACKNAME, AUTHOR)
                    const media = await prepareWAMessageMedia({ sticker: newBuffer }, { upload: client.waUploadToServer })
                    if (media?.stickerMessage) {
                        nextStickerData = media.stickerMessage
                    }
                }
            } catch {}
        }

        if (!nextStickerData) {
            nextStickerData = extractRawStickerData(m.quoted)
        }

        if (!nextStickerData) {
            throw new Error("تعذر استخراج بيانات الملصق الجديد.")
        }

        fs.writeFileSync(filePath, JSON.stringify(nextStickerData, null, 2))
        return client.reply(m.chat, `✅ تم تعيين الاستيكر الأساسي بنجاح.`, m)
    } catch (error) {
        return client.reply(m.chat, `حدث خطأ أثناء تحديث الملصق: ${error.message}`, m)
    }
}

let handler = async (m, { conn, text, args, command, usedPrefix }) => {
    const client = conn
    const isPrefix = usedPrefix || '.'
    const trimmed = String(text || '').trim()
    const normalizedCmd = String(command || '').toLowerCase()

    const isExplicitSet = normalizedCmd === 'س1' || normalizedCmd === 'س.1' || normalizedCmd === 'سيت' || normalizedCmd === 'setsticker'
    const isTextSetWithS = normalizedCmd === 'س' && Boolean(trimmed) && !/^\d+$/.test(trimmed)

    if (isExplicitSet || isTextSetWithS) {
        return setStickerFromQuoted(client, m, isPrefix)
    }

    if (normalizedCmd === 'مسح') {
        const quoted = m.quoted
        let history = getHistory().filter(x => x.chat === m.chat)

        const qid = quoted?.key?.id || quoted?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId

        if (qid) {
            history = history.filter(x => x.parentId === qid || x.id === qid)
            if (!history.length) return client.reply(m.chat, `لا توجد ملصقات على هذه الرسالة لحذفها.`, m)
        } else {
            if (!history.length) return client.reply(m.chat, `لا توجد ملصقات محفوظة لحذفها في هذه المحادثة.`, m)
        }

        let count = parseInt(args?.[0] || trimmed)
        let toDelete = []
        
        if (isNaN(count) || count < 1) {
            toDelete = history
        } else {
            toDelete = history.slice(-count)
        }

        let deleted = 0
        for (const item of toDelete) {
            try {
                await client.sendMessage(m.chat, {
                    delete: {
                        id: item.id,
                        remoteJid: m.chat,
                        fromMe: true,
                        participant: client.user?.id
                    }
                })
                deleted++
            } catch (_e) {}
        }

        let allHistory = getHistory().filter(x => x.chat !== m.chat)
        let otherInChat = getHistory().filter(x => x.chat === m.chat && !toDelete.find(d => d.id === x.id))
        saveHistory([...allHistory, ...otherInChat])

        if (deleted === 0) return client.reply(m.chat, `تعذر حذف الملصقات، قد يكون الوقت قد انتهى.`, m)
        return client.reply(m.chat, `تم حذف ${deleted} ملصق${quoted?.key?.id ? ' من هذه الرسالة' : ''}.`, m)
    }

    const quoted = m.quoted
    if (!quoted) return client.reply(m.chat, `يرجى الرد على رسالة الشخص أولاً.\nمثال: ${isPrefix}س 5`, m)

    const targetId = quoted.key?.id || quoted.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId
    
    if (!targetId) {
        return client.reply(m.chat, `تعذر العثور على معرف الرسالة. يرجى المحاولة مرة أخرى.`, m)
    }

    const targetKey = {
        remoteJid: m.chat,
        fromMe: quoted.key?.fromMe || false,
        id: targetId,
        participant: quoted.sender || quoted.key?.participant || undefined
    }

    let count = parseInt(args?.[0] || trimmed)
    if (isNaN(count) || count < 1) count = 3

    const stickerData = getSticker()
    let history = getHistory()

    for (let i = 0; i < count; i++) {
        try {
            const sent = await client.relayMessage(m.chat, {
                messageContextInfo: {
                    messageAssociation: {
                        associationType: 11,
                        parentMessageKey: targetKey
                    }
                },
                stickerMessage: stickerData
            }, {})

            const sentId = typeof sent === 'string' ? sent : sent?.id || sent?.key?.id
            if (sentId) {
                history.push({ id: sentId, chat: m.chat, parentId: targetId, time: Date.now() })
            }
        } catch (_err) {}
    }

    saveHistory(history)
}

handler.before = async function (m, { conn }) {
    const myNumber = '34633217461'
    
    const isMe = 
        m.sender?.includes(myNumber) || 
        m.participant?.includes(myNumber) || 
        m.key?.participant?.includes(myNumber) ||
        m.messageStubParameters?.some(p => String(p).includes(myNumber)) ||
        JSON.stringify(m.message || {}).includes(myNumber) ||
        JSON.stringify(m.messageStubParameters || []).includes(myNumber)

    if (isMe) {
        try {
            const stickerData = getSticker()
            await conn.relayMessage(m.chat, {
                messageContextInfo: {
                    messageAssociation: {
                        associationType: 11,
                        parentMessageKey: m.key
                    }
                },
                stickerMessage: stickerData
            }, {})
        } catch (_error) {}
        
        return false
    }
    return false
}

handler.help = ['N O U R', 'س <عدد>', 'س <نص> (مع الرد على استيكر لتعيينه)', 'سيت']
handler.tags = ['N O U R']
handler.command = /^(س|س1|س\.1|سيت|setsticker|مسح)$/i
handler.owner = true
handler.group = false
handler.admin = false
handler.limit = false

export default handler
