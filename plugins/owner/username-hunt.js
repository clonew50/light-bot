/*
  ═══════════════════════════════════════════
  🎣 صيد اليوزرات + تحليل بالذكاء الاصطناعي
  الأوامر:
    .صيد-يوزر <عدد>     (3 = ثلاثي، 4 = رباعي ... حتى 15)
    .صيد-يوزرات <عدد>   (نفس الأمر)
    .وقف-صيد            (إيقاف عملية الصيد)
    .تحليل-يوزر <يوزر>  (تحليل يوزر واحد)
    .يوزر-جرب <يوزر>    (فحص هل اليوزر متاح على واتساب)
  صياد اليوزرات: نور ديف 💤🖤
  ═══════════════════════════════════════════
*/
import fs from 'fs'
import path from 'path'
import { Boom } from '@hapi/boom'
import { S_WHATSAPP_NET, getBinaryNodeChild } from '@whiskeysockets/baileys'

const _0xW = [10, 62, 32, 119873, 119900, 119906, 119903, 32, 119889, 119890, 119907, 32, 128164, 128420]
const FOOTER = String.fromCodePoint(..._0xW)

const SAVE_FILE = './database/username_hunt.json'
const AI_API_URL = 'https://nour-dev.dyz/api/ai/claude?text='

// gobal fetch متاح في Node 18+، ونرجع لـ node-fetch لو مش موجود
const fetchFn = globalThis.fetch || (await import('node-fetch')).default

const sessions = new Map()

// تفاعل آمن — لو م.UNSUPPORTED أو الرسالة قديمة ما يوقفش الأمر
const safeReact = async (m, emoji) => {
  try { await m.react(emoji) } catch {}
}

async function analyzeWithRealAI(usernames, userContext = '') {
  if (!usernames || usernames.length === 0) return []

  try {
    const prompt = `أنت خبير محترف في العلامات التجارية (Branding) وأسماء المستخدمين (Usernames) على منصات التواصل.
المطلوب تحليل هذه القائمة من أسماء المستخدمين المتاحة حالياً على واتساب:
${JSON.stringify(usernames)}

سياق إضافي من المستخدم: "${userContext || 'لا يوجد'}"

قم بتقييم كل اسم بناءً على المعايير التالية:
1. سهولة النطق والكتابة (Pronounceability & Typability).
2. المعنى (Meaning): هل الكلمة لها معنى حقيقي باللغة الإنجليزية أو العربية؟
3. الشكل البصري (Visual Appeal): هل هي متناسقة وجذابة بصرياً؟
4. الخلو من العشوائية: تجاهل تماماً الأسماء التي تبدو كضربة لوحة مفاتيح (مثل: asdf, qwer, xzcv).

أعط كل اسم تقييماً من 1 إلى 5 (حيث 5 هو الأفضل)، وحدد ما إذا كان "مميزاً" (isPremium: true) إذا كان يستحق الحجز فوراً.
يجب أن يكون الرد عبارة عن مصفوفة JSON صالحة فقط دون أي نصوص خارجية، بهذا الشكل:
[
  {
    "username": "اسم_اليوزر",
    "score": 4.5,
    "isPremium": true,
    "reasons": ["السبب الأول بالعربية", "السبب الثاني"]
  }
]`

    const apiUrl = `${AI_API_URL}${encodeURIComponent(prompt)}`
    const res = await fetchFn(apiUrl)
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
    const data = await res.json()
    const textResponse = data.response || data.text || ''

    const match = String(textResponse).match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error('AI API Error:', e.message)
  }

  return usernames.map(u => ({
    username: u,
    score: u.length <= 3 ? 3.5 : 2.5,
    isPremium: u.length <= 3,
    reasons: ['متاح للاستخدام', u.length <= 3 ? 'قصير وقوي' : 'مقبول']
  }))
}

