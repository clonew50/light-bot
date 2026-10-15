export default async function before(m, { conn, bot }) {
    const groups = [
        "12468323841-1619736833@g.us",
        "12468323841-1619736833@g.us"
    ]; /* حط الجروبات الي عايز البوتات الفرعي متشتغلش فيها */

    if (bot.isSubBot && groups.includes(m.chat)) {
        return true;
    }

    return false;
}