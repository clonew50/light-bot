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

    let res = await fetch(`https://api.binderbyte.com/v1/track?api_key=${el_api}&courier=${encodeURIComponent(courier)}&awb=${encodeURIComponent(resi)}`, { signal: AbortSignal.timeout(15000) })
    let elres = await res.json()

    if (!res.ok || elres?.status !== 200 || !elres?.data?.summary) {
      return m.reply(`⚠️ ${elres?.message || 'Tracking number not found or API limit reached'}`)
    }

    const s = elres.data.summary || {}
    const d = elres.data.detail || {}
    const hist = elres.data.history || []

    let teks = `📦 *TRACKING RESULT*\n\n`
    teks += `Status: ${elres.status}\n`
    teks += `Message: ${elres.message || '-'}\n\n`

    teks += `*Summary*\n`
    teks += `AWB: ${s.awb || resi}\n`
    teks += `Courier: ${s.courier || courier}\n`
    teks += `Service: ${s.service || '-'}\n`
    teks += `Status: ${s.status || '-'}\n`
    teks += `Date: ${s.date || '-'}\n`
    teks += `Description: ${s.desc || '-'}\n`
    teks += `Cost: ${s.amount || '-'}\n`
    teks += `Weight: ${s.weight || '-'}\n\n`

    teks += `*Detail*\n`
    teks += `Origin: ${d.origin || '-'}\n`
    teks += `Destination: ${d.destination || '-'}\n`
    teks += `Shipper: ${d.shipper || '-'}\n`
    teks += `Receiver: ${d.receiver || '-'}\n\n`

    teks += `*History*\n`
    hist.forEach((v, i) => {
      teks += `${i + 1}. ${v.date || '-'}\n`
      teks += `   ${v.desc || '-'}\n`
      teks += `   ${v.location || '-'}\n\n`
    })

    await conn.sendMessage(m.chat, { text: teks }, { quoted: m })

  } catch {
    await m.reply('Tracking number not found or API error')
  }

}

handler.help = ['cekresi']
handler.tags = ['tools']
handler.command = /^cekresi$/i

export default handler
