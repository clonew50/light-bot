/*
  ═══════════════════════════════════════════
  🗑️ شيل سماح تنصيب بوت فرعي (todo 29e)
  ───────────────────────────────────────────
  نظير .موافقه_تنصيب: بيشيل رقم من قائمة السماح (db.subPairAllow).
  ═══════════════════════════════════════════
*/

const run = async (m, { args }) => {
  if (!m.isOwner) return m.reply("❌ هذا الأمر للمطور فقط");

  const norm = (v) => String(v || "").replace(/[^0-9]/g, "");
  const allow = (global.db.subPairAllow = global.db.subPairAllow || {});

  const removed = [];
  for (const raw of args || []) {
    let num = norm(raw);
    if (!num) {
      const jid = m.mentionedJid?.[0] || m.quoted?.sender || "";
      num = norm(jid);
    }
    if (!num) continue;
    if (Object.prototype.hasOwnProperty.call(allow, num)) {
      delete allow[num];
      removed.push(num);
    }
  }

  if (removed.length === 0) return m.reply("⚠️ مفيش رقم مسجّل من اللي بعتّه.\n_طريقة الاستعمال:_\n.رفض_تنصيب 2XXXXXXXXXXX");
  return m.reply(`🗑️ تم شيل السماح عن:\n${removed.map((n) => `• ${n}`).join("\n")}`);
};

run.command = ["رفض_تنصيب", "denysub"];
run.usage = ["رفض_تنصيب <رقم>"];
run.category = "sub";
run.owner = true;
export default run;