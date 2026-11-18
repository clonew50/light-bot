/**
 * system/interactiveUI.js
 * ---------------------------------------------------
 * مكتبة الرسائل التفاعلية والتنسيق الاحترافي للبوت
 * - بطاقات نصية مزخرفة ومنظمة (Unicode Cards & Progress Bars)
 * - أزرار تفاعلية أصلية (quick_reply / single_select / cta_copy / cta_url)
 * - استطلاعات رأي أصلية (Native WhatsApp Polls)
 * - قوائم دوّارة (Carousel) وودجت HTML تفاعلي (Rich Response Widget)
 * - تراجع تلقائي آمن (Graceful Fallback) عند غياب واجهة الأزرار
 */

export const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export const THEMES = {
  crimson: { top: '╭─┈──┈─⟞🩸⟝─┈──┈─╮', bot: '╰─┈──┈─⟞🩸⟝─┈──┈─╯', div: '❐═━━━═╊⊰🩸⊱╉═━━━═❐', bullet: '🩸' },
  royal:   { top: '╭─┈──┈─⟞👑⟝─┈──┈─╮', bot: '╰─┈──┈─⟞👑⟝─┈──┈─╯', div: '╔═━━━═╊⊰✨⊱╉═━━━═╗', bullet: '✦' },
  emerald: { top: '╭─┈──┈─⟞🌿⟝─┈──┈─╮', bot: '╰─┈──┈─⟞🌿⟝─┈──┈─╯', div: '◈═━━━═╊⊰🕌⊱╉═━━━═◈', bullet: '◈' },
  cyber:   { top: '╭─┈──┈─⟞⚡⟝─┈──┈─╮', bot: '╰─┈──┈─⟞⚡⟝─┈──┈─╯', div: '╠═━━━═╊⊰⚙️⊱╉═━━━═╣', bullet: '▸' },
  game:    { top: '╭─┈──┈─⟞🎮⟝─┈──┈─╮', bot: '╰─┈──┈─⟞🎮⟝─┈──┈─╯', div: '▣═━━━═╊⊰🏆⊱╉═━━━═▣', bullet: '◆' }
};

