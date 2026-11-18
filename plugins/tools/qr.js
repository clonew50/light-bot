/*
  ═════════════════════════════════════════════
  📱 مولد كيو آر كود — نص/رابط/واي فاي/في كارد
  الأمر: .qr <نص>  |  ثم اختر النوع من الأزرار
  ═════════════════════════════════════════════
*/
import QRCode from 'qrcode'
import axios from 'axios'
import { pruneCooldown } from '../../system/cooldowns.js'

const COOLDOWN_MS = 10 * 1000
const cooldown = new Map()
// حالات انتظار اختيار نوع الكيو آر لكل شات
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

/* إنشاء صورة الكيو آر محلياً (باستخدام qrcode) أو عبر Pollinations كبديل */
async function generateQR(content, type) {
    let data = content
    if (type === 'wifi') data = `WIFI:T:WPA;S:${content.ssid};P:${content.pass};;`
    if (type === 'vcard') {
        data = `BEGIN:VCARD\nVERSION:3.0\nFN:${content.name}\nTEL:${content.phone}\nEMAIL:${content.email}\nEND:VCARD`
    }
    try {
        const buf = await QRCode.toBuffer(data, { width: 300, margin: 2 })
        return { kind: 'buffer', data: buf }
    } catch (e) {
        // fallback عبر Pollinations API
        try {
            const enc = encodeURIComponent(data)
            const url = `https://image.pollinations.ai/prompt/QR%20code%20of%20${enc}?width=300&height=300`
            return { kind: 'url', data: url }
        } catch (e2) {
            throw e2
        }
    }
}

const handler = async (m, { conn, text, args }) => {
    try {
        const now = Date.now()
        const last = cooldown.get(m.chat) || 0
        if (now - last < COOLDOWN_MS) return
        pruneCooldown(cooldown, COOLDOWN_MS)
        cooldown.set(m.chat, now)

        const input = (text || '').trim()
        const waiting = pending.get(m.chat)

        // إذا كان الشات في انتظار اختيار النوع بعد أمر بدون نص
        if (waiting && !input) {
            return await conn.sendButtonNormal(m.chat, {
                media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
                mediaType: 'image',
                caption: '📱 اختر نوع الكيو آر كود:\nأعد إرسال الأمر مع النص بعد الاختيار.',
                footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
                buttons: [
                    { name: 'quick_reply', params: { display_text: '📝 نص', id: '.qr text' } },
                    { name: 'quick_reply', params: { display_text: '🔗 رابط', id: '.qr url' } },
                    { name: 'quick_reply', params: { display_text: '📶 واي فاي', id: '.qr wifi' } },
                    { name: 'quick_reply', params: { display_text: '👤 في كارد', id: '.qr vcard' } }
                ]
            }, m)
        }

        if (!input) {
            pending.set(m.chat, true)
            return await conn.sendButtonNormal(m.chat, {
                media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
                mediaType: 'image',
                caption: '📱 اكتب محتوى الكيو آر، ثم اختر نوعه:\nمثال: .qr مرحباً بالعالم\n.qr https://example.com',
                footer: '𝑳𝑰𝑮𝑳IGHT ┇🩸┇ 𝑩𝑶𝑻',
                buttons: [
                    { name: 'quick_reply', params: { display_text: '📝 نص', id: '.qr text' } },
                    { name: 'quick_reply', params: { display_text: '🔗 رابط', id: '.qr url' } },
                    { name: 'quick_reply', params: { display_text: '📶 واي فاي', id: '.qr wifi' } },
                    { name: 'quick_reply', params: { display_text: '👤 في كارد', id: '.qr vcard' } }
                ]
            }, m)
        }

        // استخراج النوع من الأمر إن وُجد (مثل .qr url)
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

        const caps = {
            text: '📝 كيو آر نصي',
            url: '🔗 كيو آر رابط',
            wifi: '📶 كيو آر واي فاي',
            vcard: '👤 كيو آر في كارد'
        }

        if (result.kind === 'buffer') {
            await conn.sendMessage(m.chat, {
                image: result.data,
                caption: `✅ تم إنشاء الكيو آر (${type})\nالمحتوى: ${typeof content === 'string' ? content : content.ssid || content.name}`,
                footer: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
                contextInfo: context(m.sender)
            }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, {
                image: { url: result.data },
                caption: `✅ تم إنشاء الكيو آر عبر Pollinations (${type})\nالمحتوى: ${typeof content === 'string' ? content : content.ssid || content.name}`,
                footer: '𝑳𝑰𝑮𝑳IGHT ┇🩸┇ 𝑩𝑶𝑻',
                contextInfo: context(m.sender)
            }, { quoted: m })
        }
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
