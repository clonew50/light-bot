/*
  ═══════════════════════════════════════════
  📋 قائمة الأصوات — مع معاينة
  الأمر: .voicelist / .أصوات / .قائمة_أصوات
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const cooldown = new Map()
const COOLDOWN_MS = 3000

const VOICE_CATEGORIES = {
  arabic: [
    { id: 'ar-SA-Standard-A', name: '🇸🇦 عربي سعودي (أنثى)', sample: 'مرحباً بكم' },
    { id: 'ar-SA-Standard-B', name: '🇸🇦 عربي سعودي (ذكر)', sample: 'أهلاً وسهلاً' },
    { id: 'ar-EG-Standard-A', name: '🇪🇬 عربي مصري (أنثى)', sample: 'ازيك يا صاحبي' },
    { id: 'ar-EG-Standard-B', name: '🇪🇬 عربي مصري (ذكر)', sample: 'صباح الخير' },
    { id: 'ar-AE-Standard-A', name: '🇦🇪 عربي إماراتي (أنثى)', sample: 'مرحباً' },
    { id: 'ar-XA-Standard-A', name: '🌍 عربي موحد (أنثى)', sample: 'السلام عليكم' },
  ],
  english: [
    { id: 'en-US-Standard-A', name: '🇺🇸 إنجليزي أمريكي (أنثى)', sample: 'Hello there' },
    { id: 'en-US-Standard-B', name: '🇺🇸 إنجليزي أمريكي (ذكر)', sample: 'Hi there' },
    { id: 'en-US-Standard-C', name: '🇺🇸 إنجليزي أمريكي (أنثى 2)', sample: 'Good morning' },
    { id: 'en-GB-Standard-A', name: '🇬🇧 إنجليزي بريطاني (أنثى)', sample: 'Good day' },
    { id: 'en-GB-Standard-B', name: '🇬🇧 إنجليزي بريطاني (ذكر)', sample: 'Cheers' },
    { id: 'en-AU-Standard-A', name: '🇦🇺 إنجليزي أسترالي', sample: 'G\'day mate' },
  ],
  international: [
    { id: 'fr-FR-Standard-A', name: '🇫🇷 فرنسي (أنثى)', sample: 'Bonjour' },
    { id: 'fr-FR-Standard-B', name: '🇫🇷 فرنسي (ذكر)', sample: 'Salut' },
    { id: 'es-ES-Standard-A', name: '🇪🇸 إسباني (أنثى)', sample: 'Hola' },
    { id: 'es-ES-Standard-B', name: '🇪🇸 إسباني (ذكر)', sample: 'Buenos días' },
    { id: 'de-DE-Standard-A', name: '🇩🇪 ألماني (أنثى)', sample: 'Hallo' },
    { id: 'de-DE-Standard-B', name: '🇩🇪 ألماني (ذكر)', sample: 'Guten Tag' },
    { id: 'it-IT-Standard-A', name: '🇮🇹 إيطالي (أنثى)', sample: 'Ciao' },
    { id: 'pt-BR-Standard-A', name: '🇧🇷 برتغالي برازيلي', sample: 'Olá' },
    { id: 'ru-RU-Standard-A', name: '🇷🇺 روسي (أنثى)', sample: 'Привет' },
    { id: 'ja-JP-Standard-A', name: '🇯🇵 ياباني (أنثى)', sample: 'こんにちは' },
    { id: 'ko-KR-Standard-A', name: '🇰🇷 كوري (أنثى)', sample: '안녕하세요' },
    { id: 'zh-CN-Standard-A', name: '🇨🇳 صيني (أنثى)', sample: '你好' },
    { id: 'hi-IN-Standard-A', name: '🇮🇳 هندي (أنثى)', sample: 'नमस्ते' },
    { id: 'tr-TR-Standard-A', name: '🇹🇷 تركي (أنثى)', sample: 'Merhaba' },
  ]
}

function getAllVoices() {
  return [
    ...VOICE_CATEGORIES.arabic.map(v => ({ ...v, category: 'arabic', catName: '🇸🇦 عربي' })),
    ...VOICE_CATEGORIES.english.map(v => ({ ...v, category: 'english', catName: '🇺🇸 إنجليزي' })),
    ...VOICE_CATEGORIES.international.map(v => ({ ...v, category: 'international', catName: '🌍 دولي' }))
  ]
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const allVoices = getAllVoices()

    // عرض فئة معينة
    if (subCmd === 'عربي' || subCmd === 'arabic') {
      return showCategory(m, VOICE_CATEGORIES.arabic, '🇸🇦 الأصوات العربية')
    }
    if (subCmd === 'إنجليزي' || subCmd === 'english' || subCmd === 'انجليزي') {
      return showCategory(m, VOICE_CATEGORIES.english, '🇺🇸 الأصوات الإنجليزية')
    }
    if (subCmd === 'دولي' || subCmd === 'international' || subCmd === 'عالمي') {
      return showCategory(m, VOICE_CATEGORIES.international, '🌍 الأصوات الدولية')
    }

    // بحث
    if (subCmd === 'بحث' || subCmd === 'search') {
      const query = args.slice(1).join(' ').toLowerCase()
      if (!query) return m.reply('❌ اكتب كلمة بحث: `.voicelist بحث en-US`')
      const results = allVoices.filter(v => v.id.toLowerCase().includes(query) || v.name.toLowerCase().includes(query))
      if (!results.length) return m.reply('🔍 لا نتائج')
      return showCategory(m, results, `🔍 نتائج البحث عن "${query}"`)
    }

    // معاينة صوت
    if (subCmd === 'معاينة' || subCmd === 'preview' || subCmd === 'test') {
      const voiceId = args[1]
      if (!voiceId) return m.reply('❌ حدد معرف الصوت: `.voicelist معاينة ar-SA-Standard-A`')
      const voice = allVoices.find(v => v.id === voiceId)
      if (!voice) return m.reply('❌ صوت غير موجود')

      cooldown.set(m.sender, now)
      await m.react('🎙️')

      try {
        const ttsUrl = `https://api.tts.quest/v2/tts?text=${encodeURIComponent(voice.sample)}&voice=${voice.id.replace('-Standard-', '-')}`
        const { data } = await axios.get(ttsUrl, { timeout: 15000, responseType: 'arraybuffer' })

        await conn.sendMessage(m.chat, {
          audio: data,
          mimetype: 'audio/mpeg',
          ptt: true,
          contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: m })
        await m.react('✅')
      } catch {
        await m.reply(`🎙️ *معاينة:* ${voice.name}\\n📝 النص: "${voice.sample}"\\n⚠️ API غير متاح حالياً`)
      }
      return
    }

    // إحصائيات
    if (subCmd === 'إحصائيات' || subCmd === 'stats') {
      return m.reply(
        `📊 *إحصائيات الأصوات:*\\n\\n` +
        `🇸🇦 عربي: ${VOICE_CATEGORIES.arabic.length}\\n` +
        `🇺🇸 إنجليزي: ${VOICE_CATEGORIES.english.length}\\n` +
        `🌍 دولي: ${VOICE_CATEGORIES.international.length}\\n` +
        `📋 الإجمالي: ${allVoices.length} صوت`
      )
    }

    // قائمة رئيسية مع أزرار الفئات
    cooldown.set(m.sender, now)
    return conn.sendMessage(m.chat, {
      text: `🎙️ *قائمة الأصوات (${allVoices.length} صوت)*\\n\\nاختر فئة للتصفح:`,
      footer: 'LIGHT BOT • Voice List',
      buttons: [
        { name: 'quick_reply', params: { display_text: '🇸🇦 عربي', id: `${usedPrefix}voicelist عربي` } },
        { name: 'quick_reply', params: { display_text: '🇺🇸 إنجليزي', id: `${usedPrefix}voicelist إنجليزي` } },
        { name: 'quick_reply', params: { display_text: '🌍 دولي', id: `${usedPrefix}voicelist دولي` } },
        { name: 'quick_reply', params: { display_text: '🔍 بحث', id: `${usedPrefix}voicelist بحث` } },
        { name: 'quick_reply', params: { display_text: '📊 إحصائيات', id: `${usedPrefix}voicelist إحصائيات` } }
      ]
    }, { quoted: m })

  } catch (e) {
    console.error('voicelist:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

function showCategory(m, voices, title) {
  let msg = `${title} (${voices.length}):\\n\\n`
  voices.forEach((v, i) => {
    msg += `${i + 1}. ${v.name}\\n   \`${v.id}\` — \"${v.sample}\"\\n\\n`
  })
  msg += `استخدم: \`.voicelist معاينة <id>\` للسماع`
  return m.reply(msg)
}

handler.command = ['voicelist', 'أصوات', 'قائمة_أصوات', 'voices_list']
handler.usage = ['voicelist', 'voicelist عربي', 'voicelist إنجليزي', 'voicelist دولي', 'voicelist بحث <كلمة>', 'voicelist معاينة <id>', 'voicelist إحصائيات']
handler.category = 'voices'
handler.cooldown = 3
export default handler