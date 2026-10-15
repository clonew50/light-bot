import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { uploadToCatbox } from "../../system/utils.js";

const handler = async (m, { conn, command }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || '';

  if (!mime) return m.reply('*رد علي الصوره او الفيديو أو الصوت لتحويله لرابط 🔗*');
  
  const media = await q.download();
  const link = await uploadToCatbox(media);
  
  await conn.sendButton(m.chat, {
    imageUrl: link,
    bodyText: "🗃️ نجح رفع الصورة على *(catbox.moe)*\n- ```" + link + "```",
    footerText: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻",
    buttons: [
      { name: "cta_copy", params: { display_text: "Copy Link", copy_code: link } },
    ],
    mentions: [m.sender],
    newsletter: {
      name: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      jid: '120363405545946827@newsletter'
    },
    interactiveConfig: {
      buttons_limits: 10,
      list_title: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻",
      button_title: "Click Here",
      canonical_url: "https://vxv-profile.vercel.app"
    }
  }, m);
};

handler.usage = ["لرابط2"];
handler.category = "tools";
handler.command = ['لرابط2', 'image2url2'];

export default handler;
