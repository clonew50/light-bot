/*
  ═══════════════════════════════════════════
  🚫 حظر/طرد — مع أزرار تأكيد
  الأمر: .ban / .حظر / .طرد @مستخدم [سبب]
  ═══════════════════════════════════════════
*/

const pendingBan = new Map()

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()

    if (!isAdmin) return m.reply('❌ للأدمن فقط')
    if (!isBotAdmin) return m.reply('❌ البوت بحاجة لصلاحية أدمن')

    const subCmd = args[0]?.toLowerCase()
    const mentioned = m.mentionedJid?.[0] || (args[1]?.startsWith('@') ? args[1].replace('@', '') + '@s.whatsapp.net' : null)
    const reason = text?.replace(/^(حظر|ban|طرد)\s*/i, '').replace(/^@?\w+\s*/, '').trim() || 'بدون سبب'

    // قائمة المحظورين
    if (subCmd === 'قائمة' || subCmd === 'list') {
      // يمكن إضافة تخزين للحظر هنا
      return m.reply('📋 *قائمة المحظورين:* (الميزة قيد التطوير)')
    }

    // إلغاء حظر
    if (subCmd === 'الغاء' || subCmd === 'unban' || subCmd === 'رفع') {
      if (!mentioned) return m.reply('❌ منشن المستخدم: `.ban الغاء @user`')
      // يمكن إضافة منطق إلغاء الحظر هنا
      return m.reply(`✅ *تم إلغاء حظر المستخدم* (يتطلب تخزين القائمة)`)
    }

    if (!mentioned) {
      return conn.sendMessage(m.chat, {
        text: `🚫 *حظر/طرد عضو*\\n\\n` +
          `منشن المستخدم مع السبب:\\n\`${usedPrefix}ban @user سبام\`\\n\\n` +
          `⚠️ *تحذير:* هذا الإجراء لا يمكن التراجع عنه بسهولة`,
        footer: 'LIGHT BOT • Admin',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🚫 طرد', id: `${usedPrefix}ban @` } },
          { name: 'quick_reply', params: { display_text: '📋 قائمة', id: `${usedPrefix}ban قائمة` } },
          { name: 'quick_reply', params: { display_text: '❌ إلغاء', id: `${usedPrefix}ban الغاء @` } }
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

    // طلب تأكيد
    const confirmKey = `${m.chat}-${mentioned}-${sender}`
    pendingBan.set(confirmKey, { mentioned, reason, byUser, user, expires: now + 30000 })

    await conn.sendMessage(m.chat, {
      text: `⚠️ *تأكيد طرد عضو*\\n\\n` +
        `👤 المستخدم: @${mentioned.split('@')[0]} (${user})\\n` +
        `📝 السبب: ${reason}\\n` +
        `👮 بواسطة: ${byUser}\\n\\n` +
        `⏳ لديك 30 ثانية للتأكيد`,
      mentions: [mentioned],
      buttons: [
        { name: 'quick_reply', params: { display_text: '✅ تأكيد الطرد', id: `.ban تأكيد ${confirmKey}` } },
        { name: 'quick_reply', params: { display_text: '❌ إلغاء', id: `.ban إلغاء ${confirmKey}` } }
      ],
      contextInfo: { mentionedJid: [mentioned, sender] }
    }, { quoted: m })

  } catch (e) {
    console.error('ban:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل تنفيذ الأمر')
  }
}

// معالج التأكيد (يتم استدعاؤه عبر quick_reply)
const handleConfirm = async (m, { conn, args }) => {
  const action = args[0]
  const key = args.slice(1).join(' ')
  const pending = pendingBan.get(key)

  if (!pending) return m.reply('❌ طلب منتهي الصلاحية أو غير موجود')

  if (action === 'تأكيد' || action === 'confirm') {
    try {
      await conn.groupParticipantsUpdate(m.chat, [pending.mentioned], 'remove')
      pendingBan.delete(key)
      await m.reply(
        `🚫 *تم طرد العضو بنجاح*\\n\\n` +
        `👤 @${pending.mentioned.split('@')[0]} (${pending.user})\\n` +
        `📝 السبب: ${pending.reason}\\n` +
        `👮 بواسطة: ${pending.byUser}`
      )
      await m.react('🚫')
    } catch (e) {
      await m.reply('❌ فشل الطرد (البوت ليس أدمن أو خطأ في الصلاحيات)')
    }
  } else {
    pendingBan.delete(key)
    await m.reply('❌ تم إلغاء عملية الطرد')
  }
}

// دمج معالج التأكيد
const originalHandler = handler
handler.command = ['ban', 'حظر', 'طرد', 'banconfirm']
handler.usage = ['ban @user [سبب]', 'ban قائمة', 'ban الغاء @user']
handler.category = 'admin'
handler.group = true
handler.admin = true
handler.botAdmin = true

// تصدير دالة التأكيد للاستخدام الداخلي
export { handleConfirm as confirmBan }
export default handler