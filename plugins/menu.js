import moment from 'moment-timezone'
import axios from 'axios'
import crypto from 'crypto'
import { prepareWAMessageMedia, generateWAMessageFromContent } from 'baileys'

const now = moment().tz('Africa/Casablanca')

function clockString(ms) {
  let h = Math.floor(ms / 3600000)
  let m = Math.floor((ms % 3600000) / 60000)
  let s = Math.floor((ms % 60000) / 1000)
  return `${h}h ${m}m ${s}s`
}

const devNumber = '79006443503783'
const videoUrl = 'https://cdn.zass.in/XYhlqsupY0.mp4'
const devLink = `https://wa.me/${devNumber}`

function buildNativeButtons(totalCommands, usedPrefix, countTag, valid) {
  const catRows = valid.filter(v => v !== 'all').map(c => ({ title: c.toUpperCase(), description: `${countTag(c)} command`, id: c === 'owner' ? '.o' : `${usedPrefix}menu ${c}` }))
  const btn1 = { title: "\u0000", sections: [{ title: "YONO", highlight_label: "MAIN MENU", rows: [{ title: "All Menu", description: `${totalCommands} commands`, id: `${usedPrefix}menu all` }] }, { title: "Category", rows: catRows }], icon: "DEFAULT" }
  const btn2 = { title: "\u0000", sections: [{ title: "YONO", highlight_label: "INFORMATION", rows: [
    { title: "Menu", description: "Back to main menu", id: `${usedPrefix}menu` },
    { title: "Owner", description: "Contact bot owner", id: ".o" },
    { title: "ping", description: "Check bot speed", id: ".ping" }
  ] }], icon: "REVIEW" }
  const btn3 = { display_text: "\u0000", url: devLink, merchant_url: devLink, icon: "PROMOTION" }
  return [
    { name: "" },
    { name: 'single_select', buttonParamsJson: JSON.stringify(btn1) },
    { name: 'single_select', buttonParamsJson: JSON.stringify(btn2) },
    { name: 'cta_url', buttonParamsJson: JSON.stringify(btn3) }
  ]
}

function buildMetaCards(menuText, devNumber, menuTitle, userInfo) {
  return {
    uuid: '4b108b98-fb8e-4d18-a24a-9572b5805785',
    type: 'im_a2ui',
    data: JSON.stringify({
      version: 'v0.9',
      createSurface: {
        surfaceId: 'starcore-widget=4b108b98-fb8e-4d18-a24a-9572b5805785',
        catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        components: [
          { id: 'root', component: 'Column', children: ['card_4', 'card_a', 'card_polling', 'card_e'] },
          { id: 'image_0', component: 'Image', url: 'https://raw.githubusercontent.com/vinikjkkj/zapo/master/.github/assets/logo-light.png', variant: 'smallFeature', fit: 'contain' },
          { id: 'text_1', component: 'Text', text: '🤖 Yono BOT', variant: 'h1' },
          { id: 'text_2', component: 'Text', text: `⚡ Fast, lightweight & stable WhatsApp bot.\n\n${userInfo.user}\n${userInfo.status}`, variant: 'body' },
          { id: 'column_3', component: 'Column', children: ['image_0', 'text_1', 'text_2'] },
          { id: 'card_4', component: 'Card', child: 'column_3' },
          { id: 'text_5', component: 'Text', text: '✨ Main Features', variant: 'h2' },
          { id: 'checkbox_6', component: 'CheckBox', label: 'Plugin system (command + alias)', value: true },
          { id: 'checkbox_7', component: 'CheckBox', label: 'Reload plugins without full restart', value: true },
          { id: 'checkbox_8', component: 'CheckBox', label: 'Session stored in SQLite', value: true },
          { id: 'column_9', component: 'Column', children: ['text_5', 'checkbox_6', 'checkbox_7', 'checkbox_8'] },
          { id: 'card_a', component: 'Card', child: 'column_9' },
          { id: 'text_poll', component: 'Text', text: menuTitle, variant: 'h2' },
          { id: 'text_poll2', component: 'Text', text: menuText, variant: 'body' },
          { id: 'text_status', component: 'Text', text: userInfo.status, variant: 'body' },
          { id: 'text_user', component: 'Text', text: userInfo.user, variant: 'body' },
          { id: 'column_poll', component: 'Column', children: ['text_poll', 'text_poll2', 'text_status', 'text_user'] },
          { id: 'card_polling', component: 'Card', child: 'column_poll' },
          { id: 'text_b', component: 'Text', text: '📞 Contact Developer', variant: 'h2' },
          { id: 'text_c', component: 'Text', text: `Tap the button below to contact the developer ${devNumber}.`, variant: 'caption' },
          { id: 'column_d', component: 'Column', children: ['text_b', 'text_c'] },
          { id: 'card_e', component: 'Card', child: 'column_d' }
        ]
      }
    })
  }
}

