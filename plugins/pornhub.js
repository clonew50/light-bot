//Credits DanielDiod + Yono - merged by Rem
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = '/usr/bin/ffmpeg';
const TMP_DIR = path.join(process.cwd(), 'data/tmp');

const PH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.pornhub.com',
};

function ensureTmp() {
    try {
        if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
        return TMP_DIR;
    } catch { return '/tmp'; }
}

async function hlsToMp4(m3u8Url) {
    const tmpDir = ensureTmp();
    const ts = Date.now();
    const tmpOutput = path.join(tmpDir, `ph_tmp_${ts}.mp4`);
    const args = [
        '-y','-allowed_extensions','ALL','-protocol_whitelist','file,http,https,tcp,tls,crypto',
        '-headers', `User-Agent: ${PH_HEADERS['User-Agent']}\r\nReferer: https://www.pornhub.com\r\n`,
        '-i', m3u8Url,'-c','copy','-movflags','faststart','-bsf:a','aac_adtstoasc','-f','mp4',tmpOutput
    ];
    await execFileAsync(FFMPEG_PATH, args);
    if (!fs.existsSync(tmpOutput) || fs.statSync(tmpOutput).size===0) throw new Error('Remux failed');
    return tmpOutput;
}

function extractViewkey(url) {
    const q = url.match(/[?&]viewkey=([a-zA-Z0-9]+)/);
    if (q) return q[1];
    const p = url.match(/\/video\/([a-zA-Z0-9]+)/);
    if (p) return p[1];
    return null;
}

async function scrapePornhub(url) {
    const viewkey = extractViewkey(url);
    if (!viewkey) throw new Error('viewkey not found');
    const canonicalUrl = `https://www.pornhub.com/view_video.php?viewkey=${viewkey}`;
    const response = await axios.get(canonicalUrl, { headers: PH_HEADERS, timeout: 20000 });
    const $ = cheerio.load(response.data);
    const title = $('title').text().replace(/\s*[-–]\s*Pornhub\.com\s*$/i,'').trim() || 'Unknown Title';
    const thumbnail = $('meta[property="og:image"]').attr('content') || null;
    const uploader = $('.usernameBadgesWrapper a').first().text().trim() || 'Unknown';
    let flashvars = null;
    $('script').each(function(){
        if(flashvars) return;
        const raw = $(this).html()||'';
        if(!raw.includes('mediaDefinitions')) return;
        const m = raw.match(/var\s+flashvars_\d+\s*=\s*(\{[\s\S]*?\})\s*;/);
        if(!m) return;
        try{ flashvars = JSON.parse(m[1]); }catch{}
    });
    if(!flashvars) throw new Error('flashvars not found - video private/geo-block');
    const mediaDefinitions = flashvars.mediaDefinitions || [];
    const videoUrls = [];
    for(const def of mediaDefinitions){
        if(!def.videoUrl) continue;
        if(def.format==='mp4') videoUrls.push({type:'MP4', quality:def.quality?`${def.quality}p`:'Default', link:[def.videoUrl]});
        else if(def.format==='hls') videoUrls.push({type:'HLS', quality:def.quality?`${def.quality}p`:'Auto', link:[def.videoUrl]});
    }
    videoUrls.sort((a,b)=>(parseInt(b.quality)||0)-(parseInt(a.quality)||0));
    if(!videoUrls.length) throw new Error('No media found');
    if(thumbnail) videoUrls.push({type:'JPG', quality:'Thumbnail', link:[thumbnail]});
    return { title, uploader, thumbnail, videoUrls };
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
        if(_title && _url) result.push({ title:_title, duration:_duration, views:_views, url:_url });
    });
    return result.slice(0, 10);
}

