// plugins/tools-checkwa.js
async function joinandsus(sock, jid) {
  try {
    const queryId = "26204539559207163";
    const res = await sock.query({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "get", xmlns: "w:mex" },
      content: [{
        tag: "query",
        attrs: { query_id: queryId },
        content: Buffer.from(JSON.stringify({
          queryId,
          variables: {
            input: {
              query_input: [{ jid, integrity_signals: { dhash: null, use_case: "START_CHAT_CONTEXT" } }],
              telemetry: { context: "INTERACTIVE" }
            }
          }
        }))
      }]
    });

    const c = res.content?.find(n => n.tag === "result")?.content;
    if (!c) return null;

    const { data, errors } = JSON.parse(Buffer.from(c.data ?? c).toString());
    const s = data?.xwa2_fetch_wa_users?.[0]?.integrity_signals_info;

    return !errors?.length && s ? {
      is_suspect: s.is_suspicious_start_chat ?? null,
      join_time: s.join_date_ms ?? null,
      is_new: s.is_new_account ?? null
    } : null;
  } catch (e) {
    console.error('[CHECKWA]', e);
    return "error";
  }
}

const handler = async (m, { conn, text }) => {
  let targetJid;

  if (m.mentionedJid?.[0]) {
    targetJid = m.mentionedJid[0];
  } else if (m.quoted?.sender) {
    targetJid = m.quoted.sender;
  } else if (text) {
    const num = text.replace(/[^0-9]/g, '');
    if (num.length < 7) return m.reply('❌ اكتب رقم صحيح بكود الدولة (مثال: 2010xxxxxxxx).');
    targetJid = `${num}@s.whatsapp.net`;
  } else {
    targetJid = m.sender;
  }

  await m.reply('⏳ جاري الاستعلام عن الحساب...');

  const info = await joinandsus(conn, targetJid);

  if (info === "error") {
    return m.reply('❌ حصل خطأ أثناء الاستعلام (ممكن الـ queryId اتغير من واتساب أو فيه مشكلة اتصال).');
  }

  if (!info) {
    return m.reply('❌ مفيش بيانات متاحة للحساب ده.');
  }

  const formatBool = (val) => val === true ? 'نعم ⚠️' : val === false ? 'لا ✅' : 'غير معروف';

  let msg =
    `🔍 *نتيجة الاستعلام عن الحساب*\n\n` +
    `👤 *الحساب:* @${targetJid.split('@')[0]}\n` +
    `🚨 *حساب مشبوه:* ${formatBool(info.is_suspect)}\n` +
    `🆕 *حساب جديد:* ${formatBool(info.is_new)}`;

  if (info.join_time) {
    const joinDate = new Date(Number(info.join_time)).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    msg += `\n📅 *تاريخ الإنشاء:* ${joinDate}`;
  }

  await conn.sendMessage(m.chat, { text: msg, mentions: [targetJid] }, { quoted: m });
};

handler.help = ['استعلام <رقم/منشن/رد>'];
handler.tags = ['tools'];
handler.command = /^(استعلام|فحص|checkwa)$/i;

export default handler;
