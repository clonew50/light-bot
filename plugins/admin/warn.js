/*
  ═══════════════════════════════════════════
  ⚠️ نظام التحذيرات — تفاعلي مع أزرار
  الأمر: .warn / .تحذير @مستخدم [سبب]
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 3000
const MAX_WARNS = 3

// تخزين التحذيرات في الذاكرة (يمكن نقلها لقاعدة بيانات)
if (!global.userWarns) global.userWarns = new Map()

function getWarns(chatId, userId) {
  const key = `${chatId}-${userId}`
  return global.userWarns.get(key) || { count: 0, reasons: [] }
}

function setWarns(chatId, userId, warns) {
  const key = `${chatId}-${userId}`
  if (warns.count === 0) global.userWarns.delete(key)
  else global.userWarns.set(key, warns)
}

function pruneWarns() {
  // تنظيف دوري للتحذيرات القديمة (اختياري)
  if (global.userWarns.size > 10000) {
    const entries = [...global.userWarns.entries()].slice(-5000)
    global.userWarns = new Map(entries)
  }
}

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    if (!isAdmin) return m.reply('❌ للأدمن فقط')
    if (!isBotAdmin) return m.reply('❌ البوت بحاجة لصلاحية أدمن')

    const subCmd = args[0]?.toLowerCase()
    const mentioned = m.mentionedJid?.[0] || (args[1]?.startsWith('@') ? args[1].replace('@', '') + '@s.whatsapp.net' : null)
    const reason = text?.replace(/^(تحذير|warn)\s*/i, '').replace(/^@?\w+\s*/, '').trim() || 'بدون سبب'

    // عرض التحذيرات
    if (subCmd === 'عرض' || subCmd === 'list' || subCmd === 'check') {
      const target = mentioned || sender
      const warns = getWarns(m.chat, target)
      const user = await conn.getName(target).catch(() => target.split('@')[0])
      return m.reply(`⚠️ *تحذيرات ${user}:* ${warns.count}/${MAX_WARNS}\\n${warns.reasons.map((r, i) => `${i + 1}. ${r}`).join('\\n') || 'لا توجد تحذيرات'}`)
    }

    // مسح تحذيرات
    if (subCmd === 'مسح' || subCmd === 'clear' || subCmd === 'reset') {
      if (!mentioned) return m.reply('❌ منشن المستخدم: `.warn مسح @user`')
      setWarns(m.chat, mentioned, { count: 0, reasons: [] })
      const user = await conn.getName(mentioned).catch(() => mentioned.split('@')[0])
      return m.reply(`✅ *تم مسح تحذيرات ${user}*`)
    }

    // التحقق من وجود منشن
    if (!mentioned) {
      return conn.sendMessage(m.chat, {
        text: `⚠️ *نظام التحذيرات*\\n\\n` +
          `منشن مستخدم للتحذير:\\n\`${usedPrefix}warn @user سبام\`\\n\\n` +
          `الأوامر:\\n` +
          `• \`${usedPrefix}warn @user [سبب]\` - إضافة تحذير\\n` +
          `• \`${usedPrefix}warn عرض @user\` - عرض التحذيرات\\n` +
          `• \`${usedPrefix}warn مسح @user\` - مسح التحذيرات`,
        footer: 'LIGHT BOT • Admin',
        buttons: [
          { name: 'quick_reply', params: { display_text: '⚠️ تحذير', id: `${usedPrefix}warn @` } },
          { name: 'quick_reply', params: { display_text: '📋 عرض', id: `${usedPrefix}warn عرض @` } },
          { name: 'quick_reply', params: { display_text: '🗑️ مسح', id: `${usedPrefix}warn مسح @` } }
        ]
      }, { quoted: m })
    }

    // لا يمكن تحذير البوت أو الأدمن
    if (mentioned === conn.user.jid) return m.reply('❌ لا يمكن تحذير البوت')
    const groupMeta = await conn.groupMetadata(m.chat)
    const targetIsAdmin = groupMeta.participants.find(p => p.id === mentioned && p.admin)
    if (targetIsAdmin) return m.reply('❌ لا يمكن تحذير أدمن')

    cooldown.set(m.sender, now)
    pruneWarns()

    const warns = getWarns(m.chat, mentioned)
    warns.count++
    warns.reasons.push({ reason, by: sender, at: Date.now() })
    setWarns(m.chat, mentioned, warns)

    const user = await conn.getName(mentioned).catch(() => mentioned.split('@')[0])
    const byUser = await conn.getName(sender).catch(() => sender.split('@')[0])

    await m.react('⚠️')

    if (warns.count >= MAX_WARNS) {
      // طرد تلقائي عند الوصول للحد الأقصى
      await conn.groupParticipantsUpdate(m.chat, [mentioned], 'remove')
      setWarns(m.chat, mentioned, { count: 0, reasons: [] })
      await m.reply(
        `🚫 *تم طرد ${user} تلقائياً*\\n` +
        `⚠️ وصل للحد الأقصى (${MAX_WARNS} تحذيرات)\\n` +
        `📝 السبب الأخير: ${reason}\\n` +
        `👮 بواسطة: ${byUser}`
      )
    } else {
      await conn.sendMessage(m.chat, {
        text: `⚠️ *تحذير ${warns.count}/${MAX_WARNS}*\\n\\n` +
          `👤 المستخدم: @${mentioned.split('@')[0]}\\n` +
          `📝 السبب: ${reason}\\n` +
          `👮 بواسطة: ${byUser}\\n\\n` +
          `${warns.count === MAX_WARNS - 1 ? '⚠️ *تحذير أخير! القادم = طرد*' : ''}`,
        mentions: [mentioned],
        contextInfo: { mentionedJid: [mentioned, sender] }
      }, { quoted: m })
    }

  } catch (e) {
    console.error('warn:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل تنفيذ الأمر')
  }
}

handler.command = ['warn', 'تحذير', 'انذار']
handler.usage = ['warn @user [سبب]', 'warn عرض @user', 'warn مسح @user']
handler.category = 'admin'
handler.cooldown = 3
handler.group = true
handler.admin = true
handler.botAdmin = true
export default handler