const handler = async (m, { conn }) => {
    const q = m.quoted || m;
    const mime = q.mimetype || '';

    if (!/image/.test(mime)) {
        return m.reply('*🖼️  رد على صورة لتغيير صورة البوت*');
    }

    const jid = conn.user.id.split(":")[0] + "@s.whatsapp.net";

    try {
        const media = await q.download();
        await conn.updateProfilePicture(jid, media);
        m.reply('*✅  تم تغيير صورة بروفايل البوت*');
    } catch (error) {
        console.error(error);
        m.reply(error.message);
    }
};

handler.usage = ["وضع"];
handler.category = "owner";
handler.command = ["وضع", "botpp"];
handler.owner = true;

export default handler;
