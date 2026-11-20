/**
 * plugins/packs/mega_creator_prompt_pack.js — استوديو صنّاع المحتوى والبرومبتات (9,000 أمر متميز)
 * - 3,000 مولّد برومبت فني وهندسي للذكاء الاصطناعي (30 أسلوب بصري × 100 موضوع)
 * - 3,000 صانع هوكات ومقدمات ريلز وتيك توك ويوتيوب (30 مجال × 100 زاوية)
 * - 3,000 خطة محتوى وكابشن وهاشتاجات تفاعلية (30 موضوع × 100 قالب)
 */
import { makeCmd, getCmdKey, getInputText, replyCard } from '../../system/megaPackHelper.js';

const CAT = 'creator';
const ART_STYLES = [
  'سينمائي 8K', 'سايبربانك نيون', 'أنمي ياباني', 'بورتريه استوديو', 'ثلاثي الأبعاد Pixar',
  'رسم زيتي كلاسيكي', 'ألوان مائية', 'إيزومتريك مصغر', 'خريطة معمارية', 'لوحة خط عربي',
  'خيال علمي فضائي', 'أبيض وأسود درامي', 'رترو الثمانينات', 'ماكرو فائق الدقة', 'بكسل آرت',
  'زجاجي شفاف', 'ذهبي ملكي', 'أوريغامي ورقي', 'نحت رخامي', 'تصميم بوستر حديث',
  'نيو بروتالي', 'فانتازيا سحرية', 'إضاءة نيون', 'طراز غيبلي', 'فيكتور مسطح',
  'تصوير جوي درون', 'أزياء راقية', 'ألعاب Unreal 5', 'ملصق تفاعلي', 'تغليف منتج فاخر'
];
const NICHES = [
  'التقنية', 'البرمجة', 'الذكاء الاصطناعي', 'التجارة', 'اللياقة', 'التغذية', 'الطبخ', 'السفر', 'التعليم', 'التاريخ',
  'علم النفس', 'التطوير الذاتي', 'السيارات', 'الألعاب', 'التصوير', 'المونتاج', 'التصميم', 'اللغات', 'الكتب', 'المال',
  'العقار', 'الصحة', 'الفلك', 'العلوم', 'الحياة اليومية', 'المشاريع', 'التسويق', 'الإنتاجية', 'الأمن الرقمي', 'القصص'
];

async function execute(m, ctx) {
  const cmd = getCmdKey(m, ctx);
  const customTopic = getInputText(ctx);

  if (cmd.startsWith('برومبت_فن_')) {
    const [, sStr, tStr] = cmd.match(/^برومبت_فن_(\d+)_موضوع_(\d+)$/) || [];
    const s = parseInt(sStr, 10);
    const t = parseInt(tStr, 10);
    const style = ART_STYLES[(s - 1) % ART_STYLES.length];
    const focus = customTopic || `${NICHES[(t - 1) % NICHES.length]} (مشهد #${t})`;
    return replyCard(m, ctx, '🖼️', `برومبت AI جاهز — أسلوب ${style}`, [
      `🎨 *الوصف الإنجليزي للذكاء الاصطناعي:*`,
      `\`Ultra detailed ${focus}, style #${s} (${style}), volumetric lighting, sharp focus, balanced composition, 8k resolution\``,
      `💡 جرّب توليدها مباشرة بـ \`.تخيل\``
    ]);
  }

  if (cmd.startsWith('هوك_ريلز_')) {
    const [, nStr, vStr] = cmd.match(/^هوك_ريلز_(\d+)_رقم_(\d+)$/) || [];
    const n = parseInt(nStr, 10);
    const v = parseInt(vStr, 10);
    const niche = customTopic || NICHES[(n - 1) % NICHES.length];
    const openers = [
      `أغلب الناس يغلطون في ${niche} بسبب تفصيلة واحدة (الطريقة #${v})!`,
      `لو بدأت في ${niche} من الصفر اليوم، هذه أول خطوة أعملها (#${v}):`,
      `خلال 30 ثانية بتعرف السر رقم ${v} اللي اختصر علينا شهور في ${niche}:`,
      `توقف عن إضاعة وقتك في ${niche} وجرب أسلوب #${v} فوراً!`
    ];
    return replyCard(m, ctx, '🎬', `هوك فيديو في مجال ${niche} (#${v})`, [
      `🎙️ *الافتتاحية المقترحة (أول 3 ثوانٍ):*`,
      `"${openers[(n + v) % openers.length]}"`,
      `🏷️ #${niche.replace(/\s+/g, '_')} #محتوى #لايت_بوت`
    ]);
  }

  if (cmd.startsWith('خطة_محتوى_')) {
    const [, tStr, kStr] = cmd.match(/^خطة_محتوى_(\d+)_قالب_(\d+)$/) || [];
    const t = parseInt(tStr, 10);
    const k = parseInt(kStr, 10);
    const topic = customTopic || NICHES[(t - 1) % NICHES.length];
    return replyCard(m, ctx, '📅', `مخطط منشور ${topic} — قالب #${k}`, [
      `1️⃣ *العنوان الجاذب:* 5 قواعد ذهبية في ${topic} (نموذج ${k})`,
      `2️⃣ *القيمة العملية:* شرح مثال تطبيقي من خطوتين + مقارنة قبل/بعد`,
      `3️⃣ *دعوة التفاعل (CTA):* اسأل المتابعين عن تجربتهم في التعليقات`
    ]);
  }
}

const cmds = [];
for (let s = 1; s <= 30; s++) {
  for (let t = 1; t <= 100; t++) {
    cmds.push(makeCmd(`برومبت_فن_${s}_موضوع_${t}`, `برومبت ذكاء اصطناعي بأسلوب ${ART_STYLES[s - 1]} وموضوع ${t}`, CAT, execute, '[موضوعك]'));
  }
}
for (let n = 1; n <= 30; n++) {
  for (let v = 1; v <= 100; v++) {
    cmds.push(makeCmd(`هوك_ريلز_${n}_رقم_${v}`, `مقدمة فيديو جذابة لمجال ${NICHES[n - 1]} رقم ${v}`, CAT, execute, '[موضوعك]'));
  }
}
for (let t = 1; t <= 30; t++) {
  for (let k = 1; k <= 100; k++) {
    cmds.push(makeCmd(`خطة_محتوى_${t}_قالب_${k}`, `هيكل منشور احترافي لمجال ${NICHES[t - 1]} قالب ${k}`, CAT, execute, '[موضوعك]'));
  }
}

export default cmds;
