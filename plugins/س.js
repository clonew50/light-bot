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
    url: "https://mmg.whatsapp.net/o1/v/t24/f2/m239/AQMZAIJaoK7mY5ThptxpHwSVoKEzz-A6HATXianf4uBhCNji_avtoDjwwdqypdsL27QIJ9pwrZC4T7TXprgHL8sYxbbD2l5_sxEJa8bLZw?ccb=9-4&oh=01_Q5Aa6AEUkm97Kne-vC3Pqg9DShfnIHa7HPfug8_ruym38-7QqA&oe=6B240182&_nc_sid=e6ed6c&mms3=true",
    fileSha256: "dAy0SYFJX6KALNu31o39ln2gDn+TjuYTRurAOsLgZgs=",
    fileEncSha256: "jx6LJf0Aa7PYWgeMPEXRQd5gwk/vxbYPxIgm5MTwfKc=",
    mediaKey: "HUVsSYaTHswy3oUSb4whMt494T+EyF7iA2zW0TLqlkI=",
    mimetype: "image/webp",
    height: 512,
    width: 512,
    directPath: "/o1/v/t24/f2/m239/AQMZAIJaoK7mY5ThptxpHwSVoKEzz-A6HATXianf4uBhCNji_avtoDjwwdqypdsL27QIJ9pwrZC4T7TXprgHL8sYxbbD2l5_sxEJa8bLZw?ccb=9-4&oh=01_Q5Aa6AEUkm97Kne-vC3Pqg9DShfnIHa7HPfug8_ruym38-7QqA&oe=6B240182&_nc_sid=e6ed6c",
    fileLength: 11186,
    mediaKeyTimestamp: 1794941272,
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

let handler = async (m, { conn, text, args, command, usedPrefix }) => {
    const client = conn
    const isPrefix = usedPrefix || '.'

    if (command === 'س1' || command === 'س.1') {
        if (!m.quoted) return client.reply(m.chat, `يرجى الرد على الملصق المراد تغييره أولاً.\nمثال: ${isPrefix}س1`, m)

        try {
            const buffer = await m.quoted.download()
            if (!buffer) throw new Error("فشل تحميل الملصق.")
            
            const newBuffer = await addExif(buffer, PACKNAME, AUTHOR)
            const media = await prepareWAMessageMedia({ sticker: newBuffer }, { upload: client.waUploadToServer })
            
            if (media && media.stickerMessage) {
                fs.writeFileSync(filePath, JSON.stringify(media.stickerMessage, null, 2))
                return client.reply(m.chat, `تم تحديث الملصق وإضافة الحقوق بنجاح.`, m)
            } else {
                throw new Error("تعذر استخراج بيانات الملصق الجديد.")
            }
        } catch (error) {
            return client.reply(m.chat, `حدث خطأ أثناء تحديث الملصق: ${error.message}`, m)
        }
    }

    if (command === 'مسح') {
        const quoted = m.quoted
        let history = getHistory().filter(x => x.chat === m.chat)

        const qid = quoted?.key?.id || quoted?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId

        if (qid) {
            history = history.filter(x => x.parentId === qid || x.id === qid)
            if (!history.length) return client.reply(m.chat, `لا توجد ملصقات على هذه الرسالة لحذفها.`, m)
        } else {
            if (!history.length) return client.reply(m.chat, `لا توجد ملصقات محفوظة لحذفها في هذه المحادثة.`, m)
        }

        let count = parseInt(args?.[0] || text?.trim())
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
            } catch (e) {}
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

    let count = parseInt(args?.[0] || text?.trim())
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
        } catch (err) {}
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
        } catch (error) {}
        
        return false
    }
    return false
}

handler.help = ['N O U R']
handler.tags = ['N O U R']
handler.command = /^(س|س1|س\.1|مسح)$/i
handler.owner = true
handler.group = false
handler.admin = false
handler.limit = false

export default handler