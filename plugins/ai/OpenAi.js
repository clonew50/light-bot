/*
  ═══════════════════════════════════════════════════════════════════════
  🤖 plugins/ai/OpenAi.js — مزود الذكاء الاصطناعي (سلسلة مزودين مجانية)
  ═══════════════════════════════════════════════════════════════════════
  المشكلة: الكود القديم كان بيستدعي مزود ميت (اللي كان عنوانه في إعدادات البوت)
  وده بيرد HTTP 402 ("DEPLOYMENT_DISABLED") على كل طلب، فالأمر .اوبن كان مكسور بالكامل.

  السلسلة الجديدة (كل مزود بيتبعت لحد ما واحد يرد بإجابة سليمة):
    1) المزود المخصص للمشغّل  → AI_API_URL (+ AI_API_KEY)
    2) Pollinations النصي المجاني → https://text.pollinations.ai/<السؤال>
       (مجاني، بدون مفتاح، وهو الافتراضي)

  إعدادات البيئة:
    AI_API_URL       — عنوان المزود المخصص (base). لو بيخلص بـ /chat/completions
                       بيبعت POST بصيغة OpenAI، غير كده GET على <base>/<السؤال>
    AI_API_KEY       — المفتاح (يبعت كـ Authorization: Bearer <key>) للمزود اللي
                       حددته في AI_API_URL بس — المزود المجاني بيفضل بدون مفتاح
    AI_API_MODEL     — اسم الموديل (افتراضي: openai)
    AI_API_TIMEOUT   — مهلة الطلب بالمللي ثانية (افتراضي: 45000)
    AI_API_FALLBACK  — =0 يمنع الرجوع للمزود المجاني لو المزود المخصص فشل

  الضمانات:
    • كل طلب ليه مهلة (timeout) — البوت مش هيعلّق أبدًا
    • كولداون لكل مستخدم — يمنع السبام
    • أي فشل بيرد بالعربي برسالة واضحة — مفيش رد فاضي ولا كراش
    • أي رد من المزود بيتمرّ على فحص " plausibility " قبل ما يوصل للمستخدم:
        - الجسم الفاضي أو صفحة HTML من أول حرف أو ظرف خطأ (JSON/HTTP) — مرفوض
        - العلامة الميتة (DEPLOYMENT_DISABLED / PAYMENT_REQUIRED /
          INSUFFICIENT_QUOTA / QUOTA_EXCEEDED) بالتطابق الكامل أو كـ substring
          في النص الأصلي — مرفوضة
        - إجابة بتشرح مثلاً "HTTP 402 Payment Required" بتتبعت عادي — الفحص
          على النص الأصلي من غير ما نشيل حروف، والعبارات بفواصل مبتنرفضش
        - حرف واحد مش فاضي يكفي ("42" إجابة صحيحة)
      والرد المرفوض بيفعّل المزود اللي بعده في السلسلة؛ ولو كلهم فشلوا
      المستخدم بياخد رسالة "المزود غير متاح" بالعربي — جسم الرد الخام مايتوصلش له.
  ═══════════════════════════════════════════════════════════════════════
*/

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const DEFAULT_API_BASE = "https://text.pollinations.ai";
export const DEFAULT_TIMEOUT_MS = 45000;
export const MAX_PROMPT = 1000;
export const AI_ERROR = "تعذر الوصول إلى مزود الذكاء الاصطناعي";
/* نص الاستخدام القديم — ما اتغيّرش (نفس صيغة الأمر) */
export const USAGE_TEXT = "*اكتب سوألك بعد الامر 🤖*";

/* ردود المزودين الميتة/المضللة — لو الجسم كله هو العلامة دي مش هتعتبر إجابة */
const DEAD_MARKERS = new Set([
  "DEPLOYMENT_DISABLED",
  "PAYMENT_REQUIRED",
  "PAYMENT REQUIRED",
  "INSUFFICIENT_QUOTA",
  "QUOTA_EXCEEDED"
]);

/* نفس العلامات بعد التطبيع: _ / - / مسافة = مسافة
   (DEPLOYMENT_DISABLED = DEPLOYMENT DISABLED = DEPLOYMENT-DISABLED) */
