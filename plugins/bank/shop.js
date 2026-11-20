/*
  ═══════════════════════════════════════════
  🛒 متجر البنك — شراء عناصر، ترقيات، هدايا
  الأمر: .shop / .متجر / .محل
  ═══════════════════════════════════════════
*/

const SHOP_ITEMS = {
  // تعزيزات
  boost_xp: { name: '⚡ معزز XP', desc: 'مضاعف XP 2x لمدة ساعة', price: 5000, type: 'boost', effect: { xpMultiplier: 2, duration: 3600000 }, emoji: '⚡', max: 3 },
  boost_coins: { name: '💰 معزز العملات', desc: 'مضاعف العملات 1.5x لمدة ساعة', price: 8000, type: 'boost', effect: { coinMultiplier: 1.5, duration: 3600000 }, emoji: '💰', max: 3 },
  boost_drop: { name: '🎁 معزز الهدايا', desc: 'فرصة إضافية للهدايا 2x لمدة ساعة', price: 10000, type: 'boost', effect: { dropRate: 2, duration: 3600000 }, emoji: '🎁', max: 2 },

  // عناصر تجميلية
  badge_vip: { name: '👑 شارة VIP', desc: 'شارة مميزة تظهر في البروفايل', price: 50000, type: 'cosmetic', effect: { badge: 'vip' }, emoji: '👑', max: 1 },
  badge_gold: { name: '🥇 شارة ذهبية', desc: 'شارة ذهبية فاخرة', price: 100000, type: 'cosmetic', effect: { badge: 'gold' }, emoji: '🥇', max: 1 },
  badge_diamond: { name: '💎 شارة ماسية', desc: 'أندر شارة في البوت', price: 500000, type: 'cosmetic', effect: { badge: 'diamond' }, emoji: '💎', max: 1 },

  // أدوات
  shield: { name: '🛡️ درع حماية', desc: 'يحمي من سرقة واحدة', price: 15000, type: 'tool', effect: { shield: 1 }, emoji: '🛡️', max: 5, consumable: true },
  magnet: { name: '🧲 مغناطيس العملات', desc: 'يزيد فرصة العثور على عملات 2x لـ 10 استخدامات', price: 12000, type: 'tool', effect: { magnet: 10 }, emoji: '🧲', max: 3, consumable: true },
  lucky_charm: { name: '🍀 تعويذة الحظ', desc: 'يزيد حظ القمار 1.5x لـ 5 استخدامات', price: 20000, type: 'tool', effect: { luck: 5 }, emoji: '🍀', max: 3, consumable: true },

  // هدايا للآخرين
  gift_box: { name: '🎁 صندوق هدية', desc: 'يحتوي على 1000-5000 عملة عشوائية', price: 3000, type: 'gift', effect: { min: 1000, max: 5000 }, emoji: '🎁', max: 10, consumable: true },
  gift_premium: { name: '🎀 هدية مميزة', desc: 'تحتوي على 5000-20000 عملة + عنصر عشوائي', price: 15000, type: 'gift', effect: { min: 5000, max: 20000, item: true }, emoji: '🎀', max: 5, consumable: true },
}

