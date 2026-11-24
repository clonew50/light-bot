// plugins/welcome-one.js - REM BOT - DEV 212674375708 - TEST WELCOME
import Jimp from 'jimp';
import fetch from 'node-fetch';

const BOT = 'REM BOT';
const DEV = '212674375708';
const BG_URL = 'https://litter.catbox.moe/4evj2u.jpg';

async function getBuffer(url) {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

async function createWelcome(ppBuffer, number, bgBuffer) {
  // الخلفية
  let bg = await Jimp.read(bgBuffer);
  bg.resize(1080, 1080); // مربع ناضي

  // البروفايل
  let pp;
  try {
    pp = await Jimp.read(ppBuffer);
  } catch {
    pp = await Jimp.read('https://files.catbox.moe/a3sbup.jpg');
  }
  pp.resize(350, 350);
  pp.circle(); // مدورة

  // فين غادي تحط البروفايل - وسط الصورة
  // الصورة ديالك فيها دائرة فالوسط - نحطوها فالنص
  const x = (bg.bitmap.width - pp.bitmap.width) / 2;
  const y = 270; // طالع شوية للفوق باش تجي فالدائرة ديال التصميم
  bg.composite(pp, x, y);

  // الكتابة - الرقم
  const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  // رقم لي دخل
  const numText = `+${number}`;
  const textWidth = Jimp.measureText(fontWhite, numText);
  const textX = (1080 - textWidth) / 2;
  bg.print(fontWhite, textX, 680, numText);

  // ترحيب
  const welcomeText = `WELCOME TO GROUP`;
  const wWidth = Jimp.measureText(fontSmall, welcomeText);
  bg.print(fontSmall, (1080 - wWidth)/2, 760, welcomeText);

  // حقوق REM BOT
  const devFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  bg.print(devFont, 20, 1040, `${BOT} | ${DEV}`);

  return await bg.getBufferAsync(Jimp.MIME_JPEG);
}

let handler = async (m, { conn, usedPrefix, command }) => {
  if (command!== 'one') return;

  await conn.sendMessage(m.chat, { react: { text: '🔥', key: m.key } });

  try {
    const who = m.mentionedJid?.[0] || m.sender;
    const number = who.split('@')[0];

    let ppUrl;
    try {
      ppUrl = await conn.profilePictureUrl(who, 'image');
    } catch {
      ppUrl = 'https://files.catbox.moe/a3sbup.jpg';
    }

    const [ppBuf, bgBuf] = await Promise.all([
      getBuffer(ppUrl),
      getBuffer(BG_URL)
    ]);

    const welcomeImg = await createWelcome(ppBuf, number, bgBuf);

    await conn.sendMessage(m.chat, {
      image: welcomeImg,
      caption: `🚀 *WELCOME - ${BOT}*\n\n> 👋 Selamat datang @${number}!\n> 📞 Nomor: +${number}\n> 🎉 Semoga betah di grup!\n\n© ${BOT} - ${DEV}`,
      mentions: [who]
    }, { quoted: m });

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

  } catch (e) {
    console.log(e);
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
    m.reply(`❌ Error: ${e.message}`);
  }
};

handler.help = ['one'];
handler.tags = ['group'];
handler.command = /^(one|welcome|testwelcome)$/i;
handler.group = true;
export default handler;