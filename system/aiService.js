/*
 * system/aiService.js — Unified resilient AI text, persona, and image generation service
 * ====================================================================================
 * Works out-of-the-box with ZERO API keys (multi-provider free fallback chain) while
 * honoring optional GEMINI_API_KEY / AI_API_URL / GROQ_KEY / OPENROUTER_KEY / NVIDIA_API_KEY.
 */

import sharp from 'sharp';
import {
  hasDeadMarker,
  isPlausibleCompletion
} from '../plugins/ai/OpenAi.js';

const UA = 'LightBot/1.0 (https://github.com/clonew50/light-bot)';
const BUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Pollinations free-tier enforces 1 image per ~45s per IP; track locally to avoid wasted 402 stalls.
let lastPollinationsImageAt = 0;
const POLLINATIONS_COOLDOWN_MS = 46_000;

const memoryPersonas = new Map();
const memoryModels = new Map();

export function getUserPersonaId(sender, fallback = 'default') {
  try {
    const rec = global.db?.users?.[sender];
    if (rec?.aiPersona) return rec.aiPersona;
  } catch {}
  return memoryPersonas.get(sender) || fallback;
}

export function setUserPersonaId(sender, personaId) {
  memoryPersonas.set(sender, personaId);
  if (memoryPersonas.size > 5000) {
    const firstKey = memoryPersonas.keys().next().value;
    if (firstKey) memoryPersonas.delete(firstKey);
  }
  try {
    if (global.db?.users?.[sender]) {
      global.db.users[sender].aiPersona = personaId;
    }
  } catch {}
  return personaId;
}

export function getUserAiModel(sender, fallback = 'openai-fast') {
  try {
    const rec = global.db?.users?.[sender];
    if (rec?.aiModel) return rec.aiModel;
  } catch {}
  return memoryModels.get(sender) || fallback;
}

export function setUserAiModel(sender, modelId) {
  memoryModels.set(sender, modelId);
  if (memoryModels.size > 5000) {
    const firstKey = memoryModels.keys().next().value;
    if (firstKey) memoryModels.delete(firstKey);
  }
  try {
    if (global.db?.users?.[sender]) {
      global.db.users[sender].aiModel = modelId;
    }
  } catch {}
  return modelId;
}

/** Fast free Google Translate helper (handles Arabic -> English for image models + translate fallback). */
export async function translateText(text, targetLang = 'en', sourceLang = 'auto', timeoutMs = 10_000) {
  const input = String(text || '').trim();
  if (!input) return '';
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(input)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': BUA },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return input;
    const data = await res.json();
    const joined = Array.isArray(data?.[0])
      ? data[0].map((seg) => (Array.isArray(seg) ? seg[0] || '' : '')).join('')
      : '';
    return joined.trim() || input;
  } catch {
    return input;
  }
}

function cleanAndValidateText(raw) {
  if (raw === null || raw === undefined) return null;
  let candidate = raw;
  if (typeof raw === 'object') {
    if (raw.error || raw.ok === false || raw.success === false) return null;
    candidate =
      raw?.choices?.[0]?.message?.content ||
      raw?.candidates?.[0]?.content?.parts?.[0]?.text ||
      raw?.data?.answer ||
      raw?.answer ||
      raw?.response ||
      raw?.result ||
      raw?.output ||
      raw?.text ||
      '';
  }
  const text = String(candidate || '').trim();
  if (!text) return null;
  if (hasDeadMarker(text)) return null;
  if (!isPlausibleCompletion(text)) return null;
  // Filter Pollinations promo / deprecation / queue banners if leaked inside plain text
  if (/pollinations legacy text api is deprecated|enter\.pollinations\.ai|important notice.*pollinations/i.test(text) && text.length < 500) return null;
  return text;
}

/**
 * Unified AI text completion with resilient multi-provider fallback.
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.system]
 * @param {Array<{role:string,content:string}>} [opts.history]
 * @param {string} [opts.model]
 * @param {number} [opts.timeoutMs]
 * @param {Function} [opts.fetchImpl]
 */