const DEAD_MARKERS_NORMALIZED = new Set(
  [...DEAD_MARKERS].map((mk) => mk.toUpperCase().replace(/[_\-\s]+/g, " "))
);

/* نسخة من غير أي فاصل (DEPLOYMENTDISABLED) — للتطابق الكامل للجسم بس */
const DEAD_MARKERS_COMPACT = new Set(
  [...DEAD_MARKERS].map((mk) => mk.toUpperCase().replace(/[^A-Z0-9]/g, ""))
);

/* العلامات "البرمجية" (بها _) دي ما بتظهرش في كلام عادي، فممكن ندوّر عليها
   كـ substring جوه النص الأصلي من غير ما نكسر إجابة حقيقية بتشرح مثلاً
   خطأ HTTP 402 ("Payment Required") — العبارات بفواصل (مسافة/شرطة) مش
   بنلقطها كـ substring لأنها كلمات إنجليزية عادية ممكن تكون جوه إجابة سليمة */
const CODE_DEAD_MARKERS = ["DEPLOYMENT_DISABLED", "PAYMENT_REQUIRED", "INSUFFICIENT_QUOTA", "QUOTA_EXCEEDED"];

/* أقل طول للإجابة المقبولة — حرف واحد مش فاضي يكفي ("42" إجابة صحيحة)
   (الفحص بيرفض الأجسام الفاضية بس، مش القصيرة) */
const MIN_ANSWER_LENGTH = 1;

/* ردود كاملة معناها "مفيش إجابة" (مطابقة كاملة — مش substring) */
const NON_ANSWER_BODIES = new Set([
  "NULL",
  "UNDEFINED",
  "NAN",
  "N/A",
  "NIL",
  "{}",
  "[]",
  "ERROR",
  "ERRORS",
  "FAILED",
  "FAILURE",
  "NOT FOUND",
  "NO CONTENT",
  "SERVICE UNAVAILABLE",
  "TOO MANY REQUESTS",
  "INTERNAL SERVER ERROR",
  "BAD GATEWAY",
  "GATEWAY TIMEOUT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT IMPLEMENTED",
  "RATE LIMITED",
  "INVALID API KEY",
  "MISSING API KEY",
  "MODEL NOT FOUND",
  "UNPROCESSABLE ENTITY",
  "CONFLICT",
  "REQUEST TIMEOUT",
  "METHOD NOT ALLOWED"
]);

/* صفحات HTML — مش إجابة على الإطلاق.
   الفحص "بيبدأ" بس: لو الجسم نفسه صفحة HTML من أول حرف.
   جملة سليمة فيها وسم <body> في النص مش بتنرفض. */
const HTML_START_RE =
  /^\s*<(!doctype|html|head|body|title|script|style|meta|div|span|p|h[1-6]|table|form|iframe|svg|a)[\s>/]/i;

/* أجسام أخطاء HTTP (404 Not Found / 502 Bad Gateway / 402 Payment required ...) */
const HTTP_STATUS_ONLY_RE = /^\s*(?:HTTP\/[\d.]+\s+)?[45]\d{2}\s*$/i;
const HTTP_ERROR_PREFIX_RE =
  /^\s*(?:HTTP\/[\d.]+\s+)?[45]\d{2}\s+(?:error\b|bad request\b|bad gateway\b|gateway timeout\b|unauthorized\b|unprocessable\b|forbidden\b|not found\b|not implemented\b|service unavailable\b|too many requests\b|internal server error\b|payment required\b|insufficient\b|quota\b|rate limit\b|request timeout\b|unsupported\b|method not allowed\b|conflict\b)/i;

/* JSON مش صالح بس شكله ظرف خطأ (error / status / message) */
const JSON_ERROR_HINT_RE = /"(?:error|errors|status|status_code|statusCode|code|message|detail|exception)"\s*:/i;

/* عبارات الخطأ الشائعة (بأي capitalization) */
const ERROR_PHRASE_RE =
  /error|fail(?:ed|ure)?|denied|disabled|quota|payment required|unauthoriz|forbidden|not found|unavailable|timeout|invalid api key|expired|blocked|rate limit/i;