// MAIN HANDLER
let handler = async (m, { conn, text, usedPrefix, command }) => {
    conn.pornhub = conn.pornhub || {};
    conn.pornhubSearch = conn.pornhubSearch || {};

    if(!text){
        return conn.reply(m.chat, `*How to use:*\n${usedPrefix+command} <query>\n${usedPrefix+command} <url>\n\nExample:\n${usedPrefix}phsearch arab\n${usedPrefix}ph https://www.pornhub.com/view_video.php?viewkey=xxx`, m);
    }

    // if link -> download directly
    if(isLink(text)){
        try{
            await m.react('⏳');
            let data = await scrapePornhub(text.trim());
            const menu = data.videoUrls.map((item,i)=>`*_${i+1}. ${item.type} — ${item.quality}_*`).join('\n');
            await conn.reply(m.chat, `*${data.title}*\nUploader: ${data.uploader}\n──────────────\nSelect format:\n${menu}`, m);
            conn.pornhub[m.sender] = {
                title: data.title,
                allLinks: data.videoUrls.map(v=>v.link),
                types: data.videoUrls.map(v=>v.type),
                timeout: setTimeout(()=>{ delete conn.pornhub[m.sender]; }, 160000),
            };
        }catch(e){ conn.reply(m.chat, `⚠️ Failed: ${e.message}`, m); }
        return;
    }

    // if query -> search
    try{
        await m.react('🔍');
        let results = await searchPornhub(text);
        if(!results.length) return conn.reply(m.chat, `❌ No results for: *${text}*`, m);

        let teks = `「 *P O R N H U B - S E A R C H* 」\n*Query:* ${text}\n\n`;
        teks += results.map((v,i)=>`*_${i+1}. ${v.title}_*\n🎞️ ${v.duration} | 👀 ${v.views}\n🔗 ${v.url}\n`).join('\n──────────────\n');
        teks += `\n\n*Reply with a number 1-${results.length} to download*`;

        await conn.reply(m.chat, teks, m);

        conn.pornhubSearch[m.sender] = {
            results,
            timeout: setTimeout(()=>{ delete conn.pornhubSearch[m.sender]; }, 120000),
        };
        await m.react('✅');
    }catch(e){
        conn.reply(m.chat, `⚠️ Error search: ${e.message}`, m);
    }
};

handler.before = async (m, { conn }) => {
    conn.pornhub = conn.pornhub || {};
    conn.pornhubSearch = conn.pornhubSearch || {};

    // STEP 1: choose a search result
    if(m.sender in conn.pornhubSearch){
        let input = m.text?.trim();
        if(!/^\d+$/.test(input)) return;
        let index = parseInt(input) - 1;
        let session = conn.pornhubSearch[m.sender];
        if(index < 0 || index >= session.results.length) return;

        let picked = session.results[index];
        clearTimeout(session.timeout);
        delete conn.pornhubSearch[m.sender];

        try{
            await m.react('⏳');
            let data = await scrapePornhub(picked.url);
            const menu = data.videoUrls.map((item,i)=>`*_${i+1}. ${item.type} — ${item.quality}_*`).join('\n');
            await conn.reply(m.chat, `*${data.title}*\nUploader: ${data.uploader}\n──────────────\nSelect format:\n${menu}`, m);
            conn.pornhub[m.sender] = {
                title: data.title,
                allLinks: data.videoUrls.map(v=>v.link),
                types: data.videoUrls.map(v=>v.type),
                timeout: setTimeout(()=>{ delete conn.pornhub[m.sender]; }, 160000),
            };
        }catch(e){
            await conn.reply(m.chat, `⚠️ Failed to get video: ${e.message}`, m);
        }
        return true;
    }

    // STEP 2: choose quality to download
    if(m.sender in conn.pornhub){
        let input = m.text?.match(/^\d+$/);
        if(!input) return;
        let index = parseInt(input[0]) - 1;
        let session = conn.pornhub[m.sender];
        if(index < 0 || index >= session.allLinks.length) return;

        try{
            await m.react('⬇️');
            const links = session.allLinks[index];
            const type = session.types[index];
            const cap = `*${session.title}*`;
            for(const url of links){
                if(type==='JPG'){
                    await conn.sendFile(m.chat, url, 'thumb.jpg', cap, m);
                }else if(type==='HLS'){
                    let tmpPath = null;
                    try{
                        tmpPath = await hlsToMp4(url);
                        await conn.sendFile(m.chat, tmpPath, 'video.mp4', cap, m);
                    }finally{ if(tmpPath) try{ fs.unlinkSync(tmpPath); }catch{} }
                }else{
                    await conn.sendFile(m.chat, url, 'video.mp4', cap, m);
                }
            }
            await m.react('✅');
        }catch(e){
            await conn.reply(m.chat, `⚠️ Error: ${e.message}`, m);
        }finally{
            clearTimeout(session.timeout);
            delete conn.pornhub[m.sender];
        }
        return true;
    }
};

handler.help = ['phsearch <query>', 'ph <url>'];
handler.tags = ['adult'];
handler.command = ['phsearch','pornhubsearch','ph','pornhub'];

// OWNER / DEVELOPER ONLY
handler.owner = true
handler.rowner = true
handler.mods = false
handler.premium = false

export default handler;

function isLink(text){
    if(!text) return null;
    return text.match(/https?:\/\/\S+/gi);
}