import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const SELF_FILE = path.resolve(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.dirname(SELF_FILE), '..', '..');
const MAX_SOURCE_SIZE = 2 * 1024 * 1024;
const MAX_VIEW_TEXT = 3500;

// الفكرة الأصلية: https://t.me/YatoCoding — النسخة المضبوطة لـ LIGHT BOT
const CATEGORIES = {
  owner:  { folder: 'owner',     declaration: 'owner',    aliases: ['owners','اونر','مالك','مطور','المطور'] },
  admin:  { folder: 'admin',     declaration: 'admin',    aliases: ['admins','ادمن','الادمن','ادارة','الادارة'] },
  game:   { folder: 'game',      declaration: 'games',    aliases: ['games','gaming','العاب','الالعاب','لعبه','لعبة'] },
  tools:  { folder: 'tools',     declaration: 'tools',    aliases: ['tool','ادوات','الادوات'] },
  download:{ folder: 'download', declaration: 'downloads',aliases: ['downloads','تحميل','التحميل','التحميلات'] },
  group:  { folder: 'group',     declaration: 'group',    aliases: ['groups','مجموعه','المجموعات'] },
  guild:  { folder: 'guild',     declaration: 'group',    aliases: ['سيرفر','السيرفرات'] },
  ai:     { folder: 'ai',        declaration: 'ai',       aliases: ['ذكاء','الذكاء','الذكاء_الاصطناعي'] },
  bank:   { folder: 'bank',      declaration: 'bank',     aliases: ['بنك','البنوك'] },
  info:   { folder: 'info',      declaration: 'info',     aliases: ['معلومات','المعلومات','تفاصيل'] },
  search: { folder: 'search',    declaration: 'search',   aliases: ['بحث','البحث'] },
  sticker:{ folder: 'sticker',   declaration: 'sticker',  aliases: ['stickers','ستيكير','ملصق','الملصقات'] },
  subs:   { folder: 'subs',      declaration: 'sub',      aliases: ['sub','بوت','بوتات','البوتات'] },
  voices: { folder: 'voices',    declaration: 'voices',   aliases: ['voice','صوت','اصوات'] },
  logo:   { folder: 'logo',      declaration: 'logos',    aliases: ['logos','لوجو','اللوجوهات'] },
  gif:    { folder: 'gif',       declaration: 'gif',      aliases: ['gifs','جيف'] },
  islamic:{ folder: 'islamic',   declaration: 'islamic',  aliases: ['اسلامي','اسلاميه'] },
  auto:   { folder: 'auto',      declaration: 'owner',    aliases: ['تلقائي','تلقائيه'] },
  nicknames:{folder:'nicknames', declaration:'nicknames', aliases: ['الالقاب','الألقاب'] }
};

const CATEGORY_MAP = new Map();
for (const [id, info] of Object.entries(CATEGORIES)) {
  CATEGORY_MAP.set(id, info);
  for (const alias of info.aliases) CATEGORY_MAP.set(alias, info);
}

const ACTIONS = new Map([
  ['حفظ','save'],['sp','save'],['saveplugin','save'],['add_plugin','save'],['اضافه_بلاجين','save'],
  ['جديد','new'],['new','new'],['newplugin','new'],['انشاء','new'],['قالب','new'],['template','new'],
  ['حذف','delete'],['dp','delete'],['deleteplugin','delete'],
  ['عرض','view'],['gp','view'],['getplugin','view'],['كود_بلاجين','view'],
  ['عدل','edit'],['ep','edit'],['editplugin','edit'],['ufp','edit'],
  ['تحقق','check'],['كشف','check'],['searchplugin','check'],
  ['ابحث','grep'],['grep','grep'],
  ['تسمية','rename'],['rp','rename'],['renameplugin','rename'],
  ['قائمة','list'],['lp','list'],['listplugins','list'],
  ['معلومات','info'],['infop','info'],
  ['نسخ','copy'],['copy','copy'],['copyplugin','copy'],
  ['فئات','categories'],['الاقسام','categories'],['categories','categories']
]);

class UserError extends Error {}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
    .replace(/[\u064B-\u0652]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\s_-]+/g, '');
}

