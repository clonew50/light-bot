/*
  ═══════════════════════════════════════════
  📜 الأحاديث النبوية — عشوائية/موضوعية
  الأمر: .hadith / .حديث [موضوع]
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const cooldown = new Map()
const COOLDOWN_MS = 3000

const BOOKS = [
  { id: 'bukhari', name: '📚 صحيح البخاري', emoji: '📚' },
  { id: 'muslim', name: '📚 صحيح مسلم', emoji: '📚' },
  { id: 'tirmidhi', name: '📚 سنن الترمذي', emoji: '📖' },
  { id: 'abudawud', name: '📚 سنن أبي داود', emoji: '📖' },
  { id: 'nasai', name: '📚 سنن النسائي', emoji: '📖' },
  { id: 'ibnmajah', name: '📚 سنن ابن ماجه', emoji: '📖' },
]

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const query = text?.replace(/^(حديث|hadith)\s*/i, '').trim()

    // اختيار كتاب
    if (subCmd === 'كتاب' || subCmd === 'book') {
      const bookId = args[1]
      if (!bookId) {
        return conn.sendMessage(m.chat, {
          text: '📚 *اختر كتاب الحديث:*',
          footer: 'LIGHT BOT • Hadith',
          buttons: BOOKS.map(b => ({
            name: 'quick_reply',
            params: { display_text: `${b.emoji} ${b.name}`, id: `.hadith كتاب ${b.id}` }
          }))
        }, { quoted: m })
      }
      const book = BOOKS.find(b => b.id === bookId)
      if (!book) return m.reply('❌ كتاب غير موجود')
      return m.reply(`${book.emoji} *تم اختيار:* ${book.name}`)
    }

    // حديث عشوائي
    if (subCmd === 'عشوائي' || subCmd === 'random' || !query) {
      cooldown.set(m.sender, now)
      await m.react('📜')
      // استخدام API للأحاديث
      try {
        const { data } = await axios.get('https://api.hadith.gading.dev/books', { timeout: 10000 })
        if (!data.data?.length) throw new Error('No books')
        const randomBook = data.data[Math.floor(Math.random() * data.data.length)]
        const { data: hadithData } = await axios.get(`https://api.hadith.gading.dev/books/${randomBook.id}`, { timeout: 10000 })
        if (!hadithData.data?.hadiths?.length) throw new Error('No hadiths')
        const randomHadith = hadithData.data.hadiths[Math.floor(Math.random() * hadithData.data.hadiths.length)]
        return sendHadith(m, conn, randomHadith, hadithData.data.name)
      } catch {
        // بديل: حديث ثابت
        return sendFixedHadith(m)
      }
    }

    // بحث في الأحاديث
    if (subCmd === 'بحث' || subCmd === 'search') {
      const keyword = args.slice(1).join(' ')
      if (!keyword) return m.reply('❌ اكتب كلمة للبحث: `.hadith بحث صلاة`')
      cooldown.set(m.sender, now)
      await m.react('🔍')
      try {
        // البحث في الكتب المتاحة
        const { data: booksData } = await axios.get('https://api.hadith.gading.dev/books', { timeout: 10000 })
        let found = null
        for (const book of booksData.data || []) {
          try {
            const { data: hData } = await axios.get(`https://api.hadith.gading.dev/books/${book.id}`, { timeout: 5000 })
            const match = hData.data?.hadiths?.find(h => h.arab?.includes(keyword) || h.id?.includes(keyword))
            if (match) { found = { ...match, bookName: hData.data.name }; break }
          } catch {}
        }
        if (found) return sendHadith(m, conn, found, found.bookName)
        return m.reply(`🔍 لا نتائج لـ "${keyword}"`)
      } catch {
        return m.reply('❌ فشل البحث')
      }
    }

    // حسب الموضوع (كلمات مفتاحية شائعة)
    const topics = {
      'صلاة': ['prayer', 'salat', 'صلاة'],
      'صيام': ['fasting', 'sawm', 'صيام'],
      'زكاة': ['zakat', 'charity', 'زكاة'],
      'حج': ['hajj', 'pilgrimage', 'حج'],
      'أخلاق': ['manners', 'ethics', 'أخلاق', 'خلق'],
      'دعاء': ['dua', 'supplication', 'دعاء'],
      'توبة': ['repentance', 'tawbah', 'توبة'],
      'صبر': ['patience', 'sabr', 'صبر'],
    }

    const matchedTopic = Object.entries(topics).find(([k, v]) => v.some(w => query.includes(w)))
    if (matchedTopic) {
      cooldown.set(m.sender, now)
      await m.react('📜')
      return m.reply(`📜 *أحاديث عن ${matchedTopic[0]}:*\\n\\n(الميزة قيد التطوير - جرب \`.hadith عشوائي\`)`)
    }

    // افتراضي: عشوائي
    cooldown.set(m.sender, now)
    await m.react('📜')
    try {
      const { data } = await axios.get('https://api.hadith.gading.dev/books', { timeout: 10000 })
      const randomBook = data.data[Math.floor(Math.random() * data.data.length)]
      const { data: hadithData } = await axios.get(`https://api.hadith.gading.dev/books/${randomBook.id}`, { timeout: 10000 })
      const randomHadith = hadithData.data.hadiths[Math.floor(Math.random() * hadithData.data.hadiths.length)]
      return sendHadith(m, conn, randomHadith, hadithData.data.name)
    } catch {
      return sendFixedHadith(m)
    }

  } catch (e) {
    console.error('hadith:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل جلب الحديث')
  }
}

function sendHadith(m, conn, hadith, bookName) {
  const arabic = hadith.arab || hadith.text || hadith.content || 'النص غير متاح'
  const narrator = hadith.narrator || hadith.rawi || ''
  const grade = hadith.grade || hadith.classification || ''
  const msg = `📜 *حديث شريف* (${bookName})\\n\\n${arabic}\\n\\n${narrator ? `📖 الراوي: ${narrator}\\n` : ''}${grade ? `⭐ الدرجة: ${grade}\\n` : ''}`
  return m.reply(msg)
}

function sendFixedHadith(m) {
  const hadiths = [
    { text: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى', narrator: 'عمر بن الخطاب', grade: 'متفق عليه', book: 'البخاري ومسلم' },
    { text: 'من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت', narrator: 'أبو هريرة', grade: 'متفق عليه', book: 'البخاري ومسلم' },
    { text: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه', narrator: 'أنس بن مالك', grade: 'متفق عليه', book: 'البخاري ومسلم' },
    { text: 'المسلم من سلم المسلمون من لسانه ويده', narrator: 'عبد الله بن عمرو', grade: 'متفق عليه', book: 'البخاري ومسلم' },
    { text: 'اطلبوا العلم من المهد إلى اللحد', narrator: 'أنس بن مالك', grade: 'حسن', book: 'البيهقي' },
  ]
  const h = hadiths[Math.floor(Math.random() * hadiths.length)]
  return m.reply(`📜 *حديث شريف* (${h.book})\\n\\n${h.text}\\n\\n📖 الراوي: ${h.narrator}\\n⭐ الدرجة: ${h.grade}`)
}

handler.command = ['hadith', 'حديث', 'احاديث']
handler.usage = ['hadith', 'hadith عشوائي', 'hadith بحث <كلمة>', 'hadith كتاب <bukhari|muslim|...>']
handler.category = 'islamic'
handler.cooldown = 3
export default handler