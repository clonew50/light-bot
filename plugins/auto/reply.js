export default async function before(m, { conn }) {

  const videos = {
    "لايت": "https://files.catbox.moe/ubs0yg.mp4",
    "بوت": "https://files.catbox.moe/9b6x2n.mp4",
    "تست": "https://files.catbox.moe/k0vxj9.mp4"
  };

  const text = m.text?.trim();

  if (videos[text]) {

    await conn.sendMessage(
      m.chat,
      {
        video: { url: videos[text] },
        ptv: true,
        mimetype: "video/mp4"
      },
      { quoted: m }
    );

    return true;
  }

  return false;
}