function getCategory(value) {
  if (!value) throw new UserError('حدد الفئة (owner, admin, game, tools, download, group, ai, bank, info, search, sticker, sub, voices, logo, gif, islamic, auto, nicknames).');
  const result = CATEGORY_MAP.get(value);
  if (!result) throw new UserError(`فئة غير معروفة: ${value}\nالفئات: ${Object.keys(CATEGORIES).join(' / ')}`);
  return result;
}

function safeName(value) {
  let name = String(value ?? '').trim().replace(/\.js$/i, '').replace(/^\/+/g, '');
  if (!name || name === '.' || name === '..' || name.includes('..')) throw new UserError('اسم الملف غير صحيح.');
  name = name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^[-_]+|[-_]+$/g, '');
  if (!name || name.length > 100) throw new UserError('اسم الملف غير صحيح أو طويل جداً.');
  return name;
}

function parseSpec(value, fallback = CATEGORIES.owner) {
  const route = String(value ?? '').trim().replace(/\\/g, '/');
  if (!route) throw new UserError('اكتب اسم الملف.');
  const parts = route.split(/[\s/]+/).filter(Boolean);
  if (!parts.length) throw new UserError('اكتب اسم الملف.');
  let category = fallback;
  let explicit = false;
  if (parts.length > 1 && CATEGORY_MAP.has(parts[0])) {
    category = getCategory(parts.shift());
    explicit = true;
  } else if (route.includes('/')) {
    throw new UserError(`الفئة غير معروفة في المسار: ${parts[0]}`);
  }
  return { name: safeName(parts.join('_')), category, explicit };
}

function getBase(bot) {
  return path.resolve(ROOT, bot?.config?.commandsPath || './plugins');
}

function assertInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) return;
  throw new UserError('المسار خارج مجلد البلاجينز.');
}

function assertNotSelf(target) {
  if (path.resolve(target) === SELF_FILE) throw new UserError('لا يمكن تعديل أو حذف ملف المدير نفسه.');
}

function directFile(base, spec) {
  const target = path.join(base, spec.category.folder, `${spec.name}.js`);
  assertInside(base, target);
  assertNotSelf(target);
  return target;
}

function walk(base) {
  const output = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.js')) output.push(full);
    }
  };
  visit(base);
  return output;
}

function rel(base, file) { return path.relative(base, file).split(path.sep).join('/'); }

function resolveOne(base, spec) {
  let files;
  if (spec.explicit) files = [directFile(base, spec)];
  else files = walk(base).filter(file => path.basename(file, '.js').toLowerCase() === spec.name.toLowerCase());
  files = files.filter(file => fs.existsSync(file));
  if (files.length === 1) return files[0];
  if (!files.length) throw new UserError(`الملف غير موجود: ${spec.category.folder}/${spec.name}.js`);
  throw new UserError(`الاسم مكرر،حدد الفئة:\n${files.map(file => `• ${rel(base, file)}`).join('\n')}`);
}

function quotedSource(m) {
  const q = m?.quoted;
  if (!q) return '';
  const values = [q.text, q.body, q.msg?.text, q.message?.conversation, q.message?.extendedTextMessage?.text, q.message?.imageMessage?.caption, q.message?.videoMessage?.caption];
  return values.find(value => typeof value === 'string' && value.trim()) || '';
}

function cleanSource(value) {
  const source = String(value ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) throw new UserError('الكود المرسل فارغ.');
  if (source.includes('\u0000')) throw new UserError('الكود يحتوي على حرف غير مسموح.');
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_SIZE) throw new UserError(`الحد الأقصى ${Math.round(MAX_SOURCE_SIZE / 1024)} KB.`);
  return source.endsWith('\n') ? source : `${source}\n`;
}

async function syntaxCheck(source) {
  const temp = path.join(os.tmpdir(), `lightbot-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mjs`);
  try {
    fs.writeFileSync(temp, source, 'utf8');
    await execFile(process.execPath, ['--check', temp], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    const msg = String(error.stderr || error.message || error).replaceAll(temp, 'الكود').trim();
    throw new UserError(`فشل فحص JavaScript:\n${msg.slice(0, 1400)}`);
  } finally {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
  }
}

function atomicWrite(file, source) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, source, 'utf8');
    fs.renameSync(temp, file);
  } finally {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
  }
}

