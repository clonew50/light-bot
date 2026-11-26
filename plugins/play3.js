/**
 * © Rem Bot 🤖✨
 * youtube downloader - Rem Bot Version
 */

import axios from 'axios';
import yts from 'yt-search';
import sharp from 'sharp';
import { toAudio } from '../lib/converter.js';
import { downloadYouTubeMedia, extractYouTubeId, searchYouTube } from '../lib/ytdl.js';

const ytSearch = searchYouTube;

// ================= LOCATION CARD - Rem Bot =================
async function sendLocationCard(conn, chat, quoted, info) {
    const res = await axios.get(info.thumbnail, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    const jpegThumbnail = await sharp(Buffer.from(res.data))
       .resize(300, 300, { fit: 'inside' })
       .jpeg({ quality: 70 })
       .toBuffer()

    const msg = {
        locationMessage: {
            degreesLatitude: 0,
            degreesLongitude: 0,
            name: `🎵 ${info.title}`,
            address: `👤 ${info.channel} • ⏱️ ${info.duration} • 👁️ ${info.views}`,
            url: info.url,
            comment: '◠⿻ Rem Bot 🤖✨',
            jpegThumbnail,
            contextInfo: quoted?.key? {
                stanzaId: quoted.key.id,
                participant: quoted.sender,
                quotedMessage: quoted.message
            } : undefined
        }
    }

    await conn.relayMessage(chat, msg, {})
}

// ================= CHANNEL FOLLOW + RGB TEXT CARD - Rem Bot =================
async function getChannelInfo(info) {
    const fallback = { name: info.channel, image: info.thumbnail, url: info.channelUrl || info.url, subs: '' }
    try {
        const r = await yts(info.channel)
        const list = r.channels || []
        const ch = list.find(c => c.name === info.channel) || list[0]
        if (!ch) return fallback
        let image = ch.image || ch.thumbnail || ''
        if (image.startsWith('//')) image = 'https:' + image
        return {
            name: ch.name || info.channel,
            image: image || info.thumbnail,
            url: ch.url || info.channelUrl || info.url,
            subs: ch.subCountLabel || ''
        }
    } catch { return fallback }
}

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function sendFollowCard(conn, chat, info) {
    const ch = await getChannelInfo(info)

    let img = ''
    try {
        const res = await axios.get(info.thumbnail, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } })
        const jpegThumbnail = await sharp(Buffer.from(res.data))
           .resize(480, 270, { fit: 'cover' })
           .jpeg({ quality: 70 })
           .toBuffer()
        img = `data:image/jpeg;base64,${jpegThumbnail.toString('base64')}`
    } catch {}

    const html = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Rem Bot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;background-color:transparent;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Cantarell,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.container{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:4px}
