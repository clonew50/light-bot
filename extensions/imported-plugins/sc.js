/* حقوق حرب مطور بوت انيا المظه و بوت حرب و بوت بوتشي و بوت ايرين حاليا
https://whatsapp.com/channel/0029VbBh4ku8aKvPx1m0l822
لاتحذف السطرين دول بالحب
*/

import fs from "fs"
import path from "path"
import { execSync } from "child_process"

let handler = async (m, { conn, text }) => {
  try {
    const allowedNumbers = ["212672139914", "212775630435"]
    let senderNum = m.sender.split("@")[0]
    if (!allowedNumbers.includes(senderNum)) {
      return m.reply("Kamu tidak diizinkan mengambil backup! Hanya owner yang bisa.")
    }

    let customName = text ? text.trim().split(" ")[0] : ""
    customName = customName.replace(/[^a-zA-Z0-9-_]/g, "")
    if (!customName) customName = "backup-bot"

    const tempDir = "./tmp"
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    // 1. BERSIHKAN TMP LAMA - INI YANG PALING BIKIN PENUH
    try {
      let files = fs.readdirSync(tempDir)
      for (let file of files) {
        try { fs.unlinkSync(path.join(tempDir, file)) } catch {}
      }
      // BERSIHKAN CACHE NPM JUGA
      try { execSync("rm -rf ./tmp/* ./tmp/.* 2>/dev/null; rm -rf ./.cache 2>/dev/null", { stdio: "ignore" }) } catch {}
    } catch {}

    // 2. CEK SISA RUANG - KALAU KURANG DARI 100MB LANGSUNG BERHENTI BIAR TAK ERROR ANEH
    try {
      let df = execSync("df -m . | tail -1").toString().trim().split(/\s+/)
      let freeMB = parseInt(df[3])
      if (freeMB < 100) {
        return m.reply(`Ruang server penuh! Sisa ${freeMB}MB saja.\nHapus file lama dulu / upgrade server.\nBackup dibatalkan biar tak error.`)
      }
    } catch {}

    await m.reply("Sedang membersihkan dan membuat backup, tunggu sebentar...")
    const backupName = customName
    const backupPath = path.join(tempDir, `${backupName}.zip`)
    const absBackupPath = path.resolve(backupPath)

    // 3. EXCLUDE FILE BESAR DAN YANG TAK PENTING - INI KUNCINYA BIAR ZIP KECIL
    const exclude = new Set(["node_modules", "auth", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "tmp", ".git", ".cache", "sessions"])
    const ls = fs.readdirSync(".").filter(pe => !exclude.has(pe) && pe !== "")

    if (ls.length === 0) throw new Error("Tidak ada file untuk di backup")

    // BUAT ZIP PAKAI PYTHON - SKIP FILE LEBIH DARI 50MB BIAR TAK PENUH
    const pyCode = `
import zipfile, os
z = zipfile.ZipFile(r'${absBackupPath}', 'w', zipfile.ZIP_DEFLATED, compresslevel=9)
for f in ${JSON.stringify(ls)}:
    if os.path.isfile(f):
        if os.path.getsize(f) > 50*1024*1024: continue
        z.write(f, f)
    else:
        for r,d,files in os.walk(f):
            for ff in files:
                fp = os.path.join(r, ff)
                try:
                    if os.path.getsize(fp) > 50*1024*1024: continue
                    z.write(fp, fp)
                except: pass
z.close()
print("done")
`
    fs.writeFileSync(path.join(tempDir, "makezip.py"), pyCode)
    execSync(`python3 "${path.join(tempDir, "makezip.py")}"`, { stdio: "pipe" })
    try { fs.unlinkSync(path.join(tempDir, "makezip.py")) } catch {}

    if (!fs.existsSync(absBackupPath)) throw new Error("File zip tidak terbentuk")

    // CEK UKURAN ZIP
    let zipSizeMB = (fs.statSync(absBackupPath).size / 1024 / 1024).toFixed(2)
    if (zipSizeMB == 0) throw new Error("Zip kosong, file semua di skip karena terlalu besar")

    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(absBackupPath),
      fileName: `${backupName}.zip`,
      mimetype: "application/zip",
      caption: `Backup berhasil!\nFile: ${backupName}.zip (${zipSizeMB} MB)\nJangan share ke sembarang orang!`
    }, { quoted: m })

    fs.unlinkSync(absBackupPath)

  } catch (e) {
    console.error("BACKUP ERROR:", e)
    // BERSIHKAN SISA ZIP GAGAL BIAR TAK MAKIN PENUH
    try {
      let tmpFiles = fs.readdirSync("./tmp")
      for (let f of tmpFiles) {
        if (f.endsWith(".zip") || f === "makezip.py") {
          try { fs.unlinkSync(path.join("./tmp", f)) } catch {}
        }
      }
    } catch {}
    m.reply(`Gagal membuat backup!\nError: ${e.message}`)
  }
}

handler.usage = ["backup", "sc", "sk"]
handler.category = 'owner'
handler.command = /^(backup|sk|sc|getsc)$/i
handler.owner = true
export default handler