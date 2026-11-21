import * as baileys from '@whiskeysockets/baileys';
import { basename } from 'node:path';

const LEGACY_DB = Symbol('lightbot.legacyDb');
const SOCKET_HELPERS = Symbol('lightbot.socketHelpers');
const MEDIA_COMMAND_LISTENER = Symbol('lightbot.mediaCommandListener');
const LEGACY_DB_CACHE = new WeakMap();
const LEGACY_REGISTRY_TTL_MS = 5 * 60 * 1000;
const LEGACY_REGISTRY_MAX_COMMANDS = 10_000;
const LEGACY_REGISTRY_MAX_PER_FILE = 2_000;

const CATEGORY_MAP = new Map(Object.entries({
  owner: 'owner',
  advanced: 'owner',
  rpg: 'games',
  game: 'games',
  games: 'games',
  fun: 'games',
  permainan: 'games',
  tools: 'tools',
  tool: 'tools',
  main: 'info',
  info: 'info',
  downloader: 'downloads',
  download: 'downloads',
  downloads: 'downloads',
  group: 'group',
  admin: 'admin',
  search: 'search',
  internet: 'search',
  buscador: 'search',
  sticker: 'sticker',
  database: 'bank',
  xp: 'bank',
  store: 'bank',
  ai: 'ai',
  adult: 'tools',
  canvas: 'tools',
  maker: 'tools',
  uploader: 'tools',
  'n our': 'tools',
  native: 'native',
  support: 'support',
  voice: 'voices',
  voices: 'voices',
  logo: 'logos',
  logos: 'logos',
  islamic: 'islamic',
  nickname: 'nicknames',
  nicknames: 'nicknames',
  subbot: 'sub',
  sub: 'sub'
}));

const HOOK_MODULES = [
  ['afk', '../extensions/imported-plugins/_afk.js', 'before'],
  ['antispam', '../extensions/imported-plugins/_antispam.js', 'before'],
  ['durability', '../extensions/imported-plugins/_durability.js', 'default'],
  ['premium', '../extensions/imported-plugins/_premium.js', 'default'],
  ['role', '../extensions/imported-plugins/_role.js', 'default']
];

let hookPromise = null;
let pluginRegistryAt = 0;
let pluginRegistry = {};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function commandNames(command) {
  if (command instanceof RegExp) return [command.source];
  return asArray(command).map((value) => String(value)).filter(Boolean);
}

function isCatchAllRegex(value) {
  if (!(value instanceof RegExp)) return false;
  if (value.source === '(?:)' || value.source === '' || value.source === '.*' || value.source === '.+') return true;
  try {
    return value.test('') && value.test('menu2') && value.test('__lightbot_unmatched_probe__');
  } catch {
    return false;
  }
}

function extractCustomPrefixCommands(customPrefix) {
  if (!(customPrefix instanceof RegExp)) return [];
  const src = String(customPrefix.source || '');
  const groupMatch = src.match(/^\^?\(([^)]+)\)\$?$/);
  if (groupMatch) {
    return groupMatch[1]
      .split('|')
      .map((part) => part.replace(/\\(.)/g, '$1').trim())
      .filter((part) => /^[\p{L}\p{N}_-]+$/u.test(part));
  }
  return [];
}

function deriveImportedCommand(metadataSource) {
  const raw = metadataSource?.command;
  if (!isCatchAllRegex(raw)) return raw;
  const fromUsage = asArray(metadataSource?.usage)
    .map((item) => String(item || '').trim().split(/\s+/)[0])
    .filter(Boolean);
  const fromPrefix = extractCustomPrefixCommands(metadataSource?.customPrefix);
  const merged = [...new Set([...fromUsage, ...fromPrefix])];
  return merged.length ? merged : /(?!)/;
}

function deriveUsage(source, command) {
  const usage = source?.usage ?? source?.help;
  if (Array.isArray(usage) && usage.length) return usage.map(String);
  if (typeof usage === 'string' && usage.trim()) return [usage];
  const names = commandNames(command);
  return names.length ? [names[0]] : [];
}