async function sendFile(conn, m, file, fileName, caption) {
  await conn.sendMessage(m.chat, {
    document: fs.readFileSync(file),
    mimetype: 'text/javascript',
    fileName,
    caption,
    contextInfo: { mentionedJid: [m.sender] }
  }, { quoted: m });
}

function bytes(size) {
  return size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(2)} KB` : `${(size / 1048576).toFixed(2)} MB`;
}

function makeTemplate(spec) {
  const commandName = /^\d/.test(spec.name) ? `cmd_${spec.name}` : spec.name;
  const lines = [
    '// تم إنشاء هذا البلاجن بواسطة مدير بلاجينز LIGHT BOT',
    `// الفئة: ${spec.category.folder} (${spec.category.declaration})`,
    '',
    'const handler = async (m, { text, usedPrefix, command }) => {',
    '  try {',
    '    if (!text) return m.reply(`📌 الاستخدام: ${usedPrefix}${command} <نص>`);',
    '    await m.reply(`✅ تم تشغيل ${command}: ${text}`);',
    '  } catch (error) {',
    '    console.error(error);',
    '    await m.reply(`❌ ${error.message || error}`);',
    '  }',
    '};',
    '',
    `handler.command = [${JSON.stringify(commandName)}];`,
    `handler.usage = [${JSON.stringify(`${commandName} <نص>`)}];`,
    `handler.category = ${JSON.stringify(spec.category.declaration)};`,
    'handler.usePrefix = true;',
    '',
    'export default handler;',
    ''
  ];
  return lines.join('\n');
}

function usage(command, usedPrefix) {
  const p = usedPrefix || '.';
  return [
    '🧰 *مدير البلاجينز — LIGHT BOT*',
    `📌 ${p}${command} <الفئة> <اسم_الملف>`,
    '',
    `• جديد: ${p}جديد game my_game — إنشاء قالب جاهز`,
    `• حفظ: ${p}حفظ owner my_plugin — (رد على الكود)`,
    `• تعديل: ${p}عدل owner/my_plugin — (رد على الكود الجديد)`,
    `• حذف: ${p}حذف owner/my_plugin — نسخة احتياطية قبل الحذف`,
    `• عرض: ${p}عرض owner/my_plugin`,
    `• نسخ: ${p}نسخ old | new`,
    `• تسمية: ${p}تسمية old | new`,
    `• بحث: ${p}ابحث كلمة`,
    `• فئات: ${p}فئات`,
    '',
    `الفئات: ${Object.keys(CATEGORIES).join(' / ')}`
  ].join('\n');
}

function parseMany(value) {
  return String(value || '').trim().split(/[,،;؛]+/).map(item => item.trim()).filter(Boolean).map(item => parseSpec(item));
}

