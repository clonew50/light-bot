const handler = async (m, { conn, text }) => {
  try {
    let invite = '';
    let metadata;

    if (text) {
      const match = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
      if (!match) return m.reply('❌ ابعت رابط دعوة صحيح أو اكتب الأمر داخل الجروب.');
      invite = match[1];
      metadata = await conn.groupGetInviteInfo(invite);
    } else {
      if (!m.isGroup) return m.reply('❌ اكتب الرابط بعد الأمر أو استخدمه داخل جروب.');
      metadata = await conn.groupMetadata(m.chat);
      try {
        invite = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`;
      } catch {
        invite = 'غير متوفر';
      }
    }

    const name = metadata.subject || 'غير معروف';
    const id = metadata.id || m.chat;
    const owner = metadata.owner || metadata.creator || 'غير معروف';
    const members = metadata.size || metadata.participants?.length || 0;

    const msg = `📌 *معلومات المجموعة*

` +
      `👥 الاسم: ${name}
` +
      `🆔 الايدي: ${id}
` +
      `👑 المالك: ${owner}
` +
      `👤 الأعضاء: ${members}
` +
      `🔗 رابط الدعوة:\n${invite}`;

    await conn.sendButton(m.chat, {
      imageUrl: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg',
      bodyText: msg,
      footerText: '𝑳𝑰𝑮𝑯𝑻 ¦🩸¦ 𝑩𝑶𝑻',
      buttons: [
        {
          name: 'cta_copy',
          params: { display_text: '📋 انسخ ايدي المجموعة', copy_code: id }
        },
        {
          name: 'cta_copy',
          params: { display_text: '🔗 انسخ رابط المجموعة', copy_code: invite }
        }
      ],
      mentions: [m.sender],
      interactiveConfig: {
        buttons_limits: 2,
        list_title: name,
        button_title: 'Group Info',
        canonical_url: 'https://x.com'
      }
    }, { quoted: m });
  } catch (error) {
    console.error(error);
    await m.reply('❌ حدث خطأ أثناء جلب معلومات المجموعة');
  }
};

handler.command = ['اي-دي', 'جروب_ايدي'];
handler.usage = ['اي-دي [رابط دعوة]'];
handler.category = 'group';

export default handler;
