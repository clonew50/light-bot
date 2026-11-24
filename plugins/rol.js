let handler = async (m, { conn }) => {
  const data = {
    version: "v0.9"
    // ماكاينش createSurface هنا
    // يعني واتساب غادي يبقى كيتسنى، والدوايرة اللولة غادي تبقى دورة وماتمشيش
  }

  await conn.relayMessage(m.chat, {
    interactiveMessage: {
      header: { title: "", hasMediaAttachment: false },
      body: { text: " " },
      footer: { text: "" },
      nativeFlowMessage: {},
      bloksWidget: {
        uuid: "alya-level-info",
        type: "im_a2ui",
        data: JSON.stringify(data),
        fallback: ""
      }
    }
  }, {})
}

handler.help = ['rol']
handler.tags = ['main']
handler.command = /^(rol)$/i
export default handler