import { searchPinterestImages, searchYouTubeEdits } from "../../system/mediaService.js";
import { getDownload } from "../download/yt.js";

const FOOTER = '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻';

async function handler(m, { conn, args, usedPrefix, prefix, command }) {
  const pfx = usedPrefix || prefix || '.';
  const input = args.join(' ').trim();

  if (command === 'ايديت') {
    if (!input) {
      return m.reply(`✧ *للبحث عن إيديت أو صور أنمي:*\n${pfx}ايديت شانكس`);
    }

    const sections = [{
      title: '❖ اختر نوع الإيديت المطلوب:',
      rows: [
        { title: '🎨 إيديت وصور من بينتريست', description: 'صور وخلفيات إيديت', id: `${pfx}ايديت-بينتر ${input}` },
        { title: '🖋️ إيديت من تيك توك (يوتيوب)', description: 'بحث عن مقاطع تيك توك/شورتس', id: `${pfx}ايديت-تيك ${input}` },
        { title: '🍷 إيديت 4K من يوتيوب', description: 'تحميل أو روابط فيديو يوتيوب', id: `${pfx}ايديت-يوت ${input}` }
      ]
    }];

    const caption =
      `*اختر نوع الإيديت للبحث عن:* _${input}_\n\n` +
      `🎨 \`${pfx}ايديت-بينتر ${input}\`\n` +
      `🖋️ \`${pfx}ايديت-تيك ${input}\`\n` +
      `🍷 \`${pfx}ايديت-يوت ${input}\``;

    try {
      return await conn.sendButtonNormal(m.chat, {
        caption,
        footer: FOOTER,
        buttons: [{ name: 'single_select', params: { title: 'اختر نوع الإيديت 📜', sections } }],
        mentions: [m.sender]
      }, m);
    } catch {
      return m.reply(caption);
    }
  }

  if (!input) {
    return m.reply(`❌ اكتب اسم الشخصية أو الموضوع، مثال:\n\`${pfx}${command} شانكس\``);
  }

  await m.react('⏳').catch(() => {});

  try {
    if (command === 'ايديت-بينتر') {
      const imgs = await searchPinterestImages(`${input} edit aesthetic`, 8);
      if (!imgs.length) return m.reply('❌ لم يتم العثور على صور إيديت مناسبة.');
      const chosen = imgs[Math.floor(Math.random() * Math.min(imgs.length, 6))];
      await conn.sendMessage(m.chat, {
        image: { url: chosen.url },
        caption: `🎨 *إيديت (${input})*\n📌 المصدر: ${chosen.owner}\n${FOOTER}`
      }, { quoted: m });
      await m.react('✅').catch(() => {});
      return;
    }

    const suffix = command === 'ايديت-تيك' ? 'tiktok edit' : '4k edit amv';
    const vids = await searchYouTubeEdits(`${input} ${suffix}`, 5);
    if (!vids.length) {
      return m.reply('❌ لم يتم العثور على فيديوهات إيديت، جرب كلمة بحث أخرى.');
    }

    // محاولة تحميل أول مقطع قصير وإرساله كفيديو مباشر لو أمكن
    const first = vids[0];
    if (first?.id) {
      try {
        const media = await getDownload(first.id, false);
        if (media?.url && media.kind === 'video') {
          await conn.sendMessage(m.chat, {
            video: { url: media.url },
            caption: `🎬 *${first.title}*\n⏱️ ${first.duration || ''} • ${first.url}\n${FOOTER}`
          }, { quoted: m });
          await m.react('✅').catch(() => {});
          return;
        }
      } catch {}
    }

    // احتياطي سريع ومضمون: إرسال قائمة النتائج + أزرار تحميل يوتيوب
    const listText = vids.map((v, i) => `${i + 1}. *${v.title}* (${v.duration || '?'})\n   🔗 ${v.url}`).join('\n\n');
    await conn.sendMessage(m.chat, {
      ...(first?.thumbnail ? { image: { url: first.thumbnail }, caption: `🎬 *نتائج إيديت: ${input}*\n\n${listText}` } : { text: `🎬 *نتائج إيديت: ${input}*\n\n${listText}` }),
      footer: FOOTER,
      buttons: vids.slice(0, 3).map((v, i) => ({
        name: 'quick_reply',
        params: { display_text: `⬇️ تحميل #${i + 1}`, id: `${pfx}يوتيوب ${v.url}` }
      }))
    }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    return m.reply(`❌ تعذر جلب الإيديت: ${e?.message || 'خطأ غير معروف'}`);
  }
}

handler.command = ['ايديت', 'ايديت-يوت', 'ايديت-تيك', 'ايديت-بينتر'];
handler.usage = ['ايديت <نص>'];
handler.category = 'search';
export default handler;
