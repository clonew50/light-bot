/**
 * system/warnings.js — عدّاد الإنذارات الموحّد
 * ==========================================================================
 * قبل كده كان فيه 3 عدّادات منفصلة على نفس المعنى:
 *   - plugins/admins/warning.js:14-21       (groups[chat].warnings[phoneNumber])
 *   - plugins/auto/anti-badword.js:76-78   (groups[chat].warnings[sender])
 *   - plugins/auto/مانع الحالات.js:38-40   (groups[chat].warnings[sender])
 * كل واحد كان بيكتب/يقرا من مفتاح مختلف، فالإنذارات ما بتتجمعش والطرد
 * ما بيحصلش في وقته. الحل: دالة واحدة بتكتب في
 *   global.db.groups[chat].warnings[user]   (user = معرّف واتساب: @lid / @s.whatsapp.net)
 * وبتعملة حفظ فعلي على القرص (إسناد الكائن كامل بيشغّل set trap بتاع السجل).
 *
 * الأرقام (مش كائنات) عشان plugins/warnings.js و warning_delete.js و profile.js
 * يفضلوا يقرّوها بنفس الشكل القديم.
 */

export const WARNING_LIMIT = 3;

/** هل فيه رسالة/مستخدم أصلاً؟ */
function validKey(v) {
    return typeof v === 'string' && v.length > 0;
}

function box(db, chat) {
    if (!db || !db.groups) return null;
    const rec = db.groups[chat];
    return rec && typeof rec === 'object' ? rec : null;
}

/**
 * عدد الإنذارات الحالي لمستخدم في شات.
 * @param {string} chat  معرّف الجروب
 * @param {string} user  معرّف المستخدم (@lid / @s.whatsapp.net)
 * @returns {number}
 */
export function getWarnings(chat, user) {
    if (!validKey(chat) || !validKey(user)) return 0;
    const rec = box(global.db, chat);
    const map = rec?.warnings;
    if (!map || typeof map !== 'object') return 0;
    return Number(map[user]) || 0;
}

/**
 * إضافة إنذار. الإسناد الكامل للكائن هو اللي بيعمل الحفظ (set trap بتاع السجل)،
 * فمفيش كتابة متزامنة على كل رسالة ومفيش إنذار بيتوه في الذاكرة.
 * @returns {number} العدد بعد الإضافة
 */
export function addWarning(chat, user, { by = null, reason = null } = {}) {
    if (!validKey(chat) || !validKey(user)) return 0;
    const rec = box(global.db, chat);
    if (!rec) return 0;
    const map = { ...(rec.warnings && typeof rec.warnings === 'object' ? rec.warnings : {}) };
    const next = (Number(map[user]) || 0) + 1;
    map[user] = next;
    rec.warnings = map;
    if (by) {
        try { rec.lastWarning = { at: new Date().toISOString(), by, user, reason, count: next }; } catch { /* تجاهل */ }
    }
    return next;
}

/** إنذار ناقص (أمر حذف إنذار). */
export function removeWarning(chat, user) {
    if (!validKey(chat) || !validKey(user)) return 0;
    const rec = box(global.db, chat);
    if (!rec) return 0;
    const map = { ...(rec.warnings && typeof rec.warnings === 'object' ? rec.warnings : {}) };
    const current = Number(map[user]) || 0;
    if (current <= 0) return 0;
    if (current - 1 <= 0) delete map[user];
    else map[user] = current - 1;
    rec.warnings = map;
    return current - 1 > 0 ? current - 1 : 0;
}

/** تصفير إنذارات مستخدم (بعد الطرد). */
export function resetWarnings(chat, user) {
    if (!validKey(chat) || !validKey(user)) return;
    const rec = box(global.db, chat);
    if (!rec) return;
    const map = { ...(rec.warnings && typeof rec.warnings === 'object' ? rec.warnings : {}) };
    if (!(user in map)) return;
    delete map[user];
    rec.warnings = map;
}