import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function parseCookies(input) {
    if (!input) return '';
    if (!input.includes('\t') &&!input.includes('\n') && input.includes('=')) return input.trim();
    const cookies = [];
    for (const rawLine of input.split('\n')) {
        const line = rawLine.trim();
        if (!line || (line.startsWith('#') &&!line.startsWith('#HttpOnly_'))) continue;
        const cleanLine = line.startsWith('#HttpOnly_')? line.slice(10) : line;
        const parts = cleanLine.split(/\s+/);
        if (parts.length >= 7) cookies.push(`${parts[5]}=${parts.slice(6).join(' ')}`);
    }
    return cookies.join('; ');
}

async function loadCookiesFromFile() {
    try {
        const cookiePath = path.resolve('./Geminicook.txt');
        if (fs.existsSync(cookiePath)) return parseCookies(fs.readFileSync(cookiePath, 'utf8'));
        return '';
    } catch { return ''; }
}

async function getSessionTokens() {
    const cookieHeader = await loadCookiesFromFile();
    if (!cookieHeader) throw new Error('Cookie tidak ditemukan. Buat file Geminicook.txt di folder utama bot!');

    const resHtml = await fetch('https://gemini.google.com/app', {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookieHeader }
    });
    const html = await resHtml.text();
    const matchWiz = html.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
    if (!matchWiz) throw new Error('Cookie expired! Ganti cookie baru.');
    const wiz = JSON.parse(matchWiz[1]);
    if (!wiz.SNlM0e) throw new Error('Gagal ambil token SNlM0e');
    return { at: wiz.SNlM0e, bl: wiz.cfb2h, fsid: wiz.FdrFJe, cookies: cookieHeader };
}

async function uploadMedia(buffer) {
    const form = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    form.append('file', blob, 'image.jpg');
    const res = await fetch('https://content-push.googleapis.com/upload', {
        method: 'POST',
        headers: { 'X-Tenant-Id': 'bard-storage', 'Push-ID': 'feeds/mcudyrk2a4khkz' },
        body: form
    });
    if (!res.ok) throw new Error(`Upload gagal ${res.status}`);
    return (await res.text()).trim();
}

function parseFrames(text) {
    const results = [];
    for (const line of text.split('\n')) {
        if (line.startsWith('[["wrb.fr"')) {
            try {
                const parsed = JSON.parse(line);
                for (const item of parsed) {
                    if (item[0] === 'wrb.fr' && item[2]) results.push({ data: JSON.parse(item[2]) });
                }
            } catch {}
        }
    }
    return results;
}

async function askGemini(prompt, options = {}, fileData = null) {
    const session = await getSessionTokens();
    const reqId = String(Math.floor(Math.random() * 900000) + 100000);
    const uuidVal = crypto.randomUUID().toUpperCase();
    const lang = 'id';

    const innerReq = new Array(69).fill(null);
    innerReq[0] = [prompt, 0, null, fileData, null, null, 0];
    innerReq[1] = [lang];
    innerReq[2] = options.conversationId? [options.conversationId, options.responseId || '', options.candidateId || ''] : ['', '', ''];
    innerReq[4] = crypto.randomBytes(16).toString('hex');
    innerReq[6] = [1]; innerReq[7] = 1; innerReq[10] = 1; innerReq[11] = 0;
    innerReq[17] = [[options.turnIndex || 0]]; innerReq[18] = 0;
    innerReq[27] = 1; innerReq[30] = [4]; innerReq[41] = [1];
    innerReq[55] = [[1]]; innerReq[59] = uuidVal; innerReq[61] = []; innerReq[68] = 2;

    const fReq = JSON.stringify([null, JSON.stringify(innerReq)]);
    const params = new URLSearchParams({ bl: session.bl, 'f.sid': session.fsid, hl: lang, _reqid: reqId, rt: 'c' });

    const res = await fetch(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${params}`, {
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Cookie': session.cookies,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-goog-ext-525005358-jspb': `["${uuidVal}",1]`
        },
        body: new URLSearchParams({ at: session.at, 'f.req': fReq })
    });

    const text = await res.text();
    const frames = parseFrames(text);
    let finalReply = '', conversationId = null, responseId = null, candidateId = null;

    for (const f of frames) {
        if (Array.isArray(f.data)) {
            if (f.data[1]) { conversationId = f.data[1][0]; responseId = f.data[1][1]; }
            if (f.data[4]?.[0]) {
                candidateId = f.data[4][0][0];
                const candidateText = f.data[4][0][1]?.[0];
                if (candidateText) finalReply = candidateText.replace(/\n*```json\?chameleon[\s\S]*?```\n*/g, '').replace(/\[cite:[^\]]+\]/g, '').trim();
            }
        }
    }
    return { text: finalReply, conversationId, responseId, candidateId };
}

global.geminiChatSessions = global.geminiChatSessions || {};

let handler = async (m, { conn, args, usedPrefix, command }) => {
    let query = args.join(" ");
    const chatId = m.chat;

    if (query.toLowerCase() === 'reset') {
        delete global.geminiChatSessions[chatId];
        return m.reply('✅ Ingatan dihapus!\n\n◠⿻ Rem Bot 🤖✨');
    }

    const q = m.quoted? m.quoted : m;
    const mime = (q.msg || q).mimetype || '';
    const isImage = /image/.test(mime);

    if (!query &&!isImage) return m.reply(`Ketik pertanyaan!\nContoh: ${usedPrefix + command} halo\n\n◠⿻ Rem Bot`);
    if (!query && isImage) query = 'Jelaskan gambar ini';

    let fileData = null;
    if (isImage) {
        try {
            let buffer = await q.download();
            const uploadId = await uploadMedia(buffer);
            fileData = [[[uploadId], 'image.jpg']];
        } catch (e) {
            return m.reply('Gagal baca gambar: ' + e.message);
        }
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
        const sessionData = global.geminiChatSessions[chatId] || { turnIndex: 0 };
        const result = await askGemini(query, sessionData, fileData);
        if (!result.text) throw new Error('Respon kosong');

        global.geminiChatSessions[chatId] = {
            conversationId: result.conversationId,
            responseId: result.responseId,
            candidateId: result.candidateId,
            turnIndex: sessionData.turnIndex + 1
        };

        await m.reply(result.text + '\n\n> ◠⿻ Rem Bot 🤖✨');
    } catch (err) {
        m.reply('⚠️ Error: ' + err.message + '\n\n◠⿻ Rem Bot');
    }
}

handler.help = ['gemini'];
handler.tags = ['ai'];
handler.command = /^(gemini)$/i;

export default handler;