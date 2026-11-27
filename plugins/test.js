import { performance } from 'perf_hooks'

let handler = async (m, { conn }) => {
  let old = performance.now()
  // قياس سرعة حقيقية بلا تأخير مصطنع
  await new Promise(res => setTimeout(res, 0))
  let speed = Math.round(performance.now() - old)
  if (speed < 1) speed = 1 // باش ما يطلعش 0 MAD

  let amount1000 = speed * 1000 // هنا السرعة كتولي هي المبلغ

  await conn.relayMessage(m.chat, {
    requestPaymentMessage: {
      currencyCodeIso4217: "MAD",
      amount1000: amount1000, // غادي يبان مثلا 27 د.م. الى السرعة 27ms
      requestFrom: m.chat,
      noteMessage: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.15575-24/839008521_1748008522963558_8705966860118739157_n.enc?ccb=11-4&oh=01_Q5Aa5wFtmttYM4XzfpMFtQFJOeh0VM_31mw9jFqoAx6oWRSGDQ&oe=6AEDC351&_nc_sid=5e03e0&mms3=true",
          fileSha256: "pWUPw0PRnYY8LrzLTDrYavot1oo0zeLZEgThE3dMTAw=",
          fileEncSha256: "g78+zEY1Kpc6Lg5Zg8FodOXwj49LHsAT9Sv08K81M7A=",
          mediaKey: "8nt7k5fqKoXUGFtnq25Zn+uzAlco4nsnEAI1qTO3030=",
          mimetype: "image/webp",
          height: 512,
          width: 512,
          directPath: "/v/t62.15575-24/839008521_1748008522963558_8705966860118739157_n.enc?ccb=11-4&oh=01_Q5Aa5wFtmttYM4XzfpMFtQFJOeh0VM_31mw9jFqoAx6oWRSGDQ&oe=6AEDC351&_nc_sid=5e03e0",
          fileLength: 345512,
          mediaKeyTimestamp: 1791312098,
          firstFrameLength: 8458,
          firstFrameSidecar: "nf96PQ8P43t4Lg==",
          isAnimated: true,
          contextInfo: {},
          stickerSentTs: 1791377808297,
          isAvatar: false,
          isAiSticker: false,
          isLottie: false
        }
      },
      expiryTimestamp: 0
    },
    messageContextInfo: {
      messageSecret: "3xwphExCBEJtVQIWPT+XyxAOACQtzHTonTPuCYH7iXs="
    }
  }, {})
}

handler.help = ['test']
handler.tags = ['info']
handler.command = /^(test|tes)$/i
export default handler
// Hi
