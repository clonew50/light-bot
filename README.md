# ✨ Pomni AI- WhatsApp Bot

<div align="center">
  <img src="https://i.pinimg.com/originals/e2/21/20/e221203f319df949ee65585a657501a2.jpg" alt="IMAGE" width="500"/>
  
  [![GitHub](https://img.shields.io/badge/GitHub-VENi-blue?style=for-the-badge&logo=github)](https://github.com/deveni0)
  [![WhatsApp](https://img.shields.io/badge/WhatsApp-Owner-green?style=for-the-badge&logo=whatsapp)](https://wa.me/201554582851)
  [![WhatsApp](https://img.shields.io/badge/WhatsApp-Channel-orange?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029VaQim2bAu3aPsRVaDq3v)
 
  
  **A simple WhatsApp bot with a framework [MeowSab](https://github.com/deveni0/ws)** 
  
   [Installation](#-installation) • [Support](#-support) • [Features](#-features) • [Hosting](#-hosting)
</div>

---

# 🌹 Features

- ✅ simple bot
- ✅ Ongoing maintenance 
- ✅ Supports buttons
- ✅ Supports downloads 
- ✅ It supports advanced bot features
- ✅ Very easy to modify 
- ✅ Very fast bot

---

# ⚙️ Environment variables (every knob, its default and effect)

كل المتغيّرات اختيارية — القيم الافتراضية هي اللي مكتوبة هنا، ولو متسابتش
البوت شغال زي ما هو. التفاصيل الكاملة: `BOTS-NOTES.md`.

## الأمان والبوت نفسه
| المتغيّر | الافتراضي | الوظيفة |
|---|---|---|
| `BOT_SHIELD` | مفعّل (`1`) | `0` يوقف درع الطوارئ (الحارس اللي بيتدخل وقت الأخطاء القاتلة) |
| `BOT_PHONE` | من `system/config.js` | رقم البوت اللي يتربط بيه |
| `BOT_BROWSER` | بصمة الجهاز الثابتة | اسم المتصفح اللي البوت يبان بيه في الأجهزة المرتبطة |
| `BOT_NEWSLETTER_JID` | فاضية | قناة المشغّل — لو فاضية مفيش أي تحويل لنشرة |
| `EXPERIMENTAL_PROTOCOLS` | مقفول (`0`) | `1` يفعل أوامر البروتوكولات التجريبية (زر أذونات المكالمات) |

## الريستارت والاستقرار
| المتغيّر | الافتراضي | الوظيفة |
|---|---|---|
| `RESTART_MODE` | `inprocess` | `exit` يخلي الريستارت يخرج من العملية (مدير العمليات يرجّعها) |
| `RESTART_INTERVAL_MIN` | `10` | الريستارت الدوري بالدقايق (`0` يوقفه) |
| `RESTART_FULL_EVERY` | `2` | كل كام ريستارت يعمل خروج كامل نظيف |
| `WATCHDOG` | مفعّل (`1`) | `0` يوقف حارس الاتصال |
| `WATCHDOG_INTERVAL_S` | `60` | فاصل فحص الحارس بالثواني |
| `MEMORY_RESTART_MB` | `950` | حد الذاكرة (ميجا) اللي بعده ريستارت تلقائي (`0` يوقف الحارس) |
| `HEALER` | مفعّل (`1`) | `0` يوقف مُصلح الجلسة التلقائي |

## المزوّدين
| المتغيّر | الافتراضي | الوظيفة |
|---|---|---|
| `AI_API_URL` | `https://text.pollinations.ai` | نقطة الـ AI (أي نقطة متوافقة) |
| `AI_API_KEY` | فاضية | مفتاح الـ AI لو النقطة محتاجة |
| `TERMAI_KEY` | فاضية | مفتاح رفع termai.cc — بدونه مسار الرفع يرفض بش error عربي |

## التنزيل yt-dlp (اختياري)
| المتغيّر | الافتراضي | الوظيفة |
|---|---|---|
| `YTDLP_BIN` | بحث في `PATH` | مسار تنفيذي yt-dlp (طبقة بديلة في سلسلة تحميل يوتيوب) — المهلة مثبّتة في الكود (120 ثانية) |

## لوحة التحكم والتحديث
| المتغيّر | الافتراضي | الوظيفة |
|---|---|---|
| `WEB_PORT` ثم `PORT` ثم `SERVER_PORT` ثم `P_SERVER_PORT` | `3732` | منفذ اللوحة (بالبحث بالترتيب ده) |
| `WEB_PASSWORD` | `winner` | كلمة سر اللوحة — **غيّرها** |
| `PANEL_CONFIG_FILE` | `system/panel-config.json` | مكان إعدادات اللوحة |
| `AUTO_UPDATE` | `1` | `0` يوقف التحديث التلقائي عند الإقلاع |
| `GH_OWNER` / `GH_REPO` / `GH_BRANCH` | `clonew50` / `light-bot` / `main` | ريبو السحب |
| `LIGHTBOT_DB_FILE` | `system/database.json` | مكان الداتابيز (للاختبارات) |

---

# 📚 Docs

- `UPDATE.md` — التحديث التلقائي بالكامل + النسخة الاحتياطية للجلسة + الاسترجاع اليدوي.
- `WEB-PANEL.md` — لوحة التحكم (المنفذ، كلمة السر، التنصيب، الريستارت).
- `BOTS-NOTES.md` — ملاحظات المشغّل: تدوير المفاتيح، سلم الريستارت، الأوامر الجديدة،
  الاعتماديات المثبّتة (SHAs) وطريقة تدويرها.
- `DEPENDENCIES.md` — الحزم المثبّتة وبصماتها.

---

# 🚀 Installation

### Termux (Android)

```bash
termux-setup-storage
pkg update -y && pkg upgrade -y
pkg install git nodejs -y
git clone https://github.com/clonew50/light-bot.git
cd light-bot
npm install
npm start
```

---


# 🌐 Hosting 

## Cavirox Hosting 

<div align="center">
  <img src="https://b.top4top.io/p_3725xw4y21.jpg" alt="IMAGE" width="200"/>

<h4>

**For support, contact the developer [here](https://wa.me/201023727053?text=عند+مشكله)**  
**Discount code:** `veni`

</h4>

[![Website](https://img.shields.io/badge/Website-Cavirox-orange?style=for-the-badge&logo=website)](https://cavirox.com)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Channel-blue?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029Vb7YDnD0gcfA4FhQrp1D)
 

</div>


---

# 👤 support

- Owner: [click](https://wa.me/201554582851)
- Group: [Join here](https://chat.whatsapp.com/BqNmpkndDplLaJVigfSi5D)
- Community: [Join here](https://chat.whatsapp.com/BuzSrIJOV7S881JMqu8blX)


---

<div align="center">

**Made with ❤️ by [VENi Owner](https://github.com/deveni0)**

**© 2026 Pomni AI- All Rights Reserved**

</div>
