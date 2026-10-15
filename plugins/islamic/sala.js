import axios from 'axios';

const countries = {
    "المغرب": {
        capital: "Rabat",
        code: "MA",
        emoji: "🌍"
    }, 
    "مصر": {
        capital: "Cairo",
        code: "EG",
        emoji: "🇪🇬"
    },
    "السعودية": {
        capital: "Riyadh",
        code: "SA",
        emoji: "🇸🇦"
    },
    "الإمارات": {
        capital: "Abu Dhabi",
        code: "AE",
        emoji: "🇦🇪"
    },
    "الكويت": {
        capital: "Kuwait",
        code: "KW",
        emoji: "🇰🇼"
    },
    "قطر": {
        capital: "Doha",
        code: "QA",
        emoji: "🇶🇦"
    },
    "البحرين": {
        capital: "Manama",
        code: "BH",
        emoji: "🇧🇭"
    },
    "عمان": {
        capital: "Muscat",
        code: "OM",
        emoji: "🇴🇲"
    },
    "الأردن": {
        capital: "Amman",
        code: "JO",
        emoji: "🇯🇴"
    },
    "لبنان": {
        capital: "Beirut",
        code: "LB",
        emoji: "🇱🇧"
    },
    "العراق": {
        capital: "Baghdad",
        code: "IQ",
        emoji: "🇮🇶"
    },
    "اليمن": {
        capital: "Sanaa",
        code: "YE",
        emoji: "🇾🇪"
    },
    "سوريا": {
        capital: "Damascus",
        code: "SY",
        emoji: "🇸🇾"
    },
    "فلسطين": {
        capital: "Jerusalem",
        code: "PS",
        emoji: "🇵🇸"
    },
    "ليبيا": {
        capital: "Tripoli",
        code: "LY",
        emoji: "🇱🇾"
    },
    "تونس": {
        capital: "Tunis",
        code: "TN",
        emoji: "🇹🇳"
    },
    "الجزائر": {
        capital: "Algiers",
        code: "DZ",
        emoji: "🇩🇿"
    },
    "السودان": {
        capital: "Khartoum",
        code: "SD",
        emoji: "🇸🇩"
    },
    "موريتانيا": {
        capital: "Nouakchott",
        code: "MR",
        emoji: "🇲🇷"
    }
};

function convertTo12HourFormat(time) {
    const [hourString, minute] = time.split(':');
    let hour = parseInt(hourString, 10);
    const period = hour >= 12 ? 'مـسـاءً' : 'صـبـاحـاً';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
}

// سياق رسالة صافي تماماً متوافق مع قنواتك ومحمي من الكراش
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

const run = async (m, { text, conn, command }) => {
    // 1️⃣ في حال عدم اختيار دولة: عرض القائمة المستقرة
    if (!text) {
        let countryButtons = Object.keys(countries).map((country) => ({
            title: `${countries[country].emoji} ${country}`,
            description: `عرض مواقيت الصلاة لدولة ${country}`,
            id: `.${command} ${country}`
        }));

        const menuText = `❐═━━━═╊⊰🩸⊱╉═━━━═❐\n*🕋 ┇ مـواقـيـت الـصـلاة*\n\nالمرجو اختيار دولتك لجلب مواقيت الصلاة تلقائياً 📿\n❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

        await conn.sendButtonNormal(m.chat, {
            media: { url: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg" },
            mediaType: 'image',
            caption: menuText,
            buttons: [
                {
                    name: "single_select",
                    params: {
                        title: "🕋 الدول المتوفــــرة",
                        sections: [
                            {
                                title: "اخـتـر بـلـدك :",
                                rows: countryButtons
                            }
                        ]
                    }
                }
            ],
            contextInfo: cleanContext(m.sender)
        }, m);
        return;
    }

    // 2️⃣ جلب البيانات وعرض مواقيت الصلاة للدولة المحددة
    const country = text.trim();
    const countryInfo = countries[country];
    if (!countryInfo) {
        return m.reply('❌ *المعذرة، هذه الدولة غير متوفرة بالقائمة حالياً.*');
    }

    try {
        await m.react("⏳");
        const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(countryInfo.capital)}&country=${countryInfo.code}`);
        const data = response.data.data.timings;
        
        const fajr = convertTo12HourFormat(data.Fajr);
        const dhuhr = convertTo12HourFormat(data.Dhuhr);
        const asr = convertTo12HourFormat(data.Asr);
        const maghrib = convertTo12HourFormat(data.Maghrib);
        const isha = convertTo12HourFormat(data.Isha);

        const resultMessage = `❐═━━━═╊⊰🩸⊱╉═━━━═❐
*🕋 ┇ مـواقـيـت الـصـلاة فـي ${country}*
*📍 ┇ الـعـاصـمـة: ${countryInfo.capital}*
❐═━━━═╊⊰🩸⊱╉═━━━═❐

*🕋 ┇ الـفـجـر ⇇* ${fajr}
*🕋 ┇ الـظـهـر ⇇* ${dhuhr}
*🕋 ┇ الـعـصـر ⇇* ${asr}
*🕋 ┇ الـمـغـرب ⇇* ${maghrib}
*🕋 ┇ الـعـشـاء ⇇* ${isha}

❐═━━━═╊⊰🩸⊱╉═━━━═❐
> *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*`;

        await conn.sendMessage(m.chat, {
            image: { url: "https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg" },
            caption: resultMessage,
            contextInfo: cleanContext(m.sender)
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error('Error fetching prayer times:', error);
        await m.react("❌");
        m.reply('❌ *حدث خطأ أثناء جلب مواقيت الصلاة، يرجى المحاولة لاحقاً.*');
    }
};

run.command = ['مواقيت_الصلاة', 'وقت-اصلاه', 'وقت_الصلاه', 'مواقيت_الصلاه', 'مواقيت', 'اذان', 'الاذان'];
run.usage = ['اذان'];
run.category = 'islamic';

export default run;