export function progressBar(value, max = 100, size = 10) {
  const safeMax = max > 0 ? max : 100;
  const ratio = Math.max(0, Math.min(1, Number(value || 0) / safeMax));
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(ratio * 100)}%`;
}

export function formatCard({
  title = '',
  subtitle = '',
  badge = '',
  body = '',
  fields = [],
  footer = '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻',
  tip = '',
  theme = 'crimson'
} = {}) {
  const t = THEMES[theme] || THEMES.crimson;
  const lines = [];
  if (title) {
    lines.push(t.top);
    lines.push(`┃ ${badge ? badge + ' ' : ''}*${title}*`);
    if (subtitle) lines.push(`┃ _${subtitle}_`);
    lines.push(t.bot);
  }
  if (body) {
    lines.push('');
    lines.push(String(body).trim());
  }
  if (Array.isArray(fields) && fields.length) {
    lines.push('');
    lines.push(t.div);
    for (const f of fields) {
      if (!f) continue;
      if (typeof f === 'string') lines.push(`┇ ${t.bullet} ${f}`);
      else if (f.label !== undefined) lines.push(`┇ ${f.icon || t.bullet} *${f.label}:* ${f.value ?? ''}`);
    }
    lines.push(t.div);
  }
  if (tip) {
    lines.push('');
    lines.push(`> 💡 ${tip}`);
  }
  if (footer) {
    lines.push('');
    lines.push(`*${footer}*`);
  }
  return lines.join('\n').trim();
}

export function resolveBotInfo(ctx = {}) {
  return ctx?.bot?.config?.info || ctx?.conn?.config?.info || {};
}

export function resolvePrefix(ctx = {}) {
  if (typeof ctx?.usedPrefix === 'string' && ctx.usedPrefix) return ctx.usedPrefix;
  const p = ctx?.bot?.config?.prefix || ctx?.conn?.config?.prefix || '.';
  return Array.isArray(p) ? (p[0] || '.') : (p || '.');
}

export function pickBotMedia(ctx = {}, index = 0) {
  const info = resolveBotInfo(ctx);
  const imgs = [];
  if (Array.isArray(info.images)) imgs.push(...info.images);
  else if (typeof info.images === 'string') imgs.push(info.images);
  if (Array.isArray(info.supaimg)) imgs.push(...info.supaimg);
  const valid = imgs.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (valid.length) return { url: valid[index % valid.length] };
  return FALLBACK_PNG;
}

export function makeQuickButton(label, cmdId, prefix = '.') {
  const cleanId = String(cmdId || '').trim();
  const id = cleanId.startsWith(prefix) ? cleanId : `${prefix}${cleanId}`;
  return {
    name: 'quick_reply',
    params: {
      display_text: String(label || id).slice(0, 40),
      id
    }
  };
}

export function makeCopyButton(label, copyCode) {
  return {
    name: 'cta_copy',
    params: {
      display_text: String(label || '📋 نسخ').slice(0, 40),
      copy_code: String(copyCode ?? '')
    }
  };
}

export function makeUrlButton(label, url) {
  return {
    name: 'cta_url',
    params: {
      display_text: String(label || '🔗 فتح الرابط').slice(0, 40),
      url: String(url || '')
    }
  };
}

export function makeSelectButton(title, sections) {
  return {
    name: 'single_select',
    params: {
      display_title: String(title || '📜 اختر من القائمة').slice(0, 40),
      title: String(title || '📜 اختر من القائمة').slice(0, 40),
      sections: Array.isArray(sections) ? sections : []
    }
  };
}

/**
 * إرسال رسالة تفاعلية كاملة بأزرار + صورة + تذييل (مع fallback آمن للنص)
 */
export async function sendInteractiveCard(m, ctx = {}, opts = {}) {
  const conn = ctx?.conn || m?.conn;
  const prefix = resolvePrefix(ctx);
  const info = resolveBotInfo(ctx);
  const footer = opts.footer || info.nameChannel || info.nameBot || '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻';

  const caption = opts.caption || formatCard({
    title: opts.title,
    subtitle: opts.subtitle,
    badge: opts.badge,
    body: opts.body,
    fields: opts.fields,
    footer: opts.cardFooter || '',
    tip: opts.tip,
    theme: opts.theme
  });

  const rawButtons = Array.isArray(opts.buttons) ? opts.buttons.filter(Boolean) : [];
  const normalizedButtons = rawButtons.slice(0, 10).map((b) => {
    if (b.name && b.params) return b;
    if (b.copy !== undefined) return makeCopyButton(b.label || '📋 نسخ', b.copy);
    if (b.url) return makeUrlButton(b.label || '🔗 فتح', b.url);
    if (b.sections) return makeSelectButton(b.label || '📜 القائمة', b.sections);
    return makeQuickButton(b.label || b.text || b.id, b.id || b.cmd, prefix);
  });

  if (conn && typeof conn.sendButtonNormal === 'function' && normalizedButtons.length > 0) {
    try {
      const media = opts.media || pickBotMedia(ctx, opts.mediaIndex || 0);
      return await conn.sendButtonNormal(m.chat, {
        media,
        mediaType: opts.mediaType || 'image',
        caption,
        footer,
        buttons: normalizedButtons,
        mentions: opts.mentions || (m?.sender ? [m.sender] : [])
      }, m);
    } catch {
      // Fallback below
    }
  }

  if (conn && typeof conn.sendMessage === 'function') {
    const hints = normalizedButtons
      .filter((b) => b.name === 'quick_reply')
      .map((b) => `▸ ${b.params.display_text}: \`${b.params.id}\``)
      .join('\n');
    const fullText = hints ? `${caption}\n\n${hints}\n\n_${footer}_` : `${caption}\n\n_${footer}_`;
    return await conn.sendMessage(m.chat, { text: fullText }, { quoted: m });
  }

  if (typeof m?.reply === 'function') {
    return await m.reply(caption);
  }
  return null;
}

