/**
 * plugins/packs/cyber_code_lab_pack.js — حزمة مختبر البرمجة والشبكات والأمن السيبراني (105+ أمر)
 */
import crypto from 'node:crypto';
import {
  parseNumbers,
  splitArgsPipe,
  makeSimpleHtmlWidget,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeCopyButton
} from '../../system/creativePackUtils.js';

const handlers = [];
const add = (cmd, desc, fn, usage, cat = 'tools') => {
  const triggers = Array.isArray(cmd) ? cmd : [cmd];
  const h = async (m, ctx) => {
    try { await fn(m, ctx); }
    catch (e) { await m.reply('❌ ' + (e?.message || e)); }
  };
  h.command = triggers;
  h.usage = usage || [triggers[0]];
  h.description = desc;
  h.category = cat;
  h.usePrefix = true;
  handlers.push(h);
};

// ── 1. Real Working Security, Hashing & Encoding Lab ──
add('تدقيق_كلمة_مرور', 'تحليل إنتروبيا كلمة المرور وتصنيف قوتها دون تخزينها (تجريبي)', async (m, ctx) => {
  const pw = String(ctx.text || 'Light@2026!').trim();
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  const entropy = Math.round(pw.length * Math.log2(Math.max(1, pool)));
  const score = Math.min(100, Math.round((entropy / 90) * 100));
  const grade = entropy >= 75 ? 'فائقة القوة 🛡️' : entropy >= 50 ? 'جيدة وقوية ✅' : 'ضعيفة — أضف طولاً وتنوعاً ⚠️';
  await sendInteractiveCard(m, ctx, {
    title: 'مدقق قوة كلمة المرور',
    badge: '🔐',
    fields: [
      { icon: '📏', label: 'الطول / الإنتروبيا', value: `${pw.length} محرف (~${entropy} bits)` },
      { icon: '📊', label: 'المؤشر', value: progressBar(score, 100, 10) },
      { icon: '🏷️', label: 'التقييم', value: grade }
    ],
    theme: 'cyber'
  });
}, ['تدقيق_كلمة_مرور <كلمة_تجريبية>']);

add('توليد_كلمات_مرور_عشوائية_لفظية', 'توليد Passphrase قوية وسهلة التذكر من 4 كلمات عشوائية', async (m, ctx) => {
  const words = ['falcon', 'atlas', 'quantum', 'cedar', 'matrix', 'aurora', 'prism', 'horizon', 'beacon', 'nebula', 'harbor', 'summit', 'velvet', 'river', 'orbit', 'cipher'];
  const picked = Array.from({ length: 4 }, () => words[crypto.randomInt(words.length)]);
  const num = crypto.randomInt(10, 99);
  const phrase = `${picked.join('-')}-${num}`;
  await sendInteractiveCard(m, ctx, {
    title: 'مولد عبارة المرور اللفظية',
    badge: '🔑',
    body: `\`${phrase}\``,
    theme: 'cyber',
    buttons: [makeCopyButton('📋 نسخ العبارة', phrase)]
  });
});

add('توليد_uuid_متعدد', 'توليد 4 معرفات UUID v4 عشوائية فورية للبرمجة وقواعد البيانات', async (m, ctx) => {
  const list = Array.from({ length: 4 }, () => crypto.randomUUID());
  await sendInteractiveCard(m, ctx, {
    title: 'مولد معرفات UUID v4',
    badge: '🆔',
    body: list.join('\n'),
    theme: 'cyber',
    buttons: [makeCopyButton('📋 نسخ الأول', list[0])]
  });
});

