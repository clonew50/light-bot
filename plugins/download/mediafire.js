import axios from 'axios';

const handler = async (m, { conn, text, command }) => {
  if (!text) throw `*ضع رابط الملف في ميديا فاير بعد الامر 📁*\n\nمثال:\n/${command} https://www.mediafire.com/file/xxxxx/file`;

  m.react('📥');

  try {
    const keyMatch = String(text).match(/mediafire\.com\/file\/([a-zA-Z0-9]+)/i);
    if (!keyMatch) throw '❌ رابط ميديا فاير غير صحيح';

    const quickKey = keyMatch[1];
    const apiUrl = `https://www.mediafire.com/api/1.0/file/get_info.php?quick_key=${quickKey}&response_format=json`;
    const res = await axios.get(apiUrl, { timeout: 20000 });
    const info = res.data?.response?.file_info;
    if (!info) throw '❌ فشل في جلب المعلومات';

    const downloadUrl = info.links?.direct_download || info.links?.normal_download;
    if (!downloadUrl) throw '❌ لم يتم العثور على رابط التحميل';

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: info.mimetype || 'application/octet-stream',
      fileName: info.filename || 'file',
      caption: `${info.filename || 'file'} ~ (${info.filetype || 'file'})`
    }, { quoted: m });

  } catch (e) {
    console.log(e?.message || e);
    m.reply('❌ فشل جلب ملف ميديا فاير');
  }
};
handler.usage = ["ميديافاير"]
handler.category = "downloads";
handler.command = /^(mf|mediafire|ميديافاير)$/i;

export default handler;