/**
 * system/simulator.js
 * ---------------------------------------------------
 * فهرس الأوامر + محاكي تنفيذ الأوامر التفاعلي للوحة التحكم والاختبارات
 * - يقرأ جميع الأوامر المسجّلة في client.getAllCommands()
 * - ينفّذ أي أمر داخل بيئة محاكاة آمنة (fake conn/m) ويلتقط كل الردود
 *   (نص، أزرار، قوائم اختيار، أزرار نسخ، استطلاعات، عجلات، ودجت HTML)
 */

const CATEGORY_LABELS = {
  native: ['الأوامر التفاعلية', '🧩'],
  downloads: ['التحميل', '📂'],
  group: ['المجموعات', '🛡️'],
  sticker: ['الملصقات', '🃏'],
  owner: ['المطورين', '👑'],
  tools: ['الأدوات', '⚙️'],
  search: ['البحث', '🔍'],
  admin: ['الأدمن', '⚔️'],
  games: ['الألعاب', '🎮'],
  gif: ['الجيف', '🖼️'],
  bank: ['البنك', '💳'],
  ai: ['الذكاء الاصطناعي', '🤖'],
  sub: ['البوتات الفرعية', '⛓️'],
  subs: ['الاشتراكات', '📡'],
  info: ['معلومات البوت', '📜'],
  nicknames: ['الألقاب', '🏷️'],
  logos: ['اللوجوهات', '🎨'],
  voices: ['الأصوات', '🎙️'],
  islamic: ['الإسلاميات', '🕌'],
  guild: ['النقابات', '🏰'],
  math: ['الرياضيات والعلوم', '📐'],
  cipher: ['التشفير والخطوط', '🔐'],
  dev: ['تطوير وبرمجة', '💻'],
  atlas: ['الأطلس والمعرفة', '🌍'],
  rpg: ['المغامرات وRPG', '⚔️'],
  empire: ['الاقتصاد والأعمال', '🏛️'],
  design: ['الألوان والتصميم', '🎨'],
  health: ['الصحة واللياقة', '🩺'],
  creator: ['صنّاع المحتوى', '🎬'],
  whatsapp: ['مزايا واتساب المتقدمة', '📲'],
  other: ['أخرى', '🔮']
};

let _normCache = null;
export function normalizeCommandsList(client) {
  let raw = [];
  try {
    raw = client?.getAllCommands?.() || [];
  } catch {
    raw = [];
  }
  const len = raw.length;
  const firstRef = raw[0] || null;
  const lastRef = len > 0 ? raw[len - 1] : null;
  if (_normCache && _normCache.client === client && _normCache.len === len && _normCache.firstRef === firstRef && _normCache.lastRef === lastRef) {
    return _normCache.list;
  }
  const list = new Array(len);
  let outIdx = 0;
  for (let i = 0; i < len; i++) {
    const c = raw[i];
    if (!c) continue;
    const triggers = Array.isArray(c.command)
      ? c.command.map((x) => (x instanceof RegExp ? x.source : String(x)))
      : c.command instanceof RegExp
        ? [c.command.source]
        : c.command
          ? [String(c.command)]
          : [];
    const usages = Array.isArray(c.usage)
      ? c.usage.filter(Boolean).map(String)
      : c.usage
        ? [String(c.usage)]
        : triggers.slice(0, 1);
    const cat = String(c.category || 'other');
    const [catLabel, catEmoji] = CATEGORY_LABELS[cat] || [cat, '📁'];
    list[outIdx++] = {
      primary: triggers[0] || usages[0] || 'cmd',
      triggers,
      usages,
      description: String(c.description || ''),
      category: cat,
      categoryLabel: catLabel,
      categoryEmoji: catEmoji,
      groupOnly: !!c.group,
      adminOnly: !!c.admin,
      ownerOnly: !!c.owner,
      hidden: !!c.hidden
    };
  }
  list.length = outIdx;
  if (len > 0) {
    _normCache = { client, len, firstRef, lastRef, list };
  }
  return list;
}

let _matchCache = null;
export function matchCommand(commands, rawCommandName) {
  const needle = String(rawCommandName || '').trim().toLowerCase();
  if (!needle || !Array.isArray(commands)) return null;
  const len = commands.length;
  const firstRef = commands[0] || null;
  const lastRef = len > 0 ? commands[len - 1] : null;
  if (!_matchCache || _matchCache.len !== len || _matchCache.firstRef !== firstRef || _matchCache.lastRef !== lastRef) {
    const exactMap = new Map();
    const regexList = [];
    for (let i = 0; i < len; i++) {
      const c = commands[i];
      if (!c) continue;
      const triggers = Array.isArray(c.command) ? c.command : (c.command ? [c.command] : []);
      for (const t of triggers) {
        if (t instanceof RegExp) {
          regexList.push({ re: t, cmd: c });
        } else {
          const key = String(t).toLowerCase();
          if (!exactMap.has(key)) exactMap.set(key, c);
        }
      }
    }
    _matchCache = { len, firstRef, lastRef, exactMap, regexList };
  }
  const hit = _matchCache.exactMap.get(needle);
  if (hit) return hit;
  for (const { re, cmd } of _matchCache.regexList) {
    if (re.test(rawCommandName)) return cmd;
  }
  return null;
}