export async function askAI(opts = {}) {
  const {
    prompt,
    system = 'أنت مساعد ذكي ودود ومفيد داخل بوت واتساب، تجيب بدقة ووضوح وباللغة العربية ما لم يُطلب غير ذلك.',
    history = [],
    model = 'openai-fast',
    timeoutMs = 30_000,
    fetchImpl = fetch
  } = opts;

  const userPrompt = String(prompt || '').trim();
  if (!userPrompt) return { ok: false, error: 'البرومبت فارغ', errors: ['empty prompt'] };

  const messages = [];
  if (system && String(system).trim()) {
    messages.push({ role: 'system', content: String(system).trim() });
  }
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      if (h?.role && h?.content && ['user', 'assistant'].includes(h.role)) {
        messages.push({ role: h.role, content: String(h.content).slice(0, 1500) });
      }
    }
  }
  messages.push({ role: 'user', content: userPrompt });

  const errors = [];

  // 1) Optional GEMINI_API_KEY if configured in env
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents
          }),
          signal: AbortSignal.timeout(timeoutMs)
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = cleanAndValidateText(data);
        if (text) return { ok: true, text, provider: 'gemini', errors };
      }
      errors.push(`gemini: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`gemini: ${e?.message || e}`);
    }
  }

  // 2) Optional OpenAI-compatible env provider (AI_API_URL / GROQ_KEY / OPENROUTER_KEY / NVIDIA_API_KEY)
  const customCandidates = [];
  if (process.env.AI_API_URL && process.env.AI_API_KEY) {
    const base = process.env.AI_API_URL.replace(/\/+$/, '');
    const endpoint = /\/chat\/completions$/i.test(base) ? base : `${base}/v1/chat/completions`;
    customCandidates.push({
      name: 'custom-ai',
      url: endpoint,
      key: process.env.AI_API_KEY.trim(),
      model: process.env.AI_MODEL || 'gpt-4o-mini'
    });
  }
  if (process.env.GROQ_KEY) {
    customCandidates.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_KEY.trim(),
      model: 'llama-3.3-70b-versatile'
    });
  }
  if (process.env.OPENROUTER_KEY) {
    customCandidates.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_KEY.trim(),
      model: 'meta-llama/llama-3.3-70b-instruct:free'
    });
  }
  if (process.env.NVIDIA_API_KEY) {
    customCandidates.push({
      name: 'nvidia',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: process.env.NVIDIA_API_KEY.trim(),
      model: 'meta/llama-3.1-70b-instruct'
    });
  }

  for (const prov of customCandidates) {
    try {
      const res = await fetchImpl(prov.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${prov.key}`
        },
        body: JSON.stringify({ model: prov.model, messages }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const data = await res.json();
        const text = cleanAndValidateText(data);
        if (text) return { ok: true, text, provider: prov.name, errors };
      }
      errors.push(`${prov.name}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${prov.name}: ${e?.message || e}`);
    }
  }

  // 3) Pollinations OpenAI-compatible POST (supports full system + conversation history, no key needed)
  try {
    const resolvedModel = ['openai', 'openai-fast', 'openai-large'].includes(model) ? model : 'openai-fast';
    const res = await fetchImpl('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ model: resolvedModel, messages }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.ok) {
      const raw = await res.text();
      let parsed = raw;
      try { parsed = JSON.parse(raw); } catch {}
      const text = cleanAndValidateText(parsed);
      if (text) return { ok: true, text, provider: 'pollinations-openai', errors };
      errors.push('pollinations-openai: invalid completion');
    } else {
      errors.push(`pollinations-openai: HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`pollinations-openai: ${e?.message || e}`);
  }

  // 4) Pollinations direct GET
  const combinedPrompt = system ? `${system}\n\n${userPrompt}` : userPrompt;
  for (const [name, url] of [
    ['pollinations-text', `https://text.pollinations.ai/${encodeURIComponent(combinedPrompt)}?model=openai-fast`],
    ['gen-pollinations', `https://gen.pollinations.ai/text/${encodeURIComponent(combinedPrompt)}`]
  ]) {
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const raw = await res.text();
        let parsed = raw;
        if (raw.trim().startsWith('{')) {
          try { parsed = JSON.parse(raw); } catch {}
        }
        const text = cleanAndValidateText(parsed);
        if (text) return { ok: true, text, provider: name, errors };
        errors.push(`${name}: invalid completion`);
      } else {
        errors.push(`${name}: HTTP ${res.status}`);
      }
    } catch (e) {
      errors.push(`${name}: ${e?.message || e}`);
    }
  }

  // 5) Scrapy ZeroAI / auralix-api fallback
  try {
    const q = encodeURIComponent(userPrompt);
    const sys = system ? `&prompt=${encodeURIComponent(system)}` : '';
    const res = await fetchImpl(`https://auralix-api.vercel.app/api/ai/zeroai?q=${q}${sys}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.ok) {
      const data = await res.json();
      const text = cleanAndValidateText(data);
      if (text) return { ok: true, text, provider: 'auralix-zeroai', errors };
      errors.push('auralix-zeroai: invalid completion');
    } else {
      errors.push(`auralix-zeroai: HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`auralix-zeroai: ${e?.message || e}`);
  }

  return { ok: false, error: errors.join(' | ') || 'فشل الاتصال بجميع مزودي الذكاء الاصطناعي', errors };
}