const CRYPTO_ENCODERS = [
  ['بصمة_sha512', 'حساب تجزئة SHA-512 لنص', (t) => crypto.createHash('sha512').update(t).digest('hex').slice(0, 64) + '...'],
  ['بصمة_blake2', 'حساب تجزئة BLAKE2b512 لنص', (t) => crypto.createHash('blake2b512').update(t).digest('hex').slice(0, 64) + '...'],
  ['تشفير_hex_نص', 'تحويل النص إلى تمثيل سداسي عشري Hex', (t) => Buffer.from(t, 'utf8').toString('hex').toUpperCase()],
  ['فك_hex_نص', 'إرجاع السداسي عشري Hex إلى نص مقروء', (t) => Buffer.from(t.replace(/\s+/g, ''), 'hex').toString('utf8')],
  ['نص_إلى_ثماني', 'تحويل البايتات إلى نظام العد الثماني Octal', (t) => [...Buffer.from(t, 'utf8')].map((b) => b.toString(8).padStart(3, '0')).join(' ')],
  ['ثماني_إلى_نص', 'تحويل أرقام Octal مفصولة بمسافة إلى نص', (t) => Buffer.from(t.trim().split(/\s+/).map((x) => parseInt(x, 8))).toString('utf8')],
  ['ترميز_url_آمن', 'تطبيق encodeURIComponent لتمرير النصوص بأمان في الروابط', (t) => encodeURIComponent(t)],
  ['فك_url_آمن', 'فك ترميز الروابط المشفرة بـ Percent-Encoding', (t) => decodeURIComponent(t)],
  ['مولد_مفاتيح_ssh_وهمي', 'توليد معرف بصمة مفتاح تدريبي لتجارب التوثيق (غير حقيقي)', () => `SHA256:${crypto.randomBytes(18).toString('base64url')}`],
  ['تحقق_صحة_json', 'التحقق من سلامة بنية كود JSON وإعادة تنسيقه أو شرح الخطأ', (t) => {
    const obj = JSON.parse(t);
    return `✅ JSON سليم تماماً! المفاتيح/العناصر: ${Array.isArray(obj) ? obj.length : Object.keys(obj).length}\n${JSON.stringify(obj, null, 2)}`;
  }],
  ['تصغير_json', 'ضغط كود JSON بإزالة المسافات الزائدة (Minify)', (t) => JSON.stringify(JSON.parse(t))],
  ['طابع_زمني_unix', 'عرض الوقت الحالي بـ Unix Seconds و Milliseconds', () => `Seconds: ${Math.floor(Date.now() / 1000)}\nMillis: ${Date.now()}`],
  ['تحويل_طابع_unix', 'تحويل أي رقم Unix Timestamp إلى تاريخ مقروء', (t) => {
    const n = Number(t.replace(/\D/g, '')) || Math.floor(Date.now() / 1000);
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString() + ' | ' + new Date(ms).toLocaleString('ar-EG');
  }]
];

