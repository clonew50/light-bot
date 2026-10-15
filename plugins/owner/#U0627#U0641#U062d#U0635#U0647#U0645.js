/*
 * ⌁ 𝐍𝐎𝐗 ⌁
 * 𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙽𝙺𝚂
 *
 * 「 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 𝐁𝐲 𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙽𝙺𝚂 」
 * 「 لا تحذف الحقوق 🖤 」
 * https://github.com/SHANKS-CODE-1/CODE
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const SELF_FILE = path.resolve(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.dirname(SELF_FILE), '..', '..');
const SELF_RELATIVE = relativePath(ROOT, SELF_FILE);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DETAILS = 180;
const MAX_CONFLICTS = 100;
const CHUNK_SIZE = 3400;
const TEST_CHAT = 'plugin-test@s.whatsapp.net';
const TEST_SENDER = 'plugin-tester@s.whatsapp.net';

const VALID_CATEGORIES = new Set([
  'tools', 'owner', 'admin', 'group', 'bank', 'games', 'ai', 'downloads',
  'sticker', 'search', 'info', 'islamic', 'voices', 'logos', 'sub', 'gif',
  'nicknames'
]);

const RISKY_COMMANDS = new Set([
  'eval', 'execute', 'exec', 'restart', 'stop', 'shutdown', 'exit',
  'clear', 'clean', 'deleteall', 'delete-all', 'leave', 'join', 'logout',
  'update', 'upgrade', 'pull', 'gitpull', 'deploy'
]);

function getPluginDir(bot) {
  const configured = bot?.config?.commandsPath || './plugins';
  if (path.isAbsolute(configured)) return configured;

  const fromCwd = path.resolve(process.cwd(), configured);
  return fs.existsSync(fromCwd) ? fromCwd : path.resolve(ROOT, configured);
}

function relativePath(base, file) {
  return path.relative(base, file).split(path.sep).join('/');
}

function walk(base) {
  const files = [];
  const skippedDirectories = new Set(['node_modules', '.git', '.cache', 'tmp']);

  const visit = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.js')) {
        files.push(fullPath);
      }
    }
  };

  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) visit(base);
  return files;
}

