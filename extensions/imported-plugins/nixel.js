// plugins/test-nixel.js - Test AIRich Card - REM BOT
import AIRich from '../lib/airich.js' // إلا ما عندكش هاد الملف، شوف الملاحظة لتحت

let handler = async (m, { conn }) => {
  try {
    const item = {
      __typename: 'MBNixelhdreamwhHtml',
      payload: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 1.5rem; border-radius: 12px; background: #1e293b;">
  <div style="width: 36px; height: 36px; border-radius: 10px; background: #334155; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; color: #fff;">N</div>
  <span style="font-size: 20px; font-weight: 600; color: #fff; letter-spacing: 0.3px;">Nixel</span>
</div>`,
      trusted_sources: ['nixel.dev'],
    };

    await new AIRich(conn)
      .addSection(AIRich.newLayout('Single', item))
      .send(m.chat);

  } catch (e) {
    console.log(e)
    m.reply(`❌ Error: ${e.message}\n\nتأكد عندك مكتبة AIRich فـ lib/airich.js`)
  }
}

handler.usage = ['nixel']
handler.category = 'tools'
handler.command = /^(nixel|testnixel)$/i

export default handler