.rgb{display:block;width:100%;word-break:break-word;white-space:normal;color:#111}@media (prefers-color-scheme:dark){.rgb{color:#f1f1f1}}
.loc{position:relative;width:100%;margin-bottom:8px;border-radius:12px;overflow:hidden;background:rgba(127,127,127,.15)}.loc img{width:100%;display:block}.loc.pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:2rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}.loc.bar{padding:6px 10px;font-size:.78rem;font-weight:700}
.title{font-size:1.1rem;font-weight:800;line-height:1.25;margin-bottom:4px}
.meta{font-size:.85rem;font-weight:700;line-height:1.4;margin-bottom:2px}
.sign{font-size:.78rem;font-weight:700;letter-spacing:.5px;margin-top:6px;opacity:.8}
</style>
</head>
<body><div class="container">
${img? `<div class="loc"><img src="${img}"><span class="pin">📍</span><div class="bar rgb">👤 ${escHtml(info.channel)}</div></div>` : ''}
<div class="rgb title">🎵 ${escHtml(info.title)}</div>
<div class="rgb meta">⏱️ ${escHtml(info.duration)} • 👁️ ${escHtml(info.views)}</div>
<div class="rgb meta">🔗 ${escHtml(info.url)}</div>
<span class="rgb sign">◠⿻ Rem Bot 🤖✨</span>
</div></body>
</html>`

    const id = 'rem-bot-' + Date.now()
    const data = Buffer.from(JSON.stringify({
        response_id: id,
        sections: [
            {
                view_model: {
                    primitive: {
                        payload: html,
                        trusted_sources: ['nixel.dev'],
                        __typename: 'GenAIaeacdsnwHtmlPrimitive'
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            },
            {
                view_model: {
                    primitive: {
                        __typename: 'GenAICompactEntityPrimitive',
                        title: ch.name,
                        subtitle: ch.subs || 'YouTube',
                        secondary_subtitle: 'YouTube Channel',
                        entity_id: info.id || info.url,
                        entity_url: ch.url,
                        entity_type: 'PAGE',
                        action_type: 'FOLLOW',
                        is_verified: false,
                        image: { url: ch.image, url_fallback: ch.image }
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            }
        ]
    })).toString('base64')

    await conn.relayMessage(chat, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: '',
                botResponseId: id,
                verificationMetadata: {
                    proofs: [
                        {
                            version: 1,
                            useCase: 1,
                            signature: 'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==',
                            certificateChain: [
                                'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg',
                                'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=='
                            ]
                        }
                    ]
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: info.title }],
                    unifiedResponse: { data },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {})
}

// ================= HANDLER =================
let handler = async (m, { conn, args, usedPrefix, command }) => {
  let q = args.join(" ").trim();
  let type = /mp3|audio|play/i.test(command)? 'mp3' : 'mp4';
  if (!q) return m.reply(`*Example:*\n${usedPrefix + command} https://youtu.be/xxx\n${usedPrefix + command} latest dj`);

  await conn.sendMessage(m.chat, { react: { text: '🕕', key: m.key } });

  try {
    let url = q;
    let info = null;
    let isUrl = /youtu\.be|youtube\.com/.test(q);

    if (!isUrl) {
      let search = await ytSearch(q, 1);
      if (!search.length) return m.reply(`❌ Not found: ${q}`);
      info = search[0];
      url = info.url;
    } else {
      const id = extractYouTubeId(q);
      if (id) {
        try {
          const v = await yts({ videoId: id });
          info = {
            title: v.title,
            channel: v.author?.name || 'Unknown',
            channelUrl: v.author?.url || '',
            duration: v.timestamp || '0:00',
            views: v.views? v.views.toLocaleString('id-ID') : '0',
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            url: `https://youtu.be/${id}`
          };
        } catch {
          info = { title: 'YouTube', channel: '-', duration: '-', views: '-', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, url: `https://youtu.be/${id}` };
        }
      }
    }

    if (type === 'mp3' && info) {
      try {
        await sendFollowCard(conn, m.chat, info);
      } catch {
        try {
          await sendLocationCard(conn, m.chat, m, info);
        } catch {
          const caption = `🎵 *${info.title}*\n👤 ${info.channel}\n⏱️ ${info.duration}\n👁️ ${info.views}\n🔗 ${info.url}\n\n◠⿻ Rem Bot 🤖✨`;
          await conn.sendMessage(m.chat, { image: { url: info.thumbnail }, caption }, { quoted: m });
        }
      }
    }

    let resType = type === 'mp3' ? 'audio' : 'video';
    let result = await downloadYouTubeMedia(url, resType);

    if (!result || !result.status) {
      await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
      return m.reply(`❌ Download failed, try again.`);
    }

    if (type === 'mp3') {
      let audioBuf = result.buffer;
      try {
        const converted = await toAudio(result.buffer, result.ext);
        audioBuf = converted.data;
      } catch {}
      await conn.sendMessage(m.chat, { audio: audioBuf, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { video: result.buffer, caption: `✅ *${result.title}*\n\n◠⿻ Rem Bot 🤖✨`, mimetype: 'video/mp4', fileName: `${result.title}.mp4` }, { quoted: m });
    }

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
  } catch (e) {
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
    m.reply(`❌ Error: ${e.message}`);
  }
}

handler.help = ['ytmp32 <url/title>', 'ytmp42 <url/title>', 'play3 <title>'];
handler.tags = ['downloader'];
handler.command = /^(ytmp6|ytmp32|yta2|play3|ytmp5|ytmp42|ytv2)$/i;

export default handler;