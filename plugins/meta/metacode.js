/*
  ═══════════════════════════════════════════
  🧑‍💻 كارت كود ميتا AI — كتل كود بصيغة ميتا AI (بلوكات كود ملوّنة رسمية)
  بروتوكول richResponse messageType=5 (codeMetadata) من إطار meowsab نفسه.

  الأمر:
    .ميتا_كود <اللغة> <الكود>
    مثال:  .ميتا_كود js console.log("مرحبا")
    .ميتا_كود py print("hello")
  ═══════════════════════════════════════════
*/
const cooldown = new Map();
const COOLDOWN_MS = 4 * 1000;

const handler = async (m, { conn, text }) => {
  try {
    const raw = (text || '').trim();
    const sp = raw.indexOf(' ');
    const lang = sp === -1 ? 'js' : raw.slice(0, sp).replace(/[^a-z0-9_+#]/gi, '').toLowerCase() || 'js';
    const code = sp === -1 ? '' : raw.slice(sp + 1).trim();
    if (!code) {
      await conn.sendMessage(m.chat, {
        text: '✍️ الاستخدام:\n.ميتا_كود js console.log("مرحبا")\n.ميتا_كود py print("hello")'
      }, { quoted: m });
      return;
    }
    const last = cooldown.get(m.chat) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    cooldown.set(m.chat, Date.now());

    if (typeof conn?.sendAiMessage === 'function') {
      await conn.sendAiMessage(m.chat, [{ type: 5, codeMetadata: { language: lang, code } }]);
      return;
    }
    // احتياطي: بلوك كود عادي بصيغة ماركداون
    await conn.sendMessage(m.chat, { text: '```' + lang + '\n' + code + '\n```' }, { quoted: m });
  } catch (e) {
    console.error('❌ [ميتا_كود]', e?.message || e);
    await conn.sendMessage(m.chat, { text: '❌ حصلت مشكلة في إرسال كارت الكود.' }, { quoted: m });
  }
};

handler.command = ['ميتا_كود', 'ميتاكود'];
handler.usage = ['.ميتا_كود <لغة> <كود>'];
handler.category = 'ai';
handler.cooldown = 4;

export default handler;
