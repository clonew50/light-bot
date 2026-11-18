/*
  ════════════════════════════════════════════════
  🧠 الترivial — اختبار ثقافي بخيارات أزرار (4 خيارات)
  الأوامر: .ترivia / .asi / .استفسار [تصنيف]
  .ترivia تلميح | .ترivia نقاط | .ترivia إيقاف
  ════════════════════════════════════════════════
*/

import { pruneCooldown } from "../../system/cooldowns.js";

const COOLDOWN_MS = 6000;
const Q_PER_GAME = 10;
const Q_TIME_MS = 45000;
const HINT_MAX = 2;
const OPT = ['a', 'b', 'c', 'd'];
const cooldown = new Map();

const CATS = [
  { key: 'general', label: 'عامة', emoji: '🌍' },
  { key: 'sports', label: 'رياضة', emoji: '⚽' },
  { key: 'science', label: 'علوم', emoji: '🔬' },
  { key: 'history', label: 'تاريخ', emoji: '🏛️' },
  { key: 'geography', label: 'جغرافيا', emoji: '🗺️' },
  { key: 'arts', label: 'فنون', emoji: '🎨' },
];

const Q = {
  general: [
    { q: 'ما هي عاصمة مصر؟', o: ['القاهرة', 'الإسكندرية', 'الجيزة', 'الأقصر'], a: 0, h: 'تبدأ بحرف القاف' },
    { q: 'أكبر قارة في العالم من حيث المساحة؟', o: ['آسيا', 'أفريقيا', 'أوروبا', 'أمريكا الشمالية'], a: 0, h: 'تضم الصين والهند' },
    { q: 'أي كوكب يُعرف بالكوكب الأحمر؟', o: ['المريخ', 'الزهرة', 'المشتري', 'زحل'], a: 0, h: 'لونه أحمر عند المراقبة' },
    { q: 'كم عدد قارات العالم؟', o: ['7', '6', '5', '8'], a: 0, h: 'رقم فردي' },
    { q: 'أصغر دولة في العالم من حيث المساحة؟', o: ['الفاتيكان', 'موناكو', 'النمسا', 'لوكسمبورغ'], a: 0, h: 'تقع داخل روما' },
    { q: 'من عالم الجاذبية المعروف بقصة التفاحة؟', o: ['نيوتن', 'أينشتاين', 'جاليليو', 'تسلا'], a: 0, h: 'عالم إنجليزي' },
  ],
  sports: [
    { q: 'عدد لاعبي فريق كرة القدم في الملعب من كل فريق؟', o: ['11', '10', '12', '9'], a: 0, h: 'يشمل حارس المرمى' },
    { q: 'أي دولة استضافت كأس العالم 2022؟', o: ['قطر', 'البرازيل', 'روسيا', 'ألمانيا'], a: 0, h: 'دولة عربية بالخليج' },
    { q: 'رياضة تُلعب بالمضرب والكرة فوق شبكة؟', o: ['تنس', 'سكواش', 'بادمinton', 'تنس طاولة'], a: 0, h: 'سيدات التنس مثل فيليمنز' },
    { q: 'عدد لاعبي فريق كرة السلة داخل الملعب من كل فريق؟', o: ['5', '6', '7', '4'], a: 0, h: 'أصابع يد واحدة' },
    { q: 'طول ماراثون بالكيلومترات تقريباً؟', o: ['42.195', '40', '45', '38'], a: 0, h: 'أكثر من أربعين كيلو' },
    { q: 'الرياضة التقليدية الوطنية في اليابان؟', o: ['سومو', 'كاراتيه', 'جودو', 'أيكتسو'], a: 0, h: 'مصارعة يابانية تقليدية' },
  ],
  science: [
    { q: 'رمز عنصر الذهب في الجدول الدوري؟', o: ['Au', 'Ag', 'Fe', 'Cu'], a: 0, h: 'من اللاتينية aurum' },
    { q: 'أقرب نجم إلى الأرض؟', o: ['الشمس', 'سيريوس', 'يوريوس', 'بروكسيما'], a: 0, h: 'نهارنا بسببه' },
    { q: 'صيغة الماء الكيميائية؟', o: ['H2O', 'CO2', 'O2', 'NaCl'], a: 0, h: 'أكسجين وهيدروجين' },
    { q: 'أي عضو يضخ الدم في الجسم؟', o: ['القلب', 'الرئة', 'الكبد', 'المخ'], a: 0, h: 'يسمع دققه في الصدر' },
    { q: 'وحدة قياس التيار الكهربائي؟', o: ['أمبير', 'فولت', 'وات', 'أوم'], a: 0, h: 'سميت على عالم فيزياء' },
    { q: 'سرعة الضوء في الفراغ تقريباً؟', o: ['300000 كم/ث', '150000', '500000', '100000'], a: 0, h: 'ثلاثمائة ألف كيلومتر في الثانية' },
  ],
  history: [
    { q: 'من بنى الأهرامات؟', o: ['المصريين القدماء', 'الرومانيين', 'الفينيقيين', 'اليونانيين'], a: 0, h: 'في الجيزة' },
    { q: 'ثورة يوليو في مصر كانت سنة؟', o: ['1952', '1919', '1967', '1973'], a: 0, h: 'نصف القرن العشرين' },
    { q: 'أول رئيس لمصر بعد الثورة؟', o: ['محمد نجيب', 'عبد الناصر', 'السادات', 'مبارك'], a: 0, h: 'رئيس أول لفترة قصيرة' },
    { q: 'حرب أكتوبر كانت سنة؟', o: ['1973', '1967', '1956', '1948'], a: 0, h: 'عيد التحرير السادس' },
    { q: 'موقعة حطين كانت في؟', o: ['فلسطين', 'سوريا', 'العراق', 'مصر'], a: 0, h: 'بجوار طبريا' },
    { q: 'أقدم جامعة في العالم ما زالت تعمل؟', o: ['القرويين', 'الأزهر', 'أكسفورد', 'هارفارد'], a: 0, h: 'في المغرب' },
  ],
  geography: [
    { q: 'أطول نهر في العالم؟', o: ['النيل', 'الأمازون', 'اليانغتسي', 'الميسيسيبي'], a: 0, h: 'يمر بمصر والسودان' },
    { q: 'أكبر صحراء في العالم؟', o: ['الصحراء الكبرى', 'الصحراء العربية', 'غوبي', 'كالاهاري'], a: 0, h: 'في شمال أفريقيا' },
    { q: 'أكبر دولة في العالم من حيث المساحة؟', o: ['روسيا', 'كندا', 'الصين', 'الولايات المتحدة'], a: 0, h: 'تمتد بين قارتي آسيا وأوروبا' },
    { q: 'عاصمة اليابان؟', o: ['طوكيو', 'أوساكا', 'كيوتو', 'هيروشيما'], a: 0, h: 'مدينة كبرى في شرق آسيا' },
    { q: 'أعلى جبل في العالم؟', o: ['إيفرست', 'kilimanjaro', 'كانشيرنجا', 'لوتسي'], a: 0, h: 'في جبال الهيمالايا' },
    { q: 'أكبر محيط في العالم؟', o: ['الهادي', 'الأطلسي', 'الهندي', 'القطبي الشمالي'], a: 0, h: 'بين آسيا وأمريكا' },
  ],
  arts: [
    { q: 'من رسم لوحة الموناليزا؟', o: ['ليوناردو دا فينشي', 'بيكاسو', 'فان غوخ', 'رامبرانت'], a: 0, h: 'إيطالي عصر النهضة' },
    { q: 'أي آلة موسيقية لديها مفاتيح بيضاء وسوداء؟', o: ['بيانو', 'قيثارة', 'طبلة', 'ناي'], a: 0, h: 'أيقاف بمفاتيح' },
    { q: 'مخرج فيلم "color purple"? ', o: ['ستيفن سبيلبرغ', 'كريستوفر نولان', 'كوينتين تارانتينو', 'مارتن سكورسيزي'], a: 0, h: 'مخرج أمريكي شهير' },
    { q: 'مؤلف السيمفونية التاسعة؟', o: ['بيتهوفن', 'موزارت', 'باخ', 'شوبان'], a: 0, h: 'موسيقي ألماني' },
    { q: 'أي لون ينتج من خلط الأزرق والأصفر؟', o: ['أخضر', 'أحمر', 'برتقالي', 'بنفسجي'], a: 0, h: 'لون الطبيعة' },
    { q: 'أي فيروس يسبب مرض كوفيد-19؟', o: ['SARS-CoV-2', 'الإيدز', 'أنفلونزا', 'الإيبولا'], a: 0, h: "فيروس كورونا" },
  ],
};

