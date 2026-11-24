import { AIRich } from '../lib/NIXCODE.js';

let handler = async (m, { conn }) => {
  try {
    await new AIRich(conn)
      .addText('👑 Owner of Yumi\n\nهذا جدول AIRich خدام بـ NIXCODE')
      .addMetadata('© ALYA BOT • YONO • 2026\n62895618468164')
      .addSuggest(['62895618468164'])
      .send(m.chat, { quoted: m });
  } catch (e) {
    // إلا ما خدمش NIXCODE، صيفط نورمال
    await conn.sendMessage(m.chat, { text: `AIRich Error: ${e.message}\n\nجرب relay عادي:\n` }, { quoted: m });
    await conn.relayMessage(m.chat, {
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            submessages: [{ messageType: 2, messageText: "Owner of Yumi" }],
            messageType: 1,
            unifiedResponse: { data: 'eyJyZXNwb25zZV9pZCI6InRlc3QifQ==' }
          }
        }
      }
    }, {});
  }
};

handler.command = ['gpairich'];
handler.tags = ['owner'];
handler.owner = false;
export default handler;