function decodeRichResponse(relayPayload) {
  try {
    const b64 = relayPayload?.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse?.data;
    if (!b64) return null;
    const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    const tab = parsed?.embedded_screens?.[0]?.content?.[0]?.tabs?.[0];
    const prim = tab?.sections?.[0]?.view_model?.primitive;
    return {
      title: parsed?.embedded_screens?.[0]?.title || 'Widget',
      html: prim?.payload || ''
    };
  } catch {
    return null;
  }
}

export async function simulateCommand(client, inputText, options = {}) {
  const raw = String(inputText || '').trim();
  if (!raw) {
    return { ok: false, error: 'اكتب أمراً لتجربته (مثال: .اذكار_الصباح أو .زخرفة لايت)' };
  }

  const prefixes = Array.isArray(client?.config?.prefix)
    ? client.config.prefix
    : [client?.config?.prefix || '.'];
  let usedPrefix = prefixes[0] || '.';
  let body = raw;
  for (const p of prefixes) {
    if (p && raw.startsWith(p)) {
      usedPrefix = p;
      body = raw.slice(p.length).trim();
      break;
    }
  }

  const parts = body.split(/\s+/).filter(Boolean);
  const cmdName = parts[0] || '';
  const args = parts.slice(1);
  const text = args.join(' ');

  let commands = [];
  try { commands = (await client?.getAllCommands?.()) || []; } catch { commands = []; }
  const found = matchCommand(commands, cmdName);
  if (!found) {
    return {
      ok: false,
      error: `الأمر "${cmdName}" غير موجود. ابحث في دليل الأوامر أو اكتب .بحث-امر ${cmdName}`,
      command: cmdName
    };
  }

  const outputs = [];
  const reactions = [];
  const chatJid = options.chat || 'simulator@s.whatsapp.net';
  const senderJid = options.sender || 'tester@s.whatsapp.net';

  const conn = {
    config: client?.config || {},
    user: { id: client?.config?.phoneNumber ? `${client.config.phoneNumber}@s.whatsapp.net` : 'bot@s.whatsapp.net' },
    groupMetadata: async (jid) => ({
      id: jid,
      subject: 'مجموعة المعاينة التفاعلية',
      desc: 'بيئة اختبار أوامر المجموعات',
      participants: [
        { id: senderJid, admin: 'superadmin' },
        { id: '201000000001@s.whatsapp.net', admin: 'admin' },
        { id: '201000000002@s.whatsapp.net', admin: null }
      ]
    }),
    onWhatsApp: async (...jids) => jids.map((j) => ({ jid: `${String(j).replace(/[^0-9]/g, '')}@s.whatsapp.net`, exists: true })),
    getBusinessProfile: async (jid) => ({ wid: jid, description: 'حساب أعمال تجريبي', category: 'خدمات تقنية', email: 'info@example.com', website: ['https://example.com'] }),
    fetchStatus: async () => [{ status: 'متاح — وضع المحاكاة', setAt: new Date().toISOString() }],
    groupRequestParticipantsList: async () => [{ jid: '201099887766@s.whatsapp.net', request_method: 'invite_link', request_time: String(Math.floor(Date.now() / 1000)) }],
    groupRequestParticipantsUpdate: async (_g, jids, action) => jids.map((jid) => ({ jid, status: '200', action })),
    groupJoinApprovalMode: async () => {},
    groupMemberAddMode: async () => {},
    groupToggleEphemeral: async () => {},
    createCallLink: async (type) => `https://call.whatsapp.com/sim-${type || 'audio'}-demo`,
    fetchPrivacySettings: async () => ({ last: 'contacts', online: 'match_last_seen', profile: 'all', status: 'contacts', readreceipts: 'all', groupadd: 'contacts' }),
    newsletterMetadata: async (_t, key) => ({ id: `${key}@newsletter`, name: 'قناة تجريبية', subscribers: 12500, description: 'وصف القناة التجريبي', verification: 'VERIFIED' }),
    newsletterFollow: async () => {},
    newsletterUnfollow: async () => {},
    newsletterMute: async () => {},
    newsletterUnmute: async () => {},
    sendMessage: async (chat, payload = {}) => {
      if (payload.react) {
        reactions.push(payload.react.text || '👍');
        return { key: { id: 'sim-react-' + Date.now() } };
      }
      if (payload.poll) {
        outputs.push({
          type: 'poll',
          name: payload.poll.name,
          values: payload.poll.values || [],
          selectableCount: payload.poll.selectableCount || 1
        });
        return { key: { id: 'sim-poll-' + Date.now() } };
      }
      if (payload.pin) {
        outputs.push({ type: 'text', text: `📌 تم ${payload.pin.type === 1 ? 'تثبيت' : 'إلغاء تثبيت'} الرسالة بنجاح.` });
        return { key: { id: 'sim-pin-' + Date.now() } };
      }
      if (payload.disappearingMessagesInChat !== undefined) {
        outputs.push({ type: 'text', text: `⏳ تم ضبط الرسائل المؤقتة: ${payload.disappearingMessagesInChat || 'إيقاف'}` });
        return { key: { id: 'sim-eph-' + Date.now() } };
      }
      if (payload.limitSharing !== undefined) {
        outputs.push({ type: 'text', text: `🛡️ تقييد المشاركة المتقدم: ${payload.limitSharing ? 'مفعّل' : 'متوقف'}` });
        return { key: { id: 'sim-lshare-' + Date.now() } };
      }
      if (payload.location) {
        outputs.push({ type: 'text', text: `📍 موقع: ${payload.location.name || ''} (${payload.location.degreesLatitude}, ${payload.location.degreesLongitude})` });
        return { key: { id: 'sim-loc-' + Date.now() } };
      }
      if (payload.contacts) {
        outputs.push({ type: 'text', text: `📇 بطاقة تواصل: ${payload.contacts.displayName || 'Contact'}` });
        return { key: { id: 'sim-vcard-' + Date.now() } };
      }
      if (payload.event) {
        outputs.push({ type: 'text', text: `📅 فعالية: ${payload.event.name}\n📝 ${payload.event.description || ''}` });
        return { key: { id: 'sim-evt-' + Date.now() } };
      }
      if (payload.delete) {
        return { key: { id: 'sim-del-' + Date.now() } };
      }
      outputs.push({
        type: payload.buttons ? 'interactive' : (payload.image ? 'image' : 'text'),
        text: payload.text || payload.caption || '',
        footer: payload.footer || '',
        mediaUrl: typeof payload.image === 'object' ? payload.image.url : (typeof payload.media === 'object' ? payload.media.url : null),
        buttons: payload.buttons || []
      });
      return { key: { id: 'sim-msg-' + Date.now() } };
    },
    sendButtonNormal: async (chat, payload = {}) => {
      outputs.push({
        type: 'interactive',
        text: payload.caption || '',
        footer: payload.footer || '',
        mediaUrl: typeof payload.media === 'object' ? payload.media.url : null,
        buttons: payload.buttons || []
      });
      return { key: { id: 'sim-btn-' + Date.now() } };
    },
    sendButton: async (chat, payload = {}) => {
      outputs.push({
        type: 'interactive',
        text: payload.bodyText || '',
        footer: payload.footerText || '',
        mediaUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : null,
        buttons: payload.buttons || []
      });
      return { key: { id: 'sim-sbtn-' + Date.now() } };
    },
    sendCarousel: async (chat, payload = {}) => {
      outputs.push({
        type: 'carousel',
        headerText: payload.headerText || '',
        globalFooterText: payload.globalFooterText || '',
        cards: payload.cards || []
      });
      return { key: { id: 'sim-car-' + Date.now() } };
    },
    relayMessage: async (chat, payload = {}) => {
      const widget = decodeRichResponse(payload);
      if (widget) {
        outputs.push({
          type: 'widget',
          title: widget.title,
          html: widget.html
        });
      } else {
        outputs.push({ type: 'text', text: '[رسالة بروتوكول مخصصة]' });
      }
      return { key: { id: 'sim-relay-' + Date.now() } };
    },
    generateMessageTag: async () => 'SIM_' + Date.now().toString(36)
  };

  const m = {
    chat: chatJid,
    sender: senderJid,
    text,
    body: raw,
    isGroup: true,
    isOwner: true,
    mentionedJid: [],
    conn,
    reply: async (msgText) => {
      outputs.push({ type: 'text', text: String(msgText ?? '') });
      return { key: { id: 'sim-reply-' + Date.now() } };
    },
    react: async (emoji) => {
      reactions.push(String(emoji || '✅'));
      return { key: { id: 'sim-react-' + Date.now() } };
    },
    lid2jid: async (jid) => String(jid || senderJid)
  };

  const fn = typeof found === 'function' ? found : found.execute;
  if (typeof fn !== 'function') {
    return { ok: false, error: 'الأمر لا يحتوي على دالة تنفيذ صالحة', command: cmdName };
  }

  const startedAt = Date.now();
  try {
    await fn(m, {
      conn,
      sock: conn,
      bot: client,
      text,
      args,
      command: cmdName,
      usedPrefix,
      isOwner: true,
      isAdmin: true,
      isBotAdmin: true,
      chat: chatJid,
      participants: [],
      config: client?.config || {}
    });
  } catch (err) {
    return {
      ok: false,
      command: cmdName,
      category: found.category || 'other',
      durationMs: Date.now() - startedAt,
      error: err?.message || String(err),
      outputs,
      reactions
    };
  }

  return {
    ok: true,
    command: cmdName,
    category: found.category || 'other',
    durationMs: Date.now() - startedAt,
    reactions,
    outputs
  };
}

export default {
  normalizeCommandsList,
  matchCommand,
  simulateCommand
};
