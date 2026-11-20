/*
  ═══════════════════════════════════════════
  📖 القرآن الكريم — آيات، سور، بحث
  الأمر: .quran / .قرآن <سورة:آية> أو <كلمة>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const API_BASE = 'https://api.alquran.cloud/v1'

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()
    const query = text?.replace(/^(قرآن|quran)\s*/i, '').trim()

    // سورة عشوائية
    if (subCmd === 'عشوائي' || subCmd === 'random') {
      await m.react('📖')
      const surahNum = Math.floor(Math.random() * 114) + 1
      return fetchSurah(m, conn, surahNum)
    }

    // قائمة السور
    if (subCmd === 'السور' || subCmd === 'surahs' || subCmd === 'list') {
      const { data } = await axios.get(`${API_BASE}/surah`, { timeout: 10000 })
      let msg = `📖 *قائمة السور (114 سورة):*\\n\\n`
      data.data.forEach(s => {
        msg += `${s.number}. *${s.englishName}* (${s.name}) - ${s.numberOfAyahs} آية\\n`
      })
      return m.reply(msg)
    }

    // آية عشوائية
    if (subCmd === 'آية' || subCmd === 'ayah' || subCmd === 'verse') {
      await m.react('📖')
      const surah = Math.floor(Math.random() * 114) + 1
      const { data: surahData } = await axios.get(`${API_BASE}/surah/${surah}`, { timeout: 10000 })
      const ayahNum = Math.floor(Math.random() * surahData.data.ayahs.length) + 1
      return fetchAyah(m, conn, surah, ayahNum)
    }

    // بحث في القرآن
    if (subCmd === 'بحث' || subCmd === 'search') {
      const keyword = args.slice(1).join(' ')
      if (!keyword) return m.reply('❌ اكتب كلمة للبحث: `.quran بحث رحمة`')
      await m.react('🔍')
      const { data } = await axios.get(`${API_BASE}/search/${encodeURIComponent(keyword)}/all/ar`, { timeout: 10000 })
      if (!data.data?.matches?.length) return m.reply(`🔍 لا نتائج لـ "${keyword}"`)
      let msg = `🔍 *نتائج البحث عن:* "${keyword}" (${data.data.matches.length})\\n\\n`
      data.data.matches.slice(0, 10).forEach(m => {
        msg += `${m.surah.number}:${m.numberInSurah} - ${m.text.slice(0, 100)}...\\n`
      })
      return m.reply(msg)
    }

    // آية محددة (تنسيق: 2:255 أو سورة 2 آية 255)
    if (!query) {
      return conn.sendMessage(m.chat, {
        text: `📖 *القرآن الكريم*\\n\\n` +
          `الاستخدامات:\\n` +
          `\`${usedPrefix}quran 2:255\` - آية الكرسي\\n` +
          `\`${usedPrefix}quran 1\` - سورة الفاتحة\\n` +
          `\`${usedPrefix}quran بحث رحمة\` - بحث\\n` +
          `\`${usedPrefix}quran عشوائي\` - سورة عشوائية\\n` +
          `\`${usedPrefix}quran آية\` - آية عشوائية`,
        footer: 'LIGHT BOT • Quran',
        buttons: [
          { name: 'quick_reply', params: { display_text: '📖 آية الكرسي', id: `${usedPrefix}quran 2:255` } },
          { name: 'quick_reply', params: { display_text: '📖 سورة الفاتحة', id: `${usedPrefix}quran 1` } },
          { name: 'quick_reply', params: { display_text: '🎲 عشوائي', id: `${usedPrefix}quran عشوائي` } },
          { name: 'quick_reply', params: { display_text: '📋 السور', id: `${usedPrefix}quran السور` } }
        ]
      }, { quoted: m })
    }


    // تنسيق سورة:آية
    if (query.includes(':')) {
      const [surah, ayah] = query.split(':').map(Number)
      if (surah && ayah) {
        await m.react('📖')
        return fetchAyah(m, conn, surah, ayah)
      }
    }

    // رقم سورة فقط
    const surahNum = parseInt(query)
    if (surahNum && surahNum >= 1 && surahNum <= 114) {
      await m.react('📖')
      return fetchSurah(m, conn, surahNum)
    }

    // بحث نصي
    await m.react('🔍')
    const { data } = await axios.get(`${API_BASE}/search/${encodeURIComponent(query)}/all/ar`, { timeout: 10000 })
    if (!data.data?.matches?.length) return m.reply(`🔍 لا نتائج لـ "${query}"`)
    let msg = `🔍 *نتائج البحث عن:* "${query}"\\n\\n`
    data.data.matches.slice(0, 5).forEach(m => {
      msg += `${m.surah.number}:${m.numberInSurah} - ${m.text.slice(0, 150)}...\\n\\n`
    })
    await m.reply(msg)

  } catch (e) {
    console.error('quran:', e?.message || e)
    await m.react('❌')
    m.reply('❌ فشل جلب البيانات')
  }
}

async function fetchAyah(m, conn, surah, ayah) {
  try {
    const { data } = await axios.get(`${API_BASE}/ayah/${surah}:${ayah}/ar.alafasy`, { timeout: 10000 })
    const ayahData = data.data
    const msg = `📖 *${ayahData.surah.englishName} (${ayahData.surah.name}) - آية ${ayahData.numberInSurah}*\\n\\n${ayahData.text}\\n\\n🔗 الصفحة: ${ayahData.page}`
    await m.reply(msg)
    await m.react('✅')
  } catch {
    await m.reply('❌ لم يتم العثور على الآية')
  }
}

async function fetchSurah(m, conn, surah) {
  try {
    const { data } = await axios.get(`${API_BASE}/surah/${surah}/ar.alafasy`, { timeout: 15000 })
    const surahData = data.data
    let msg = `📖 *سورة ${surahData.englishName} (${surahData.name}) - ${surahData.ayahs.length} آية*\\n\\n`
    // عرض أول 5 آيات
    surahData.ayahs.slice(0, 5).forEach(a => {
      msg += `${a.numberInSurah}. ${a.text}\\n`
    })
    if (surahData.ayahs.length > 5) msg += `... و ${surahData.ayahs.length - 5} آيات أخرى\\n`
    msg += `\\n🔗 مكية/مدنية: ${surahData.revelationType}`
    await m.reply(msg)
    await m.react('✅')
  } catch {
    await m.reply('❌ لم يتم العثور على السورة')
  }
}

handler.command = ['quran', 'قرآن', 'قران']
handler.usage = ['quran <سورة:آية>', 'quran <رقم سورة>', 'quran بحث <كلمة>', 'quran عشوائي', 'quran آية', 'quran السور']
handler.category = 'islamic'
export default handler