export function isValidImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 64) return false;
  // JPEG: FF D8 FF | PNG: 89 50 4E 47 | WEBP (RIFF): 52 49 46 46 | GIF: 47 49 46 38
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  return false;
}

async function normalizeToJpeg(buf) {
  try {
    return await sharp(buf).jpeg({ quality: 92 }).toBuffer();
  } catch {
    return buf;
  }
}

const STYLE_BOOSTERS = {
  photorealistic: 'photorealistic, ultra detailed, DSLR 85mm lens, natural lighting',
  cinematic: 'cinematic film still, dramatic volumetric lighting, 8k, anamorphic',
  anime: 'vibrant high quality anime art, cel shading, studio makoto style',
  'digital-art': 'polished digital painting, concept art, trending artstation',
  'oil-painting': 'classic oil painting, rich textured brushstrokes, museum lighting',
  watercolor: 'delicate watercolor illustration, soft pastel washes, artistic paper texture',
  sketch: 'detailed pencil charcoal sketch, clean cross-hatching, fine linework',
  '3d-render': '3d octane render, Pixar quality lighting, subsurface scattering, unreal engine 5',
  'pixel-art': 'retro crisp pixel art, 16-bit aesthetic, vibrant sprite palette',
  cyberpunk: 'cyberpunk neon city vibe, glowing cyan and magenta reflections, futuristic',
  fantasy: 'epic high fantasy artwork, ethereal glow, intricate magical details',
  dalle3: 'crisp vivid composition, clear typography if needed, studio lighting',
  midjourney: 'artistic masterpiece, atmospheric depth, hyper-detailed composition',
  sdxl: 'sharp detailed high resolution illustration',
  'flux-realism': 'photorealistic natural photography, fine skin and material textures',
  'flux-anime': 'high quality anime illustration, crisp clean lines, vibrant colors'
};

function clampDim(val, fallback = 768) {
  const n = Math.round((Number(val) || fallback) / 64) * 64;
  return Math.max(256, Math.min(1024, n));
}

async function fetchPollinationsImage(prompt, { width, height, seed, timeoutMs, fetchImpl }) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&model=sana&nologo=true&seed=${seed}`;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': BUA, Accept: 'image/*' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  lastPollinationsImageAt = Date.now();
  if (!res.ok) {
    throw new Error(`pollinations HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidImageBuffer(buf)) {
    throw new Error('pollinations returned non-image response');
  }
  return await normalizeToJpeg(buf);
}

