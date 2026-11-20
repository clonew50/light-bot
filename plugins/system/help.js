/*
  ═══════════════════════════════════════════
  📚 مساعدة الأوامر — Help System
  الأمر: .أوامر [فئة] | .مساعدة [أمر]
  الفئات: messaging، groups، privacy، presence، broadcasts، chat، user، advanced
  ═══════════════════════════════════════════
*/
import fs from 'fs'
import path from 'path'

const handler = async (m, { conn, text, command }) => {
  try {
    const pluginsDir = path.join(process.cwd(), 'plugins')
    const categories = {}

    // قراءة جميع الإضافات
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walkDir(fullPath)
        } else if (file.endsWith('.js')) {
          try {
            const plugin = await import(fullPath)
            const handler = plugin.default
            if (handler?.command) {
              const category = handler.category || 'other'
              if (!categories[category]) categories[category] = []
              const commands = Array.isArray(handler.command) ? handler.command : [handler.command]
              const primary = commands[0]
              categories[category].push({
                command: primary,
                aliases: commands.slice(1),
                usage: handler.usage || [],
                description: handler.description || 'لا يوجد وصف'
              })
            }
          } catch (e) {
            // تجاهل الأخطاء في الاستيراد
          }
        }
      }
    }

    walkDir(pluginsDir)

    if (!text) {
      // عرض الفئات
      let msg = `📚 *الأوامر المتاحة (${Object.values(categories).flat().length} أمر):*\n\n`
      for (const [cat, cmds] of Object.entries(categories).sort()) {
        const catNames = {
          messaging: '💬 المراسلة',
          groups: '👥 المجموعات',
          privacy: '🔒 الخصوصية',
          presence: '👁️ الحضور',
          broadcasts: '📢 الإذاعة/القصص',
          chat: '💬 إدارة المحادثات',
          user: '👤 المستخدم/الملف',
          advanced: '🔧 متقدم',
          tools: '🛠️ أدوات',
          other: '📦 أخرى'
        }
        msg += `${catNames[cat] || cat}: ${cmds.length} أمر\n`
      }
      msg += '\n📖 استخدم: .أوامر <فئة> لعرض أوامر فئة معينة\n'
      msg += '❓ استخدم: .مساعدة <أمر> لعرض تفاصيل أمر محدد'
      return m.reply(msg)
    }

    // عرض أوامر فئة محددة
    const catKey = text.toLowerCase()
    const categoryMap = {
      'مراسلة': 'messaging', 'messaging': 'messaging',
      'مجموعات': 'groups', 'groups': 'groups',
      'خصوصية': 'privacy', 'privacy': 'privacy',
      'حضور': 'presence', 'presence': 'presence',
      'إذاعة': 'broadcasts', 'broadcasts': 'broadcasts',
      'محادثات': 'chat', 'chat': 'chat',
      'مستخدم': 'user', 'user': 'user',
      'متقدم': 'advanced', 'advanced': 'advanced',
      'أدوات': 'tools', 'tools': 'tools'
    }

    const category = categoryMap[catKey]
    if (category && categories[category]) {
      let msg = `📋 *أوامر ${category}:*\n\n`
      for (const cmd of categories[category]) {
        msg += `• ${cmd.command}`
        if (cmd.aliases.length) msg += ` (${cmd.aliases.join(', ')})`
        msg += `\n  ${cmd.description}\n`
        if (cmd.usage?.length) msg += `  مثال: ${cmd.usage[0]}\n`
        msg += '\n'
      }
      return m.reply(msg)
    }

    // البحث عن أمر محدد
    const searchTerm = text.toLowerCase()
    for (const [cat, cmds] of Object.entries(categories)) {
      for (const cmd of cmds) {
        const allNames = [cmd.command, ...cmd.aliases].map(c => c.toLowerCase())
        if (allNames.includes(searchTerm)) {
          let msg = `❓ *مساعدة: ${cmd.command}*\n\n`
          msg += `📝 الوصف: ${cmd.description}\n`
          if (cmd.aliases.length) msg += `🔄 الأسماء البديلة: ${cmd.aliases.join(', ')}\n`
          if (cmd.usage?.length) {
            msg += `\n📖 الاستخدام:\n`
            for (const u of cmd.usage) msg += `• ${u}\n`
          }
          return m.reply(msg)
        }
      }
    }

    m.reply('❌ لم يتم العثور على الفئة أو الأمر. استخدم .أوامر لعرض القائمة')
  } catch (e) {
    console.error('help:', e)
    m.reply('❌ فشل عرض المساعدة')
  }
}

handler.command = ['قائمة_الأوامر', 'help_all', 'commands_list', 'مساعدة_الأوامر', 'help_cmd_list']
handler.usage = ['أوامر', 'أوامر مجموعات', 'مساعدة حظر', 'مساعدة مجموعة_جديدة']
handler.category = 'system'
handler.description = 'عرض قائمة الأوامر حسب الفئة، أو تفاصيل أمر محدد'
export default handler