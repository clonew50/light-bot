/*
  ═══════════════════════════════════════════
  📋 محول BBCode — لـ HTML، Markdown، نص
  الأمر: .bbcode / .بي بي كود / .bb
  ═══════════════════════════════════════════
*/

function bbcodeToHtml(bbcode) {
  return bbcode
    // الأحجام والعناوين
    .replace(/\[size=(\d+)\]\[b\](.*?)\[\/b\]\[\/size\]/gi, '<h3 style="font-size:${1}px">$2</h3>')
    .replace(/\[size=(\d+)\](.*?)\[\/size\]/gi, '<span style="font-size:${1}px">$2</span>')
    // التنسيق
    .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[s\](.*?)\[\/s\]/gi, '<del>$1</del>')
    // الألوان
    .replace(/\[color=(#[0-9a-fA-F]{6}|[a-z]+)\](.*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
    // الكود
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre><code>$1</code></pre>')
    .replace(/\[code=([a-z]+)\]([\s\S]*?)\[\/code\]/gi, '<pre><code class="language-$1">$2</code></pre>')
    // الروابط
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1">$1</a>')
    // الصور
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="image">')
    .replace(/\[img=(\d+)x(\d+)\](.*?)\[\/img\]/gi, '<img src="$3" width="$1" height="$2">')
    // القوائم
    .replace(/\[\*\]\s*(.*?)(?=\[\*\]|\[\/list\]|$)/gi, '<li>$1</li>')
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul>$1</ul>')
    .replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, '<ol>$1</ol>')
    // الاقتباسات
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')
    .replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/gi, '<blockquote><cite>$1</cite>$2</blockquote>')
    // السطور
    .replace(/\[br\]/gi, '<br>')
    .replace(/\n/g, '<br>')
}

function bbcodeToMarkdown(bbcode) {
  return bbcode
    .replace(/\[size=(\d+)\]\[b\](.*?)\[\/b\]\[\/size\]/gi, '### $2')
    .replace(/\[size=(\d+)\](.*?)\[\/size\]/gi, '$2')
    .replace(/\[b\](.*?)\[\/b\]/gi, '**$1**')
    .replace(/\[i\](.*?)\[\/i\]/gi, '*$1*')
    .replace(/\[u\](.*?)\[\/u\]/gi, '_$1_')
    .replace(/\[s\](.*?)\[\/s\]/gi, '~~$1~~')
    .replace(/\[color=[^\]]+\](.*?)\[\/color\]/gi, '$1')
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '```\n$1\n```')
    .replace(/\[code=([a-z]+)\]([\s\S]*?)\[\/code\]/gi, '```$1\n$2\n```')
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gi, '[$2]($1)')
    .replace(/\[url\](.*?)\[\/url\]/gi, '$1')
    .replace(/\[img\](.*?)\[\/img\]/gi, '![image]($1)')
    .replace(/\[\*\]\s*(.*?)(?=\[\*\]|\[\/list\]|$)/gi, '- $1')
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '$1')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '> $1')
    .replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/gi, '> $2\n> — $1')
    .replace(/\[br\]/gi, '\n')
}

