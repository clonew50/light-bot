// plugins/stickers-pack.js
// 🕷️ حزمة ملصقات Pinterest 📦
// متوافق مع بوت 𝑳𝑰𝑮𝑯𝑻 (meowsab)
//
// الأوامر:
//   .ملصقات <بحث> [عدد]
//   .باكج   <بحث> [عدد]
//   .stickerpack / .pack
//
// ملاحظات التوافق:
//   - بيحمّل الصور من Pinterest، بيحوّلها WebP بـ sharp (مفيش حاجة لـ ffmpeg)،
//     وبيبنيها كـ Sticker Pack ويرسلها عبر relayMessage.
//   - الملفات المطلوبة: axios + jszip + sharp (كلها موجودة في package.json).
//   - contextInfo بتاخد قناة البوت تلقائيًا من config.info (idChannel/nameChannel).

import axios from 'axios'
import crypto from 'crypto'
import https from 'https'

/* ======================= Pinterest ======================= */

const PINTEREST_BASE = 'https://www.pinterest.com'
const PINTEREST_SEARCH_PATH = '/resource/BaseSearchResource/get/'
const PINTEREST_HEADERS = {
  accept: 'application/json, text/javascript, */*, q=0.01',
  referer: 'https://www.pinterest.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'x-app-version': 'a9522f',
  'x-pinterest-appstate': 'active',
  'x-pinterest-pws-handler': 'www/[username]/[slug].js',
  'x-requested-with': 'XMLHttpRequest'
}

async function getPinterestCookies() {
  try {
    const res = await axios.get(PINTEREST_BASE, { timeout: 15000 })
    const setCookies = res.headers['set-cookie']
    if (!setCookies) return null
    return setCookies.map((c) => c.split(';')[0].trim()).join('; ')
  } catch {
    return null
  }
}

async function searchPinterest(query, needed = 30) {
  const images = { static: [], animated: [] }
  const cookies = await getPinterestCookies()
  if (!cookies) return images

  let bookmarks = ['']
  let attempts = 0
  const maxAttempts = 10

  while (images.static.length + images.animated.length < needed && bookmarks.length && attempts < maxAttempts) {
    attempts++
    try {
      const params = {
        source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
        data: JSON.stringify({
          options: { isPrefetch: false, query, scope: 'pins', bookmarks, page_size: 50 },
          context: {}
        }),
        _: Date.now()
      }

      const { data } = await axios.get(`${PINTEREST_BASE}${PINTEREST_SEARCH_PATH}`, {
        headers: { ...PINTEREST_HEADERS, cookie: cookies },
        params,
        timeout: 15000
      })

      const results = data?.resource_response?.data?.results?.filter((v) => v?.images?.orig?.url) || []
      if (!results.length) break

      for (const r of results) {
        const url = r.images.orig.url
        if (url.endsWith('.gif')) images.animated.push(url)
        else images.static.push(url)
        if (images.static.length + images.animated.length >= needed) break
      }

      const nextBookmark = data?.resource_response?.bookmark
      if (!nextBookmark || nextBookmark === '-end-') break
      bookmarks = [nextBookmark]
    } catch {
      break
    }
  }

  return {
    static: [...new Set(images.static)].slice(0, needed),
    animated: [...new Set(images.animated)].slice(0, needed)
  }
}

/* ======================= تحويل الصور (sharp) ======================= */

async function getSharp() {
  try {
    const mod = await import('sharp')
    return mod.default
  } catch {
    throw new Error('❌ مكتبة sharp غير مثبتة\n📦 npm i sharp')
  }
}

// صورة/ملصق ثابت → WebP بمقاس واتساب
async function toStaticWebp(buffer) {
  const sharp = await getSharp()
  const out = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toBuffer()
  return { buffer: out, isAnimated: false }
}

// GIF متحرك → WebP متحرك (sharp يدعم الإطارات، مفيش ffmpeg)
async function toAnimatedWebp(buffer) {
  const sharp = await getSharp()
  const out = await sharp(buffer, { animated: true })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 75, loop: 0, effort: 4 })
    .toBuffer()
  return { buffer: out, isAnimated: true }
}

