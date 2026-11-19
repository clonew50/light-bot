/*
  ═════════════════════════════════════════════
  📱 مولد كيو آر كود — نص/رابط/واي فاي/في كارد
  الأمر: .qr <نص>  |  ثم اختر النوع من الأزرار
  ═════════════════════════════════════════════
*/
import QRCode from 'qrcode'
import { pruneCooldown } from '../../system/cooldowns.js'
import { generateAIImage } from '../../system/aiService.js'

const COOLDOWN_MS = 10 * 1000
const cooldown = new Map()
const pending = new Map()

const context = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: (process.env.BOT_NEWSLETTER_JID || ''),
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
})

async function generateQR(content, type) {
    let data = content
    if (type === 'wifi') data = `WIFI:T:WPA;S:${content.ssid || content};P:${content.pass || ''};;`
    if (type === 'vcard') {
        data = `BEGIN:VCARD\nVERSION:3.0\nFN:${content.name || content}\nTEL:${content.phone || ''}\nEMAIL:${content.email || ''}\nEND:VCARD`
    }
    try {
        const buf = await QRCode.toBuffer(String(data), { width: 360, margin: 2 })
        return { kind: 'buffer', data: buf }
    } catch {
        const ai = await generateAIImage({
            prompt: `clean black and white scannable QR code on white background for ${String(data).slice(0, 60)}`,
            width: 512,
            height: 512
        })
        if (ai.ok && ai.buffer) return { kind: 'buffer', data: ai.buffer }
        throw new Error(ai.error || 'QR generation failed')
    }
}

const handler = async (m, { conn, text, args }) => {
    try {
        const now = Date.now()
        const last = cooldown.get(m.chat) || 0
        if (now - last < COOLDOWN_MS) return
        pruneCooldown(cooldown, COOLDOWN_MS)
        pruneCooldown(pending, 5 * 60 * 1000)
        cooldown.set(m.chat, now)

        const input = (text || '').trim()
        const waiting = pending.get(m.chat)

        if (waiting && !input) {
            return await conn.sendButtonNormal(m.chat, {
                media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
                mediaType: 'image',
                caption: '📱 اختر نوع الكيو آر كود:\nأعد إرسال الأمر مع النص بعد الاختيار.',
                footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
                buttons: [
                    { name: 'quick_reply', params: { display_text: '📝 نص', id: '.qr text ' } },
                    { name: 'quick_reply', params: { display_text: '🔗 رابط', id: '.qr url ' } },
                    { name: 'quick_reply', params: { display_text: '📶 واي فاي', id: '.qr wifi ' } },
                    { name: 'quick_reply', params: { display_text: '👤 في كارد', id: '.qr vcard ' } }
                ]
            }, m)
        }

        if (!input) {
            pending.set(m.chat, Date.now())
            return await conn.sendButtonNormal(m.chat, {
                media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
                mediaType: 'image',
                caption: '📱 اكتب محتوى الكيو آر، ثم اختر نوعه:\nمثال: `.qr مرحباً بالعالم`\n`.qr https://example.com`',
                footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
                buttons: [
                    { name: 'quick_reply', params: { display_text: '📝 نص', id: '.qr text ' } },
                    { name: 'quick_reply', params: { display_text: '🔗 رابط', id: '.qr url ' } },
                    { name: 'quick_reply', params: { display_text: '📶 واي فاي', id: '.qr wifi ' } },
                    { name: 'quick_reply', params: { display_text: '👤 في كارد', id: '.qr vcard ' } }
                ]
            }, m)
        }

        const rawCmd = (args[0] || '').toLowerCase()
        let type = 'text'
        let content = input
        if (rawCmd === 'text' || rawCmd === 'url' || rawCmd === 'wifi' || rawCmd === 'vcard') {
            type = rawCmd
            content = args.slice(1).join(' ').trim() || input
        } else if (input.startsWith('http://') || input.startsWith('https://')) {
            type = 'url'
        }

        const result = await generateQR(content, type)

        await conn.sendMessage(m.chat, {
            image: result.data,
            caption: `✅ تم إنشاء الكيو آر (${type})\nالمحتوى: ${typeof content === 'string' ? content : content.ssid || content.name}`,
            footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
            contextInfo: context(m.sender)
        }, { quoted: m })

        pending.delete(m.chat)
    } catch (e) {
        console.error('qr:', e)
        await conn.sendMessage(m.chat, { text: '❌ فشل إنشاء الكيو آر كود.' }, { quoted: m })
    }
}

handler.command = ['qr', 'كيوأل', 'كيوआर']
handler.usage = ['qr مرحباً', 'qr url https://example.com', 'qr wifi', 'qr vcard']
handler.category = 'tools'
handler.cooldown = 10

export default handler
