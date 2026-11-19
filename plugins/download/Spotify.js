import { resolveSpotifyTrack } from "../../system/mediaService.js";
import { getDownload } from "./yt.js";

let handler = async (m, { conn, text }) => {
  if (!text) {
    return m.reply("مثال: `.سبوتيفاي https://open.spotify.com/track/3XiolLAtcY6wi28QyZ9vDO`");
  }
  await m.react("⏳").catch(() => {});

  try {
    const track = await resolveSpotifyTrack(text.trim());
    if (!track?.videoId) {
      return m.reply("❌ تعذر العثور على مقطع الصوت المقابل لهذا الرابط");
    }

    const media = await getDownload(track.videoId, true);
    if (!media?.url) {
      return m.reply("❌ حصلت مشكلة في جلب ملف الصوت، تأكد من الرابط");
    }

    const cleanName = String(track.name || "spotify_track").replace(/[\/:*?"<>|]/g, " ").trim();
    const ext = media.fileNameExt || "m4a";

    await conn.sendMessage(m.chat, {
      audio: { url: media.url },
      mimetype: media.mimeType || "audio/mp4",
      fileName: `${cleanName}.${ext}`,
      contextInfo: track.thumbnail
        ? {
            externalAdReply: {
              title: track.name,
              body: "Spotify Audio • LIGHT BOT",
              thumbnailUrl: track.thumbnail,
              sourceUrl: text.trim(),
              mediaType: 1
            }
          }
        : undefined
    }, { quoted: m });

    await m.react("✅").catch(() => {});
  } catch (e) {
    console.error("spotify:", e?.message || e);
    await m.react("❌").catch(() => {});
    return m.reply(`❌ تعذر جلب الأغنية: ${e?.message || "جرب تاني بعد شوية"}`);
  }
};

handler.usage = ["سبوتيفاي"];
handler.command = ["سبوتيفاي", "spotify"];
handler.category = "downloads";

export default handler;