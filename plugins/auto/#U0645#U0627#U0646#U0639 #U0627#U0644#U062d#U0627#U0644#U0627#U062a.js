// ╔══════════════════════════════════════════════╗
// ║     📸 مانع الحالات — 𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻        ║
// ║  يحذف أي رسالة منقولة من حالة واتساب       ║
// ╚══════════════════════════════════════════════╝

export default async function before(m, { conn, isBotAdmin, isAdmin }) {
    if (!m.isGroup) return false;
    if (m.key?.fromMe) return false;
    if (isAdmin || m.isOwner) return false;

    const chatData = global.db.groups[m.chat] ||= {};
    if (!chatData.statusBlocker) return false;

    // كشف رسائل الحالات المنقولة
    const ctx = m.msg?.contextInfo;
    const isStatusForward =
        // طريقة 1: رسالة منقولة من حالة (forwardingScore موجود)
        (ctx?.isForwarded === true && (ctx?.forwardingScore || 0) >= 1) ||
        // طريقة 2: نوع الرسالة statusMentionMessage
        m.mtype === 'statusMentionMessage' ||
        // طريقة 3: viewOnceMessageV2 من حالة
        (m.mtype === 'viewOnceMessageV2' && ctx?.isForwarded) ||
        // طريقة 4: التحقق من الـ key الأصلي
        (ctx?.stanzaId && ctx?.participant?.includes('status')) ||
        // طريقة 5: رابط تشاركي من حالة
        m.mtype === 'statusReplyMessage';

    if (!isStatusForward) return false;

    const senderNum = (m.sender || '').split('@')[0];

    try {
        if (isBotAdmin) {
            // حذف الرسالة مباشرة
            await conn.sendMessage(m.chat, { delete: m.key }).catch(() => {});

            // تهيئة نظام الإنذارات داخل قاعدة البيانات للعضو
            chatData.warnings ||= {};
            chatData.warnings[m.sender] ||= 0;
            chatData.warnings[m.sender] += 1;
            const currentWarnings = chatData.warnings[m.sender];

            if (currentWarnings >= 3) {
                // تصفير الإنذارات بعد الوصول للحد الأقصى والطرد
                chatData.warnings[m.sender] = 0;

                await conn.sendMessage(m.chat, {
                    text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 🚨 *تم طرد العضو لتجاوز الإنذارات*

 @${senderNum}
 تجاوز الحد الأقصى (3 إنذارات)
 بسبب إرسال رسائل الحالات!

 🛡️ *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                    mentions: [m.sender]
                });

                // تنفيذ الطرد الفعلي
                await conn.groupParticipantsUpdate(m.chat, [m.sender], "remove").catch(() => {});
            } else {
                // إرسال تنبيه بالإنذار الحالي
                await conn.sendMessage(m.chat, {
                    text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 🚫 *مانع الحالات*

 @${senderNum} تم حذف
 رسالتك المنقولة من حالة
 الواتساب مش مسموح هنا!
 ⚠️ إنذارك الحالي: (${currentWarnings}/3)

 🛡️ *𝑳𝑰𝑮𝑯𝑻 ┇🩸┇ 𝑩𝑶𝑻*
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                    mentions: [m.sender]
                });
            }
        } else {
            await conn.sendMessage(m.chat, {
                text:
`❐═━━━═╊⊰🩸⊱╉═━━━═❐
 ⚠️ مانع الحالات مفعّل
 بس محتاج أكون أدمن
 عشان أحذف الرسائل وأعطيه إنذار
❐═━━━═╊⊰🩸⊱╉═━━━═❐`,
                mentions: [m.sender]
            });
        }
        return true;
    } catch (e) {
        console.error('[status_blocker]', e?.message);
        return false;
    }
}