async function fetchHordeImage(prompt, { width, height, negative, sourceImageBase64, timeoutMs, fetchImpl }) {
  const apiKey = (process.env.HORDE_API_KEY || '0000000000').trim();
  const w = clampDim(width, 512);
  const h = clampDim(height, 512);
  const fullPrompt = negative ? `${prompt} ### ${negative}` : prompt;

  const payload = {
    prompt: fullPrompt,
    params: {
      width: Math.min(w, 768),
      height: Math.min(h, 768),
      steps: 20,
      n: 1,
      ...(sourceImageBase64 ? { denoising_strength: 0.62 } : {})
    },
    ...(sourceImageBase64 ? { source_image: sourceImageBase64, source_processing: 'img2img' } : {})
  };

  const submitRes = await fetchImpl('https://stablehorde.net/api/v2/generate/async', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      'Client-Agent': 'LightBot:1.0:whatsapp'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  if (!submitRes.ok) {
    const errTxt = await submitRes.text().catch(() => '');
    throw new Error(`horde submit HTTP ${submitRes.status}: ${errTxt.slice(0, 100)}`);
  }
  const submitted = await submitRes.json();
  const id = submitted?.id;
  if (!id) throw new Error('horde returned no job id');

  const deadline = Date.now() + Math.max(timeoutMs, 45_000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const stRes = await fetchImpl(`https://stablehorde.net/api/v2/generate/status/${id}`, {
      headers: { 'Client-Agent': 'LightBot:1.0:whatsapp' },
      signal: AbortSignal.timeout(10_000)
    });
    if (!stRes.ok) continue;
    const st = await stRes.json();
    if (st.faulted) throw new Error('horde generation faulted');
    if (st.done && st.generations?.[0]?.img) {
      const imgUrl = st.generations[0].img;
      let rawBuf;
      if (imgUrl.startsWith('http')) {
        const dl = await fetchImpl(imgUrl, { signal: AbortSignal.timeout(20_000) });
        if (!dl.ok) throw new Error(`horde image fetch HTTP ${dl.status}`);
        rawBuf = Buffer.from(await dl.arrayBuffer());
      } else {
        rawBuf = Buffer.from(imgUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      }
      if (!isValidImageBuffer(rawBuf)) throw new Error('horde returned invalid image bytes');
      return await normalizeToJpeg(rawBuf);
    }
  }
  throw new Error('horde generation timed out');
}

/**
 * Generates an AI image with automatic Arabic->English prompt translation,
 * Pollinations sana -> AI Horde fallback, magic-byte validation, and JPEG normalization.
 */
export async function generateAIImage(opts = {}) {
  const {
    prompt,
    width = 1024,
    height = 1024,
    model = 'flux',
    style = 'none',
    negative = '',
    seed = -1,
    sourceImageBase64 = null,
    timeoutMs = 70_000,
    fetchImpl = fetch
  } = opts;

  const rawPrompt = String(prompt || '').trim();
  if (!rawPrompt) return { ok: false, error: 'وصف الصورة فارغ', errors: ['empty prompt'] };

  // Translate non-ASCII prompts (e.g. Arabic) to crisp English for far better visual fidelity
  const hasNonAscii = /[^\x00-\x7F]/.test(rawPrompt);
  const translatedPrompt = hasNonAscii ? await translateText(rawPrompt, 'en', 'auto', 8000) : rawPrompt;

  const boostParts = [translatedPrompt];
  if (STYLE_BOOSTERS[model]) boostParts.push(STYLE_BOOSTERS[model]);
  if (style && style !== 'none' && STYLE_BOOSTERS[style]) boostParts.push(STYLE_BOOSTERS[style]);
  const finalPrompt = boostParts.join(', ');
  const finalNeg = negative && /[^\x00-\x7F]/.test(negative)
    ? await translateText(negative, 'en', 'auto', 6000)
    : negative;

  const actualSeed = seed !== undefined && seed >= 0 ? seed : Math.floor(Math.random() * 1_000_000);
  const errors = [];

  // img2img goes straight to AI Horde (Pollinations sana URL endpoint is txt2img only)
  if (sourceImageBase64) {
    try {
      const buffer = await fetchHordeImage(finalPrompt, {
        width: 512,
        height: 512,
        negative: finalNeg,
        sourceImageBase64,
        timeoutMs,
        fetchImpl
      });
      return { ok: true, buffer, provider: 'ai-horde-img2img', translatedPrompt, errors };
    } catch (e) {
      errors.push(`ai-horde-img2img: ${e?.message || e}`);
      return { ok: false, error: errors.join(' | '), errors };
    }
  }

  // Try Pollinations first only when not inside its 45s per-IP throttle window
  const pollinationsReady = Date.now() - lastPollinationsImageAt >= POLLINATIONS_COOLDOWN_MS;
  if (pollinationsReady) {
    try {
      const buffer = await fetchPollinationsImage(finalPrompt, {
        width: clampDim(width, 1024),
        height: clampDim(height, 1024),
        seed: actualSeed,
        timeoutMs: Math.min(timeoutMs, 35_000),
        fetchImpl
      });
      return { ok: true, buffer, provider: 'pollinations', translatedPrompt, errors };
    } catch (e) {
      errors.push(`pollinations: ${e?.message || e}`);
    }
  } else {
    errors.push('pollinations: skipped due to 45s per-IP cooldown');
  }

  // Primary free reliable fallback: AI Horde (zero IP lock, returns real rendered art)
  try {
    const buffer = await fetchHordeImage(finalPrompt, {
      width,
      height,
      negative: finalNeg,
      timeoutMs,
      fetchImpl
    });
    return { ok: true, buffer, provider: 'ai-horde', translatedPrompt, errors };
  } catch (e) {
    errors.push(`ai-horde: ${e?.message || e}`);
  }

  // Final retry on Pollinations if it was initially skipped
  if (!pollinationsReady) {
    try {
      const buffer = await fetchPollinationsImage(finalPrompt, {
        width: clampDim(width, 768),
        height: clampDim(height, 768),
        seed: actualSeed,
        timeoutMs: Math.min(timeoutMs, 35_000),
        fetchImpl
      });
      return { ok: true, buffer, provider: 'pollinations-retry', translatedPrompt, errors };
    } catch (e) {
      errors.push(`pollinations-retry: ${e?.message || e}`);
    }
  }

  return { ok: false, error: errors.join(' | ') || 'فشل توليد الصورة', errors };
}

export default {
  askAI,
  generateAIImage,
  translateText,
  isValidImageBuffer,
  getUserPersonaId,
  setUserPersonaId,
  getUserAiModel,
  setUserAiModel
};
