/*
  ═══════════════════════════════════════════
  ✅ موافقة تنصيب البوتات الفرعية (todo 29e)
  ───────────────────────────────────────────
  المشكلة: أي مستخدم كان يقدر ينصّب بوت فرعي (.تنصيب / .تنصيب2) على
  رقم arbitrary — ده باب إساءة (أرقام الغير بتتربط من غير علمهم).

  الحل: قائمة سماح محفوظة في الداتابيز (db.subPairAllow). المطور بس
  اللي يقدر يضيف/يشوف، والتنصيب مرفوع غير للأرقام المسموح لها (أو المطور).
  السجل بيتخزن تلقائيًا مع الداتابيز (debounce save في UltraDB).
  ═══════════════════════════════════════════
*/

const run = async (m, { args, conn }) => {
  if (!m.isOwner) return m.reply("❌ هذا الأمر للمطور فقط");

  const norm = (v) => String(v || "").replace(/[^0-9]/g, "");
  const allow = (global.db.subPairAllow = global.db.subPairAllow || {});

  // من غير أرقام: عرض قائمة السماح
  if (!args || args.length === 0) {
    const list = Object.keys(allow);
    if (list.length === 0) return m.reply("📭 مفيش أرقام مسموح لها بتنصيب البوتات الفرعية.");
    return m.reply(
      "📋 الأرقام المسموح لها بالتنصيب:\n" +
      list.map((n) => `• ${n}`).join("\n") +
      "\n\n> شيل السماح بأمر *.رفض_تنصيب <رقم>*"
    );
  }

  const added = [];
  for (const raw of args) {
    let num = norm(raw);
    if (!num) {
      const jid = m.mentionedJid?.[0] || m.quoted?.sender || "";
      num = norm(jid);
    }
    if (!num) continue;
    allow[num] = { at: Date.now(), by: m.sender };
    added.push(num);
  }

  if (added.length === 0) return m.reply("⚠️ مفيش رقم صالح في الأمر.\n_طريقة الاستعمال:_\n.موافقه_تنصيب 2XXXXXXXXXXX");
  return m.reply(`✅ تم السماح بالتنصيب للأرقام:\n${added.map((n) => `• ${n}`).join("\n")}`);
};

run.command = ["موافقه_تنصيب", "approvesub"];
run.usage = ["موافقه_تنصيب <رقم>"];
run.category = "sub";
run.owner = true;
export default run;