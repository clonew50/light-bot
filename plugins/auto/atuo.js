export default async function before(m, { conn, bot }) {
    const g = global.db?.groups[m.chat];
    const u = global.db?.users[m.sender];
    
    if (u?.banned && !m.isOwner) return true;
    
    if (g?.adminOnly && !m.isOwner && !m.isAdmin) return true;
    
    // التحقق مما إذا كان البوت الحالي هو البوت الأساسي وليس بوتاً فرعياً
    // إذا كان jid البوت الحالي يساوي الرقم الرئيسي للبوت، يتم تطبيق قفل الخاص
    const isMainBot = conn.user.jid === global.conn?.user?.jid || !conn.isSubBot; 

    if (global.db?.dev && isMainBot && !m.isOwner && !m.isGroup) {
        return true; // قفل الخاص يعمل فقط على البوت الأساسي
    }
    
    if (global.db?.ownerOnly && !m.isOwner) return true;
    
    return false;
};
