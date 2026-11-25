//follow ig @elyas_tzy ya sayangkuhhh
//f0llow ig @elyas_tzy ya sayangkuhhh
const couriers = [
  { code: "jne", name: "JNE Express" },
  { code: "pos", name: "POS Indonesia" },
  { code: "jnt", name: "J&T Express" },
  { code: "jnt_cargo", name: "J&T Cargo" },
  { code: "sicepat", name: "SiCepat" },
  { code: "tiki", name: "TIKI" },
  { code: "anteraja", name: "AnterAja" },
  { code: "wahana", name: "Wahana" },
  { code: "ninja", name: "Ninja Express" },
  { code: "lion", name: "Lion Parcel" },
  { code: "pcp", name: "PCP Express" },
  { code: "jet", name: "JET Express" },
  { code: "rex", name: "REX Express" },
  { code: "first", name: "First Logistics" },
  { code: "ide", name: "ID Express" },
  { code: "spx", name: "Shopee Express" },
  { code: "kgx", name: "KGXpress" },
  { code: "sap", name: "SAP Express" },
  { code: "rpx", name: "RPX" },
  { code: "lex", name: "Lazada Express" },
  { code: "indah_cargo", name: "Indah Cargo" },
  { code: "dakota", name: "Dakota Cargo" },
  { code: "kurir_tokopedia", name: "Kurir Tokopedia" }
]

let handler = async (m, { conn, args, usedPrefix, command }) => {
const el_api = 'f76b9f991fe424356b9c6da407792b1d1fbf33ad7a197bd0755b557a05461262' 
//500 req/week, just create one for free at https://api.binderbyte.com
//follow ig @elyas_tzy
  if (!args[0]) {
    return m.reply(`Enter the tracking number\nExample:\n${usedPrefix + command} 81902xxxx`)
  }

  if (args.length == 1) {

    let resi = args[0]

    let buttons = [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "Select Courier",
          sections: [
            {
              title: "Courier List",
              rows: couriers.map(v => ({
                title: v.name,
                description: `Track via ${v.name}`,
                id: `${usedPrefix + command} ${v.code} ${resi}`
              }))
            }
          ]
        })
      }
    ]

    return conn.sendButton(
      m.chat,
      {
        text: `📦 *PACKAGE TRACKING*\n\nTracking Number: *${resi}*\n\nPlease select the shipping courier.`,
        footer: "Tracking Paket",
        buttons
      },
      { quoted: m }
    )
  }

  let courier = args[0].toLowerCase()
  let resi = args[1]

  if (!couriers.find(v => v.code == courier)) {
    return m.reply(`Courier *${courier}* is not available`)
  }

  if (!resi) {
    return m.reply(`Enter the tracking number\nExample:\n${usedPrefix + command} ${courier} 81902xxxx`)
  }

  try {

    let res = await fetch(`https://api.binderbyte.com/v1/track?api_key=${el_api}&courier=${courier}&awb=${resi}`)
    let elres = await res.json()

    let teks = `📦 *TRACKING RESULT*\n\n`
    teks += `Status: ${elres.status}\n`
    teks += `Message: ${elres.message}\n\n`

    teks += `*Summary*\n`
    teks += `AWB: ${elres.data.summary.awb}\n`
    teks += `Courier: ${elres.data.summary.courier}\n`
    teks += `Service: ${elres.data.summary.service}\n`
    teks += `Status: ${elres.data.summary.status}\n`
    teks += `Date: ${elres.data.summary.date}\n`
    teks += `Description: ${elres.data.summary.desc}\n`
    teks += `Cost: ${elres.data.summary.amount}\n`
    teks += `Weight: ${elres.data.summary.weight}\n\n`

    teks += `*Detail*\n`
    teks += `Origin: ${elres.data.detail.origin}\n`
    teks += `Destination: ${elres.data.detail.destination}\n`
    teks += `Shipper: ${elres.data.detail.shipper}\n`
    teks += `Receiver: ${elres.data.detail.receiver}\n\n`

    teks += `*History*\n`
    elres.data.history.forEach((v, i) => {
      teks += `${i + 1}. ${v.date}\n`
      teks += `   ${v.desc}\n`
      teks += `   ${v.location}\n\n`
    })

    conn.sendMessage(m.chat, { text: teks }, { quoted: m })

  } catch {
    m.reply('Tracking number not found or API error')
  }

}

handler.help = ['cekresi']
handler.tags = ['tools']
handler.command = /^cekresi$/i

export default handler
