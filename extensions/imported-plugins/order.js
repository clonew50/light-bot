// plugins/order.js - ʀᴇᴍ ʙᴏᴛ Payment Request

let handler = async (m, { conn, args, text }) => {
  let [harga, nama] = text.split('|')

  let amount = parseInt(harga) || 13
  let productName = nama?.trim() || 'ʀᴇᴍ ʙᴏᴛ Premium'
  let note = 'Terima kasih telah berbelanja di ʀᴇᴍ ʙᴏᴛ Store'

  let total = amount * 100 // offset 100

  await conn.relayMessage(m.chat, {
    messageContextInfo: {
      },
    interactiveMessage: {
      body: { text: `🧾 *INVOICE - ʀᴇᴍ ʙᴏᴛ*\n\n📦 Produk: ${productName}\n💰 Harga: $${amount}\n\nKlik di bawah untuk detail pembayaran` },
      footer: { text: "ʀᴇᴍ ʙᴏᴛ Official Store" },
      nativeFlowMessage: {
        buttons: [
          {
            name: "review_and_pay",
            buttonParamsJson: JSON.stringify({
              "currency": "USD",
              "total_amount": { "value": total, "offset": 100 },
              "reference_id": "rembot_" + Date.now(),
              "type": "physical-goods",
              "order": {
                "status": "payment_requested",
                "subtotal": { "value": 0, "offset": 100 },
                "order_type": "PAYMENT_REQUEST",
                "items": [
                  {
                    "retailer_id": "rembot_store",
                    "name": productName,
                    "amount": { "value": total, "offset": 100 },
                    "quantity": 1
                  }
                ]
              },
              "additional_note": note,
              "native_payment_methods": [],
              "share_payment_status": true
            })
          }
        ]
      },
      contextInfo: {
        expiration: 7776000,
        ephemeralSettingTimestamp: 1,
        disappearingMode: { initiator: 0 }
      }
    }
  }, {
    additionalNodes: [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{ tag: "native_flow", attrs: { name: "order_details" } }]
          }
        ]
      }
    ]
  })
}

handler.usage = ['order <harga> | <nama>']
handler.category = 'tools'
handler.command = /^(order|pay|tagih|invoice|payment)$/i

export default handler