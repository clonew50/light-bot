/*
  ═══════════════════════════════════════════
  📇 طلب جهة اتصال — زر واتساب الرسمي "مشاركة جهة الاتصال"
  (بروتوكول native_flow: request_contact_info — مستوحى من wb-protocols-pix)
  البوت يبعت زر، واللي يدوس عليه واتساب يطلب منه مشاركة رقمه،
  ولما يشارك جهة الاتصال البوت يقله شكرًا ويرجّعهالك في رسالة.

  الأمر:
    .طلب_جهة
  ═══════════════════════════════════════════
*/
const COOLDOWN_MS = 10 * 1000;
const REQUEST_TTL = 30 * 60 * 1000;   // صلاحية انتظار الرد 30 دقيقة

const cooldown = new Map();
// الشاتات اللي البوت طلب فيها جهة اتصال ومستني رد
const pending = new Map();

async function relayRaw(conn, chat, content, extra = {}) {
  const relay =
    conn?.sock?.relayMessage?.bind(conn.sock) ||
    conn?.relayMessage?.bind(conn);
  if (typeof relay !== 'function') throw new Error('relayMessage مش متاح');
  await relay(chat, content, extra);
}

const handler = async (m, { conn }) => {
  try {
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());

    const content = {
      interactiveMessage: {
        body: { text: '📇 اضغط الزر وشارك جهة اتصالك معنا' },
        nativeFlowMessage: {
          buttons: [{ name: 'request_contact_info' }],
          messageParamsJson: '{}'
        },
        contextInfo: {
          expiration: 7776000,
          disappearingMode: { initiator: 0, trigger: 0 }
        }
      }
    };
    const extra = {
      additionalNodes: [
        {
          tag: 'biz',
          attrs: {},
          content: [
            {
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { name: 'request_contact_info' } }]
            }
          ]
        }
      ]
    };
    await relayRaw(conn, m.chat, content, extra);
    pending.set(m.chat, Date.now());
  } catch (e) {
    console.error('❌ [طلب_جهة]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في إرسال زر مشاركة جهة الاتصال.' }, { quoted: m });
  }
};

/* التقاط جهة الاتصال لما المستخدم يشاركها */
const before = async (m, { conn }) => {
  const sentAt = pending.get(m.chat);
  if (!sentAt) return false;
  if (Date.now() - sentAt > REQUEST_TTL) {
    pending.delete(m.chat);
    return false;
  }
  const msg = m?.message || {};
  const contact = msg.contactMessage || msg.contactsArrayMessage?.contacts?.[0];
  if (!contact) return false;

  pending.delete(m.chat);
  try {
    const name = contact.displayName || 'جهة اتصال';
    const vcard = contact.vcard || '';
    await conn.sendMessage(m.chat, {
      text: `✅ شكرًا ليك! استلمنا جهة اتصالك: ${name}`
    }, { quoted: m });
    if (vcard) {
      await conn.sendMessage(m.chat, {
        contacts: { displayName: name, contacts: [{ displayName: name, vcard }] }
      }, { quoted: m });
    }
  } catch (e) {
    console.error('❌ [طلب_جهة] في الرد:', e?.message || e);
  }
  return true;
};

handler.command = ['طلب_جهة', 'requestcontact'];
handler.usage = ['.طلب_جهة'];
handler.category = 'tools';
handler.cooldown = 10;
handler.before = before;

export default handler;
