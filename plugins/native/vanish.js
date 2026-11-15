/*
  ═══════════════════════════════════════════
  ⏳ رسالة تختفي (self-deleting message)
  بيبعت رسالة قصيرة من البوت، وبعد ثانية بيعمل revoke لنفس الرسالة
  (المفتاح اللي رجع من sendMessage نفسه — مش أي رسالة تانية).

  الأوامر:
    .اختفاء <نص>
    .vanish <نص>
  ═══════════════════════════════════════════
*/
const DEFAULT_TEXT = '⏳ الرسالة دي هتختفي بعد ثانية.';
const DEFAULT_DELAY_MS = 1000;

const say = async (m, text) => {
  try {
    if (typeof m?.reply === 'function') return await m.reply(text);
    return undefined;
  } catch {
    return undefined;
  }
};

const handler = async (m, ctx = {}) => {
  const { conn } = ctx;
  if (!conn?.sendMessage) {
    await say(m, '❌ خدمة الإرسال غير متاحة في هذا الاتصال.');
    return undefined;
  }

  const text = String(ctx.text ?? (ctx.args || []).join(' ')).trim() || DEFAULT_TEXT;
  const delay = Math.max(0, Number(ctx.vanishDelayMs ?? DEFAULT_DELAY_MS) || DEFAULT_DELAY_MS);

  try {
    // الرسالة اللي هنمسحها لازم تكون رسالتنا إحنا (fromMe) — المفتاح راجع من
    // نفس عملية الإرسال، فمفيش أي احتمال نمسح رسالة مش بتاعتنا.
    const sent = await conn.sendMessage(m.chat, { text }, { quoted: m });
    const key = sent?.key || sent;
    if (!key?.id) {
      await say(m, '❌ تعذّر إرسال الرسالة، فمفيش حاجة تختفي.');
      return undefined;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));

    const revokeKey = {
      remoteJid: key.remoteJid || m.chat,
      fromMe: true,
      id: key.id
    };
    await conn.sendMessage(m.chat, { delete: revokeKey });
    return revokeKey;
  } catch (e) {
    console.error('❌ [اختفاء]', e?.message || e);
    await say(m, '❌ حصلت مشكلة في إرسال الرسالة المؤقتة.');
    return undefined;
  }
};

handler.command = ['اختفاء', 'vanish'];
handler.usage = ['.اختفاء <نص>'];
handler.category = 'tools';
handler.cooldown = 3;

export default handler;