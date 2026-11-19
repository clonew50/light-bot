/*
  ═══════════════════════════════════════════
  👋 رسائل ترحيب/وداع — إعدادات تفاعلية
  الأمر: .welcome / .ترحيب
  ═══════════════════════════════════════════
*/

const cooldown = new Map()
const COOLDOWN_MS = 3000

// تخزين إعدادات الترحيب لكل مجموعة
if (!global.welcomeSettings) global.welcomeSettings = new Map()

const DEFAULT_WELCOME = `👋 مرحباً @user في *{group}*!
📜 اقرأ القواعد: {rules}
🆔 رقمك: {number}
👥 الأعضاء: {count}`

const DEFAULT_GOODBYE = `👋 وداعاً @user...
نتمنى لك التوفيق!`

const PLACEHOLDERS = [
  '{user} - منشن العضو',
  '{group} - اسم المجموعة',
  '{count} - عدد الأعضاء',
  '{number} - رقم العضو',
  '{rules} - رابط القواعد',
  '{date} - التاريخ',
  '{time} - الوقت'
]

function getSettings(chatId) {
  if (!global.welcomeSettings.has(chatId)) {
    global.welcomeSettings.set(chatId, {
      enabled: true,
      welcomeMsg: DEFAULT_WELCOME,
      goodbyeMsg: DEFAULT_GOODBYE,
      welcomeMedia: null,
      goodbyeMedia: null,
      deleteAfter: 0 // 0 = لا تحذف
    })
  }
  return global.welcomeSettings.get(chatId)
}

