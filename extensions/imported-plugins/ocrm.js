/*
 * crm plugins simplified for Elaina
 * original by Nixel - simplified by alya
 * owner only + prefix o
 */

import crypto from 'crypto';
import { proto } from '@whiskeysockets/baileys';

const handler = async (m, { conn, text, command }) => {
    const args = String(text || '').trim().split(/\s+/).filter(Boolean);
    const cleanCmd = command.toLowerCase().replace(/^o/, ''); // ocrm -> crm

    if (cleanCmd === 'lastchat') {
        return m.reply('❌ Fitur olastchat butuh crmstore SQLite.\nGunakan.ocrm dengan reply pesan saja\nby alya');
    }

    if (!m.quoted) {
        const usage = `📌 *.${command}* butuh reply pesan

*Command Owner (by alya):*
•.ocrm → Generate file relay siap pakai
•.ocrm2 → Kirim relay code + tombol copy
•.oadn → Ambil AdditionalNodes
•.oinsp → Ambil raw payload JSON
•.orelay → Langsung relay ulang pesan

*Flag:*
• -raw → Export raw JSON
• -message → Export message saja
• -relay → Export kode relay
• -file → Kirim sebagai dokumen
• -snip → Tampilkan sebagai snippet

Contoh:
.ocrm
.ocrm -snip
.oinsp -raw -file
.orelay`;

        return m.reply(usage);
    }

    let rmsg = null;
    try { rmsg = await m.getQuotedObj?.(); } catch {}
    if (!rmsg?.message) rmsg = m.quoted?.fakeObj || { key: m.quoted.key, message: m.quoted.message || { conversation: m.quoted.text } };

    let msg = rmsg;
    if (!msg?.message) return m.reply(`⛓️‍💥 Message tidak valid`);

    const type = Object.keys(msg.message).find(v =>!['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || 'unknown';

    // Ambil relay options dari context
    const additionalAttributes = {};
    const additionalNodes = [];

    const rawPayload = { message: msg, additionalAttributes, additionalNodes };
    const raw = stringify(rawPayload);
    const messageOnly = stringify(msg.message);
    const keyStr = stringify(msg.key);
    const options = stringifySnippet({});

    const snippetMessage = stringifySnippet(msg.message);
    const relayCode = `// by alya - ${type}\nawait conn.relayMessage(\n m.chat,\n ${indentBlock(snippetMessage)},\n {}\n)`;

    const files = { raw, message: messageOnly, relay: relayCode };
    const exportType = ['raw', 'message', 'relay'].find(v => text.includes(`-${v}`));

    if (exportType) {
        if (text.includes('-file')) {
            return conn.sendMessage(m.chat, {
                document: Buffer.from(files[exportType]),
                fileName: exportType === 'relay'? `${type}_by_alya.js` : `${exportType}.json`,
                mimetype: exportType === 'relay'? 'application/javascript' : 'application/json',
            }, { quoted: m });
        }
        return m.reply(files[exportType]);
    }

    const isSnip = text.includes('-snip');
    const metadata = `• Type: ${type}\n• ID: ${msg.key?.id || '-'}\n• Chat: ${msg.key?.remoteJid || m.chat}\n• by alya`;

    if (cleanCmd === 'relay' || cleanCmd === 'orelay' || command === 'orelay') {
        const newId = await conn.relayMessage(m.chat, structuredClone(msg.message), {});
        return m.reply(`✅ Relayed: ${newId}\nby alya`);
    }

    if (cleanCmd === 'insp' || command === 'oinsp') {
        return conn.sendMessage(m.chat, {
            document: Buffer.from(stringify({ message: msg })),
            fileName: `${type}_by_alya.json`,
            mimetype: 'application/json',
            caption: metadata,
        }, { quoted: m });
    }

    if (cleanCmd === 'adn' || command === 'oadn') {
        return m.reply(`AdditionalNodes untuk ${type}:\n${stringify(additionalNodes)}\n\nby alya\nCatatan: di Elaina original tidak ada additionalNodes, ini versi simple`);
    }

    if (cleanCmd === 'crm2' || command === 'ocrm2') {
        return conn.sendMessage(m.chat, {
            document: Buffer.from(relayCode),
            fileName: `${type}_by_alya.js`,
            mimetype: 'application/javascript',
            caption: `${metadata}\n\nRaw:\n${raw.slice(0, 1000)}`,
        }, { quoted: m });
    }

    // default ocrm
    if (isSnip) {
        return m.reply(`\`\`\`javascript\n${relayCode}\n\`\`\`\n\n${metadata}`);
    }

    return conn.sendMessage(m.chat, {
        document: Buffer.from(relayCode),
        fileName: `${type}_by_alya.js`,
        mimetype: 'application/javascript',
        caption: metadata,
    }, { quoted: m });
};

handler.command = ['ocrm', 'ocrm2', 'oinsp', 'oadn', 'orelay', 'olastchat'];
handler.category = 'owner';
handler.owner = true;
handler.usage = ['ocrm (reply)'];

export default handler;

function stringify(obj) {
    return JSON.stringify(obj, (k, v) => {
        if (Buffer.isBuffer(v)) return v.toString('base64');
        if (v?.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data).toString('base64');
        return v;
    }, 2);
}
function stringifySnippet(obj) {
    const json = JSON.stringify(obj, (k, v) => {
        if (Buffer.isBuffer(v)) return v.toString('base64');
        if (v?.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data).toString('base64');
        return v;
    }, 2);
    return json.replace(/^(\s*)"([^"]+)":/gm, (_, indent, key) => `${indent}${key}:`);
}
function indentBlock(str, level = 1) {
    const pad = ' '.repeat(level);
    return str.split('\n').map((line, i) => (i === 0? line : pad + line)).join('\n');
}