async function makeTrayWebp(buffer) {
  const sharp = await getSharp()
  return sharp(buffer, { animated: false }).resize(252, 252, { fit: 'cover' }).webp().toBuffer()
}

async function makeBlankTrayWebp() {
  const sharp = await getSharp()
  return sharp({
    create: { width: 252, height: 252, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).webp().toBuffer()
}

async function makeThumbnailJpeg(buffer) {
  const sharp = await getSharp()
  return sharp(buffer).resize(252, 252, { fit: 'cover' }).jpeg().toBuffer()
}

/* ======================= أدوات ======================= */

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

function toB64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/* ======================= رفع الوسائط لواتساب ======================= */

async function uploadToServer(conn, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
  const expanded = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112))
  const iv = expanded.subarray(0, 16)
  const cipherKey = expanded.subarray(16, 48)
  const macKey = expanded.subarray(48, 80)
  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const mac = crypto.createHmac('sha256', macKey).update(iv).update(encrypted).digest().subarray(0, 10)
  const encBuffer = Buffer.concat([encrypted, mac])
  const fileSha256 = sha256(buffer)
  const fileEncSha256 = sha256(encBuffer)

  const iq = await conn.query({
    tag: 'iq',
    attrs: {
      id: conn.generateMessageTag?.() ?? Date.now().toString(),
      to: 's.whatsapp.net',
      type: 'set',
      xmlns: 'w:m'
    },
    content: [{ tag: 'media_conn', attrs: {} }]
  })

  const mediaConn = iq.content?.find((v) => v.tag === 'media_conn')
  if (!mediaConn) throw new Error('media_conn غير موجود')
  const auth = mediaConn.attrs?.auth
  if (!auth) throw new Error('auth غير موجود')

  const hosts = (mediaConn.content || []).filter((v) => v.tag === 'host').map((v) => v.attrs?.hostname).filter(Boolean)
  if (!hosts.length) throw new Error('لا يوجد host للرفع')

  const token = encodeURIComponent(fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''))

  let lastError = null
  for (const host of hosts) {
    try {
      const json = await new Promise((resolve, reject) => {
        const url = new URL(`https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`)
        const req = https.request(
          {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              Origin: 'https://web.whatsapp.com',
              Referer: 'https://web.whatsapp.com/',
              'Content-Type': 'application/octet-stream',
              'Content-Length': encBuffer.length
            }
          },
          (res) => {
            let body = ''
            res.on('data', (c) => (body += c))
            res.on('end', () => {
              if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`فشل الرفع ${res.statusCode}`))
              try {
                resolve(JSON.parse(body))
              } catch {
                reject(new Error('رد غير JSON'))
              }
            })
          }
        )
        req.on('error', reject)
        req.write(encBuffer)
        req.end()
      })
      const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path
      if (!directPath) throw new Error('directPath غير موجود')
      return { mediaKey, fileLength: buffer.length, fileSha256, fileEncSha256, directPath, ...json }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError ?? new Error('جميع محاولات الرفع فشلت')
}

/* ======================= إرسال حزمة الملصقات ======================= */

