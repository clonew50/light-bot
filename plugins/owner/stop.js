const test = async (m, { conn, bot }) => {
  m.react("🟢")
  
  conn.msgUrl(m.chat, "♡𝑺𝑻𝑶𝑷𝑰𝑵𝑮 𝑻𝑯𝑬 𝑩𝑶𝑻", { 
    title: "𝑳𝑰𝑮𝑯𝑻 𝑰𝑺 𝑺𝑻𝑶𝑷𝑰𝑵𝑮 ⛔",
    body: "𝑻𝑯𝑬 𝑩𝑶𝑻 𝑰𝑺 𝑺𝑻𝑶𝑷𝑰𝑵𝑮",
    img: "https://g.top4top.io/p_3700yob0b1.jpg",
    big: false 
  });
  
  setTimeout(() => {
    bot.stop();
  }, 1000); 
};

test.category = "owner";
test.command = ["ايقاف", "stop"];
test.owner = true;
export default test;