const handler = async (m, { conn, text }) => {
    if (!text) return m.reply("*اكتب اسم الاغنية بعد الامر 📼*");
    
    const res = await fetch(`https://emam-api.web.id/home/sections/Search/api/YouTube/search?q=${text}`);
    const { data } = await res.json();
    const { title, image, timestamp: time, url } = data[0];

    await conn.sendButton(m.chat, {
        imageUrl: image,
        bodyText: `${title} ╎ ${time}`,
        footerText: "𝒀𝑶𝑼𝑻𝑼𝑩𝑬 𝑩𝑶𝑾𝑵𝑳𝑶𝑨𝑫",
        buttons: [
            { name: "quick_reply", params: { display_text: "🎼 ╎ تـحـمـيـل صـوت", id: `.يوت_اغنيه ${url}` } },
            { name: "quick_reply", params: { display_text: "🎬 ╎ تـحـمـيـل فـيـديـو", id: `.يوتيوب ${url}` } }
        ],
        mentions: [m.sender],
        newsletter: { name: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳", jid: "120363405545946827@newsletter" },
        interactiveConfig: { buttons_limits: 10, list_title: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻", button_title: "𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻", canonical_url: url }
    }, m);
};

handler.usage = ["فيديو", "اغنيه", "شغل"];
handler.category = "downloads";
handler.command = ["اغنيه", "فيديو", "شغل", "play", "video"];

export default handler;