import axios from 'axios';
import cheerio from 'cheerio';
import FormData from 'form-data';
import { Convert } from "meowsab";

let handler = async (m, { conn, text, command }) => {
 
 if (!m.quoted) return m.reply('🎏 رد علي الملصق');

 if (!/webp/.test(m.quoted.mimetype)) return m.reply(`*هذا ليس ملصقا*`);

 const buffer = await m.quoted.download();;
 let smp4 = await Convert.WebpToMp4(buffer)
 
 await conn.sendMessage(m.chat, {
      video: { url: smp4 },
      caption: `> *تم بواسطة لايت*`,
    }, { quoted: m });
}

handler.usage = ["لفيديو"];
handler.category = "tools";
handler.command = /^(tovideo|tovid|tomp4|لفيديو)$/i

export default handler