const envStr = (name) => String(process.env[name] ?? "").trim();
const trimSlash = (v) => String(v || "").trim().replace(/\/+$/, "");

/** عنوان المزود: أولوية لبيئة التشغيل، بعدين config.info.urls.api، بعدين الافتراضي
 *  useKey: المفتاح (AI_API_KEY) بيتبعت للمزود اللي المشغّل حدده بنفسه بس —
 *  المزود المجاني بيفضل بدون مفتاح عشان يفضل شغال. */
export function resolveBase(bot) {
  const fromEnv = trimSlash(envStr("AI_API_URL"));
  if (fromEnv) return { base: fromEnv, useKey: true };
  const fromConfig = trimSlash(bot?.config?.info?.urls?.api);
  if (fromConfig) return { base: fromConfig, useKey: false };
  return { base: DEFAULT_API_BASE, useKey: false };
}

/** مهلة الطلب بالمللي ثانية */
export function resolveTimeout() {
  const n = Number(envStr("AI_API_TIMEOUT"));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** اسم الموديل */
export function resolveModel() {
  return envStr("AI_API_MODEL") || "openai";
}

/** يبني السلسلة: [المزود المخصص؟, المزود المجاني] بدون تكرار */
export function buildChain(base, prompt, useKey = false) {
  const enc = encodeURIComponent(String(prompt ?? ""));
  const model = resolveModel();
  const chain = [];
  const seen = new Set();

  const add = (b, withKey) => {
    const v = trimSlash(b);
    const id = `${v}|${withKey ? 1 : 0}`;
    if (!v || seen.has(id)) return;
    seen.add(id);
    chain.push({ base: v, withKey: !!withKey });
  };

  add(base, useKey);
  if (envStr("AI_API_FALLBACK") !== "0") add(DEFAULT_API_BASE, false);
  if (!chain.length) add(DEFAULT_API_BASE, false);

  return chain.map((entry) => {
    const b = entry.base;
    const isChat = /\/chat\/completions/i.test(b);
    const isPollinations = /pollinations\.ai/i.test(b);
    const url = isChat
      ? b
      : `${b}/${enc}${isPollinations ? `?model=${encodeURIComponent(model)}` : ""}`;
    return { base: b, url, style: isChat ? "chat" : "text", withKey: entry.withKey };
  });
}

/** بيكتب استجابة المزود: status + body */
async function requestProvider(provider, { prompt, signal }) {
  const key = provider.withKey ? envStr("AI_API_KEY") : "";
  const headers = { "User-Agent": UA, Accept: "text/plain, text/*;q=0.9, */*;q=0.8" };
  if (key) headers.Authorization = `Bearer ${key}`;

  let res;
  if (provider.style === "chat") {
    res = await fetch(provider.url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolveModel(),
        messages: [{ role: "user", content: String(prompt ?? "") }]
      }),
      signal
    });
  } else {
    res = await fetch(provider.url, { headers, signal });
  }

  const status = Number(res?.status) || 0;
  const ok = res?.ok !== undefined ? !!res.ok : status >= 200 && status < 300;
  const body = await res.text();
  return { status, ok, body };
}

