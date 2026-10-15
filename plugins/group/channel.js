const handler = async (m, { conn, text }) => {
  if (!text) return m.reply('⚠️ ابعت رابط القناة أو كود الدعوة');

  try {
    const invite = text.includes('https')
      ? text.split('/').pop().split('?')[0]
      : text.trim();
    const res = await conn.newsletterMetadata('invite', invite);
    const meta = res.thread_metadata;
    if (!meta) throw new Error('بيانات القناة غير متاحة');

    const name = meta.name?.text || 'غير معروف';
    const desc = meta.description?.text || 'لا يوجد وصف';
    const subs = meta.subscribers_count || '0';
    const created = meta.creation_time
      ? new Date(parseInt(meta.creation_time) * 1000).toLocaleString('ar-EG')
      : 'غير معروف';
    const status = res.state?.type || 'غير معروف';
    const verify = meta.verification || 'غير معروف';
    const jid = res.id;

    const msg = `📢 *معلومات القناة*

` +
      `👤 الاسم: ${name}
` +
      `👥 المشتركين: ${subs}
` +
      `📅 تاريخ الإنشاء: ${created}
` +
      `📡 الحالة: ${status}
` +
      `✔️ التوثيق: ${verify}

` +
      `📝 الوصف:\n${desc}`;

    const img = meta.preview?.direct_path
      ? `https://mmg.whatsapp.net${meta.preview.direct_path}`
      : 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg';

    await conn.sendButton(m.chat, {
      imageUrl: img,
      bodyText: msg,
      footerText: '𝑳𝑰𝑮𝑯𝑻 ¦🩸¦ 𝑩𝑶𝑻',
      buttons: [{
        name: 'cta_copy',
        params: {
          display_text: '📋 انسخ ايدي القناة',
          copy_code: jid
        }
      }],
      mentions: [m.sender],
      newsletter: { name, jid },
      interactiveConfig: {
        buttons_limits: 1,
        list_title: name,
        button_title: 'Options',
        canonical_url: 'https://x.com'
      }
    }, { quoted: m });
  } catch (error) {
    console.error(error);
    await m.reply('❌ حصل خطأ، تأكد من الرابط أو الكود');
  }
};

handler.command = ['قناة'];
handler.usage = ['قناة <رابط القناة أو كود الدعوة>'];
handler.category = 'group';

export default handler;