function mapCategory(source, fileName = '') {
  const tags = asArray(source?.category ?? source?.tags);
  for (const tag of tags) {
    const key = String(tag || '').trim().toLowerCase();
    const mapped = CATEGORY_MAP.get(key);
    if (mapped) return mapped;
  }
  const name = String(fileName || '').toLowerCase();
  if (name.includes('owner')) return 'owner';
  if (name.includes('group') || name.includes('admin')) return 'group';
  if (name.includes('down')) return 'downloads';
  if (name.includes('search') || name.includes('google')) return 'search';
  if (name.includes('sticker')) return 'sticker';
  if (name.includes('ai')) return 'ai';
  if (name.includes('game') || name.includes('rpg') || name.includes('fun')) return 'games';
  return 'tools';
}

function copyFlag(target, source, key) {
  if (source?.[key] === true) target[key] = true;
  else if (source?.[key] === false && key === 'usePrefix') target[key] = false;
}

function getLegacyDb(database = global.db) {
  if (!database || typeof database !== 'object') return database;
  if (database[LEGACY_DB]) return database;
  const cached = LEGACY_DB_CACHE.get(database);
  if (cached) return cached;

  const legacyData = new Proxy(database.data || {}, {
    get(target, property, receiver) {
      if (property === 'users') return database.users;
      if (property === 'chats') return database.groups;
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(database) : value;
    },
    set(target, property, value, receiver) {
      if (property === 'users') {
        for (const [key, item] of Object.entries(value || {})) database.users[key] = item;
        return true;
      }
      if (property === 'chats') {
        for (const [key, item] of Object.entries(value || {})) database.groups[key] = item;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });

  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === LEGACY_DB) return true;
      if (property === 'data') return legacyData;
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  proxy[LEGACY_DB] = true;
  LEGACY_DB_CACHE.set(database, proxy);
  return proxy;
}

function ensureUser(m) {
  const id = String(m?.sender || m?.chat || '').trim();
  if (!id) return null;
  const database = global.db;
  if (!database?.users) return null;
  let user = database.users[id];
  if (!user) {
    user = {};
    database.users[id] = user;
  }
  const defaults = {
    name: m?.pushName || m?.verifiedName || id.split('@')[0],
    registered: false,
    level: 0,
    exp: 0,
    money: 0,
    limit: 10,
    age: 0,
    premium: false,
    premiumTime: 0,
    afk: -1,
    afkReason: '',
    autolevelup: false
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (user[key] === undefined) user[key] = value;
  }
  return user;
}

async function resizeMedia(input, width = 200, height = 200) {
  const { default: sharp } = await import('sharp');
  let data = input;
  if (typeof data === 'string') {
    const response = await fetch(data);
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
  }
  return sharp(data).resize(width, height, { fit: 'cover' }).toBuffer();
}

function extensionOf(value = '') {
  const clean = String(value).split('?')[0];
  const ext = clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin';
}

async function fileToBuffer(file) {
  if (Buffer.isBuffer(file)) return file;
  if (file instanceof Uint8Array) return Buffer.from(file);
  if (typeof file === 'string' && /^https?:\/\//i.test(file)) {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  if (typeof file === 'string') {
    const { readFile } = await import('node:fs/promises');
    return readFile(file);
  }
  throw new TypeError('unsupported file payload');
}

function quotedOption(quoted) {
  if (!quoted) return undefined;
  if (quoted.raw?.key && quoted.raw?.message) return { quoted: quoted.raw };
  if (typeof quoted.fakeObj === 'function') {
    try {
      const raw = quoted.fakeObj();
      if (raw?.key && raw?.message) return { quoted: raw };
    } catch {}
  }
  if (quoted.fakeObj?.key && quoted.fakeObj?.message) return { quoted: quoted.fakeObj };
  if (quoted.key && quoted.message) return { quoted };
  return { quoted };
}

function hashCandidates(hash) {
  const candidates = new Set();
  if (Buffer.isBuffer(hash) || hash instanceof Uint8Array) {
    const buffer = Buffer.from(hash);
    candidates.add(buffer.toString());
    candidates.add(buffer.toString('base64'));
    candidates.add(buffer.toString('hex'));
    return [...candidates];
  }
  if (typeof hash !== 'string' || !hash.trim()) return [];
  const value = hash.trim();
  candidates.add(value);
  candidates.add(Buffer.from(value).toString('base64'));
  try {
    candidates.add(Buffer.from(value, 'base64').toString('base64'));
  } catch {}
  return [...candidates];
}

function findStoredMediaCommand(store, hash) {
  if (!store || typeof store !== 'object') return null;
  for (const candidate of hashCandidates(hash)) {
    const entry = store[candidate];
    if (entry && typeof entry === 'object' && entry.text) return entry;
  }
  return null;
}

function enrichLegacyQuotedMessage(m) {
  const quoted = m?.quoted;
  if (!quoted || typeof quoted !== 'object') return;

  const content = quoted.message;
  const type = quoted.mtype;
  if (!quoted.msg) {
    if (type && content && typeof content === 'object') quoted.msg = { [type]: content };
    else if (content && typeof content === 'object') quoted.msg = content;
  }

  const media = type && content && typeof content === 'object'
    ? content
    : quoted.msg?.stickerMessage || quoted.msg?.imageMessage || quoted.msg?.videoMessage || quoted.msg?.documentMessage || quoted.msg?.audioMessage;
  if (media && typeof media === 'object') {
    for (const key of ['fileSha256', 'fileEncSha256', 'mediaKey', 'directPath', 'mimetype']) {
      if (quoted[key] === undefined && media[key] !== undefined) quoted[key] = media[key];
    }
  }

  if (typeof quoted.fakeObj === 'function') {
    try {
      const raw = quoted.fakeObj();
      if (raw?.key && raw?.message) {
        if (!quoted.fakeObj.key) quoted.fakeObj.key = raw.key;
        if (!quoted.fakeObj.message) quoted.fakeObj.message = raw.message;
      }
    } catch {}
  }
}

function configuredPrefixes(bot) {
  const prefix = bot?.config?.prefix ?? global.config?.prefix ?? '.';
  const values = Array.isArray(prefix) ? prefix : [prefix];
  return values.map((value) => String(value || '')).filter(Boolean);
}

function mediaContentFrom(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'object') return null;
  let type = baileys.getContentType(rawMessage);
  let content = type ? rawMessage[type] : null;
  if (type && /^viewOnceMessage/.test(type) && content?.message) {
    type = baileys.getContentType(content.message);
    content = type ? content.message[type] : null;
  }
  if (!content || typeof content !== 'object') return null;
  return { type, content };
}

