/**
 * botRegistry.js — إدارة مركزية للبوت الرئيسي والفرعية وأكواد الربط المحفوظة
 * -------------------------------------------------------------------------
 * - حفظ أكواد التحكم الدائمة وأكواد الاقتران لكل بوت فرعي على القرص (0600) وفي global.db
 * - مزامنة إعدادات البوتات (عام/خاص، الاسم، البادئة، الرد التلقائي، الترحيب، الإيقاف المؤقت)
 * - توفير بيانات كاملة وآمنة للوحة الأدمن ولواجهة ربط المستخدم الافتراضية
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function storeFilePath() {
  return process.env.BOTS_STATE_FILE
    ? path.resolve(process.env.BOTS_STATE_FILE)
    : path.join(__dirname, 'bots-state.json');
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!/^\d{8,15}$/.test(digits)) return '';
  return digits;
}

export function generateControlCode() {
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) raw += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return `LB-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function normalizeCodeStr(val) {
  return String(val || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function timingSafeEqualStr(a, b) {
  const sa = normalizeCodeStr(a);
  const sb = normalizeCodeStr(b);
  if (!sa || !sb || sa.length !== sb.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
}

export const DEFAULT_SUB_SETTINGS = Object.freeze({
  mode: 'public',     // 'public' | 'private'
  customName: '',
  prefix: '.',
  welcome: true,
  autoReply: true,
  paused: false,
  notes: ''
});

export const DEFAULT_MAIN_SETTINGS = Object.freeze({
  nameBot: '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
  prefix: ['.', '/', '!'],
  fromMe: null,
  fromMeModeV2: true,
  autoRead: false,
  maintenance: false,
  noSub: false,
  allowPublicWebPair: true,
  welcomeEnabled: true,
  antiLink: false
});

export function normalizeFromMeValue(val) {
  if (val === 'both' || val === null || val === undefined || val === '') return null;
  if (val === 'others' || val === false || val === 'false') return false;
  if (val === 'self' || val === true || val === 'true') return true;
  return null;
}

export function fromMeToMode(val) {
  if (val === true || val === 'self') return 'self';
  if (val === false || val === 'others') return 'others';
  return 'both';
}

let memStore = null;
let lastStorePath = null;
const runtimeHooks = {
  onSubSettingsChange: null
};

export function registerBotRegistryHooks(hooks = {}) {
  if (typeof hooks.onSubSettingsChange === 'function') {
    runtimeHooks.onSubSettingsChange = hooks.onSubSettingsChange;
  }
}

function emptyStore() {
  return {
    subBots: {},
    mainBot: { ...DEFAULT_MAIN_SETTINGS }
  };
}

export function loadBotsStore() {
  const fp = storeFilePath();
  if (memStore && lastStorePath === fp) return memStore;
  lastStorePath = fp;
  let loaded = emptyStore();
  let needsMigrate = false;
  try {
    if (fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        const mergedMain = { ...DEFAULT_MAIN_SETTINGS, ...(parsed.mainBot || {}) };
        if (!parsed.mainBot?.fromMeModeV2 && parsed.mainBot?.fromMe === false) {
          mergedMain.fromMe = null;
          mergedMain.fromMeModeV2 = true;
          needsMigrate = true;
        } else {
          mergedMain.fromMe = normalizeFromMeValue(mergedMain.fromMe);
          mergedMain.fromMeModeV2 = true;
        }
        loaded = {
          subBots: parsed.subBots && typeof parsed.subBots === 'object' ? parsed.subBots : {},
          mainBot: mergedMain
        };
      }
    }
  } catch (e) {
    console.error('⚠️ [BOTS-STORE] تعذّر قراءة ملف حالة البوتات:', e?.message || e);
  }
  memStore = loaded;
  if (needsMigrate) saveBotsStore(loaded);
  return memStore;
}

export function saveBotsStore(store = memStore) {
  const fp = storeFilePath();
  const data = store || loadBotsStore();
  memStore = data;
  lastStorePath = fp;
  const dir = path.dirname(fp);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${fp}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    try { fs.chmodSync(tmp, 0o600); } catch {}
    fs.renameSync(tmp, fp);
  } catch (e) {
    console.error('⚠️ [BOTS-STORE] تعذّر حفظ ملف حالة البوتات:', e?.message || e);
  }
  syncToGlobalDb(data);
  return data;
}

export function resetStoreCacheForTests() {
  memStore = null;
  lastStorePath = null;
}

function syncToGlobalDb(store) {
  try {
    if (!global.db || typeof global.db !== 'object') return;
    const target = {};
    for (const [phone, rec] of Object.entries(store.subBots || {})) {
      target[phone] = {
        phone: rec.phone,
        uid: rec.uid || '',
        controlCode: rec.controlCode,
        lastPairCode: rec.lastPairCode || '',
        pairStatus: rec.pairStatus || 'idle',
        pairedAt: rec.pairedAt || 0,
        settings: { ...DEFAULT_SUB_SETTINGS, ...(rec.settings || {}) }
      };
    }
    global.db.subBotRecords = target;
    global.db.noSub = !!store.mainBot.noSub;
    global.db.maintenance = !!store.mainBot.maintenance;
  } catch {}
}

export function ensureSubBotRecord(phoneRaw, defaults = {}) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return null;
  const store = loadBotsStore();
  let rec = store.subBots[phone];
  let changed = false;
  if (!rec) {
    rec = {
      phone,
      uid: defaults.uid || '',
      controlCode: generateControlCode(),
      lastPairCode: defaults.lastPairCode || '',
      pairStatus: defaults.pairStatus || 'idle',
      pairError: null,
      createdAt: Date.now(),
      pairedAt: 0,
      lastSeenAt: 0,
      waName: defaults.waName || '',
      settings: { ...DEFAULT_SUB_SETTINGS, ...(defaults.settings || {}) }
    };
    store.subBots[phone] = rec;
    changed = true;
  } else {
    if (!rec.controlCode) {
      rec.controlCode = generateControlCode();
      changed = true;
    }
    if (!rec.settings || typeof rec.settings !== 'object') {
      rec.settings = { ...DEFAULT_SUB_SETTINGS };
      changed = true;
    }
    if (defaults.uid && rec.uid !== defaults.uid) {
      rec.uid = defaults.uid;
      changed = true;
    }
  }
  if (changed) saveBotsStore(store);
  return rec;
}

export function getSubBotSettings(phoneOrUid, subBots = global.subBots) {
  let phone = normalizePhone(phoneOrUid);
  if (!phone && subBots?.get) {
    const b = subBots.get(phoneOrUid);
    phone = normalizePhone(b?.phoneNumber);
  }
  const store = loadBotsStore();
  const rec = phone ? store.subBots[phone] : null;
  return { ...DEFAULT_SUB_SETTINGS, ...(rec?.settings || {}) };
}

export function setSubBotModeByUidOrPhone(uidOrPhone, isPrivate, subBots = global.subBots) {
  let phone = normalizePhone(uidOrPhone);
  let uid = '';
  if (subBots?.get) {
    const byId = subBots.get(uidOrPhone);
    if (byId) {
      uid = byId.id;
      phone = normalizePhone(byId.phoneNumber) || phone;
    }
  }
  if (!phone) return null;
  const rec = ensureSubBotRecord(phone, { uid });
  rec.settings.mode = isPrivate ? 'private' : 'public';
  saveBotsStore();
  return rec;
}

export function recordSubPairEvent(uid, code, subBots = global.subBots) {
  let phone = '';
  if (subBots?.get) {
    const bot = subBots.get(uid);
    phone = normalizePhone(bot?.phoneNumber);
  }
  if (!phone) phone = normalizePhone(uid);
  if (!phone) return null;
  const rec = ensureSubBotRecord(phone, { uid });
  rec.uid = uid || rec.uid;
  rec.lastPairCode = String(code || '');
  rec.pairStatus = 'pairing';
  rec.pairError = null;
  rec.pairedAt = Date.now();
  saveBotsStore();
  return rec;
}

export function recordSubReadyEvent(uid, sock, subBots = global.subBots) {
  let phone = '';
  if (subBots?.get) {
    const bot = subBots.get(uid);
    phone = normalizePhone(bot?.phoneNumber);
  }
  if (!phone && sock?.user?.id) phone = normalizePhone(sock.user.id.split(':')[0].split('@')[0]);
  if (!phone) return null;
  const rec = ensureSubBotRecord(phone, { uid });
  rec.uid = uid || rec.uid;
  rec.pairStatus = 'connected';
  rec.pairError = null;
  rec.lastSeenAt = Date.now();
  if (sock?.user?.name) rec.waName = String(sock.user.name);
  saveBotsStore();
  return rec;
}

export function recordSubStatusEvent(uid, status, errMsg = null, subBots = global.subBots) {
  let phone = '';
  if (subBots?.get) {
    const bot = subBots.get(uid);
    phone = normalizePhone(bot?.phoneNumber);
  }
  if (!phone) phone = normalizePhone(uid);
  if (!phone) return null;
  const store = loadBotsStore();
  const rec = store.subBots[phone];
  if (!rec) return null;
  rec.pairStatus = status;
  if (errMsg) rec.pairError = String(errMsg);
  if (status === 'connected') rec.lastSeenAt = Date.now();
  saveBotsStore(store);
  return rec;
}

export function verifySubBotAccess(phoneRaw, codeRaw) {
  const phone = normalizePhone(phoneRaw);
  const code = String(codeRaw || '').trim();
  if (!phone || !code) return { ok: false, error: 'أدخل رقم الهاتف وكود البوت المحفوظ' };
  const store = loadBotsStore();
  const rec = store.subBots[phone];
  if (!rec) return { ok: false, error: 'لا يوجد بوت مسجّل بهذا الرقم بعد. ابدأ بربط حسابك أولاً.' };

  const matchesControl = rec.controlCode && timingSafeEqualStr(code, rec.controlCode);
  const matchesPair = rec.lastPairCode && timingSafeEqualStr(code, rec.lastPairCode);
  if (!matchesControl && !matchesPair) {
    return { ok: false, error: 'كود البوت غير صحيح. تحقق من الكود المحفوظ وحاول مرة أخرى.' };
  }
  return { ok: true, phone, record: rec };
}

function findLiveSubBot(phone, uid, subBots) {
  if (!subBots) return null;
  let live = null;
  try {
    if (phone && typeof subBots.getByPhone === 'function') live = subBots.getByPhone(phone);
    if (!live && uid && typeof subBots.get === 'function') live = subBots.get(uid);
    if (!live && typeof subBots.list === 'function') {
      const hit = subBots.list().find((b) => normalizePhone(b.phone) === phone || b.id === uid);
      if (hit && typeof subBots.get === 'function') live = subBots.get(hit.id) || hit;
      else if (hit) live = hit;
    }
  } catch {}
  return live;
}

export function serializeSubBot(phone, subBots = global.subBots, opts = {}) {
  const store = loadBotsStore();
  const rec = store.subBots[phone] || null;
  const live = findLiveSubBot(phone, rec?.uid, subBots);
  const liveName = live?.sock?.user?.name || live?.name || '';
  const liveConnected = Boolean(live?.connected);
  const startedAt = live?.startedAt || live?.started || null;
  const messages = Number(live?.msgCount ?? live?.messages ?? 0);
  const status = liveConnected
    ? 'connected'
    : (rec?.pairStatus === 'pairing' ? 'pairing' : (live ? 'disconnected' : (rec?.pairStatus || 'disconnected')));

  const allow = (global.db && global.db.subPairAllow) || {};
  const out = {
    phone,
    uid: live?.id || rec?.uid || '',
    index: live?.index || null,
    name: rec?.settings?.customName || liveName || rec?.waName || `بوت ${phone.slice(-4)}`,
    waName: liveName || rec?.waName || '',
    jid: live?.sock?.user?.id || `${phone}@s.whatsapp.net`,
    connected: liveConnected,
    status,
    pairCode: rec?.lastPairCode || '',
    pairError: rec?.pairError || null,
    startedAt: startedAt ? new Date(startedAt).toISOString() : null,
    uptimeSec: liveConnected && startedAt ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0,
    messages,
    approved: !!allow[phone],
    createdAt: rec?.createdAt || null,
    pairedAt: rec?.pairedAt || null,
    lastSeenAt: rec?.lastSeenAt || null,
    settings: { ...DEFAULT_SUB_SETTINGS, ...(rec?.settings || {}) }
  };
  if (opts.includeControlCode !== false) {
    out.controlCode = rec?.controlCode || '';
  }
  return out;
}

export async function requestSubBotPairing(phoneRaw, { subBots = global.subBots, isAdmin = false, waitMs = 2600 } = {}) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { ok: false, statusCode: 400, error: 'رقم الهاتف غير صالح — اكتب الرقم مع رمز الدولة (8 إلى 15 رقماً بدون +)' };
  }
  const store = loadBotsStore();
  if (!isAdmin) {
    if (store.mainBot.noSub || global.db?.noSub) {
      return { ok: false, statusCode: 403, error: 'تم إغلاق تسجيل البوتات الفرعية مؤقتاً من قبل الإدارة.' };
    }
    if (store.mainBot.allowPublicWebPair === false) {
      return { ok: false, statusCode: 403, error: 'الربط العام من الموقع متوقف حالياً بقرار الإدارة.' };
    }
  }

  const rec = ensureSubBotRecord(phone);
  rec.pairStatus = 'pairing';
  rec.pairError = null;
  saveBotsStore(store);

  if (!subBots || typeof subBots.add !== 'function') {
    return {
      ok: true,
      pendingManager: true,
      phone,
      controlCode: rec.controlCode,
      pairCode: rec.lastPairCode || '',
      bot: serializeSubBot(phone, subBots),
      message: 'تم تجهيز كود التحكم الخاص بك وحفظه، بانتظار جاهزية محرك البوتات الفرعية لإصدار كود واتساب.'
    };
  }

  // If already connected with this phone, surface its active status immediately
  const existing = findLiveSubBot(phone, rec.uid, subBots);
  if (existing?.connected) {
    rec.pairStatus = 'connected';
    rec.uid = existing.id || rec.uid;
    saveBotsStore(store);
    return {
      ok: true,
      alreadyConnected: true,
      phone,
      controlCode: rec.controlCode,
      pairCode: rec.lastPairCode || '',
      bot: serializeSubBot(phone, subBots),
      message: 'هذا الرقم مربوط ومتصل بالفعل! يمكنك التحكم في إعداداته الآن.'
    };
  }

  let resolvedCode = '';
  let resolvedErr = '';
  let targetUid = '';

  const onPair = (id, code) => {
    if (targetUid && id !== targetUid) return;
    const b = subBots.get?.(id);
    if (!targetUid && b && normalizePhone(b.phoneNumber) !== phone) return;
    resolvedCode = code;
    rec.uid = id;
    rec.lastPairCode = String(code || '');
    rec.pairStatus = 'pairing';
    rec.pairError = null;
    rec.pairedAt = Date.now();
    saveBotsStore(store);
  };
  const onError = (id, err) => {
    if (targetUid && id !== targetUid) return;
    resolvedErr = err?.message || String(err || 'تعذّر بدء جلسة الاقتران');
    rec.pairStatus = 'error';
    rec.pairError = resolvedErr;
    saveBotsStore(store);
  };

  subBots.on?.('pair', onPair);
  subBots.on?.('error', onError);

  try {
    targetUid = await subBots.add(phone);
    rec.uid = targetUid;
    saveBotsStore(store);

    const startAt = Date.now();
    while (!resolvedCode && !resolvedErr && (Date.now() - startAt) < waitMs) {
      await new Promise((r) => setTimeout(r, 120));
    }
  } catch (e) {
    resolvedErr = e?.message || 'تعذّر بدء عملية الربط';
    rec.pairStatus = 'error';
    rec.pairError = resolvedErr;
    saveBotsStore(store);
  } finally {
    subBots.off?.('pair', onPair);
    subBots.off?.('error', onError);
  }

  return {
    ok: !resolvedErr || Boolean(resolvedCode),
    phone,
    uid: rec.uid,
    controlCode: rec.controlCode,
    pairCode: resolvedCode || rec.lastPairCode || '',
    error: resolvedErr || undefined,
    bot: serializeSubBot(phone, subBots),
    message: resolvedCode
      ? 'تم إصدار كود ربط واتساب وحفظ كود التحكم الخاص بك بنجاح.'
      : (resolvedErr ? `تنبيه: ${resolvedErr}` : 'جاري إصدار كود الربط من واتساب... سيتم التحديث تلقائياً خلال ثوانٍ.')
  };
}

export function updateSubBotSettings(phoneRaw, patch = {}, subBots = global.subBots) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, error: 'رقم غير صالح' };
  const rec = ensureSubBotRecord(phone);
  const next = { ...DEFAULT_SUB_SETTINGS, ...(rec.settings || {}) };

  if (patch.mode === 'private' || patch.mode === 'public') {
    next.mode = patch.mode;
  }
  if (typeof patch.customName === 'string') {
    next.customName = patch.customName.trim().slice(0, 48);
  }
  if (typeof patch.prefix === 'string') {
    const p = patch.prefix.trim().slice(0, 4);
    if (p) next.prefix = p;
  }
  if (typeof patch.welcome === 'boolean') next.welcome = patch.welcome;
  if (typeof patch.autoReply === 'boolean') next.autoReply = patch.autoReply;
  if (typeof patch.paused === 'boolean') next.paused = patch.paused;
  if (typeof patch.notes === 'string') next.notes = patch.notes.trim().slice(0, 160);

  rec.settings = next;
  saveBotsStore();

  // Apply live prefix/info to active SubBot config if running
  const live = findLiveSubBot(phone, rec.uid, subBots);
  if (live) {
    try {
      if (live.config && typeof live.config === 'object') {
        if (next.prefix) live.config.prefix = [next.prefix];
        if (next.customName && live.config.info) {
          live.config.info = { ...live.config.info, nameBot: next.customName };
        }
      }
      if (typeof runtimeHooks.onSubSettingsChange === 'function') {
        runtimeHooks.onSubSettingsChange(live.id || rec.uid, phone, next);
      }
    } catch {}
  } else if (typeof runtimeHooks.onSubSettingsChange === 'function') {
    try { runtimeHooks.onSubSettingsChange(rec.uid || '', phone, next); } catch {}
  }

  return { ok: true, bot: serializeSubBot(phone, subBots) };
}

export async function controlSubBot(phoneRaw, action, payload = {}, subBots = global.subBots) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, error: 'رقم الهاتف غير صالح' };
  const store = loadBotsStore();
  const rec = store.subBots[phone];
  const live = findLiveSubBot(phone, rec?.uid, subBots);

  switch (action) {
    case 'pause':
      return { ...updateSubBotSettings(phone, { paused: true }, subBots), message: 'تم إيقاف البوت مؤقتاً' };

    case 'resume':
      return { ...updateSubBotSettings(phone, { paused: false }, subBots), message: 'تم تشغيل البوت واستئناف الردود' };

    case 'regenerate-code': {
      const r = ensureSubBotRecord(phone);
      r.controlCode = generateControlCode();
      saveBotsStore(store);
      return {
        ok: true,
        controlCode: r.controlCode,
        bot: serializeSubBot(phone, subBots),
        message: 'تم توليد كود تحكم جديد وحفظه'
      };
    }

    case 'reconnect': {
      if (!subBots || typeof subBots.add !== 'function') {
        return { ok: false, error: 'محرك البوتات الفرعية غير متاح حالياً' };
      }
      return requestSubBotPairing(phone, { subBots, isAdmin: true, waitMs: 2200 });
    }

    case 'disconnect':
    case 'remove':
    case 'unlink': {
      let removed = false;
      try {
        if (live?.id && typeof subBots?.remove === 'function') {
          await subBots.remove(live.id);
          removed = true;
        } else if (typeof subBots?.removeByPhone === 'function') {
          removed = await subBots.removeByPhone(phone);
        }
      } catch {}
      if (action === 'remove') {
        delete store.subBots[phone];
        saveBotsStore(store);
        return { ok: true, removed: true, message: `تم حذف البوت ${phone} وإزالة جلسته` };
      }
      if (rec) {
        rec.pairStatus = 'disconnected';
        rec.uid = '';
        saveBotsStore(store);
      }
      return { ok: true, removed, bot: store.subBots[phone] ? serializeSubBot(phone, subBots) : null, message: 'تم فصل جلسة البوت' };
    }

    case 'send-message': {
      const to = normalizePhone(payload.to);
      const text = String(payload.text || '').trim();
      if (!to) return { ok: false, error: 'رقم المستلم غير صالح' };
      if (!text || text.length > 4096) return { ok: false, error: 'اكتب نصاً صالحاً (أقل من 4096 حرف)' };
      if (!live?.sock || !live?.connected) return { ok: false, error: 'هذا البوت غير متصل بواتساب حالياً' };
      await live.sock.sendMessage(`${to}@s.whatsapp.net`, { text });
      return { ok: true, message: `تم إرسال الرسالة من البوت ${phone}` };
    }

    default:
      return { ok: false, error: 'إجراء غير معروف للبوت الفرعي' };
  }
}

export function getMainBotSettings(client) {
  const store = loadBotsStore();
  const m = store.mainBot || { ...DEFAULT_MAIN_SETTINGS };
  const rawFromMe = client?.config && 'fromMe' in client.config ? client.config.fromMe : m.fromMe;
  const fromMe = normalizeFromMeValue(rawFromMe);
  return {
    nameBot: client?.config?.info?.nameBot || m.nameBot || DEFAULT_MAIN_SETTINGS.nameBot,
    prefix: Array.isArray(client?.config?.prefix)
      ? client.config.prefix.join(' ')
      : String(client?.config?.prefix || (Array.isArray(m.prefix) ? m.prefix.join(' ') : '.')),
    fromMe,
    fromMeMode: fromMeToMode(fromMe),
    autoRead: Boolean(client?.config?.autoRead ?? m.autoRead),
    maintenance: Boolean(global.db?.maintenance ?? m.maintenance),
    noSub: Boolean(global.db?.noSub ?? m.noSub),
    allowPublicWebPair: m.allowPublicWebPair !== false,
    welcomeEnabled: m.welcomeEnabled !== false,
    antiLink: Boolean(m.antiLink)
  };
}

export function applyMainBotSettingsOnBoot(client) {
  const store = loadBotsStore();
  const m = store.mainBot;
  if (!m || !client?.config) return;
  try {
    if (m.nameBot && client.config.info) client.config.info.nameBot = m.nameBot;
    if (Array.isArray(m.prefix) && m.prefix.length) client.config.prefix = m.prefix;
    client.config.fromMe = normalizeFromMeValue(m.fromMe);
    if (typeof m.autoRead === 'boolean') client.config.autoRead = m.autoRead;
    syncToGlobalDb(store);
  } catch {}
}

export function syncConnectedBotOwner(client, sock = client?.sock) {
  try {
    if (!client?.config || !sock?.user?.id) return false;
    const rawId = String(sock.user.id || '');
    const phone = normalizePhone(rawId.split(':')[0].split('@')[0]);
    if (!phone) return false;
    const selfJid = `${phone}@s.whatsapp.net`;
    const selfLid = sock.user.lid ? String(sock.user.lid).split(':')[0] : '';
    const owners = Array.isArray(client.config.owners) ? [...client.config.owners] : [];
    const exists = owners.some((o) => {
      if (!o) return false;
      if (typeof o === 'string') return normalizePhone(o) === phone;
      return normalizePhone(o.jid) === phone || (selfLid && (o.lid === selfLid || o.lid === selfLid.split('@')[0]));
    });
    if (!exists) {
      owners.push({
        name: sock.user.name || 'Bot Connected Number',
        jid: selfJid,
        ...(selfLid ? { lid: selfLid } : {})
      });
      client.config.owners = owners;
    }
    return true;
  } catch {
    return false;
  }
}

export function syncSubBotSelfOwner(bot, sock = bot?.sock) {
  try {
    if (!bot || !sock?.user?.id) return false;
    const rawId = String(sock.user.id || '');
    const phone = normalizePhone(rawId.split(':')[0].split('@')[0]);
    if (!phone) return false;
    const selfJid = `${phone}@s.whatsapp.net`;
    const selfLid = sock.user.lid ? String(sock.user.lid).split(':')[0] : '';
    const curCfg = bot.cfg || bot.config || {};
    const owners = Array.isArray(curCfg.owners) ? [...curCfg.owners] : [];
    const exists = owners.some((o) => {
      if (!o) return false;
      if (typeof o === 'string') return normalizePhone(o) === phone;
      return normalizePhone(o.jid) === phone || (selfLid && (o.lid === selfLid || o.lid === selfLid.split('@')[0]));
    });
    if (!exists) {
      owners.push({
        name: sock.user.name || `SubBot ${phone}`,
        jid: selfJid,
        ...(selfLid ? { lid: selfLid } : {})
      });
    }
    const nextCfg = {
      ...curCfg,
      fromMe: curCfg.fromMe === undefined ? null : curCfg.fromMe,
      owners
    };
    bot.cfg = nextCfg;
    return true;
  } catch {
    return false;
  }
}

export function updateMainBotSettings(client, patch = {}) {
  const store = loadBotsStore();
  const m = { ...DEFAULT_MAIN_SETTINGS, ...(store.mainBot || {}) };

  if (typeof patch.nameBot === 'string' && patch.nameBot.trim()) {
    m.nameBot = patch.nameBot.trim().slice(0, 64);
    if (client?.config?.info) client.config.info.nameBot = m.nameBot;
  }
  if (patch.prefix !== undefined) {
    const arr = Array.isArray(patch.prefix)
      ? patch.prefix.map((x) => String(x).trim()).filter(Boolean)
      : String(patch.prefix || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (arr.length) {
      m.prefix = arr.slice(0, 6);
      if (client?.config) client.config.prefix = m.prefix;
    }
  }
  if (patch.fromMeMode !== undefined || patch.fromMe !== undefined) {
    const rawVal = patch.fromMeMode !== undefined ? patch.fromMeMode : patch.fromMe;
    m.fromMe = normalizeFromMeValue(rawVal);
    m.fromMeModeV2 = true;
    if (client?.config) client.config.fromMe = m.fromMe;
  }
  if (typeof patch.autoRead === 'boolean') {
    m.autoRead = patch.autoRead;
    if (client?.config) client.config.autoRead = patch.autoRead;
  }
  if (typeof patch.maintenance === 'boolean') m.maintenance = patch.maintenance;
  if (typeof patch.noSub === 'boolean') m.noSub = patch.noSub;
  if (typeof patch.allowPublicWebPair === 'boolean') m.allowPublicWebPair = patch.allowPublicWebPair;
  if (typeof patch.welcomeEnabled === 'boolean') m.welcomeEnabled = patch.welcomeEnabled;
  if (typeof patch.antiLink === 'boolean') m.antiLink = patch.antiLink;

  store.mainBot = m;
  saveBotsStore(store);
  return getMainBotSettings(client);
}

export function getBotFleetOverview(client, subBots = global.subBots, mainConnected = false) {
  const store = loadBotsStore();
  const phones = new Set(Object.keys(store.subBots || {}));

  // Merge live SubBots that may have paired via WhatsApp commands directly
  let liveStats = { total: 0, connected: 0, disconnected: 0, totalMessages: 0 };
  try {
    if (subBots && typeof subBots.list === 'function') {
      for (const b of subBots.list()) {
        const p = normalizePhone(b.phone);
        if (p) {
          ensureSubBotRecord(p, { uid: b.id, waName: b.name || '' });
          phones.add(p);
        }
      }
    }
    if (subBots && typeof subBots.stats === 'function') {
      liveStats = subBots.stats();
    }
  } catch {}

  const subs = [...phones]
    .sort()
    .map((p) => serializeSubBot(p, subBots, { includeControlCode: true }));

  const connectedSubs = subs.filter((s) => s.connected).length;
  const allowMap = (global.db && global.db.subPairAllow) || {};
  const allowList = Object.entries(allowMap).map(([phone, meta]) => ({
    phone,
    at: meta?.at || null,
    by: meta?.by || ''
  }));

  let owners = [];
  try {
    owners = (client?.config?.owners || []).map((o) => ({
      name: o.name || 'Owner',
      jid: o.jid || '',
      phone: normalizePhone(o.jid)
    }));
  } catch {}

  const mainSettings = getMainBotSettings(client);
  let commandsCount = 0;
  try { commandsCount = client?.getAllCommands?.().length || 0; } catch {}

  return {
    mainBot: {
      name: mainSettings.nameBot,
      phone: client?.config?.phoneNumber || client?.sock?.user?.id?.split(':')[0]?.split('@')[0] || '',
      jid: client?.sock?.user?.id || '',
      waName: client?.sock?.user?.name || '',
      connected: Boolean(mainConnected),
      commands: commandsCount,
      uptimeSec: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      owners,
      settings: mainSettings
    },
    stats: {
      totalSubs: subs.length,
      liveTotal: liveStats.total || subs.length,
      connectedSubs: Math.max(connectedSubs, liveStats.connected || 0),
      disconnectedSubs: Math.max(0, subs.length - Math.max(connectedSubs, liveStats.connected || 0)),
      totalMessages: liveStats.totalMessages || subs.reduce((a, b) => a + (b.messages || 0), 0),
      approvedCount: allowList.length
    },
    subPairing: global.db?.subPairing || null,
    allowList,
    subBots: subs
  };
}