const handler = async (m, { conn, text, args, usedPrefix, sender }) => {
  try {
    const now = Date.now()

    const subCmd = args[0]?.toLowerCase()

    // تهيئة قاعدة البيانات
    if (!global.db) global.db = { users: {} }
    if (!global.db.users[sender]) global.db.users[sender] = { balance: 1000, bank: 0, xp: 0, cookies: 0, inventory: {}, boosts: {} }
    const user = global.db.users[sender]
    if (!user.inventory) user.inventory = {}
    if (!user.boosts) user.boosts = {}

    // عرض المتجر
    if (!subCmd || subCmd === 'عرض' || subCmd === 'list') {
      const category = args[1] || 'all'

      let msg = `🛒 *متجر البنك* (رصيدك: ${user.balance.toLocaleString()} عملة)\\n\\n`

      const categories = {
        boost: '⚡ تعزيزات',
        cosmetic: '👑 تجميلية',
        tool: '🔧 أدوات',
        gift: '🎁 هدايا',
      }

      Object.entries(categories).forEach(([cat, label]) => {
        if (category !== 'all' && category !== cat) return
        const items = Object.entries(SHOP_ITEMS).filter(([, item]) => item.type === cat)
        if (!items.length) return
        msg += `━━━ *${label}* ━━━\\n`
        items.forEach(([id, item]) => {
          const owned = user.inventory[id] || 0
          const canBuy = owned < item.max
          msg += `${item.emoji} *${item.name}* - ${item.price.toLocaleString()} عملة\\n`
          msg += `   ${item.desc}\\n`
          msg += `   📦 ${owned}/${item.max} ${canBuy ? '✅' : '❌ (الحد الأقصى)'}\\n\\n`
        })
      })

      return conn.sendMessage(m.chat, {
        text: msg,
        footer: 'LIGHT BOT • Shop',
        buttons: [
          { name: 'quick_reply', params: { display_text: '⚡ تعزيزات', id: `${usedPrefix}shop عرض boost` } },
          { name: 'quick_reply', params: { display_text: '👑 تجميلية', id: `${usedPrefix}shop عرض cosmetic` } },
          { name: 'quick_reply', params: { display_text: '🔧 أدوات', id: `${usedPrefix}shop عرض tool` } },
          { name: 'quick_reply', params: { display_text: '🎁 هدايا', id: `${usedPrefix}shop عرض gift` } },
          { name: 'quick_reply', params: { display_text: '🎒 مخزني', id: `${usedPrefix}shop مخزن` } }
        ]
      }, { quoted: m })
    }

    // المخزن
    if (subCmd === 'مخزن' || subCmd === 'inventory' || subCmd === 'inv') {
      const items = Object.entries(user.inventory).filter(([, qty]) => qty > 0)
      if (!items.length) return m.reply('🎒 *مخزنك فارغ*\\n\\nاستخدم `.shop` للشراء')
      let msg = `🎒 *مخزنك:*\\n\\n`
      items.forEach(([id, qty]) => {
        const item = SHOP_ITEMS[id]
        if (item) {
          msg += `${item.emoji} *${item.name}* x${qty}\\n`
          if (item.consumable) msg += `   (قابلة للاستخدام)\\n`
        }
      })
      msg += `\\nاستخدم: \`.shop استخدم <اسم> [@مستخدم]\``
      return m.reply(msg)
    }

    // شراء
    if (subCmd === 'اشتر' || subCmd === 'buy' || subCmd === 'شراء') {
      const itemId = args[1]
      const quantity = parseInt(args[2]) || 1

      if (!itemId || !SHOP_ITEMS[itemId]) {
        return m.reply('❌ عنصر غير موجود. استخدم `.shop` لرؤية العناصر المتاحة')
      }

      const item = SHOP_ITEMS[itemId]
      const owned = user.inventory[itemId] || 0

      if (owned >= item.max) return m.reply(`❌ وصلت للحد الأقصى (${item.max})`)
      if (owned + quantity > item.max) return m.reply(`❌ لا يمكنك شراء أكثر من ${item.max - owned}`)

      const totalPrice = item.price * quantity
      if (user.balance < totalPrice) return m.reply(`❌ رصيد غير كافي!\\nتحتاج: ${totalPrice.toLocaleString()}\\nرصيدك: ${user.balance.toLocaleString()}`)


      user.balance -= totalPrice
      user.inventory[itemId] = owned + quantity

      await m.react('🛒')
      return m.reply(
        `🛒 *تم الشراء بنجاح!*\\n\\n` +
        `${item.emoji} *${item.name}* x${quantity}\\n` +
        `💰 السعر: ${totalPrice.toLocaleString()} عملة\\n` +
        `📦 في المخزن: ${user.inventory[itemId]}/${item.max}\\n` +
        `💵 رصيدك الجديد: ${user.balance.toLocaleString()} عملة`
      )
    }

    // استخدام عنصر
    if (subCmd === 'استخدم' || subCmd === 'use') {
      const itemId = args[1]
      const target = m.mentionedJid?.[0] || sender

      if (!itemId || !SHOP_ITEMS[itemId]) return m.reply('❌ عنصر غير موجود')
      if (!user.inventory[itemId] || user.inventory[itemId] <= 0) return m.reply('❌ لا تملك هذا العنصر')

      const item = SHOP_ITEMS[itemId]
      if (!item.consumable && item.type !== 'gift') return m.reply('❌ هذا العنصر غير قابل للاستخدام (تجميلي دائم)')


      // تطبيق التأثير
      let resultMsg = `${item.emoji} *تم استخدام ${item.name}!*\\n`

      if (item.type === 'boost') {
        const boostKey = `boost_${itemId}`
        const duration = item.effect.duration
        user.boosts[boostKey] = { expires: now + duration, ...item.effect }
        resultMsg += `⚡ تم تفعيل التعزيز لمدة ${duration / 3600000} ساعة!`
      } else if (item.type === 'tool') {
        if (item.effect.shield) {
          user.inventory.shield_active = (user.inventory.shield_active || 0) + item.effect.shield
          resultMsg += `🛡️ درع الحماية مفعل! (${user.inventory.shield_active} درع)`
        } else if (item.effect.magnet) {
          user.inventory.magnet_uses = (user.inventory.magnet_uses || 0) + item.effect.magnet
          resultMsg += `🧲 مغناطيس العملات: ${user.inventory.magnet_uses} استخدام متبقي`
        } else if (item.effect.luck) {
          user.inventory.luck_uses = (user.inventory.luck_uses || 0) + item.effect.luck
          resultMsg += `🍀 تعويذة الحظ: ${user.inventory.luck_uses} استخدام متبقي`
        }
      } else if (item.type === 'gift') {
        const amount = Math.floor(Math.random() * (item.effect.max - item.effect.min + 1)) + item.effect.min
        if (!global.db.users[target]) global.db.users[target] = { balance: 1000 }
        global.db.users[target].balance += amount
        resultMsg += `🎁 تم إرسال ${amount.toLocaleString()} عملة لـ @${target.split('@')[0]}!`
        if (item.effect.item && target !== sender) {
          // إعطاء عنصر عشوائي
          const giftItems = Object.keys(SHOP_ITEMS).filter(k => SHOP_ITEMS[k].consumable && SHOP_ITEMS[k].price < 10000)
          if (giftItems.length) {
            const randomItem = giftItems[Math.floor(Math.random() * giftItems.length)]
            if (!global.db.users[target].inventory) global.db.users[target].inventory = {}
            global.db.users[target].inventory[randomItem] = (global.db.users[target].inventory[randomItem] || 0) + 1
            resultMsg += `\\n🎀 هدية إضافية: ${SHOP_ITEMS[randomItem].emoji} ${SHOP_ITEMS[randomItem].name}!`
          }
        }
      }

      // استهلاك العنصر
      user.inventory[itemId]--

      await m.react('✅')
      await m.reply(resultMsg, { mentions: target !== sender ? [target] : [] })
      return
    }

    // هدايا (إرسال هدية لمستخدم)
    if (subCmd === 'اهدِ' || subCmd === 'gift' || subCmd === 'إهداء') {
      const itemId = args[1]
      const target = m.mentionedJid?.[0]

      if (!target) return m.reply('❌ منشن المستخدم: `.shop اهدِ gift_box @user`')
      if (!itemId || !SHOP_ITEMS[itemId]) return m.reply('❌ عنصر غير موجود')
      if (!user.inventory[itemId] || user.inventory[itemId] <= 0) return m.reply('❌ لا تملك هذا العنصر')

      const item = SHOP_ITEMS[itemId]
      if (item.type !== 'gift') return m.reply('❌ هذا العنصر ليس هدية')

      user.inventory[itemId]--

      const amount = Math.floor(Math.random() * (item.effect.max - item.effect.min + 1)) + item.effect.min
      if (!global.db.users[target]) global.db.users[target] = { balance: 1000 }
      global.db.users[target].balance += amount

      const senderName = await conn.getName(sender).catch(() => sender.split('@')[0])
      const targetName = await conn.getName(target).catch(() => target.split('@')[0])

      await m.react('🎁')
      await conn.sendMessage(m.chat, {
        text: `🎁 *تم إهداء ${item.name}!*\\n\\n` +
          `📤 من: ${senderName}\\n` +
          `📥 إلى: ${targetName}\\n` +
          `💰 المحتوى: ${amount.toLocaleString()} عملة\\n` +
          (item.effect.item ? `🎀 + عنصر عشوائي!` : ''),
        mentions: [sender, target],
        contextInfo: { mentionedJid: [sender, target] }
      }, { quoted: m })
      return
    }

    // تعزيزات نشطة
    if (subCmd === 'تعزيزات' || subCmd === 'boosts' || subCmd === 'نشط') {
      const activeBoosts = Object.entries(user.boosts || {}).filter(([, b]) => b.expires > now)
      if (!activeBoosts.length) return m.reply('⚡ *لا توجد تعزيزات نشطة*')
      let msg = `⚡ *التعزيزات النشطة:*\\n\\n`
      activeBoosts.forEach(([id, b]) => {
        const timeLeft = Math.ceil((b.expires - now) / 60000)
        msg += `• ${id.replace('boost_', '')}: ${timeLeft} دقيقة متبقية\\n`
      })
      return m.reply(msg)
    }

  } catch (e) {
    console.error('shop:', e?.message || e)
    await m.react('❌')
    m.reply('❌ خطأ')
  }
}

handler.command = ['shop', 'متجر', 'محل', 'store']
handler.usage = ['shop', 'shop عرض [boost|cosmetic|tool|gift]', 'shop مخزن', 'shop اشتر <عنصر> [كمية]', 'shop استخدم <عنصر> [@مستخدم]', 'shop اهدِ <عنصر> @مستخدم', 'shop تعزيزات']
handler.category = 'bank'
export default handler