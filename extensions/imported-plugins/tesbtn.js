import sharp from 'sharp'

const PREFIX = '.'
const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vag9rMg0LKZ5n3Mh6n0r'
const FOOTER = 'Moszy AI MD'
const BOT_NAME = 'Moszy AI MD'
const OWNER_NUMBER = process.env.OWNER || '6281234567890'

const LOCATION_IMAGE_URL = 'https://cloud.yardansh.com/pOnMht.jpg'
const SUPPORT_URL = `https://wa.me/${OWNER_NUMBER.replace(/\D/g, '')}`

// ============ BUILDERS ============

function buildMainSelect() {
  return JSON.stringify({
    title: '\u0000',
    sections: [
      {
        title: FOOTER,
        highlight_label: 'MENU UTAMA',
        rows: [
          { title: 'All Menu', id: `${PREFIX}menu` },
          { title: 'Ping / Status', id: `${PREFIX}ping` },
          { title: 'Total Fitur', id: `${PREFIX}totalfitur` },
          { title: 'Owner', id: `${PREFIX}owner` }
        ]
      },
      {
        highlight_label: 'TOOLS',
        rows: [
          { title: 'Sticker', id: `${PREFIX}stiker` },
          { title: 'To Image', id: `${PREFIX}toimg` },
          { title: 'To MP3', id: `${PREFIX}tomp3` },
          { title: 'RVO', id: `${PREFIX}rvo` }
        ]
      },
      {
        highlight_label: 'GROUP',
        rows: [
          { title: 'Hidetag', id: `${PREFIX}hidetag` },
          { title: 'Link Grup', id: `${PREFIX}linkgrup` },
          { title: 'List Admin', id: `${PREFIX}listadmin` }
        ]
      }
    ],
    icon: 'DEFAULT'
  })
}

function buildInfoSelect() {
  return JSON.stringify({
    title: '\u0000',
    sections: [{
      title: FOOTER,
      highlight_label: 'INFORMASI',
      rows: [
        { title: 'Menu', id: `${PREFIX}menu` },
        { title: 'Owner', id: `${PREFIX}owner` },
        { title: 'Ping', id: `${PREFIX}ping` }
      ]
    }],
    icon: 'REVIEW'
  })
}

function buildCtaUrl() {
  return JSON.stringify({
    display_text: '\u0000',
    url: CHANNEL_URL,
    merchant_url: CHANNEL_URL,
    icon: 'PROMOTION'
  })
}

function buildMessageParams() {
  return JSON.stringify({
    limited_time_offer: {
      text: `${FOOTER} Support`,
      url: SUPPORT_URL,
      copy_code: `Created by Moszy`,
      expiration_time: Date.now() + 60 * 60 * 1000
    }
  })
}

function buildNativeButtons() {
  return [
    { name: '' },
    { name: 'single_select', buttonParamsJson: buildMainSelect() },
    { name: 'single_select', buttonParamsJson: buildInfoSelect() },
    { name: 'cta_url', buttonParamsJson: buildCtaUrl() }
  ]
}

function buildFakeCatalogQuote(thumbnailBytes) {
  const productId = '915302051'
  const product = {
    productId,
    title: FOOTER,
    description: `Moszy • Menu Bot`,
    retailerId: productId,
    url: CHANNEL_URL,
    productImageCount: 1
  }
  const productMessage = { product, businessOwnerJid: '0@s.whatsapp.net' }
  if (thumbnailBytes?.length) {
    productMessage.product.productImage = {
      mimetype: 'image/jpeg',
      jpegThumbnail: Buffer.isBuffer(thumbnailBytes) ? thumbnailBytes : Buffer.from(thumbnailBytes)
    }
  }
  return {
    key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast', id: `MOSZY-CATALOG-${Date.now()}` },
    message: { productMessage }
  }
}

async function buildLocationHeader() {
  try {
    const res = await fetch(LOCATION_IMAGE_URL, { signal: AbortSignal.timeout(10000) })
    const buf = Buffer.from(await res.arrayBuffer())
    const thumb = await sharp(buf).resize(300, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85, progressive: true }).toBuffer()
    return {
      header: {
        title: FOOTER,
        hasMediaAttachment: true,
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: FOOTER,
          address: 'Menu · Location Header',
          jpegThumbnail: thumb
        }
      },
      thumb,
      b64: thumb.toString('base64')
    }
  } catch {
    return { header: null, thumb: null, b64: '' }
  }
}

// ============ HANDLER REM BOT ============

let handler = async (m, { conn }) => {
  try {
    const jid = m.chat

    // PESAN 1 : PLAIN NATIVE FLOW
    const msg1 = {
      body: { text: '\u0000' },
      footer: { text: FOOTER },
      nativeFlowMessage: {
        buttons: buildNativeButtons(),
        messageParamsJson: buildMessageParams(),
        messageVersion: 1
      },
      contextInfo: { forwardingScore: 99, isForwarded: true }
    }

    await conn.relayMessage(jid, {
      viewOnceMessage: {
        message: { interactiveMessage: msg1 }
      }
    }, { participant: { jid: m.sender } })

    await new Promise(r => setTimeout(r, 1000))

    // PESAN 2 : FAKE CATALOG QUOTE (tanpa video biar stabil di REM)
    const msg2 = {
      body: { text: '\u0000' },
      footer: { text: FOOTER },
      nativeFlowMessage: {
        buttons: buildNativeButtons(),
        messageParamsJson: buildMessageParams(),
        messageVersion: 1
      },
      contextInfo: { forwardingScore: 99, isForwarded: true }
    }

    await conn.relayMessage(jid, {
      viewOnceMessage: {
        message: { interactiveMessage: msg2 }
      }
    }, { quoted: buildFakeCatalogQuote(null) })

    await new Promise(r => setTimeout(r, 1000))

    // PESAN 3 : LOCATION HEADER + CATALOG
    const { header: locHeader, thumb: locThumb, b64 } = await buildLocationHeader()

    const msg3 = {
      body: { text: '\u0000' },
      footer: { text: FOOTER },
      nativeFlowMessage: {
        buttons: buildNativeButtons(),
        messageParamsJson: buildMessageParams(),
        messageVersion: 1
      },
      contextInfo: {
        forwardingScore: 99,
        isForwarded: true,
        stanzaId: m.key?.id || '',
        participant: m.key?.participant || '0@s.whatsapp.net',
        quotedMessage: b64 ? {
          orderMessage: { thumbnail: b64, itemCount: 1, message: 'Moszy AI MD Location Header' }
        } : undefined,
        remoteJid: m.key?.remoteJid || '0@s.whatsapp.net'
      }
    }
    if (locHeader) msg3.header = locHeader

    await conn.relayMessage(jid, {
      viewOnceMessage: {
        message: { interactiveMessage: msg3 }
      }
    }, { quoted: buildFakeCatalogQuote(locThumb) })

  } catch (err) {
    console.error('[tesbtn REM]', err)
    await conn.sendMessage(m.chat, { text: `❌ Error: ${err.message?.slice(0,200)}` }, { quoted: m })
  }
}

handler.usage = ['tesbtn']
handler.category = 'owner'
handler.command = ['tesbtn', 'testbtn', 'btnnoxm', 'tesbtnflow']
handler.owner = true

export default handler