const ctxInfo = (jid) => ({
  mentionedJid: [jid],
  isForwarded: true,
  forwardingScore: 1,
});

const findCat = (key) => CATS.find((c) => c.key === key) || CATS[0];

const newGame = (chatId, catKey) => ({
  cat: catKey,
  qs: [...Q[catKey]].sort(() => Math.random() - 0.5),
  idx: 0,
  scores: {},
  hints: {},
  active: true,
  timer: null,
});

const endGame = async (m, conn, chatId) => {
  const g = global.gameTrivia[chatId];
  if (!g) return;
  if (g.timer) clearTimeout(g.timer);
  const entries = Object.entries(g.scores).sort((a, b) => b[1] - a[1]);
  let text = `🏁 *انتهت لعبة الترivial*\n📊 عدد الأسئلة: ${Q_PER_GAME}\n`;
  if (entries.length) {
    text += '\n📈 *النقاط:*\n' + entries.map(([jid, s], i) => `  ${i + 1}. @${jid.split('@')[0]} — ${s}`).join('\n');
    const winner = entries[0];
    if (winner && global.db?.users[winner[0]]) {
      global.db.users[winner[0]] = global.db.users[winner[0]] || {};
      global.db.users[winner[0]].xp = (global.db.users[winner[0]].xp || 0) + 500;
      global.db.users[winner[0]].cookies = (global.db.users[winner[0]].cookies || 0) + 10;
      text += `\n\n🏅 الفائز: @${winner[0].split('@')[0]} — +500 XP 🪙 +10 كوكيز 🍪`;
    }
  } else {
    text += '\nلم يسجل أي نقاط.';
  }
  delete global.gameTrivia[chatId];
  await conn.sendMessage(m.chat, { text, mentions: entries.map(([jid]) => jid), contextInfo: ctxInfo(m.sender) }, { quoted: m });
};