const handler = async (m, { conn, text, args, usedPrefix, isAdmin, isBotAdmin, sender }) => {
  try {
    if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط')

    const now = Date.now()
    const last = cooldown.get(sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    if (!isAdmin) return m.reply('❌ للأدمن فقط')

    const settings = getSettings(m.chat)
    const subCmd = args[0]?.toLowerCase()

    // تفعيل/إيقاف
    if (subCmd === 'تفعيل' || subCmd === 'on' || subCmd === 'enable') {
      settings.enabled = true
      return m.reply('✅ تم تفعيل رسائل الترحيب/الوداع')
    }

    if (subCmd === 'إيقاف' || subCmd === 'off' || subCmd === 'disable') {
      settings.enabled = false
      return m.reply('🔴 تم إيقاف رسائل الترحيب/الوداع')
    }

    // تعيين رسالة ترحيب
    if (subCmd === 'ترحيب' || subCmd === 'welcome' || subCmd === 'setwelcome') {
      const msg = text?.replace(/^(ترحيب|welcome|setwelcome)\s*/i, '').trim()
      if (!msg) {
        return conn.sendMessage(m.chat, {
          text: `👋 *تعيين رسالة الترحيب*\\n\\n` +
            `الرسالة الحالية:\\n\`${settings.welcomeMsg}\`\\n\\n` +
            `المتغيرات المتاحة:\\n` +
            PLACEHOLDERS.map(p => `• ${p}`).join('\\n') +
            `\\n\\nاكتب الرسالة الجديدة:\\n\`${usedPrefix}welcome ترحيب مرحباً @user في {group}!\``,
          footer: 'LIGHT BOT • Welcome',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🔄 افتراضي', id: `${usedPrefix}welcome ترحيب افتراضي` } },
            { name: 'quick_reply', params: { display_text: '👋 وداع', id: `${usedPrefix}welcome وداع` } }
          ]
        }, { quoted: m })
      }
      if (msg === 'افتراضي' || msg === 'default') {
        settings.welcomeMsg = DEFAULT_WELCOME
        return m.reply('🔄 تم إعادة رسالة الترحيب للافتراضية')
      }
      settings.welcomeMsg = msg
      return m.reply('✅ تم تحديث رسالة الترحيب')
    }

    // تعيين رسالة وداع
    if (subCmd === 'وداع' || subCmd === 'goodbye' || subCmd === 'setgoodbye') {
      const msg = text?.replace(/^(وداع|goodbye|setgoodbye)\s*/i, '').trim()
      if (!msg) {
        return conn.sendMessage(m.chat, {
          text: `👋 *تعيين رسالة الوداع*\\n\\n` +
            `الرسالة الحالية:\\n\`${settings.goodbyeMsg}\`\\n\\n` +
            `المتغيرات: ${PLACEHOLDERS.slice(0, 3).map(p => `• ${p}`).join('\\n')}\\n\\n` +
            `اكتب الرسالة الجديدة:`,
          footer: 'LIGHT BOT • Welcome',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🔄 افتراضي', id: `${usedPrefix}welcome وداع افتراضي` } }
          ]
        }, { quoted: m })
      }
      if (msg === 'افتراضي' || msg === 'default') {
        settings.goodbyeMsg = DEFAULT_GOODBYE
        return m.reply('🔄 تم إعادة رسالة الوداع للافتراضية')
      }
      settings.goodbyeMsg = msg
      return m.reply('✅ تم تحديث رسالة الوداع')
    }

    // تعيين ميديا ترحيب
    if (subCmd === 'ميديا' || subCmd === 'media') {
      const type = args[1] // welcome/goodbye
      if (!type || !['ترحيب', 'welcome', 'وداع', 'goodbye'].includes(type)) {
        return m.reply('❌ حدد النوع: `.welcome ميديا ترحيب` أو `.welcome ميديا وداع` (رد على صورة/فيديو)')
      }
      if (!m.quoted?.msg?.message?.imageMessage && !m.quoted?.msg?.message?.videoMessage) {
        return m.reply('❌ رد على صورة أو فيديو لتعيينه كرسالة ترحيب/وداع')
      }
      const isWelcome = ['ترحيب', 'welcome'].includes(type)
      const media = await conn.downloadMediaMessage(m.quoted.msg)
      if (isWelcome) settings.welcomeMedia = media
      else settings.goodbyeMedia = media
      return m.reply(`✅ تم تعيين ${isWelcome ? 'وسائط الترحيب' : 'وسائط الوداع'}`)
    }

    // حذف ميديا
    if (subCmd === 'حذف_ميديا' || subCmd === 'deletemedia') {
      const type = args[1]
      if (!type) return m.reply('❌ حدد النوع: ترحيب/وداع')
      if (['ترحيب', 'welcome'].includes(type)) settings.welcomeMedia = null
      else settings.goodbyeMedia = null
      return m.reply('🗑️ تم حذف الوسائط')
    }

    // تعيين وقت الحذف التلقائي
    if (subCmd === 'حذف_تلقائي' || subCmd === 'autodelete') {
      const seconds = parseInt(args[1])
      if (isNaN(seconds) || seconds < 0 || seconds > 3600) return m.reply('❌ ثوانٍ 0-3600 (0 = لا تحذف)')
      settings.deleteAfter = seconds
      return m.reply(`${seconds === 0 ? '🔴 تم إيقاف' : '✅ تم تعيين'} الحذف التلقائي بعد ${seconds} ثانية`)
    }

    // اختبار
    if (subCmd === 'اختبار' || subCmd === 'test') {
      const type = args[1] || 'ترحيب'
      const isWelcome = ['ترحيب', 'welcome'].includes(type)
      const msg = isWelcome ? settings.welcomeMsg : settings.goodbyeMsg
      const media = isWelcome ? settings.welcomeMedia : settings.goodbyeMsg

      const groupMeta = await conn.groupMetadata(m.chat)
      const count = groupMeta.participants.length
      const rulesLink = 'https://example.com/rules' // يمكن تخصيصه
      const date = new Date().toLocaleDateString('ar-EG')
      const time = new Date().toLocaleTimeString('ar-EG')

      const processed = msg
        .replace('{user}', `@${sender.split('@')[0]}`)
        .replace('{group}', groupMeta.subject)
        .replace('{count}', count)
        .replace('{number}', count)
        .replace('{rules}', rulesLink)
        .replace('{date}', date)
        .replace('{time}', time)

      cooldown.set(sender, now)
      if (media) {
        await conn.sendMessage(m.chat, {
          image: media,
          caption: processed,
          mentions: [sender]
        }, { quoted: m })
      } else {
        await m.reply(processed, null, { mentions: [sender] })
      }
      return m.reply('✅ تم إرسال رسالة الاختبار')
    }

    // عرض الإعدادات
    if (subCmd === 'إعدادات' || subCmd === 'settings' || subCmd === 'info') {
      return m.reply(
        `⚙️ *إعدادات الترحيب/الوداع:*\\n\\n` +
        `${settings.enabled ? '✅' : '🔴'} *الحالة:* ${settings.enabled ? 'مفعل' : 'معطل'}\\n\\n` +
        `👋 *رسالة الترحيب:*\\n\`${settings.welcomeMsg.slice(0, 100)}\`\\n` +
        `${settings.welcomeMedia ? '🖼️ مع ميديا' : '📝 نص فقط'}\\n\\n` +
        `👋 *رسالة الوداع:*\\n\`${settings.goodbyeMsg.slice(0, 100)}\`\\n` +
        `${settings.goodbyeMedia ? '🖼️ مع ميديا' : '📝 نص فقط'}\\n\\n` +
        `🗑️ *الحذف التلقائي:* ${settings.deleteAfter === 0 ? 'معطل' : `${settings.deleteAfter} ثانية`}`
      )
    }

    // قائمة رئيسية
    cooldown.set(sender, now)
    return conn.sendMessage(m.chat, {
      text: `👋 *إدارة الترحيب/الوداع*\\n\\nالحالة: ${settings.enabled ? '✅ مفعل' : '🔴 معطل'}`,
      footer: 'LIGHT BOT • Welcome',
      buttons: [
        { name: 'quick_reply', params: { display_text: '👋 ترحيب', id: `${usedPrefix}welcome ترحيب` } },
        { name: 'quick_reply', params: { display_text: '👋 وداع', id: `${usedPrefix}welcome وداع` } },
        { name: 'quick_reply', params: { display_text: '🖼️ ميديا', id: `${usedPrefix}welcome ميديا` } },
        { name: 'quick_reply', params: { display_text: '🧪 اختبار', id: `${usedPrefix}welcome اختبار` } },
        { name: 'quick_reply', params: { display_text: '⚙️ إعدادات', id: `${usedPrefix}welcome إعدادات` } },
        { name: 'quick_reply', params: { display_text: settings.enabled ? '🔴 إيقاف' : '✅ تفعيل', id: `${usedPrefix}welcome ${settings.enabled ? 'إيقاف' : 'تفعيل'}` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('welcome:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

// معالج أحداث الانضمام/المغادرة (يجب تسجيله في main)
// export async function handleWelcome(conn, participant, action) { ... }

handler.command = ['welcome', 'ترحيب', 'وداع', 'welcome_msg']
handler.usage = ['welcome', 'welcome ترحيب <نص>', 'welcome وداع <نص>', 'welcome ميديا ترحيب/وداع (رد على ميديا)', 'welcome اختبار ترحيب/وداع', 'welcome إعدادات', 'welcome تفعيل/إيقاف', 'welcome حذف_تلقائي <ثواني>']
handler.category = 'group'
handler.cooldown = 3
handler.group = true
handler.admin = true
export default handler