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
  other: ['أخرى', '🔮']
};

export function normalizeCommandsList(client) {
  let raw = [];
  try {
    raw = client?.getAllCommands?.() || [];
  } catch {
    raw = [];
  }
  const list = [];
  for (const c of raw) {
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
    list.push({
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
    });
  }
  return list;
}

export function matchCommand(commands, rawCommandName) {
  const needle = String(rawCommandName || '').trim().toLowerCase();
  if (!needle) return null;
  for (const c of commands) {
    if (!c) continue;
    const triggers = Array.isArray(c.command) ? c.command : (c.command ? [c.command] : []);
    for (const t of triggers) {
      if (t instanceof RegExp) {
        if (t.test(rawCommandName)) return c;
      } else if (String(t).toLowerCase() === needle) {
        return c;
      }
    }
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
