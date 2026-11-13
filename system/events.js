/*
  ═══════════════════════════════════════════
  📡 ناقل أحداث التشغيل (Runtime Event Bus)
  ───────────────────────────────────────────
  اللوحة كانت بتعرض الأخطاء بس (client.errors()) ومفيش أي أثر لأحداث
  التشغيل المهمة: استثناء غير متوقع، رفض وعد، حارس الاتصال، حرس الذاكرة،
  التحديث التلقائي، مُصلح الجلسة، حارس الإقلاع، استرجاع الجلسة، والشيلد.
  كل واحدة من دول كانت بتتسجّل في اللوج بس — اللي مش قدام عين المستخدم.

  هنا مخزن صغير في الذاكرة: كل حدث ليه:
    • ts   — وقت الإضافة (ms)
    • kind — نوع الحدث (panel | boot | watchdog | memory | update | healer | ...)
    • text — نص عربي قصير
    • line — سطر جاهز للعرض في اللوحة

  قاعدتين ثابتتين:
    1) الأحدث أولًا (unshift) — والحد الأقصى 100 حدث (بنقص الأقدم).
    2) أي ناشر حدث ما يقدرش يرمي استثناء للكود اللي استدعاه: pushEvent
       بيلتقط أي خطأ ويرجّع null.

  ملاحظة: اللوحة (system/webPanel.js) بتمرّ من هنا كمان، فكل رسائلها
  (طلب ريستارت، حالة الاتصال، QR...) بتظهر في نفس القائمة.
  ═══════════════════════════════════════════
*/

/** أقصى عدد أحداث بنحتفظ بيها في الذاكرة */
export const EVENT_LIMIT = 100;

/** newest-first */
const events = [];

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('ar-EG');
  } catch {
    return String(ts);
  }
}

/**
 * يضيف حدث للوحة. الآمن للتseyر: لا يرمي أبدًا.
 * @param {string} kind  نوع الحدث (glyph قصير)
 * @param {string} message  نص عربي قصير
 * @returns {{ts:number,kind:string,text:string,line:string}|null}
 */
export function pushEvent(kind, message) {
  try {
    let k = 'event';
    let text = '';
    if (typeof kind === 'string' && typeof message === 'string') {
      k = kind || 'event';
      text = message;
    } else {
      // استدعاء قديم بوسيط واحد: pushEvent('نص')
      text = String(kind ?? '');
      k = 'event';
    }
    const ts = Date.now();
    const entry = { ts, kind: k, text, line: `[${formatTime(ts)}] ${text}` };
    events.unshift(entry);
    if (events.length > EVENT_LIMIT) events.length = EVENT_LIMIT;
    return entry;
  } catch {
    return null;
  }
}

/**
 * أحدث الأحداث أولًا.
 * @param {number} [limit=EVENT_LIMIT]
 */
export function getEvents(limit = EVENT_LIMIT) {
  try {
    const n = Number(limit);
    const cap = Number.isFinite(n) && n >= 0 ? Math.floor(n) : EVENT_LIMIT;
    return events.slice(0, cap);
  } catch {
    return [];
  }
}

/** للاختبارات فقط: تفريغ المخزن */
export function clearEvents() {
  events.length = 0;
}