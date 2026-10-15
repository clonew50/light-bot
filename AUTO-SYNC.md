# 🔄 المزامنة التلقائية مع GitHub (autoSync)

السكربت `system/autoSync.mjs` بيرفع أي تعديل تعمله في المشروع على ريبو
**https://github.com/clonew50/light-bot** لوحده — من غير ما تحتاج GitHub token.

## إزاي بيشتغل؟
1. بيقرأ آخر حالة متزامنة من ملف `.git-sync-state.json`.
2. بيقارن بصمات (git blob sha) كل الملفات المحلية بالحالة السابقة.
3. بيرفع المتغيّر/الجديد بس، وبيحذف المحذوف، وبعدين يعمل commit واحد.
4. بيسجّل الحالة الجديدة.

> بيستخدم اتصال **GitHub** الموجود في One، فالطلب كله رايح عبر
> `https://api.withone.ai/v1/passthrough`.

## الأوامر
```bash
node system/autoSync.mjs            # مزامنة مرة واحدة
node system/autoSync.mjs --watch    # مراقبة مستمرة (يرفع أول ما تعدّل)
node system/autoSync.mjs --status   # يشوف التعديلات المعلّقة من غير ما يرفع
node system/autoSync.mjs --init     # يجهّز الحالة من الريبو (مرة واحدة، أو بعد نسخ المشروع)
```

## الإعدادات (متغيّرات بيئة اختيارية)
| المتغيّر | الافتراضي | الوصف |
|---|---|---|
| `ONE_SECRET` | من `~/.one/config.json` | مفتاح One |
| `ONE_CONN` | اتصال GitHub الافتراضي | مفتاح الاتصال في One |
| `GH_OWNER` | `clonew50` | صاحب الريبو |
| `GH_REPO` | `light-bot` | اسم الريبو |
| `GH_BRANCH` | `main` | الفرع |
| `SYNC_DEBOUNCE` | `5` | ثواني الانتظار بعد آخر تعديل |
| `SYNC_INTERVAL` | `120` | فحص دوري بالثواني |

## الملفات المستثناة (مش بتترفع)
- `sub/` و `session/` — جلسات واتساب (بيانات دخول).
- `system/database.json` — داتابيز البوت.
- `system/panel-config.json` — باسورد/سر البانل.
- `node_modules/`، `.npm/`، `*.zip`، `*.log`، وملفات الوكيل.

## على سيرفر الاستضافة (البانل)
لو عايز المزامنة تشتغل جوه السيرفر، حدّد مفتاح One وبعدين شغّل:
```bash
export ONE_SECRET="sk_live_xxx"
node system/autoSync.mjs --init
node system/autoSync.mjs --watch &   # أو خليه cron كل 5 دقايق
```

## ملاحظات
- أول مرة على نسخة جديدة من المشروع: شغّل `--init` عشان يقرأ الحالة من الريبو.
- لو المزامنة بترجع 403/401: المفتاح مش شغال أو الاتصال اتشال من One.
