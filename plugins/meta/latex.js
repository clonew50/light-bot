/*
  ═══════════════════════════════════════════
  🧮 معادلات لاتيكس — بروتوكول LaTeX الخاص برسايل ميتا AI
  مستوحى من بروتوكولات wb-protocols-pix (GenAILatexItem) — بناء نظيف:
  بنرسم المعادلة عبر latex.codecogs.com (مجاني بدون مفتاح) وبنقيس أبعاد
  الصورة من هيدر PNG نفسه، وبنعرضها:
    1) كصورة معادلة مُصيّرة (البديل المضمون دايمًا)،
    2) وكـ LaTeX-native section جوه كارت ميتا AI لما السوكيت بيدعم
       relayMessage (GenAILatexItem)، وإلا نسقط لكارت نص عبر sendAiMessage.

  الأمر:
    .لاتكس e^{i\\pi} = -1
    .لاتكس \\frac{a}{b} + \\sqrt{x^2+1}
  ═══════════════════════════════════════════
*/
import crypto from 'crypto';
import { pruneCooldown } from "../../system/cooldowns.js";

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

function relayOf(conn) {
  return (
    conn?.sock?.relayMessage?.bind(conn.sock) ||
    conn?.relayMessage?.bind(conn) ||
    null
  );
}

async function relayRaw(conn, chat, content) {
  const relay = relayOf(conn);
  if (typeof relay !== 'function') throw new Error('relayMessage مش متاح');
  await relay(chat, content, {});
}

/* كارت ميتا AI اللي فيه المعادلة نفسها كـ LaTeX inline entity */
function buildLatexCard(formula, url, size) {
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
  return {
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
}

const say = async (m, text) => {
  try {
    if (typeof m?.reply === 'function') return await m.reply(text);
    return undefined;
  } catch {
    return undefined;
  }
};

const handler = async (m, { conn, args, fetchImpl }) => {
  try {
    const formula = (args || []).join(' ').trim();
    if (!formula) {
      await say(m, '✍️ اكتب المعادلة بعد الأمر:\n.لاتكس e^{i\\pi} = -1\n.لاتكس \\frac{a}{b}');
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(m.chat, Date.now());

    const url = codecogsUrl(formula);
    const doFetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
    let size = null;
    try {
      const res = await doFetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res?.ok) throw new Error('HTTP ' + (res?.status || '?'));
      const buf = Buffer.from(await res.arrayBuffer());
      size = pngSize(buf);
      if (!size) throw new Error('صيغة غير صالحة');
    } catch (e) {
      console.error('❌ [لاتكس] تعذّر رسم المعادلة:', e?.message || e);
      await say(m, '❌ فشل رسم المعادلة. تأكد إن الصيغة صحيحة وجرب مثال زي e^{i\\pi} = -1');
      return;
    }

    // 1) الصورة المُصيّرة — مضمونة على كل العملاء.
    await conn.sendMessage(m.chat, { image: { url }, caption: `🧮 ${formula}` }, { quoted: m });

    // 2) قسم LaTeX-native (GenAILatexItem) لما السوكيت بيدعم relayMessage.
    if (typeof relayOf(conn) === 'function') {
      await relayRaw(conn, m.chat, buildLatexCard(formula, url, size));
      return;
    }
    // 3) كارت نصي عبر sendAiMessage كبديل أخير (مافيش relay).
    if (typeof conn?.sendAiMessage === 'function') {
      await conn.sendAiMessage(m.chat, [{ type: 2, text: formula }]);
    }
  } catch (e) {
    console.error('❌ [لاتكس]', e?.message || e);
    await say(m, '❌ حصلت مشكلة في رسم المعادلة. تأكد إن الصيغة صحيحة.');
  }
};

handler.command = ['لاتكس', 'latex', 'معادلة'];
handler.usage = ['.لاتكس <معادلة>'];
handler.category = 'tools';
handler.cooldown = 5;

export default handler;