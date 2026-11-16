import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(execFile);

const FFMPEG_TIMEOUT_MS = 120000;            // دقيقتين أقصى مدة للتحويل
const MAX_INPUT_BYTES = 100 * 1024 * 1024;   // حد حجم الفيديو الداخل (100 ميغا)

const toAudio = async (m, { conn }) => {
  const tmp = path.join(process.cwd(), "tmp");
  const video = path.join(tmp, `${Date.now()}.mp4`);
  const audio = path.join(tmp, `${Date.now()}.mp3`);

  try {
    if (!m.quoted) {
      return m.reply("~ رد على فيديو")
    }

    const media = await m.quoted.download();
    if (!Buffer.isBuffer(media) || media.length === 0) {
      return m.reply("❌ ملقتش الفيديو المرفق، جرب تاني.")
    }
    if (media.length > MAX_INPUT_BYTES) {
      return m.reply(
        `❌ الفيديو أكبر من الحد المسموح (${(MAX_INPUT_BYTES / 1024 / 1024).toFixed(0)} ميغا)، جرب فيديو أقصر.`
      )
    }

    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
    fs.writeFileSync(video, media);

    // ffmpeg بمهلة صارمة: العملية المعلّقة بتتقتل بدل ما تعلّ البوت.
    try {
      await execAsync("ffmpeg", ["-i", video, "-vn", "-acodec", "libmp3lame", audio, "-y"], {
        timeout: FFMPEG_TIMEOUT_MS
      });
    } catch (ffErr) {
      if (ffErr?.code === "ERR_CHILD_PROCESS_TIMEOUT" || /timed out/i.test(ffErr?.message || "")) {
        return m.reply("❌ التحويل أخد وقت أطول من اللازم، جرب فيديو أقصر.")
      }
      throw ffErr;
    }

    await conn.sendMessage(m.chat, { audio: fs.readFileSync(audio), mimetype: "audio/mpeg" }, { quoted: m });
  } catch (e) {
    await conn.sendMessage(m.chat, { text: e.message });
  } finally {
    // الملفات المؤقتة تتمسح في كل الحالات (نجاح أو خطأ) بدل ما تتراكم.
    for (const f of [video, audio]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
};

toAudio.usage = ["لصوت"];
toAudio.category = "tools";
toAudio.command = ["لصوت", "tomp3"];
export default toAudio