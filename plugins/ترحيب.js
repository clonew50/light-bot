// plugins/welcome.js - REM BOT - DEV 212674375708 - AUTO WELCOME +.one
import Jimp from 'jimp';
import fetch from 'node-fetch';

const BOT = 'REM BOT';
const DEV = '212674375708';
const BG_URL = 'https://litter.catbox.moe/4evj2u.jpg';

// Enable welcome in the group
// Type .welcome on / .welcome off
let handler = async (m, { conn, usedPrefix, command, args }) => {
  if (command === 'welcome') {
    if (args[0] === 'on') {
      global.db.data.chats[m.chat].welcome = true;
      return m.reply(`✅ *Welcome ON - ${BOT}*\nNow everyone who joins will be welcomed automatically`);
    }
    if (args[0] === 'off') {
      global.db.data.chats[m.chat].welcome = false;
      return m.reply(`❌ *Welcome OFF - ${BOT}*`);
    }
    return m.reply(`*How to use:*\n${usedPrefix}welcome on = enable\n${usedPrefix}welcome off = disable\n${usedPrefix}one = test welcome\n\nStatus: ${global.db.data.chats[m.chat].welcome? 'ON ✅' : 'OFF ❌'}`);
  }

  if (command === 'one') {
    await conn.sendMessage(m.chat, { react: { text: '🔥', key: m.key } });
    const who = m.mentionedJid?.[0] || m.sender;
    const img = await makeWelcome(conn, who);
    await conn.sendMessage(m.chat, {
      image: img,
      caption: `🚀 *TEST WELCOME - ${BOT}*\n\n👋 Welcome @${who.split('@')[0]}!\n\n© ${BOT} - DEV ${DEV}`,
      mentions: [who]
    }, { quoted: m });
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
  }
};

handler.help = ['welcome', 'one'];
handler.tags = ['group'];
handler.command = /^(welcome|one|testwelcome)$/i;
handler.group = true;
handler.admin = true;

// MAIN FUNCTION TO CREATE THE IMAGE
async function makeWelcome(conn, who) {
  const jidNumber = who.split('@')[0];
  let ppUrl;
  try { ppUrl = await conn.profilePictureUrl(who, 'image'); }
  catch { ppUrl = 'https://telegra.ph/file/24fa902ead2637a3e4d7a.png'; }

  const bg = await Jimp.read(BG_URL);
  bg.resize(1080, 1080);

  let avatar = await Jimp.read(ppUrl);
  avatar.resize(380, 380);
  avatar.circle(); // make it round

  // Avatar position in the center of your design circle
  const x = (1080 - 380) / 2;
  const y = 265;
  bg.composite(avatar, x, y);

  // Number text
  const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontMini = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  // Shadow for the text so it's clear
  const numText = `+${jidNumber}`;
  const w1 = Jimp.measureText(fontBig, numText);
  bg.print(fontBig, (1080 - w1)/2, 680, numText);

  const t2 = 'WELCOME TO GROUP';
  const w2 = Jimp.measureText(fontSmall, t2);
  bg.print(fontSmall, (1080 - w2)/2, 760, t2);

  bg.print(fontMini, 20, 1040, `${BOT} | ${DEV}`);

  return await bg.getBufferAsync(Jimp.MIME_JPEG);
}

// AUTO WELCOME WHEN SOMEONE JOINS
handler.before = async function(m, { conn, participants }) {
  if (!m.messageStubType) return;
  if (!global.db) return;

  const chat = global.db.data.chats[m.chat];
  if (!chat ||!chat.welcome) return;

  // 27 = join, 28 = leave, 32 = join via link
  if (m.messageStubType == 27 || m.messageStubType == 32) {
    for (let who of m.messageStubParameters) {
      try {
        const img = await makeWelcome(conn, who);
        await conn.sendMessage(m.chat, {
          image: img,
          caption: `🚀 *WELCOME - ${BOT}*\n\n👋 Hello @${who.split('@')[0]}!\nWelcome to the group!\nHope you enjoy it here!\n\n© ${BOT} - DEV ${DEV}`,
          mentions: [who]
        });
      } catch (e) {
        console.log('WELCOME ERROR:', e);
      }
    }
  }
};

export default handler;