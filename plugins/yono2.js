// plugins/test-nixel2.js - بدون AIRich
let handler = async (m, { conn }) => {
  const item = {
    __typename: 'MBNixelhdreamwhHtml',
    payload: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 1.5rem; border-radius: 12px; background: #1e293b;"><div style="width: 36px; height: 36px; border-radius: 10px; background: #334155; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; color: #fff;">N</div><span style="font-size: 20px; font-weight: 600; color: #fff; letter-spacing: 0.3px;">YONO</span></div>`,
    trusted_sources: ['yono.dev'],
  };

  await conn.relayMessage(m.chat, {
    interactiveMessage: {
      body: { text: "Test YONO Card" },
      footer: { text: "REM BOT - Yono" },
      nativeFlowMessage: { buttons: [{ name: "inapp_signup", buttonParamsJson: JSON.stringify({}) }], messageParamsJson: "" }
    }
  }, {})
  
  // الطريقة الصحيحة ديال AIRich الأصلية هي هادي:
  // await conn.sendMessage(m.chat, { text: "payload" })
}

handler.command = /^yono2$/i
export default handler