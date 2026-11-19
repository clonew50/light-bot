/*
  ═══════════════════════════════════════════
  🐙 غيتهب — بحث مستودعات/مستخدمين
  الأمر: .github / .غيثب <استعلام>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const cooldown = new Map()
const COOLDOWN_MS = 5000

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const query = text?.replace(/^(غيثب|github)\s*/i, '').trim()

    if (subCmd === 'مستخدم' || subCmd === 'user') {
      const username = args[1]
      if (!username) return m.reply('❌ اكتب اسم المستخدم: `.github مستخدم torvalds`')
      cooldown.set(m.sender, now)
      await m.react('🐙')
      const { data } = await axios.get(`https://api.github.com/users/${username}`, { timeout: 10000 })
      return sendUser(m, conn, data)
    }

    if (subCmd === 'مستودع' || subCmd === 'repo') {
      const repo = args.slice(1).join(' ')
      if (!repo) return m.reply('❌ اكتب اسم المستودع: `.github مستودع facebook/react`')
      cooldown.set(m.sender, now)
      await m.react('🐙')
      const { data } = await axios.get(`https://api.github.com/repos/${repo}`, { timeout: 10000 })
      return sendRepo(m, conn, data)
    }

    if (!query) {
      return conn.sendMessage(m.chat, {
        text: `🐙 *بحث غيتهب*\\n\\n` +
          `البحث في المستودعات:\\n\`${usedPrefix}github react hooks\`\\n\\n` +
          `أو استخدم الأوامر الفرعية:`,
        footer: 'LIGHT BOT • GitHub',
        buttons: [
          { name: 'quick_reply', params: { display_text: '👤 مستخدم', id: `${usedPrefix}github مستخدم ` } },
          { name: 'quick_reply', params: { display_text: '📦 مستودع', id: `${usedPrefix}github مستودع ` } },
          { name: 'quick_reply', params: { display_text: '🔍 بحث', id: `${usedPrefix}github ` } }
        ]
      }, { quoted: m })
    }

    cooldown.set(m.sender, now)
    await m.react('🔍')

    // بحث في المستودعات
    const { data } = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`, { timeout: 10000 })

    if (!data.items?.length) {
      return m.reply(`🔍 *لا توجد نتائج لـ:* ${query}`)
    }

    let msg = `🐙 *أفضل 5 نتائج لـ:* ${query}\\n\\n`
    data.items.forEach((repo, i) => {
      msg += `${i + 1}. *${repo.full_name}* ⭐ ${repo.stargazers_count.toLocaleString()}\\n`
      msg += `   ${repo.description || 'بدون وصف'}\\n`
      msg += `   🔗 ${repo.html_url}\\n\\n`
    })

    await m.reply(msg)
    await m.react('✅')

  } catch (e) {
    console.error('github:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل البحث في غيتهب')
  }
}

async function sendUser(m, conn, data) {
  const msg = `👤 *${data.name || data.login}* (@${data.login})\\n\\n` +
    `📝 ${data.bio || 'بدون وصف'}\\n` +
    `📍 ${data.location || 'غير محدد'}\\n` +
    `🌐 ${data.blog || 'لا يوجد موقع'}\\n` +
    `👥 متابعين: ${data.followers.toLocaleString()} | يتابع: ${data.following.toLocaleString()}\\n` +
    `📦 مستودعات عامة: ${data.public_repos.toLocaleString()}\\n` +
    `📅 انضم: ${new Date(data.created_at).toLocaleDateString('ar-EG')}\\n\\n` +
    `🔗 ${data.html_url}`

  await conn.sendMessage(m.chat, {
    image: { url: data.avatar_url },
    caption: msg,
    contextInfo: { mentionedJid: [m.sender], externalAdReply: { title: 'GitHub User', body: data.login, thumbnailUrl: data.avatar_url, sourceUrl: data.html_url, mediaType: 1 } }
  }, { quoted: m })
  await m.react('✅')
}

async function sendRepo(m, conn, data) {
  const msg = `📦 *${data.full_name}*\\n\\n` +
    `📝 ${data.description || 'بدون وصف'}\\n` +
    `⭐ ${data.stargazers_count.toLocaleString()} | 🍴 ${data.forks_count.toLocaleString()} | 👁️ ${data.watchers_count.toLocaleString()}\\n` +
    `💻 اللغة: ${data.language || 'غير محدد'}\\n` +
    `📅 создан: ${new Date(data.created_at).toLocaleDateString('ar-EG')}\\n` +
    `🔄 آخر تحديث: ${new Date(data.updated_at).toLocaleDateString('ar-EG')}\\n` +
    `📄 الرخصة: ${data.license?.name || 'بدون رخصة'}\\n\\n` +
    `🔗 ${data.html_url}`

  if (data.owner?.avatar_url) {
    await conn.sendMessage(m.chat, {
      image: { url: data.owner.avatar_url },
      caption: msg,
      contextInfo: { mentionedJid: [m.sender], externalAdReply: { title: 'GitHub Repo', body: data.full_name, thumbnailUrl: data.owner.avatar_url, sourceUrl: data.html_url, mediaType: 1 } }
    }, { quoted: m })
  } else {
    await m.reply(msg)
  }
  await m.react('✅')
}

handler.command = ['github', 'غيثب', 'git']
handler.usage = ['github <بحث>', 'github مستخدم <username>', 'github مستودع <owner/repo>']
handler.category = 'search'
handler.cooldown = 5
export default handler