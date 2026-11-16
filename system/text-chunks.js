/**
 * system/text-chunks.js — حدود نصوص الواتساب ومساعدات القطع
 * =========================================================
 * واتساب بيرفض (أو بيقطع) أي رسالة نصية أطول من 4096 حرف، وكابشن
 * الصور محدود بـ 1024. الملف ده بيوفّر ثوابت الحدود ودوال القطع
 * عشان أي بلجن بيبعت نص طويل يقسمه أو يقصّه بأمان بدل ما الرسالة
 * تضيع.
 */

/** حد نص الرسالة العادية في واتساب. */
export const MAX_TEXT = 4096;

/** حد كابشن الوسائط (صور/فيديو) في واتساب. */
export const MAX_CAPTION = 1024;

/** حد آمن لعدد المنشنات في الرسالة الواحدة. */
export const MAX_MENTIONS = 100;

/** ملاحظة القطع بالعربي (بتتقول للمستخدم إن النص اتقطع وليه). */
export const CUT_NOTE = '\n\n> ✂️ *تم قطع الرسالة* لأنها تجاوزت حد الواتساب.';

/**
 * تقسيم نص لرسائل متعددة، كل رسالة ≤ limit، مع الحفاظ على حدود الأسطر.
 * الأسطر الأطول من الحد بتتقطع قسراً (سطر ملحق بـ "…" ة استكماله).
 * @param {string} text
 * @param {number} [limit]
 * @returns {string[]} أجزاء غير فارغة
 */
export function splitText(text, limit = MAX_TEXT) {
    const src = String(text ?? '');
    if (!src.trim()) return [];
    const chunks = [];
    let current = '';

    const flush = () => {
        if (current.trim()) chunks.push(current.trimEnd());
        current = '';
    };

    for (const line of src.split('\n')) {
        let rest = line;
        // سطر واحد أطول من الحد: نقطّعه قسراً لقطع مستقلة.
        while (rest.length > limit) {
            if (current) flush();
            chunks.push(rest.slice(0, limit));
            rest = '…' + rest.slice(limit);
        }
        const candidate = current ? `${current}\n${rest}` : rest;
        if (candidate.length > limit) {
            flush();          // اطبع اللي اتجمع وابدأ جزء جديد من السطر الحالي
            current = rest;
        } else {
            current = candidate;
        }
    }
    flush();
    return chunks;
}

/**
 * تقصير نص ليتناسب مع الحد مع ملاحظة قطع صريحة (بدل ما المعنى يبوظ).
 * @param {string} text
 * @param {number} [limit]
 * @returns {string}
 */
export function fitText(text, limit = MAX_TEXT) {
    const src = String(text ?? '');
    if (src.length <= limit) return src;
    const room = Math.max(0, limit - CUT_NOTE.length);
    return src.slice(0, room).trimEnd() + CUT_NOTE;
}

/**
 * استخراج أرقام المنشن (`@<رقم>`) الموجودة في جزء نصي والبحث عنها
 * ضمن قائمة المشاركين — عشان كل جزء يبعت معاه منشنات هو بس.
 * @param {string} chunk
 * @param {string[]} ids كل معرّفات المجموعة
 * @returns {string[]}
 */
export function mentionsIn(chunk, ids) {
    const tokens = new Set();
    for (const match of String(chunk ?? '').matchAll(/@([\d-]+)/g)) tokens.add(match[1]);
    if (tokens.size === 0) return [];
    return ids.filter((id) => tokens.has(String(id).split('@')[0])).slice(0, MAX_MENTIONS);
}