for (const [cmd, desc, fn] of CRYPTO_ENCODERS) {
  add(cmd, desc, async (m, ctx) => {
    const raw = String(ctx.text || '').trim() || (cmd.includes('json') ? '{"bot":"Light","active":true}' : cmd.includes('فك_hex') ? '4C69676874' : cmd.includes('ثماني_إلى') ? '110 151' : 'LightBot');
    const out = fn(raw);
    await sendInteractiveCard(m, ctx, { title: cmd.replace(/_/g, ' '), badge: '💻', body: out, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ الناتج', out)] });
  }, [cmd]);
}

add('فحص_رأس_jwt', 'فك قراءة قسمي Header و Payload لرمز JWT (لأغراض التعليم فقط)', async (m, ctx) => {
  const token = String(ctx.text || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkxpZ2h0In0.sig').trim();
  const [h, p] = token.split('.');
  if (!h || !p) return m.reply('📌 أدخل رمز JWT بصيغة header.payload.signature');
  const header = Buffer.from(h, 'base64url').toString('utf8');
  const payload = Buffer.from(p, 'base64url').toString('utf8');
  await sendInteractiveCard(m, ctx, {
    title: 'محلل بنية JWT',
    badge: '🪪',
    fields: [
      { icon: '🏷️', label: 'Header', value: header },
      { icon: '📦', label: 'Payload', value: payload }
    ],
    theme: 'cyber'
  });
}, ['فحص_رأس_jwt <token>']);

// ── 2. Networking, Subnetting, Chmod & Cloud Calculators ──
add('حاسبة_الشبكة_cidr', 'حساب عدد الأجهزة المتاحة (Hosts) وقناع الشبكة من قناع CIDR (/24 مثالاً)', async (m, ctx) => {
  const [cidr] = parseNumbers(ctx, [24]);
  const bits = Math.max(1, Math.min(32, Math.round(cidr)));
  const total = Math.pow(2, 32 - bits);
  const usable = bits >= 31 ? total : Math.max(0, total - 2);
  await sendInteractiveCard(m, ctx, {
    title: `حاسبة الشبكة /${bits}`,
    badge: '🌐',
    fields: [
      { icon: '🔢', label: 'إجمالي العناوين', value: total.toLocaleString('en-US') },
      { icon: '💻', label: 'الأجهزة القابلة للتخصيص', value: usable.toLocaleString('en-US') }
    ],
    theme: 'cyber'
  });
}, ['حاسبة_الشبكة_cidr <Prefix_0_32>']);

add('حاسبة_أذونات_chmod', 'تحليل رقم صلاحيات لينكس (مثل 755 أو 644) إلى rwx للمالك والمجموعة والجميع', async (m, ctx) => {
  const code = (String(ctx.text || '755').match(/[0-7]{3}/) || ['755'])[0];
  const map = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const sym = code.split('').map((d) => map[Number(d)]).join('');
  await sendInteractiveCard(m, ctx, {
    title: `تحليل صلاحيات chmod ${code}`,
    badge: '🐧',
    fields: [
      { icon: '👤', label: 'المالك (Owner)', value: map[Number(code[0])] },
      { icon: '👥', label: 'المجموعة (Group)', value: map[Number(code[1])] },
      { icon: '🌍', label: 'الآخرون (Others)', value: map[Number(code[2])] },
      { icon: '💻', label: 'الصيغة الرمزية', value: `-${sym}` }
    ],
    theme: 'cyber',
    buttons: [makeCopyButton('📋 نسخ الأمر', `chmod ${code} file`)]
  });
}, ['حاسبة_أذونات_chmod <755|644>']);

add('تحويل_ipv4_لثنائي', 'تحويل عنوان IPv4 إلى تمثيله الثنائي 32-bit Binary', async (m, ctx) => {
  const ip = (String(ctx.text || '192.168.1.1').match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/) || ['192.168.1.1'])[0];
  const bin = ip.split('.').map((o) => Math.min(255, Number(o)).toString(2).padStart(8, '0')).join('.');
  await sendInteractiveCard(m, ctx, { title: `IPv4 Binary: ${ip}`, badge: '📡', body: bin, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ', bin)] });
}, ['تحويل_ipv4_لثنائي <IP>']);

add('قراءة_تعبير_cron', 'ترجمة تعبير Cron الشائع أو شرح حقوله الخمسة باللغة العربية', async (m, ctx) => {
  const expr = String(ctx.text || '0 */6 * * *').trim();
  const presets = {
    '* * * * *': 'ينفّذ كل دقيقة واحدة',
    '0 * * * *': 'ينفّذ على رأس كل ساعة',
    '0 0 * * *': 'ينفّذ يومياً عند منتصف الليل (00:00)',
    '0 */6 * * *': 'ينفّذ كل 6 ساعات',
    '0 9 * * 1': 'ينفّذ كل يوم إثنين الساعة 9 صباحاً'
  };
  const meaning = presets[expr] || 'صيغة Cron مكونة من: [دقيقة] [ساعة] [يوم_الشهر] [شهر] [يوم_الأسبوع]';
  await sendInteractiveCard(m, ctx, { title: 'مترجم تعبير Cron', badge: '⏰', fields: [{ icon: '📝', label: 'التعبير', value: expr }, { icon: '💡', label: 'المعنى', value: meaning }], theme: 'cyber' });
}, ['قراءة_تعبير_cron <expr>']);

add('استخراج_روابط_من_نص', 'استخراج جميع الروابط URLs من أي نص ترسله', async (m, ctx) => {
  const txt = String(ctx.text || 'زر https://example.com أو https://github.com للتفاصيل');
  const urls = txt.match(/https?:\/\/[^\s]+/gi) || [];
  await sendInteractiveCard(m, ctx, { title: 'مستخرج الروابط', badge: '🔗', body: urls.length ? urls.join('\n') : 'لم يُعثر على روابط في النص.', theme: 'cyber' });
}, ['استخراج_روابط_من_نص <نص>']);

add('استخراج_بريد_من_نص', 'استخراج جميع عناوين البريد الإلكتروني من النص', async (m, ctx) => {
  const txt = String(ctx.text || 'للتواصل hello@example.com أو support@light.dev');
  const emails = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  await sendInteractiveCard(m, ctx, { title: 'مستخرج الإيميلات', badge: '📧', body: emails.length ? emails.join('\n') : 'لا توجد عناوين بريدية في النص.', theme: 'cyber' });
}, ['استخراج_بريد_من_نص <نص>']);

add('حاسبة_النطاق_الترددي', 'حساب زمن تحميل ملف بحجم (ميجابايت) وسرعة اتصال (Mbps)', [500, 50], async () => null);
handlers.pop(); // rebuild cleanly via shared formula loop below

const DEV_FORMULAS = [
  ['حاسبة_النطاق_الترددي', 'حساب زمن تنزيل ملف (MB) عبر سرعة (Mbps)', [500, 50], ([mb, mbps]) => {
    const sec = (mb * 8) / Math.max(0.1, mbps);
    return `📦 الحجم: ${mb} MB | 🌐 السرعة: ${mbps} Mbps\n⏱️ الزمن المتوقع: ${sec < 60 ? `${sec.toFixed(1)} ثانية` : `${(sec / 60).toFixed(2)} دقيقة`}`;
  }],
  ['حاسبة_مقياس_التوفر_sla', 'كم دقيقة توقف مسموحة سنوياً لنسبة توافر معينة (مثل 99.9%)', [99.9], ([pct]) => {
    const clamped = Math.max(50, Math.min(99.9999, pct));
    const downMinsYear = ((100 - clamped) / 100) * 525600;
    return `📊 التوفر: ${clamped}%\n⚠️ أقصى توقف مسموح سنوياً: ${downMinsYear.toFixed(1)} دقيقة (≈ ${(downMinsYear / 60).toFixed(2)} ساعة)`;
  }],
  ['حاسبة_حجم_قاعدة_بيانات', 'تقدير الحجم المطلوب لمليون سجل حسب متوسط حجم السجل بالبايت', [100000, 512], ([rows, bytes]) => {
    const mb = (rows * bytes) / (1024 * 1024);
    return `🗄️ ${rows.toLocaleString('en-US')} سجل × ${bytes} بايت = *${mb.toFixed(2)} MB* (أضف ~35% للفهارس)`;
  }],
  ['تقدير_نقاط_المهمة', 'تقدير جهد المهمة البرمجية بمضاعفات فيبوناتشي (ساعات × معامل المخاطرة)', [6, 1.5], ([hrs, risk]) =>
    `🧩 ساعات التقدير: ${hrs} × معامل ${risk} = *${Math.ceil(hrs * risk)} ساعة شاملة الاختبار والمراجعة*`
  ],
  ['تحويل_كائن_لواجهة_ts', 'تحويل مفاتيح نص مفصولة بـ | إلى واجهة TypeScript جاهزة للنسخ', null],
  ['مولد_تعليق_jsdoc', 'توليد توثيق JSDoc نظيف لأي دالة تكتب اسمها', null],
  ['مولد_فهرس_readme', 'بناء قالب ملف README.md احترافي لمشروع برمجي', null],
  ['نموذج_تقرير_خطأ', 'إنشاء قالب Bug Report قياسي (الخطوات / المتوقع / الفعلي)', null],
  ['اختبار_تطابق_regex', 'فحص تطابق نمط Regex مع نص (مثال: .اختبار_تطابق_regex \\d+ | رقم 42)', null],
  ['استخراج_وسوم_من_نص', 'استخراج جميع #الهاشتاغات من أي فقرة نصية', null]
];

for (const [cmd, desc, defs, fn] of DEV_FORMULAS) {
  add(cmd, desc, async (m, ctx) => {
    const t = String(ctx.text || '').trim();
    if (cmd === 'تحويل_كائن_لواجهة_ts') {
      const fields = t ? t.split(/[|،,]/).map((s) => s.trim()).filter(Boolean) : ['id', 'name', 'email'];
      const ts = `export interface ItemModel {\n${fields.map((f) => `  ${f.replace(/\s+/g, '_')}: string;`).join('\n')}\n}`;
      return sendInteractiveCard(m, ctx, { title: 'واجهة TypeScript المولدة', badge: '📘', body: ts, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ الكود', ts)] });
    }
    if (cmd === 'مولد_تعليق_jsdoc') {
      const fnName = t || 'calculateTotal';
      const doc = `/**\n * ${fnName} — وصف مختصر لوظيفة الدالة\n * @param {string} input - المعامل المدخل\n * @returns {Promise<object>} النتيجة المعالجة\n */`;
      return sendInteractiveCard(m, ctx, { title: 'توثيق JSDoc الجاهز', badge: '📝', body: doc, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ JSDoc', doc)] });
    }
    if (cmd === 'مولد_فهرس_readme') {
      const proj = t || 'My Awesome Project';
      const md = `# ${proj}\n\n## المزايا\n- أداء عالٍ\n- واجهة واضحة\n\n## التثبيت\n\`\`\`bash\nnpm install && npm start\n\`\`\``;
      return sendInteractiveCard(m, ctx, { title: 'قالب README.md', badge: '📄', body: md, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ README', md)] });
    }
    if (cmd === 'نموذج_تقرير_خطأ') {
      const bug = `🐞 *العنوان:* ${t || 'وصف الخطأ'}\n🔁 *خطوات إعادة الإنتاج:* 1. ... 2. ...\n✅ *السلوك المتوقع:* ...\n❌ *السلوك الفعلي:* ...`;
      return sendInteractiveCard(m, ctx, { title: 'نموذج تقرير خطأ برمجي', badge: '🐞', body: bug, theme: 'cyber', buttons: [makeCopyButton('📋 نسخ النموذج', bug)] });
    }
    if (cmd === 'اختبار_تطابق_regex') {
      const [pat, sample] = splitArgsPipe(ctx);
      const re = new RegExp(pat || '\\d+', 'g');
      const hits = (sample || 'Order 42 and 99').match(re) || [];
      return sendInteractiveCard(m, ctx, { title: 'مختبر Regex', badge: '🔍', body: hits.length ? `✅ التطابقات (${hits.length}): ${hits.join(' | ')}` : '❌ لا يوجد تطابق.', theme: 'cyber' });
    }
    if (cmd === 'استخراج_وسوم_من_نص') {
      const tags = (t || '#برمجة #أمان #تطوير').match(/#[\p{L}\p{N}_]+/gu) || [];
      return sendInteractiveCard(m, ctx, { title: 'مستخرج الهاشتاغات', badge: '#️⃣', body: tags.join(' ') || 'لا توجد وسوم.', theme: 'cyber' });
    }
    const vals = parseNumbers(ctx, defs);
    await sendInteractiveCard(m, ctx, { title: cmd.replace(/_/g, ' '), badge: '⚙️', body: fn(vals), theme: 'cyber' });
  }, [cmd]);
}

// ── 3. 75 Rich Encyclopedic Dev Cards: HTTP, Big-O, Ports, Linux, Security, Patterns ──
const DEV_REFERENCE = [
  ['مقياس_قوة_التشفير', 'لماذا يهم طول المفتاح (128 vs 256 bit) في AES؟ كل بت إضافي يضاعف احتمالات التخمين مرتين!'],
  ['زمن_كسر_كلمة_المرور', 'كلمة من 6 أحرف صغيرة تُكسر في ثوانٍ، بينما 14 حرفاً متنوعاً تحتاج مليارات السنين حاسوبياً.'],
  ['قناع_الشبكة', 'توضيح 255.255.255.0: أول 3 أجزاء تحدد عنوان الشبكة، والجزء الأخير يحدد عنوان الجهاز داخلها.'],
  ['نطاق_عنوان_ip', 'النطاقات الخاصة LAN: 10.0.0.0/8 و 172.16.0.0/12 و 192.168.0.0/16 لا تُوجّه عبر الإنترنت العام.'],
  ['تحليل_كوكيز_الأمان', 'احمِ الجلسات بـ 3 أعلام ذهبية: HttpOnly (يمنع JS)، Secure (HTTPS فقط)، و SameSite=Lax/Strict.'],
  ['دليل_ثغرة_xss', 'منع حقن السكربتات عبر الهروب السياقي للمدخلات وعدم استخدام innerHTML مع نصوص المستخدمين.'],
  ['دليل_حقن_sql', 'الوقاية القطعية من SQL Injection عبر الاستعلامات المعلمة (Parameterized Queries / Prepared Statements).'],
  ['دليل_ثغرة_csrf', 'منع تزوير الطلبات عبر توكنات CSRF والتحقق من Origin/SameSite لعمليات التغيير الحساسة.'],
  ['فحص_قوة_بريد', 'تأمين البريد ضد الانتحال يعتمد على ثلاثة سجلات: SPF للخوادم المخولة، DKIM للتوقيع، وDMARC للسياسة.'],
  ['تحليل_أمر_chmod', 'لا تعطِ 777 أبداً على خادم إنتاجي؛ استعمل 644 للملفات و 755 للمجلدات والسكربتات التنفيذية فقط.'],
  ['منفذ_http', 'Port 80 (HTTP غير المشفر) و Port 443 (HTTPS المشفر عبر TLS) هما بوابة الويب القياسية.'],
  ['منفذ_ssh', 'Port 22 لبروتوكول الدخول الآمن المشفر SSH لإدارة الخوادم ونقل الملفات عبر SFTP.'],
  ['منفذ_dns', 'Port 53 (UDP/TCP) لنظام أسماء النطاقات الذي يحول أسماء المواقع لعناوين IP.'],
  ['منفذ_smtp', 'Ports 25 / 465 / 587 لإرسال رسائل البريد الإلكتروني بين الخوادم والتطبيقات.'],
  ['منفذ_postgres', 'Port 5432 المنفذ الافتراضي لقواعد بيانات PostgreSQL العلائقية القوية.'],
  ['منفذ_redis', 'Port 6379 المنفذ الافتراضي لذاكرة التخزين المؤقت الفائقة السرعة Redis.'],
  ['شرح_سجلات_dns', 'A يربط بـ IPv4، و AAAA بـ IPv6، و CNAME اسم بديل، و MX خوادم البريد، و TXT للتحقق والأمان.'],
  ['سجل_spf', 'سجل نصي يحدد عناوين IP المسموح لها بإرسال البريد باسم نطاقك لمنع الرسائل المزيفة.'],
  ['سجل_dkim', 'توقيع رقمي بالمفتاح العام يثبت أن الرسالة لم تتعرض للتعديل أثناء عبورها بين الخوادم.'],
  ['سجل_dmarc', 'سياسة تخبر خوادم الاستقبال ماذا تفعل (none / quarantine / reject) إذا فشل SPF و DKIM.'],
  ['مفاهيم_docker', 'Image هي القالب الثابت، و Container هي النسخة الحية قيد التشغيل المعزولة، و Volume لحفظ البيانات.'],
  ['أوامر_git_الأساسية', 'git status للحالة، git add للتجهيز، git commit للحفظ المحلي، و git push للمزامنة البعيدة.'],
  ['حل_تعارض_git', 'افحص علامات <<<<<<< و ======= و >>>>>>> بعناية، احفظ المنطق الصحيح فقط، ثم اختبر الكود قبل الـ commit.'],
  ['إعداد_gitignore', 'ضع node_modules و .env و dist و ملفات السجلات داخل .gitignore قبل أول رفع لحماية أسرارك وحجم المستودع.'],
  ['حالة_النجاح_http', '200 OK: تم تنفيذ الطلب بنجاح وإرجاع الاستجابة المطلوبة بشكل سليم.'],
  ['حالة_الإنشاء_http', '201 Created: نجح الطلب وأُنشئ مورد جديد على الخادم (شائع مع POST).'],
  ['حالة_إعادة_توجيه_http', '301 Moved Permanently: نُقل المسار نهائياً لعنوان جديد وتحول محركات البحث فهرستها إليه.'],
  ['حالة_طلب_خاطئ_http', '400 Bad Request: صيغة الطلب أو البيانات المرسلة من العميل غير مكتملة أو غير صالحة.'],
  ['حالة_غير_مصرح_http', '401 Unauthorized: الطلب يتطلب تسجيل دخول أو رمز توثيق (Token) صالحاً.'],
  ['حالة_ممنوع_http', '403 Forbidden: الخادم يعرف هويتك لكنه يرفض منحك صلاحية الوصول لهذا المورد.'],
  ['حالة_غير_موجود_http', '404 Not Found: المسار أو المورد المطلوب غير موجود على الخادم حالياً.'],
  ['حالة_تجاوز_الحد_http', '429 Too Many Requests: تم تجاوز عدد الطلبات المسموح به (Rate Limit) — أضف مهلة Backoff.'],
  ['حالة_خطأ_خادم_http', '500 Internal Server Error: خطأ برمجي غير متوقع داخل الخادم يستدعي مراجعة السجلات.'],
  ['حالة_خدمة_متوقفة_http', '503 Service Unavailable: الخادم مشغول مؤقتاً أو في صيانة؛ أعد المحاولة بعد قليل.'],
  ['تعقيد_ثابت_o1', 'O(1): زمن ثابت لا يتأثر بحجم البيانات؛ مثل قراءة عنصر مصفوفة بالفهرس أو مفتاح Hash Map.'],
  ['تعقيد_لوغاريتمي_ologn', 'O(log n): يتضاعف حجم البيانات ألف مرة ولا يزيد العمل إلا خطوات معدودة — مثل البحث الثنائي!'],
  ['تعقيد_خطي_on', 'O(n): ينمو الزمن طردياً مع عدد العناصر؛ مثل المرور بحلقة واحدة على القائمة.'],
  ['تعقيد_فرز_onlogn', 'O(n log n): الكفاءة الذهبية لخوارزميات الفرز السريع والفرز بالدمج على المصفوفات الكبيرة.'],
  ['تعقيد_تربيعي_on2', 'O(n²): الحلقات المتداخلة على نفس المصفوفة؛ خطرة على البيانات الضخمة وقد تُستبدل بـ Set/Map.'],
  ['مقارنة_المصفوفة_والقائمة', 'المصفوفة توفر وصولاً فورياً O(1) بالفهرس، بينما القائمة المترابطة تسهل الإدراج في البداية والوسط.'],
  ['شجرة_البحث_الثنائية', 'هيكل شجري تبقى فيه القيم الأصغر يساراً والأكبر يميناً لتسريع البحث والإدراج المرتب.'],
  ['جداول_التجزئة', 'Hash Table يحوّل المفتاح بدالة سريعة إلى موقع مباشر في الذاكرة ليمنح بحثاً شبه فوري O(1).'],
  ['خوارزمية_ديكسترا', 'خوارزمية البحث عن أقصر مسار موزون في الرسوم البيانية، وتُستخدم في الخرائط والشبكات.'],
  ['الفرز_السريع', 'QuickSort: يختار عنصراً محورياً ويقسم المصفوفة لأصغر وأكبر ثم يكرر بالتقسيم السريع.'],
  ['الفرز_بالدمج', 'MergeSort: يقسم المصفوفة للنصف ثم يدمج القطع المرتبة بثبات O(n log n) دائماً.'],
  ['البرمجة_الديناميكية', 'حل المسائل المتشابكة بتخزين نتائج المسائل الفرعية (Memoization) لمنع إعادة الحساب.'],
  ['توليد_cron_شائع', 'أشهر الجداول: كل 5 دقائق `*/5 * * * *` | يومياً منتصف الليل `0 0 * * *` | أسبوعياً الأحد `0 8 * * 0`.'],
  ['شرح_نمط_regex', 'مفاتيح سريعة: `\\d` رقم، `\\w` حرف/رقم، `+` واحد فأكثر، `*` صفر فأكثر، `^` بداية، `$` نهاية.'],
  ['وقت_استجابة_النظام', 'أقل من 100ms يبدو فورياً للمستخدم، و300ms طبيعي للـ API، وفوق 1000ms يشعر ببطء واضح!'],
  ['نمط_المصنع', 'Factory Pattern: فصل منطق إنشاء الكائنات المعقدة في دالة مصنع موحدة تسهل التوسع.'],
  ['نمط_المراقب', 'Observer Pattern: اشتراك عدة مكونات في حدث واحد لإخطارها تلقائياً عند تغير الحالة.'],
  ['نمط_الاستراتيجية', 'Strategy Pattern: تبديل الخوارزمية أو طريقة الحساب في وقت التشغيل دون تعديل الكود المستدعي.'],
  ['نمط_المفرد', 'Singleton Pattern: ضمان وجود نسخة واحدة فقط لمدير الاتصال أو الإعدادات عبر التطبيق كله.'],
  ['مبادئ_solid', 'المبادئ الخمسة للكود القابل للصيانة: مسؤولية واحدة، مفتوح للتوسع، استبدال لسكوف، فصل الواجهات، وعكس التبعية.'],
  ['مبدأ_dry', 'Don’t Repeat Yourself: اجمع المنطق المشترك في دالة واحدة بدل نسخه في عشرة أماكن.'],
  ['مبدأ_kiss', 'Keep It Simple: الحل البسيط الواضح أسهل في التصحيح وأقل أعطالاً من الهندسة المعقدة بلا داعٍ.'],
  ['مبدأ_yagni', 'You Aren’t Gonna Need It: لا تكتب تعقيدات لمتطلبات خيالية مستقبلية قد لا يحتاجها المشروع أصلاً.'],
  ['اختبارات_الوحدة', 'اختبر الدوال الصافية وحالات الحافة (صفر/فارغ/خطأ) لضمان ثقة التعديلات المستقبلية.'],
  ['مراجعة_الأداء', 'قِس قبل أن تحسّن (Profile first)! ابحث عن استعلامات N+1 والعمليات المتكررة داخل الحلقات.'],
  ['تحسين_استعلام_sql', 'حدّد الأعمدة المطلوبة فقط بدل SELECT *، واستخدم LIMIT و الفهارس على أعمدة JOIN و WHERE.'],
  ['فهارس_القواعد', 'Indexes تسرّع القراءة عشرات المرات لكنها تبطئ الكتابة قليلاً؛ ضعها بذكاء على حقول البحث المتكرر.'],
  ['معمارية_الخدمات_المصغرة', 'لا تبدأ بـ Microservices لفريق صغير؛ Modular Monolith النظيف أسرع تطويراً وأقل تكلفة تشغيل.'],
  ['معايير_rest_api', 'استخدم الأسماء للـ Endpoints والأفعال لـ HTTP (GET/POST/PATCH/DELETE) مع رموز حالة دقيقة.'],
  ['مقارنة_graphql_rest', 'REST بسيط وسهل التخزين المؤقت (Caching)، بينما GraphQL يمنع جلب بيانات زائدة في الشاشات المتشعبة.'],
  ['قائمة_فحص_الأمان', 'تحقق المدخلات، تشفير الأسرار بالمتغيرات البيئية، Rate Limiting، وتحديث التبعيات الدورية.'],
  ['حاسبة_التكلفة_السحابية', 'راقب استهلاك Bandwidth، استعلامات قواعد البيانات، وإغلاق بيئات التجربة غير المستخدمة لتوفير 40%.'],
  ['تقنيات_الذاكرة_المخبئية', 'استخدم Cache-Aside مع مدة انتهاء TTL واضحة لتسريع الواجهات وتخفيف الضغط عن قاعدة البيانات.'],
  ['أسرار_مراجعة_الكود', 'راجع المنطق، الوضوح، ومعالجة الأخطاء بأسلوب بنّاء يركز على الكود لا الشخص.'],
  ['هندسة_سجلات_الأخطاء', 'سجّل السياق والسبب دون تسريب كلمات مرور أو توكنات المستخدمين أبداً في الـ Logs!'],
  ['حماية_واجهات_api', 'طبّق التحقق من الصلاحيات على مستوى كل سجل (RBAC/Ownership) لا على الواجهة الأمامية فقط.'],
  ['أفضل_ممارسات_async', 'استخدم Promise.all للطلبات المستقلة المتوازية بدل انتظارها واحداً تلو الآخر بـ await متسلسل.'],
  ['إدارة_الذاكرة_نود', 'نظّف المؤقتات والمستمعين (Listeners) عند إغلاق العمليات وتجنب تخزين بيانات لا نهائية في Map دون حد.'],
  ['استراتيجيات_النسخ_الاحتياطي', 'قاعدة 3-2-1: 3 نسخ من بياناتك، على وسيطين مختلفين، وإحداها خارج الموقع الجغرافي.'],
  ['ودجت_الطرفية_التفاعلي', 'فتح ودجت HTML تفاعلي يعرض مرجعاً سريعاً لأوامر الشبكة والأذونات'],
  ['تصويت_تقنية_الباك_إند', 'استطلاع رأي للمبرمجين لاختيار بيئة الباك إند المفضلة لديهم']
];

for (const [cmd, body] of DEV_REFERENCE) {
  add(cmd, body, async (m, ctx) => {
    if (cmd === 'ودجت_الطرفية_التفاعلي') {
      const html = makeSimpleHtmlWidget('💻 مختبر المطور السريع', '#06b6d4', [
        ['أذونات آمنة', '644 ملف | 755 مجلد'],
        ['أهم المنافذ', '443 HTTPS • 22 SSH • 5432 PG'],
        ['أعلى حماية كوكيز', 'HttpOnly + Secure + SameSite'],
        ['مبدأ ذهبي', 'KISS & DRY & Parameterized SQL']
      ]);
      return sendInteractiveWidget(m, ctx, { title: 'مختبر المطور السريع', html, fallbackText: '644 / 755 | HTTPS 443 | SQL Safety' });
    }
    if (cmd === 'تصويت_تقنية_الباك_إند') {
      return sendInteractivePoll(m, ctx, {
        name: 'ما هي بيئتك المفضلة لبناء تطبيقات الباك إند والأتمتة؟',
        values: ['🟩 Node.js / TypeScript', '🐍 Python (FastAPI/Django)', '🐹 Go', '🦀 Rust'],
        selectableCount: 1
      });
    }
    await sendInteractiveCard(m, ctx, { title: cmd.replace(/_/g, ' '), badge: '🖥️', body, theme: 'cyber' });
  }, [cmd], cmd.startsWith('ودجت_') || cmd.startsWith('تصويت_') ? 'native' : 'tools');
}

export default handlers;
