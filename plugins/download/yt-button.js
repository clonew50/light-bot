import axios from 'axios';

const handler = async (m, { conn, text }) => {
    if (!text) return m.reply("*اكتب اسم الاغنية بعد الامر 📼*");

    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
        const { data: html } = await axios.get(searchUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' }
        });

        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (!match) return m.reply("❌ لم يتم العثور على نتائج");

        const videoId = match[1];
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        let title = text;
        let image = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        try {
            const oembed = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, { timeout: 10000 });
            title = oembed.data?.title || title;
            image = oembed.data?.thumbnail_url || image;
        } catch {}

        await conn.sendButtonNormal(m.chat, {
            media: { url: image },
            mediaType: 'image',
            caption: `${title}`,
            footer: "𝒀𝑶𝑼𝑻𝑼𝑩𝑬 𝑩𝑶𝑾𝑵𝑳𝑶𝑨𝑫",
            buttons: [
                { name: "quick_reply", params: { display_text: "🎼 ╎ تـحـمـيـل صـوت", id: `.يوت_اغنيه ${videoUrl}` } },
                { name: "quick_reply", params: { display_text: "🎬 ╎ تـحـمـيـل فـيـديـو", id: `.يوتيوب ${videoUrl}` } }
            ],
            mentions: [m.sender]
        }, m);
    } catch (e) {
        console.error(e?.message || e);
        m.reply("❌ تعذر البحث في يوتيوب، جرب تاني بعد شوية");
    }
};

handler.usage = ["فيديو", "اغنيه", "شغل"];
handler.category = "downloads";
handler.command = ["اغنيه", "فيديو", "شغل", "play", "video"];

export default handler;