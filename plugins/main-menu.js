import { promises } from 'fs'
import { join } from 'path'
import os from 'os'

let handler = async (m, { conn, usedPrefix: _p, args, isPrems, isOwner, command: cmd }) => {

const defaultMenu = {
  before: '',
  header: '*ᗢ %category*',
  body: '- %cmd %isPremium %islimit',
  footer: '',
  after: '',
}
  const arrayTags = ['all', 'main', 'game', 'group', 'sticker', 'ai', 'internet', 'adult', 'subbot', 'tools', 'downloader', 'owner', 'info']
  let teks = `${args[0]}`.toLowerCase()
  if (!arrayTags.includes(teks)) teks = '404'

  const tagMap = {
    all:        { main: 'Main', game:'Game', group: 'Group', internet: 'Internet', adult:'Adult', downloader: 'Downloader', database: 'Database', sticker: 'Sticker', tools: 'Tools', subbot:'Sub-bot', ai: 'Artificial Intelligence', owner: 'Owner', info: 'Info' },
    main:       { main: 'Main' },
    game:       { game: 'Game' },
    ai:         { ai: 'Artificial Intelligence' },
    sticker:    { sticker: 'Sticker' },
    group:      { group: 'Group', admin: `Admin ${global.opts?.['restrict'] ? '' : '(Disabled)'}` },
    adult:      { adult: 'Adult' },
    subbot:    { subbot: 'Sub-bot' },
    tools:      { tools: 'Tools', ai: 'Artificial Intelligence', database: 'Database' },
    downloader: { downloader: 'Downloader' },
    internet:   { internet: 'Internet' },
    info:       { info: 'Info' },
    owner:      { owner: 'Owner', advanced: 'Advanced' },
  }

  let tags = tagMap[teks] ?? null

  try {

    // ===========================[ DATA ]===========================
    const mode      = global.opts?.['self'] ? 'Private' : 'Public'
    const _package  = JSON.parse(await promises.readFile(join(process.cwd() + '/package.json')).catch(_ => '{}')) || {}
    const userData  = db?.data?.users?.[m.sender] || {}
    const { level = 1, age = -1, exp = 0, limit = 20, registered = false, money = 0 } = userData
    const name      = userData.name || m.pushName || 'User'
    const premium   = userData.premiumTime || 0
    const prems     = premium > 0 ? 'Premium' : 'Free'
    const platform  = os.platform()
    const ownerList = global.settings?.owner || global.owner || []
    const dev       = ownerList.filter(([id, , isCreator]) => id && isCreator).map(([id]) => String(id).replace(/[^0-9]/g, ''))[0] || ''
    const botTitle  = global.settings?.botname || global.namebot || 'Yono'
    const botImgUrl = (await Promise.resolve(global.img?.profile?.bot).catch(() => null)) || 'https://files.catbox.moe/96cm7n.jpeg'
    const senderImg = (await Promise.resolve(global.img?.profile?.sender).catch(() => null)) || botImgUrl
    const serverUrl = typeof global.getServerUrl === 'function' ? global.getServerUrl() : (process.env.APP_URL || 'https://whatsapp.com/channel/0029VaVJo460bIdoxTVoJY3e')

    // ===========================[ QUOTED ]=========================
    const allQuoted = {
      contact: {
        key: { remoteJid: '0@s.whatsapp.net' },
        message: {
          contactMessage: {
            displayName: name,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${name}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`,
          },
        },
      },
    }

    // ===========================[ TEKS BEFORE ]===================
    const TeksBefore = `──────────────────

*U S E R*
- \`Name:\` ${name}
- \`Status:\` ${m.sender.split('@')[0] == dev ? 'Developer' : isOwner ? 'Owner' : isPrems ? 'Premium User' : 'User'}
- \`Registered:\` ${registered ? 'Yes' : 'No'}

──────────────────

*I N F O R M A T I O N*
- \`Bot Name:\` ${botTitle}
- \`Developer:\` @${dev}
- \`Version:\` ${_package.version}

──────────────────`

    // ===========================[ MENU 404 ]======================
    if (teks === '404') {
      const jsonlist = arrayTags.filter(v => v !== 'all').map(v => {
        const tagCommands = Object.values(global.plugins || {})
          .filter(plugin => !plugin.disabled && plugin.tags?.includes(v) && plugin.help)
          .flatMap(plugin => Array.isArray(plugin.help) ? plugin.help : [plugin.help])
          .map(h => h.split(' ')[0])
          .filter((h, i, arr) => arr.indexOf(h) === i)

        const maxShow = 5
        const shown = tagCommands.slice(0, maxShow).join(', ')
        const remaining = tagCommands.length - maxShow
        const description = tagCommands.length === 0
          ? '-'
          : tagCommands.length <= maxShow
            ? shown
            : `${shown}, ...${remaining}+`

        return {
          header: '\u0000',
          title: '• ' + v.charAt(0).toUpperCase() + v.slice(1),
          description,
          id: '.menu ' + v,
        }
      })

      const totalCommands = Object.values(global.plugins || {})
        .filter(plugin => !plugin.disabled && plugin.help)
        .flatMap(plugin => Array.isArray(plugin.help) ? plugin.help : [plugin.help])
        .map(h => h.split(' ')[0])
        .filter((h, i, arr) => arr.indexOf(h) === i)
        .length

      let botThumb = Buffer.alloc(0)
      try {
        const res = await fetch(botImgUrl)
        if (res.ok) {
          const rawBuf = Buffer.from(await res.arrayBuffer())
          botThumb = typeof conn.resize === 'function' ? await conn.resize(rawBuf, 100, 100) : rawBuf
        }
      } catch {}

      await conn.sendButton(m.chat, {
        document: { url: botImgUrl },
        jpegThumbnail: botThumb,
        mimetype: 'image/webp',
        caption: TeksBefore,
        fileName: botTitle,
        fileLength: '665666646645000',
        nativeFlow: [{},
          { text: '📢', url: 'https://whatsapp.com/channel/0029VaVJo460bIdoxTVoJY3e' },
          { text: '🌐', url: serverUrl, useWebview: false },
          { text: '\u0000', sections: [
            {
              highlight_label: '✦ SHOW ALL MENU',
              rows: [
                {
                  header: '\u0000',
                  title: '• All',
                  description: `${totalCommands} commands`,
                  id: '.menu all',
                },
                ...jsonlist
              ]
            }
          ]},
        ],
        mentions: [m.sender, ...(dev ? [`${dev}@s.whatsapp.net`] : [])]
      }, allQuoted.contact)

      return 0
    }

    // ===========================[ ARRAY PLUGINS ]=================
    const totalreg  = Object.keys(db.data.users).length
    const rtotalreg = Object.values(db.data.users).filter(u => u.registered === true).length
    const help = Object.values(global.plugins || {})
      .filter(plugin => !plugin.disabled)
      .map(plugin => ({
        help:    Array.isArray(plugin.help) ? plugin.help : [plugin.help],
        tags:    Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags],
        prefix:  'customPrefix' in plugin,
        limit:   plugin.limit,
        premium: plugin.premium,
        enabled: !plugin.disabled,
      }))

    const groups = {}
    for (let tag in tags) {
      groups[tag] = []
      for (let plugin of help)
        if (plugin.tags?.includes(tag) && plugin.help)
          groups[tag].push(plugin)
    }

    // ===========================[ BUILD TEXT ]===================
    conn.menu = conn.menu ?? {}
    const before = conn.menu.before  || defaultMenu.before
    const header = conn.menu.header  || defaultMenu.header
    const body   = conn.menu.body    || defaultMenu.body
    const footer = conn.menu.footer  || defaultMenu.footer
    const after  = conn.menu.after   || defaultMenu.after

    let _text = [
      before,
      ...Object.keys(tags).map(tag => {
        return (
          header.replace(/%category/g, tags[tag]) + '\n' +
          [
            ...help
              .filter(menu => menu.tags?.includes(tag) && menu.help)
              .map(menu =>
                menu.help.map(h =>
                  body
                    .replace(/%cmd/g,       menu.prefix ? h : _p + h)
                    .replace(/%islimit/g,   menu.limit   ? 'Ⓛ' : '')
                    .replace(/%isPremium/g, menu.premium ? 'Ⓟ' : '')
                    .trim()
                ).join('\n')
              ),
            footer,
          ].join('\n')
        )
      }),
      after,
    ].join('\n')

    let text =
      typeof conn.menu === 'string' ? conn.menu :
      typeof conn.menu === 'object' ? _text : ''

    const replace = {
      '%':        '%',
      me:         conn.getName(conn.user?.jid || conn.user?.id || ''),
      npmname:    _package.name,
      npmdesc:    _package.description,
      version:    _package.version,
      github:     _package.homepage?.url || _package.homepage || '[unknown github url]',
      platform, mode, _p, money, age, name, prems, limit,
      totalreg, rtotalreg,
    }

    text = text.replace(
      new RegExp(`%(${Object.keys(replace).sort((a, b) => b.length - a.length).join('|')})`, 'g'),
      (_, key) => '' + replace[key]
    )

    let orderThumb = Buffer.alloc(0)
    try {
      orderThumb = typeof conn.resize === 'function' ? await conn.resize(senderImg, 150, 150) : Buffer.alloc(0)
    } catch {}

    // ===========================[ SEND MENU ]===================
    await conn.reply(m.chat, text, {
      key: { remoteJid: '0@s.whatsapp.net' },
      message: {
        orderMessage: {
          orderId: '780642630945098',
          thumbnail: orderThumb,
          itemCount: 666,
          status: 1,
          surface: 1,
          message: '• LIST COMMANDS',
          orderTitle: 'Channel.',
          sellerJid: '6283143393763@s.whatsapp.net',
          token: 'AR6pyJ/fz5vRFxggGxURL7EA/vCtjKrhcJSNhHqX1iJh8A==',
          totalAmount1000: '0',
          totalCurrencyCode: 'IDR',
        },
      },
    })

  } catch (e) {
    m.error = e
    console.log(e)
    await conn.reply(m.chat, '> *Sorry*, the menu is currently error', m)
  }
}

handler.help = ['menu', 'help']
handler.tags = ['main']
handler.command = /^(menu|help|\?)$/i
handler.ai = { risk: 'low', description: 'Show menu list / command list' }

export default handler