const handler = async (m, { conn, bot, text, command, usedPrefix }) => {
  try {
    if (m.isOwner === false) return m.reply('❌ هذا أمر المطور فقط.');

    const action = ACTIONS.get(String(command || '').toLowerCase());
    const raw = String(text || '').trim();
    const base = getBase(bot);
    if (!fs.existsSync(base)) throw new UserError(`مجلد البلاجينز غير موجود: ${base}`);

    if (action === 'categories') {
      const files = walk(base);
      const counts = {};
      for (const file of files) {
        const folder = rel(base, file).split('/')[0] || 'root';
        counts[folder] = (counts[folder] || 0) + 1;
      }
      const lines = ['📂 *الفئات الحالية*'];
      for (const [folder, count] of Object.entries(counts).sort()) lines.push(`• ${folder}: ${count} ملف`);
      if (!files.length) lines.push('لا توجد ملفات JavaScript بعد.');
      return m.reply(lines.join('\n'));
    }

    if (action === 'list' && !raw) {
      const files = walk(base);
      const lines = files.slice(0, 150).map(file => `• ${rel(base, file)}`);
      if (files.length > 150) lines.push(`… و${files.length - 150} ملفاً آخر.`);
      return m.reply(lines.length ? ['📂 *البلاجينز*', ...lines].join('\n') : '📂 لا توجد بلاجينز.');
    }
    if (!raw && action !== 'list') return m.reply(usage(command, usedPrefix));

    if (action === 'save') {
      const spec = parseSpec(raw);
      const source = cleanSource(quotedSource(m));
      await syntaxCheck(source);
      const file = directFile(base, spec);
      const existed = fs.existsSync(file);
      if (existed) await sendFile(conn, m, file, `${spec.name}_old.js`, `📦 نسخة قديمة قبل الحفظ: ${rel(base, file)}`);
      atomicWrite(file, source);
      await sendFile(conn, m, file, `${spec.name}.js`, `✅ تم الحفظ: ${rel(base, file)}`);
      return m.reply(`✅ تم ${existed ? 'تحديث' : 'حفظ'} البلاجن.\n📁 ${rel(base, file)}\n♻️ سيُحمّل بعد إعادة تشغيل البوت.`);
    }

    if (action === 'new') {
      const spec = parseSpec(raw);
      const file = directFile(base, spec);
      if (fs.existsSync(file)) throw new UserError(`الملف موجود: ${rel(base, file)}\nاستخدم ${usedPrefix || '.'}عدل ${spec.category.folder}/${spec.name} بدل الإنشاء.`);
      const source = makeTemplate(spec);
      await syntaxCheck(source);
      atomicWrite(file, source);
      await sendFile(conn, m, file, `${spec.name}.js`, `✨ تم إنشاء بلاجن جديد: ${rel(base, file)}`);
      return m.reply(`✅ تم إنشاء القالب في ${rel(base, file)}\n🛠️ عدّل الكود ثم أرسله مع: ${usedPrefix || '.'}عدل ${spec.category.folder}/${spec.name}`);
    }

    if (action === 'view') {
      const file = resolveOne(base, parseSpec(raw));
      const source = fs.readFileSync(file, 'utf8');
      if (source.length > MAX_VIEW_TEXT) await sendFile(conn, m, file, path.basename(file), `📄 كود ${rel(base, file)}`);
      else return m.reply(`📄 ${rel(base, file)}\n\n\`\`\`js\n${source.replaceAll('```', "''' ")}\n\`\`\``);
    }

    if (action === 'edit') {
      const file = resolveOne(base, parseSpec(raw));
      const source = cleanSource(quotedSource(m));
      await syntaxCheck(source);
      await sendFile(conn, m, file, `${path.basename(file, '.js')}_old.js`, `⬇️ النسخة القديمة: ${rel(base, file)}`);
      atomicWrite(file, source);
      await sendFile(conn, m, file, `${path.basename(file, '.js')}_new.js`, `⬆️ النسخة الجديدة: ${rel(base, file)}`);
      return m.reply(`✅ تم تعديل ${rel(base, file)} بنجاح.`);
    }

    if (action === 'delete') {
      const specs = parseMany(raw);
      const deleted = [];
      const missing = [];
      for (const spec of specs.slice(0, 30)) {
        let file;
        try { file = resolveOne(base, spec); } catch { missing.push(spec.name); continue; }
        await sendFile(conn, m, file, path.basename(file), `📦 نسخة احتياطية قبل الحذف: ${rel(base, file)}`);
        fs.unlinkSync(file);
        deleted.push(rel(base, file));
      }
      const report = [`🗑️ تم الحذف: ${deleted.length}`];
      if (deleted.length) report.push(...deleted.map(file => `• ${file}`));
      if (missing.length) report.push(`⚠️ غير موجود: ${missing.join('، ')}`);
      return m.reply(report.join('\n'));
    }

    if (action === 'check') {
      const needle = raw.toLowerCase();
      const files = walk(base).filter(file => path.basename(file).toLowerCase().includes(needle));
      if (!files.length) return m.reply('🔍 لا توجد نتائج.');
      return m.reply(`🔍 النتائج:\n${files.slice(0, 100).map(file => `• ${rel(base, file)}`).join('\n')}`);
    }

    if (action === 'grep') {
      const needle = raw.toLowerCase();
      const found = [];
      for (const file of walk(base)) {
        try { if (fs.readFileSync(file, 'utf8').toLowerCase().includes(needle)) found.push(rel(base, file)); } catch {}
      }
      if (!found.length) return m.reply(`🔍 الكلمة غير موجودة: ${raw}`);
      return m.reply(`🔍 وُجدت في:\n${found.slice(0, 100).map(file => `• ${file}`).join('\n')}`);
    }

    if (action === 'info') {
      const file = resolveOne(base, parseSpec(raw));
      const stat = fs.statSync(file);
      return m.reply(`📄 *${rel(base, file)}*\n📏 الحجم: ${bytes(stat.size)}\n📝 التعديل: ${stat.mtime.toLocaleString('ar-EG')}`);
    }

    if (action === 'rename') {
      const parts = raw.split(/\s*[|،]\s*/).filter(Boolean);
      if (parts.length !== 2) throw new UserError(`الاستخدام: ${usedPrefix || '.'}تسمية old | new`);
      const source = resolveOne(base, parseSpec(parts[0]));
      const sourceCategory = CATEGORIES[rel(base, source).split('/')[0]] || CATEGORIES.owner;
      const targetSpec = parseSpec(parts[1], sourceCategory);
      const target = directFile(base, targetSpec);
      if (fs.existsSync(target)) throw new UserError(`الاسم الجديد مستخدم: ${rel(base, target)}`);
      await sendFile(conn, m, source, path.basename(source), `📦 نسخة قبل إعادة التسمية: ${rel(base, source)}`);
      fs.renameSync(source, target);
      return m.reply(`✅ تم تغيير الاسم إلى ${rel(base, target)}`);
    }

    if (action === 'copy') {
      const parts = raw.split(/\s*[|،]\s*/).filter(Boolean);
      if (parts.length !== 2) throw new UserError(`الاستخدام: ${usedPrefix || '.'}نسخ old | new`);
      const source = resolveOne(base, parseSpec(parts[0]));
      const sourceCategory = CATEGORIES[rel(base, source).split('/')[0]] || CATEGORIES.owner;
      const target = directFile(base, parseSpec(parts[1], sourceCategory));
      if (fs.existsSync(target)) throw new UserError(`الملف الجديد موجود: ${rel(base, target)}`);
      const sourceText = fs.readFileSync(source, 'utf8');
      await syntaxCheck(sourceText);
      atomicWrite(target, sourceText);
      await sendFile(conn, m, target, path.basename(target), `📄 نسخة جديدة: ${rel(base, target)}`);
      return m.reply(`✅ تم نسخ ${rel(base, source)} إلى ${rel(base, target)}`);
    }

    if (action === 'list') {
      const category = getCategory(raw);
      const dir = path.join(base, category.folder);
      const files = fs.existsSync(dir) ? walk(dir).filter(file => path.dirname(file) === path.resolve(dir)) : [];
      return m.reply(files.length ? [`📂 ${category.folder} (${files.length})`, ...files.map(file => `• ${path.basename(file)}`)].join('\n') : `📂 لا توجد ملفات في ${category.folder}.`);
    }
  } catch (error) {
    console.error('[control_plugins]', error);
    return m.reply(`❌ ${error.message || error}`);
  }
};

handler.command = [
  'حفظ','sp','saveplugin','add_plugin','اضافه_بلاجين','اضافة_بلاجين',
  'جديد','new','newplugin','انشاء','انشاء_بلاجين','قالب','template',
  'حذف','dp','deleteplugin','delete_file',
  'عرض','gp','getplugin','كود_بلاجين','view_plugin',
  'عدل','ep','editplugin','ufp','تعديل_بلاجين',
  'تحقق','كشف','searchplugin','verify','cfg',
  'ابحث','grep',
  'تسمية','rp','renameplugin','zens','rename',
  'قائمة','lp','listplugins',
  'معلومات','infop','ifesat',
  'نسخ','copy','copyplugin',
  'فئات','الاقسام','categories','cat'
];
handler.usage = ['حفظ <الفئة> <اسم_الملف> | جديد <الفئة> <اسم_الملف> | عرض <الفئة>/<اسم_الملف>'];
handler.category = 'owner';
handler.owner = true;
handler.usePrefix = true;

export default handler;