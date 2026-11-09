import axios from "axios";
import FormData from "form-data";
import { Scrapy, Utils } from "meowsab";
import { uploadToQuax } from "../../system/utils.js";

const run = async (m, { conn, bot, command }) => {
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || '';

    if (!mime) return m.reply('*رد على المقطع الصوتي لتغيير نبرة صوته 📣*');
    await m.react("⏳")

    let seconds;
    let link;
    try {
    const media = await q.download();
    link = await uploadToQuax(media);
    ({ data: { seconds } } = await Utils.duration(link));
    } catch (e) {
      return m.reply("❌ تعذر تجهيز الصوت، جرب تاني بعد شوية");
    }

    if (seconds > 20) return m.reply("مينفعش فوق 20 ثانيه");
    
    let num;
    switch (command) {
        case "فويس1":
            num = 1;
            break;
        case "فويس2":
            num = 2;
            break;
        case "فويس3":
            num = 3;
            break;
        case "فويس4":
            num = 4;
            break;
        case "فويس5":
            num = 5;
            break;
        case "فويس6":
            num = 6;
            break;
        case "فويس7":
            num = 7;
            break;
        case "فويس8":
            num = 8;
            break;
        case "فويس9":
            num = 9;
            break;
        case "فويس10":
            num = 10;
            break;
        case "فويس11":
            num = 11;
            break;
        case "فويس12":
            num = 12;
            break;
        case "فويس13":
            num = 13;
            break;
        case "فويس14":
            num = 14;
            break;
        case "فويس15":
            num = 15;
            break;
        case "فويس16":
            num = 16;
            break;
        case "فويس17":
            num = 17;
            break;
        case "فويس18":
            num = 18;
            break;
        case "فويس19":
            num = 19;
            break;
        case "فويس20":
            num = 20;
            break;
        case "فويس21":
            num = 21;
            break;
        case "فويس22":
            num = 22;
            break;
        case "فويس23":
            num = 23;
            break;
        case "فويس24":
            num = 24;
            break;
        case "فويس25":
            num = 25;
            break;
        case "فويس26":
            num = 26;
            break;
        case "فويس27":
            num = 27;
            break;
        case "فويس28":
            num = 28;
            break;
        case "فويس29":
            num = 29;
            break;
        case "فويس30":
            num = 30;
            break;
        default:
            return m.reply("❌ أمر غير معروف");
    }
    
    let audioBuffer;
    try {
    const result = await Scrapy.VoiceChange({ url: link, num: num.toString() });
    audioBuffer = Buffer.from(result.data.audio, 'base64');
    } catch (e) {
      return m.reply("❌ تعذر تغيير نبرة الصوت، جرب تاني بعد شوية");
    }
    await m.react("✅")
    await conn.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: false
    }, { quoted: m });
};
const cmd = ["فويس1", "فويس2", "فويس3", "فويس4", "فويس5", "فويس6", "فويس7", "فويس8", "فويس9", "فويس10", "فويس11", "فويس12", "فويس13", "فويس14", "فويس15", "فويس16", "فويس17", "فويس18", "فويس19", "فويس20", "فويس21", "فويس22", "فويس23", "فويس24", "فويس25", "فويس26", "فويس27", "فويس28", "فويس29", "فويس30"];
run.usage = cmd
run.command = cmd
run.category = "voices";

export default run;

