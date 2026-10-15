// ─── plugins/quran.js ───
// 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻 - Holy Quran Plugin 🕋

import axios from 'axios';

const HEADER = "❐═━━━═╊⊰🩸⊱╉═━━━═❐";
const QURAN_COVER = 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg';

const cleanContext = (jid) => ({
    mentionedJid: [jid],
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363405545946827@newsletter',
        newsletterName: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
        serverMessageId: 0
    }
});

const handler = async (m, { conn, text, usedPrefix, command }) => {
    const args = text ? text.split('|') : [];

    // ─── المرحلة 2: تحميل وإرسال السورة ───
    if (args.length === 4 && args[0] === 'getsurah') {
        const surahNum = args[1];
        const surahName = args[2];
        const ayahsCount = args[3];

        m.react('⏳');
        m.reply(`${HEADER}\n🎙️ *جاري تحميل سورة:* ${surahName}\n📊 *عدد الآيات:* ${ayahsCount}\n📖 *القارئ:* مشاري العفاسي\n${HEADER}`);

        try {
            const formattedNumber = surahNum.padStart(3, '0');
            const audioUrl = `https://server8.mp3quran.net/afs/${formattedNumber}.mp3`;

            await conn.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `سورة_${surahName}.mp3`,
                contextInfo: cleanContext(m.sender)
            }, { quoted: m });

            m.react('✅');
        } catch (e) {
            console.log(e.message || e);
            m.react('❌');
            throw `${HEADER}\n❌ *حدث خطأ أثناء تحميل السورة.*\n${HEADER}`;
        }
        return;
    }

    // ─── المرحلة 1: جلب الفهرس وعرض قائمة السور ───
    m.react('🕋');

    try {
        const res = await axios.get("https://api.alquran.cloud/v1/surah");
        if (!res.data || res.data.code !== 200) throw new Error("API Offline");

        const surahs = res.data.data;

        // بحث عن سورة محددة
        if (text) {
            const search = surahs.find(s => 
                s.name.includes(text) || 
                s.englishName.toLowerCase().includes(text.toLowerCase()) || 
                s.number == text
            );

            if (search) {
                const rows = [{
                    title: `سورة ${search.name}`,
                    description: `رقمها: ${search.number} | آياتها: ${search.numberOfAyahs}`,
                    id: `${usedPrefix + command} getsurah|${search.number}|${search.name}|${search.numberOfAyahs}`
                }];

                const sections = [{ title: 'النتائج 🕋', rows }];
                const caption = `${HEADER}\n🔍 *تم العثور على سورة:* ${search.name} 🕌\n${HEADER}`;

                await conn.sendButtonNormal(m.chat, {
                    media: { url: QURAN_COVER },
                    mediaType: 'image',
                    caption: caption,
                    buttons: [{
                        name: "single_select",
                        params: {
                            title: "🍥 اضغط للتحميل",
                            sections: sections
                        }
                    }],
                    mentions: [m.sender],
                    contextInfo: cleanContext(m.sender)
                }, m);

                return;
            }
        }

        // عرض قائمة المصحف الكامل
        const rows = surahs.slice(0, 114).map((s) => ({
            title: `🕋 ${s.number}. سورة ${s.name}`,
            description: `عدد الآيات: ${s.numberOfAyahs} | ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
            id: `${usedPrefix + command} getsurah|${s.number}|${s.name}|${s.numberOfAyahs}`
        }));

        const sections = [{ title: 'اختر السورة 📚', rows }];
        const caption = `${HEADER}\n🕋 *المصحف الصوتي الكامل*\n\n` +
            `*_اختر السورة التي تريد تحميلها من القائمة 👇_*\n` +
            `*_القارئ: مشاري العفاسي 🎙️_*\n${HEADER}`;

        await conn.sendButtonNormal(m.chat, {
            media: { url: QURAN_COVER },
            mediaType: 'image',
            caption: caption,
            buttons: [{
                name: "single_select",
                params: {
                    title: "🍥 فهرس السور",
                    sections: sections
                }
            }],
            mentions: [m.sender],
            contextInfo: cleanContext(m.sender)
        }, m);

    } catch (e) {
        console.log(e.message || e);
        m.react('❌');
        throw `${HEADER}\n❌ *حدث خطأ أثناء جلب قائمة السور.*\n${HEADER}`;
    }
};

handler.usage = ["سورة", "قرآن"];
handler.category = "islamic";
handler.command = ["سورة", "سور", "قران", "quran"];

export default handler;
