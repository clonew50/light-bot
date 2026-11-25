/* حقوق حرب مطور بوت انيا المظه و بوت حرب و بوت بوتشي و بوت ايرين حاليا
https://whatsapp.com/channel/0029VbBh4ku8aKvPx1m0l822
لاتحذف السطرين دول بالحب
*/

import fs from "fs"
import path from "path"
import { execSync } from "child_process"

let handler = async (m, { conn, text }) => {
  try {
    const allowedNumbers = ["201212446299"]
    let senderNum = m.sender.split("@")[0]
    if (!allowedNumbers.includes(senderNum)) {
      return m.reply("You are not allowed to take a backup! Only the owner can.")
    }

    let customName = text ? text.trim().split(" ")[0] : ""
    customName = customName.replace(/[^a-zA-Z0-9-_]/g, "")
    if (!customName) customName = "backup-bot"

    const tempDir = "./tmp"
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    // 1. CLEAN OLD TMP - THIS IS WHAT FILLS UP THE MOST
    try {
      let files = fs.readdirSync(tempDir)
      for (let file of files) {
        try { fs.unlinkSync(path.join(tempDir, file)) } catch {}
      }
      // CLEAN NPM CACHE TOO
      try { execSync("rm -rf ./tmp/* ./tmp/.* 2>/dev/null; rm -rf ./.cache 2>/dev/null", { stdio: "ignore" }) } catch {}
    } catch {}

    // 2. CHECK FREE SPACE - IF LESS THAN 100MB STOP SO WE DON'T GET WEIRD ERRORS
    try {
      let df = execSync("df -m . | tail -1").toString().trim().split(/\s+/)
      let freeMB = parseInt(df[3])
      if (freeMB < 100) {
        return m.reply(`Server space full! Only ${freeMB}MB left.\nDelete old files first / upgrade the server.\nBackup cancelled to avoid errors.`)
      }
    } catch {}

    await m.reply("Cleaning and creating backup, please wait a moment...")
    const backupName = customName
    const backupPath = path.join(tempDir, `${backupName}.zip`)
    const absBackupPath = path.resolve(backupPath)

    // 3. EXCLUDE LARGE AND UNIMPORTANT FILES - THIS IS THE KEY TO KEEP ZIP SMALL
    const exclude = new Set(["node_modules", "auth", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "tmp", ".git", ".cache", "sessions"])
    const ls = fs.readdirSync(".").filter(pe => !exclude.has(pe) && pe !== "")

    if (ls.length === 0) throw new Error("No files to back up")

    // CREATE ZIP USING PYTHON - SKIP FILES LARGER THAN 50MB SO IT WON'T FILL UP
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

    if (!fs.existsSync(absBackupPath)) throw new Error("Zip file was not created")

    // CHECK ZIP SIZE
    let zipSizeMB = (fs.statSync(absBackupPath).size / 1024 / 1024).toFixed(2)
    if (zipSizeMB == 0) throw new Error("Zip is empty, all files were skipped because they are too large")

    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(absBackupPath),
      fileName: `${backupName}.zip`,
      mimetype: "application/zip",
      caption: `Backup successful!\nFile: ${backupName}.zip (${zipSizeMB} MB)\nDon't share with anyone!`
    }, { quoted: m })

    fs.unlinkSync(absBackupPath)

  } catch (e) {
    console.error("BACKUP ERROR:", e)
    // CLEAN FAILED ZIP LEFTOVERS SO IT WON'T FILL UP MORE
    try {
      let tmpFiles = fs.readdirSync("./tmp")
      for (let f of tmpFiles) {
        if (f.endsWith(".zip") || f === "makezip.py") {
          try { fs.unlinkSync(path.join("./tmp", f)) } catch {}
        }
      }
    } catch {}
    m.reply(`Failed to create backup!\nError: ${e.message}`)
  }
}

handler.help = ["backup", "sc", "sk"]
handler.tags = ['owner']
handler.command = /^(backup|sk|sc|getsc)$/i
handler.owner = true
export default handler