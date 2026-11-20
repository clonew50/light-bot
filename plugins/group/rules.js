/*
  ═══════════════════════════════════════════
  📜 قواعد المجموعة — عرض/تعيين/تثبيت
  الأمر: .rules / .قوانين / .قواعد
  ═══════════════════════════════════════════
*/

if (!global.groupRules) global.groupRules = new Map()

const DEFAULT_RULES = `📜 *قواعد المجموعة*

1️⃣ الاحترام المتبادل obligatoire
2️⃣ ممنوع السبام/الروابط بدون إذن
3️⃣ ممنوع المحتوى المخالف/الإباحي
4️⃣ لا تنشر معلومات شخصية
5️⃣ اتبع تعليمات الأدمن
6️⃣ استخدم اللغة العربية/الإنجليزية فقط
7️⃣ ممنوع الإعلان دون موافقة
8️⃣ كن لطيفاً ومساعداً

⚠️ المخالف يعرض نفسه للطرد/الحظر
👮 الأدمن له الحق في اتخاذ الإجراء المناسب`

function getRules(chatId) {
  if (!global.groupRules.has(chatId)) {
    global.groupRules.set(chatId, {
      text: DEFAULT_RULES,
      pinnedMsgId: null,
      lastUpdated: Date.now(),
      updatedBy: null
    })
  }
  return global.groupRules.get(chatId)
}

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()

    const rules = getRules(m.chat)
    const subCmd = args[0]?.toLowerCase()

    // عرض القواعد
    if (!subCmd || subCmd === 'عرض' || subCmd === 'show') {
      return conn.sendMessage(m.chat, {
        text: rules.text,
        footer: 'LIGHT BOT • Rules',
        buttons: isAdmin ? [
          { name: 'quick_reply', params: { display_text: '✏️ تعديل', id: `${usedPrefix}rules تعديل` } },
          { name: 'quick_reply', params: { display_text: '📌 تثبيت', id: `${usedPrefix}rules تثبيت` } },
          { name: 'quick_reply', params: { display_text: '🔄 افتراضي', id: `${usedPrefix}rules افتراضي` } }
        ] : [
          { name: 'quick_reply', params: { display_text: '📋 نسخة', id: `${usedPrefix}rules نسخ` } }
        ],
        contextInfo: { mentionedJid: [sender] }
      }, { quoted: m })
    }

    // نسخ القواعد
    if (subCmd === 'نسخ' || subCmd === 'copy') {
      return m.reply(`📋 *نسخة القواعد:*\\n\\n\`\`\`\\n${rules.text}\\n\`\`\`\\n\\n(اضغط مطولاً للنسخ)`)
    }

    // تعديل القواعد (للأدمن فقط)
    if (subCmd === 'تعديل' || subCmd === 'edit' || subCmd === 'set') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      const newRules = text?.replace(/^(قوانين|rules|قواعد)\s*(تعديل|edit|set)?\s*/i, '').trim()
      if (!newRules) {
        return conn.sendMessage(m.chat, {
          text: `✏️ *تعديل القواعد*\\n\\n` +
            `اكتب القواعد الجديدة بعد الأمر:\\n` +
            `\`${usedPrefix}rules تعديل قواعد جديدة هنا...\`\\n\\n` +
            `القواعد الحالية:\\n\`${rules.text.slice(0, 200)}...\``,
          footer: 'LIGHT BOT • Rules',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🔄 افتراضي', id: `${usedPrefix}rules افتراضي` } },
            { name: 'quick_reply', params: { display_text: '📋 عرض', id: `${usedPrefix}rules عرض` } }
          ]
        }, { quoted: m })
      }
      rules.text = newRules
      rules.lastUpdated = now
      rules.updatedBy = sender
      return m.reply('✅ تم تحديث القواعد بنجاح')
    }

    // إعادة للأفتراضي
    if (subCmd === 'افتراضي' || subCmd === 'default' || subCmd === 'reset') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      rules.text = DEFAULT_RULES
      rules.lastUpdated = now
      rules.updatedBy = sender
      return m.reply('🔄 تم إعادة القواعد للافتراضية')
    }

    // تثبيت القواعد
    if (subCmd === 'تثبيت' || subCmd === 'pin') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      if (!isBotAdmin) return m.reply('❌ البوت بحاجة لصلاحية أدمن')

      try {
        // إلغاء التثبيت السابق إن وجد
        if (rules.pinnedMsgId) {
          try {
            await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: rules.pinnedMsgId, fromMe: true } })
          } catch {}
        }

        // إرسال وتثبيت
        const sent = await conn.sendMessage(m.chat, {
          text: `📌 *قواعد المجموعة (مثبتة)*\\n\\n${rules.text}`,
          footer: 'LIGHT BOT • Rules'
        })
        rules.pinnedMsgId = sent.key.id
        await m.react('📌')
        return m.reply('📌 تم تثبيت القواعد بنجاح')
      } catch (e) {
        return m.reply('❌ فشل التثبيت (تحقق من صلاحيات البوت)')
      }
    }

    // إلغاء التثبيت
    if (subCmd === 'إلغاء_تثبيت' || subCmd === 'unpin') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      if (!rules.pinnedMsgId) return m.reply('❌ لا توجد قواعد مثبتة')

      try {
        await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: rules.pinnedMsgId, fromMe: true } })
        rules.pinnedMsgId = null
        return m.reply('📌 تم إلغاء تثبيت القواعد')
      } catch {
        return m.reply('❌ فشل إلغاء التثبيت')
      }
    }

    // إضافة قاعدة
    if (subCmd === 'أضف' || subCmd === 'add') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      const newRule = args.slice(1).join(' ')
      if (!newRule) return m.reply('❌ اكتب القاعدة: `.rules أضف لا تنسخ رسائل`')
      rules.text += `\\n\\n${rules.text.split('\\n').filter(l => l.match(/^\\d+️⃣/)).length + 1}️⃣ ${newRule}`
      rules.lastUpdated = now
      rules.updatedBy = sender
      return m.reply('✅ تم إضافة القاعدة')
    }

    // حذف قاعدة
    if (subCmd === 'احذف' || subCmd === 'remove' || subCmd === 'del') {
      if (!isAdmin) return m.reply('❌ للأدمن فقط')
      const num = parseInt(args[1])
      if (!num) return m.reply('❌ حدد رقم القاعدة: `.rules احذف 3`')
      const lines = rules.text.split('\\n')
      const ruleLines = lines.filter(l => l.match(/^\\d+️⃣/))
      if (num < 1 || num > ruleLines.length) return m.reply('❌ رقم قاعدة غير صحيح')
      const targetLine = ruleLines[num - 1]
      rules.text = rules.text.replace(targetLine + '\\n', '').replace(targetLine, '')
      // إعادة ترقيم
      let counter = 0
      rules.text = rules.text.replace(/^\\d+️⃣/gm, () => `${++counter}️⃣`)
      rules.lastUpdated = now
      rules.updatedBy = sender
      return m.reply(`🗑️ تم حذف القاعدة رقم ${num}`)
    }

    // معلومات
    if (subCmd === 'معلومات' || subCmd === 'info') {
      const updatedBy = rules.updatedBy ? await conn.getName(rules.updatedBy).catch(() => rules.updatedBy.split('@')[0]) : '—'
      return m.reply(
        `📋 *معلومات القواعد:*\\n\\n` +
        `📅 آخر تحديث: ${new Date(rules.lastUpdated).toLocaleString('ar-EG')}\\n` +
        `👮 بواسطة: ${updatedBy}\\n` +
        `📌 مثبتة: ${rules.pinnedMsgId ? '✅ نعم' : '❌ لا'}\\n` +
        `📏 عدد الأسطر: ${rules.text.split('\\n').length}`
      )
    }

  } catch (e) {
    console.error('rules:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['rules', 'قوانين', 'قواعد', 'group_rules']
handler.usage = ['rules', 'rules تعديل <نص>', 'rules تثبيت', 'rules إلغاء_تثبيت', 'rules أضف <قاعدة>', 'rules احذف <رقم>', 'rules افتراضي', 'rules معلومات']
handler.category = 'group'
handler.group = true
export default handler