async function emitStoredMediaCommand(socket, rawMessage, bot) {
  const media = mediaContentFrom(rawMessage?.message);
  const hash = media?.content?.fileSha256;
  if (!hash) return false;

  const entry = findStoredMediaCommand(global.db?.data?.sticker, hash);
  if (!entry?.text) return false;

  const chat = rawMessage?.key?.remoteJid || '';
  if (!chat) return false;
  const sender = rawMessage?.key?.participantAlt || rawMessage?.key?.participant || (rawMessage?.key?.fromMe ? socket.user?.id : chat);
  if (!sender) return false;

  const prefixes = configuredPrefixes(bot);
  const prefix = prefixes[0] || '.';
  let text = String(entry.text || '').trim();
  if (!text) return false;
  if (!prefixes.some((item) => text.startsWith(item))) text = `${prefix}${text}`;

  const mentions = Array.isArray(entry.mentionedJid)
    ? entry.mentionedJid
    : entry.mentionedJid ? [entry.mentionedJid] : [];
  const generated = await baileys.generateWAMessage(
    sender,
    { text, mentions },
    { userJid: socket.user?.id, quoted: rawMessage }
  );
  generated.key = generated.key || {};
  generated.key.remoteJid = chat;
  generated.key.fromMe = baileys.areJidsSameUser(chat, socket.user?.id);
  if (chat.endsWith('@g.us')) generated.key.participant = sender;
  generated.pushName = rawMessage.pushName;

  socket.ev.emit('messages.upsert', {
    messages: [baileys.proto.WebMessageInfo.create(generated)],
    type: 'append'
  });
  return true;
}