/** بطلّع النص من رد JSON ( OpenAI style أو JSON عادي ) */
function pickJsonText(parsed) {
  if (typeof parsed === "string") return parsed.trim() || null;
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.error) return null; // 200 بس الرد نفسه فيه خطأ

  const choices = parsed.choices;
  if (Array.isArray(choices) && choices.length) {
    const c = choices[0];
    const t = c?.message?.content ?? c?.text ?? c?.delta?.content;
    if (typeof t === "string" && t.trim()) return t.trim();
  }

  for (const k of ["reply", "response", "text", "content", "output", "answer", "result", "message"]) {
    const v = parsed[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** هل الـ JSON ده ظرف خطأ (مش إجابة)؟ (error / status>=400 / success=false ...) */
function isJsonErrorEnvelope(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  if (parsed.error) return true;
  if (parsed.success === false || parsed.ok === false) return true;

  for (const k of ["status", "statusCode", "status_code", "code", "http_status"]) {
    const v = parsed[k];
    if (typeof v === "number" && v >= 400) return true;
    if (typeof v === "string" && /^[45]\d\d$/.test(v.trim())) return true;
  }

  for (const k of ["type", "error_type", "errorType", "title", "reason", "message"]) {
    const v = parsed[k];
    if (typeof v === "string" && ERROR_PHRASE_RE.test(v)) return true;
  }

  return false;
}

/** هل الرد ده فيه أي علامة ميتة؟
 *  القاعدة: الفحص على النص الأصلي (من غير ما نشيل أي حروف) —
 *    1) تطابق كامل للجسم بأي capitalization / تطبيع فواصل / من غير فواصل
 *       (DEPLOYMENT_DISABLED = DEPLOYMENT DISABLED = DEPLOYMENTDISABLED)
 *    2) العلامات البرمجية (بها _) كـ substring في النص الأصلي —
 *       أي رد فيه DEPLOYMENT_DISABLED جواه (ولو جوه نص أطول) مش إجابة.
 *  إجابة بتشرح مثلاً "HTTP 402 Payment Required" مبتنرفضش، لأن
 *  العبارات المتعددة الكلمات مش علامة برمجية وبنلمها في النص الأصلي بس. */
export function hasDeadMarker(text) {
  const up = String(text ?? "").toUpperCase();
  if (!up) return false;

  /* 1) الجسم كله هو العلامة — بالظبط / بعد التطبيع / من غير فواصل */
  if (DEAD_MARKERS.has(up)) return true;

  const norm = up.replace(/[_\-\s]+/g, " ").trim();
  if (DEAD_MARKERS_NORMALIZED.has(norm)) return true;

  const compact = up.replace(/[^A-Z0-9]/g, "");
  if (compact && DEAD_MARKERS_COMPACT.has(compact)) return true;

  /* 2) علامة برمجية (بها _) كـ substring في النص الأصلي — بدون تجريد أي حروف */
  for (const mk of CODE_DEAD_MARKERS) {
    if (up.includes(mk)) return true;
  }

  return false;
}

/** هل الرد ده شكله إجابة حقيقية؟ (مش HTML / مش خطأ / مش فاضي) */
export function isPlausibleCompletion(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  if (raw.length < MIN_ANSWER_LENGTH) return false; // الفاضي بس — "42" إجابة صحيحة
  if (!/[\p{L}\p{N}]/u.test(raw)) return false; // رموز و بس
  if (HTML_START_RE.test(raw)) return false;
  if (HTTP_STATUS_ONLY_RE.test(raw)) return false;
  if (HTTP_ERROR_PREFIX_RE.test(raw)) return false;
  if (NON_ANSWER_BODIES.has(raw.toUpperCase())) return false;
  return true;
}

/** بيحوّل جسم الرد لنص — وبي رفض أي رد مضلل (فاضي / HTML / علامة ميتة / قصير) */
function extractText(body) {
  const raw = String(body ?? "").trim();
  if (!raw) return { ok: false, reason: "الرد فاضي" };

  /* 1) أي علامة ميتة جواه — بالظبط أو كـ substring (بأي capitals) */
  if (hasDeadMarker(raw)) return { ok: false, reason: "المزود رجّع استجابة ميتة" };

  /* 2) صفحة HTML من أول حرف / أخطاء HTTP — مرفوضة */
  if (HTML_START_RE.test(raw))
    return { ok: false, reason: "الرد صفحة HTML مش إجابة" };
  if (HTTP_STATUS_ONLY_RE.test(raw) || HTTP_ERROR_PREFIX_RE.test(raw))
    return { ok: false, reason: "المزود رجّع رسالة خطأ" };

  if (raw.startsWith("{") || raw.startsWith("[")) {
    let parsed = null;
    let parsedOk = true;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsedOk = false;
    }

    if (parsedOk) {
      /* ظرف خطأ (error / status>=400 / success=false) — مرفوض */
      if (isJsonErrorEnvelope(parsed)) return { ok: false, reason: "المزود رجّع ظرف خطأ" };
      const text = pickJsonText(parsed);
      if (!text) return { ok: false, reason: "الرد JSON من غير نص" };
      /* النص المستخرج جواه لازم يمر بنفس فحوصات الـ plausibility */
      if (hasDeadMarker(text)) return { ok: false, reason: "المزود رجّع استجابة ميتة" };
      if (!isPlausibleCompletion(text)) return { ok: false, reason: "الرد مش إجابة صالحة" };
      return { ok: true, text };
    }

    /* JSON مش صالح — لو شكله ظرف خطأ (error/status/message) بنرفضه،
       غير كده ممكن يكون إجابة عادية بتبدأ بـ { أو [ */
    if (JSON_ERROR_HINT_RE.test(raw)) return { ok: false, reason: "الرد JSON مش صالح" };
  }

  /* 3) الرد لازم يكون إجابة حقيقية (طول كافٍ + مش كلمة فاضية) */
  if (!isPlausibleCompletion(raw)) return { ok: false, reason: "الرد مش إجابة صالحة" };

  return { ok: true, text: raw };
}

/** يمنع الطلب من إنهاء ؛ لو الوقت عدّى بنقطع الطلب */
async function withTimeout(promise, ms, onTimeout) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch (e) {}
      const err = new Error("انتهت مهلة الطلب");
      err.code = "ETIMEDOUT";
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * بيشغّل السلسلة لحد ما مزود يرد بإجابة سليمة.
 * @returns {Promise<{ok:boolean,text?:string,provider?:string,errors:string[]}>}
 */
export async function runChain({ prompt, base, timeout, useKey } = {}) {
  const chain = buildChain(base || DEFAULT_API_BASE, prompt, useKey);
  const ms = Number.isFinite(timeout) && timeout > 0 ? timeout : resolveTimeout();
  const errors = [];

  for (const provider of chain) {
    const controller = new AbortController();
    try {
      const res = await withTimeout(
        requestProvider(provider, { prompt, signal: controller.signal }),
        ms,
        () => controller.abort()
      );

      if (!res.ok) {
        errors.push(`${provider.base} ← HTTP ${res.status}`);
        continue;
      }

      const extracted = extractText(res.body);
      if (!extracted.ok) {
        errors.push(`${provider.base} ← ${extracted.reason}`);
        continue;
      }

      return { ok: true, text: extracted.text, provider: provider.base, errors };
    } catch (e) {
      errors.push(`${provider.base} ← ${e?.message || e}`);
    }
  }

  return { ok: false, errors };
}

const handler = async (m, { conn, text, bot }) => {
  if (!text || !String(text).trim()) return m.reply(USAGE_TEXT);

  const prompt = String(text).trim();
  if (prompt.length > MAX_PROMPT)
    return m.reply(`❌ سؤالك طويل أوي، الحد الأقصى ${MAX_PROMPT} حرف — اختصره شوية`);



  const { base, useKey } = resolveBase(bot);
  const timeout = resolveTimeout();

  try {
    await m.react?.("⏳");
  } catch (e) {}

  const result = await runChain({ prompt, base, timeout, useKey });

  if (!result.ok) {
    try {
      await m.react?.("❌");
    } catch (e) {}
    return m.reply(
      `❌ ${AI_ERROR}\n\n` +
        `🔗 المزود: ${base}\n` +
        `📋 السبب: ${result.errors.join(" | ")}\n` +
        `⏱️ مهلة الطلب: ${Math.round(timeout / 1000)} ثانية\n\n` +
        `💡 جرّب:\n• سؤال تاني بصيغة أبسط\n• اتأكد إن النت شغال\n• أو اضبط AI_API_URL / AI_API_KEY في إعدادات البوت`
    );
  }

  try {
    await m.react?.("✅");
  } catch (e) {}
  return m.reply(result.text);
};

handler.usage = ["اوبن"];
handler.category = "ai";
handler.command = ["اوبن"];

export const COOLDOWN_MS = 0;
export default handler;