/**
 * إرسال استطلاع رأي أصلي (Poll) في واتساب
 */
export async function sendInteractivePoll(m, ctx = {}, { name, values = [], selectableCount = 1 } = {}) {
  const conn = ctx?.conn || m?.conn;
  const cleanValues = (Array.isArray(values) ? values : []).map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
  if (!name || cleanValues.length < 2) {
    throw new Error('الاستطلاع يحتاج سؤالاً وخيارين على الأقل');
  }
  if (conn && typeof conn.sendMessage === 'function') {
    try {
      return await conn.sendMessage(m.chat, {
        poll: {
          name: String(name),
          values: cleanValues,
          selectableCount: Math.max(1, Math.min(cleanValues.length, Number(selectableCount) || 1))
        }
      }, { quoted: m });
    } catch {
      // fallback below
    }
  }
  const text = formatCard({
    title: 'استطلاع رأي',
    badge: '📊',
    body: `*${name}*\n\n` + cleanValues.map((v, i) => `${i + 1}. ${v}`).join('\n'),
    theme: 'royal'
  });
  return typeof m?.reply === 'function' ? await m.reply(text) : null;
}

/**
 * إرسال ودجت HTML تفاعلي عبر richResponseMessage (مثل .اوامر2)
 */
export async function sendInteractiveWidget(m, ctx = {}, { title = 'Widget', html = '', fallbackText = '' } = {}) {
  const client = ctx?.sock || ctx?.conn || m?.conn;
  const unifiedResponse = {
    response_id: 'light-widget-' + Date.now().toString(36),
    sections: [
      {
        __typename: 'GenAIUnifiedResponseSection',
        view_model: {
          __typename: 'GenAISingleLayoutViewModel',
          primitive: {
            __typename: 'GenAIBotProgressStatusPrimitive',
            title: String(title || '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻'),
            is_in_progress: true
          }
        }
      }
    ],
    embedded_screens: [
      {
        title: String(title || 'Widget'),
        content: [
          {
            __typename: 'FOAIDNixelButtonSheets',
            tabs: [
              {
                id: 'tab_0',
                tab_header: 'Interactive',
                sections: [
                  {
                    __typename: 'GenAIUnifiedResponseSection',
                    view_model: {
                      __typename: 'GenAISingleLayoutViewModel',
                      primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: String(html || ''),
                        url: 'https://example.com',
                        trusted_sources: ['example.com']
                      }
                    }
                  }
                ],
                step_entries: []
              }
            ]
          }
        ]
      }
    ]
  };

  if (client && typeof client.relayMessage === 'function') {
    try {
      const data = Buffer.from(JSON.stringify(unifiedResponse)).toString('base64');
      const options = {};
      if (typeof client.generateMessageTag === 'function') {
        options.messageId = await client.generateMessageTag();
      }
      return await client.relayMessage(
        m.chat,
        {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: { messageDisclaimerText: '', richResponseSourcesMetadata: {} }
          },
          botForwardedMessage: {
            message: {
              richResponseMessage: {
                messageType: 1,
                unifiedResponse: { data },
                contextInfo: {
                  forwardingScore: 1,
                  isForwarded: true,
                  forwardedAiBotMessageInfo: { botJid: '0@bot' },
                  forwardOrigin: 4
                }
              }
            }
          }
        },
        options
      );
    } catch {
      // fallback below
    }
  }

  return await sendInteractiveCard(m, ctx, {
    title,
    badge: '🧩',
    body: fallbackText || 'تم إنشاء الواجهة التفاعلية بنجاح.',
    buttons: [{ label: '📜 القائمة', id: 'قائمة' }]
  });
}

export default {
  THEMES,
  FALLBACK_PNG,
  progressBar,
  formatCard,
  resolveBotInfo,
  resolvePrefix,
  pickBotMedia,
  makeQuickButton,
  makeCopyButton,
  makeUrlButton,
  makeSelectButton,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget
};
