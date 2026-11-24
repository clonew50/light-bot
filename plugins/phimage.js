// phimage - نسخة كتجيب غا التصاور
import axios from 'axios';
import * as cheerio from 'cheerio';

const PH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.pornhub.com',
};

function extractViewkey(url) {
    const q = url.match(/[?&]viewkey=([a-zA-Z0-9]+)/);
    if (q) return q[1];
    const p = url.match(/\/video\/([a-zA-Z0-9]+)/);
    if (p) return p[1];
    return null;
}

async function scrapePornhubImage(url) {
    const viewkey = extractViewkey(url);
    if (!viewkey) throw new Error('viewkey not found');
    const canonicalUrl = `https://www.pornhub.com/view_video.php?viewkey=${viewkey}`;
    const response = await axios.get(canonicalUrl, { headers: PH_HEADERS, timeout: 20000 });
    const $ = cheerio.load(response.data);
    const title = $('title').text().replace(/\s*[-–]\s*Pornhub\.com\s*$/i,'').trim() || 'Unknown Title';
    const thumbnail = $('meta[property="og:image"]').attr('content') || null;
    const uploader = $('.usernameBadgesWrapper a').first().text().trim() || 'Unknown';

    // كنقلبو على صور اخرى فالصفحة
    let images = [];
    if(thumbnail) images.push(thumbnail);

    // بعض الفيديوهات عندهم poster اخرين
    $('meta[property="og:image"]').each((i, el) => {
        let img = $(el).attr('content');
        if(img &&!images.includes(img)) images.push(img);
    });

    if(!images.length) throw new Error('No thumbnail found');
    return { title, uploader, thumbnail, images };
}

async function searchPornhub(query) {
    const response = await axios.get(`https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`, { headers: PH_HEADERS, timeout: 20000 });
    const $ = cheerio.load(response.data);
    const result = [];
    $('ul#videoSearchResult > li.pcVideoListItem').each(function(a,b){
        const _title = $(b).find('a').attr('title');
        const _duration = $(b).find('var.duration').text().trim();
        const _views = $(b).find('var.views').text().trim();
        const _url = 'https://www.pornhub.com' + $(b).find('a').attr('href');
        const _thumb = $(b).find('img').attr('src') || $(b).find('img').attr('data-src') || null;
        if(_title && _url) result.push({ title:_title, duration:_duration, views:_views, url:_url, thumb:_thumb });
    });
    return result.slice(0, 10);
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    conn.phimageSearch = conn.phimageSearch || {};

    if(!text){
        return conn.reply(m.chat, `*طريقة الاستعمال:*\n${usedPrefix+command} <query>\n${usedPrefix+command} <url>\n\nمثال:\n${usedPrefix}phimage arab\n${usedPrefix}phimage https://www.pornhub.com/view_video.php?viewkey=xxx`, m);
    }

    if(isLink(text)){
        try{
            await m.react('⏳');
            let data = await scrapePornhubImage(text.trim());
            for(let img of data.images){
                await conn.sendMessage(m.chat, { image: { url: img }, caption: `*${data.title}*\nUploader: ${data.uploader}` }, { quoted: m });
            }
            await m.react('✅');
        }catch(e){ conn.reply(m.chat, `⚠️ Failed: ${e.message}`, m); }
        return;
    }

    try{
        await m.react('🔍');
        let results = await searchPornhub(text);
        if(!results.length) return conn.reply(m.chat, `❌ ماكاين والو لـ: *${text}*`, m);

        let teks = `「 *P O R N H U B - IMAGE* 」\n*Query:* ${text}\n\n`;
        teks += results.map((v,i)=>`*_${i+1}. ${v.title}_*\n🎞️ ${v.duration} | 👀 ${v.views}\n🔗 ${v.url}\n`).join('\n──────────────\n');
        teks += `\n\n*جاوب برقم 1-${results.length} باش تجيب التصويرة*`;

        await conn.reply(m.chat, teks, m);
        conn.phimageSearch[m.sender] = {
            results,
            timeout: setTimeout(()=>{ delete conn.phimageSearch[m.sender]; }, 120000),
        };
        await m.react('✅');
    }catch(e){
        conn.reply(m.chat, `⚠️ Error search: ${e.message}`, m);
    }
};

handler.before = async (m, { conn }) => {
    conn.phimageSearch = conn.phimageSearch || {};
    if(!(m.sender in conn.phimageSearch)) return;

    let input = m.text?.trim();
    if(!/^\d+$/.test(input)) return;
    let index = parseInt(input) - 1;
    let session = conn.phimageSearch[m.sender];
    if(index < 0 || index >= session.results.length) return;

    let picked = session.results[index];
    clearTimeout(session.timeout);
    delete conn.phimageSearch[m.sender];

    try{
        await m.react('⏳');
        let data = await scrapePornhubImage(picked.url);
        for(let img of data.images){
            await conn.sendMessage(m.chat, { image: { url: img }, caption: `*${data.title}*\nUploader: ${data.uploader}` }, { quoted: m });
        }
        await m.react('✅');
    }catch(e){
        await conn.reply(m.chat, `⚠️ فشل: ${e.message}`, m);
    }
    return true;
};

handler.help = ['phimage <query/url>'];
handler.tags = ['adult'];
handler.command = ['phimage','pornhubimage','phimg'];
handler.owner = true
handler.rowner = true

export default handler;
function isLink(text){
    if(!text) return null;
    return text.match(/https?:\/\/\S+/gi);
}