const test = async (m, { conn, bot }) => {
  m.react("🟢")
  
  conn.msgUrl(m.chat, "𝑳𝑰𝑮𝑯𝑻𝑩𝑶𝑻 𝑰𝑺 𝑹𝑬𝑺𝑻𝑨𝑹𝑻𝑰𝑵𝑮", { 
    title: "𝑳𝑰𝑮𝑯𝑻 𝑩𝑶𝑻",
    body: "𝑻𝑯𝑬 𝑩𝑶𝑻 𝑰𝑺 𝑹𝑬𝑺𝑻𝑨𝑹𝑻𝑰𝑵𝑮 🔁",
    img: "https://g.top4top.io/p_3700yob0b1.jpg",
    big: false 
  });
  
  setTimeout(() => {
    // بنستخدم global.restartBot (نفس دالة البوت المركزية) للحفاظ على
    // سلوك ريستارت داخل العملية — و bot.restart() كخطة احتياطية
    if (typeof global.restartBot === 'function') global.restartBot('أمر رستارت من المالك');
    else bot.restart();
  }, 1000); 
};

test.usage = ["رستارت"]
test.category = "owner";
test.command = ["رستارت", "restart"];
test.owner = true;
export default test;