async function sendStickerPack(conn, m, bot, pack, query) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const stickersMetadata = []

  for (const item of pack) {
    const fileName = `${toB64Url(sha256(item.buffer))}.webp`
    zip.file(fileName, item.buffer)
    stickersMetadata.push({
      fileName,
      isAnimated: item.isAnimated,
      emojis: [''],
      accessibilityLabel: '',
      isLottie: false,
      mimetype: 'image/webp'
    })
  }

  const trayIconFileName = 'tray_icon.webp'
  const traySource = pack.find((v) => !v.isAnimated)?.buffer || pack[0]?.buffer
  const trayBuffer = traySource ? await makeTrayWebp(traySource) : await makeBlankTrayWebp()
  zip.file(trayIconFileName, trayBuffer)

  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

  const packUpload = await uploadToServer(conn, archive, { hkdf: 'WhatsApp Sticker Pack Keys', mediaPath: '/mms/sticker-pack' })
  const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer)
  const thumbUpload = await uploadToServer(conn, thumbnailBuffer, {
    hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
    mediaPath: '/mms/thumbnail-sticker-pack',
    mediaKey: packUpload.mediaKey
  })

  // contextInfo: نستخدم قناة البوت من الإعدادات، مع fallback
  const info = bot?.config?.info || {}
  const contextInfo = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: info.idChannel || '120363405545946827@newsletter',
      newsletterName: info.nameChannel || '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      serverMessageId: '-1'
    }
  }

  await conn.relayMessage(
    m.chat,
    {
      messageContextInfo: { messageSecret: crypto.randomBytes(32) },
      stickerPackMessage: {
        stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
        name: '🕷️ ' + query,
        publisher: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
        packDescription: `🕷️ ${query}`,
        stickers: stickersMetadata,
        fileLength: packUpload.fileLength,
        fileSha256: packUpload.fileSha256,
        fileEncSha256: packUpload.fileEncSha256,
        mediaKey: packUpload.mediaKey,
        directPath: packUpload.directPath,
        mediaKeyTimestamp: Math.floor(Date.now() / 1000),
        stickerPackSize: packUpload.fileLength,
        stickerPackOrigin: 2,
        trayIconFileName,
        thumbnailDirectPath: thumbUpload.directPath,
        thumbnailSha256: thumbUpload.fileSha256,
        thumbnailEncSha256: thumbUpload.fileEncSha256,
        thumbnailHeight: 252,
        thumbnailWidth: 252,
        imageDataHash: thumbUpload.fileSha256.toString('base64'),
        contextInfo: contextInfo
      }
    },
    { quoted: m }
  )
}

/* ======================= الأمر ======================= */

let handler = async (m, { conn, text, prefix, command, bot }) => {
  try {
    m.react?.('🕷️')
  } catch {}

  if (!text) {
    return m.reply(`🕷️ ${prefix + command} <بحث> <عدد>\n🕷️ مثال: ${prefix + command} anime 10`)
  }

  let query = text
  let count = 10
  const parts = text.split(' ')
  const lastPart = parts[parts.length - 1]
  if (!isNaN(lastPart) && parts.length > 1) {
    count = Math.min(30, Math.max(1, parseInt(lastPart)))
    query = parts.slice(0, -1).join(' ')
  }

  let statusMsg = null
  try {
    statusMsg = await m.reply(`🕷️ جاري البحث عن *${query}* ...`)
  } catch {}

  const delStatus = async () => {
    try {
      if (statusMsg?.key) await conn.sendMessage(m.chat, { delete: statusMsg.key })
    } catch {}
  }

  try {
    const images = await searchPinterest(query, count)
    const allStatic = images.static
    const allAnimated = images.animated

    if (allStatic.length === 0 && allAnimated.length === 0) {
      await delStatus()
      return m.reply(`🕷️ لا توجد نتائج لـ ${query}`)
    }

    const pack = []
    const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'

    for (let i = 0; i < allStatic.length && pack.length < count; i++) {
      try {
        const res = await axios.get(allStatic[i], { headers: { 'User-Agent': UA }, responseType: 'arraybuffer', timeout: 15000 })
        const webp = await toStaticWebp(Buffer.from(res.data))
        pack.push(webp)
      } catch {}
    }

    for (let i = 0; i < allAnimated.length && pack.length < count; i++) {
      try {
        const res = await axios.get(allAnimated[i], { headers: { 'User-Agent': UA }, responseType: 'arraybuffer', timeout: 20000 })
        const webp = await toAnimatedWebp(Buffer.from(res.data))
        pack.push(webp)
      } catch {}
    }

    if (pack.length === 0) {
      await delStatus()
      return m.reply(`🕷️ تعذر معالجة أي ملصق`)
    }

    await delStatus()
    await sendStickerPack(conn, m, bot, pack, query)
  } catch (e) {
    console.error(e)
    await delStatus()
    m.reply(`🕷️ خطأ: ${e.message}`)
  }
}

handler.command = ['ملصقات', 'باكج', 'stickerpack', 'pack']
handler.usage = ['ملصقات [بحث] [عدد]', 'باكج [بحث] [عدد]']
handler.category = 'sticker'
handler.help = ['ملصقات', 'باكج']
handler.tags = ['sticker']

export default handler
