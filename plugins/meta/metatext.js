/*
  ═══════════════════════════════════════════
  ✨ رسايل ميتا AI — بروتوكول richResponse (شكل رسايل ميتا AI الرسمي)
  مستوحى من بروتوكولات wb-protocols-pix — بناء نظيف بدون أي بيانات حربية
  (مفيش senderKeys / messageSecret / جروبات هاردكود زي المقتطفات الخام).

  الأوامر:
    .ميتا <نص>        → كارت ميتا AI (حالة مكتملة)
    .ميتا_يفكر <نص>   → كارت "بيفكر…" (حالة بحث شغالة is_in_progress)
  ═══════════════════════════════════════════
*/
import crypto from 'crypto';

const cooldown = new Map();
const COOLDOWN_MS = 4 * 1000;

/* إرسال بروتوكول خام عبر السوكيت (conn = عميل meowsab) */
async function relayRaw(conn, chat, content, extra = {}) {
  const relay =
    conn?.sock?.relayMessage?.bind(conn.sock) ||
    conn?.relayMessage?.bind(conn);
  if (typeof relay !== 'function') throw new Error('relayMessage مش متاح');
  await relay(chat, content, extra);
}

/* بناء رسالة richResponse — نفس شكل رسايل ميتا AI بدون أي مفاتيح حربية */
function buildRich(text, thinking = false) {
  const unified = {
    response_id: crypto.randomUUID(),
    sections: [
      {
        view_model: {
          __typename: 'GenAISingleLayoutViewModel',
          primitive: {
            __typename: 'GenAIBotProgressStatusPrimitive',
            icon: 'SEARCH',
            is_in_progress: thinking,
            title: text
          }
        }
      }
    ]
  };
  return {
    messageContextInfo: {
      botMetadata: {
        messageDisclaimerText: '',
        richResponseSourcesMetadata: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: text }],
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

/* إرسال عبر دالة الإطار الجاهزة لو موجودة، وإلا البروتوكول الخام */
async function sendMeta(conn, chat, text, thinking) {
  if (typeof conn?.sendAiMessage === 'function' && !thinking) {
    await conn.sendAiMessage(chat, [{ type: 2, text }]);
    return;
  }
  await relayRaw(conn, chat, buildRich(text, thinking));
}

const metaText = async (m, { conn, args }) => {
  try {
    const body = (args || []).join(' ').trim();
    if (!body) {
      await conn.sendMessage(m.chat, { text: '✍️ اكتب النص بعد الأمر:\n.ميتا مرحبًا بكم في لايت بوت' }, { quoted: m });
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());
    await sendMeta(conn, m.chat, body, false);
  } catch (e) {
    console.error('❌ [ميتا]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في إرسال رسالة ميتا AI.' }, { quoted: m });
  }
};

const metaThinking = async (m, { conn, args }) => {
  try {
    const body = (args || []).join(' ').trim();
    if (!body) {
      await conn.sendMessage(m.chat, { text: '✍️ اكتب النص بعد الأمر:\n.ميتا_يفكر جاري تجهيز طلبك…' }, { quoted: m });
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());
    await sendMeta(conn, m.chat, body, true);
  } catch (e) {
    console.error('❌ [ميتا_يفكر]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في إرسال رسالة ميتا AI.' }, { quoted: m });
  }
};

metaText.command = ['ميتا', 'metaai'];
metaText.usage = ['.ميتا <نص>', '.ميتا_يفكر <نص>'];
metaText.category = 'ai';
metaText.cooldown = 4;

metaThinking.command = ['ميتا_يفكر', 'ميتايفكر'];
metaThinking.category = 'ai';
metaThinking.cooldown = 4;

export default [metaText, metaThinking];
