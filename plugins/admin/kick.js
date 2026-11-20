/*
  ═══════════════════════════════════════════
  👢 طرد سريع — بدون تأكيد
  الأمر: .kick / .طرد @مستخدم [سبب]
  ═══════════════════════════════════════════
*/

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()

    if (!isAdmin) return m.reply('❌ للأدمن فقط')
    if (!isBotAdmin) return m.reply('❌ البوت بحاجة لصلاحية أدمن')

    const mentioned = m.mentionedJid?.[0] || (args[0]?.startsWith('@') ? args[0].replace('@', '') + '@s.whatsapp.net' : null)
    const reason = text?.replace(/^(طرد|kick)\s*/i, '').replace(/^@?\w+\s*/, '').trim() || 'بدون سبب'

    if (!mentioned) {
      return conn.sendMessage(m.chat, {
        text: `👢 *طرد سريع*\\n\\n` +
          `منشن المستخدم:\\n\`${usedPrefix}kick @user سبب\`\\n\\n` +
          `⚡ أسرع من .ban (بدون تأكيد)`,
        footer: 'LIGHT BOT • Admin',
        buttons: [
          { name: 'quick_reply', params: { display_text: '👢 طرد', id: `${usedPrefix}kick @` } }
        ]
      }, { quoted: m })
    }

    // لا يمكن طرد البوت أو الأدمن
    if (mentioned === conn.user.jid) return m.reply('❌ لا يمكن طرد البوت!')
    const groupMeta = await conn.groupMetadata(m.chat)
    const targetIsAdmin = groupMeta.participants.find(p => p.id === mentioned && p.admin)
    if (targetIsAdmin) return m.reply('❌ لا يمكن طرد أدمن آخر')


    const user = await conn.getName(mentioned).catch(() => mentioned.split('@')[0])
    const byUser = await conn.getName(sender).catch(() => sender.split('@')[0])

    try {
      await conn.groupParticipantsUpdate(m.chat, [mentioned], 'remove')
      await m.react('👢')
      await m.reply(
        `👢 *تم طرد العضو*\\n\\n` +
        `👤 @${mentioned.split('@')[0]} (${user})\\n` +
        `📝 السبب: ${reason}\\n` +
        `👮 بواسطة: ${byUser}`
      )
    } catch (e) {
      await m.react('❌')
      await m.reply('❌ فشل الطرد (البوت ليس أدمن أو خطأ في الصلاحيات)')
    }

  } catch (e) {
    console.error('kick:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل تنفيذ الأمر')
  }
}

handler.command = ['kick', 'طرد', 'remove']
handler.usage = ['kick @user [سبب]']
handler.category = 'admin'
handler.group = true
handler.admin = true
handler.botAdmin = true
export default handler