let handler = async (m, { conn }) => {

  const devPhone = '212672139914'
  const devName = 'YONO'
  const waUrl = `https://wa.me/${devPhone}`

  // تصويرة المطور الحقيقية - فحال gp - كتجيبها من واتساب نيشان
  let devPp = 'https://kappa.lol/wNCEwm'
  try { devPp = await conn.profilePictureUrl(devPhone + '@s.whatsapp.net', 'image') } catch {}

  await conn.sendMessage(m.chat, { react: { text: '⌛', key: m.key } })

  try {
    // البلاكة اللولة بوحدها - تصويرة المطور مدورة فالجنب
    const ownerPayload = {
      response_id: "ade6f327-7c65-4921-b230-7cda33d926df",
      sections: [
        {
          view_model: {
            primitive: {
              media: { url: devPp, mime_type: "image/png", width: 16, height: 9 },
              imagine_type: "IMAGE",
              status: { status: "READY" },
              __typename: "GenAIImagePrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        },
        {
          view_model: {
            primitive: {
              __typename: "GenAICompactEntityPrimitive",
              title: "YONO",
              subtitle: "Developer of YONO BOT",
              secondary_subtitle: "Morocco | 2026 | All Rights Reserved",
              entity_id: devPhone,
              entity_url: waUrl,
              entity_type: "PAGE",
              action_type: "FOLLOW",
              is_verified: true,
              image: { url: devPp, url_fallback: devPp }
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        },
        {
          view_model: {
            primitive: {
              text: `*YONO BOT - OWNER*\n\n*Name:* YONO\n*Bot:* YONO BOT\n*Number:* +${devPhone}\n*Country:* Morocco\n\n> All Rights Reserved | YONO`,
              __typename: "GenAIMarkdownTextUXPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        },
        {
          view_model: {
            primitive: {
              text: `Powered by YONO | YONO BOT | +${devPhone}`,
              __typename: "GenAIMetadataTextPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        }
      ]
    }

    await conn.relayMessage(m.chat, {
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            submessages: [{ messageType: 2, messageText: `YONO BOT by YONO - ${devPhone}` }],
            messageType: 1,
            unifiedResponse: { data: Buffer.from(JSON.stringify(ownerPayload)).toString('base64') },
            contextInfo: { forwardingScore: 2, isForwarded: true, forwardOrigin: 4 }
          }
        }
      }
    }, {})

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
  }
}

handler.usage = ['o']
handler.category = 'main'
handler.command = /^(o|boos)$/i
export default handler