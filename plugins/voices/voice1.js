import { applyVoiceFilter } from "../../system/mediaService.js";

const run = async (m, { conn, command }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || '';

  if (!mime || !/audio|video/i.test(mime)) {
    return m.reply('*رد على المقطع الصوتي لتغيير نبرة صوته 📣*');
  }

  const numMatch = String(command || '').match(/^فويس(\d+)$/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 0;
  if (!num || num < 1 || num > 30) {
    return m.reply('❌ أمر غير معروف (المتاح فويس1 إلى فويس30)');
  }

  await m.react?.("⏳");
  try {
    const media = await q.download();
    if (!media || !Buffer.isBuffer(media) || !media.length) {
      return m.reply("❌ تعذر تحميل المقطع الصوتي");
    }
    if (media.length > 15 * 1024 * 1024) {
      return m.reply("❌ حجم المقطع الصوتي كبير جداً (الحد الأقصى 15 ميجا)");
    }

    const audioBuffer = await applyVoiceFilter(media, num);
    await m.react?.("✅");
    await conn.sendMessage(m.chat, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: false
    }, { quoted: m });
  } catch (e) {
    console.error("voice1:", e?.message || e);
    await m.react?.("❌");
    return m.reply("❌ تعذر تغيير نبرة الصوت، تأكد أن الرسالة مقطع صوتي صالح");
  }
};

const cmd = ["فويس1", "فويس2", "فويس3", "فويس4", "فويس5", "فويس6", "فويس7", "فويس8", "فويس9", "فويس10", "فويس11", "فويس12", "فويس13", "فويس14", "فويس15", "فويس16", "فويس17", "فويس18", "فويس19", "فويس20", "فويس21", "فويس22", "فويس23", "فويس24", "فويس25", "فويس26", "فويس27", "فويس28", "فويس29", "فويس30"];
run.usage = cmd;
run.command = cmd;
run.category = "voices";

export default run;
