// ./plugins/reactsticker.js - نسخة صحيحة 100%

export class ReactImg {
  constructor(conn) {
    if (!conn || typeof conn.relayMessage !== "function") {
      throw new TypeError("Compatible relayMessage connection required");
    }
    this.conn = conn;
  }

  build({ parentMessageKey, associationType = 11, ...image }) {
    if (!image.url) throw new TypeError("Image URL is required");
    if (!parentMessageKey) throw new TypeError("parentMessageKey is required - reply to a message");

    return {
      messageContextInfo: {
        messageAssociation: { associationType, parentMessageKey }
      },
      stickerMessage: {
        ...image,
        isAvatar: false,
        isAiSticker: false,
        isLottie: false
      }
    };
  }

  async send(chatId, options) {
    const message = this.build(options);
    return this.conn.relayMessage(chatId, message, {});
  }

  static create(conn) {
    return new ReactImg(conn);
  }
}

// ❌ حيدت من هنا: export default ReactImg
// حيت غادي نديرو export default واحد لتحت ديال handler

// ============ HANDLER ============

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const react = ReactImg.create(conn);

  // 1 - خاصك تريبلي على شي ميساج
  if (!m.quoted) {
    return m.reply(
      `Reply على شي ميساج وبعدها دير:\n\n` +
      `*${usedPrefix + command} <link sticker>*\n\n` +
      `مثال:\n${usedPrefix + command} https://example.com/sticker.webp`
    )
  }

  // 2 - جيب اللينك
  let url = args[0]
  let width = 64
  let height = 64
  let mimetype = 'image/webp'

  // إلا ريبلتي على ستيكر، خد اللينك ديالو نيشان
  if (!url && m.quoted?.msg?.stickerMessage?.url) {
    url = m.quoted.msg.stickerMessage.url
    width = m.quoted.msg.stickerMessage.width || 64
    height = m.quoted.msg.stickerMessage.height || 64
    mimetype = m.quoted.msg.stickerMessage.mimetype || 'image/webp'
  }

  if (!url) {
    return m.reply(`خاصك تعطيني لينك ديال الستيكر\n\nمثال:\n${usedPrefix + command} https://example.com/sticker.webp`)
  }

  try {
    await react.send(m.chat, {
      parentMessageKey: m.quoted.key,
      url,
      mimetype,
      width,
      height,
      fileSha256: m.quoted?.msg?.stickerMessage?.fileSha256 || undefined,
      fileEncSha256: m.quoted?.msg?.stickerMessage?.fileEncSha256 || undefined,
      mediaKey: m.quoted?.msg?.stickerMessage?.mediaKey || undefined,
      directPath: m.quoted?.msg?.stickerMessage?.directPath || undefined,
    })

    await m.reply('✅ Sticker Reaction تصيفط!')
  } catch (e) {
    console.error(e)
    await m.reply('❌ فشل: ' + e.message)
  }
}

handler.help = ['reactsticker <link>']
handler.tags = ['sticker']
handler.command = /^(reactsticker|rsticker|reactimg|rimg)$/i

// ✅ غير هذا هو export default الوحيد في الملف كامل
export default handler