import os from 'node:os';

const handler = async (m, { conn, bot }) => {
  const usedRam = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const heapTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
  const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
  const cpuCores = os.cpus().length || 1;
  const cpuModel = os.cpus()[0]?.model || 'Unknown';
  const cpuSpeed = ((os.cpus()[0]?.speed || 0) / 1000).toFixed(1);
  const cpuUsage = (os.loadavg()[0] * 100).toFixed(1);
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMins = Math.floor((uptime % 3600) / 60);
  const uptimeSecs = Math.floor(uptime % 60);

  let groupCount = 0;
  try {
    const groups = await conn.groupFetchAllParticipating();
    groupCount = Object.keys(groups || {}).length;
  } catch (e) {
    console.error('Error fetching groups:', e);
    groupCount = 0;
  }

  const subBots = global.subBots;
  let bots = [];
  try {
    bots = subBots?.list?.() || [];
  } catch {}
  const subCount = bots.length;
  const subConnected = bots.filter(item => item.connected).length;

  const botInfo = bot?.config?.info || {};
  const botId = String(conn.user?.id || '').split(':')[0];
  const owners = bot?.config?.owners || [];

  const msg = `❐═━━━═╊⊰🩸⊱╉═━━━═❐
  ——> *الـبـوت 🩸*
  - *الاسم:* \`${conn.user?.name || botInfo.nameBot || 'LIGHT BOT'}\`
  - *الرقم:* \`wa.me/+${botId}\`
  - *شغال منذ:* \`${String(uptimeHours).padStart(2, '0')}:${String(uptimeMins).padStart(2, '0')}:${String(uptimeSecs).padStart(2, '0')}\`

  ——> *الـنـظـام 💻*
  - *النظام:* \`${os.platform()} ${os.arch()}\`
  - *الجهاز:* \`${os.hostname()}\`
  - *المعالج:* \`${cpuModel.slice(0, 30)}\`
  - *النوى:* \`${cpuCores} @ ${cpuSpeed}GHz\`
  - *الحمل:* \`${cpuUsage}%\`

  ——> *الـذاكـرة 🧠*
  - *الرام المستخدم:* \`${usedRam}MB / ${totalRam}GB\`
  - *الرام الفارغ:* \`${freeRam}GB\`
  - *Heap:* \`${heapUsed}MB / ${heapTotal}MB\`

  ——> *احـصـائـيـات 📊*
  - *المجموعات:* \`${groupCount}\`
  - *البوتات الفرعية:* \`${subCount} (متصل: ${subConnected})\`
  - *المالكيـن:* \`${owners.length}\`
  ❐═━━━═╊⊰🩸⊱╉═━━━═❐`;

  await conn.sendMessage(m.chat, {
    image: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/64789104-e032-44cd-a94f-8531fd17522c.jpg' },
    caption: msg,
    mentions: [m.sender],
    newsletter: {
      name: botInfo.nameChannel || '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑪𝑯𝑨𝑵𝑵𝑬𝑳',
      jid: botInfo.idChannel || '120363405545946827@newsletter'
    }
  }, { quoted: m });
};

handler.command = ['معلومات', 'botinfo', 'حالة'];
handler.category = 'info';
handler.usage = ['معلومات'];

export default handler;
