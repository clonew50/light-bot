/*
  ═══════════════════════════════════════════
  🔗 روابط الدعوة — Group Invite Links
  الأمر: .رابط_دعوة | .إلغاء_رابط | .انضمام <كود>
  .معلومات_دعوة <كود> | .قبول_دعوة (رد على رسالة دعوة)
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.isGroup && !['انضمام', 'join', 'معلومات_دعوة', 'invite_info'].includes(command)) {
      return m.reply('👥 أوامر الروابط تعمل في المجموعات فقط (إما .انضمام أو .معلومات_دعوة تعمل في الخاص)')
    }

    const jid = m.chat

    switch (command) {
      case 'رابط_دعوة':
      case 'invite_link':
      case 'group_invite_code':
        const code = await conn.groupInviteCode(jid)
        const link = `https://chat.whatsapp.com/${code}`
        m.reply(`🔗 رابط الدعوة:\n${link}\n\nالكود: ${code}`)
        break

      case 'إلغاء_رابط':
      case 'revoke_invite':
      case 'group_revoke_invite':
        const newCode = await conn.groupRevokeInvite(jid)
        const newLink = `https://chat.whatsapp.com/${newCode}`
        m.reply(`🔄 تم إلغاء الرابط القديم وإنشاء جديد:\n${newLink}\n\nالكود الجديد: ${newCode}`)
        break

      case 'انضمام':
      case 'join':
      case 'group_accept_invite':
        if (!text) return m.reply('🔗 الاستخدام: .انضمام <كود_الدعوة>\nمثال: .انضمام AbCdEfGh')
        const inviteCode = text.trim().replace('https://chat.whatsapp.com/', '')
        const joinResult = await conn.groupAcceptInvite(inviteCode)
        m.reply(`✅ تم الانضمام للمجموعة: ${joinResult}`)
        break

      case 'معلومات_دعوة':
      case 'invite_info':
      case 'group_get_invite_info':
        if (!text) return m.reply('🔍 الاستخدام: .معلومات_دعوة <كود_الدعوة>')
        const infoCode = text.trim().replace('https://chat.whatsapp.com/', '')
        const info = await conn.groupGetInviteInfo(infoCode)
        m.reply(`📋 معلومات المجموعة:\n${JSON.stringify(info, null, 2)}`)
        break

      case 'قبول_دعوة':
      case 'accept_invite':
      case 'group_accept_invite_v4':
        if (!m.quoted || !m.quoted.message?.groupInviteMessage) {
          return m.reply('📎 رد على رسالة دعوة مجموعة لقبولها')
        }
        const inviteMsg = m.quoted.message.groupInviteMessage
        const acceptResult = await conn.groupAcceptInviteV4(jid, inviteMsg)
        m.reply(`✅ تم قبول الدعوة والانضمام: ${acceptResult}`)
        break

      default:
        m.reply('❌ أمر غير معروف')
    }
  } catch (e) {
    console.error('group-invites:', e)
    m.reply('❌ فشل العملية')
  }
}

handler.command = [
  'رابط_دعوة', 'invite_link', 'group_invite_code',
  'إلغاء_رابط', 'revoke_invite', 'group_revoke_invite',
  'انضمام', 'join', 'group_accept_invite',
  'معلومات_دعوة', 'invite_info', 'group_get_invite_info',
  'قبول_دعوة', 'accept_invite', 'group_accept_invite_v4'
]
handler.usage = [
  'رابط_دعوة',
  'إلغاء_رابط',
  'انضمام AbCdEfGh',
  'معلومات_دعوة AbCdEfGh',
  'قبول_دعوة (رد على دعوة)'
]
handler.category = 'groups'
handler.description = 'إدارة روابط دعوة المجموعات: جلب، إلغاء، الانضمام، عرض معلومات، قبول دعوة V4'
export default handler