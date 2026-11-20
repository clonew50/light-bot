/*
  ═══════════════════════════════════════════
  📦 حزم ملصقات — إنشاء/إدارة حزم
  الأمر: .pack / .حزمة <اسم> [كاتب]
  ═══════════════════════════════════════════
*/

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()

    // إنشاء حزمة
    if (subCmd === 'أنشئ' || subCmd === 'create' || !subCmd) {
      const packName = args[1] || text?.replace(/^(حزمة|pack)\s*/i, '').trim()
      const author = args[2] || 'LIGHT BOT'

      if (!packName) {
        return conn.sendMessage(m.chat, {
          text: `📦 *إنشاء حزمة ملصقات*\\n\\n` +
            `اكتب اسم الحزمة:\\n\`${usedPrefix}pack اسم الحزمة [الكاتب]\`\\n\\n` +
            `مثال: \`${usedPrefix}pack ملصقاتي المميزة لودربوت\``,
          footer: 'LIGHT BOT • Sticker',
          buttons: [
            { name: 'quick_reply', params: { display_text: '📦 إنشاء', id: `${usedPrefix}pack أنشئ ` } },
            { name: 'quick_reply', params: { display_text: '📋 قائمتي', id: `${usedPrefix}pack قائمتي` } }
          ]
        }, { quoted: m })
      }

      await m.react('📦')

      // حفظ معلومات الحزمة (يمكن تطويرها لقاعدة بيانات)
      if (!global.stickerPacks) global.stickerPacks = new Map()
      const packId = `pack_${Date.now()}_${m.sender.split('@')[0]}`
      global.stickerPacks.set(packId, {
        name: packName,
        author,
        creator: m.sender,
        stickers: [],
        createdAt: Date.now()
      })

      await m.reply(
        `📦 *تم إنشاء حزمة ملصقات!*\\n\\n` +
        `📝 *الاسم:* ${packName}\\n` +
        `✍️ *الكاتب:* ${author}\\n` +
        `🆔 *المعرف:* \`${packId}\`\\n\\n` +
        `الآن أرسل صوراً/فيديوهات مع الأمر \`.s\` لإضافتها للحزمة`
      )
      return
    }

    // عرض حزم المستخدم
    if (subCmd === 'قائمتي' || subCmd === 'list' || subCmd === 'my') {
      if (!global.stickerPacks) return m.reply('📭 لا توجد حزم محفوظة')
      const userPacks = [...global.stickerPacks.entries()].filter(([, p]) => p.creator === m.sender)
      if (!userPacks.length) return m.reply('📭 لم تنشئ أي حزم بعد')
      let msg = `📦 *حزمك (${userPacks.length}):*\\n\\n`
      userPacks.forEach(([id, p], i) => {
        msg += `${i + 1}. *${p.name}*\\n   ✍️ ${p.author} | 📎 ${p.stickers.length} ملصق\\n   🆔 \`${id}\`\\n\\n`
      })
      return m.reply(msg)
    }

    // عرض حزمة
    if (subCmd === 'عرض' || subCmd === 'info') {
      const packId = args[1]
      if (!packId || !global.stickerPacks?.has(packId)) return m.reply('❌ حزمة غير موجودة')
      const p = global.stickerPacks.get(packId)
      return m.reply(
        `📦 *${p.name}*\\n` +
        `✍️ ${p.author}\\n` +
        `📎 ${p.stickers.length} ملصق\\n` +
        `📅 ${new Date(p.createdAt).toLocaleString('ar-EG')}\\n` +
        `🆔 \`${packId}\``
      )
    }

    // حذف حزمة
    if (subCmd === 'احذف' || subCmd === 'delete') {
      const packId = args[1]
      if (!packId || !global.stickerPacks?.has(packId)) return m.reply('❌ حزمة غير موجودة')
      const p = global.stickerPacks.get(packId)
      if (p.creator !== m.sender) return m.reply('❌ ليس لديك صلاحية حذف هذه الحزمة')
      global.stickerPacks.delete(packId)
      return m.reply('🗑️ تم حذف الحزمة')
    }

  } catch (e) {
    console.error('pack:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['pack', 'حزمة', 'stickerpack']
handler.usage = ['pack <اسم> [كاتب]', 'pack قائمتي', 'pack عرض <id>', 'pack احذف <id>']
handler.category = 'sticker'
export default handler