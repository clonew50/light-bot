/*
  ═══════════════════════════════════════════
  📋 معلومات المجموعة — Group Metadata
  الأمر: .معلومات_مجموعة | .قائمة_مجموعات
  .طلبات_انضمام | .قبول_طلب <رقم> | .رفض_طلب <رقم>
  .مؤقت_مجموعة <مدة> | .إضافة_أعضاء <وضع>
  ═══════════════════════════════════════════
*/
const handler = async (m, { conn, text, command }) => {
  try {
    if (!m.isGroup && command !== 'قائمة_مجموعات') {
      return m.reply('👥 هذا الأمر يعمل في المجموعات فقط')
    }

    const jid = m.chat

    switch (command) {
      case 'معلومات_مجموعة':
      case 'group_info':
      case 'metadata': {
        const metadata = await conn.groupMetadata(jid)
        const participants = metadata.participants || []
        const admins = participants.filter(p => p.admin).length
        const members = participants.length

        let msg = `📋 *معلومات المجموعة:*\n`
        msg += `📛 الاسم: ${metadata.subject}\n`
        msg += `🆔 المعرف: ${metadata.id}\n`
        msg += `👑 المالك: ${metadata.owner || 'غير معروف'}\n`
        msg += `👥 الأعضاء: ${members} (مشرفون: ${admins})\n`
        if (metadata.desc) msg += `📝 الوصف: ${metadata.desc}\n`
        if (metadata.ephemeralDuration) {
          const days = metadata.ephemeralDuration / 86400
          msg += `⏳ الرسائل المختفية: ${days} يوم\n`
        }
        msg += `🔒 إرسال المشرفين فقط: ${metadata.announce ? 'نعم' : 'لا'}\n`
        msg += `⚙️ إعدادات المشرفين فقط: ${metadata.restrict ? 'نعم' : 'لا'}\n`
        msg += `➕ إضافة الأعضاء: ${metadata.memberAddMode ? 'الجميع' : 'المشرفون'}\n`
        msg += `✅ موافقة الانضمام: ${metadata.joinApprovalMode ? 'مفعلة' : 'معطلة'}`

        m.reply(msg)
        break
      }

      case 'قائمة_مجموعات':
      case 'groups_list':
      case 'group_fetch_all': {
        const groups = await conn.groupFetchAllParticipating()
        let msg = `📋 *قائمة المجموعات (${Object.keys(groups).length}):*\n\n`
        for (const [gid, meta] of Object.entries(groups)) {
          const admins = meta.participants?.filter(p => p.admin).length || 0
          msg += `• ${meta.subject} (${meta.participants?.length || 0} أعضاء، ${admins} مشرفين)\n  ${gid}\n\n`
        }
        m.reply(msg.slice(0, 4000))
        break
      }

      case 'طلبات_انضمام':
      case 'join_requests':
      case 'group_request_list': {
        const requests = await conn.groupRequestParticipantsList(jid)
        if (!requests?.length) return m.reply('📭 لا توجد طلبات انضمام معلقة')
        let msg = `📥 *طلبات الانضمام (${requests.length}):*\n\n`
        for (const req of requests) {
          msg += `• ${req.jid} — ${new Date(req.requestTimestamp * 1000).toLocaleString('ar')}\n`
        }
        m.reply(msg)
        break
      }

      case 'قبول_طلب':
      case 'approve_request':
      case 'group_approve_request': {
        if (!text) return m.reply('✅ الاستخدام: .قبول_طلب <رقم> أو .قبول_طلب الكل')
        const numbers = text === 'الكل' ? null : text.match(/\d{8,15}/g)
        if (!numbers && text !== 'الكل') return m.reply('❌ رقم غير صالح')

        let requests = await conn.groupRequestParticipantsList(jid)
        if (!requests?.length) return m.reply('📭 لا توجد طلبات')

        const toApprove = text === 'الكل'
          ? requests.map(r => r.jid)
          : requests.filter(r => numbers.includes(r.jid.split('@')[0]))

        if (!toApprove.length) return m.reply('❌ لم يتم العثور على طلبات مطابقة')

        await conn.groupRequestParticipantsUpdate(jid, toApprove, 'approve')
        m.reply(`✅ تم قبول ${toApprove.length} طلب(ات) انضمام`)
        break
      }

      case 'رفض_طلب':
      case 'reject_request':
      case 'group_reject_request': {
        if (!text) return m.reply('❌ الاستخدام: .رفض_طلب <رقم> أو .رفض_طلب الكل')
        const numbers = text === 'الكل' ? null : text.match(/\d{8,15}/g)
        if (!numbers && text !== 'الكل') return m.reply('❌ رقم غير صالح')

        let requests = await conn.groupRequestParticipantsList(jid)
        if (!requests?.length) return m.reply('📭 لا توجد طلبات')

        const toReject = text === 'الكل'
          ? requests.map(r => r.jid)
          : requests.filter(r => numbers.includes(r.jid.split('@')[0]))

        if (!toReject.length) return m.reply('❌ لم يتم العثور على طلبات مطابقة')

        await conn.groupRequestParticipantsUpdate(jid, toReject, 'reject')
        m.reply(`❌ تم رفض ${toReject.length} طلب(ات) انضمام`)
        break
      }

      case 'مؤقت_مجموعة':
      case 'group_ephemeral':
      case 'group_toggle_ephemeral': {
        const durationMap = {
          'إيقاف': 0, 'off': 0, '0': 0,
          '24س': 86400, '24h': 86400, 'يوم': 86400,
          '7أ': 604800, '7d': 604800, 'أسبوع': 604800,
          '90ي': 7776000, '90d': 7776000, '3ش': 7776000
        }
        const durationText = text.trim()
        if (!durationText) return m.reply('⏳ المدد: 24س، 7أ، 90ي، إيقاف')
        const ephemeral = durationMap[durationText]
        if (ephemeral === undefined) return m.reply('❌ مدة غير معروفة')

        await conn.groupToggleEphemeral(jid, ephemeral)
        m.reply(ephemeral === 0 ? '✅ تم تعطيل الرسائل المختفية' : `⏳ تم تفعيل الرسائل المختفية لمدة ${durationText}`)
        break
      }

      case 'إضافة_أعضاء':
      case 'member_add_mode':
      case 'group_member_add_mode': {
        const mode = text.trim().toLowerCase()
        if (!['الجميع', 'all_member_add', 'مشرفون', 'admin_add'].includes(mode)) {
          return m.reply('➕ الأوضاع: الجميع (all_member_add) أو مشرفون (admin_add)')
        }
        const mappedMode = mode === 'الجميع' ? 'all_member_add' : mode === 'مشرفون' ? 'admin_add' : mode
        await conn.groupMemberAddMode(jid, mappedMode)
        m.reply(`➕ تم تعيين إضافة الأعضاء: ${mappedMode === 'all_member_add' ? 'الجميع' : 'المشرفون فقط'}`)
        break
      }

      default:
        m.reply('❌ أمر غير معروف')
    }
  } catch (e) {
    console.error('group-metadata:', e)
    const isAdminError = e?.message?.includes('not-authorized') || e?.message?.includes('admin')
    m.reply(isAdminError ? '❌ تحتاج صلاحيات مشرف' : '❌ فشل العملية')
  }
}

handler.command = [
  'معلومات_مجموعة', 'group_info', 'metadata',
  'قائمة_مجموعات', 'groups_list', 'group_fetch_all',
  'طلبات_انضمام', 'join_requests', 'group_request_list',
  'قبول_طلب', 'approve_request', 'group_approve_request',
  'رفض_طلب', 'reject_request', 'group_reject_request',
  'مؤقت_مجموعة', 'group_ephemeral', 'group_toggle_ephemeral',
  'إضافة_أعضاء', 'member_add_mode', 'group_member_add_mode'
]
handler.usage = [
  'معلومات_مجموعة',
  'قائمة_مجموعات',
  'طلبات_انضمام',
  'قبول_طلب 201001234567',
  'قبول_طلب الكل',
  'رفض_طلب 201001234567',
  'مؤقت_مجموعة 7أ',
  'إضافة_أعضاء الجميع'
]
handler.category = 'groups'
handler.description = 'عرض معلومات المجموعة، قائمة المجموعات، إدارة طلبات الانضمام، الرسائل المختفية، وضع إضافة الأعضاء'
export default handler