const sendCategoryList = async (m, conn) => {
  const rows = CATS.map((c) => ({
    title: `${c.emoji} ${c.label}`,
    description: 'بدء اختبار في هذا التصنيف',
    id: `.ترivia ${c.key}`,
  }));
  rows.push({ title: '🎲 عشوائي', description: 'اختبار من تصنيف عشوائي', id: '.ترivia random' });
  const buttons = [{ name: 'single_select', params: { display_title: '📚 اختر تصنيف%', sections: [{ title: 'التصنيفات', rows }] } }];
  try {
    if (typeof conn.sendButtonNormal === 'function') {
      await conn.sendButtonNormal(m.chat, {
        media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
        mediaType: 'image',
        caption: '🧠 *الترivial — اختر تصنيف لبدء الاختبار:*\nكل اختبار يتكون من ١٠ سؤالاً.',
        buttons,
      }, m);
      return;
    }
  } catch (e) {
    console.error('ترivia list:', e);
  }
  await m.reply('📚 التصنيفات:\n' + CATS.map((c) => `• ${c.emoji} ${c.label}`).join('\n') + '\n\nاستخدم: .ترivia <تصنيف> (مثل: .ترivia عامة)');
};

const sendQuestion = async (m, conn, chatId) => {
  const g = global.gameTrivia[chatId];
  if (!g || !g.active) return;
  if (g.idx >= Q_PER_GAME) {
    await endGame(m, conn, chatId);
    return;
  }
  const q = g.qs[g.idx];
  const hintsLeft = Math.max(0, HINT_MAX - (g.hints[m.sender] || 0));
  const buttons = OPT.map((letter, i) => ({
    name: 'quick_reply',
    params: { display_text: `${letter.toUpperCase()}. ${q.o[i]}`, id: `.ترivia ${letter}` },
  }));
  const caption = `🧠 *سؤال ${g.idx + 1} / ${Q_PER_GAME}*\n📂 ${findCat(g.cat).emoji} ${findCat(g.cat).label}\n\n❓ *${q.q}*\n\nأ. ${q.o[0]}\nب. ${q.o[1]}\nج. ${q.o[2]}\nد. ${q.o[3]}\n\n💡 تلميحات متبقية: ${hintsLeft}\n⏳ الوقت: ٤٥ ثانية\nأغلب بلمس الخيار أو اكتب: .ترivia أ/ب/ج/د`;
  try {
    if (typeof conn.sendButtonNormal === 'function') {
      const msg = await conn.sendButtonNormal(m.chat, {
        media: { url: 'https://i.supaimg.com/374589ce-56ae-4068-ba73-60f3b228637f/0b22c6a0-3522-4e3d-b1b8-120642cb25b2.jpg' },
        mediaType: 'image',
        caption,
        buttons,
      }, m);
      g.timer = setTimeout(async () => {
        if (!global.gameTrivia[chatId]?.active) return;
        clearTimeout(g.timer);
        const ans = q.o[q.a];
        delete global.gameTrivia[chatId];
        await conn.sendMessage(m.chat, { text: `⏰ انتهى الوقت! الإجابة الصحيحة: *${ans}*\nاكتب .ترivia لبدء اختبار جديد.`, contextInfo: ctxInfo(m.sender) }, { quoted: m });
      }, Q_TIME_MS);
      return;
    }
  } catch (e) {
    console.error('ترivia q:', e);
  }
  await m.reply(caption);
};