let handler = async (m, { conn, usedPrefix, args }) => {
  if (conn.menuLastRequest && Date.now() - conn.menuLastRequest < 2000) {
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  conn.menuLastRequest = Date.now()

  await conn.relayMessage(m.chat, {
    interactiveMessage: {
      header: { title: "Yono BOT" },
      body: { text: "Please wait a moment, Yono BOT is preparing the command list..." },
      footer: { text: "\u0000" },
      nativeFlowMessage: { buttons: [{ name: "inapp_signup", buttonParamsJson: "{}" }] },
      contextInfo: {
        forwardingScore: 99, isForwarded: true,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast",
        quotedMessage: {
          orderMessage: {
            orderId: "2026",
            thumbnail: "[STRIPPED 2727 bytes]",
            orderTitle: "Yono BOT - 2026 ELEMENTS",
            sellerJid: "0@s.whatsapp.net",
            totalAmount1000: 2026000,
            totalCurrencyCode: "IDR",
            message: "YONO - 2026 DOCS",
            surface: 0, itemCount: 2026
          }
        }
      }
    },
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, messageSecret: crypto.randomBytes(32) }
  }, {})

  await new Promise(r => setTimeout(r, 500))

  const cmd = (args[0] || 'list').toLowerCase()
  let tag = '@' + m.sender.split('@')[0]
  let uptime = clockString(process.uptime() * 1000)

  const tagCount = {}
  const tagHelpMapping = {}
  const commandProperties = {}

  Object.keys(global.plugins).filter(plugin => !global.plugins[plugin].disabled).forEach(plugin => {
    const pluginData = global.plugins[plugin]
    const tagsArray = Array.isArray(pluginData.tags) ? pluginData.tags : []
    if (tagsArray.length > 0) {
      const helpArray = Array.isArray(pluginData.help) ? pluginData.help : [pluginData.help]
      tagsArray.forEach(tag => {
        if (tag) {
          if (tagCount[tag]) { tagCount[tag] += helpArray.length; tagHelpMapping[tag].push(...helpArray) }
          else { tagCount[tag] = helpArray.length; tagHelpMapping[tag] = [...helpArray] }
          helpArray.forEach(helpItem => {
            if (!commandProperties[helpItem]) commandProperties[helpItem] = { premium: pluginData.premium || false, limit: pluginData.limit || false }
          })
        }
      })
    }
  })

  const valid = Object.keys(tagCount)
  const totalCommands = Object.values(tagCount).reduce((a, b) => a + b, 0)
  const totalUser = Object.keys(db?.data?.users || {}).length
  const countTag = (t) => tagCount[t] || 0
  const ping = `${Math.floor(Math.random() * 80 + 50)} ms`
  const date = now.format('DD MMMM YYYY')
  const name = m.pushName || 'woli'

  let menuTitle = 'MAIN MENU'
  let menuText = ''

  if (cmd === 'list') {
    menuTitle = '📋 MAIN MENU'
    menuText = `👋 Hello ${tag}\n\n👤 USER INFO\n├ Name : ${name}\n└ Number : ${m.sender.split('@')[0]}\n\n🤖 BOT INFO\n├ Bot : Yono BOT\n├ Menu : ${totalCommands} Command\n├ User : ${totalUser} User\n├ Ping : ${ping}\n├ Uptime : ${uptime}\n└ Date : ${date}\n\n📌 Select a category below`
  } else if (cmd === 'all') {
    menuTitle = '📋 ALL MENU'
    let txt = ''
    for (let t of valid) {
      let list = tagHelpMapping[t] || []
      txt += `\n${t.toUpperCase()} (${list.length})\n`
      list.forEach(h => txt += `- ${usedPrefix}${h}\n`)
    }
    menuText = txt.trim()
  } else if (tagCount[cmd]) {
    menuTitle = `📂 ${cmd.toUpperCase()} MENU - ${tagHelpMapping[cmd].length} CMD`
    menuText = tagHelpMapping[cmd].map(h => {
      const p = commandProperties[h] || {}
      return `- ${usedPrefix}${h}${p.premium ? ' P' : ''}${p.limit ? ' L' : ''}`
    }).join('\n')
  } else {
    await conn.reply(m.chat, `Not found [ ${cmd} ] use [ ${usedPrefix}menu list ] or [ ${usedPrefix}menu all ] to see the available list`, m)
    return
  }

  let media
  try {
    const res = await axios.get(videoUrl, { responseType: 'arraybuffer', maxRedirects: 5, timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'video/mp4,video/*,*/*' } })
    let buffer = Buffer.from(res.data)
    if (buffer.length < 10000 || buffer.toString('utf8', 0, 300).includes('<html')) {
      let html = buffer.toString()
      let found = html.match(/https?:\/\/[^"'\s]+\.mp4/gi)
      if (found && found[0]) {
        let r2 = await axios.get(found[0], { responseType: 'arraybuffer', maxRedirects: 5, timeout: 30000 })
        buffer = Buffer.from(r2.data)
      } else throw new Error('tmpfiles link dead')
    }
    media = await prepareWAMessageMedia({ video: buffer, gifPlayback: true, mimetype: 'video/mp4' }, { upload: conn.waUploadToServer })
  } catch (e) {
    console.log('Video failed:', e.message)
    media = await prepareWAMessageMedia({ video: { url: videoUrl }, gifPlayback: true }, { upload: conn.waUploadToServer })
  }

  const userInfo = {
    status: `🟢 ONLINE | ${date} | ${ping} | ${uptime}`,
    user: `👤 ${name} - ${m.sender.split('@')[0]} - ${ping} - ${totalUser} Users`
  }
  const bloksWidget = buildMetaCards(menuText, devNumber, menuTitle, userInfo)

  const interactiveMessage = {
    body: { text: "\u0000" },
    footer: { text: "\u0000" },
    header: { hasMediaAttachment: true, subtitle: '', videoMessage: media.videoMessage },
    nativeFlowMessage: {
      buttons: buildNativeButtons(totalCommands, usedPrefix, countTag, [...valid, 'all']),
      messageParamsJson: JSON.stringify({}),
      messageVersion: 1
    },
    bloksWidget: bloksWidget,
    contextInfo: { forwardingScore: 999, isForwarded: true }
  }

  const fkontak = {
    key: { participants: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'Yono' },
    message: {
      contactMessage: {
        displayName: 'YONO',
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;Yono;;;\nFN:Yono\nitem1.TEL;waid=${devNumber}:${devNumber}\nitem1.X-ABLabel:Phone\nEND:VCARD`
      }
    },
    participant: '0@s.whatsapp.net'
  }

  const msg = generateWAMessageFromContent(m.chat, { interactiveMessage: interactiveMessage }, { userJid: conn.user.id, quoted: fkontak })

  msg.message.senderKeyDistributionMessage = {
    groupId: "120363411834515372@g.us",
    axolotlSenderKeyDistributionMessage: "MwisrvVqEAkaIH5V9fCVi7eATm1/yHsVVPJ/3V5jC2808HsfvB7oFv5zIiEFxv38znEByox+AK30g5b2M1PvewfNtmL+cq8HJtFbrTA="
  }

  await conn.relayMessage(m.chat, msg.message, {
    messageId: msg.key.id,
    additionalNodes: [{
      tag: "biz",
      attrs: { actual_actors: "2", host_storage: "2", privacy_mode_ts: "1710184201" },
      content: [
        { tag: "engagement", attrs: { customer_service_state: "open", conversation_state: "open" } },
        { tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }
      ]
    }]
  })
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu']
export default handler