function normalizeCommand(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function commandSection(source) {
  const start = source.search(/\bhandler\.command\s*=/);
  if (start < 0) return '';

  const tail = source.slice(start);
  const semicolon = tail.indexOf(';');
  const nextProperty = tail.search(/\n\s*handler\.[A-Za-z_$][\w$]*\s*=/);
  const ends = [semicolon, nextProperty].filter((value) => value >= 0);
  const end = ends.length ? Math.min(...ends) : tail.length;
  return tail.slice(0, end);
}

function getStaticCommands(source) {
  const section = commandSection(source);
  if (!section || /^\s*\//.test(section)) return [];

  const commands = [];
  const literalPattern = /(['"`])(?:\\.|(?!\1)[^\\\r\n])*\1/g;
  let literalMatch;

  while ((literalMatch = literalPattern.exec(section))) {
    const value = literalMatch[0].slice(1, -1).trim();
    if (value) commands.push(value);
  }

  return [...new Set(commands)];
}

function getCommands(command) {
  if (typeof command === 'string') return command.trim() ? [command.trim()] : [];
  if (!Array.isArray(command)) return [];

  return [...new Set(
    command
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
  )];
}

function validCommandDeclaration(command) {
  if (command instanceof RegExp || typeof command === 'string') return true;
  return Array.isArray(command)
    && command.length > 0
    && command.every((value) => typeof value === 'string' && Boolean(value.trim()));
}

function cleanError(error, file = SELF_FILE) {
  return String(error?.stderr || error?.message || error)
    .replaceAll(file, path.basename(file))
    .replaceAll(ROOT + path.sep, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700) || 'فشل غير معروف';
}

async function syntaxCheck(file) {
  try {
    await execFile(process.execPath, ['--check', file], {
      cwd: ROOT,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return null;
  } catch (error) {
    return cleanError(error, file);
  }
}

function getExportInfo(module) {
  const defaultExport = module?.default;

  if (typeof defaultExport === 'function') {
    return {
      ok: true,
      handler: defaultExport,
      legacy: false,
      error: ''
    };
  }

  if (defaultExport && typeof defaultExport.handler === 'function') {
    return {
      ok: true,
      handler: defaultExport.handler,
      legacy: true,
      error: ''
    };
  }

  if (defaultExport && typeof defaultExport.before === 'function') {
    return {
      ok: true,
      handler: defaultExport.before,
      legacy: true,
      hookOnly: true,
      error: ''
    };
  }

  return {
    ok: false,
    handler: null,
    legacy: false,
    error: 'الملف اتحمّل، لكن التصدير الافتراضي مش function مجهزة للأوامر أو before'
  };
}

function isHookOnly(handler, exportInfo) {
  if (exportInfo.hookOnly) return true;
  if (handler.command !== undefined) return false;
  return handler.name === 'before' || typeof handler.before === 'function';
}

function shouldSkipInvocation(relativeFile, handler, commands, exportInfo) {
  if (relativeFile === SELF_RELATIVE) {
    return 'البلوقن الحالي اتشحن بالفعل؛ تشغيله هيعمل استدعاء متكرر';
  }

  if (isHookOnly(handler, exportInfo)) {
    return 'ملف before؛ بيتحمّل وفحص، لكن مش بيتنفذ بت;message وهمية';
  }

  if (handler.owner === true || handler.admin === true || handler.botAdmin === true) {
    return 'أمر صلاحيات؛ اتحمّل وفحص، بس تشغيله الوهمي اتخطى لمنع آثار جانبية';
  }

  const normalized = commands.map(normalizeCommand);
  if (normalized.some((command) => RISKY_COMMANDS.has(command))) {
    return 'أمر حساس؛ اتحمّل وفحص، بس التشغيل اتخطى لمنع آثار جانبية';
  }

  return '';
}

function makeMockDatabase() {
  const users = new Map();
  const groups = new Map();

  const getUser = (jid) => {
    if (!users.has(jid)) {
      users.set(jid, {
        name: 'Plugin Tester',
        jid,
        lid: '',
        xp: 0,
        level: 0,
        limit: 0,
        ban: false
      });
    }
    return users.get(jid);
  };

  const getGroup = (jid) => {
    if (!groups.has(jid)) {
      groups.set(jid, {
        antiLink: false,
        antiBadword: false,
        welcome: false,
        mute: false
      });
    }
    return groups.get(jid);
  };

  return {
    users: new Proxy({}, {
      get: (_target, key) => typeof key === 'string' ? getUser(key) : undefined,
      set: (_target, key, value) => {
        getUser(key);
        users.set(key, value);
        return true;
      },
      has: () => true
    }),
    groups: new Proxy({}, {
      get: (_target, key) => typeof key === 'string' ? getGroup(key) : undefined,
      set: (_target, key, value) => {
        getGroup(key);
        groups.set(key, value);
        return true;
      },
      has: () => true
    })
  };
}

function createGenericMock() {
  const target = function mockUnknown() { return Promise.resolve({}); };
  return new Proxy(target, {
    get(_target, property) {
      if (property === 'then') return undefined;
      if (property === 'toString') return () => '';
      if (property === Symbol.iterator) return function* emptyIterator() {};
      if (property === Symbol.asyncIterator) return function* emptyAsyncIterator() {};
      return createGenericMock();
    },
    apply() {
      return Promise.resolve({});
    },
    construct() {
      return {};
    }
  });
}

async function safeInvoke(handler, bot) {
  const generic = createGenericMock();
  const messageKey = { id: 'PLUGIN_TEST', remoteJid: TEST_CHAT, fromMe: true };
  const sent = [];

  const send = async (...args) => {
    sent.push(args);
    if (sent.length > 5) sent.shift();
    return { key: messageKey };
  };

  const conn = {
    user: { id: TEST_SENDER, lid: '', name: 'Plugin Tester' },
    sock: null,
    sendMessage: send,
    sendButton: send,
    sendButtonNormal: send,
    sendCarousel: send,
    relayMessage: send,
    sendReaction: async () => ({}),
    react: async () => ({}),
    readMessages: async () => ({}),
    profilePictureUrl: async () => '',
    downloadMediaMessage: async () => Buffer.alloc(0),
    groupMetadata: async () => ({
      id: TEST_CHAT,
      participants: [{ id: TEST_SENDER, phoneNumber: TEST_SENDER, isAdmin: false }],
      admins: [],
      owner: TEST_SENDER
    }),
    groupParticipantsUpdate: async () => ({}),
    groupUpdate: async () => ({}),
    updateBlockStatus: async () => ({}),
    presenceUpdate: async () => ({})
  };
  conn.sock = conn;

  const messageTarget = {
    chat: TEST_CHAT,
    sender: TEST_SENDER,
    user: TEST_SENDER,
    text: '',
    body: '',
    args: [],
    command: '',
    usedPrefix: '',
    isOwner: false,
    isAdmin: false,
    isBotAdmin: false,
    isGroup: false,
    isPrivate: true,
    quoted: null,
    mentionedJid: [],
    participants: [],
    key: messageKey,
    msg: {
      key: messageKey,
      contextInfo: {},
      messageTimestamp: Date.now()
    },
    reply: async () => ({}),
    react: async () => ({}),
    delete: async () => ({}),
    client: async () => conn,
    lid2jid: async (jid) => jid
  };

  const message = new Proxy(messageTarget, {
    get(target, property) {
      if (property in target) return target[property];
      return generic;
    }
  });

  const botTarget = {
    ...(bot || {}),
    config: {
      ...(bot?.config || {}),
      commandsPath: bot?.config?.commandsPath || './plugins',
      prefix: bot?.config?.prefix || ['.', '/', '!'],
      owners: bot?.config?.owners || []
    },
    isSubBot: false,
    getAllCommands: () => [],
    sock: conn
  };

  const contextTarget = {
    conn,
    bot: botTarget,
    args: [],
    text: '',
    command: '',
    usedPrefix: '',
    participants: [],
    groupMetadata: {},
    settings: {},
    chat: {},
    config: botTarget.config
  };

  const context = new Proxy(contextTarget, {
    get(target, property) {
      if (property in target) return target[property];
      return generic;
    }
  });

  const oldDatabase = global.db;
  global.db = makeMockDatabase();

  try {
    await handler(message, context);
    return { ok: true, calls: sent.length, error: '' };
  } catch (error) {
    return { ok: false, calls: sent.length, error: cleanError(error, SELF_FILE) };
  } finally {
    global.db = oldDatabase;
  }
}

function splitChunks(lines) {
  const chunks = [];
  let current = [];
  let size = 0;

  for (const line of lines) {
    const lineSize = line.length + 1;
    if (current.length && size + lineSize > CHUNK_SIZE) {
      chunks.push(current.join('\n'));
      current = [];
      size = 0;
    }
    current.push(line);
    size += lineSize;
  }

  if (current.length) chunks.push(current.join('\n'));
  return chunks.length ? chunks : ['(لا توجد تفاصيل)'];
}

const handler = async (m, { bot }) => {
  try {
    if (!m.isOwner) return m.reply('❌ ده أمر المطور فقط.');

    const pluginDir = getPluginDir(bot);
    if (!fs.existsSync(pluginDir) || !fs.statSync(pluginDir).isDirectory()) {
      return m.reply(`❌ مجلد البلاجينز مش موجود: ${pluginDir}`);
    }

    const files = walk(pluginDir);
    if (!files.length) return m.reply('📂 مفيش ملفات JavaScript في مجلد البلاجينز.');

    await m.reply(
      `🧪 جاري فحص ${files.length} بلاجن بالطريقتين مع بعض...\n` +
      '1️⃣ فحص الصياغة  |  2️⃣ تحميل ESM وتجربة آمنة للـ handler\n' +
      'ℹ️ التجربة الآمنة بتحط رسالة وهمية؛ وأوامر الصلاحيات والأوامر الحساسة بتتحمل وتتفحص من غير تنفيذ حقيقي.'
    );

    const reports = [];
    const commandOwners = new Map();

    let syntaxChecked = 0;
    let syntaxOk = 0;
    let syntaxFailed = 0;
    let loadOk = 0;
    let loadFailed = 0;
    let loadSkipped = 0;
    let runOk = 0;
    let runFailed = 0;
    let runSkipped = 0;

    for (const file of files) {
      const relativeFile = relativePath(pluginDir, file);
      const report = {
        file: relativeFile,
        issues: [],
        commands: []
      };

      let source = '';
      let canLoad = true;

      try {
        const stat = fs.statSync(file);
        if (stat.size > MAX_FILE_SIZE) {
          report.issues.push('حجم الملف أكبر من 5 MB');
          canLoad = false;
        } else {
          source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
        }
      } catch (error) {
        report.issues.push(`تعذر قراءة الملف: ${cleanError(error, file)}`);
        canLoad = false;
      }

      const staticCommands = source ? getStaticCommands(source) : [];
      report.commands = staticCommands;

      if (source && !/\bexport\s+default\b/.test(source)) {
        report.issues.push('مفيش export default');
      }

      if (source) {
        const declarations = source.match(/^\s*(?:const|let|var)\s+handler\b/gm) || [];
        if (declarations.length > 1) {
          report.issues.push('فيه تعريفات مكررة لـ handler');
        }
      }

      let syntaxPassed = false;
      if (source) {
        syntaxChecked++;
        const syntaxError = await syntaxCheck(file);

        if (syntaxError) {
          syntaxFailed++;
          report.issues.push(`خطأ صياغة: ${syntaxError}`);
          canLoad = false;
        } else {
          syntaxOk++;
          syntaxPassed = true;
        }
      }

      let loadedHandler = null;
      let exportInfo = null;

      if (canLoad && syntaxPassed) {
        try {
          const loadedModule = await import(pathToFileURL(file).href);
          exportInfo = getExportInfo(loadedModule);

          if (!exportInfo.ok) {
            loadFailed++;
            report.issues.push(`فشل تجربة التحميل: ${exportInfo.error}`);
          } else {
            loadOk++;
            loadedHandler = exportInfo.handler;

            if (exportInfo.legacy) {
              report.issues.push('شكل التصدير قديم؛Framework متوقع export default handler مباشرة');
            }

            const hookOnly = isHookOnly(loadedHandler, exportInfo);

            if (hookOnly) {
              report.commands = [];
            } else {
              const commandDeclaration = loadedHandler.command;

              if (commandDeclaration === undefined) {
                report.issues.push('مفيش handler.command وقت التشغيل');
              } else {
                if (!validCommandDeclaration(commandDeclaration)) {
                  report.issues.push('handler.command لازم يكون RegExp أو Array نصوص أو String');
                }

                report.commands = getCommands(commandDeclaration);
                if (!report.commands.length && !(commandDeclaration instanceof RegExp)) {
                  report.commands = staticCommands;
                }
              }

              const category = typeof loadedHandler.category === 'string'
                ? loadedHandler.category.trim()
                : '';

              if (!category) report.issues.push('مفيش handler.category وقت التشغيل');
              else if (!VALID_CATEGORIES.has(category)) {
                report.issues.push(`category غير معروف: ${category}`);
              }
            }

            const skipReason = shouldSkipInvocation(
              relativeFile,
              loadedHandler,
              report.commands,
              exportInfo
            );

            if (skipReason) {
              runSkipped++;
            } else {
              const runResult = await safeInvoke(loadedHandler, bot);
              if (runResult.ok) {
                runOk++;
              } else {
                runFailed++;
                report.issues.push(`فشل تشغيل handler في التجربة الآمنة: ${runResult.error}`);
              }
            }
          }
        } catch (error) {
          loadFailed++;
          report.issues.push(`فشل تحميل البلاجن: ${cleanError(error, file)}`);
        }
      } else {
        loadSkipped++;
      }

      for (const command of report.commands) {
        const normalized = normalizeCommand(command);
        if (!normalized) continue;

        if (!commandOwners.has(normalized)) commandOwners.set(normalized, []);
        const owners = commandOwners.get(normalized);
        if (!owners.includes(relativeFile)) owners.push(relativeFile);
      }

      reports.push(report);
    }

    const duplicateCommands = [...commandOwners.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([command, owners]) => `• ${command}: ${owners.join(' + ')}`);

    const issueReports = reports.filter((report) => report.issues.length);
    const cleanCount = reports.length - issueReports.length;

    const summary = [
      '🧪 *نتيجة الفحص والتجربة مع بعض*',
      `📁 ${pluginDir}`,
      '━━━━━━━━━━━━━━━━',
      `📂 إجمالي البلاجينز: ${files.length}`,
      `✅ سليمة تماماً: ${cleanCount}`,
      `⚠️ محتاجة مراجعة: ${issueReports.length}`,
      '',
      '🔤 *فحص الصياغة:*',
      `✅ نجح: ${syntaxOk}/${syntaxChecked}`,
      `❌ فشل: ${syntaxFailed}`,
      `⏭️ لم يُفحص: ${files.length - syntaxChecked}`,
      '',
      '📦 *تجربة تحميل ESM والـ handler:*',
      `✅ نجح: ${loadOk}`,
      `❌ فشل: ${loadFailed}`,
      `⏭️ متخطى بسبب القراءة/الصياغة: ${loadSkipped}`,
      '',
      '⚙️ *التشغيل الآمن للـ handler:*',
      `✅ نجح: ${runOk}`,
      `❌ فشل: ${runFailed}`,
      `⏭️ متخطى للحماية: ${runSkipped}`,
      '',
      `🔁 تعارضات أوامر ظاهرة: ${duplicateCommands.length}`
    ];

    const details = [];
    for (const report of issueReports.slice(0, MAX_DETAILS)) {
      details.push(`🔴 ${report.file}`);
      details.push(...report.issues.map((issue) => `   • ${issue}`));
    }

    if (issueReports.length > MAX_DETAILS) {
      details.push(`… و${issueReports.length - MAX_DETAILS} ملف آخر.`);
    }

    if (duplicateCommands.length) {
      details.push('', '⚠️ *تعارضات الأوامر:*');
      details.push(...duplicateCommands.slice(0, MAX_CONFLICTS));
    }

    if (duplicateCommands.length > MAX_CONFLICTS) {
      details.push(`… و${duplicateCommands.length - MAX_CONFLICTS} تعارض آخر.`);
    }

    await m.reply(summary.join('\n'));

    if (details.length) {
      for (const chunk of splitChunks(details)) await m.reply(chunk);
    }

    await m.reply(
      `✅ خلصنا: ${syntaxOk} ملف عدّى الصياغة، ${loadOk} بلاجن اتحمّل، و${runOk} handler اشتغل بالتجربة الآمنة.`
    );
  } catch (error) {
    console.error('[افحصهم]', error);
    return m.reply(`❌ فشل الفحص والتجربة: ${cleanError(error, SELF_FILE)}`);
  }
};

handler.command = ['افحصهم', 'افحص_البلاجنز', 'فحص_البلاجنات'];
handler.usage = ['افحصهم'];
handler.category = 'owner';
handler.owner = true;
handler.usePrefix = true;

export default handler;