const handler = async (m, { conn, args, text }) => {
  try {
    const chatId = m.chat;
    const sender = m.sender;
    global.gameTrivia ??= {};
    const sub = (args[0] || '').toLowerCase();

    // Move response during an active game: .ترivia a/b/c/d
    const game = global.gameTrivia[chatId];
    if (game && game.active && OPT.includes(sub)) {
      if (game.timer) clearTimeout(game.timer);
      const q = game.qs[game.idx];
      const correct = sub === OPT[q.a];
      if (!game.scores[sender]) game.scores[sender] = 0;
      if (!game.hints[sender]) game.hints[sender] = 0;
      let resultText = '';
      if (correct) {
        game.scores[sender]++;
        resultText = `✅ @${sender.split('@')[0]} — إجابة صحيحة! (${q.o[q.a]})`;
        await m.react('✅');
      } else {
        resultText = `❌ @${sender.split('@')[0]} — إجابة خاطئة. الصحيحة: *${q.o[q.a]}*`;
        await m.react('❌');
      }
      game.idx++;
      if (game.idx >= Q_PER_GAME || !game.active) {
        await conn.sendMessage(m.chat, { text: resultText, mentions: [sender], contextInfo: ctxInfo(sender) }, { quoted: m });
        await endGame(m, conn, chatId);
        return;
      }
      await conn.sendMessage(m.chat, { text: `${resultText}\n\n⏭ السؤال التالي بعد لحظات...`, mentions: [sender], contextInfo: ctxInfo(sender) }, { quoted: m });
      setTimeout(() => sendQuestion(m, conn, chatId), 1500);
      return;
    }

    // Control sub-commands
    if (sub === 'إيقاف' || sub === 'stop' || sub === 'إنهاء') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة ترivial نشطة في هذه الدردشة.');
      if (game.timer) clearTimeout(game.timer);
      delete global.gameTrivia[chatId];
      await m.reply('🛑 تم إنهاء لعبة الترivial.');
      return;
    }
    if (sub === 'نقاط' || sub === 'scores') {
      if (!game || !game.active || !Object.keys(game.scores).length) return m.reply('📊 لا توجد نقاط مسجلة بعد.');
      const entries = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
      await m.reply('📈 *نقاط الترivial الحالية:*\n' + entries.map(([jid, s], i) => `  ${i + 1}. @${jid.split('@')[0]} — ${s}`).join('\n'), null, { mentions: entries.map(([jid]) => jid) });
      return;
    }
    if (sub === 'تلميح' || sub === 'hint') {
      if (!game || !game.active) return m.reply('❌ لا توجد لعبة نشطة.');
      if (!game.hints[sender]) game.hints[sender] = 0;
      if (game.hints[sender] >= HINT_MAX) return m.reply('❌ نفذت التلميحات المسموحة (٢ لكل لاعب).');
      const q = game.qs[game.idx];
      const wrong = OPT.filter((l, i) => i !== q.a).sort(() => Math.random() - 0.5).slice(0, 2);
      game.hints[sender]++;
      await m.reply(`💡 *تلميح:* الخيارات الخاطئة تشمل: ${wrong.map((l) => q.o[OPT.indexOf(l)]).join(', ')}\nالإجابة الصحيحة ليست من بينها.`, null, { contextInfo: ctxInfo(sender) });
      return;
    }

    // Cooldown for starting a new game / opening the list
    const now = Date.now();
    const last = cooldown.get(chatId) || 0;
    if (now - last < COOLDOWN_MS) {
      const left = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return m.reply(`⏳ يرجى الانتظار ${left} ثانية قبل بدء اختبار جديد.`);
    }
    pruneCooldown(cooldown, COOLDOWN_MS);
    cooldown.set(chatId, now);

    const catKey = sub || 'general';
    if (catKey === 'random' || !CATS.some((c) => c.key === catKey || c.label === sub)) {
      await sendCategoryList(m, conn);
      return;
    }
    // Start directly with chosen category
    global.gameTrivia[chatId] = newGame(chatId, catKey);
    await m.reply(`🎮 بدأ اختبار: ${findCat(catKey).emoji} ${findCat(catKey).label}\n${Q_PER_GAME} سؤال. أرسل إجابتك بأزرار الخيارات أو اكتب .ترivia أ/ب/ج/د`);
    await sendQuestion(m, conn, chatId);
  } catch (e) {
    console.error('❌ [trivia]', e?.message || e);
    await m.reply('❌ حدث خطأ أثناء تشغيل لعبة الترivial.');
  }
};

handler.command = ['ترivia', 'asi', 'استفسار', 'اسئلة'];
handler.usage = ['ترivia', 'ترivia عامة', 'ترivia تلميح', 'ترivia نقاط', 'ترivia إيقاف'];
handler.category = 'games';
handler.usePrefix = true;
handler.cooldown = 6;
handler.group = false;
handler.private = false;
export default handler;
