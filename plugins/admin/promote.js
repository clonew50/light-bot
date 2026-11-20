/*
  ═══════════════════════════════════════════
  ⬆️ ترقية/تنزيل أدمن — بأزرار صلاحيات
  الأمر: .promote / .ترقية @مستخدم
  .demote / .تنزيل @مستخدم
  ═══════════════════════════════════════════
*/

const PERMISSIONS = [
  { key: 'admin', name: '👑 أدمن كامل', desc: 'جميع الصلاحيات' },
  { key: 'delete', name: '🗑️ حذف الرسائل', desc: 'يمكنه حذف رسائل الآخرين' },
  { key: 'add', name: '➕ إضافة أعضاء', desc: 'يمكنه دعوة أعضاء جدد' },
  { key: 'remove', name: '➖ طرد أعضاء', desc: 'يمكنه طرد الأعضاء' },
  { key: 'invite', name: '🔗 رابط دعوة', desc: 'يمكنه إرسال رابط المجموعة' },
  { key: 'pin', name: '📌 تثبيت رسائل', desc: 'يمكنه تثبيت الرسائل' },
  { key: 'edit', name: '✏️ تعديل معلومات', desc: 'يمكنه تغيير الاسم/الوصف/الصورة' },
]

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender, command }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()

    if (!isAdmin) return m.reply('❌ للأدمن فقط')
    if (!isBotAdmin) return m.reply('❌ البوت بحاجة لصلاحية أدمن')

    const isPromote = command === 'promote' || command === 'ترقية'
    const actionAr = isPromote ? 'ترقية' : 'تنزيل'
    const actionEn = isPromote ? 'Promote' : 'Demote'

    const mentioned = m.mentionedJid?.[0] || (args[0]?.startsWith('@') ? args[0].replace('@', '') + '@s.whatsapp.net' : null)

    if (!mentioned) {
      return conn.sendMessage(m.chat, {
        text: `⬆️ *${actionAr} إلى أدمن*\\n\\n` +
          `منشن المستخدم:\\n\`${usedPrefix}${command} @user\`\\n\\n` +
          `سيتم منح صلاحيات الأدمن الأساسية`,
        footer: 'LIGHT BOT • Admin',
        buttons: [
          { name: 'quick_reply', params: { display_text: `${actionAr}`, id: `${usedPrefix}${command} @` } }
        ]
      }, { quoted: m })
    }

    // لا يمكن ترقية البوت نفسه
    if (mentioned === conn.user.jid) return m.reply(`❌ لا يمكن ${actionAr} البوت!`)

    const groupMeta = await conn.groupMetadata(m.chat)
    const targetIsAdmin = groupMeta.participants.find(p => p.id === mentioned && p.admin)

    if (isPromote && targetIsAdmin) return m.reply('✅ هذا المستخدم أدمن بالفعل')
    if (!isPromote && !targetIsAdmin) return m.reply('❌ هذا المستخدم ليس أدمن')


    const user = await conn.getName(mentioned).catch(() => mentioned.split('@')[0])
    const byUser = await conn.getName(sender).catch(() => sender.split('@')[0])

    try {
      if (isPromote) {
        await conn.groupParticipantsUpdate(m.chat, [mentioned], 'promote')
        await m.react('⬆️')
        await m.reply(
          `⬆️ *تم ${actionAr} العضو بنجاح*\\n\\n` +
          `👤 @${mentioned.split('@')[0]} (${user})\\n` +
          `👮 بواسطة: ${byUser}\\n\\n` +
          `✅ حصل على صلاحيات: حذف، إضافة، طرد، دعوة، تثبيت، تعديل`
        )
      } else {
        await conn.groupParticipantsUpdate(m.chat, [mentioned], 'demote')
        await m.react('⬇️')
        await m.reply(
          `⬇️ *تم ${actionAr} الأدمن بنجاح*\\n\\n` +
          `👤 @${mentioned.split('@')[0]} (${user})\\n` +
          `👮 بواسطة: ${byUser}\\n\\n` +
          `🔻 تمت إزالة جميع صلاحيات الأدمن`
        )
      }
    } catch (e) {
      await m.react('❌')
      await m.reply(`❌ فشل ${actionAr} (تحقق من صلاحيات البوت)`)
    }

  } catch (e) {
    console.error('promote/demote:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل تنفيذ الأمر')
  }
}

handler.command = ['promote', 'ترقية', 'demote', 'تنزيل', 'adminup', 'admindown']
handler.usage = ['promote @user', 'demote @user']
handler.category = 'admin'
handler.group = true
handler.admin = true
handler.botAdmin = true
export default handler