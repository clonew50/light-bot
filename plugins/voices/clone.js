/*
  ═══════════════════════════════════════════
  🎙️ استنساخ صوت — TTS بأصوات مختلفة
  الأمر: .voice / .صوت / .tts <نص>
  ═══════════════════════════════════════════
*/
import axios from 'axios'

const cooldown = new Map()
const COOLDOWN_MS = 5000
const MAX_TEXT_LEN = 500

const VOICES = [
  { id: 'ar-SA', name: '🇸🇦 عربي (سعودية)', gender: 'female', emoji: '👩' },
  { id: 'ar-EG', name: '🇪🇬 عربي (مصرية)', gender: 'female', emoji: '👩' },
  { id: 'ar-AE', name: '🇦🇪 عربي (إماراتية)', gender: 'male', emoji: '👨' },
  { id: 'en-US', name: '🇺🇸 إنجليزي (أمريكي)', gender: 'female', emoji: '👩' },
  { id: 'en-GB', name: '🇬🇧 إنجليزي (بريطاني)', gender: 'male', emoji: '👨' },
  { id: 'fr-FR', name: '🇫🇷 فرنسي', gender: 'female', emoji: '👩' },
  { id: 'es-ES', name: '🇪🇸 إسباني', gender: 'male', emoji: '👨' },
  { id: 'tr-TR', name: '🇹🇷 تركي', gender: 'female', emoji: '👩' },
  { id: 'de-DE', name: '🇩🇪 ألماني', gender: 'male', emoji: '👨' },
  { id: 'it-IT', name: '🇮🇹 إيطالي', gender: 'female', emoji: '👩' },
]

const userVoice = new Map()

function buildVoiceButtons() {
  return VOICES.slice(0, 8).map(v => ({
    name: 'quick_reply',
    params: { display_text: `${v.emoji} ${v.name}`, id: `.voice صوت ${v.id}` }
  }))
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  try {
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN_MS) {
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية`)
    }

    const subCmd = args[0]?.toLowerCase()
    const inputText = text?.replace(/^(صوت|voice|tts)\s*/i, '').trim()

    // اختيار الصوت
    if (subCmd === 'صوت' || subCmd === 'voice' || subCmd === 'لغة') {
      const voiceId = args[1]
      if (!voiceId) {
        return conn.sendMessage(m.chat, {
          text: '🎙️ *اختر الصوت:*',
          footer: 'LIGHT BOT • TTS',
          buttons: VOICES.map(v => ({
            name: 'quick_reply',
            params: { display_text: `${v.emoji} ${v.name}`, id: `.voice صوت ${v.id}` }
          }))
        }, { quoted: m })
      }
      const voice = VOICES.find(v => v.id === voiceId)
      if (!voice) return m.reply('❌ صوت غير موجود')
      userVoice.set(m.sender, voiceId)
      return m.reply(`${voice.emoji} *تم اختيار:* ${voice.name}`)
    }

    // قائمة الأصوات
    if (subCmd === 'أصوات' || subCmd === 'voices' || subCmd === 'list') {
      let msg = '🎙️ *الأصوات المتاحة:*\\n\\n'
      VOICES.forEach(v => {
        msg += `${v.emoji} *${v.name}* (\`${v.id}\`)\\n`
      })
      return m.reply(msg)
    }

    // الصوت الحالي
    if (subCmd === 'حالي' || subCmd === 'current') {
      const current = userVoice.get(m.sender) || 'ar-SA'
      const voice = VOICES.find(v => v.id === current)
      return m.reply(`🎙️ *الصوت الحالي:* ${voice?.emoji} ${voice?.name}`)
    }

    // تحويل نص لصوت
    if (!inputText) {
      const current = userVoice.get(m.sender) || 'ar-SA'
      const voice = VOICES.find(v => v.id === current)
      return conn.sendMessage(m.chat, {
        text: `🎙️ *تحويل نص إلى صوت (TTS)*\\n\\n` +
          `اكتب النص بعد الأمر:\\n\`${usedPrefix}voice مرحباً بكم في لايت بوت\`\\n\\n` +
          `الصوت الحالي: ${voice?.emoji} ${voice?.name}`,
        footer: 'LIGHT BOT • TTS',
        buttons: [
          { name: 'quick_reply', params: { display_text: '🎙️ صوت', id: `${usedPrefix}voice صوت` } },
          { name: 'quick_reply', params: { display_text: '📋 أصوات', id: `${usedPrefix}voice أصوات` } }
        ]
      }, { quoted: m })
    }

    if (inputText.length > MAX_TEXT_LEN) {
      return m.reply(`❌ النص طويل جداً (الحد ${MAX_TEXT_LEN} حرف)`)
    }

    cooldown.set(m.sender, now)
    await m.react('🎙️')

    const voiceId = userVoice.get(m.sender) || 'ar-SA'

    // استخدام API لـ TTS (يمكن استبداله بـ API حقيقي)
    try {
      // محاولة استخدام API خارجي
      const ttsUrl = `https://api.tts.quest/v2/tts?text=${encodeURIComponent(inputText)}&voice=${voiceId}`
      const { data } = await axios.get(ttsUrl, { timeout: 15000, responseType: 'arraybuffer' })

      await conn.sendMessage(m.chat, {
        audio: data,
        mimetype: 'audio/mpeg',
        ptt: true, // كرسالة صوتية
        contextInfo: { mentionedJid: [m.sender] }
      }, { quoted: m })

      await m.react('✅')
    } catch (e) {
      // بديل: استخدام Google TTS أو رسالة نصية
      await m.reply(
        `🎙️ *النص جاهز للتحويل:*\\n\\n${inputText}\\n\\n` +
        `🔊 الصوت: ${VOICES.find(v => v.id === voiceId)?.name}\\n\\n` +
        `⚠️ API الصوتي غير متاح حالياً، جرب لاحقاً`
      )
      await m.react('⚠️')
    }

  } catch (e) {
    console.error('voice:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ في تحويل النص')
  }
}

handler.command = ['voice', 'صوت', 'tts', 'تكلم']
handler.usage = ['voice <نص>', 'voice صوت <ar-SA|en-US|...>', 'voice أصوات', 'voice حالي']
handler.category = 'voices'
handler.cooldown = 5
export default handler