export function installImportedMediaListener(socket, bot = null) {
  if (!socket?.ev?.on || socket[MEDIA_COMMAND_LISTENER]) return false;
  socket[MEDIA_COMMAND_LISTENER] = true;
  const seen = new Set();

  socket.ev.on('messages.upsert', async (update) => {
    const messages = Array.isArray(update?.messages) ? update.messages : [];
    for (const rawMessage of messages) {
      const keyId = rawMessage?.key?.id || '';
      const media = mediaContentFrom(rawMessage?.message);
      const hash = media?.content?.fileSha256;
      if (!hash) continue;
      const identity = `${rawMessage?.key?.remoteJid || ''}:${keyId}:${hashCandidates(hash)[0] || ''}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      if (seen.size > 500) seen.delete(seen.values().next().value);
      try {
        await emitStoredMediaCommand(socket, rawMessage, bot);
      } catch (error) {
        console.error('[imported-hook:cmd-with-media]', error?.message || error);
      }
    }
  });
  return true;
}

function parseButtonParams(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeImportedButtons(buttons) {
  if (!Array.isArray(buttons)) return [];
  const normalized = [];
  for (const button of buttons) {
    if (!button || typeof button !== 'object') continue;
    if (button.name && button.params && typeof button.params === 'object') {
      normalized.push({ name: button.name, params: button.params });
      continue;
    }
    if (button.name && button.buttonParamsJson !== undefined) {
      normalized.push({ name: button.name, params: parseButtonParams(button.buttonParamsJson) });
      continue;
    }
    const id = button.buttonId || button.id || button.cmd;
    if (!id) continue;
    const text = button.buttonText?.displayText || button.display_text || button.displayText || button.label || button.text || id;
    normalized.push({
      name: 'quick_reply',
      params: {
        display_text: String(text || id).slice(0, 40),
        id: String(id)
      }
    });
  }
  return normalized;
}

function normalizeImportedNativeFlow(flow) {
  if (!Array.isArray(flow)) return [];
  const normalized = [];
  for (const item of flow) {
    if (!item || typeof item !== 'object') continue;
    if (item.name) {
      normalized.push({
        name: item.name,
        params: item.params && typeof item.params === 'object'
          ? item.params
          : parseButtonParams(item.buttonParamsJson)
      });
      continue;
    }
    if (item.url) {
      normalized.push({
        name: 'cta_url',
        params: {
          display_text: String(item.text || item.title || 'Open'),
          url: item.url
        }
      });
      continue;
    }
    if (Array.isArray(item.sections)) {
      const title = String(item.text || item.title || 'Menu');
      normalized.push({
        name: 'single_select',
        params: {
          display_text: title,
          title,
          sections: item.sections
        }
      });
    }
  }
  return normalized;
}

async function sendImportedButtons(socket, jid, payload = {}, quoted = null, options = {}) {
  const buttons = [
    ...normalizeImportedButtons(payload.buttons),
    ...normalizeImportedNativeFlow(payload.nativeFlow)
  ];
  const text = String(payload.text || payload.caption || payload.body || '');
  const sendOptions = {
    ...(quotedOption(quoted) || {}),
    ...(options || {})
  };
  const media = payload.media ?? payload.image ?? payload.video ?? payload.document;

  if (media) {
    const mediaPayload = {};
    if (payload.mediaType === 'video' || payload.video) mediaPayload.video = media;
    else if (payload.mediaType === 'document' || payload.document) mediaPayload.document = media;
    else mediaPayload.image = media;
    if (text && mediaPayload.document) mediaPayload.caption = text;
    await socket.sendMessage(jid, mediaPayload, sendOptions);
    if (!buttons.length) return;
  }

  const mentions = payload.mentions || [];
  const contextInfo = {
    ...(payload.contextInfo || {}),
    ...(mentions.length && !payload.contextInfo?.mentionedJid ? { mentionedJid: mentions } : {})
  };
  return socket.sendMessage(jid, {
    text,
    footer: payload.footer || payload.footerText || '',
    title: payload.title || '',
    buttons,
    mentions,
    contextInfo
  }, sendOptions);
}

function installSocketHelpers(socket) {
  if (!socket || typeof socket.sendMessage !== 'function') return socket;
  if (socket[SOCKET_HELPERS]) return socket;

  if (!socket.reply) {
    socket.reply = async (jid, content, quoted, options = {}) => {
      const text = typeof content === 'string' ? content : content?.text || content?.caption || '';
      return socket.sendMessage(jid, { ...(options || {}), text }, {
        ...(quotedOption(quoted) || {}),
        ...(options?.quoted ? { quoted: options.quoted } : {})
      });
    };
  }

  if (!socket.adReply) {
    socket.adReply = async (jid, content, media, quoted, options = {}) => {
      const text = typeof content === 'string' ? content : content?.text || content?.caption || '';
      const { title, body, source, ...messageOptions } = options || {};
      const payload = { ...messageOptions, text, caption: text };
      if (title || body || source) {
        payload.contextInfo = {
          ...(payload.contextInfo || {}),
          externalAdReply: { title, body, source }
        };
      }
      if (media) {
        try {
          if (Buffer.isBuffer(media) || media instanceof Uint8Array) {
            payload.image = Buffer.from(media);
          } else if (typeof media === 'string' && /^https?:\/\//i.test(media)) {
            payload.image = { url: media };
          } else if (typeof media === 'string') {
            payload.image = await fileToBuffer(media);
          } else if (media?.url) {
            payload.image = { url: media.url };
          } else if (media?.buffer || media?.data) {
            payload.image = Buffer.from(media.buffer || media.data);
          }
        } catch {
          // A missing legacy thumbnail must not prevent the text response.
        }
      }
      return socket.sendMessage(jid, payload, quotedOption(quoted) || {});
    };
  }

  if (!socket.sendFile) {
    socket.sendFile = async (jid, file, filename = '', caption = '', quoted = null, options = {}) => {
      const data = await fileToBuffer(file);
      const name = String(filename || `file-${Date.now()}.${extensionOf(file?.name || file)}`);
      const ext = extensionOf(name);
      const payload = { ...(options || {}), caption: caption || undefined };
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) payload.image = data;
      else if (['mp4', 'mkv', 'webm', 'mov'].includes(ext)) payload.video = data;
      else if (['mp3', 'ogg', 'm4a', 'opus'].includes(ext)) payload.audio = data;
      else {
        payload.document = { buffer: data, mimetype: options?.mimetype || 'application/octet-stream', fileName: name };
      }
      if (!payload.text && caption) payload.text = caption;
      return socket.sendMessage(jid, payload, quotedOption(quoted) || {});
    };
  }

  if (!socket.sendAlbumMessage) {
    socket.sendAlbumMessage = async (jid, media, options = {}) => {
      for (const item of media || []) {
        const candidate = item?.image || item?.video || item;
        if (!candidate) continue;
        if (Buffer.isBuffer(candidate) || candidate instanceof Uint8Array) {
          await socket.sendMessage(jid, { image: Buffer.from(candidate) }, options);
          continue;
        }
        if (typeof candidate === 'string') {
          const isVideo = /\.(?:mp4|mkv|webm|mov)(?:$|\?)/i.test(candidate);
          await socket.sendMessage(jid, isVideo ? { video: { url: candidate } } : { image: { url: candidate } }, options);
          continue;
        }
        if (candidate?.url) {
          const isVideo = Boolean(item?.video) || /\.(?:mp4|mkv|webm|mov)(?:$|\?)/i.test(candidate.url);
          await socket.sendMessage(jid, isVideo ? { video: { url: candidate.url } } : { image: { url: candidate.url } }, options);
        }
      }
    };
  }

  if (!socket.sendButtonNormal) {
    socket.sendButtonNormal = (jid, payload = {}, quoted = null, options = {}) =>
      sendImportedButtons(socket, jid, payload, quoted, options);
  }
  if (!socket.sendButton) {
    socket.sendButton = (jid, payload = {}, quoted = null, options = {}) =>
      socket.sendButtonNormal(jid, payload, quoted, options);
  }

  if (!socket.resize) socket.resize = resizeMedia;

  if (!socket.getFile) {
    socket.getFile = async (input) => {
      if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
        const data = await fileToBuffer(input);
        return { data, ext: extensionOf(input) };
      }
      if (input?.message || input?.key) {
        const type = input.message?.imageMessage ? 'image' : input.message?.videoMessage ? 'video' : input.message?.audioMessage ? 'audio' : 'buffer';
        const data = await baileys.downloadMediaMessage(input, type, {}, { logger: console, reuploadRequest: socket.updateMediaMessage });
        return { data, ext: type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'ogg' : 'bin' };
      }
      const data = await fileToBuffer(input);
      return { data, ext: extensionOf(input?.name || input) };
    };
  }

  if (!socket.getName) {
    socket.getName = async (jid) => {
      const id = String(jid || '').split('@')[0].split(':')[0];
      return id || 'User';
    };
  }

  if (!socket.participantsUpdate && socket.groupParticipantsUpdate) {
    socket.participantsUpdate = socket.groupParticipantsUpdate.bind(socket);
  }

  if (socket.user && !socket.user.jid) {
    try { Object.defineProperty(socket.user, 'jid', { value: socket.user.id, configurable: true }); } catch {}
  }
  socket[SOCKET_HELPERS] = true;
  return socket;
}

function legacyPluginShape(command) {
  const names = commandNames(command?.command);
  const category = command?.category || 'tools';
  const usage = asArray(command?.usage).length ? asArray(command.usage) : names;
  return {
    ...command,
    help: usage,
    tags: Array.isArray(category) ? category : [category],
    disabled: command?.disabled === true
  };
}

function pluginRegistryStem(command, index) {
  const sourceFile = command?.__filePath || command?.file || '';
  const raw = sourceFile
    ? basename(sourceFile).replace(/\.js$/i, '')
    : command?.name || commandNames(command?.command)[0] || `plugin-${index + 1}`;
  const cleaned = String(raw).replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^_+|_+$/g, '');
  return (cleaned || `plugin-${index + 1}`).slice(0, 120);
}

function mergeLegacyPluginShape(group, shape) {
  if (!group) {
    group = {
      ...shape,
      command: new Set(),
      usage: new Set(),
      tags: new Set(),
      aliases: new Set(),
      _total: 0,
      _disabled: 0
    };
  }
  for (const name of commandNames(shape.command)) group.command.add(name);
  for (const usage of asArray(shape.usage)) group.usage.add(String(usage));
  for (const tag of asArray(shape.tags)) group.tags.add(String(tag));
  for (const alias of asArray(shape.aliases)) group.aliases.add(String(alias));
  group.execute ||= shape.execute;
  group.name ||= shape.name;
  group.description ||= shape.description;
  group.__filePath ||= shape.__filePath;
  group.file ||= shape.file;
  group.category ||= shape.category;
  group.owner = group.owner === true || shape.owner === true;
  group.group = group.group === true || shape.group === true;
  group.private = group.private === true || shape.private === true;
  group.botAdmin = group.botAdmin === true || shape.botAdmin === true;
  group.admin = group.admin === true || shape.admin === true;
  group.limit = group.limit === true || shape.limit === true;
  group.premium = group.premium === true || shape.premium === true;
  group.noSub = group.noSub === true || shape.noSub === true;
  group.hidden = group.hidden === true || shape.hidden === true;
  if (shape.usePrefix === false) group.usePrefix = false;
  if (typeof shape.cooldown === 'number' && Number.isFinite(shape.cooldown)) {
    group.cooldown = typeof group.cooldown === 'number'
      ? Math.min(group.cooldown, shape.cooldown)
      : shape.cooldown;
  }
  group._total += 1;
  group._disabled += shape.disabled === true ? 1 : 0;
  return group;
}

function finalizeLegacyPluginShape(group) {
  const usage = [...group.usage];
  const result = {
    ...group,
    command: [...group.command],
    usage,
    help: usage,
    tags: [...group.tags],
    aliases: [...group.aliases]
  };
  result.disabled = result._disabled === result._total;
  delete result._total;
  delete result._disabled;
  return result;
}

export async function refreshPluginRegistry(bot) {
  const now = Date.now();
  if (now - pluginRegistryAt < LEGACY_REGISTRY_TTL_MS && Object.keys(pluginRegistry).length) return pluginRegistry;
  let commands = [];
  try {
    commands = (await bot?.getAllCommands?.()) || bot?.commandSystem?.registry?.getAll?.() || [];
  } catch {}
  const next = {};
  const groupKeys = new Map();
  const usedKeys = new Set();
  let accepted = 0;
  for (const [index, command] of commands.entries()) {
    if (accepted >= LEGACY_REGISTRY_MAX_COMMANDS) break;
    const sourceFile = command?.__filePath || command?.file || '';
    // The target contains generated mega packs with >100k commands. Copying
    // those into the legacy Yono registry makes every incoming message very
    // slow and can exhaust the process heap, so they are intentionally omitted.
    if (/(^|[\\/])plugins[\\/]packs[\\/]/i.test(sourceFile)) continue;
    const shape = legacyPluginShape(command);
    const identity = sourceFile || `command:${pluginRegistryStem(command, index)}`;
    let key = groupKeys.get(identity);
    if (!key) {
      const stem = pluginRegistryStem(command, index);
      key = `${stem}.js`;
      let suffix = 2;
      while (usedKeys.has(key)) key = `${stem}#${suffix++}.js`;
      usedKeys.add(key);
      groupKeys.set(identity, key);
    }
    const group = next[key];
    if (group && group._total >= LEGACY_REGISTRY_MAX_PER_FILE) continue;
    next[key] = mergeLegacyPluginShape(group, shape);
    next[key].filename = key;
    accepted += 1;
  }
  const finalized = {};
  for (const [key, group] of Object.entries(next)) {
    finalized[key] = finalizeLegacyPluginShape(group);
  }
  pluginRegistry = finalized;
  pluginRegistryAt = now;
  global.plugins = pluginRegistry;
  return pluginRegistry;
}

function buildLegacyGlobals(bot, conn) {
  const config = bot?.config || global.config || {};
  const info = config.info || {};
  const images = Array.isArray(info.images) ? info.images : [];
  const image = images[0] || info.supaimg?.[0] || '';
  const owners = asArray(config.owners);

  global.conn = conn;
  global.baileys = baileys;
  global.config = config;
  global.opts = {
    ...(global.opts || {}),
    self: false,
    restrict: true,
    multi_owner: false,
    owner: owners.map((owner) => owner?.jid || owner).filter(Boolean)
  };
  global.settings = {
    ...(global.settings || {}),
    ...(config.settings || {}),
    botname: info.nameBot || global.settings?.botname || 'LightBot',
    owner: owners.map((owner) => [owner?.jid || owner, owner?.name || 'Owner', true])
  };
  global.img = {
    ...(global.img || {}),
    bot: image,
    sender: image,
    profile: {
      ...(global.img?.profile || {}),
      bot: global.img?.profile?.bot || image,
      sender: global.img?.profile?.sender || image
    }
  };
  global.multiplier = Number(global.multiplier || 1);
}

export function createLegacyContext(m, ctx = {}, bot = null) {
  const conn = ctx.conn || bot?.sock || global.conn || null;
  const database = getLegacyDb(global.db);
  const prefix = ctx.prefix || ctx.usedPrefix || m?.usedPrefix || '.';
  const command = ctx.command || m?.command || String(m?.text || '').replace(/^\S+\s*/, '').trim();
  const rawBody = typeof m?.body === 'string' ? m.body.trim() : '';
  const derivedNoPrefix = ctx.noPrefix !== undefined
    ? String(ctx.noPrefix)
    : (rawBody && prefix && rawBody.startsWith(prefix)
      ? rawBody.slice(prefix.length).trim()
      : String(ctx.text ?? m?.text ?? rawBody));
  const args = Array.isArray(ctx.args)
    ? ctx.args
    : Array.isArray(m?.args)
      ? m.args
      : String(ctx.text || m?.text || '').trim().split(/\s+/).filter(Boolean);
  const legacy = {
    ...ctx,
    conn,
    satanic: conn,
    bot: bot || ctx.bot || null,
    chat: m?.chat || ctx.chat || '',
    sender: m?.sender || ctx.sender || '',
    text: ctx.text ?? m?.text ?? '',
    noPrefix: derivedNoPrefix,
    args,
    command,
    usedPrefix: ctx.usedPrefix || prefix,
    prefix,
    db: database,
    isCreator: Boolean(ctx.isOwner),
    isPrems: Boolean(ctx.isPremium || ctx.isPrems),
    isOwner: Boolean(ctx.isOwner),
    isAdmin: Boolean(ctx.isAdmin),
    isBotAdmin: Boolean(ctx.isBotAdmin),
    participants: ctx.participants || [],
    groupMetadata: ctx.groupMetadata || null,
    settings: global.settings || ctx.settings || {},
    config: global.config || ctx.config || bot?.config || {}
  };
  if (ctx && typeof ctx === 'object') {
    for (const [key, value] of Object.entries(legacy)) {
      if (ctx[key] === undefined || key === 'satanic' || key === 'isCreator' || key === 'isPrems' || key === 'prefix' || key === 'db' || key === 'noPrefix') {
        try { ctx[key] = value; } catch {}
      }
    }
  }
  return legacy;
}

export async function installImportedRuntime({ m, ctx = {}, bot = null, refreshRegistry = false } = {}) {
  const conn = ctx.conn || bot?.sock || global.conn || null;
  if (conn) {
    installSocketHelpers(conn);
    if (conn.user && !conn.user.jid) {
      try { Object.defineProperty(conn.user, 'jid', { value: conn.user.id, configurable: true }); } catch {}
    }
  }
  if (global.db) {
    const legacyDb = getLegacyDb(global.db);
    if (global.db !== legacyDb) global.db = legacyDb;
    global.db.data.sticker ||= {};
    global.db.data.stats ||= {};
    global.db.data.settings ||= {};
  }
  buildLegacyGlobals(bot || ctx.bot, conn);
  if (refreshRegistry) await refreshPluginRegistry(bot || ctx.bot);
  ensureUser(m);
  enrichLegacyQuotedMessage(m);
  installImportedMediaListener(conn, bot || ctx.bot);
  createLegacyContext(m, ctx, bot || ctx.bot);
  return { conn, db: global.db };
}

export function adaptImportedPlugin(source, options = {}) {
  if (!source) throw new Error(`Imported plugin has no default export: ${options.fileName || 'unknown'}`);
  const execute = typeof source === 'function' ? source : source.execute;
  if (typeof execute !== 'function') throw new Error(`Imported plugin has no executable handler: ${options.fileName || 'unknown'}`);
  const metadataSource = typeof source === 'function' ? source : source;
  const rawCommand = metadataSource.command;
  if (!rawCommand) throw new Error(`Imported plugin has no command metadata: ${options.fileName || 'unknown'}`);
  const command = deriveImportedCommand(metadataSource);
  const handler = {
    execute: async (m, ctx, bot) => {
      const runtime = await installImportedRuntime({ m, ctx, bot, refreshRegistry: true });
      const legacyCtx = createLegacyContext(m, ctx, bot);
      try {
        return await execute.call(runtime.conn, m, legacyCtx, bot);
      } catch (error) {
        console.error(`[imported:${options.fileName || 'unknown'}]`, error);
        throw error;
      }
    }
  };
  handler.command = command;
  handler.usage = deriveUsage(metadataSource, command);
  handler.category = mapCategory(metadataSource, options.fileName);
  if (typeof metadataSource.name === 'string' && metadataSource.name.trim()) handler.name = metadataSource.name;
  if (typeof metadataSource.description === 'string' && metadataSource.description.trim()) handler.description = metadataSource.description;
  if (Array.isArray(metadataSource.aliases)) {
    const aliases = metadataSource.aliases.map(String).map((value) => value.trim()).filter(Boolean);
    if (aliases.length) handler.aliases = aliases;
  }
  for (const key of ['owner', 'group', 'private', 'botAdmin', 'admin', 'premium', 'disabled', 'noSub', 'hidden']) {
    copyFlag(handler, metadataSource, key);
  }
  if (typeof metadataSource.cooldown === 'number' && Number.isFinite(metadataSource.cooldown)) {
    handler.cooldown = Math.max(0, metadataSource.cooldown);
  }
  if (metadataSource.usePrefix === false) handler.usePrefix = false;
  if (metadataSource.limit !== undefined) handler.limit = metadataSource.limit;
  if (typeof metadataSource.before === 'function') {
    handler.before = async (m, ctx, bot) => {
      const runtime = await installImportedRuntime({ m, ctx, bot, refreshRegistry: true });
      const legacyCtx = createLegacyContext(m, ctx, bot);
      const result = await metadataSource.before.call(runtime.conn, m, legacyCtx);
      return result === true;
    };
  }
  if (typeof metadataSource.after === 'function') {
    handler.after = async (m, ctx, bot) => {
      const runtime = await installImportedRuntime({ m, ctx, bot });
      const legacyCtx = createLegacyContext(m, ctx, bot);
      return metadataSource.after.call(runtime.conn, m, legacyCtx);
    };
  }
  return handler;
}

async function loadHooks() {
  if (!hookPromise) {
    hookPromise = Promise.all(HOOK_MODULES.map(async ([name, specifier, exportName]) => {
      try {
        const module = await import(specifier);
        const source = exportName === 'default' ? module.default : module[exportName];
        const hook = exportName === 'default' ? source?.before : source;
        return { name, hook: typeof hook === 'function' ? hook : null };
      } catch (error) {
        console.error(`[imported-hook:${name}]`, error?.message || error);
        return { name, hook: null };
      }
    }));
  }
  return hookPromise;
}

export async function runImportedBeforeHooks({ m, ctx = {}, bot = null } = {}) {
  const runtime = await installImportedRuntime({ m, ctx, bot });
  const legacyCtx = createLegacyContext(m, ctx, bot);
  for (const { name, hook } of await loadHooks()) {
    if (!hook) continue;
    try {
      await hook.call(runtime.conn, m, legacyCtx);
    } catch (error) {
      console.error(`[imported-hook:${name}]`, error?.message || error);
    }
  }
  return false;
}

export function getImportedPluginRegistry() {
  return pluginRegistry;
}
