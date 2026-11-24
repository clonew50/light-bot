/* Github Search By WillZek - Fixed */

import fetch from 'node-fetch';

let handler = async(m, { conn, text, usedPrefix, command }) => {

if (!text) return conn.reply(m.chat, `⚠️ Por favor ingresa un nombre de un repositorio GitHub.\n\nEjemplo: ${usedPrefix+command} NiceBot`, m);

try {
await m.react('🔍')

let api = `https://dark-core-api.vercel.app/api/search/github?key=api&text=${encodeURIComponent(text)}`;

let response = await fetch(api);
let json = await response.json();

if(!json.results || json.results.length === 0){
    return conn.reply(m.chat, `❌ No se encontraron resultados para: *${text}*`, m)
}

let result = json.results[0];

let txt = `*GITHUB - SEARCH*\n\n`+
`🍬 *Nombre:* ${result.name}\n`+
`👑 *Owner:* ${result.creator}\n`+
`🌟 *Estrellas:* ${result.stars}\n`+
`🔖 *Bifurcaciones:* ${result.forks}\n`+
`📜 *Descripcion:* ${result.description || 'Sin descripcion'}\n`+
`📆 *Creado:* ${result.createdAt}\n`+
`🔗 *Link:* ${result.cloneUrl}`;

let img = 'https://files.catbox.moe/oc4myc.png';

await conn.sendMessage(m.chat, { image: { url: img }, caption: txt }, { quoted: m });
await m.react('✅')

} catch (error) {
console.error(error)
m.reply(`❌ Error: ${error.message}`);
await m.react('✖️');
 }
};

handler.help = ['githubsearch <query>']
handler.tags = ['search']
handler.command = ['githubsearch', 'gbsearch'];

export default handler;