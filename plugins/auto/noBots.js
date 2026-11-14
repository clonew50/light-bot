export default async function before(m, { conn, bot }) {
    // الجروبات بتاعة المشغّل — مش جروبات المطور. حط جروباتك هنا (أو خلّيها فاضية).
    const groups = [];

    if (bot.isSubBot && groups.includes(m.chat)) {
        return true;
    }

    return false;
}