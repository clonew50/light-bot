// ─── plugins/native/experimental.js ───
// Experimental protocol set (todo 21).
//   .تجربة  -> ONE gated `call_permission_request` native button.
//
// ── Deliberate omissions (documented, not forgotten) ────────────────────────
// The upstream fork ships two surfaces this framework REJECTS:
//
//   1. `cta_pix_code_copy` — the Pix-copy button. That name is NOT in the
//      framework's own button enum. meowsab (`node_modules/meowsab/dist/index.cjs`,
//      enum `Ue`) accepts exactly: quick_reply, cta_url, cta_call, cta_copy,
//      single_select, call_permission_request. Shipping `cta_pix_code_copy`
//      would need a hand-built relay that bypasses the enum — out of scope and
//      explicitly rejected, so the button is NOT implemented.
//
//   2. `payment_info` — the fork's payment note. That label is invalid too, and
//      the note itself carries a foreign `transactionData` blob plus a
//      third-party bank account. No foreign key or account is ever embedded
//      here, so the note is NOT implemented.
//
// What IS shipped is the one experimental surface the schema accepts: a
// `call_permission_request` button. It is OFF by default and only appears when
// the operator sets `EXPERIMENTAL_PROTOCOLS=1`; otherwise the plugin replies in
// Arabic and sends nothing at all. This mirrors the guarded-env-knob technique
// used by the shield block in `index.js`.

import { infoOf, resolvePrefix, resolveImages, mediaFor, say, nonEmpty } from './_native.js';

/** The framework's button enum is the contract; never ship anything else. */
const ALLOWED_NAMES = new Set([
  'quick_reply',
  'cta_url',
  'cta_call',
  'cta_copy',
  'single_select',
  'call_permission_request'
]);

const isOn = () => process.env.EXPERIMENTAL_PROTOCOLS === '1';

const handler = async (m, ctx = {}) => {
  try {
    const { conn } = ctx;

    // Gate 1: experimental surfaces are never on by default.
    if (!isOn()) {
      return say(m, '🧪 البروتوكولات التجريبية غير مفعّلة. فعّلها بضبط EXPERIMENTAL_PROTOCOLS=1 ثم أعد التشغيل.');
    }

    // Gate 2: the interactive transport must exist on this connection.
    if (!conn?.sendButtonNormal) {
      return say(m, '❌ خدمة الأزرار التفاعلية غير متاحة في هذا الاتصال.');
    }

    const info = infoOf(ctx);
    const prefix = resolvePrefix(ctx, info);
    const images = resolveImages(info);
    const name = nonEmpty(info?.nameBot, 'البوت');

    // ONE experimental button. `call_permission_request` carries the bot's own
    // callback id; no external account, key or phone number is embedded.
    const button = {
      name: 'call_permission_request',
      params: {
        display_text: '🧪 طلب إذن تجريبي',
        id: `${prefix}تجربة_إذن`
      }
    };

    // Defensive: the framework enum is the contract.
    if (!ALLOWED_NAMES.has(button.name)) throw new Error(`زر غير مدعوم: ${button.name}`);

    await conn.sendButtonNormal(m.chat, {
      media: mediaFor(images, 0),
      mediaType: 'image',
      caption: `${name}\n\n🧪 البروتوكولات التجريبية مفعّلة.\nهذا الزر يخصّ بروتوكول طلب الإذن التجريبي فقط.`,
      footer: nonEmpty(info?.nameChannel || name, ''),
      buttons: [button]
    }, m);
    return undefined;
  } catch (error) {
    console.error('[native/experimental]', error);
    await say(m, `❌ حدث خطأ أثناء بناء الزر التجريبي: ${(error && error.message) || error}`);
    return undefined;
  }
};

handler.usage = ['تجربة'];
handler.command = ['تجربة'];
handler.category = 'native';

export default handler;