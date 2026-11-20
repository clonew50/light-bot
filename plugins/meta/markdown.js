/*
  ═══════════════════════════════════════════
  📝 محول Markdown — لـ HTML، BBCode، نص عادي
  الأمر: .md / .ماركداون / .markdown
  ═══════════════════════════════════════════
*/

// محول Markdown بسيط
function markdownToHtml(md) {
  return md
    // العناوين
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // النص الغامق والمائل
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // الكود
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // الروابط
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // الصور
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // القوائم
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // اقتباسات
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // أسطر أفقية
    .replace(/^---$/gim, '<hr>')
    // فواصل الأسطر
    .replace(/\n/g, '<br>')
}

function markdownToBbcode(md) {
  return md
    .replace(/^### (.*$)/gim, '[size=16][b]$1[/b][/size]')
    .replace(/^## (.*$)/gim, '[size=18][b]$1[/b][/size]')
    .replace(/^# (.*$)/gim, '[size=20][b]$1[/b][/size]')
    .replace(/\*\*(.*?)\*\*/g, '[b]$1[/b]')
    .replace(/\*(.*?)\*/g, '[i]$1[/i]')
    .replace(/`([^`]+)`/g, '[code]$1[/code]')
    .replace(/```([\s\S]*?)```/g, '[code]$1[/code]')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[url=$2]$1[/url]')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[img]$2[/img]')
    .replace(/^\- (.*$)/gim, '[*]$1')
    .replace(/^\* (.*$)/gim, '[*]$1')
    .replace(/^> (.*$)/gim, '[quote]$1[/quote]')
    .replace(/\n/g, '')
}

function markdownToPlain(md) {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[صورة: $1]')
    .replace(/^\- /gm, '• ')
    .replace(/^\* /gm, '• ')
    .replace(/^> /gm, '» ')
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const input = text?.replace(/^(ماركداون|markdown|md)\s*/i, '').trim() || m.quoted?.text

    if (!input) {
      return conn.sendMessage(m.chat, {
        text: `📝 *محول Markdown*\\n\\n` +
          `أرسل نص Markdown، أو رد على رسالة:\\n` +
          `\`${usedPrefix}md # عنوان\\n**غامق** *مائل* \`كود\`\`\\n\\n` +
          `اختر صيغة الإخراج:`,
        footer: 'LIGHT BOT • Markdown',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🌐 HTML', id: `${usedPrefix}md html` } },
          { name: 'quick_reply', params: { display_text: '📋 BBCode', id: `${usedPrefix}md bbcode` } },
          { name: 'quick_reply', params: { display_text: '📄 نص عادي', id: `${usedPrefix}md plain` } }
        ]
      }, { quoted: m })
    }

    // تحويل لـ HTML
    if (subCmd === 'html' || subCmd === 'إتش تي إم إل') {
      const html = markdownToHtml(input)
      return conn.sendMessage(m.chat, {
        text: `🌐 *HTML Output:*\\n\\n\`\`\`html\\n${html}\\n\`\`\``,
        footer: 'LIGHT BOT • Markdown → HTML'
      }, { quoted: m })
    }

    // تحويل لـ BBCode
    if (subCmd === 'bbcode' || subCmd === 'بي بي كود') {
      const bbcode = markdownToBbcode(input)
      return conn.sendMessage(m.chat, {
        text: `📋 *BBCode Output:*\\n\\n\`\`\`\\n${bbcode}\\n\`\`\``,
        footer: 'LIGHT BOT • Markdown → BBCode'
      }, { quoted: m })
    }

    // تحويل لنص عادي
    if (subCmd === 'نص' || subCmd === 'plain' || subCmd === 'عادي') {
      const plain = markdownToPlain(input)
      return conn.sendMessage(m.chat, {
        text: `📄 *Plain Text:*\\n\\n\`\`\`\\n${plain}\\n\`\`\``,
        footer: 'LIGHT BOT • Markdown → Plain'
      }, { quoted: m })
    }

    // تحويل الكل
    if (subCmd === 'الكل' || subCmd === 'all') {
      const html = markdownToHtml(input)
      const bbcode = markdownToBbcode(input)
      const plain = markdownToPlain(input)

      let msg = `📝 *Markdown Converter — All Formats*\\n\\n`
      msg += `🌐 *HTML:*\\n\`\`\`html\\n${html}\\n\`\`\`\\n\\n`
      msg += `📋 *BBCode:*\\n\`\`\`\\n${bbcode}\\n\`\`\`\\n\\n`
      msg += `📄 *Plain:*\\n\`\`\`\\n${plain}\\n\`\`\``

      return m.reply(msg)
    }

    // تحقق من الصحة
    if (subCmd === 'تحقق' || subCmd === 'validate' || subCmd === 'lint') {
      const issues = []
      // فحص بسيط
      if (input.includes('**') && (input.match(/\*\*/g) || []).length % 2 !== 0) issues.push('⚠️ علامات ** غير متطابقة')
      if (input.includes('*') && (input.match(/\*/g) || []).length % 2 !== 0) issues.push('⚠️ علامات * غير متطابقة')
      if (input.includes('`') && (input.match(/`/g) || []).length % 2 !== 0) issues.push('⚠️ علامات ` غير متطابقة')
      if (input.includes('[') && input.includes('](') && (input.match(/\[/g) || []).length !== (input.match(/\]\(/g) || []).length) issues.push('⚠️ روابط غير مكتملة')

      return m.reply(issues.length ? `🔍 *مشاكل محتملة:*\\n${issues.join('\\n')}` : '✅ Markdown يبدو صحيحاً')
    }

    // عرض معاينة تفاعلية
    const html = markdownToHtml(input)
    const preview = html.replace(/<[^>]+>/g, '').slice(0, 200)

    return conn.sendMessage(m.chat, {
      text: `📝 *معاينة Markdown:*\\n\\n${preview}${preview.length >= 200 ? '...' : ''}\\n\\nاختر صيغة الإخراج:`,
      footer: 'LIGHT BOT • Markdown',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🌐 HTML', id: `${usedPrefix}md html` } },
        { name: 'quick_reply', params: { display_text: '📋 BBCode', id: `${usedPrefix}md bbcode` } },
        { name: 'quick_reply', params: { display_text: '📄 نص', id: `${usedPrefix}md plain` } },
        { name: 'quick_reply', params: { display_text: '🔍 تحقق', id: `${usedPrefix}md تحقق` } },
        { name: 'quick_reply', params: { display_text: '📦 الكل', id: `${usedPrefix}md الكل` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('markdown:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['md', 'ماركداون', 'markdown', 'mkd']
handler.usage = ['md <نص>', 'md html', 'md bbcode', 'md plain', 'md الكل', 'md تحقق']
handler.category = 'meta'
export default handler