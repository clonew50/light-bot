// ─── system/buttonFix.js ───
// Fixes WhatsApp interactive buttons rendering (nativeFlowMessage + biz interactive stanza node)
// and fixes interactive button/list response ID extraction so clicked buttons trigger commands reliably.

import { generateWAMessageFromContent, downloadMediaMessage } from '@whiskeysockets/baileys';

const SHIMMED = Symbol('light_button_shim_installed');
const SUPPORTED_FLOW_NAMES = new Set([
  'quick_reply',
  'cta_url',
  'cta_call',
  'cta_copy',
  'single_select',
  'call_permission_request'
]);

const BIZ_INTERACTIVE_NODES = [
  {
    tag: 'biz',
    attrs: {},
    content: [
      {
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
      }
    ]
  }
];

function extractRawMessageContainers(m) {
  const out = [];
  if (m?.message && typeof m.message === 'object') out.push(m.message);
  if (m?.msg && typeof m.msg === 'object') {
    out.push(m.msg);
    if (m.msg.message && typeof m.msg.message === 'object') out.push(m.msg.message);
  }
  return out;
}

export function extractInteractiveButtonId(m, ctx) {
  if (!m || typeof m !== 'object') return null;
  for (const container of extractRawMessageContainers(m)) {
    // 1) Native Flow interactiveResponseMessage (quick_reply, single_select)
    const interactive = container.interactiveResponseMessage || (container.nativeFlowResponseMessage ? container : null);
    if (interactive?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson);
        const chosen = parsed?.id || parsed?.selectedRowId || parsed?.displayText;
        if (typeof chosen === 'string' && chosen.trim()) {
          m.body = chosen.trim();
          try { m.text = chosen.trim(); } catch {}
          if (ctx && typeof ctx === 'object') ctx.text = chosen.trim();
          return chosen.trim();
        }
      } catch {}
    }

    // 2) Legacy buttonsResponseMessage
    if (container.buttonsResponseMessage?.selectedButtonId) {
      const chosen = String(container.buttonsResponseMessage.selectedButtonId).trim();
      if (chosen) {
        m.body = chosen;
        try { m.text = chosen; } catch {}
        if (ctx && typeof ctx === 'object') ctx.text = chosen;
        return chosen;
      }
    }

    // 3) listResponseMessage
    if (container.listResponseMessage?.singleSelectReply?.selectedRowId) {
      const chosen = String(container.listResponseMessage.singleSelectReply.selectedRowId).trim();
      if (chosen) {
        m.body = chosen;
        try { m.text = chosen; } catch {}
        if (ctx && typeof ctx === 'object') ctx.text = chosen;
        return chosen;
      }
    }

    // 4) templateButtonReplyMessage
    if (container.templateButtonReplyMessage?.selectedId) {
      const chosen = String(container.templateButtonReplyMessage.selectedId).trim();
      if (chosen) {
        m.body = chosen;
        try { m.text = chosen; } catch {}
        if (ctx && typeof ctx === 'object') ctx.text = chosen;
        return chosen;
      }
    }
  }
  return null;
}

export function normalizeButtons(buttons) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  const out = [];
  for (const b of buttons) {
    if (!b || typeof b !== 'object') continue;
    if (b.name && SUPPORTED_FLOW_NAMES.has(b.name)) {
      out.push({
        name: b.name,
        params: b.params && typeof b.params === 'object' ? b.params : {}
      });
      continue;
    }
    if (b.name && !SUPPORTED_FLOW_NAMES.has(b.name)) {
      return null; // Custom native flow types (e.g. request_contact_info) pass through untouched
    }
    const id = b.buttonId || b.id || b.cmd;
    const text = b.buttonText?.displayText || b.display_text || b.displayText || b.label || b.text || id;
    if (id) {
      out.push({
        name: 'quick_reply',
        params: {
          display_text: String(text || id).slice(0, 40),
          id: String(id)
        }
      });
    }
  }
  return out.length > 0 ? out : null;
}

export function installInteractiveButtonShim(sock) {
  if (!sock || typeof sock.sendMessage !== 'function') return sock;
  if (sock[SHIMMED]) return sock;

  if (typeof sock.downloadMediaMessage !== 'function') {
    sock.downloadMediaMessage = async function shimmedDownloadMediaMessage(message, type = 'buffer', options = {}, ctx = {}) {
      return downloadMediaMessage(message, type, options, {
        logger: console,
        reuploadRequest: sock.updateMediaMessage,
        ...ctx
      });
    };
  }

  const origSendMessage = sock.sendMessage.bind(sock);

  sock.sendMessage = async function shimmedSendMessage(jid, content, opts = {}) {
    if (content && Array.isArray(content.buttons) && content.buttons.length > 0 && !content.interactiveMessage) {
      const normalized = normalizeButtons(content.buttons);
      if (normalized) {
        const caption = String(content.text || content.caption || '');
        const footer = String(content.footer || '𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻');
        const mentions = content.mentions || content.contextInfo?.mentionedJid || [];

        // If media is explicitly included and sendButtonNormal exists, use sendButtonNormal
        if ((content.image || content.video) && typeof sock.sendButtonNormal === 'function') {
          try {
            return await sock.sendButtonNormal(
              jid,
              {
                media: content.image || content.video,
                mediaType: content.video ? 'video' : 'image',
                caption,
                footer,
                buttons: normalized,
                mentions
              },
              opts?.quoted
            );
          } catch {}
        }

        // Otherwise build a clean text-header interactiveMessage + biz/native_flow stanza node
        if (typeof sock.relayMessage === 'function') {
          try {
            const flowButtons = normalized.map((b) => ({
              name: b.name,
              buttonParamsJson: JSON.stringify(b.params || {})
            }));
            const interactiveMessage = {
              body: { text: caption },
              footer: { text: footer },
              header: {
                title: String(content.title || ''),
                hasMediaAttachment: false
              },
              contextInfo: {
                ...(content.contextInfo || {}),
                ...(mentions.length ? { mentionedJid: mentions } : {})
              },
              nativeFlowMessage: {
                buttons: flowButtons
              }
            };
            const userJid = sock.authState?.creds?.me?.id || sock.user?.id;
            const waMsg = generateWAMessageFromContent(
              jid,
              {
                viewOnceMessage: {
                  message: {
                    messageContextInfo: {
                      deviceListMetadata: {},
                      deviceListMetadataVersion: 2
                    },
                    interactiveMessage
                  }
                }
              },
              { userJid, quoted: opts?.quoted }
            );
            await sock.relayMessage(jid, waMsg.message, {
              messageId: waMsg.key.id,
              additionalNodes: BIZ_INTERACTIVE_NODES
            });
            return waMsg;
          } catch {
            // Fall back cleanly below
          }
        }
      }
    }
    return origSendMessage(jid, content, opts);
  };

  sock[SHIMMED] = true;
  return sock;
}

export default {
  extractInteractiveButtonId,
  normalizeButtons,
  installInteractiveButtonShim
};
