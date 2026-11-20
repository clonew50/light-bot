/*
  ═══════════════════════════════════════════
  💸 تحويل عملات — بين المستخدمين
  الأمر: .transfer / .تحويل @مستخدم <مبلغ>
  ═══════════════════════════════════════════
*/

const MIN_TRANSFER = 10
const MAX_TRANSFER = 100000
const FEE_PERCENT = 0.02 // 2% رسوم

const handler = async (m, { conn, text, args, usedPrefix, sender }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const mentioned = m.mentionedJid?.[0] || (args[1]?.startsWith('@') ? args[1].replace('@', '') + '@s.whatsapp.net' : null)
    const amount = parseInt(args[2] || args[1])

    // تهيئة قاعدة البيانات
    if (!global.db) global.db = { users: {} }
    if (!global.db.users[sender]) global.db.users[sender] = { balance: 1000, bank: 0, xp: 0, cookies: 0 }
    if (mentioned && !global.db.users[mentioned]) global.db.users[mentioned] = { balance: 1000, bank: 0, xp: 0, cookies: 0 }

    // تحويل
    if (!subCmd || (mentioned && !isNaN(amount))) {
      if (!mentioned) {
        return conn.sendMessage(m.chat, {
          text: `💸 *تحويل عملات*\\n\\n` +
            `منشن المستخدم والمبلغ:\\n\`${usedPrefix}transfer @user 500\`\\n\\n` +
            `💰 رصيدك: ${global.db.users[sender].balance} عملة\\n` +
            `📋 الحد الأدنى: ${MIN_TRANSFER} | الأقصى: ${MAX_TRANSFER.toLocaleString()}\\n` +
            `💸 رسوم التحويل: ${(FEE_PERCENT * 100).toFixed(0)}%`,
          footer: 'LIGHT BOT • Bank',
          buttons: [
            { name: 'quick_reply', params: { display_text: '💸 تحويل', id: `${usedPrefix}transfer @` } },
            { name: 'quick_reply', params: { display_text: '🏦 بنكي', id: `${usedPrefix}bank` } },
            { name: 'quick_reply', params: { display_text: '📊 رصيدي', id: `${usedPrefix}profile` } }
          ]
        }, { quoted: m })
      }

      if (mentioned === sender) return m.reply('❌ لا يمكنك تحويل العملات لنفسك!')
      if (mentioned === conn.user.jid) return m.reply('❌ لا يمكن تحويل عملات للبوت!')

      if (isNaN(amount) || amount < MIN_TRANSFER) return m.reply(`❌ المبلغ يجب أن يكون ≥ ${MIN_TRANSFER} عملة`)
      if (amount > MAX_TRANSFER) return m.reply(`❌ الحد الأقصى للتحويل: ${MAX_TRANSFER.toLocaleString()} عملة`)

      const senderBal = global.db.users[sender].balance
      const fee = Math.ceil(amount * FEE_PERCENT)
      const total = amount + fee

      if (senderBal < total) return m.reply(`❌ رصيد غير كافي!\\nتحتاج: ${total.toLocaleString()} (${amount.toLocaleString()} + ${fee.toLocaleString()} رسوم)\\nرصيدك: ${senderBal.toLocaleString()}`)


      // تنفيذ التحويل
      global.db.users[sender].balance -= total
      global.db.users[mentioned].balance += amount

      const senderName = await conn.getName(sender).catch(() => sender.split('@')[0])
      const targetName = await conn.getName(mentioned).catch(() => mentioned.split('@')[0])

      await m.react('💸')
      await conn.sendMessage(m.chat, {
        text: `💸 *تم التحويل بنجاح!*\\n\\n` +
          `📤 من: @${sender.split('@')[0]} (${senderName})\\n` +
          `📥 إلى: @${mentioned.split('@')[0]} (${targetName})\\n` +
          `💰 المبلغ: ${amount.toLocaleString()} عملة\\n` +
          `💸 الرسوم: ${fee.toLocaleString()} عملة (${(FEE_PERCENT * 100).toFixed(0)}%)\\n` +
          `📉 رصيدك الجديد: ${global.db.users[sender].balance.toLocaleString()}\\n` +
          `📈 رصيد المستلم: ${global.db.users[mentioned].balance.toLocaleString()}`,
        mentions: [sender, mentioned],
        contextInfo: { mentionedJid: [sender, mentioned] }
      }, { quoted: m })
      return
    }

    // سجل التحويلات
    if (subCmd === 'سجل' || subCmd === 'history' || subCmd === 'logs') {
      return m.reply('📋 *سجل التحويلات:* (الميزة قيد التطوير)')
    }

    // مساعدة
    return conn.sendMessage(m.chat, {
      text: `💸 *أوامر التحويل:*\\n\\n` +
        `\`${usedPrefix}transfer @user 500\` - تحويل 500 عملة\\n` +
        `\`${usedPrefix}transfer سجل\` - عرض السجل\\n\\n` +
        `💰 رصيدك الحالي: ${global.db.users[sender].balance.toLocaleString()} عملة`,
      footer: 'LIGHT BOT • Bank',
      buttons: [
        { name: 'quick_reply', params: { display_text: '💸 تحويل', id: `${usedPrefix}transfer @` } },
        { name: 'quick_reply', params: { display_text: '🏦 بنكي', id: `${usedPrefix}bank` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('transfer:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل التحويل')
  }
}

handler.command = ['transfer', 'تحويل', 'send', 'ارسال']
handler.usage = ['transfer @user <مبلغ>', 'transfer سجل']
handler.category = 'bank'
export default handler