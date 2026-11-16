/**
 * system/cooldowns.js — حصر خرائط الكولداون في الذاكرة
 * ====================================================
 * البوت شغال 24/7، فأي Map بيتملى بمفاتيح (مستخدم/شات) من غير ما تتنضف
 * بتكبر من غير حد وياكل الرام. الهايلبر ده:
 *   - يمسح المدخلات اللي عدّت مدة الصلاحية (TTL)
 *   - ولو الخريطة لسه أكبر من الحد، يمسح الأقدم فعلاً (حتى لو لسه صالحة)
 *
 * الاستخدام (قيمة كل مدخل = timestamp بالمللي ثانية):
 *   import { pruneCooldown } from '../../system/cooldowns.js';
 *   ...
 *   pruneCooldown(cooldown, COOLDOWN);      // قبل كل كتابة
 *   cooldown.set(m.sender, Date.now());
 */

/** أقصى عدد مدخلات مسموح لكل خريطة كولداون. */
export const MAX_TRACKED = 5000;

/**
 * حصر خريطة كولداون: امسح اللي انتهت صلاحيته، وبعدين اللي فاضل قديم إذا زاد الحد.
 * @param {Map<string, number>} map خريطة المفتاح → timestamp
 * @param {number} ttlMs مدة الصلاحية بالمللي ثانية
 * @param {{ max?: number }} [options] حد أقصى لعدد المدخلات
 * @returns {number} عدد المدخلات اللي اتمسحت
 */
export function pruneCooldown(map, ttlMs, options = {}) {
    if (!(map instanceof Map)) return 0;
    const max = Number.isFinite(options.max) && options.max > 0 ? options.max : MAX_TRACKED;
    const now = Date.now();

    let removed = 0;
    for (const [key, ts] of map) {
        if (!Number.isFinite(ts) || now - ts > ttlMs) {
            map.delete(key);
            removed++;
        }
    }

    if (map.size > max) {
        const oldest = [...map.entries()].sort((a, b) => a[1] - b[1]);
        for (const [key] of oldest.slice(0, map.size - max)) {
            map.delete(key);
            removed++;
        }
    }

    return removed;
}