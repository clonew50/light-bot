/*
  ═══════════════════════════════════════════
  🧮 معادلات لاتيكس — بروتوكول LaTeX الخاص برسايل ميتا AI
  مستوحى من بروتوكولات wb-protocols-pix (GenAILatexItem) — بناء نظيف:
  بنرسم المعادلة عبر latex.codecogs.com (مجاني بدون مفتاح) وبنقيس أبعاد
  الصورة من هيدر PNG نفسه، وبنعرضها inline جوه كارت ميتا AI.
  لو البروتوكول فشل → بيبعت الصورة كصورة عادية (بديل مضمون).

  الأمر:
    .لاتكس e^{i\\pi} = -1
    .لاتكس \\frac{a}{b} + \\sqrt{x^2+1}
  ═══════════════════════════════════════════
*/
import crypto from 'crypto';

const cooldown = new Map();
const COOLDOWN_MS = 5 * 1000;
const FONT_HEIGHT = 83.333;

/* قراءة أبعاد صورة PNG من هيدر IHDR */
function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function codecogsUrl(formula) {
  // dpi 200 + خلفية شفافة + لون غامق يبان على الوضع الفاتح والغامق
  return 'https://latex.codecogs.com/png.image?%5Cdpi%7B200%7D%5Cbg_black%5Ccolor%7B333333%7D%20' +
    encodeURIComponent(formula);
}

async function relayRaw(conn, chat, content) {
  const relay =
    conn?.sock?.relayMessage?.bind(conn.sock) ||
    conn?.relayMessage?.bind(conn);
  if (typeof relay !== 'function') throw new Error('relayMessage مش متاح');
  await relay(chat, content, {});
}

const handler = async (m, { conn, args }) => {
  try {
    const formula = (args || []).join(' ').trim();
    if (!formula) {
      await conn.sendMessage(m.chat, {
        text: '✍️ اكتب المعادلة بعد الأمر:\n.لاتكس e^{i\\pi} = -1\n.لاتكس \\frac{a}{b}'
      }, { quoted: m });
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());

    const url = codecogsUrl(formula);
    let size = null;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        size = pngSize(buf);
      }
    } catch { /* هنستخدم البديل */ }

    if (!size) {
      // ما قدرناش نتأكد من الصورة → البديل: إرسالها كصورة عادية
      await conn.sendMessage(m.chat, { image: { url }, caption: `🧮 ${formula}` }, { quoted: m });
      return;
    }

    // بروتوكول ميتا AI للمعادلات: النص فيه placeholder والصورة inline جواه
    const key = 'LX' + Math.floor(Math.random() * 100000);
    const messageText = `{{${key}}}${formula}{{/${key}}}`;
    const unified = {
      response_id: crypto.randomUUID(),
      sections: [
        {
          view_model: {
            __typename: 'GenAISingleLayoutViewModel',
            primitive: {
              text: messageText,
              inline_entities: [
                {
                  key,
                  metadata: {
                    latex_expression: formula,
                    latex_image: { url, width: size.width, height: size.height },
                    font_height: FONT_HEIGHT,
                    padding: 15,
                    __typename: 'GenAILatexItem'
                  }
                }
              ],
              __typename: 'GenAIMarkdownTextUXPrimitive'
            }
          }
        }
      ]
    };
    const content = {
      messageContextInfo: {
        botMetadata: {
          pluginMetadata: {},
          richResponseSourcesMetadata: {}
        }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText }],
            unifiedResponse: {
              data: Buffer.from(JSON.stringify(unified)).toString('base64')
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: '0@bot' },
              forwardOrigin: 4
            }
          }
        }
      }
    };
    await relayRaw(conn, m.chat, content);
  } catch (e) {
    console.error('❌ [لاتكس]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في رسم المعادلة. تأكد إن الصيغة صحيحة.' }, { quoted: m });
  }
};

handler.command = ['لاتكس', 'latex', 'معادلة'];
handler.usage = ['.لاتكس <معادلة>'];
handler.category = 'tools';
handler.cooldown = 5;

export default handler;