function generateRandomUsername(minLen = 3, maxLen = 4) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen
  let result = chars[Math.floor(Math.random() * 26)]
  for (let i = 1; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// w:mex query — نفس أسلوب plugins/stickers-pack.js (conn.query + generateMessageTag)
// ملحوظة: بن نادي conn.query مباشرة مش ب تمرره كـ callback، عشان this يفضل مربوط.
async function checkUsernames(conn, usernames) {
  const msgId = (typeof conn.generateMessageTag === 'function'
    ? await conn.generateMessageTag()
    : '') || Date.now().toString()

  const result = await conn.query({
    tag: 'iq',
    attrs: { id: msgId, type: 'get', to: S_WHATSAPP_NET, xmlns: 'w:mex' },
    content: [{
      tag: 'query',
      attrs: { query_id: '27134626522840286' },
      content: Buffer.from(JSON.stringify({ variables: { usernames } }), 'utf-8')
    }]
  })

  const child = getBinaryNodeChild(result, 'result')

  if (child?.content) {
    const data = JSON.parse(child.content.toString())
    if (data.errors?.length) {
      throw new Boom(data.errors[0].message, { statusCode: data.errors[0].extensions?.error_code || 400 })
    }
    return data?.data?.xwa2_username_check_multi
  }
  throw new Boom('فشل التحقق من اليوزرات', { statusCode: 400 })
}

function saveFoundUsernames(usernames, analysisData = []) {
  try {
    const dir = path.dirname(SAVE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    let existing = []
    if (fs.existsSync(SAVE_FILE)) {
      existing = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8'))
    }
    const newEntries = usernames.map((u, i) => ({
      username: u,
      foundAt: new Date().toISOString(),
      aiAnalysis: analysisData[i] || null
    }))
    existing.push(...newEntries)
    fs.writeFileSync(SAVE_FILE, JSON.stringify(existing, null, 2))
  } catch (e) {
    console.error('Save error:', e)
  }
}

const handler = async (m, { conn, text, command, usedPrefix }) => {
  const isPrefix = usedPrefix || '.'

  try {
    // ─────────────── تحليل يوزر واحد ───────────────
    if (command === 'تحليل-يوزر') {
      const username = text?.trim()
      if (!username) {
        return m.reply(`❌ *يرجى إرسال اليوزر المراد تحليله.*\n> مثال: ${isPrefix}تحليل-يوزر luffy`)
      }

      await safeReact(m,'🧠')
      const analysisArr = await analyzeWithRealAI([username])
      const analysis = analysisArr[0] || { username, score: 3, isPremium: true, reasons: ['يوزر جيد'] }

      const rating = analysis.score >= 4 ? '⭐⭐⭐⭐⭐' : analysis.score >= 3 ? '⭐⭐⭐⭐' : '⭐⭐⭐'

      const report = `╭─〔 🔍 *تحليل الذكاء الاصطناعي* 〕─╮\n` +
        `│ 👤 *اليوزر:* \`${analysis.username}\`\n` +
        `│ 📊 *التقييم:* ${analysis.score}/5 ${rating}\n` +
        `│ 🎯 *مميز وله معنى:* ${analysis.isPremium ? '✅ نعم' : '❌ عشوائي'}\n` +
        `├───────────────────────────────\n` +
        `│ 💡 *الأسباب والمعنى:*\n` +
        analysis.reasons.map(r => `│ • ${r}`).join('\n') + '\n' +
        `╰───────────────────────────────╯\n\n${FOOTER}`

      return m.reply(report)
    }

    // ─────────────── فحص يوزر واحد ───────────────
    if (command === 'يوزر-جرب') {
      const username = text?.trim().toLowerCase()
      if (!username) {
        return m.reply(`❌ *يرجى إرسال اليوزر المراد تجربته.*\n> مثال: ${isPrefix}يوزر-جرب luffy`)
      }

      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return m.reply(`❌ *اليوزر غير صالح.*\n> يجب أن يكون بين 3 و 20 حرفاً (إنجليزي وأرقام فقط).`)
      }

      await safeReact(m,'⏳')

      try {
        const res = await checkUsernames(conn, [username])
        const result = res.results?.[0]
        const isAvailable = result?.response?.result === 'SUCCESS'

        const msg = isAvailable
          ? `╭─〔 ✅ *اليوزر متاح* 〕─╮\n│ 🔤 *اليوزر:* \`${username}\`\n│ 📊 *الحالة:* متاح للاستخدام 🟢\n│ ⚡ *يمكنك حجزه الآن!*\n╰───────────────────────────────╯\n\n${FOOTER}`
          : `╭─〔 ❌ *اليوزر غير متاح* 〕─╮\n│ 🔤 *اليوزر:* \`${username}\`\n│ 📊 *الحالة:* محجوز بالفعل 🔴\n│ ⚠️ *جرب يوزر آخر.*\n╰───────────────────────────────╯\n\n${FOOTER}`

        await m.reply(msg)
        await safeReact(m,isAvailable ? '✅' : '❌')
      } catch (e) {
        await safeReact(m,'❌')
        await m.reply(`❌ *فشل التحقق.*\n> السبب: ${e.message}`)
      }
      return
    }

    // ─────────────── إيقاف الصيد ───────────────
    if (command === 'وقف-صيد') {
      const session = sessions.get(m.sender)
      if (!session?.hunting) return m.reply('❌ *لا توجد عملية صيد نشطة حالياً.*')

      session.hunting = false
      await safeReact(m,'🛑')
      return m.reply('🛑 *جاري إيقاف الصيد وجلب النتائج...*')
    }

    // ─────────────── بدء الصيد ───────────────
    if (command === 'صيد-يوزر' || command === 'صيد-يوزرات') {
      if (sessions.get(m.sender)?.hunting) {
        return m.reply(`⏳ *عملية صيد نشطة بالفعل، أرسل ${isPrefix}وقف-صيد للإيقاف.*`)
      }

      const args = text?.trim() ? text.split(/\s+/) : []
      let length = parseInt(args[0])

      if (isNaN(length) || length < 3 || length > 15) {
        length = 3
      }

      sessions.set(m.sender, { hunting: true, found: [], tried: 0, aiFiltered: 0 })

      await safeReact(m,'🤖')
      await m.reply(
        `╭─〔 🤖 *بدأ الصيد الآلي* 〕─╮\n` +
        `│ 🔤 *الطول:* ${length} أحرف\n` +
        `│ 🧠 *الفلترة:* ذكاء اصطناعي (Claude)\n` +
        `│ 🛑 *للإيقاف:* ${isPrefix}وقف-صيد\n` +
        `╰───────────────────────────────╯\n\n` +
        `_جاري البحث عن يوزرات مميزة..._`)

      let stoppedByLimit = false
      const maxRounds = 50

      for (let i = 0; i < maxRounds; i++) {
        const session = sessions.get(m.sender)
        if (!session?.hunting) break

        const batch = Array.from({ length: 15 }, () => generateRandomUsername(length, length))

        try {
          const res = await checkUsernames(conn, batch)
          const available = (res?.results || [])
            .filter(r => r.response?.result === 'SUCCESS')
            .map(r => r.username)

          if (available.length > 0) {
            const analyzedResults = await analyzeWithRealAI(available)

            const premiumOnes = analyzedResults.filter(a => a.isPremium || a.score >= 3)
            const regularOnes = analyzedResults.filter(a => !a.isPremium && a.score < 3)

            session.found.push(...available)
            session.aiFiltered += premiumOnes.length
            saveFoundUsernames(available, analyzedResults)

            let msg = `🎉 *تم صيد يوزرات وتحليلها!*\n\n`

            if (premiumOnes.length > 0) {
              msg += `╭─〔 🏆 *يوزرات مميزة (AI Choice)* 〕─╮\n`
              msg += premiumOnes.map(a => {
                const stars = a.score >= 4 ? '🔥' : '⭐'
                const reasonText = a.reasons?.[0] ? ` (${a.reasons[0]})` : ''
                return `│ ${stars} \`${a.username}\` - تقييم: ${a.score}${reasonText}`
              }).join('\n') + '\n'
              msg += `╰───────────────────────────────╯\n\n`
            }

            if (regularOnes.length > 0) {
              msg += `╭─〔 📋 *يوزرات أخرى متاحة* 〕─╮\n`
              msg += regularOnes.map(a => `│ ✅ \`${a.username}\``).join('\n') + '\n'
              msg += `╰───────────────────────────────╯\n\n`
            }

            await m.reply(msg + FOOTER)
          }

          session.tried += batch.length
        } catch (e) {
          console.error('Hunt Error:', e.message)
          if (e.message?.includes('rate') || e.message?.includes('limit') || e.statusCode === 429) {
            stoppedByLimit = true
            session.hunting = false
            break
          }
        }

        await new Promise(r => setTimeout(r, 2000))
      }

      const session = sessions.get(m.sender)
      const foundList = session?.found?.length
        ? session.found.map(u => `• \`${u}\``).join('\n')
        : 'لا يوجد'

      await safeReact(m,stoppedByLimit ? '⚠️' : '✅')

      let finalMsg = stoppedByLimit
        ? `╭─〔 ⚠️ *تم إيقاف الصيد (حد واتساب)* 〕─╮\n│ 📡 *السبب:* وصل البوت للحد الأقصى من الطلبات (Rate Limit).\n│ 🛡️ *يرجى الانتظار ساعة قبل المحاولة مجدداً.*\n├───────────────────────────────\n`
        : `╭─〔 ✅ *انتهى الصيد بنجاح* 〕─╮\n`

      finalMsg += `│ 🔍 *تمت تجربة:* ${session?.tried || 0} يوزر\n` +
        `│ 🎯 *المتاح الإجمالي:* ${session?.found?.length || 0}\n` +
        `│ 🏆 *المميزة (AI):* ${session?.aiFiltered || 0}\n` +
        `├───────────────────────────────\n` +
        `│ 📋 *قائمة المتاح:*\n` +
        foundList + '\n' +
        `╰───────────────────────────────╯\n\n` +
        FOOTER

      await m.reply(finalMsg)
      sessions.delete(m.sender)
      return
    }
  } catch (error) {
    console.error('صيد-يوزر Error:', error)
    try { await safeReact(m,'❌') } catch {}
    return m.reply(`❌ حدث خطأ: ${error?.message || error}`)
  }
}

handler.command = /^(صيد-يوزر|صيد-يوزرات|وقف-صيد|تحليل-يوزر|يوزر-جرب)$/i
handler.usage = ['صيد-يوزر 3', 'صيد-يوزر 4', 'وقف-صيد', 'تحليل-يوزر luffy', 'يوزر-جرب luffy']
handler.category = 'owner'
handler.owner = true
handler.usePrefix = true
handler.group = false
handler.admin = false
handler.limit = false

export default handler