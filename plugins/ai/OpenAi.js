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
  ═══════════════════════════════════════════════════════════════════════
*/

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const DEFAULT_API_BASE = "https://text.pollinations.ai";
export const DEFAULT_TIMEOUT_MS = 45000;
export const COOLDOWN_MS = 20000;
export const MAX_PROMPT = 1000;
export const AI_ERROR = "تعذر الوصول إلى مزود الذكاء الاصطناعي";
/* نص الاستخدام القديم — ما اتغيّرش (نفس صيغة الأمر) */
export const USAGE_TEXT = "*اكتب سوألك بعد الامر 🤖*";

/* ردود المزودين الميتة/المضللة — لو جت زي كده مش هتعتبر إجابة */
const DEAD_MARKERS = new Set([
  "DEPLOYMENT_DISABLED",
  "PAYMENT_REQUIRED",
  "PAYMENT REQUIRED",
  "INSUFFICIENT_QUOTA",
  "QUOTA_EXCEEDED"
]);

/* كولداون في الذاكرة لكل مستخدم (زي plugins/ai/imagen.js) */
const cooldown = new Map();

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

/** بيحوّل جسم الرد لنص — وبي رفض أي رد مضلل (فاضي / HTML / علامة ميتة) */
function extractText(body) {
  const raw = String(body ?? "").trim();
  if (!raw) return { ok: false, reason: "الرد فاضي" };
  if (/^<(!doctype|html)/i.test(raw)) return { ok: false, reason: "الرد صفحة HTML مش إجابة" };
  if (DEAD_MARKERS.has(raw.toUpperCase())) return { ok: false, reason: "المزود رجّع استجابة ميتة" };

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const text = pickJsonText(parsed);
      if (!text) return { ok: false, reason: "الرد JSON من غير نص" };
      return { ok: true, text };
    } catch (e) {
      /* مش JSON فعلاً — نعتبره نص عادي */
    }
  }

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

  /* كولداون لكل مستخدم — يمنع إغراق المزود */
  const sender = m?.sender || m?.chat || "unknown";
  const now = Date.now();
  const last = cooldown.get(sender) || 0;
  if (now - last < COOLDOWN_MS)
    return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية تانية قبل سؤال جديد`);
  if (cooldown.size > 500) {
    /* تنظيف: الخريطة مايبقاش تكبر للأبد */
    for (const [id, ts] of cooldown) if (now - ts >= COOLDOWN_MS) cooldown.delete(id);
  }
  cooldown.set(sender, now);

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

export default handler;