function bbcodeToPlain(bbcode) {
  return bbcode
    .replace(/\[.*?\]/g, '')
    .replace(/\[\/.*?\]/g, '')
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const input = text?.replace(/^(بي بي كود|bbcode|bb)\s*/i, '').trim() || m.quoted?.text

    if (!input) {
      return conn.sendMessage(m.chat, {
        text: `📋 *محول BBCode*\\n\\n` +
          `أرسل نص BBCode، أو رد على رسالة:\\n` +
          `\`${usedPrefix}bbcode [b]غامق[/b] [i]مائل[/i] [url=link]رابط[/url]\`\\n\\n` +
          `اختر صيغة الإخراج:`,
        footer: 'LIGHT BOT • BBCode',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🌐 HTML', id: `${usedPrefix}bbcode html` } },
          { name: 'quick_reply', params: { display_text: '📝 Markdown', id: `${usedPrefix}bbcode md` } },
          { name: 'quick_reply', params: { display_text: '📄 نص عادي', id: `${usedPrefix}bbcode plain` } }
        ]
      }, { quoted: m })
    }

    // تحويل لـ HTML
    if (subCmd === 'html' || subCmd === 'إتش تي إم إل') {
      const html = bbcodeToHtml(input)
      return conn.sendMessage(m.chat, {
        text: `🌐 *HTML Output:*\\n\\n\`\`\`html\\n${html}\\n\`\`\``,
        footer: 'LIGHT BOT • BBCode → HTML'
      }, { quoted: m })
    }

    // تحويل لـ Markdown
    if (subCmd === 'md' || subCmd === 'ماركداون' || subCmd === 'markdown') {
      const md = bbcodeToMarkdown(input)
      return conn.sendMessage(m.chat, {
        text: `📝 *Markdown Output:*\\n\\n\`\`\`markdown\\n${md}\\n\`\`\``,
        footer: 'LIGHT BOT • BBCode → Markdown'
      }, { quoted: m })
    }

    // تحويل لنص عادي
    if (subCmd === 'نص' || subCmd === 'plain' || subCmd === 'عادي') {
      const plain = bbcodeToPlain(input)
      return conn.sendMessage(m.chat, {
        text: `📄 *Plain Text:*\\n\\n\`\`\`\\n${plain}\\n\`\`\``,
        footer: 'LIGHT BOT • BBCode → Plain'
      }, { quoted: m })
    }

    // تحويل الكل
    if (subCmd === 'الكل' || subCmd === 'all') {
      const html = bbcodeToHtml(input)
      const md = bbcodeToMarkdown(input)
      const plain = bbcodeToPlain(input)

      let msg = `📋 *BBCode Converter — All Formats*\\n\\n`
      msg += `🌐 *HTML:*\\n\`\`\`html\\n${html}\\n\`\`\`\\n\\n`
      msg += `📝 *Markdown:*\\n\`\`\`markdown\\n${md}\\n\`\`\`\\n\\n`
      msg += `📄 *Plain:*\\n\`\`\`\\n${plain}\\n\`\`\``

      return m.reply(msg)
    }

    // تحقق
    if (subCmd === 'تحقق' || subCmd === 'validate') {
      const issues = []
      const tags = ['b', 'i', 'u', 's', 'code', 'quote', 'url', 'img', 'color', 'size', 'list']
      tags.forEach(tag => {
        const open = (input.match(new RegExp(`\\[${tag}(?:=[^\\]]*)?\\]`, 'gi')) || []).length
        const close = (input.match(new RegExp(`\\[/${tag}\\]`, 'gi')) || []).length
        if (open !== close) issues.push(`⚠️ وسوم [${tag}] غير متطابقة (${open} فتح، ${close} إغلاق)`)
      })
      return m.reply(issues.length ? `🔍 *مشاكل:*\\n${issues.join('\\n')}` : '✅ BBCode يبدو صحيحاً')
    }

    // معاينة
    const preview = bbcodeToHtml(input).replace(/<[^>]+>/g, '').slice(0, 200)

    return conn.sendMessage(m.chat, {
      text: `📋 *معاينة BBCode:*\\n\\n${preview}${preview.length >= 200 ? '...' : ''}\\n\\nاختر صيغة الإخراج:`,
      footer: 'LIGHT BOT • BBCode',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🌐 HTML', id: `${usedPrefix}bbcode html` } },
        { name: 'quick_reply', params: { display_text: '📝 MD', id: `${usedPrefix}bbcode md` } },
        { name: 'quick_reply', params: { display_text: '📄 نص', id: `${usedPrefix}bbcode plain` } },
        { name: 'quick_reply', params: { display_text: '🔍 تحقق', id: `${usedPrefix}bbcode تحقق` } },
        { name: 'quick_reply', params: { display_text: '📦 الكل', id: `${usedPrefix}bbcode الكل` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('bbcode:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['bbcode', 'بي بي كود', 'bb', 'bbc']
handler.usage = ['bbcode <نص>', 'bbcode html', 'bbcode md', 'bbcode plain', 'bbcode الكل', 'bbcode تحقق']
handler.category = 'meta'
export default handler