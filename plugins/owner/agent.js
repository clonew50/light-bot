/**
 * ═══════════════════════════════════════════════════════════════
 *  🤖 صانع البلاجينز — True Agent (v28.0) — LIGHT BOT FULL
 * ═══════════════════════════════════════════════════════════════
 *  📁 المكان: plugins/owner/agent.js
 *  🎯 Framework: meowsab (LIGHT BOT / Pomni-AI)
 *  🔥 كل المميزات: Auto-Discovery + Tor + كل المزودين + NVIDIA
 *  ⏱️ كل طلب شبكة بمهلة محدودة • 🔓 سقف أمان ثابت
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import https from 'https'
import http from 'http'
import vm from 'vm'
import axios from 'axios'

// ⏱️ مفيش مهلة عامة على axios — كل نداء شبكة في الملف ده بيمرّ على مهلة صريحة (HTTP_TIMEOUT_*)

const _modURL = new URL(import.meta.url)
_modURL.search = ''
_modURL.hash = ''
const ROOT = path.resolve(path.dirname(fileURLToPath(_modURL)), '..', '..')

const SESSION_TTL = 10 * 60 * 1000
const PERSIST_TTL = 24 * 60 * 60 * 1000
const SESSIONS_FILE = path.join(ROOT, 'agent-sessions.json')
const MAX_PERSISTED = 500
const TOOLS_DIR = path.join(ROOT, 'agent-tools')
const MAX_CUSTOM_TOOLS = 500
// 🔒 سقف أمان ثابت — المالك يقدر يقلّل الرقم (maxIter/maxTools) لكن عمره ما يتعدّاه.
// (كان مافيش سقف، ومع "بلا-حدود" كان الوكيل يفضل يلفّ على موديلات وأدوات للأبد على سيرفر 512MB.)
const SAFETY_HARD_ITER_LIMIT = 50
const SAFETY_HARD_TOOL_LIMIT = 400
// ⏰ أي موافقة كتابة/حذف معلّقة بتموت بعد كده (وبتموت مع الريستارت — مبتتحفظش في الديسك).
const APPROVAL_TTL_MS = 5 * 60 * 1000
// 🛡️ أدوات شغّالة على النظام نفسه — safetyEnabled بيقفلها تمامًا (مش بس بيسأل عليها).
const SAFETY_GATED_TOOLS = new Set(['create_tool', 'delete_tool', 'npm_install'])
const IS_FRESH_START = process.uptime() < 60

// ⏱️ مهلة محدودة لكل طلب شبكة (10-30 ثانية) — مفيش نداء شبكة بلا try/catch
const HTTP_TIMEOUT_MS = 30 * 1000
const HTTP_TIMEOUT_SEARCH_MS = 15 * 1000
const HTTP_TIMEOUT_TOR_MS = 10 * 1000

// ═══════════════════════════════════════════════════════════════
//  ⏱️ إدارة المؤقّتات — مؤقّت واحد لكل مهمة + تنظيف كامل
// ═══════════════════════════════════════════════════════════════
// كل المؤقّتات (تحديث الكاش + نبض الوكيل + حفظ الجلسات) بتتسجّل هنا عشان:
//  1) مايتكررشش عند إعادة تحميل البلاجين (hot reload)
//  2) كل المؤقّتات القديمة تتشال أول ما البلاجين يتحمّل تاني
//  3) تتقفل كلها لما العملية تخرج
const agentTimers = global.__agentTimers || (global.__agentTimers = new Set())

function registerAgentTimer(timer, kind = 'interval') {
  if (!timer) return null
  try { if (kind === 'interval' && typeof timer.unref === 'function') timer.unref() } catch {}
  agentTimers.add(timer)
  return timer
}
function clearAgentTimer(timer) {
  if (!timer) return null
  try { clearInterval(timer) } catch {}
  try { clearTimeout(timer) } catch {}
  agentTimers.delete(timer)
  return null
}
function stopAgentTimers() {
  for (const t of [...agentTimers]) { try { clearInterval(t) } catch {}; try { clearTimeout(t) } catch {} }
  agentTimers.clear()
}
// 🔁 إعادة تحميل البلاجين: بنمسح كل المؤقّتات القديمة الأول (منع التكديس)
stopAgentTimers()
global.__agentStopTimers = stopAgentTimers
if (!global.__agentExitHook) {
  global.__agentExitHook = () => { try { stopAgentTimers() } catch {} }
  process.once('exit', global.__agentExitHook)
}

// 🔑 NVIDIA Key مضاف افتراضيًا
const DEFAULT_NVIDIA_KEY = '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'

console.log('[agent] 🎯 LIGHT BOT (meowsab) — ROOT: ' + ROOT)
console.log('[agent] ✅ NVIDIA Key مضاف افتراضيًا')

// ═══════════════════════════════════════════════════════════════
//  🔄 Helpers LIGHT BOT (UltraDB)
// ═══════════════════════════════════════════════════════════════
function getUsersDB() { try { return global.db?.users || null } catch { return null } }
function getGroupsDB() { try { return global.db?.groups || null } catch { return null } }
function getBotConfig(bot) {
  try {
    if (bot?.config?.info) {
      const i = bot.config.info
      return { name: i.nameBot || 'LIGHT BOT', author: i.copyright?.author || 'dev', pack: i.copyright?.pack || 'LIGHT BOT', channel: i.idChannel || '', channelName: i.nameChannel || '', repo: i.urls?.repo || '', api: i.urls?.api || '', images: i.images || [], prefix: bot.config?.prefix || ['.', '/', '!'] }
    }
  } catch {}
  return { name: 'LIGHT BOT', author: 'dev', pack: 'LIGHT BOT', channel: '', channelName: '', repo: '', api: '', images: [], prefix: ['.'] }
}
function getPluginList(bot) {
  try {
    if (bot && typeof bot.getAllCommands === 'function') {
      const cmds = bot.getAllCommands() || []
      const out = {}
      for (const c of cmds) { const name = (Array.isArray(c.command) ? c.command[0] : c.command) || c.name || 'unknown'; out[name] = c }
      return out
    }
  } catch {}
  return {}
}
function getPluginCount(bot) { return Object.keys(getPluginList(bot)).length }

// ═══════════════════════════════════════════════════════════════
//  ⚙️ الإعدادات الكاملة
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SETTINGS = {
  maxIter: 0, maxTools: 0, heartbeatMs: 4000, statusMode: 'normal',
  verboseTools: true, verboseProviders: true,
  maxBackups: 5000, maxActions: 5000, historyTrim: 100, autoNewSession: true,
  maxConcurrentProviders: 1, providerFailCacheMs: 90000,
  preferFastModels: true, parallelToolsEnabled: true, adaptiveHistory: true,
  askAggressively: false, askBeforeWrite: false, askBeforeDelete: false, maxAskPerSession: 0,
  antiHallucination: true, showFactsSummary: true, enableCustomTools: true,
  safetyEnabled: false, reactMode: true, showThinking: true, maxReflections: 10,
  autoResume: true, autoResumeDelayMs: 20000,
  preferFreeModels: true, freeOnlyMode: false, showFreeBadge: true,
  // 🔑 المفاتيح
  kiloKey: '', llm7Key: '', airforceKey: '', cerebrasKey: '',
  groqKey: '', openrouterKey: '',
  nvidiaKey: DEFAULT_NVIDIA_KEY,  // ✅ NVIDIA مضافة
  githubToken: '', pollinationsKey: '',
  groqReasoningEffort: 'high', groqTemperature: 1, groqMaxTokens: 4096, groqTopP: 1,
  groqEnableTools: true, groqEnableReasoning: true,
  autoDiscoverModels: true,
  useTor: false, torAutoRotate: true, torRotateAfter: 3, torRotateCooldownMs: 30000,
  disabledProviders: [], forced: ''
}

function getSettings() {
  try {
    if (!global.db) return { ...DEFAULT_SETTINGS }
    if (!global.db.data) global.db.data = {}
    if (!global.db.data.agent) global.db.data.agent = {}
    if (!global.db.data.agent.settings) global.db.data.agent.settings = { ...DEFAULT_SETTINGS }
    // ✅ نضمن إن NVIDIA دايمًا موجودة
    if (!global.db.data.agent.settings.nvidiaKey) global.db.data.agent.settings.nvidiaKey = DEFAULT_NVIDIA_KEY
    return { ...DEFAULT_SETTINGS, ...global.db.data.agent.settings }
  } catch { return { ...DEFAULT_SETTINGS } }
}
function setSetting(key, value) {
  try {
    if (!global.db) return false
    if (!global.db.data) global.db.data = {}
    if (!global.db.data.agent) global.db.data.agent = {}
    if (!global.db.data.agent.settings) global.db.data.agent.settings = { ...DEFAULT_SETTINGS }
    global.db.data.agent.settings[key] = value
    return true
  } catch { return false }
}
function getAgentCfg() {
  try {
    if (!global.db) return {}
    if (!global.db.data) global.db.data = {}
    if (!global.db.data.agent) global.db.data.agent = {}
    return global.db.data.agent
  } catch { return {} }
}

// ═══════════════════════════════════════════════════════════════
//  🏥 Health Cache
// ═══════════════════════════════════════════════════════════════
const providerHealth = global.__agentProviderHealth || (global.__agentProviderHealth = new Map())

function markProviderFail(name, reason = '') {
  const st = getSettings()
  const baseMs = Number(st.providerFailCacheMs) || 90000
  const h = providerHealth.get(name) || { failCount: 0 }
  h.failCount = (h.failCount || 0) + 1
  h.lastFail = Date.now()
  const low = String(reason).toLowerCase()
  if (/402|payment required|requires an active subscription|paid.?only/i.test(low)) {
    h.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000
    h.creditIssue = true; h.reason = 'paid only (402)'
    providerHealth.set(name, h); return
  }
  const isCreditIssue = /credit|top.?up|balance|funds|quest|insufficient|payment|billing/i.test(low)
  if (isCreditIssue) { h.cooldownUntil = Date.now() + 60 * 60 * 1000; h.creditIssue = true; h.reason = 'credit issue' }
  else { h.cooldownUntil = Date.now() + Math.min(baseMs * Math.pow(2, h.failCount - 1), 600000); h.creditIssue = false; h.reason = String(reason).slice(0, 100) }
  providerHealth.set(name, h)
}
function markProviderOK(name) { providerHealth.delete(name) }
function isProviderHealthy(name) {
  const h = providerHealth.get(name)
  if (!h) return true
  return Date.now() > (h.cooldownUntil || 0)
}
function getHealthStats() {
  const stats = []
  for (const [name, h] of providerHealth.entries()) {
    const remaining = Math.max(0, Math.round(((h.cooldownUntil || 0) - Date.now()) / 1000))
    if (remaining > 0) stats.push({ name, failCount: h.failCount, cooldownLeft: remaining, creditIssue: !!h.creditIssue, reason: h.reason || '' })
  }
  return stats.sort((a, b) => b.cooldownLeft - a.cooldownLeft)
}

// ═══════════════════════════════════════════════════════════════
//  🧅 Tor
// ═══════════════════════════════════════════════════════════════
const torState = global.__agentTorState || (global.__agentTorState = { agent: null, ready: false, lastInit: 0, circuitCount: 0, lastRotate: 0, rotating: false, error: null })

async function initTor() {
  try {
    if (torState.ready && torState.agent) return true
    if (Date.now() - torState.lastInit < 30000) return false
    torState.lastInit = Date.now()
    try {
      const hanna = await import('@pynk/hanna')
      const agent = await hanna.fluent.agent().materialize()
      torState.agent = agent; torState.ready = true; torState.error = null
      console.log('[tor] ✅ تم تهيئة Tor client')
      return true
    } catch (e) { torState.error = 'المكتبة @pynk/hanna مش مثبتة'; torState.ready = false; return false }
  } catch (e) { torState.error = e?.message || String(e); torState.ready = false; return false }
}
async function rotateTorIdentity() {
  if (torState.rotating) return false
  torState.rotating = true
  try {
    torState.agent = null; torState.ready = false; torState.lastInit = 0
    await new Promise(r => setTimeout(r, 2000))
    const ok = await initTor()
    if (ok) { torState.circuitCount++; torState.lastRotate = Date.now() }
    return ok
  } catch (e) { torState.error = e?.message || String(e); return false }
  finally { torState.rotating = false }
}
function buildAxiosConfig(useTor = false) {
  if (useTor && torState.ready && torState.agent) return { httpAgent: torState.agent, httpsAgent: torState.agent, proxy: false }
  return { httpAgent: new http.Agent({ keepAlive: false }), httpsAgent: new https.Agent({ keepAlive: false }), proxy: false }
}
async function checkTor() {
  if (!await initTor()) return { ok: false, error: torState.error }
  try { const res = await axios.get('https://api.ipify.org?format=json', { ...buildAxiosConfig(true), timeout: HTTP_TIMEOUT_TOR_MS }); return { ok: true, ip: res.data?.ip || 'unknown' } }
  catch (e) { return { ok: false, error: e?.message || String(e) } }
}

// ═══════════════════════════════════════════════════════════════
//  🧠 Auto-Discovery Models
// ═══════════════════════════════════════════════════════════════
const MODELS_CACHE_FILE = path.join(ROOT, 'agent-models.json')
const MODELS_CACHE_TTL = 6 * 60 * 60 * 1000
const MODELS_MAX_PER_PROVIDER = 10
const modelsCache = global.__agentModelsCache || (global.__agentModelsCache = { providers: {}, probed: {}, lastRefresh: 0 })

const DISCOVERY_ENDPOINTS = {
  groq:         { url: 'https://api.groq.com/openai/v1/models',         auth: k => ({ Authorization: 'Bearer ' + k }) },
  openrouter:   { url: 'https://openrouter.ai/api/v1/models',           auth: () => ({}) },
  nvidia:       { url: 'https://integrate.api.nvidia.com/v1/models',    auth: k => ({ Authorization: 'Bearer ' + k }) },
  llm7:         { url: 'https://api.llm7.io/v1/models',                 auth: k => ({ Authorization: 'Bearer ' + (k || 'unused') }) },
  github:       { url: 'https://models.inference.ai.azure.com/models',  auth: k => ({ Authorization: 'Bearer ' + k }) },
  cerebras:     { url: 'https://api.cerebras.ai/v1/models',             auth: k => ({ Authorization: 'Bearer ' + k }) },
  pollinations: { url: 'https://text.pollinations.ai/models',           auth: () => ({}) },
  kilo:         { url: 'https://api.kilo.ai/api/gateway/models',        auth: k => ({ Authorization: 'Bearer ' + k }) }
}

const FREE_ROUTERS = { openrouter: ['openrouter/free'], kilo: ['kilo-auto/free'], groq: [], llm7: [] }

const KNOWN_FREE_PATTERNS = [/openrouter\/free/i, /kilo-auto\/free/i, /:free\b/i, /\bfree\b/i, /gpt-oss-(20b|120b)/i, /qwen3\.6-27b/i, /qwen\/qwen3-32b/i, /deepseek-r1-free/i, /glm-5-free/i, /glm-4\.5-air-free/i, /minimax-m2\.5-free/i, /llama-3\.3-70b/i, /gpt-4o-mini/i, /mistral-small/i, /step-3\.5-flash/i]

const FREE_MODEL_DEFAULTS = {
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'groq/compound'],
  kilo: ['kilo-auto/free', 'kilo/glm-5-free', 'kilo/glm-4.5-air-free', 'kilo/minimax-m2.5-free', 'kilo/deepseek-r1-free'],
  openrouter: ['openrouter/free', 'deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'qwen/qwen-2.5-72b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free'],
  llm7: ['gpt-4o-mini', 'llama-3.3-70b', 'mistral-small', 'deepseek-r1', 'qwen2.5-coder-32b', 'gemini-2.5-flash-lite'],
  pollinations: ['openai-fast', 'openai', 'mistral', 'qwen-coder'],
  nvidia: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mistral-7b-instruct-v0.3', 'microsoft/phi-3-medium-4k-instruct', 'google/gemma-2-9b-it', 'nvidia/llama-3.1-nemotron-70b-instruct']
}

const KILO_FALLBACK = ['kilo/glm-5-free', 'kilo/glm-4.5-air-free', 'kilo/minimax-m2.5-free', 'kilo-auto/free']
const GROQ_FALLBACK = [
  { id: 'openai/gpt-oss-120b', tools: true, vision: false, effort: false },
  { id: 'openai/gpt-oss-20b',  tools: true, vision: false, effort: false },
  { id: 'qwen/qwen3.6-27b',    tools: true, vision: true,  effort: true }
]
const LLM7_FALLBACK = ['gpt-4o-mini', 'llama-3.3-70b', 'mistral-small']
const OPENROUTER_FREE_FALLBACK = ['openrouter/free', 'deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'qwen/qwen-2.5-72b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free']
const NVIDIA_FALLBACK = [
  { id: 'meta/llama-3.1-70b-instruct', tools: true, vision: false, effort: false },
  { id: 'meta/llama-3.1-8b-instruct', tools: true, vision: false, effort: false },
  { id: 'mistralai/mistral-7b-instruct-v0.3', tools: false, vision: false, effort: false },
  { id: 'microsoft/phi-3-medium-4k-instruct', tools: false, vision: false, effort: false },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', tools: true, vision: false, effort: false }
]
const GPT_AI_ENDPOINTS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15']
const AIRFORCE_FALLBACK = ['llama-3.1-70b', 'qwen-2.5-72b', 'mistral-small-2503', 'deepseek-r1']
const UNCLOSEAI_MODELS = ['gpt-4o', 'claude-3.5-sonnet', 'llama-3.3-70b']

function loadModelsCache() {
  try {
    if (!fs.existsSync(MODELS_CACHE_FILE)) return
    const data = JSON.parse(fs.readFileSync(MODELS_CACHE_FILE, 'utf8'))
    if (data) { modelsCache.providers = data.providers || {}; modelsCache.probed = data.probed || {}; modelsCache.lastRefresh = data.lastRefresh || 0; console.log('[models] تم تحميل كاش ' + Object.keys(modelsCache.providers).length + ' مزود') }
  } catch (e) { console.error('[models] load:', e?.message) }
}
function saveModelsCache() {
  try { fs.writeFileSync(MODELS_CACHE_FILE, JSON.stringify({ providers: modelsCache.providers, probed: modelsCache.probed, lastRefresh: modelsCache.lastRefresh }, null, 2), 'utf8') }
  catch (e) { console.error('[models] save:', e?.message) }
}
function extractModelEntries(data) {
  if (!data) return []
  const entries = []
  const push = (id, raw) => { if (id && typeof id === 'string' && id.length < 120) entries.push({ id, raw: raw || null }) }
  if (Array.isArray(data)) { for (const item of data) { if (typeof item === 'string') push(item, null); else if (item && typeof item === 'object') push(item.id || item.name || item.model, item) } }
  else if (Array.isArray(data.data)) { for (const item of data.data) { if (typeof item === 'string') push(item, null); else if (item) push(item.id || item.name, item) } }
  else if (Array.isArray(data.models)) { for (const item of data.models) { if (typeof item === 'string') push(item, null); else if (item) push(item.id || item.name || item, item) } }
  else if (Array.isArray(data.result)) { for (const item of data.result) { if (typeof item === 'string') push(item, null); else if (item) push(item.id || item.name, item) } }
  else if (typeof data === 'object') { const keys = Object.keys(data).filter(k => !['success', 'error', 'message'].includes(k)); if (keys.length && keys.length < 500) for (const k of keys) push(k, typeof data[k] === 'object' ? data[k] : null) }
  return entries
}
function detectFreeModel(provider, id, rawModel = null) {
  const lc = String(id || '').toLowerCase()
  if (!lc) return { free: false, isRouter: false }
  const routers = FREE_ROUTERS[provider] || []
  if (routers.some(r => lc.includes(r.toLowerCase()))) return { free: true, isRouter: true }
  for (const re of KNOWN_FREE_PATTERNS) if (re.test(lc)) return { free: true, isRouter: false }
  if (rawModel?.pricing) {
    try { const p = rawModel.pricing; const prompt = parseFloat(p.prompt || p.input || '0') || 0; const completion = parseFloat(p.completion || p.output || '0') || 0; const request = parseFloat(p.request || '0') || 0; const image = parseFloat(p.image || '0') || 0; if (prompt === 0 && completion === 0 && request === 0 && image === 0) return { free: true, isRouter: false } } catch {}
  }
  if (rawModel) { if (rawModel.is_free === true || rawModel.free === true) return { free: true, isRouter: false }; if (rawModel.cost === 0 || rawModel.cost === '0') return { free: true, isRouter: false } }
  return { free: false, isRouter: false }
}
function rankModel(id) {
  const lc = String(id).toLowerCase(); let score = 0
  if (/opus/i.test(lc)) score += 100
  if (/sonnet/i.test(lc)) score += 80
  if (/gpt-oss-120b|gpt-5|gpt-4\.5|o1\b|o3\b/.test(lc)) score += 90
  if (/gpt-4o|gpt-4\b|claude-3\.7/.test(lc)) score += 70
  if (/grok-4|grok-3/.test(lc)) score += 70
  if (/glm-5|deepseek-v4|kimi-k2|qwen3.*(max|pro)/.test(lc)) score += 60
  if (/deepseek-r1|qwen3\.6-27b/.test(lc)) score += 55
  if (/llama-4|maverick|nemotron/.test(lc)) score += 50
  if (/\b(200b|400b|500b|1000b)\b/.test(lc)) score += 40
  if (/\b(120b|100b|90b|80b|70b|72b)\b/.test(lc)) score += 30
  if (/\b(32b|30b|27b|24b)\b/.test(lc)) score += 20
  if (/\b(14b|13b)\b/.test(lc)) score += 10
  if (/\b(8b|7b|3b|1b)\b/.test(lc)) score -= 5
  if (/coder|code-|codegen/i.test(lc)) score += 25
  if (/instruct|chat|versatile|turbo/i.test(lc)) score += 10
  if (/reasoning|think/i.test(lc)) score += 15
  if (/:free\b/.test(lc)) score += 45
  if (/\bfree\b/.test(lc)) score += 35
  if (/kilo-auto\/free/.test(lc)) score += 60
  if (/openrouter\/free/.test(lc)) score += 60
  if (/(gpt-oss|qwen3\.6-27b|deepseek-r1-distill)/i.test(lc)) score += 20
  if (/preview|beta|experimental|deprecated|legacy/i.test(lc)) score -= 40
  if (/embed|whisper|tts|tts-|moderation|guard|rerank|reranker|dall|stable-diffusion|image|vision-ocr|segmentation/i.test(lc)) score -= 500
  if (/-audio|-speech|-voice/i.test(lc)) score -= 200
  return score
}
function inferCapabilities(provider, id) {
  const lc = String(id).toLowerCase()
  const caps = { tools: false, vision: false, effort: false }
  if (provider === 'groq') { if (/gpt-oss|llama-4|maverick|qwen3/.test(lc)) caps.tools = true; if (/qwen3\.6|vision|-vl/.test(lc)) caps.vision = true; if (/qwen3\.6-27b|reasoning|think/.test(lc)) caps.effort = true }
  if (provider === 'openrouter') { if (/deepseek|qwen|llama-3\.3|glm/.test(lc)) caps.tools = true; if (/vision|vl|4o|4\.5/.test(lc)) caps.vision = true }
  if (provider === 'nvidia') { if (/llama-3\.1-70b|nemotron|deepseek|qwen|kimi|glm/.test(lc)) caps.tools = true; if (/vision|vl/.test(lc)) caps.vision = true }
  if (provider === 'github') { if (/gpt-4o|o1|o3|llama-4|maverick/.test(lc)) caps.tools = true; if (/vision|4o/.test(lc)) caps.vision = true }
  if (provider === 'llm7') { if (/gpt-4o|claude-3|llama-3\.3/.test(lc)) caps.tools = true; if (/vision|4o/.test(lc)) caps.vision = true }
  return caps
}

async function discoverProviderModels(provider) {
  const cfg = getAgentCfg(); const st = getSettings()
  const ep = DISCOVERY_ENDPOINTS[provider]; if (!ep) return []
  let key = ''
  if (provider === 'groq') key = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
  else if (provider === 'kilo') key = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
  else if (provider === 'github') key = process.env.GITHUB_TOKEN || cfg.githubToken || st.githubToken
  else if (provider === 'nvidia') key = process.env.NVIDIA_API_KEY || cfg.nvidiaKey || st.nvidiaKey || DEFAULT_NVIDIA_KEY
  else if (provider === 'openrouter') key = process.env.OPENROUTER_KEY || cfg.openrouterKey || st.openrouterKey
  else if (provider === 'llm7') key = process.env.LLM7_KEY || cfg.llm7Key || st.llm7Key
  else if (provider === 'cerebras') key = process.env.CEREBRAS_KEY || cfg.cerebrasKey || st.cerebrasKey
  if (['groq', 'kilo', 'github', 'nvidia', 'openrouter', 'cerebras'].includes(provider) && !key) { console.log('[models] ' + provider + ': مفيش مفتاح — تخطي'); return [] }
  try {
    const headers = { 'Content-Type': 'application/json', ...ep.auth(key) }
    const res = await axios.get(ep.url, { headers, timeout: HTTP_TIMEOUT_MS })
    let entries = extractModelEntries(res.data)
    const seen = new Set(); const unique = []
    for (const e of entries) { if (!e.id || seen.has(e.id)) continue; seen.add(e.id); unique.push(e) }
    const ranked = unique.map(({ id, raw }) => {
      const caps = inferCapabilities(provider, id)
      const freeInfo = detectFreeModel(provider, id, raw)
      const baseRank = rankModel(id)
      let finalRank = baseRank
      if (freeInfo.isRouter) finalRank += 100
      else if (freeInfo.free) finalRank += 40
      return { id, rank: finalRank, free: freeInfo.free, isRouter: freeInfo.isRouter, ...caps, pricing: raw?.pricing || null }
    }).filter(m => m.rank > -100)
    ranked.sort((a, b) => b.rank - a.rank)
    const routers = ranked.filter(m => m.isRouter); const freeOnes = ranked.filter(m => m.free && !m.isRouter); const paidOnes = ranked.filter(m => !m.free)
    let top
    if (routers.length >= MODELS_MAX_PER_PROVIDER) top = routers.slice(0, MODELS_MAX_PER_PROVIDER)
    else { const remaining = MODELS_MAX_PER_PROVIDER - routers.length; top = [...routers, ...freeOnes.slice(0, remaining), ...paidOnes.slice(0, Math.max(0, remaining - freeOnes.length))] }
    console.log('[models] ' + provider + ': لاقيت ' + unique.length + ' — حفظنا ' + top.length)
    return top
  } catch (e) { console.error('[models] ' + provider + ': ' + (e?.message || e)); return [] }
}
async function refreshModelsCache(force = false) {
  if (!force && (Date.now() - modelsCache.lastRefresh < MODELS_CACHE_TTL) && Object.keys(modelsCache.providers).length) return modelsCache
  console.log('[models] 🔄 بدء تجديد الكاش...')
  const providers = Object.keys(DISCOVERY_ENDPOINTS)
  const results = await Promise.allSettled(providers.map(p => discoverProviderModels(p)))
  let totalModels = 0, totalFree = 0
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i], r = results[i]
    const list = r.status === 'fulfilled' ? r.value : []
    if (list.length > 0) { modelsCache.providers[p] = list; totalModels += list.length; totalFree += list.filter(m => m.free).length }
    else if (!modelsCache.providers[p]) modelsCache.providers[p] = []
  }
  modelsCache.lastRefresh = Date.now(); saveModelsCache()
  console.log('[models] ✅ الكاش اتجدد: ' + totalModels + ' (مجاني: ' + totalFree + ')')
  return modelsCache
}
async function probeModel(provider, modelId) {
  const ckey = provider + ':' + modelId
  const cached = modelsCache.probed[ckey]
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached
  const cfg = getAgentCfg(); const st = getSettings(); const t0 = Date.now()
  const isRouter = (FREE_ROUTERS[provider] || []).some(r => String(modelId).toLowerCase().includes(r.toLowerCase()))
  if (isRouter) { const result = { ok: true, ts: Date.now(), latency: 0, isRouter: true }; modelsCache.probed[ckey] = result; return result }
  try {
    let content = ''
    const testMsgs = [{ role: 'user', content: 'Reply with exactly: OK' }]
    if (provider === 'groq') content = await groqCall(testMsgs, { id: modelId, tools: false, vision: false, effort: false }, process.env.GROQ_KEY || cfg.groqKey || st.groqKey)
    else if (provider === 'kilo') content = await kiloC(testMsgs, modelId, {})
    else if (provider === 'llm7') content = await llm7Call(testMsgs, modelId, {})
    else if (provider === 'openrouter') content = await openrouterCall(testMsgs, modelId, process.env.OPENROUTER_KEY || cfg.openrouterKey || st.openrouterKey, {})
    else if (provider === 'nvidia') content = await nvidiaCall(testMsgs, modelId, process.env.NVIDIA_API_KEY || cfg.nvidiaKey || st.nvidiaKey || DEFAULT_NVIDIA_KEY, {})
    else if (provider === 'github') content = await githubModelsCall(testMsgs, modelId, process.env.GITHUB_TOKEN || cfg.githubToken || st.githubToken, {})
    else if (provider === 'cerebras') content = await cerebrasCall(testMsgs, modelId, {})
    else if (provider === 'pollinations') content = await pollinationsCall(testMsgs, modelId, {})
    const result = { ok: !!content && String(content).trim().length > 0, ts: Date.now(), latency: Date.now() - t0 }
    modelsCache.probed[ckey] = result; return result
  } catch (e) { const result = { ok: false, ts: Date.now(), latency: Date.now() - t0, error: String(e?.message || e).slice(0, 150) }; modelsCache.probed[ckey] = result; return result }
}
async function probeAllProvider(provider, onProgress) {
  const list = modelsCache.providers[provider] || []
  if (!list.length) return { tested: 0, ok: 0, failed: 0, results: [] }
  const results = await Promise.all(list.map(async (m, i) => { if (onProgress) onProgress(`🧪 [${provider}] ${i + 1}/${list.length}: ${m.id}…`); const r = await probeModel(provider, m.id); return { id: m.id, ...r } }))
  const working = results.filter(r => r.ok)
  if (working.length > 0) {
    const original = modelsCache.providers[provider] || []
    const workingIds = new Set(working.map(r => r.id))
    modelsCache.providers[provider] = original.filter(m => workingIds.has(m.id)).map(m => { const w = working.find(x => x.id === m.id); return { ...m, latency: w.latency } }).sort((a, b) => (rankModel(b.id) + Math.max(0, 5000 - b.latency) / 100) - (rankModel(a.id) + Math.max(0, 5000 - a.latency) / 100))
    saveModelsCache()
  }
  return { tested: results.length, ok: working.length, failed: results.length - working.length, results }
}
function getWorkingModels(provider, freeOnly = false) {
  const list = modelsCache.providers[provider] || []
  let filtered = list.filter(m => { const probe = modelsCache.probed[provider + ':' + m.id]; if (!probe) return true; return probe.ok !== false })
  if (freeOnly) { const ff = filtered.filter(m => m.free); if (ff.length) filtered = ff }
  return filtered
}
function getAllFreeModels() {
  const byProvider = {}; const routers = []; let total = 0
  for (const [provider, list] of Object.entries(modelsCache.providers)) {
    const free = list.filter(m => m.free); const provRouters = list.filter(m => m.isRouter)
    for (const r of provRouters) routers.push({ provider, id: r.id })
    if (free.length) { byProvider[provider] = free; total += free.length }
  }
  return { byProvider, total, routers }
}

// ═══════════════════════════════════════════════════════════════
//  🌐 Provider Functions
// ═══════════════════════════════════════════════════════════════
async function groqCall(messages, modelInfo, key, proxyCfg = {}) {
  const st = getSettings()
  const modelStr = String(modelInfo?.id || modelInfo || 'openai/gpt-oss-120b')
  const params = { model: modelStr, messages, temperature: Number(st.groqTemperature) ?? 1, max_completion_tokens: Math.min(Number(st.groqMaxTokens) || 4096, 8192), top_p: Number(st.groqTopP) ?? 1, stream: false }
  if (st.groqEnableReasoning && modelInfo?.effort) params.reasoning_effort = ['low', 'medium', 'high'].includes(st.groqReasoningEffort) ? st.groqReasoningEffort : 'high'
  let res
  try { res = await axios.post('https://api.groq.com/openai/v1/chat/completions', params, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ Groq: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('رد فارغ من Groq')
  return String(c)
}
async function kiloC(messages, model, proxyCfg = {}) {
  const cfg = getAgentCfg(); const st = getSettings()
  const key = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
  if (!key) throw new Error('Kilo محتاج مفتاح')
  let res
  try { res = await axios.post('https://api.kilo.ai/api/gateway/chat/completions', { model: model || 'kilo/glm-5-free', messages, temperature: 0.3, max_tokens: 16384 }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'X-KILOCODE-EDITORNAME': 'light-agent' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ Kilo: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من Kilo')
  return String(c)
}
async function llm7Call(messages, model, proxyCfg = {}) {
  const cfg = getAgentCfg(); const st = getSettings()
  const key = process.env.LLM7_KEY || cfg.llm7Key || st.llm7Key || 'unused'
  let res
  try { res = await axios.post('https://api.llm7.io/v1/chat/completions', { model: model || 'gpt-4o-mini', messages, temperature: 0.3 }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ LLM7: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من LLM7')
  return String(c)
}
async function openrouterCall(messages, model, key, proxyCfg = {}) {
  let res
  try { res = await axios.post('https://openrouter.ai/api/v1/chat/completions', { model, messages, temperature: 0.3 }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'X-Title': 'LIGHT Agent', 'HTTP-Referer': 'https://lightbot.local' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ OpenRouter: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('رد غير متوقع من OpenRouter')
  return String(c)
}
async function nvidiaCall(messages, model, key, proxyCfg = {}) {
  const finalKey = key || DEFAULT_NVIDIA_KEY
  const modelStr = typeof model === 'object' ? (model.id || 'meta/llama-3.1-70b-instruct') : (model || 'meta/llama-3.1-70b-instruct')
  let res
  try { res = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', { model: modelStr, messages, temperature: 0.3, top_p: 0.9, max_tokens: 4096, stream: false }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + finalKey, Accept: 'application/json' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ NVIDIA: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من NVIDIA')
  return String(c)
}
async function githubModelsCall(messages, model, key, proxyCfg = {}) {
  let res
  try { res = await axios.post('https://models.inference.ai.azure.com/chat/completions', { model: model || 'openai/gpt-4o', messages, temperature: 0.3 }, { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ GitHub Models: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('رد غير متوقع من GitHub')
  return String(c)
}
async function cerebrasCall(messages, model, proxyCfg = {}) {
  const cfg = getAgentCfg(); const st = getSettings()
  const key = process.env.CEREBRAS_KEY || cfg.cerebrasKey || st.cerebrasKey
  const headers = { 'Content-Type': 'application/json' }; if (key) headers.Authorization = 'Bearer ' + key
  let res
  try { res = await axios.post('https://api.cerebras.ai/v1/chat/completions', { model: model || 'llama-3.3-70b', messages, temperature: 0.3 }, { headers, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ Cerebras: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من Cerebras')
  return String(c)
}
async function pollinationsCall(messages, model, proxyCfg = {}) {
  let res
  try { res = await axios.post('https://text.pollinations.ai/openai', { model: model || 'openai', messages }, { headers: { 'Content-Type': 'application/json' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ Pollinations: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content || (typeof res.data === 'string' ? res.data : null)
  if (!c) throw new Error('فورمات غير متوقع من Pollinations')
  return String(c)
}
async function gptAiGatewayCall(messages, endpoint, proxyCfg = {}) {
  const text = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n')
  const sys = messages.find(m => m.role === 'system')?.content
  let res
  try { res = await axios.post('https://gpt-ai-olive.vercel.app/chat/' + (endpoint || 'v1'), { userMessage: (sys ? sys + '\n\n' : '') + text }, { headers: { 'Content-Type': 'application/json' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ GPT-AI: ' + (e?.message || e)) }
  const c = res.data?.reply || res.data?.response || res.data?.message
  if (!c) throw new Error('فورمات غير متوقع')
  return String(c)
}
async function apiAirforceCall(messages, model, proxyCfg = {}) {
  const cfg = getAgentCfg(); const st = getSettings()
  const key = process.env.AIRFORCE_KEY || cfg.airforceKey || st.airforceKey
  const headers = { 'Content-Type': 'application/json' }; if (key) headers.Authorization = 'Bearer ' + key
  let res
  try { res = await axios.post('https://api.airforce/v1/chat/completions', { model: model || 'llama-3.1-70b', messages, temperature: 0.3 }, { headers, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ Airforce: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من Airforce')
  return String(c)
}
async function uncloseAICall(messages, model, proxyCfg = {}) {
  let res
  try { res = await axios.post('https://uncloseai.com/v1/chat/completions', { model: model || 'gpt-4o', messages, temperature: 0.3 }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer unused' }, ...proxyCfg, timeout: HTTP_TIMEOUT_MS }) }
  catch (e) { throw new Error('تعذّر الاتصال بـ UncloseAI: ' + (e?.message || e)) }
  const c = res.data?.choices?.[0]?.message?.content
  if (!c) throw new Error('فورمات غير متوقع من UncloseAI')
  return String(c)
}

// ═══════════════════════════════════════════════════════════════
//  🔗 Provider Chain — كل المزودين
// ═══════════════════════════════════════════════════════════════
function buildProviderChain() {
  const cfg = getAgentCfg(); const st = getSettings()
  const kiloKey = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
  const gqKey = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
  const ghKey = process.env.GITHUB_TOKEN || cfg.githubToken || st.githubToken
  const nvKey = process.env.NVIDIA_API_KEY || cfg.nvidiaKey || st.nvidiaKey || DEFAULT_NVIDIA_KEY
  const orKey = process.env.OPENROUTER_KEY || cfg.openrouterKey || st.openrouterKey
  const afKey = process.env.AIRFORCE_KEY || cfg.airforceKey || st.airforceKey
  const cbKey = process.env.CEREBRAS_KEY || cfg.cerebrasKey || st.cerebrasKey
  const forced = String(cfg.forced || '').toLowerCase()
  const disabled = new Set(Array.isArray(st.disabledProviders) ? st.disabledProviders : [])
  const freeOnly = st.preferFreeModels || st.freeOnlyMode
  const chain = []
  const push = (name, call, priority) => { const k = name.toLowerCase().split('/')[0]; if (disabled.has(k)) return; chain.push({ name, call, priority: priority ?? 50 }) }

  // 🥇 Kilo
  if (kiloKey && (!forced || forced === 'kilo')) {
    const list = getWorkingModels('kilo', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.kilo || FREE_MODEL_DEFAULTS.kilo.map(id => ({ id, free: true, isRouter: /kilo-auto\/free/.test(id) })))
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = (m.isRouter ? '🤖 ' : (m.free ? '🆓 ' : '')); push(badge + 'Kilo/' + mid, (msgs, c) => kiloC(msgs, mid, c), 0) }
  }
  // 🥈 Groq
  if (gqKey && (!forced || forced === 'groq')) {
    const list = getWorkingModels('groq', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.groq || FREE_MODEL_DEFAULTS.groq.map(id => ({ id, free: true })))
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = (m.free ? '🆓 ' : ''); const modelInfo = typeof m === 'object' ? m : { id: mid, tools: false, vision: false, effort: false }; push(badge + 'Groq/' + mid, (msgs, c) => groqCall(msgs, modelInfo, gqKey, c), 1) }
  }
  // 🥉 LLM7
  if (!forced || forced === 'llm7') {
    const list = getWorkingModels('llm7', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.llm7 || FREE_MODEL_DEFAULTS.llm7.map(id => ({ id, free: true })))
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = (m.free ? '🆓 ' : ''); push(badge + 'LLM7/' + mid, (msgs, c) => llm7Call(msgs, mid, c), 2) }
  }
  // GitHub Models
  if (ghKey && (!forced || forced === 'github-models')) {
    const list = getWorkingModels('github', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.github || [])
    for (const m of finalList) { const badge = (m.free ? '🆓 ' : ''); push(badge + 'GitHub/' + m.id, (msgs, c) => githubModelsCall(msgs, m.id, ghKey, c), 5) }
  }
  // 🎯 NVIDIA — دائمًا موجودة بسبب المفتاح الافتراضي
  if (!forced || forced === 'nvidia') {
    const list = getWorkingModels('nvidia', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.nvidia || NVIDIA_FALLBACK)
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = '🎯 '; push(badge + 'NVIDIA/' + mid, (msgs, c) => nvidiaCall(msgs, mid, nvKey, c), 6) }
  }
  // OpenRouter
  if (orKey && (!forced || forced === 'openrouter')) {
    const list = getWorkingModels('openrouter', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.openrouter || OPENROUTER_FREE_FALLBACK.map(id => ({ id, free: true, isRouter: /openrouter\/free/.test(id) })))
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = (m.isRouter ? '🤖 ' : (m.free ? '🆓 ' : '')); push(badge + 'OpenRouter/' + mid, (msgs, c) => openrouterCall(msgs, mid, orKey, c), 8) }
  }
  // GPT-AI
  if (!forced || forced === 'gpt-ai') { for (const ep of GPT_AI_ENDPOINTS) push('GPT-AI/' + ep, (msgs, c) => gptAiGatewayCall(msgs, ep, c), 11) }
  // UncloseAI
  if (!forced || forced === 'uncloseai') { for (const m of UNCLOSEAI_MODELS) push('UncloseAI/' + m, (msgs, c) => uncloseAICall(msgs, m, c), 12) }
  // Cerebras
  if (cbKey && (!forced || forced === 'cerebras')) {
    const list = getWorkingModels('cerebras', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.cerebras || [])
    for (const m of finalList) { const badge = (m.free ? '🆓 ' : ''); push(badge + 'Cerebras/' + m.id, (msgs, c) => cerebrasCall(msgs, m.id, c), 13) }
  }
  // Pollinations
  if (!forced || forced === 'pollinations') {
    const list = getWorkingModels('pollinations', freeOnly)
    const finalList = list.length ? list : (modelsCache.providers.pollinations || FREE_MODEL_DEFAULTS.pollinations.map(id => ({ id, free: true })))
    for (const m of finalList) { const mid = typeof m === 'object' ? m.id : m; const badge = (m.free ? '🆓 ' : ''); push(badge + 'Pollinations/' + mid, (msgs, c) => pollinationsCall(msgs, mid, c), 14) }
  }
  // Airforce
  if (afKey && (!forced || forced === 'airforce')) { for (const m of AIRFORCE_FALLBACK) push('Airforce/' + m, (msgs, c) => apiAirforceCall(msgs, m, c), 15) }

  // Fallback
  if (!chain.length) {
    if (kiloKey) { const fb = (modelsCache.providers.kilo || FREE_MODEL_DEFAULTS.kilo.map(id => ({ id })))[0]; push('🆓 Kilo/' + fb.id, (msgs, c) => kiloC(msgs, fb.id, c), 99) }
    if (!chain.length) push('🎯 NVIDIA/meta/llama-3.1-70b-instruct', (msgs, c) => nvidiaCall(msgs, 'meta/llama-3.1-70b-instruct', nvKey, c), 99)
    if (!chain.length) push('🆓 LLM7/' + LLM7_FALLBACK[0], (msgs, c) => llm7Call(msgs, LLM7_FALLBACK[0], c), 99)
    if (!chain.length) push('🆓 Pollinations/openai', (msgs, c) => pollinationsCall(msgs, 'openai', c), 99)
  }
  chain.sort((a, b) => a.priority - b.priority)
  return chain
}

async function callAI(messages, onProgress) {
  const st = getSettings()
  const fullChain = buildProviderChain()
  const disabled = new Set(Array.isArray(st.disabledProviders) ? st.disabledProviders : [])
  const chain = fullChain.filter(p => { const k = p.name.toLowerCase().split('/')[0]; if (disabled.has(k)) return false; if (!isProviderHealthy(p.name)) return false; return true })
  const finalChain = chain.length ? chain : fullChain
  if (!finalChain.length) throw new Error('مفيش أي مزود متاح')
  let torCfg = null
  if (st.useTor) {
    if (onProgress) onProgress('🧅 بجرب التهيئة على Tor…')
    const ok = await initTor()
    if (ok) { torCfg = buildAxiosConfig(true); if (onProgress) onProgress('✅ Tor جاهز') }
    else if (onProgress) onProgress('⚠️ Tor فشل — بنكمل بدون')
  }
  const errors = []; let failCount = 0
  const proxyCfg = torCfg || buildAxiosConfig(false)
  for (let i = 0; i < finalChain.length; i++) {
    const p = finalChain[i]
    if (onProgress && st.verboseProviders) onProgress(`🚀 مزود ${i + 1}/${finalChain.length}: *${p.name}*…`)
    let lastError = null; let content = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = Date.now()
      try {
        content = await p.call(messages, proxyCfg)
        if (!content || !String(content).trim()) { lastError = new Error('رد فاضي'); if (attempt < 3) { await new Promise(r => setTimeout(r, 1500)); continue } break }
        const sc = String(content)
        if (isCreditIssue(sc)) { lastError = new Error('credits'); break }
        if (isFakeAIResponse(sc)) { lastError = new Error('رد وهمي'); if (attempt < 3) { await new Promise(r => setTimeout(r, 1500)); continue } break }
        markProviderOK(p.name)
        if (onProgress) onProgress(`✅ *${p.name}* رد في ${Math.round((Date.now() - t0) / 1000)}ث`)
        return sc.trim()
      } catch (e) {
        let msg = e?.message || String(e)
        if (e?.response?.data) { const d = e.response.data; const detail = typeof d === 'string' ? d : (d.error?.message || d.message || JSON.stringify(d)); msg = 'HTTP ' + (e.response.status || '?') + ' — ' + String(detail) }
        lastError = new Error(msg)
        if (isPaidOnlyIssue(msg)) { markProviderFail(p.name, msg); failCount++; break }
        if (/socket hang up|ECONNRESET|ETIMEDOUT|aborted/i.test(msg) && attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue }
        if (/429|rate/i.test(msg) && attempt < 3) { await new Promise(r => setTimeout(r, 5000)); continue }
        break
      }
    }
    if (lastError) { const errEntry = p.name + ': ' + String(lastError.message).slice(0, 150); if (!errors.includes(errEntry)) errors.push(errEntry); if (!isPaidOnlyIssue(lastError.message)) markProviderFail(p.name, lastError.message); failCount++ }
  }
  throw new Error('فشلت كل المزودين:\n• ' + errors.slice(-8).join('\n• '))
}

// ═══════════════════════════════════════════════════════════════
//  🚫 Fake AI + Credit Detection
// ═══════════════════════════════════════════════════════════════
function isFakeAIResponse(content) {
  if (!content) return true
  const c = String(content).toLowerCase().trim()
  if (c.length < 3) return true
  const fakePatterns = [/doesn'?t have enough credits/i,/not enough credits/i,/top.?up/i,/complete a quest/i,/low_balance/i,/insufficient (funds|credits|balance|quota)/i,/payment required/i,/billing/i,/quota.*exceeded/i,/requires an active subscription/i,/enter\.pollinations\.ai/i,/anonymous users have reached the limit/i,/sign in to continue/i,/rate limit/i,/too many requests/i,/quota exceeded/i,/you have reached your/i,/please (try again|sign in|register|login)/i,/service (unavailable|temporarily)/i,/internal server error/i,/bad gateway/i,/gateway timeout/i,/access denied/i,/unauthorized/i,/invalid api key/i,/no api key/i,/authentication (failed|required)/i,/this message is quite long/i,/^\s*error\s*[:\-]/i,/^\s*\{\s*"error"/i,/^\s*<!doctype html/i,/^\s*<html/i,/^\s*\{\s*"detail"/i]
  for (const p of fakePatterns) if (p.test(c)) return true
  if (c.length < 30 && !c.includes('{') && !c.includes('tool') && /\b(error|invalid|denied|failed|unavailable|cannot|can'?t|sorry|unknown|expired|disabled|forbidden|refus)\b/i.test(c)) return true
  return false
}
function isCreditIssue(content) {
  const c = String(content || '').toLowerCase()
  return /credit|top.?up|balance|funds|quest|insufficient|payment|billing|enter\.pollinations|requires an active subscription/i.test(c)
}
function isPaidOnlyIssue(content) {
  const c = String(content || '').toLowerCase()
  return /402|payment required|requires an active subscription|paid.?only|subscribe or top up/i.test(c)
}
function detectHallucinatedNumbers(reply, session) {
  if (!getSettings().antiHallucination) return null
  const text = String(reply || '')
  const numPatterns = [/(?:عدد|فيه|يوجد|توجد|النتيجة|إجمالي)\s*(?:ال)?\S*\s*(?:هو|هي|=|:)?\s*(\d{1,5})/gi,/(\d{1,5})\s*(?:بلاجين|ملف|سطر|نتيجة|عنصر)/gi]
  const found = new Set()
  for (const re of numPatterns) { let mm; while ((mm = re.exec(text)) !== null) { const n = Number(mm[1]); if (n >= 0 && n <= 99999) found.add(n) } }
  if (!found.size) return null
  const facts = Array.isArray(session?.facts) ? session.facts : []
  const factNumbers = new Set()
  for (const f of facts) { const nums = String(f.value || '').match(/\d{1,5}/g) || []; nums.forEach(n => factNumbers.add(Number(n))) }
  const suspicious = [...found].filter(n => !factNumbers.has(n))
  if (!suspicious.length) return null
  return { suspicious, message: '⚠️ *كاشف الهلوسة:* أرقام (' + suspicious.join(', ') + ') من غير أداة.' }
}

// ═══════════════════════════════════════════════════════════════
//  📋 Tools + Paths
// ═══════════════════════════════════════════════════════════════
const KNOWN_TOOLS = ['list_files','read_file','search_code','plugin_list','analyze_plugins','research_plugin','inspect_plugin','test_plugin','suggest_plugins','clone_plugin','write_file','delete_file','npm_install','create_tool','list_tools','read_tool','delete_tool','think','plan','reflect','memory','web_search','wiki_search','fetch_url','ask_user','finish']

const PROTECTED_WRITE = [/^session([\\/]|$)/i, /^system([\\/]|$)/i, /^sub\.js$/i, /^index\.js$/i, /^node_modules([\\/]|$)/i, /^agent-backups([\\/]|$)/i, /^tmp([\\/]|$)/i, /^package(-lock)?\.json$/i, /^\.env/i, /(^|[\\/])creds\.json$/i, /^agent-sessions\.json$/i, /^agent-tools[\\/]/i, /^agent-models\.json$/i, /^plugins[\\/]owner[\\/]agent\.js$/i]
const PROTECTED_READ = [/^session([\\/]|$)/i, /^node_modules([\\/]|$)/i, /^\.env/i, /(^|[\\/])creds\.json$/i]
const TEXT_EXT = /\.(js|mjs|cjs|json|md|txt|html|css|py|yml|yaml)$/i

const sessions = global.__agentSessions || (global.__agentSessions = new Map())
const actions = global.__agentActions || (global.__agentActions = [])
const customTools = global.__agentCustomTools || (global.__agentCustomTools = new Map())

let _persistTimer = null
function persistSessions(now = false) {
  if (!now && _persistTimer) return
  const doSave = () => {
    _persistTimer = null
    try {
      const obj = {}
      for (const [k, s] of sessions.entries()) {
        const msgs = s.messages.filter((m, i) => !(i === 0 && m.role === 'system'))
        obj[k] = { messages: msgs, lastActive: s.lastActive, toolCount: s.toolCount, prefix: s.prefix, agentMsgIds: [...(s.agentMsgIds || [])].slice(-50), interrupted: !!s.busy, wasResumed: !!s.wasResumed, facts: s.facts || [], longMemory: s.longMemory || [], scratchpad: (s.scratchpad || []).slice(-30), currentPlan: s.currentPlan || null, reflections: (s.reflections || []).slice(-20) }
      }
      const entries = Object.entries(obj).sort((a, b) => (b[1].lastActive || 0) - (a[1].lastActive || 0)).slice(0, MAX_PERSISTED)
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(entries)), 'utf8')
    } catch (e) { console.error('[agent persist]', e?.message || e) }
  }
  if (now) { _persistTimer = clearAgentTimer(_persistTimer); doSave(); return }
  _persistTimer = clearAgentTimer(_persistTimer)
  _persistTimer = registerAgentTimer(setTimeout(doSave, 3000), 'timeout')
}
function loadPersistedSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return
    const obj = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))
    const now = Date.now()
    let loaded = 0
    for (const [k, data] of Object.entries(obj || {})) {
      if (!data || !Array.isArray(data.messages)) continue
      if (now - (data.lastActive || 0) > PERSIST_TTL && !data.interrupted) continue
      sessions.set(k, { messages: [{ role: 'system', content: buildSystemPrompt() }, ...data.messages], lastActive: data.lastActive || now, agentMsgIds: new Set(Array.isArray(data.agentMsgIds) ? data.agentMsgIds : []), toolCount: data.toolCount || 0, runTools: [], busy: false, prefix: data.prefix || '.', interrupted: !!data.interrupted, wasResumed: !!data.wasResumed, cancel: false, facts: Array.isArray(data.facts) ? data.facts : [], longMemory: Array.isArray(data.longMemory) ? data.longMemory : [], scratchpad: Array.isArray(data.scratchpad) ? data.scratchpad : [], currentPlan: data.currentPlan || null, reflections: Array.isArray(data.reflections) ? data.reflections : [] })
      loaded++
    }
    if (loaded > 0) console.log('[agent] استرجعنا ' + loaded + ' جلسة')
  } catch (e) { console.error('[agent load]', e?.message || e) }
}

function skey(m) { return (m.chat || '') + '|' + (m.sender || '') }
function safePath(p) {
  const rel = String(p || '').trim()
  if (!rel) throw new Error('مسار فاضي')
  const abs = path.resolve(ROOT, rel)
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error('خارج المشروع: ' + rel)
  return abs
}
function relPath(abs) { return path.relative(ROOT, abs).replace(/\\/g, '/') }
function guardWrite(abs) { const rel = relPath(abs); for (const re of PROTECTED_WRITE) if (re.test(rel)) throw new Error('مسار محمي: ' + rel) }
function backupFile(p) {
  const abs = safePath(p)
  if (!fs.existsSync(abs)) return null
  const dir = path.join(ROOT, 'agent-backups')
  fs.mkdirSync(dir, { recursive: true })
  const name = Date.now() + '__' + relPath(abs).replace(/[\\/]/g, '__')
  fs.copyFileSync(abs, path.join(dir, name))
  const max = Number(getSettings().maxBackups) || 5000
  const all = fs.readdirSync(dir).filter(f => /^\d+__/.test(f)).sort()
  while (all.length > max) { try { fs.unlinkSync(path.join(dir, all.shift())) } catch {} }
  return 'agent-backups/' + name
}
function logAction(a) { actions.push({ t: Date.now(), a }); const max = Number(getSettings().maxActions) || 5000; while (actions.length > max) actions.shift() }
function maskKey(k) { if (!k || typeof k !== 'string') return '(فاضي)'; if (k.length <= 20) return k.slice(0, 6) + '...' + k.slice(-4); return k.slice(0, 12) + '...' + k.slice(-8) }

// ═══════════════════════════════════════════════════════════════
//  📡 ActivityStatus
// ═══════════════════════════════════════════════════════════════
class ActivityStatus {
  constructor(conn, chat, quoted) { this.conn = conn; this.chat = chat; this.quoted = quoted; this.key = null; this.startTime = Date.now(); this.activities = []; this.maxActivities = 30; this.current = ''; this.timer = null; this.pending = false; this.cancelled = false; this.settings = getSettings() }
  async init() { try { const sent = await this.conn.sendMessage(this.chat, { text: this.render() }, { quoted: this.quoted }); this.key = sent?.key || null } catch {}; const hb = Math.max(2000, Number(this.settings.heartbeatMs) || 4000); this.timer = clearAgentTimer(this.timer); this.timer = registerAgentTimer(setInterval(() => this.flush(), hb), 'interval') }
  add(icon, text) { if (this.cancelled) return; if (this.settings.statusMode === 'silent' && !['❌', '⏹️', '✅'].includes(icon)) return; this.activities.push({ icon, text: String(text).slice(0, 200), ts: Date.now() }); if (this.activities.length > this.maxActivities) this.activities.shift(); this.current = ''; this.flush() }
  setCurrent(text) { if (this.cancelled || this.settings.statusMode === 'silent') return; this.current = String(text || '').slice(0, 200); this.flush() }
  render() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000); const m = Math.floor(elapsed / 60), s = elapsed % 60
    const timeStr = m > 0 ? `${m}د ${s}ث` : `${s}ث`; const mode = this.settings.statusMode
    if (mode === 'silent') return `🤖 *الوكيل شغال…* ⏱️ ${timeStr}\n\n_وضع صامت — للإيقاف: صانع توقف_`
    const lines = [`🤖 *الوكيل شغال…* ⏱️ ${timeStr}`, '']
    const showItems = mode === 'verbose' ? this.activities : this.activities.slice(-10)
    for (const a of showItems) lines.push(`${a.icon} ${a.text}`)
    if (this.current) { if (showItems.length) lines.push(''); lines.push(`▶️ ${this.current}`) }
    if (!showItems.length && !this.current) lines.push('_بيبدأ الشغل…_')
    lines.push('', `_للإيقاف: صانع توقف_`)
    return lines.join('\n').slice(0, 3800)
  }
  async flush() { if (!this.key || this.pending || this.cancelled) return; this.pending = true; try { await this.conn.sendMessage(this.chat, { text: this.render(), edit: this.key }) } catch {} finally { this.pending = false } }
  async stop(finalText) { this.cancelled = true; this.timer = clearAgentTimer(this.timer); if (!this.key) return; try { if (finalText) await this.conn.sendMessage(this.chat, { text: String(finalText).slice(0, 3800), edit: this.key }); else await this.conn.sendMessage(this.chat, { delete: this.key }) } catch {} }
}

// ═══════════════════════════════════════════════════════════════
//  🧰 Custom Tools
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  🛡️ صندوق الأدوات — قائمة سماح (Allowlist) مش قائمة منع
// ═══════════════════════════════════════════════════════════════
// كود الأداة المخصصة بيتنفّذ جوه البوت، فبنسمح بالعمليات المعلنة دي بالظبط:
//  • API السياق (ctx): ROOT, safePath, relPath, fs (مقيّد على مجلد المشروع), path,
//    now, log, readText, listDir, exists, axios (بمهلة محدودة)
//  • دوال JS الآمنة (من غير وصول للنظام ولا الشبكة ولا العمليات)
// أي اسم بره القائمة (process, require, eval, child_process, fetch, setTimeout...) = مرفوض،
// وكمان بنرفض أي أمر نظام مكتوب جوّه الكود (rm -rf, curl, npm install, chmod...).
const TOOL_CTX_PROPS = new Set(['ROOT', 'safePath', 'relPath', 'fs', 'path', 'now', 'log', 'readText', 'listDir', 'exists', 'axios'])
const TOOL_ALLOWED_FS = new Set(['readFileSync', 'writeFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync', 'mkdirSync', 'unlinkSync', 'copyFileSync', 'renameSync', 'appendFileSync', 'readFile', 'writeFile', 'readdir', 'stat', 'mkdir', 'unlink', 'copyFile', 'rename', 'appendFile', 'promises'])
const TOOL_ALLOWED_PATH = new Set(['join', 'resolve', 'dirname', 'basename', 'extname', 'relative', 'sep', 'normalize', 'parse', 'format', 'isAbsolute'])
const TOOL_ALLOWED_AXIOS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'request', 'create', 'defaults', 'interceptors'])
const TOOL_ALLOWED_GLOBALS = new Set([
  ...TOOL_CTX_PROPS, 'args', 'ctx', 'console', 'JSON', 'Math', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'Intl', 'ArrayBuffer', 'Uint8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'TextEncoder', 'TextDecoder',
  'URL', 'URLSearchParams', 'structuredClone', 'Buffer', 'Infinity', 'NaN', 'undefined'
])
const TOOL_KEYWORDS = new Set(['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await', 'of', 'static', 'get', 'set', 'true', 'false', 'null', 'this', 'arguments'])
// ⛔ أوامر النظام — مرفوضة حتى لو مكتوبة كنص جوّه الكود
const TOOL_BLOCKED_COMMANDS = [
  { re: /\brm\s+-[a-z]*[rf]/i, msg: 'أوامر الحذف (rm) ممنوعة' },
  { re: /\bcurl\b|\bwget\b/i, msg: 'أوامر الشبكة (curl/wget) ممنوعة' },
  { re: /\bnpm\s+(i|install|add|ci|uninstall)\b|\bnpx\b|\byarn\b|\bpnpm\b/i, msg: 'تثبيت الحزم ممنوع' },
  { re: /\bpip3?\s+install\b|\bapt(-get)?\b|\byum\b|\bapk\b/i, msg: 'تثبيت النظام ممنوع' },
  { re: /\bchmod\b|\bchown\b|\bsudo\b|\bmount\b/i, msg: 'صلاحيات النظام ممنوعة' },
  { re: /\bkill(all)?\b|\bshutdown\b|\breboot\b|\bhalt\b/i, msg: 'أوامر إيقاف النظام ممنوعة' },
  { re: /\bmkfs\b|\bdd\s+if=|\bfdisk\b/i, msg: 'أوامر الأقراص ممنوعة' },
  { re: /shell\s*:\s*(true|1)\b/i, msg: 'تشغيل shell ممنوع' }
]

// 🔧 بنشيل التعليقات والنصوص من الكود قبل الفحص (عشان نحصّي القدرات المستخدمة فعلاً)
function stripToolLiterals(src) {
  const s = String(src || '')
  let out = '', i = 0, prev = '', prevWord = ''
  const regexWords = ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'await', 'yield']
  const setPrev = (ch) => { if (/\s/.test(ch)) return; prev = ch; prevWord = /[\w$]/.test(ch) ? prevWord + ch : '' }
  while (i < s.length) {
    const ch = s[i], nx = s[i + 1]
    if (ch === '/' && nx === '/') { while (i < s.length && s[i] !== '\n') i++; continue }
    if (ch === '/' && nx === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue }
    if (ch === '"' || ch === "'") {
      i++
      while (i < s.length) { if (s[i] === '\\') { i += 2; continue } if (s[i] === ch) { i++; break } i++ }
      out += ' 0 '; setPrev('0'); continue
    }
    if (ch === '`') {
      i++
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue }
        if (s[i] === '`') { i++; break }
        if (s[i] === '$' && s[i + 1] === '{') {
          out += ' ${ '; i += 2; let depth = 1
          while (i < s.length) {
            if (s[i] === '{') { depth++; out += s[i]; i++; continue }
            if (s[i] === '}') { depth--; if (depth === 0) { out += ' } '; i++; break } out += s[i]; i++; continue }
            out += s[i]; i++
          }
          continue
        }
        i++
      }
      out += ' 0 '; setPrev('0'); continue
    }
    if (ch === '/' && (prev === '' || '(,=:[!&|?{;'.includes(prev) || regexWords.includes(prevWord))) {
      i++
      let cls = false
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue }
        if (s[i] === '[') cls = true
        else if (s[i] === ']') cls = false
        else if (s[i] === '/' && !cls) { i++; break }
        else if (s[i] === '\n') break
        i++
      }
      out += ' 0 '; setPrev('0'); continue
    }
    out += ch; setPrev(ch); i++
  }
  return out
}
function charBefore(src, idx) { let i = idx - 1; while (i >= 0 && /\s/.test(src[i])) i--; return i >= 0 ? src[i] : '' }
function charAfter(src, idx) { let i = idx; while (i < src.length && /\s/.test(src[i])) i++; return i < src.length ? src[i] : '' }
// 🧾 الأسماء اللي الكود نفسه معرّفها (متغيرات/دوال/بارامترات) — دي مسموحة
function collectDeclaredNames(src) {
  const names = new Set()
  const add = (n) => { const t = String(n || '').trim().replace(/^\.\.\./, ''); if (/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t) }
  let m
  const declRe = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g
  while ((m = declRe.exec(src))) add(m[1])
  const destrRe = /\b(?:const|let|var)\s*(\{|\[)([^\}\]]*)([\}\]])/g
  while ((m = destrRe.exec(src))) {
    for (const part of m[2].split(',')) {
      const t = part.trim()
      if (!t) continue
      const lhs = t.split('=')[0].trim()
      add(lhs.includes(':') ? lhs.split(':').pop().trim() : lhs)
    }
  }
  const catchRe = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g
  while ((m = catchRe.exec(src))) add(m[1])
  const parenRe = /\(([^()]*)\)/g
  while ((m = parenRe.exec(src))) {
    const start = m.index, end = start + m[0].length
    const after = src.slice(end, end + 4)
    const before = src.slice(Math.max(0, start - 40), start)
    const isArrow = /^\s*=>/.test(after)
    const isFn = /(?:^|[\s;{}])function\s*\*?\s*[A-Za-z_$][\w$]*\s*$/.test(before) || /(?:^|[\s;{}])function\s*\*?\s*$/.test(before)
    if (!isArrow && !isFn) continue
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      if (t.startsWith('{') || t.startsWith('[')) {
        for (const p2 of t.slice(1, -1).split(',')) {
          const t2 = p2.trim()
          if (!t2) continue
          add(t2.includes(':') ? t2.split(':').pop() : t2)
        }
        continue
      }
      add(t.split('=')[0])
    }
  }
  return names
}
// 🔍 الأسماء الحرة (مش خصائص) المستخدمة في الكود
function collectFreeIdentifiers(src) {
  const out = []
  const re = /[A-Za-z_$][\w$]*/g
  let m
  while ((m = re.exec(src))) {
    if (m[0] === '$') continue // علامة قالب السلسلة (${...}) مش اسم متغيّر
    if (charBefore(src, m.index) === '.') continue
    const next = charAfter(src, m.index + m[0].length)
    if (next === ':') {
      const pb = charBefore(src, m.index)
      if (pb === '{' || pb === ',') continue // مفتاح في object literal
    }
    out.push(m[0])
  }
  return out
}
// 🔗 سلاسل الخصائص (ctx.fs.readFileSync) عشان نقيّد الطرق المسموحة
function collectToolChains(src) {
  const chains = []
  const re = /[A-Za-z_$][\w$]*|\./g
  const toks = []
  let m
  while ((m = re.exec(src))) toks.push(m[0])
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '.') continue
    const chain = [toks[i]]
    let j = i + 1
    while (j + 1 < toks.length && toks[j] === '.' && toks[j + 1] !== '.') { chain.push(toks[j + 1]); j += 2 }
    if (chain.length > 1) chains.push(chain)
  }
  return chains
}
// ═══════════════════════════════════════════════════════════════
//  🧱 Structural sandbox v2 — tokenizer + member/assignment analysis
//  القرار مبني على *شكل* الكود (شكل الوصول للخصائص والتعديلات)
//  مش على النصوص: أي مسار يوصل لـ constructor/prototype/__proto__
//  أو يعدّل إعدادات مشتركة (axios.defaults) أو يستورد وحدات = مرفوض.
// ═══════════════════════════════════════════════════════════════
const TOOL_FORBIDDEN_MEMBERS = new Set(['constructor', 'prototype', '__proto__', 'caller', 'callee', 'eval', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'getOwnPropertyNames', 'getOwnPropertySymbols', 'getPrototypeOf', 'setPrototypeOf', 'defineProperty', 'defineProperties'])
const TOOL_BLOCKED_GLOBALS = new Set(['process', 'globalThis', 'global', 'require', 'import', 'eval', 'Function', 'module', 'exports', '__dirname', '__filename', 'WebAssembly', 'Worker', 'SharedWorker', 'SharedArrayBuffer', 'Atomics'])
const TOOL_MUTATION_MEMBERS = new Set(['defaults', 'interceptors'])
const TOOL_DYNAMIC_SAFE_ROOTS = new Set(['args'])
const TOOL_ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??='])
const TOOL_REGEX_BEFORE = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'await', 'yield', 'throw'])
const TOOL_MARKUP_RE = /<\s*\/?\s*(?:iframe|script|object|embed|svg|meta|base)\b|srcdoc\s*=|\bon(?:error|load|click|mouseover|focus)\s*=|javascript\s*:/i
const TOOL_PUNCT = ['>>>=', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>', '{', '}', '(', ')', '[', ']', ';', ',', '.', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '?', ':', '=', '@', '#']

function toolDecodeEscapes(s) {
  return String(s).replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, g) => {
    if (g[0] === 'u') {
      const hex = g[1] === '{' ? g.slice(2, -1) : g.slice(1)
      try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return '' }
    }
    if (g[0] === 'x') { try { return String.fromCharCode(parseInt(g.slice(1), 16)) } catch { return '' } }
    if (g === 'n') return '\n'
    if (g === 't') return '\t'
    if (g === 'r') return '\r'
    if (g === 'b') return '\b'
    if (g === 'f') return '\f'
    if (g === 'v') return '\v'
    if (g === '0') return '\0'
    return g
  })
}
// 🔎 بنلاقي آخر قوس إغلاق لقالب `${ ... }` جوه template literal
function toolFindTemplateExprEnd(s, start) {
  const n = s.length
  let i = start, depth = 0
  while (i < n) {
    const c = s[i]
    if (c === '"' || c === "'") {
      const q = c; i++
      while (i < n) { if (s[i] === '\\') { i += 2; continue } if (s[i] === q) { i++; break } i++ }
      continue
    }
    if (c === '`') {
      i++
      while (i < n) {
        if (s[i] === '\\') { i += 2; continue }
        if (s[i] === '`') { i++; break }
        if (s[i] === '$' && s[i + 1] === '{') { i = toolFindTemplateExprEnd(s, i + 2) + 1; continue }
        i++
      }
      continue
    }
    if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue }
    if (c === '{') { depth++; i++; continue }
    if (c === '}') { if (depth === 0) return i; depth--; i++; continue }
    i++
  }
  return n
}
// 🧪 Tokenizer: بيحوّل الكود لتوكنات (مع فكّ الـ unicode escapes جوّه الأسماء)
function toolTokenize(src) {
  const s = String(src || '')
  const n = s.length
  const tokens = []
  let i = 0
  let line = 1
  let linePos = 0
  const lineAt = (pos) => {
    let l = line
    for (let k = linePos; k < pos && k < n; k++) if (s[k] === '\n') l++
    line = l
    linePos = pos
    return l
  }
  const isIdStart = (c) => /[A-Za-z_$]/.test(c)
  const isIdPart = (c) => /[A-Za-z0-9_$]/.test(c)
  while (i < n) {
    const c = s[i]
    const startPos = i
    if (/\s/.test(c) || c === '\ufeff') { i++; continue }
    if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue }
    if (c === '"' || c === "'") {
      let j = i + 1, out = ''
      while (j < n) {
        if (s[j] === '\\') { out += s[j] + (s[j + 1] || ''); j += 2; continue }
        if (s[j] === c) { j++; break }
        out += s[j]; j++
      }
      tokens.push({ t: 'str', v: toolDecodeEscapes(out), line: lineAt(startPos) })
      i = j
      continue
    }
    if (c === '`') {
      const baseLine = lineAt(startPos)
      let j = i + 1, chunk = ''
      const segs = []
      while (j < n) {
        if (s[j] === '\\') { chunk += s[j] + (s[j + 1] || ''); j += 2; continue }
        if (s[j] === '`') { j++; break }
        if (s[j] === '$' && s[j + 1] === '{') {
          const exprEnd = toolFindTemplateExprEnd(s, j + 2)
          segs.push({ before: chunk, expr: s.slice(j + 2, exprEnd) })
          chunk = ''
          j = exprEnd + 1
          continue
        }
        chunk += s[j]; j++
      }
      const tail = chunk
      if (!segs.length) {
        tokens.push({ t: 'tmplFull', v: toolDecodeEscapes(tail), line: baseLine })
      } else {
        tokens.push({ t: 'tmplStart', v: toolDecodeEscapes(segs[0].before), line: baseLine })
        for (let k = 0; k < segs.length; k++) {
          for (const tk of toolTokenize(segs[k].expr)) { tk.line = baseLine + (tk.line || 1) - 1; tokens.push(tk) }
          const last = k === segs.length - 1
          tokens.push({ t: last ? 'tmplEnd' : 'tmplSeg', v: toolDecodeEscapes(last ? tail : segs[k + 1].before), line: baseLine })
        }
      }
      i = j
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i
      while (j < n) {
        const d = s[j]
        if (/[0-9a-fA-FxXoObBn._]/.test(d)) { j++; continue }
        if ((d === '+' || d === '-') && /[eE]/.test(s[j - 1] || '')) { j++; continue }
        break
      }
      tokens.push({ t: 'num', v: s.slice(i, j), line: lineAt(startPos) })
      i = j
      continue
    }
    if (isIdStart(c) || (c === '\\' && /u/i.test(s[i + 1] || ''))) {
      let j = i, raw = ''
      while (j < n) {
        if (isIdPart(s[j])) { raw += s[j]; j++; continue }
        if (s[j] === '\\' && s[j + 1] === 'u') {
          let k = j + 2, hex = ''
          if (s[k] === '{') { while (k < n && s[k] !== '}') { hex += s[k]; k++ }; k++ } else { hex = s.slice(k, k + 4); k += 4 }
          raw += s.slice(j, k); j = k; continue
        }
        break
      }
      tokens.push({ t: 'id', v: toolDecodeEscapes(raw), line: lineAt(startPos) })
      i = j
      continue
    }
    if (c === '/') {
      const prev = tokens[tokens.length - 1]
      const canBeRegex = !prev || (prev.t === 'punct' && ![')', ']', '}', '++', '--'].includes(prev.v)) || (prev.t === 'id' && TOOL_REGEX_BEFORE.has(prev.v))
      if (canBeRegex) {
        let j = i + 1, inClass = false, closed = false
        while (j < n) {
          const d = s[j]
          if (d === '\\') { j += 2; continue }
          if (d === '\n') break
          if (d === '[') inClass = true
          else if (d === ']') inClass = false
          else if (d === '/' && !inClass) { j++; closed = true; break }
          j++
        }
        if (closed) {
          while (j < n && /[a-z]/i.test(s[j])) j++
          tokens.push({ t: 'regex', v: s.slice(i, j), line: lineAt(startPos) })
          i = j
          continue
        }
      }
      tokens.push({ t: 'punct', v: '/', line: lineAt(startPos) })
      i++
      continue
    }
    let matched = ''
    for (const p of TOOL_PUNCT) if (s.startsWith(p, i)) { matched = p; break }
    if (matched) { tokens.push({ t: 'punct', v: matched, line: lineAt(startPos) }); i += matched.length; continue }
    tokens.push({ t: 'punct', v: c, line: lineAt(startPos) })
    i++
  }
  return tokens
}

// ➕ ثابت نصّي؟ (سلسلة literals متلصقة بـ +) — عشان نكشف الخصائص المخفية
function toolFoldStrings(tokens) {
  let out = '', expect = true
  for (const tk of tokens) {
    if (expect) {
      if (tk.t === 'str') { out += tk.v; expect = false; continue }
      if (tk.t === 'punct' && tk.v === '+') continue
      return null
    }
    if (tk.t === 'punct' && tk.v === '+') { expect = true; continue }
    return null
  }
  return expect ? null : out
}
// 📦 قوس مربّع: بنرجع اسم الخاصية لو ثابت، أو null لو ديناميكي
function toolReadComputed(tokens, i) {
  let depth = 0, j = i
  for (; j < tokens.length; j++) {
    const t = tokens[j]
    if (t.t === 'punct') {
      if (t.v === '[') depth++
      else if (t.v === ']') { depth--; if (depth === 0) break }
    }
  }
  const endIdx = Math.min(j, tokens.length - 1)
  const inner = tokens.slice(i + 1, Math.max(i + 1, endIdx))
  let value = null, dynamic = true
  if (inner.length === 1 && (inner[0].t === 'str' || inner[0].t === 'num')) { value = String(inner[0].v); dynamic = false }
  else {
    const folded = toolFoldStrings(inner)
    if (folded !== null) { value = folded; dynamic = false }
  }
  return { value, dynamic, endIdx }
}
// 🔗 سلاسل الخصائص: root.constructor / ctx.axios.defaults / Object[dynamic]
const TOOL_NO_EXPR_END = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'await', 'yield', 'const', 'let', 'var', 'function', 'class', 'export', 'default', 'if', 'while', 'for', 'switch', 'throw', 'try', 'catch', 'finally', 'import', 'extends', 'static', 'get', 'set', 'async'])
// هل التوكن ده ممكن ينهي تعبير؟ (بيفرّق بين arr[x] و数组 literal [])
function toolCanEndExpression(tk) {
  if (!tk) return false
  if (tk.t === 'id') return !TOOL_NO_EXPR_END.has(tk.v)
  if (tk.t === 'num' || tk.t === 'str' || tk.t === 'regex' || tk.t.startsWith('tmpl')) return true
  if (tk.t === 'punct') return tk.v === ')' || tk.v === ']' || tk.v === '}' || tk.v === '++' || tk.v === '--'
  return false
}
function toolBuildChains(tokens) {
  const chains = []
  let cur = null
  const close = (endIdx) => { if (cur) { cur.endIdx = endIdx; chains.push(cur); cur = null } }
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    if (tk.t === 'id') {
      close(i - 1)
      cur = { names: [tk.v], computed: [false], root: tk.v, startIdx: i, endIdx: i }
      continue
    }
    if (tk.t === 'punct' && (tk.v === '.' || tk.v === '?.')) {
      const nx = tokens[i + 1]
      if (nx && nx.t === 'id') {
        if (!cur) cur = { names: [], computed: [], root: null, startIdx: i + 1, endIdx: i + 1 }
        cur.names.push(nx.v); cur.computed.push(false); cur.endIdx = i + 1
        i++
        continue
      }
      close(i - 1)
      continue
    }
    if (tk.t === 'punct' && tk.v === '[') {
      if (!toolCanEndExpression(tokens[i - 1])) { close(i - 1); continue } // ده array literal مش وصول لخاصية
      const res = toolReadComputed(tokens, i)
      if (!cur) cur = { names: [], computed: [], root: null, startIdx: i + 1, endIdx: res.endIdx }
      cur.names.push(res.value); cur.computed.push(res.dynamic); cur.endIdx = res.endIdx
      i = res.endIdx
      continue
    }
    close(i - 1)
  }
  close(tokens.length - 1)
  return chains
}
// ✏️ عمليات الإسناد (الهدف + الطرف الأيمن)
function toolFindAssignments(tokens, chains) {
  const byEnd = new Map()
  for (const ch of chains) byEnd.set(ch.endIdx, ch)
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    if (tk.t !== 'punct' || !TOOL_ASSIGN_OPS.has(tk.v)) continue
    let depth = 0, end = tokens.length
    for (let j = i + 1; j < tokens.length; j++) {
      const t2 = tokens[j]
      if (t2.t !== 'punct') continue
      if (t2.v === '(' || t2.v === '[' || t2.v === '{') depth++
      else if (t2.v === ')' || t2.v === ']' || t2.v === '}') depth--
      else if (t2.v === ';' && depth <= 0) { end = j; break }
    }
    const rhs = chains.filter((ch) => ch.startIdx > i && ch.startIdx < end)
    out.push({ op: tk.v, target: byEnd.get(i - 1) || null, rhs })
  }
  return out
}
// 📞 وسائط الاستدعاءات (لو حد مرّر كائن مشترك لدالة يقدر يعدّله)
function toolFindCallArgs(tokens, chains) {
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    if (tk.t !== 'punct' || tk.v !== '(') continue
    let depth = 0, j = i
    for (; j < tokens.length; j++) {
      const t2 = tokens[j]
      if (t2.t !== 'punct') continue
      if (t2.v === '(' || t2.v === '[' || t2.v === '{') depth++
      else if (t2.v === ')' || t2.v === ']' || t2.v === '}') { depth--; if (depth === 0) break }
    }
    out.push(chains.filter((ch) => ch.startIdx > i && ch.startIdx < j))
  }
  return out
}
// 🛡️ كائن مشترك (axios/إعداداته) — أي تعديل أو تمرير له ممنوع
function toolHasSharedMember(ch) {
  if (!ch || !ch.names) return false
  for (const nm of ch.names) if (nm && TOOL_MUTATION_MEMBERS.has(nm)) return true
  return false
}
// 🎯 هدف الإسناد: أي كتابة على كائن مشترك ممنوعة
function toolIsSharedTarget(ch) {
  if (!ch || !ch.names || !ch.names.length) return false
  if (toolHasSharedMember(ch)) return true
  if (ch.root === 'axios' && ch.names.length >= 2) return true
  if (ch.root === 'ctx' && ch.names.length >= 3 && ch.names[1] === 'axios') return true
  return false
}
// ✅ صياغة الكود لازم تكون JavaScript صالحة (المدخلات الناقصة/المكسورة = مرفوضة)
function toolEscapeTemplate(v) {
  return String(v == null ? '' : v).replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${')
}
function toolCodeParses(tokens) {
  try {
    const parts = []
    let line = 0
    const pushNl = (tk) => { const l = tk.line || 0; if (l > line) { parts.push('\n'); line = l } }
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i]
      if (tk.t === 'id' && tk.v === 'export') {
        const nx = tokens[i + 1]
        if (nx && nx.t === 'id' && nx.v === 'default') { pushNl(tk); parts.push('const __agentToolDefault ='); line = nx.line || line; i++; continue }
        if (nx && nx.t === 'punct' && nx.v === '{') {
          let depth = 0
          while (i < tokens.length) { const t2 = tokens[i]; if (t2.t === 'punct' && t2.v === '{') depth++; else if (t2.t === 'punct' && t2.v === '}') { depth--; if (depth === 0) { i++; break } } i++ }
          parts.push('0')
          continue
        }
        continue
      }
      if (tk.t === 'tmplFull') { pushNl(tk); parts.push('`' + toolEscapeTemplate(tk.v) + '`'); continue }
      if (tk.t === 'tmplStart') { pushNl(tk); parts.push('`' + toolEscapeTemplate(tk.v) + '${'); continue }
      if (tk.t === 'tmplSeg') { pushNl(tk); parts.push('}' + toolEscapeTemplate(tk.v) + '${'); continue }
      if (tk.t === 'tmplEnd') { pushNl(tk); parts.push('}' + toolEscapeTemplate(tk.v) + '`'); continue }
      pushNl(tk)
      if (tk.t === 'id' || tk.t === 'punct') parts.push(tk.v)
      else parts.push('0')
    }
    new vm.Script('(async()=>{' + parts.join(' ') + '})', { filename: 'agent-tool.js', produceCachedData: false })
    return true
  } catch { return false }
}

// 🧨 الفحص البنيوي — القرار مش نصّي: بنشوف إيه اللي الكود بيعمله فعلاً
function toolStructuralCheck(raw) {
  const tokens = toolTokenize(raw)
  // 0) أي ذكر لـ __proto__ (متغير أو نص) ممنوع — تلويث النماذج الأولية
  if (raw.includes('__proto__')) return 'غير مسموح: تلويث النماذج الأولية (__proto__) ممنوع'
  // 1) أسماء محظورة (process/require/import/eval/Function/globalThis...) — الاسم الحر بس
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    if (tk.t !== 'id') continue
    const prev = tokens[i - 1]
    const next = tokens[i + 1]
    const isProp = prev && prev.t === 'punct' && (prev.v === '.' || prev.v === '?.')
    const isKey = next && next.t === 'punct' && next.v === ':'
    if (TOOL_BLOCKED_GLOBALS.has(tk.v) && !isProp) return 'غير مسموح: "' + tk.v + '" غير متاح داخل الأدوات'
    if (tk.v === '__proto__' && !isProp) return 'غير مسموح: تلويث النماذج الأولية (__proto__) ممنوع'
    // اسم خطير مستخدم كاسم متغيّر/مفتاح (زي const { constructor: c } = x) — مرفوض كمان
    if (TOOL_FORBIDDEN_MEMBERS.has(tk.v) && !isProp) return 'غير مسموح: الوصول إلى "' + tk.v + '" ممنوع داخل الأدوات'
    if (isProp || isKey) continue
  }
  const chains = toolBuildChains(tokens)
  // 2) أي وصول لخصائص خطرة (constructor/prototype/__proto__/caller/callee/eval) — بأي root
  for (const ch of chains) {
    for (const nm of ch.names) {
      if (nm == null) continue
      if (TOOL_FORBIDDEN_MEMBERS.has(nm)) return 'غير مسموح: الوصول إلى "' + nm + '" ممنوع داخل الأدوات'
    }
  }
  // 3) وصول ديناميكي لخصائص كائن مسموح (Object[x] / ctx.fs[fn]) — مش بنعرف إيه اللي هيتنفّذ
  for (const ch of chains) {
    const root = ch.root
    if (root && (!TOOL_ALLOWED_GLOBALS.has(root) || TOOL_DYNAMIC_SAFE_ROOTS.has(root))) continue
    for (let k = root ? 1 : 0; k < ch.names.length; k++) {
      if (ch.computed[k] && ch.names[k] == null) return 'غير مسموح: الوصول الديناميكي لخصائص "' + (root || 'قيمة مُقوَّمة') + '" ممنوع داخل الأدوات'
    }
  }
  // 4) نفس قائمة السماح للخصائص (ctx/fs/path/axios) — وبتشمل الخصائص المحسوبة
  for (const ch of chains) {
    const root = ch.root
    if (!root || !ch.names.length) continue
    const m1 = ch.names[1]
    if (m1 == null) continue
    if (root === 'fs' && !TOOL_ALLOWED_FS.has(m1)) return 'غير مسموح: fs.' + m1 + ' ممنوعة'
    if (root === 'path' && !TOOL_ALLOWED_PATH.has(m1)) return 'غير مسموح: path.' + m1 + ' ممنوعة'
    if (root === 'axios' && !TOOL_ALLOWED_AXIOS.has(m1)) return 'غير مسموح: axios.' + m1 + ' ممنوعة'
    if (root === 'ctx') {
      if (!TOOL_CTX_PROPS.has(m1)) return 'غير مسموح: ctx.' + m1 + ' مش متاحة'
      const m2 = ch.names[2]
      if (m2 == null) continue
      if (m1 === 'fs' && !TOOL_ALLOWED_FS.has(m2)) return 'غير مسموح: ctx.fs.' + m2 + ' ممنوعة'
      if (m1 === 'path' && !TOOL_ALLOWED_PATH.has(m2)) return 'غير مسموح: ctx.path.' + m2 + ' ممنوعة'
      if (m1 === 'axios' && !TOOL_ALLOWED_AXIOS.has(m2)) return 'غير مسموح: ctx.axios.' + m2 + ' ممنوعة'
    }
  }
  // 5) أي تعديل على إعدادات axios المشتركة (defaults/interceptors) أو تمريرها لدالة
  for (const a of toolFindAssignments(tokens, chains)) {
    if (toolIsSharedTarget(a.target)) return 'غير مسموح: تعديل الإعدادات المشتركة (axios/prototype) ممنوع'
    for (const r of a.rhs) if (toolHasSharedMember(r)) return 'غير مسموح: تعديل الإعدادات المشتركة (axios/prototype) ممنوع'
  }
  for (const args of toolFindCallArgs(tokens, chains)) {
    for (const a of args) if (toolHasSharedMember(a)) return 'غير مسموح: تمرير إعدادات مشتركة لدالة ممنوع'
  }
  // 6) لازم يكون الكود JavaScript صالحة (مدخلات ناقصة/مشكلة = مرفوضة)
  if (!toolCodeParses(tokens)) return 'غير مسموح: صياغة الكود غير صالحة'
  return null
}
// ═══════════════════════════════════════════════════════════════════════════
//  🔒 VM execution gate — the allowlist is enforced by an isolated realm
// ═══════════════════════════════════════════════════════════════════════════
// The structural checks above are useful, but they cannot follow a value through
// a local alias (for example: const f = ctx.readText; f[args.key]).  The gate
// below therefore executes the candidate in node:vm with a contextified global
// Proxy.  Dangerous globals are absent/behind throwing accessors and every
// host value crossing the boundary is wrapped in a member-checking Proxy.
const TOOL_VM_DENIED_GLOBALS = new Set([
  'constructor', 'getBuiltinModule', 'require', 'import', 'process', 'fs', 'child_process', 'net', 'http',
  'Function', 'eval', 'globalThis', '__proto__', 'global', 'module', 'exports', '__dirname', '__filename',
  'WebAssembly', 'Worker', 'SharedWorker', 'SharedArrayBuffer', 'Atomics', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'queueMicrotask', 'Proxy', 'Reflect'
])
const TOOL_VM_DENIED_MEMBERS = new Set([
  'constructor', 'prototype', '__proto__', 'caller', 'callee', 'getBuiltinModule', 'require', 'import',
  'process', 'fs', 'child_process', 'net', 'http', 'Function', 'eval', 'globalThis', 'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors', 'getOwnPropertyNames', 'getOwnPropertySymbols', 'getPrototypeOf', 'setPrototypeOf',
  'defineProperty', 'defineProperties', 'call', 'apply', 'bind', 'defaults', 'interceptors',
  '__lookupGetter__', '__lookupSetter__', '__defineGetter__', '__defineSetter__'
])
const TOOL_VM_ALLOWED_GLOBALS = new Set(TOOL_ALLOWED_GLOBALS)
// fs is available only as ctx.fs (the restricted facade), never as a host global.
TOOL_VM_ALLOWED_GLOBALS.delete('fs')
const TOOL_VM_RUNTIME_AXIOS = new Set([...TOOL_ALLOWED_AXIOS].filter((name) => name !== 'defaults' && name !== 'interceptors'))

function toolSandboxDenied(message) {
  const err = new Error(message)
  err.code = 'TOOL_SANDBOX_DENIED'
  return err
}

function toolTransformModuleSource(raw, internalName) {
  let src = String(raw || '')
  // ESM exports are rewritten to lexical declarations so vm.Script can run the
  // same source without enabling dynamic import/require in the sandbox.
  src = src.replace(/\bexport\s+default\b/g, 'const ' + internalName + ' =')
  src = src.replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/g, '')
  return src
}

function toolMakeCallbackProxy(callback, options = {}) {
  if (typeof callback !== 'function') return callback
  const cache = options.cache || new WeakMap()
  const onDenied = options.onDenied || (() => {})
  const wrap = (item) => toolMakeHostProxy(item, { cache, onDenied })
  return function toolSandboxCallback(...args) {
    try {
      const safeThis = wrap(this)
      const safeArgs = args.map((item) => wrap(item))
      return wrap(callback.apply(safeThis, safeArgs))
    } catch (error) {
      // A host exception must never cross the vm boundary as a raw host Error:
      // its constructor chain would be a direct vm-escape primitive.
      if (typeof error === 'string') throw error
      throw wrap(error)
    }
  }
}

function toolIsPlainRecord(value) {
  if (!value || typeof value !== 'object') return false
  // Object#toString works across vm realms, unlike identity checks against the
  // host realm's Object.prototype.
  return Object.prototype.toString.call(value) === '[object Object]'
}

// Axios accepts callbacks in nested config fields (transformResponse,
// validateStatus, adapter, progress handlers, ...).  Those callbacks are invoked
// by host code and would otherwise receive raw host objects.  Clone plain config
// records and replace every nested function with a boundary-safe callback.
function toolSanitizeAxiosValue(value, options = {}, seen = new WeakMap()) {
  if (typeof value === 'function') return toolMakeCallbackProxy(value, options)
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const out = []
    seen.set(value, out)
    for (const item of value) out.push(toolSanitizeAxiosValue(item, options, seen))
    return out
  }
  if (!toolIsPlainRecord(value)) return value
  const out = Object.create(null)
  seen.set(value, out)
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    out[key] = toolSanitizeAxiosValue(value[key], options, seen)
  }
  return out
}

function toolSanitizeAxiosArgs(args, method, options = {}) {
  const configIndex = { request: 0, create: 0, get: 1, delete: 1, head: 1, post: 2, put: 2, patch: 2 }[method]
  return args.map((arg, index) => {
    if (typeof arg === 'function') return toolMakeCallbackProxy(arg, options)
    if (configIndex === index) return toolSanitizeAxiosValue(arg, options)
    if ((method === 'post' || method === 'put' || method === 'patch') && index === 1) {
      return toolSanitizeAxiosValue(arg, options)
    }
    return arg
  })
}

function toolMakeHostProxy(value, options = {}) {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return value
  const isPromise = options.kind !== 'promise' && (value instanceof Promise || Object.prototype.toString.call(value) === '[object Promise]')
  if (isPromise) return toolMakePromiseProxy(value, options)
  const cache = options.cache || new WeakMap()
  if (cache.has(value)) return cache.get(value)
  const allowed = options.allowed || null
  const kind = options.kind || 'generic'
  const onDenied = options.onDenied || (() => {})
  const deny = (prop) => {
    const reason = 'غير مسموح: الوصول إلى "' + String(prop) + '" ممنوع داخل بيئة الأدوات'
    onDenied(reason)
    // Throw a primitive, not a host Error.  If candidate code catches this
    // failure, a raw Error would expose its host constructor chain.
    throw reason
  }
  const wrap = (item, nextOptions = {}) => toolMakeHostProxy(item, {
    cache,
    onDenied,
    ...nextOptions
  })
  const rethrowSafe = (error) => {
    if (typeof error === 'string') throw error
    throw wrap(error)
  }
  const proxy = new Proxy(value, {
    get(target, prop) {
      try {
        if (typeof prop !== 'string') return wrap(Reflect.get(target, prop, target))
        if (allowed && !allowed.has(prop)) deny(prop)
        if (TOOL_VM_DENIED_MEMBERS.has(prop) && !(kind === 'ctx' && prop === 'fs')) deny(prop)
        const current = Reflect.get(target, prop, target)
        if (kind === 'ctx' && prop === 'fs') return wrap(current, { allowed: TOOL_ALLOWED_FS, kind: 'fs' })
        if (kind === 'ctx' && prop === 'path') return wrap(current, { allowed: TOOL_ALLOWED_PATH, kind: 'path' })
        if (kind === 'ctx' && prop === 'axios') return wrap(current, { allowed: TOOL_VM_RUNTIME_AXIOS, kind: 'axios' })
        if (kind === 'axios') return wrap(current, { allowed: TOOL_VM_RUNTIME_AXIOS, kind: 'axios', method: prop })
        return wrap(current)
      } catch (error) {
        return rethrowSafe(error)
      }
    },
    set(target, prop) {
      deny(prop)
      return false
    },
    deleteProperty(target, prop) {
      deny(prop)
      return false
    },
    defineProperty(target, prop) {
      deny(prop)
      return false
    },
    has(target, prop) {
      if (typeof prop === 'string' && TOOL_VM_DENIED_MEMBERS.has(prop)) deny(prop)
      return Reflect.has(target, prop)
    },
    apply(target, _thisArg, args) {
      try {
        const safeArgs = kind === 'axios'
          ? toolSanitizeAxiosArgs(args, options.method, { cache, onDenied })
          : args.map((item) => typeof item === 'function' ? toolMakeCallbackProxy(item, { cache, onDenied }) : item)
        return wrap(Reflect.apply(target, target, safeArgs))
      } catch (error) {
        return rethrowSafe(error)
      }
    },
    construct(target, args) {
      try {
        return wrap(Reflect.construct(target, args, target))
      } catch (error) {
        return rethrowSafe(error)
      }
    }
  })
  cache.set(value, proxy)
  return proxy
}

function toolMakePromiseProxy(value, options = {}) {
  const cache = options.cache || new WeakMap()
  const onDenied = options.onDenied || (() => {})
  const wrap = (item) => toolMakeHostProxy(item, { cache, onDenied })
  const thenHost = (onFulfilled, onRejected) => {
    const next = value.then(
      (item) => { if (typeof onFulfilled === 'function') onFulfilled(wrap(item)) },
      (error) => { if (typeof onRejected === 'function') onRejected(wrap(error)) }
    )
    return toolMakePromiseProxy(next, { cache, onDenied })
  }
  const target = {
    then: thenHost,
    catch: (onRejected) => thenHost(null, onRejected),
    finally: (onFinally) => value.finally((item) => { if (typeof onFinally === 'function') onFinally(wrap(item)) })
  }
  return toolMakeHostProxy(target, { cache, onDenied, kind: 'promise' })
}

function toolCreateVmSandbox(axiosClient) {
  const seed = vm.createContext(Object.create(null))
  const rawGlobal = vm.runInContext('globalThis', seed)
  const state = { denied: false, reason: '' }
  const internalNames = new Set()
  const markDenied = (reason) => {
    if (!state.denied) state.reason = String(reason || 'غير مسموح: عملية محظورة داخل بيئة الأدوات')
    state.denied = true
  }
  const markName = '__agentMarkDenied_' + Math.random().toString(36).slice(2)
  internalNames.add(markName)
  rawGlobal[markName] = markDenied
  const deny = (prop) => {
    const reason = 'غير مسموح: "' + String(prop) + '" غير متاح داخل بيئة الأدوات'
    markDenied(reason)
    // Keep the rejection value primitive so a caught denial cannot expose a
    // host Error constructor chain.
    throw reason
  }
  const globalProxy = new Proxy(rawGlobal, {
    get(target, prop) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, target)
      if (internalNames.has(prop)) return Reflect.get(target, prop, target)
      if (TOOL_VM_DENIED_GLOBALS.has(prop)) deny(prop)
      if (!TOOL_VM_ALLOWED_GLOBALS.has(prop)) deny(prop)
      return Reflect.get(target, prop, target)
    },
    has(target, prop) {
      if (typeof prop === 'string') {
        if (internalNames.has(prop)) return Reflect.has(target, prop)
        if (TOOL_VM_DENIED_GLOBALS.has(prop) || !TOOL_VM_ALLOWED_GLOBALS.has(prop)) deny(prop)
      }
      return Reflect.has(target, prop)
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && TOOL_VM_DENIED_GLOBALS.has(prop)) deny(prop)
      return Reflect.set(target, prop, value, target)
    }
  })
  const context = vm.createContext(globalProxy, {
    name: 'agent-tool-sandbox',
    codeGeneration: { strings: false, wasm: false }
  })

  // Poison the built-in prototypes in this realm.  This closes local-object
  // paths such as ({}).constructor and fn.prototype.constructor even when the
  // key was assembled at runtime.
  const hardenScript = `(() => {
    const mark = ${markName}
    const denied = (name) => {
      mark('غير مسموح: الوصول إلى "' + name + '" ممنوع داخل بيئة الأدوات')
      throw new Error('غير مسموح: الوصول إلى "' + name + '" ممنوع داخل بيئة الأدوات')
    }
    const patch = (proto, keys = ['constructor', '__proto__', 'caller', 'callee']) => {
      if (!proto || (typeof proto !== 'object' && typeof proto !== 'function')) return
      for (const key of keys) {
        try {
          const old = Object.getOwnPropertyDescriptor(proto, key)
          Object.defineProperty(proto, key, {
            configurable: false,
            enumerable: old ? old.enumerable : false,
            get() { return denied(key) },
            set() { return denied(key) }
          })
        } catch {}
      }
      try { Object.freeze(proto) } catch {}
    }
    const roots = [Object, Function, Array, String, Number, Boolean, RegExp, Date, Error, TypeError,
      RangeError, SyntaxError, Map, Set, WeakMap, WeakSet, Promise, ArrayBuffer,
      Uint8Array, Int16Array, Int32Array, Float32Array, Float64Array]
    for (const root of roots) {
      const keys = root === Promise ? ['__proto__', 'caller', 'callee'] : undefined
      try { patch(root.prototype, keys) } catch {}
      try { patch(Object.getPrototypeOf(root.prototype), keys) } catch {}
    }
  })()`
  // The hardening script itself needs the realm's Function constructor; that
  // single setup lookup is removed before any candidate code is evaluated.
  internalNames.add('Function')
  vm.runInContext(hardenScript, context, { timeout: 1000 })
  internalNames.delete('Function')

  const hostCache = new WeakMap()
  const wrapGlobal = (name, value, options = {}) => {
    rawGlobal[name] = toolMakeHostProxy(value, { cache: hostCache, onDenied: markDenied, ...options })
  }
  const contextBuiltins = [
    'Object', 'Array', 'JSON', 'Math', 'Date', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError',
    'RangeError', 'SyntaxError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Intl', 'ArrayBuffer',
    'Uint8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI'
  ]
  for (const name of contextBuiltins) {
    if (rawGlobal[name] !== undefined) wrapGlobal(name, rawGlobal[name])
  }
  const hostGlobals = {
    Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    structuredClone
  }
  for (const [name, value] of Object.entries(hostGlobals)) {
    if (value !== undefined) wrapGlobal(name, value)
  }
  const quietConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {} }
  wrapGlobal('console', quietConsole)
  wrapGlobal('path', path, { allowed: TOOL_ALLOWED_PATH, kind: 'path' })
  wrapGlobal('axios', axiosClient || { get() { return {} }, post() { return {} } }, { allowed: TOOL_VM_RUNTIME_AXIOS, kind: 'axios' })

  const setInternal = (name, value) => {
    internalNames.add(name)
    rawGlobal[name] = value
  }
  const clearInternal = (name) => {
    internalNames.delete(name)
    try { delete rawGlobal[name] } catch {}
  }
  return { context, rawGlobal, state, markDenied, setInternal, clearInternal }
}

function toolMakeFakeToolContext() {
  const fakeStat = { size: 1, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
  const fakeFs = {
    readFileSync: (p) => {
      if (String(p || '').includes('__missing_host_error__')) throw new Error('ENOENT: probe host error')
      return 'probe-file'
    },
    writeFileSync: () => undefined, appendFileSync: () => undefined,
    readdirSync: () => ['package.json'], existsSync: () => true, statSync: () => fakeStat,
    lstatSync: () => fakeStat, mkdirSync: () => undefined, unlinkSync: () => undefined,
    copyFileSync: () => undefined, renameSync: () => undefined, readFile: async () => 'probe-file',
    writeFile: async () => undefined, readdir: async () => ['package.json'], stat: async () => fakeStat,
    mkdir: async () => undefined, unlink: async () => undefined, copyFile: async () => undefined,
    rename: async () => undefined, appendFile: async () => undefined,
    promises: {
      readFile: async () => 'probe-file', writeFile: async () => undefined, readdir: async () => ['package.json'],
      stat: async () => fakeStat, mkdir: async () => undefined, unlink: async () => undefined,
      copyFile: async () => undefined, rename: async () => undefined, appendFile: async () => undefined
    }
  }
  const fakeHeaders = { get: () => null, set: () => undefined, has: () => false }
  const fakeResponse = (config) => {
    const response = { data: 'probe', status: 200, headers: fakeHeaders, config: config || {} }
    let transforms = config?.transformResponse
    if (typeof transforms === 'function') transforms = [transforms]
    if (Array.isArray(transforms)) {
      for (const transform of transforms) {
        if (typeof transform === 'function') response.data = transform(response.data, response.headers, response)
      }
    }
    return response
  }
  const fakeAxios = {
    get: (_url, config) => fakeResponse(config),
    post: (_url, _data, config) => fakeResponse(config),
    put: (_url, _data, config) => fakeResponse(config),
    patch: (_url, _data, config) => fakeResponse(config),
    delete: (_url, config) => fakeResponse(config),
    head: (_url, config) => fakeResponse(config),
    request: (config) => fakeResponse(config),
    create: () => fakeAxios
  }
  return {
    ROOT: '/probe-root', safePath: (p) => String(p), relPath: (p) => String(p), fs: fakeFs, path,
    now: () => 0, log: () => {}, readText: (p) => 'probe:' + String(p), listDir: () => ['package.json'],
    exists: () => true, axios: fakeAxios
  }
}

function toolCompileSandboxedSource(raw, axiosClient) {
  const sandbox = toolCreateVmSandbox(axiosClient)
  const internalName = '__agentToolDefault_' + Math.random().toString(36).slice(2)
  const source = toolTransformModuleSource(raw, internalName)
  try {
    const script = new vm.Script(source, { filename: 'agent-tool-sandbox.js', produceCachedData: false })
    script.runInContext(sandbox.context, { timeout: 1000 })
    const fn = vm.runInContext(internalName, sandbox.context)
    if (typeof fn !== 'function') throw new Error('default export is not a function')
    const metadata = {}
    for (const name of ['description', 'args_schema', 'example']) {
      if (!new RegExp('\\bexport\\s+const\\s+' + name + '\\b').test(String(raw || ''))) continue
      try {
        const value = vm.runInContext(name, sandbox.context)
        if (name === 'args_schema') {
          try { metadata[name] = JSON.parse(JSON.stringify(value)) } catch { metadata[name] = {} }
        } else metadata[name] = String(value == null ? '' : value)
      } catch {}
    }
    return { ...sandbox, fn, internalName, metadata }
  } catch (e) {
    if (sandbox.state.denied) return { ...sandbox, error: sandbox.state.reason }
    return { ...sandbox, error: 'صياغة الكود غير صالحة داخل بيئة الفحص' }
  }
}

async function toolExecutionGateAsync(raw) {
  const fakeCtx = toolMakeFakeToolContext()
  const fakeAxios = fakeCtx.axios
  const compiled = toolCompileSandboxedSource(raw, fakeAxios)
  if (compiled.error) return 'غير مسموح: ' + compiled.error
  const argsName = '__agentProbeArgs_' + Math.random().toString(36).slice(2)
  const ctxName = '__agentProbeCtx_' + Math.random().toString(36).slice(2)
  const cache = new WeakMap()
  const wrappedArgs = toolMakeHostProxy({ k: 'constructor', n: 2, list: [1, 2, 3] }, { cache, onDenied: compiled.markDenied })
  const wrappedCtx = toolMakeHostProxy(fakeCtx, {
    cache, onDenied: compiled.markDenied, allowed: TOOL_CTX_PROPS, kind: 'ctx'
  })
  compiled.setInternal(argsName, wrappedArgs)
  compiled.setInternal(ctxName, wrappedCtx)
  let result
  try {
    result = vm.runInContext(compiled.internalName + '(' + argsName + ',' + ctxName + ')', compiled.context, { timeout: 250 })
  } catch (e) {
    compiled.clearInternal(argsName)
    compiled.clearInternal(ctxName)
    if (compiled.state.denied) return 'غير مسموح: ' + compiled.state.reason
    return 'غير مسموح: فشل تنفيذ الكود داخل بيئة الفحص المعزولة'
  }
  compiled.clearInternal(argsName)
  compiled.clearInternal(ctxName)
  if (compiled.state.denied) return 'غير مسموح: ' + compiled.state.reason
  if (result && typeof result.then === 'function') {
    let timer = null
    // Bridge the vm-realm promise explicitly.  Passing it directly to a host
    // Promise would call the foreign Promise.prototype.then with the wrong
    // receiver and turn a pending tool into a misleading receiver error.
    const bridged = new Promise((resolve, reject) => {
      try { result.then(resolve, reject) } catch (error) { reject(error) }
    })
    const outcome = await Promise.race([
      bridged.then(
        () => ({ ok: true }),
        (error) => ({ ok: false, error })
      ),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ timeout: true }), 1000) })
    ])
    if (timer) clearTimeout(timer)
    if (outcome.timeout) return 'غير مسموح: لم تكتمل نتيجة الكود داخل بيئة الفحص المعزولة'
    if (!outcome.ok) return 'غير مسموح: ' + (outcome.error?.message || 'فشل تنفيذ الكود داخل بيئة الفحص المعزولة')
  }
  if (compiled.state.denied) return 'غير مسموح: ' + compiled.state.reason
  return null
}

// safetyCheckToolCode predates async/await and is a synchronous public API.
// Run the async vm gate in a short-lived, shell-free Node child so the parent
// can preserve that contract without overlooking a rejection after `await`.
const TOOL_VM_CHILD_BOOTSTRAP = `
import fs from 'node:fs'
const mod = await import(process.env.T27_VM_AGENT_URL)
const raw = fs.readFileSync(0, 'utf8')
const verdict = await mod.toolExecutionGateAsync(raw)
process.stdout.write('\\n__T27_VM_VERDICT__' + JSON.stringify(verdict))
process.exit(0)
`
function toolExecutionGate(raw) {
  try {
    const input = String(raw || '')
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', TOOL_VM_CHILD_BOOTSTRAP], {
      input,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, T27_VM_AGENT_URL: new URL(import.meta.url).href },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const marker = '__T27_VM_VERDICT__'
    const at = output.lastIndexOf(marker)
    if (at < 0) return 'غير مسموح: لم ترجع بيئة الفحص المعزولة بنتيجة'
    const verdict = JSON.parse(output.slice(at + marker.length))
    return typeof verdict === 'string' ? verdict : null
  } catch (e) {
    return 'غير مسموح: تعذر إكمال فحص الكود داخل البيئة المعزولة'
  }
}

function safetyCheckToolCode(code) {
  const raw = String(code || '')
  if (!raw.trim()) return 'غير مسموح: الكود فاضي'
  if (raw.length > 500 * 1024) return 'غير مسموح: الكود أكبر من 500KB'
  // 1) أوامر النظام (بنفحص النص الخام)
  for (const b of TOOL_BLOCKED_COMMANDS) if (b.re.test(raw)) return 'غير مسموح: ' + b.msg
  // 1.2) وسوم HTML/JS مضمّنة (مفيش ليها معنى جوه JS ودي مسار حقن)
  if (TOOL_MARKUP_RE.test(raw)) return 'غير مسموح: وسوم HTML/JS مضمّنة ممنوعة داخل الأدوات'
  // 1.3) الفحص البنيوي: القرار مبني على شكل الكود (سلاسل الخصائص/التعديلات/الاستيرادات)
  const structural = toolStructuralCheck(raw)
  if (structural) return structural
  const src = stripToolLiterals(raw)
  // 1.5) ممنوع أي import (ثابت أو ديناميكي) — الأداة بتاخد كل حاجة من ctx
  if (/\bimport\b/.test(src)) return 'غير مسموح: الاستيراد (import) ممنوع داخل الأدوات'
  const declared = collectDeclaredNames(src)
  // 2) كل اسم لازم يكون معرّف جوّه الكود أو ضمن القائمة المسموحة
  for (const id of collectFreeIdentifiers(src)) {
    if (TOOL_KEYWORDS.has(id)) continue
    if (declared.has(id)) continue
    if (TOOL_ALLOWED_GLOBALS.has(id)) continue
    return 'غير مسموح: "' + id + '" بره قائمة العمليات المسموحة'
  }
  // 3) الطرق الممنوعة على fs/path/axios/ctx
  for (const chain of collectToolChains(src)) {
    const root = chain[0]
    if (root === 'fs' && chain.length > 1 && !TOOL_ALLOWED_FS.has(chain[1])) return 'غير مسموح: fs.' + chain[1] + ' ممنوعة'
    if (root === 'path' && chain.length > 1 && !TOOL_ALLOWED_PATH.has(chain[1])) return 'غير مسموح: path.' + chain[1] + ' ممنوعة'
    if (root === 'axios' && chain.length > 1 && !TOOL_ALLOWED_AXIOS.has(chain[1])) return 'غير مسموح: axios.' + chain[1] + ' ممنوعة'
    if (root === 'ctx' && chain.length > 1 && !TOOL_CTX_PROPS.has(chain[1])) return 'غير مسموح: ctx.' + chain[1] + ' مش متاحة'
  }
  // 4) gate terakhir: the candidate must also run successfully in the locked
  // vm realm.  This catches dynamic aliases that the structural pass cannot
  // connect back to a forbidden global.
  const vmErr = toolExecutionGate(raw)
  if (vmErr) return vmErr
  return null
}
async function loadCustomTool(name) {
  const fp = path.join(TOOLS_DIR, name + '.js')
  if (!fs.existsSync(fp)) return null
  try {
    // 🛡️ نفس صندوق الأدوات بيتطبّق على أي ملف أداة موجود في المجلد (مش بس اللي اتعمل من الشات)
    let code = ''
    try { code = fs.readFileSync(fp, 'utf8') } catch {}
    const secErr = safetyCheckToolCode(code)
    if (secErr) { console.error('[agent-tool load] مرفوض أمنيًا:', name, secErr); return null }
    // Do not import custom tools into the host realm.  The approved module is
    // evaluated and executed in the same isolated vm realm used by the gate.
    const compiled = toolCompileSandboxedSource(code, toolAxios)
    if (compiled.error) { console.error('[agent-tool load] مرفوض أمنيًا:', name, compiled.error); return null }
    const run = async (args, ctx) => {
      const cache = new WeakMap()
      const wrappedArgs = toolMakeHostProxy(args || {}, { cache, onDenied: compiled.markDenied })
      const wrappedCtx = toolMakeHostProxy(ctx || {}, {
        cache, onDenied: compiled.markDenied, allowed: TOOL_CTX_PROPS, kind: 'ctx'
      })
      const result = await compiled.fn(wrappedArgs, wrappedCtx)
      if (compiled.state.denied) throw toolSandboxDenied(compiled.state.reason)
      return result
    }
    const tool = {
      name,
      description: compiled.metadata.description || '(بدون وصف)',
      argsSchema: compiled.metadata.args_schema || {},
      example: compiled.metadata.example || '',
      file: name + '.js',
      run
    }
    customTools.set(name, tool)
    return tool
  } catch (e) { console.error('[agent-tool load]', name, e?.message); return null }
}
async function loadAllCustomTools() {
  try { if (!fs.existsSync(TOOLS_DIR)) { fs.mkdirSync(TOOLS_DIR, { recursive: true }); return 0 }; const files = fs.readdirSync(TOOLS_DIR).filter(f => /^[a-z][a-z0-9_]{2,40}\.js$/i.test(f)); let loaded = 0; for (const file of files) { const name = file.replace(/\.js$/i, ''); if (customTools.has(name)) continue; const t = await loadCustomTool(name); if (t) loaded++ }; if (loaded) console.log('[agent-tools] حمّلنا ' + loaded + ' أداة'); return loaded } catch (e) { return 0 }
}
// 🌐 عميل HTTP مخصص للأدوات — مهلة وحدود حجم (مفيش نداء بلا مهلة)
const toolAxios = axios.create({ timeout: HTTP_TIMEOUT_MS, maxRedirects: 3, maxContentLength: 10 * 1024 * 1024, maxBodyLength: 10 * 1024 * 1024 })

// 🛡️ واجهة fs مقيّدة — كل المسارات جوّه المشروع والمسارات المحمية مقفولة
function buildRestrictedFs() {
  const readGuard = (abs) => { const rel = relPath(abs); for (const re of PROTECTED_READ) if (re.test(rel)) throw new Error('مسار محمي: ' + rel) }
  const writeGuard = (abs) => { readGuard(abs); guardWrite(abs) }
  return {
    readFileSync: (p, ...rest) => { const abs = safePath(p); readGuard(abs); return fs.readFileSync(abs, ...rest) },
    writeFileSync: (p, data, ...rest) => { const abs = safePath(p); writeGuard(abs); return fs.writeFileSync(abs, data, ...rest) },
    appendFileSync: (p, data, ...rest) => { const abs = safePath(p); writeGuard(abs); return fs.appendFileSync(abs, data, ...rest) },
    readdirSync: (p, ...rest) => { const abs = safePath(p); readGuard(abs); return fs.readdirSync(abs, ...rest) },
    existsSync: (p) => { try { return fs.existsSync(safePath(p)) } catch { return false } },
    statSync: (p, ...rest) => fs.statSync(safePath(p), ...rest),
    lstatSync: (p, ...rest) => fs.lstatSync(safePath(p), ...rest),
    mkdirSync: (p, ...rest) => { const abs = safePath(p); writeGuard(abs); return fs.mkdirSync(abs, ...rest) },
    unlinkSync: (p) => { const abs = safePath(p); writeGuard(abs); return fs.unlinkSync(abs) },
    copyFileSync: (a, b, ...rest) => { const absA = safePath(a), absB = safePath(b); writeGuard(absA); writeGuard(absB); return fs.copyFileSync(absA, absB, ...rest) },
    renameSync: (a, b, ...rest) => { const absA = safePath(a), absB = safePath(b); writeGuard(absA); writeGuard(absB); return fs.renameSync(absA, absB, ...rest) }
  }
}
function buildToolContext(toolName) {
  return { ROOT, safePath, relPath, fs: buildRestrictedFs(), path, now: () => Date.now(), log: (...args) => console.log('[custom-tool:' + toolName + ']', ...args), readText: (p) => { const abs = safePath(p), rel = relPath(abs); for (const re of PROTECTED_READ) if (re.test(rel)) throw new Error('مسار محمي: ' + rel); return fs.readFileSync(abs, 'utf8') }, listDir: (p) => { const abs = safePath(p), rel = relPath(abs); for (const re of PROTECTED_READ) if (re.test(rel)) throw new Error('مسار محمي: ' + rel); return fs.readdirSync(abs) }, exists: (p) => { try { return fs.existsSync(safePath(p)) } catch { return false } }, axios: toolAxios }
}

// ═══════════════════════════════════════════════════════════════
//  🔧 Syntax + Duplicates + Cmd Literals
// ═══════════════════════════════════════════════════════════════
let _synErr = null
// ✅ فحص صياغة بدون أي مكتبة خارجية: بنستعمل "node --check" على ملف مؤقت .mjs
//    (ملف .mjs => Node يفسّره كـ ES Module فبيقرا import/export بشكل صحيح)
function nodeCheckSyntax(code, file) {
  const tmpDir = path.join(ROOT, '.agent-tmp')
  try { fs.mkdirSync(tmpDir, { recursive: true }) } catch {}
  const tmp = path.join(tmpDir, 'chk-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.mjs')
  try {
    fs.writeFileSync(tmp, String(code), 'utf8')
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe', timeout: 10000, maxBuffer: 8 * 1024 * 1024 })
    return '✅ الصياغة سليمة.'
  } catch (e) {
    const out = String((e?.stderr && e.stderr.toString()) || e?.message || e)
    const lineM = out.match(/\.mjs:(\d+)/) || out.match(/:(\d+)\s*\n/)
    const msgM = out.match(/(SyntaxError:[^\n]*)/)
    const line = lineM ? lineM[1] : '?'
    const msg = msgM ? msgM[1] : out.split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 200)
    return '❌ خطأ صياغة عند ' + line + ': ' + msg
  } finally { try { fs.unlinkSync(tmp) } catch {} }
}
async function checkSyntax(code, file) {
  // نفضّل مكتبة syntax-error لو موجودة، وإلا نرجع على node --check (بمهلة محدودة/مفيش تبعية)
  try { if (_synErr === null) _synErr = (await import('syntax-error')).default } catch { _synErr = false }
  if (_synErr) {
    try {
      const err = _synErr(code, file, { sourceType: 'module', ecmaVersion: 12 })
      if (!err) return '✅ الصياغة سليمة.'
      return '❌ خطأ صياغة عند ' + (err.line || '?') + ': ' + err.message
    } catch (e) { /* نكمل على الفحص المدمج */ }
  }
  try { return nodeCheckSyntax(code, file) } catch (e) { return '⚠️ تعذر الفحص: ' + (e?.message || e) }
}
function checkDuplicateDecls(code) {
  const lines = String(code || '').split('\n'); const seen = new Map(); const dupes = []; let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (inBlockComment) { const end = line.indexOf('*/'); if (end === -1) continue; line = line.slice(end + 2); inBlockComment = false }
    const blockStart = line.indexOf('/*')
    if (blockStart !== -1) { const blockEnd = line.indexOf('*/', blockStart + 2); if (blockEnd === -1) { inBlockComment = true; line = line.slice(0, blockStart) } else line = line.slice(0, blockStart) + line.slice(blockEnd + 2) }
    line = line.replace(/\/\/.*$/, ''); if (!line.trim()) continue
    const m = line.match(/^(\s*)(?:export\s+)?(?:let|const|var)\s+([a-zA-Z_$][\w$]*)\s*(?:=|;|,)/)
    if (!m) continue
    const indent = m[1].length; if (indent > 2) continue
    const name = m[2]
    if (seen.has(name)) dupes.push({ name, firstLine: seen.get(name), secondLine: i + 1 })
    else seen.set(name, i + 1)
  }
  return dupes
}
function extractCmdLiterals(src) {
  const out = new Set()
  const m = String(src).match(/handler\.command\s*=\s*(.+)$/m)
  if (!m) return []
  const line = m[1].trim()
  try {
    if (line.includes('/') && line.startsWith('/')) { const inner = line.slice(line.indexOf('/') + 1, line.lastIndexOf('/')); inner.split('|').forEach(part => { const c = part.replace(/[\^\$\(\)\[\]\?\\\{\}\+\*\.]/g, '').trim(); if (c && c.length <= 40 && !/\s/.test(c)) out.add(c.toLowerCase()) }) }
    else { ;(line.match(/["']([^"']{1,40})["']/g) || []).forEach(q => out.add(q.slice(1, -1).toLowerCase())) }
  } catch {}
  return [...out]
}

// ═══════════════════════════════════════════════════════════════
//  🔧 File Tools
// ═══════════════════════════════════════════════════════════════
function toolListFiles(dir) {
  const rel = dir || '.'; const abs = safePath(rel); const exists = fs.existsSync(abs); const isDir = exists && fs.statSync(abs).isDirectory()
  const header = `📂 LIST_FILES: "${rel}"\n📍 ${abs}\n`
  if (!exists) return header + `❌ مش موجود.`
  if (!isDir) return header + `❌ ده ملف مش مجلد.`
  const skip = new Set(['node_modules', 'session', 'Sessions', '.git', 'tmp', 'agent-backups', '.agent-tmp'])
  let entries; try { entries = fs.readdirSync(abs, { withFileTypes: true }) } catch (e) { return header + `❌ ${e.message}` }
  const filtered = entries.filter(e => !skip.has(e.name))
  const dirs = filtered.filter(e => e.isDirectory()).map(e => '📁 ' + e.name + '/')
  const files = filtered.filter(e => e.isFile()).map(e => { let kb = 0; try { kb = Math.round(fs.statSync(path.join(abs, e.name)).size / 102.4) / 10 } catch {}; return '📄 ' + e.name + ' (' + kb + 'KB)' })
  const all = dirs.concat(files)
  if (!all.length) return header + `⚠️ ⛔ المجلد فاضي. (الإجمالي: ${entries.length} عنصر)`
  return header + `✅ إجمالي: ${all.length} عنصر (${dirs.length} مجلد + ${files.length} ملف)\n` + all.slice(0, 500).join('\n') + (all.length > 500 ? `\n… (${all.length - 500} إضافي)` : '')
}
function toolReadFile(p, start, end, offset, limit) {
  if (!p || typeof p !== 'string') return '❌ محتاج args.path'
  const abs = safePath(p)
  if (!fs.existsSync(abs)) return '❌ مش موجود: ' + p
  const stat = fs.statSync(abs)
  if (stat.isDirectory()) return '❌ ده مجلد — استخدم list_files'
  const rel = relPath(abs)
  for (const re of PROTECTED_READ) if (re.test(rel)) return '🔒 مسار محمي: ' + rel
  if (!TEXT_EXT.test(abs)) return '❌ امتداد غير مدعوم: ' + p
  if (stat.size > 5 * 1024 * 1024) return '❌ الملف كبير (>5MB)'
  const lines = fs.readFileSync(abs, 'utf8').split('\n'); const total = lines.length
  let s = 1, e = total
  if (start !== undefined && start !== null && start !== '') s = Math.max(1, parseInt(start, 10) || 1)
  else if (offset !== undefined && offset !== null && offset !== '') s = Math.max(1, parseInt(offset, 10) || 1)
  if (end !== undefined && end !== null && end !== '') e = Math.min(total, parseInt(end, 10) || total)
  else if (limit !== undefined && limit !== null && limit !== '') { const lim = Math.max(1, parseInt(limit, 10) || 1); e = Math.min(total, s + lim - 1) }
  if (e < s) e = s
  const MAXC = 20000; const parts = []; let used = 0, last = s - 1, sliced = false
  for (let n = s; n <= e; n++) { const line = String(n).padStart(4) + '│ ' + lines[n - 1]; if (parts.length && used + line.length > MAXC) break; let piece = line; if (piece.length > MAXC) { piece = piece.slice(0, MAXC); sliced = true }; parts.push(piece); used += piece.length; last = n; if (used >= MAXC) break }
  let note = ''
  if (sliced) note += '\n⚠️ (سطر اتقص)'
  if (last < total) { note += '\n📄 *إجمالي ' + total + ' سطر* — معروض ' + s + '→' + last; note += '\n💡 للجزء الجاي: {path:"' + p + '", offset:' + (last + 1) + ', limit:200}' }
  else note += '\n✅ (نهاية الملف — ' + total + ' سطر)'
  return '📄 READ_FILE: ' + p + ' (أسطر ' + s + '-' + last + ' من ' + total + '):\n' + parts.join('\n') + note
}
function toolSearch(query, dirOrPath) {
  if (!query || !String(query).trim()) return '❌ محتاج args.query'
  const q = String(query).trim()
  let re
  if (/^\/.+\/[a-z]*$/i.test(q)) { const last = q.lastIndexOf('/'); try { re = new RegExp(q.slice(1, last), q.slice(last + 1) || 'i') } catch { return '❌ Regex غير صالح' } }
  else re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const target = dirOrPath || '.'; const abs = safePath(target)
  if (!fs.existsSync(abs)) return '❌ مش موجود: ' + target
  const stat = fs.statSync(abs)
  if (stat.isFile()) {
    if (!TEXT_EXT.test(abs)) return '❌ امتداد غير مدعوم'
    if (stat.size > 5 * 1024 * 1024) return '❌ الملف كبير'
    let content; try { content = fs.readFileSync(abs, 'utf8') } catch (e) { return '❌ ' + e.message }
    const ls = content.split('\n'); const hits = []
    for (let n = 0; n < ls.length; n++) if (re.test(ls[n])) hits.push({ line: n + 1, text: ls[n].trim().slice(0, 200) })
    if (!hits.length) return '🔍 SEARCH "' + q + '" في ' + relPath(abs) + ': 0'
    const shown = hits.slice(0, 200); const lines = shown.map(h => relPath(abs) + ':' + h.line + ': ' + h.text)
    let out = '🔍 SEARCH "' + q + '" في ' + relPath(abs) + ': ✅ ' + hits.length
    out += '\n' + lines.join('\n')
    if (hits.length > shown.length) out += '\n… (+' + (hits.length - shown.length) + ')'
    return out
  }
  const skip = new Set(['node_modules', 'session', 'Sessions', '.git', 'tmp', 'agent-backups', 'database.json', '.agent-tmp'])
  const results = []; let total = 0
  const walk = (d, depth) => {
    if (depth > 6 || results.length >= 200) return
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const en of entries) {
      if (skip.has(en.name)) continue
      const fp = path.join(d, en.name)
      if (en.isDirectory()) { walk(fp, depth + 1); continue }
      if (!TEXT_EXT.test(en.name)) continue
      let st; try { st = fs.statSync(fp) } catch { continue }
      if (st.size > 500 * 1024) continue
      let content; try { content = fs.readFileSync(fp, 'utf8') } catch { continue }
      const ls = content.split('\n')
      for (let n = 0; n < ls.length; n++) if (re.test(ls[n])) { total++; if (results.length < 200) results.push(relPath(fp) + ':' + (n + 1) + ': ' + ls[n].trim().slice(0, 150)) }
    }
  }
  walk(abs, 0)
  if (!results.length) return '🔍 SEARCH "' + q + '" في ' + target + ': 0'
  let out = '🔍 SEARCH "' + q + '" في ' + target + ': ✅ ' + total
  if (total > results.length) out += ' (معروض ' + results.length + ')'
  return out + '\n' + results.join('\n')
}
function toolPluginList(bot) {
  const plugins = getPluginList(bot); const entries = Object.entries(plugins)
  if (!entries.length) return 'PLUGIN_LIST: ⚠️ مفيش بلاجينات.'
  const lines = entries.map(([name, p]) => { let cmds = '(بدون)'; try { if (p.command instanceof RegExp) cmds = '/' + p.command.source + '/'; else if (Array.isArray(p.command)) cmds = p.command.join(' | '); else if (typeof p.command === 'string') cmds = p.command } catch {}; const cat = p.category || ''; return '• ' + name + ' — ' + cmds + (cat ? ' [' + cat + ']' : '') })
  return 'PLUGIN_LIST: ✅ إجمالي ' + entries.length + ' بلاجين:\n' + lines.join('\n')
}
async function toolAnalyzePlugins(dir, limit) {
  const target = safePath(dir || 'plugins')
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return '❌ المجلد مش موجود'
  const files = []
  const scan = (base) => { for (const en of fs.readdirSync(base, { withFileTypes: true })) { const fp = path.join(base, en.name); if (en.isDirectory()) { scan(fp); continue }; if (/\.(m?js|cjs)$/i.test(en.name)) files.push(fp) } }
  scan(target)
  if (!files.length) return `📂 مفيش ملفات .js`
  const maxCheck = limit && Number(limit) > 0 ? Math.min(Number(limit), files.length) : files.length
  let synErrMod = null; try { synErrMod = (await import('syntax-error')).default } catch {}
  const results = [], allCmds = new Map()
  let okCount = 0, errCount = 0, noExportCount = 0, noCmdCount = 0, noCatCount = 0
  for (let i = 0; i < maxCheck; i++) {
    const file = files[i]; const relF = path.relative(target, file)
    const r = { file: relF, ok: false, issues: [], cmds: [] }
    try {
      const src = fs.readFileSync(file, 'utf8')
      r.sizeKB = Math.round(Buffer.byteLength(src) / 102.4) / 10
      if (synErrMod) { try { const err = synErrMod(src, relF, { sourceType: 'module', ecmaVersion: 12 }); if (err && !/outside a module/i.test(String(err.message || ''))) r.issues.push(`syntax:${err.line || '?'}`) } catch {} }
      if (!/export\s+default/.test(src)) r.issues.push('no-export-default')
      const cm = src.match(/handler\.command\s*=\s*(.+)$/m)
      if (cm) { const cmds = extractCmdLiterals(src); r.cmds = cmds; for (const c of cmds) { if (!allCmds.has(c)) allCmds.set(c, []); allCmds.get(c).push(relF) } }
      else r.issues.push('no-handler.command')
      if (!/handler\.category\s*=/.test(src) && !/handler\.tags\s*=/.test(src)) r.issues.push('no-category')
      r.ok = r.issues.length === 0
      if (r.ok) okCount++; else errCount++
      if (r.issues.includes('no-export-default')) noExportCount++
      if (r.issues.includes('no-handler.command')) noCmdCount++
      if (r.issues.includes('no-category')) noCatCount++
    } catch (e) { r.issues.push('read-fail'); errCount++ }
    results.push(r)
  }
  const collisions = []
  for (const [cmd, arr] of allCmds.entries()) if (arr.length > 1) collisions.push({ cmd, files: arr })
  const withIssues = results.filter(r => !r.ok)
  let out = `📂 ANALYZE_PLUGINS: "${dir || 'plugins'}"\n━━━━━━━━━━━━━━━━\n`
  out += `📊 إجمالي: ${files.length}\n✅ سليمة: ${okCount}\n⚠️ ملاحظات: ${errCount}\n`
  out += `   • بدون export default: ${noExportCount}\n   • بدون command: ${noCmdCount}\n   • بدون category: ${noCatCount}\n`
  out += `🔁 تعارضات: ${collisions.length}\n`
  if (collisions.length) { out += `\n⚠️ *تعارضات:*\n`; for (const c of collisions.slice(0, 30)) out += `• "${c.cmd}" → ${c.files.join(' + ')}\n` }
  if (results.length <= 100 && withIssues.length) { out += `\n📋 *فيها ملاحظات:*\n`; for (const r of withIssues.slice(0, 60)) out += `• ${r.file} → ${r.issues.join(', ')}\n` }
  return out
}
async function toolResearchPlugin(query, searchIn = 'all') {
  if (!query) return '❌ محتاج query'
  const q = String(query).trim().toLowerCase()
  const dir = path.join(ROOT, 'plugins')
  if (!fs.existsSync(dir)) return '❌ مجلد plugins مش موجود.'
  const results = []
  const scan = (base) => {
    for (const en of fs.readdirSync(base, { withFileTypes: true })) {
      const fp = path.join(base, en.name)
      if (en.isDirectory()) { scan(fp); continue }
      if (!/\.(m?js|cjs)$/i.test(en.name)) continue
      let src = ''; try { src = fs.readFileSync(fp, 'utf8') } catch { continue }
      const lc = src.toLowerCase(); let matched = false; const matchReason = []
      if (searchIn === 'all' || searchIn === 'name') if (en.name.toLowerCase().includes(q)) { matched = true; matchReason.push('الاسم') }
      if (searchIn === 'all' || searchIn === 'command') { const cm = src.match(/handler\.command\s*=\s*(.+)$/m); if (cm && cm[1].toLowerCase().includes(q)) { matched = true; matchReason.push('الأمر') } }
      if (searchIn === 'all' || searchIn === 'category') { const cm = src.match(/handler\.category\s*=\s*["']([^"']+)["']/); if (cm && cm[1].toLowerCase().includes(q)) { matched = true; matchReason.push('التصنيف') } }
      if (searchIn === 'all' || searchIn === 'content') if (lc.includes(q)) { matched = true; matchReason.push('المحتوى') }
      if (matched) { const cmds = extractCmdLiterals(src); const cat = (src.match(/handler\.category\s*=\s*["']([^"']+)["']/) || [])[1] || ''; results.push({ file: path.relative(dir, fp), matchReason: matchReason.join('+'), cmds, cat: cat.trim() }) }
    }
  }
  scan(dir)
  if (!results.length) return `🔍 مفيش نتائج لـ "${query}"`
  const lines = results.slice(0, 50).map(r => `• *${r.file}* — ${r.matchReason}\n   أوامر: ${r.cmds.join(', ') || '(بدون)'}\n   تصنيف: ${r.cat || '(بدون)'}`)
  return `🔍 RESEARCH: "${query}" (${results.length}):\n\n` + lines.join('\n')
}
async function toolInspectPlugin(pluginName) {
  if (!pluginName) return '❌ اكتب اسم البلوجن.'
  const dir = path.join(ROOT, 'plugins')
  const cleanName = String(pluginName).trim()
  let fp = null
  const scan = (base) => { if (fp) return; for (const en of fs.readdirSync(base, { withFileTypes: true })) { const f = path.join(base, en.name); if (en.isDirectory()) { scan(f); continue }; if (en.name === cleanName || en.name === cleanName + '.js' || en.name.toLowerCase().includes(cleanName.toLowerCase())) { fp = f; return } } }
  scan(dir)
  if (!fp) return `❌ مفيش بلوجن اسمه "${pluginName}"`
  const src = fs.readFileSync(fp, 'utf8'); const fileName = path.relative(ROOT, fp)
  const lines = src.split('\n').length; const sizeKB = Math.round(Buffer.byteLength(src) / 102.4) / 10
  const cmds = extractCmdLiterals(src)
  const catMatch = src.match(/handler\.category\s*=\s*["']([^"']+)["']/)
  const synErr = nodeCheckSyntax(src, fileName)
  const dupes = checkDuplicateDecls(src); const issues = []
  if (!/export\s+default/.test(src)) issues.push('❌ مش فيه export default')
  if (/\brequire\s*\(/.test(src)) issues.push('❌ بيستخدم require()')
  if (/module\.exports/.test(src)) issues.push('❌ module.exports')
  if (!cmds.length) issues.push('⚠️ مفيش handler.command')
  if (!catMatch) issues.push('⚠️ مفيش handler.category')
  if (dupes.length) issues.push('🚨 تعريفات مكررة: ' + dupes.map(d => d.name).join(', '))
  return [`📋 INSPECT: *${fileName}*`, `━━━━━━━━━━━━━━━━`, `📏 ${sizeKB}KB — ${lines} سطر`, `🔧 الأوامر: ${cmds.join(', ') || '(بدون)'}`, `🏷️ category: ${catMatch?.[1] || '(بدون)'}`, `🔍 ${synErr}`, '', `📊 *المشاكل:* ${issues.length ? '\n' + issues.join('\n') : '✅ مفيش مشاكل'}`].join('\n')
}
async function toolTestPlugin(pluginName) {
  if (!pluginName) return '❌ اكتب اسم البلوجن.'
  const dir = path.join(ROOT, 'plugins')
  const cleanName = String(pluginName).trim()
  let fp = null
  const scan = (base) => { if (fp) return; for (const en of fs.readdirSync(base, { withFileTypes: true })) { const f = path.join(base, en.name); if (en.isDirectory()) { scan(f); continue }; if (en.name === cleanName || en.name === cleanName + '.js' || en.name.toLowerCase().includes(cleanName.toLowerCase())) { fp = f; return } } }
  scan(dir)
  if (!fp) return `❌ مفيش بلوجن "${pluginName}"`
  const fileName = path.relative(ROOT, fp); const results = []
  try { const src = fs.readFileSync(fp, 'utf8'); const synErr = nodeCheckSyntax(src, fileName); if (synErr.startsWith('❌')) return '📋 ' + fileName + '\n━━━━━━━━━━━━━━━━\n' + synErr; results.push('✅ فحص الصياغة: سليم'); const dupes = checkDuplicateDecls(src); if (dupes.length) results.push('🚨 تعريفات مكررة: ' + dupes.map(d => d.name).join(', ')) } catch (e) { results.push('⚠️ تعذر فحص الصياغة') }
  try {
    const url = 'file://' + fp.replace(/\\/g, '/') + '?t=' + Date.now()
    const mod = await import(url); const handler = mod.default || mod.handler
    if (typeof handler !== 'function') { results.push('❌ التصدير مش دالة'); return '📋 ' + fileName + '\n' + results.join('\n') }
    results.push('✅ التحميل: نجح')
    results.push(`📋 command: ${handler.command ? (handler.command instanceof RegExp ? '/' + handler.command.source + '/' : (Array.isArray(handler.command) ? handler.command.join(' | ') : String(handler.command))) : '(بدون)'}`)
    results.push(`🏷️ category: ${handler.category || '(بدون)'}`)
    const mockMsg = { chat: 'test@s.whatsapp.net', sender: 'test@s.whatsapp.net', isGroup: false, text: 'test', reply: async (t) => { results.push('📤 ' + String(t).slice(0, 100)) }, react: async () => {}, mentionedJid: [], quoted: null, lid2jid: async (x) => x }
    const mockBot = { config: { info: { nameBot: 'TEST', prefix: ['.', '!'] } }, getAllCommands: () => [] }
    const mockCtx = { conn: { sendMessage: async () => ({ key: { id: 'test' } }) }, bot: mockBot, args: ['test'], text: 'test', usedPrefix: '.', command: 'test', isOwner: false, isAdmin: false, isBotAdmin: false, chat: {}, participants: [], groupMetadata: {}, settings: {}, config: mockBot.config }
    try { await Promise.resolve(handler(mockMsg, mockCtx)); results.push('✅ التشغيل: نجح') } catch (e) { results.push('⚠️ رمى خطأ — ' + String(e?.message || e).slice(0, 200)) }
  } catch (e) { results.push('❌ التحميل: فشل — ' + String(e?.message || e).slice(0, 300)) }
  return '📋 TEST_PLUGIN: ' + fileName + '\n━━━━━━━━━━━━━━━━\n' + results.join('\n')
}
async function toolSuggestPlugins(category) {
  if (!category) return '❌ اكتب تصنيف.'
  const q = String(category).trim().toLowerCase()
  const dir = path.join(ROOT, 'plugins')
  if (!fs.existsSync(dir)) return '❌'
  const matches = []
  const scan = (base) => {
    for (const en of fs.readdirSync(base, { withFileTypes: true })) {
      const fp = path.join(base, en.name); if (en.isDirectory()) { scan(fp); continue }
      if (!/\.(m?js|cjs)$/i.test(en.name)) continue
      let src = ''; try { src = fs.readFileSync(fp, 'utf8') } catch { continue }
      const catMatch = src.match(/handler\.category\s*=\s*["']([^"']+)["']/)
      if (catMatch && catMatch[1].toLowerCase().includes(q)) { const cmds = extractCmdLiterals(src); matches.push({ file: path.relative(dir, fp), cat: catMatch[1], cmds: cmds.slice(0, 3).join(', ') }) }
    }
  }
  scan(dir)
  if (!matches.length) return `🔍 مفيش في "${category}"`
  const lines = matches.slice(0, 60).map(m => `• *${m.file}* [${m.cat}]\n   أوامر: ${m.cmds || '(بدون)'}`)
  return `🔍 SUGGEST: "${category}" (${matches.length}):\n\n` + lines.join('\n')
}
async function toolClonePlugin(sourceName, newName, modifications) {
  if (!sourceName || !newName) return '❌ محتاج source و newName'
  const dir = path.join(ROOT, 'plugins')
  let srcFp = null
  const scan = (base) => { if (srcFp) return; for (const en of fs.readdirSync(base, { withFileTypes: true })) { const f = path.join(base, en.name); if (en.isDirectory()) { scan(f); continue }; if (en.name === sourceName || en.name === sourceName + '.js') { srcFp = f; return } } }
  scan(dir)
  if (!srcFp) return `❌ "${sourceName}" مش موجود.`
  let content = fs.readFileSync(srcFp, 'utf8')
  if (modifications && typeof modifications === 'object') {
    if (modifications.command) content = content.replace(/handler\.command\s*=\s*.+$/m, `handler.command = ${modifications.command}`)
    if (modifications.category) content = content.replace(/handler\.category\s*=\s*["'][^"']*["']/m, `handler.category = "${modifications.category}"`)
  }
  const newFp = path.join(dir, newName.endsWith('.js') ? newName : newName + '.js')
  if (fs.existsSync(newFp)) return `❌ "${path.basename(newFp)}" موجود.`
  fs.writeFileSync(newFp, content, 'utf8'); logAction('نسخ: ' + sourceName + ' → ' + path.basename(newFp))
  return `✅ تم النسخ إلى *${path.basename(newFp)}*`
}

// ═══════════════════════════════════════════════════════════════
//  🧠 Brain Tools
// ═══════════════════════════════════════════════════════════════
function toolThink(args, session) { const thought = String(args.thought || '').trim(); if (!thought) return '💭 (بدون)'; if (session) { if (!session.scratchpad) session.scratchpad = []; session.scratchpad.push({ t: Date.now(), thought: thought.slice(0, 1000) }); if (session.scratchpad.length > 50) session.scratchpad.shift() }; return '💭 THINK: تم التسجيل.\n\n📝 ' + thought + '\n\n_✅ كمّل._' }
function toolPlan(args, session) { const goal = String(args.goal || '').trim(); const steps = Array.isArray(args.steps) ? args.steps : []; if (!goal || !steps.length) return '❌ محتاج goal و steps'; if (session) session.currentPlan = { goal, steps, createdAt: Date.now() }; return '📝 PLAN: *' + goal + '*\n\n' + steps.map((s, i) => `${s.n || (i + 1)}. **${s.action || '?'}**`).join('\n') }
function toolReflect(args, session) { const what = String(args.what || '').trim(); const issues = Array.isArray(args.issues) ? args.issues : []; const verdict = String(args.verdict || '').toLowerCase(); if (session) { if (!session.reflections) session.reflections = []; session.reflections.push({ t: Date.now(), what, issues, verdict }); if (session.reflections.length > 30) session.reflections.shift() }; return '🪞 REFLECT: ' + what + '\n⚖️ ' + (verdict === 'good' ? '✅ ممتاز' : '⚠️ محتاج تعديل') }
function toolMemory(args, session) {
  const op = String(args.op || 'list').toLowerCase(); if (!session) return '❌ مفيش جلسة.'
  if (!session.longMemory) session.longMemory = []
  if (op === 'add') { const key = String(args.key || '').trim(); const value = String(args.value || '').trim(); if (!key || !value) return '❌ محتاج key و value'; session.longMemory = session.longMemory.filter(m => m.key !== key); session.longMemory.push({ key, value: value.slice(0, 2000), t: Date.now() }); return `🧠 حفظ "${key}"` }
  if (op === 'get') { const found = session.longMemory.find(m => m.key === String(args.key || '')); return found ? `🧠 ${found.key}: ${found.value}` : `❌ مفيش "${args.key}"` }
  if (op === 'delete') { const before = session.longMemory.length; session.longMemory = session.longMemory.filter(m => m.key !== String(args.key || '')); return `🧠 حذف ${before - session.longMemory.length}.` }
  if (!session.longMemory.length) return '🧠 فاضية.'
  return '🧠 *الذاكرة:*\n' + session.longMemory.map(m => `• ${m.key}: ${m.value.slice(0, 150)}`).join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  🌐 Search (DDG Lite + DDG HTML + Bing + SearXNG)
// ═══════════════════════════════════════════════════════════════
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() }
function decodeDDGUrl(rawUrl) { let f = rawUrl; const m = rawUrl.match(/uddg=([^&]+)/); if (m) { try { f = decodeURIComponent(m[1]) } catch {} } if (f.startsWith('//')) f = 'https:' + f; return f }

async function searchDDGLite(query, limit = 8) {
  const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query)
  let res
  try { res = await axios.get(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' }, maxRedirects: 5, validateStatus: s => s < 500, timeout: HTTP_TIMEOUT_SEARCH_MS }) }
  catch (e) { throw new Error('فشل الاتصال بـ DuckDuckGo: ' + (e?.message || e)) }
  const html = String(res.data || '')
  if (res.status === 403 || /captcha|challenge|blocked/i.test(html.slice(0, 500))) throw new Error('blocked')
  const results = []
  const linkRe = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi
  const links = [...html.matchAll(linkRe)]; const snippets = [...html.matchAll(snippetRe)]
  for (let i = 0; i < Math.min(links.length, limit); i++) { const title = stripHtml(links[i][2]); const url2 = decodeDDGUrl(links[i][1]); if (title && url2) results.push({ title, url: url2, snippet: snippets[i] ? stripHtml(snippets[i][1]) : '' }) }
  return results
}
async function searchDDGHTML(query, limit = 8) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query)
  let res
  try { res = await axios.get(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Referer': 'https://duckduckgo.com/' }, maxRedirects: 5, validateStatus: s => s < 500, timeout: HTTP_TIMEOUT_SEARCH_MS }) }
  catch (e) { throw new Error('فشل الاتصال بـ DuckDuckGo: ' + (e?.message || e)) }
  const html = String(res.data || '')
  if (res.status === 403 || /captcha/i.test(html.slice(0, 500))) throw new Error('blocked')
  const results = []
  const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
  const links = [...html.matchAll(linkRe)]; const snippets = [...html.matchAll(snippetRe)]
  for (let i = 0; i < Math.min(links.length, limit); i++) { const title = stripHtml(links[i][2]); const url2 = decodeDDGUrl(links[i][1]); if (title && url2) results.push({ title, url: url2, snippet: snippets[i] ? stripHtml(snippets[i][1]) : '' }) }
  return results
}
async function searchBing(query, limit = 8) {
  const url = 'https://www.bing.com/search?q=' + encodeURIComponent(query)
  let res
  try { res = await axios.get(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' }, maxRedirects: 5, validateStatus: s => s < 500, timeout: HTTP_TIMEOUT_SEARCH_MS }) }
  catch (e) { throw new Error('فشل الاتصال بـ Bing: ' + (e?.message || e)) }
  const html = String(res.data || '')
  if (res.status === 403 || /captcha/i.test(html.slice(0, 500))) throw new Error('blocked')
  const results = []
  const itemRe = /<li[^>]+class="b_algo"[\s\S]*?<\/li>/gi
  const items = [...html.matchAll(itemRe)]
  for (const item of items) { if (results.length >= limit) break; const block = item[0]; const titleM = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i); if (!titleM) continue; const snippetM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i); if (titleM[1].startsWith('http')) results.push({ title: stripHtml(titleM[2]), url: titleM[1], snippet: snippetM ? stripHtml(snippetM[1]) : '' }) }
  return results
}
async function searchSearXNG(query, limit = 8) {
  const instances = ['https://searx.be', 'https://search.bus-hit.me', 'https://searx.tiekoetter.com']
  for (const inst of instances) {
    try {
      let res
      try { res = await axios.get(inst + '/search', { params: { q: query, format: 'json' }, headers: { 'User-Agent': BROWSER_UA }, validateStatus: s => s < 500, timeout: HTTP_TIMEOUT_SEARCH_MS }) }
      catch (e) { console.log('[web_search] SearXNG ' + inst + ': ' + String(e?.message || e).slice(0, 100)); continue }
      const data = res.data; if (!data || !Array.isArray(data.results)) continue
      const results = data.results.slice(0, limit).map(r => ({ title: stripHtml(r.title || ''), url: r.url || '', snippet: stripHtml(r.content || '') })).filter(r => r.title && r.url)
      if (results.length) return results
    } catch {}
  }
  throw new Error('SearXNG فشل')
}
async function ddgSearch(query, limit = 8) {
  const attempts = [{ name: 'DDG Lite', fn: searchDDGLite }, { name: 'DDG HTML', fn: searchDDGHTML }, { name: 'Bing', fn: searchBing }, { name: 'SearXNG', fn: searchSearXNG }]
  const errors = []
  for (const a of attempts) {
    try { const r = await a.fn(query, limit); if (r && r.length > 0) { console.log('[web_search] ✅ ' + a.name + ': ' + r.length); return r } errors.push(a.name + ': 0') }
    catch (e) { console.log('[web_search] ❌ ' + a.name + ': ' + String(e?.message || e).slice(0, 100)); errors.push(a.name) }
  }
  throw new Error('كل المحركات فشلت:\n• ' + errors.join('\n• '))
}
async function toolWebSearch(query, limit) {
  if (!query) return '❌ محتاج query'
  try {
    const results = await ddgSearch(String(query), Math.min(Number(limit) || 8, 20))
    if (!results.length) return '🔍 مفيش نتائج لـ "' + query + '"'
    return `🔍 WEB_SEARCH: "${query}" (${results.length}):\n\n` + results.map((r, i) => `${i + 1}. *${r.title}*\n   ${r.snippet.slice(0, 300)}\n   🔗 ${r.url}`).join('\n\n')
  } catch (e) { return '❌ فشل:\n' + String(e?.message || e).slice(0, 800) }
}
async function toolWikiSearch(query, lang) {
  if (!query) return '❌ محتاج query.'
  const l = String(lang || 'ar').toLowerCase()
  try {
    const searchRes = await axios.get(`https://${l}.wikipedia.org/w/api.php`, { params: { action: 'query', list: 'search', srsearch: query, format: 'json', srlimit: 5, srprop: 'snippet' }, headers: { 'User-Agent': 'Agent/1.0' }, timeout: HTTP_TIMEOUT_SEARCH_MS })
    const hits = searchRes.data?.query?.search || []
    if (!hits.length) return `📚 مفيش نتائج لـ "${query}"`
    const out = []
    for (const hit of hits) { try { const sumRes = await axios.get(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`, { headers: { 'User-Agent': 'Agent/1.0' }, timeout: HTTP_TIMEOUT_SEARCH_MS }); const d = sumRes.data; out.push(`📖 *${d.title}*\n${(d.extract || '').slice(0, 800)}`) } catch { out.push(`📖 *${hit.title}*\n${(hit.snippet || '').replace(/<[^>]+>/g, '')}`) } }
    return `📚 WIKI: "${query}"\n\n` + out.join('\n\n')
  } catch (e) { return '❌ فشل: ' + (e?.message || String(e)).slice(0, 300) }
}
async function toolFetchUrl(url, maxLen) {
  if (!url) return '❌ محتاج url.'
  try {
    const res = await axios.get(String(url), { headers: { 'User-Agent': BROWSER_UA }, maxContentLength: 50 * 1024 * 1024, timeout: HTTP_TIMEOUT_SEARCH_MS })
    let text = String(res.data || '')
    if (/<html/i.test(text)) text = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    const max = Math.min(Number(maxLen) || 10000, 100000)
    return `🌐 FETCH: ${url}\n\n` + text.slice(0, max) + (text.length > max ? `\n\n… (${text.length} حرف)` : '')
  } catch (e) { return '❌ فشل: ' + (e?.message || String(e)).slice(0, 300) }
}

// ═══════════════════════════════════════════════════════════════
//  💾 Write Tools
// ═══════════════════════════════════════════════════════════════
async function toolWriteFile(p, content) {
  if (typeof p !== 'string' || !p.trim()) return '❌ لازم تحدد المسار'
  if (typeof content !== 'string' || !content.trim()) return '❌ المحتوى فاضي'
  if (content.length > 20 * 1024 * 1024) return '❌ أكبر من 20MB'
  const abs = safePath(p); guardWrite(abs)
  const existed = fs.existsSync(abs); const bak = backupFile(p)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
  logAction((existed ? 'تعديل ' : 'إنشاء ') + relPath(abs))
  let out = (existed ? '📝 تعديل ' : '✅ إنشاء ') + relPath(abs) + ' (' + content.split('\n').length + ' سطر)' + (bak ? ' | نسخة: ' + bak : '')
  if (/\.m?js$/i.test(abs)) {
    out += '\n' + (await checkSyntax(content, relPath(abs)))
    const dupes = checkDuplicateDecls(content)
    if (dupes.length) out += '\n🚨 *تعريفات مكررة:*\n' + dupes.slice(0, 8).map(d => '  • `' + d.name + '` سطر ' + d.firstLine + ' و ' + d.secondLine).join('\n')
  }
  return out
}
function toolDeleteFile(p) {
  const abs = safePath(p); guardWrite(abs)
  if (!fs.existsSync(abs)) return '❌ مش موجود: ' + p
  if (fs.statSync(abs).isDirectory()) return '❌ حذف المجلدات ممنوع.'
  const bak = backupFile(p); fs.unlinkSync(abs); logAction('حذف ' + relPath(abs))
  return '🗑️ حذف ' + relPath(abs) + (bak ? ' | نسخة: ' + bak : '')
}
function toolNpm(pkg) {
  // 🛑 مفيش تثبيت حزم من جوه البوت — ممنوع تشغيل npm/شِل وقت التشغيل
  const name = String(pkg || '').trim()
  if (!name) return Promise.resolve('❌ غير مسموح: اسم الحزمة فاضي')
  return Promise.resolve('❌ غير مسموح: تثبيت الحزم (' + name.slice(0, 40) + ') ممنوع داخل الوكيل. ابعت الحزم من جهازك وأعد تشغيل البوت.')
}

// ═══════════════════════════════════════════════════════════════
//  🧰 create_tool
// ═══════════════════════════════════════════════════════════════
async function toolCreateTool(args) {
  const { name, description, args_schema, code, example } = args || {}
  if (!name || !/^[a-z][a-z0-9_]{2,40}$/i.test(name)) return '❌ اسم غير صالح.'
  if (KNOWN_TOOLS.includes(name)) return '❌ الاسم محجوز.'
  if (!customTools.has(name) && customTools.size >= MAX_CUSTOM_TOOLS) return '❌ وصلت حد الأدوات المخصصة (' + MAX_CUSTOM_TOOLS + '). امسح واحدة الأول.'
  if (typeof code !== 'string' || !code.trim()) return '❌ الكود فاضي.'
  if (code.length > 500 * 1024) return '❌ أكبر من 500KB.'
  const secErr = safetyCheckToolCode(code)
  if (secErr) return '❌ رفض أمني: ' + secErr
  const synErr = nodeCheckSyntax(code, name + '.js')
  if (synErr.startsWith('❌')) return synErr
  if (!/export\s+default\s+(async\s+)?function/.test(code)) return '❌ محتاج: export default async function(args, ctx) {...}'
  const hasDesc = /export\s+const\s+description\s*=/.test(code)
  const hasArgs = /export\s+const\s+args_schema\s*=/.test(code)
  const hasEx = /export\s+const\s+example\s*=/.test(code)
  const headerParts = ['// 🧰 أداة — ' + new Date().toISOString()]
  if (!hasDesc) headerParts.push('export const description = ' + JSON.stringify(String(description || '')) + ';')
  if (!hasArgs) headerParts.push('export const args_schema = ' + JSON.stringify(args_schema || {}) + ';')
  if (!hasEx) headerParts.push('export const example = ' + JSON.stringify(String(example || '')) + ';')
  headerParts.push('')
  const filePath = path.join(TOOLS_DIR, name + '.js')
  fs.mkdirSync(TOOLS_DIR, { recursive: true })
  const existed = fs.existsSync(filePath)
  if (existed) { const bakDir = path.join(ROOT, 'agent-backups'); fs.mkdirSync(bakDir, { recursive: true }); fs.copyFileSync(filePath, path.join(bakDir, Date.now() + '__agent-tools__' + name + '.js')) }
  fs.writeFileSync(filePath, headerParts.join('\n') + code.trim() + '\n', 'utf8')
  logAction((existed ? 'تحديث أداة: ' : 'إنشاء أداة: ') + name)
  customTools.delete(name)
  const t = await loadCustomTool(name)
  if (!t) return '❌ فشل التحميل.'
  return `✅ تم إنشاء *${name}*`
}
function toolListTools() {
  if (!customTools.size) return '🧰 مفيش.'
  const lines = []
  for (const [name, t] of customTools.entries()) { lines.push('• *' + name + '* — ' + t.description) }
  return '🧰 *الأدوات (' + customTools.size + '):*\n\n' + lines.join('\n')
}
function toolReadTool(name) { const t = customTools.get(name); if (!t) return '❌ مش موجودة.'; const fp = path.join(TOOLS_DIR, t.file); return fs.existsSync(fp) ? '📄 *' + name + '*:\n```javascript\n' + fs.readFileSync(fp, 'utf8').slice(0, 50000) + '\n```' : '❌' }
function toolDeleteTool(name) { if (KNOWN_TOOLS.includes(name)) return '❌ أداة مدمجة.'; const t = customTools.get(name); if (!t) return '❌'; const fp = path.join(TOOLS_DIR, t.file); if (fs.existsSync(fp)) fs.unlinkSync(fp); customTools.delete(name); return '🗑️ حذف *' + name + '*' }

async function executeTool(c, ctx) {
  const a = c.args || {}; const s = c._session
  const bot = ctx?.bot || global.bot
  // 🛡️ safetyEnabled بيقفل دي حتى لو الطلب جه من مسار تاني
  if (isSafetyGated(c.tool)) return '⛔ الأداة *' + c.tool + '* مقفولة و safetyEnabled شغّال — ماتفذتش.'
  try {
    switch (c.tool) {
      case 'list_files': return toolListFiles(a.dir)
      case 'read_file': return toolReadFile(a.path, a.start, a.end, a.offset, a.limit)
      case 'search_code': return toolSearch(a.query, a.path || a.dir || a.dirPath)
      case 'plugin_list': return toolPluginList(bot)
      case 'analyze_plugins': return await toolAnalyzePlugins(a.dir, a.limit)
      case 'research_plugin': return await toolResearchPlugin(a.query, a.searchIn)
      case 'inspect_plugin': return await toolInspectPlugin(a.name)
      case 'test_plugin': return await toolTestPlugin(a.name)
      case 'suggest_plugins': return await toolSuggestPlugins(a.category)
      case 'clone_plugin': return await toolClonePlugin(a.source, a.newName, a.modifications)
      case 'write_file': return await toolWriteFile(a.path, a.content)
      case 'delete_file': return toolDeleteFile(a.path)
      case 'npm_install': return await toolNpm(a.package)
      case 'create_tool': return await toolCreateTool(a)
      case 'list_tools': return toolListTools()
      case 'read_tool': return toolReadTool(a.name)
      case 'delete_tool': return toolDeleteTool(a.name)
      case 'think': return toolThink(a, s)
      case 'plan': return toolPlan(a, s)
      case 'reflect': return toolReflect(a, s)
      case 'memory': return toolMemory(a, s)
      case 'web_search': return await toolWebSearch(a.query, a.limit)
      case 'wiki_search': return await toolWikiSearch(a.query, a.lang)
      case 'fetch_url': return await toolFetchUrl(a.url, a.maxLen)
    }
    const ct = customTools.get(c.tool)
    if (ct) { const result = await Promise.resolve(ct.run(a, buildToolContext(c.tool))); return String(typeof result === 'string' ? result : JSON.stringify(result, null, 2)).slice(0, 50000) }
    return '❓ أداة غير معروفة: *' + c.tool + '*'
  } catch (e) { return toolErrorObservation(c.tool, e) }
}
// أي استثناء من أداة بيتحوّل لملاحظة عربية قابلة لإعادة المحاولة للموديل — مش موت للتشغيل.
async function executeToolSafe(c, ctx) {
  try { return await executeTool(c, ctx) }
  catch (e) { return toolErrorObservation(c.tool, e) }
}
function toolLabel(c) {
  const a = c.args || {}
  const map = { list_files: () => 'list_files → ' + (a.dir || '.'), read_file: () => 'read_file → ' + (a.path || '?'), search_code: () => 'search → "' + String(a.query || '').slice(0, 40) + '"', plugin_list: () => 'plugin_list', analyze_plugins: () => 'analyze_plugins', research_plugin: () => '🔍 research → "' + (a.query || '?') + '"', inspect_plugin: () => '📋 inspect → ' + (a.name || '?'), test_plugin: () => '🧪 test → ' + (a.name || '?'), suggest_plugins: () => '💡 suggest', clone_plugin: () => '📄 clone', write_file: () => 'write_file → ' + (a.path || '?'), delete_file: () => 'delete_file → ' + (a.path || '?'), npm_install: () => 'npm_install → ' + (a.package || '?'), create_tool: () => '🆕 create_tool → ' + (a.name || '?'), list_tools: () => 'list_tools', read_tool: () => 'read_tool', delete_tool: () => 'delete_tool', think: () => '💭 think', plan: () => '📝 plan', reflect: () => '🪞 reflect', memory: () => '🧠 memory', web_search: () => '🔍 web_search → "' + String(a.query || '').slice(0, 40) + '"', wiki_search: () => '📚 wiki', fetch_url: () => '🌐 fetch_url' }
  return map[c.tool] ? map[c.tool]() : c.tool
}

// ═══════════════════════════════════════════════════════════════
//  🧠 Parser
// ═══════════════════════════════════════════════════════════════
function fixRawControlChars(s) { let out = '', inStr = false, esc = false; for (const ch of s) { if (inStr) { if (esc) { out += ch; esc = false; continue } if (ch === '\\') { out += ch; esc = true; continue } if (ch === '"') { inStr = false; out += ch; continue } if (ch === '\n') { out += '\\n'; continue } if (ch === '\r') { out += '\\r'; continue } if (ch === '\t') { out += '\\t'; continue } out += ch } else { if (ch === '"') inStr = true; out += ch } } return out }
function tryParseJson(s) { try { return JSON.parse(s) } catch {} try { return JSON.parse(fixRawControlChars(s)) } catch {} return null }
function extractJsonObjects(text) {
  const objs = []; const t = String(text || ''); let i = 0
  while (i < t.length) {
    const start = t.indexOf('{', i); if (start === -1) break
    let depth = 0, inStr = false, esc = false, end = -1
    for (let j = start; j < t.length; j++) { const ch = t[j]; if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false } else if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = j; break } } }
    if (end === -1) { i = start + 1; continue }
    const parsed = tryParseJson(t.slice(start, end + 1))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) objs.push(parsed)
    i = end + 1
  }
  return objs
}
// يقرأ أول كائن JSON متوازن في النص بدءًا من فهرس { ويعيده ككائن (أو null).
function readJsonObjectAt(text, start) {
  const t = String(text || '')
  const i = Number(start)
  if (t[i] !== '{') return null
  let depth = 0, inStr = false, esc = false
  for (let j = i; j < t.length; j++) {
    const ch = t[j]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { const parsed = tryParseJson(t.slice(i, j + 1)); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null } }
  }
  return null
}
function parseToolCalls(text) {
  const src = String(text || '')
  const calls = []; const unknown = []; const seen = new Set(); const sigs = new Set()
  const addCall = (name, args, srcId) => {
    if (!name || seen.has(srcId)) return
    seen.add(srcId)
    const nm = String(name).trim()
    if (KNOWN_TOOLS.includes(nm) || customTools.has(nm)) {
      const safeArgs = (args && typeof args === 'object' && !Array.isArray(args)) ? args : {}
      // نفس النداء ممكن يتقري مرتين (tag + JSON احتياطي) — من dedupe مرة واحدة بس.
      const sig = nm + '|' + JSON.stringify(safeArgs).slice(0, 500)
      if (sigs.has(sig)) return
      sigs.add(sig)
      calls.push({ tool: nm, args: safeArgs })
    }
    else if (!unknown.includes(nm)) unknown.push(nm)
  }
  // ── الشكل الموثّق 1: <tool>{"name":...,"args":{...}}</tool>
  const xmlRe = /<tool>\s*([\s\S]*?)\s*<\/tool>/gi; let m
  while ((m = xmlRe.exec(src)) !== null) { const inner = m[1].trim(); const obj = tryParseJson(inner); if (obj && typeof obj === 'object') { const name = obj.name || obj.tool; const args = obj.args || obj.arguments || obj; if (name) addCall(String(name), args, 'xml:' + m.index) } }
  // ── الشكل الموثّق 2: <tool_call>...</tool_call> — جسم JSON، أو اسم + أزواج (parameter/arg_key)
  const tcRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi
  while ((m = tcRe.exec(src)) !== null) {
    const body = m[1].trim(); if (!body) continue
    if (body.startsWith('{')) {
      const obj = tryParseJson(body)
      if (obj && typeof obj === 'object') { const name = obj.name || obj.tool; if (name) addCall(String(name), obj.args || obj.arguments || obj, 'tcj:' + m.index); continue }
    }
    const nameMatch = body.match(/^([a-z][a-z0-9_]{2,40})\b/i); if (!nameMatch) continue
    const toolName = nameMatch[1].trim(); const rest = body.slice(nameMatch[0].length); const args = {}
    const pairRe = /<arg_key>\s*([\s\S]*?)\s*<\/arg_key>\s*<arg_value>\s*([\s\S]*?)\s*<\/arg_value>/gi; let pm
    while ((pm = pairRe.exec(rest)) !== null) { const k = pm[1].trim(); let v = pm[2].trim(); const parsed = tryParseJson(v); if (parsed !== null && parsed !== undefined && typeof parsed !== 'string') v = parsed; else if (/^-?\d+$/.test(v)) v = Number(v); else if (v === 'true') v = true; else if (v === 'false') v = false; if (k) args[k] = v }
    const paramRe = /<parameter\s+name\s*=\s*["']?([a-zA-Z0-9_]+)["']?\s*>([\s\S]*?)<\/parameter>/gi
    while ((pm = paramRe.exec(rest)) !== null) { const k = pm[1].trim(); let v = pm[2].trim(); const parsed = tryParseJson(v); if (parsed !== null && parsed !== undefined && typeof parsed !== 'string') v = parsed; else if (/^-?\d+$/.test(v)) v = Number(v); else if (v === 'true') v = true; else if (v === 'false') v = false; if (k && args[k] === undefined) args[k] = v }
    addCall(toolName, args, 'tc:' + m.index)
  }
  // ── الشكل الموثّق 2 (الصيغة الثانية): tool <name> {"args":{...}} / tool <name> = {...}
  const pairHeadRe = /(?:^|[\s`'"*_])tool\s+([a-z][a-z0-9_]{2,40})\s*(?:=\s*)?(?=\{)/gi
  while ((m = pairHeadRe.exec(src)) !== null) {
    const braceAt = src.indexOf('{', m.index + m[0].length - 1)
    if (braceAt === -1) continue
    const obj = readJsonObjectAt(src, braceAt)
    if (!obj) continue
    const name = m[1].trim()
    addCall(name, (obj.args && typeof obj.args === 'object') ? obj.args : (obj.arguments && typeof obj.arguments === 'object') ? obj.arguments : obj, 'pair:' + m.index)
  }
  for (const obj of extractJsonObjects(src)) {
    // مفتاح فريد لكل كائن JSON — عشان منسيبش استدعاءين مختلفين لنفس الأداة يتلخبطوا
    const uid = 'json:' + JSON.stringify(obj).slice(0, 300)
    if (typeof obj.tool === 'string') addCall(obj.tool, obj.args || {}, uid)
    else if (typeof obj.name === 'string' && (obj.args || obj.arguments)) addCall(obj.name, obj.args || obj.arguments, 'jn:' + uid)
  }
  let hasUnparsedJson = false
  if (!calls.length && !unknown.length) {
    if (/\{[^{}]{0,500}"(?:tool|name|action)"\s*:/i.test(src)) hasUnparsedJson = true
    if (/<tool_call>|<tool>/i.test(src)) hasUnparsedJson = true
  }
  return { calls, unknown, hasUnparsedJson }
}

// ═══════════════════════════════════════════════════════════════
//  🧠 System Prompt
// ═══════════════════════════════════════════════════════════════
function buildToolsSection() {
  const parts = [
    '═══ 🔧 صيغة استدعاء الأدوات ═══', '',
    '✅ الشكل 1 (JSON): <tool>{"name":"TOOL_NAME","args":{...}}<\/tool>',
    '✅ الشكل 2 (الزوج): tool TOOL_NAME {"args":{...}}   —   أو   <tool_call>TOOL_NAME<parameter name="k">v<\/parameter><parameter name="path">x.js<\/parameter><\/tool_call>',
    '',
    '📌 أمثلة:',
    '• قراءة: <tool>{"name":"read_file","args":{"path":"plugins/x.js","offset":1,"limit":100}}<\/tool>',
    '• قراءة (زوج): tool read_file {"path":"plugins/x.js","offset":1,"limit":100}',
    '• بحث: <tool>{"name":"search_code","args":{"query":"handler.command","path":"plugins"}}<\/tool>',
    '• قائمة: <tool>{"name":"list_files","args":{"dir":"plugins"}}<\/tool>', '',
    '❌ مرفوض: {tool:...} من غير اسم أداة معروف، أو أداة مش موجودة.',
    '─── الأدوات ───', '',
    '📦 list_files • read_file • search_code • plugin_list',
    '🔍 analyze_plugins • research_plugin • inspect_plugin • test_plugin • suggest_plugins • clone_plugin',
    '✏️ write_file • delete_file (⛔ npm_install ممنوع)',
    '🧰 create_tool • list_tools • read_tool • delete_tool',
    '🧠 think • plan • reflect • memory',
    '🌐 web_search • wiki_search • fetch_url',
    '🎯 ask_user • finish'
  ]
  if (customTools.size) { parts.push('', '🧰 *مخصصة:*'); for (const [name, t] of customTools.entries()) parts.push('• ' + name + ' — ' + t.description) }
  return parts.join('\n')
}
function buildSystemPrompt() {
  const bot = global.bot
  const cfg = getBotConfig(bot)
  const pluginCount = getPluginCount(bot)
  return [
    'أنت "صانع" — وكيل برمجيات ذكي شغال جوه بوت واتساب LIGHT BOT.',
    '🎯 Framework: LIGHT BOT (meowsab / Pomni-AI)',
    '🤖 البوت: ' + cfg.name + ' — عدد البلاجينز: ' + pluginCount,
    'البيئة: Node ' + process.version + ' — ROOT: ' + ROOT + ' — ' + new Date().toISOString().slice(0, 10),
    '',
    '═══ 🔓 سقف أمان ثابت — ' + SAFETY_HARD_ITER_LIMIT + ' دورة / ' + SAFETY_HARD_TOOL_LIMIT + ' أداة — وكل طلب شبكة بمهلة محدودة ═══',
    '',
    '═══ 🧠 ReAct Loop ═══',
    '1. 💭 فكر  2. 📝 خطّط  3. 🔧 نفّذ  4. 🪞 راجع  5. 🧠 اتذكر  6. ✅ خلّص',
    '',
    '═══ 🛡️ قواعد الجودة ═══',
    '1) الأرقام من TOOL_RESULT — متخمنش.',
    '2) TOOL_RESULT هي الحقيقة الوحيدة.',
    '3) متبعتش {} فاضي.',
    '',
    buildToolsSection(),
    '',
    '═══ 🎯 قواعد LIGHT BOT ═══',
    '1) ES Modules: import + export default handler.',
    '2) handler.command = ["اسم1", "اسم2"] أو RegExp.',
    '3) handler.usage = ["الاستخدام"].',
    '4) handler.category = "tools" | "owner" | "admin" | "group" | "bank" | "games" | "ai" | "downloads" | "sticker" | "search" | "info" | "islamic" | "voices" | "logos" | "sub" | "gif" | "nicknames".',
    '5) Flags: owner, admin, group, private, botAdmin, noSub, usePrefix, limit.',
    '6) ⚠️ category مش tags — usage مش help.',
    '7) global.db.users[m.sender] للمستخدم.',
    '8) global.db.groups[m.chat] للجروب.',
    '9) ⚠️ false/0/null بتمسح المفتاح — اقرا بـ || default.',
    '10) ⚠️ await m.lid2jid(x) قبل تخزين ID.',
    '11) Config: bot.config.info (nameBot, prefix, urls, copyright).',
    '12) الألعاب: خزّن في global.<اسم> واستخدم handler.before.',
    '13) الأزرار: conn.sendButton/sendButtonNormal/sendCarousel.',
    '14) APIs meowsab: Scrapy.ZeroAI, Scrapy.TextPro, Utils, Convert.',
    '15) plugins/ = تحميل تلقائي.',
    '16) 🚨 ممنوع handler مرتين.',
    '',
    '═══ 📋 قالب LIGHT BOT ═══',
    'const handler = async (m, { conn, bot, text, args, command, usedPrefix }) => {',
    '  try {',
    '    if (!args[0]) return m.reply(`الاستخدام: ${usedPrefix}${command} <نص>`)',
    '    const user = global.db.users[m.sender]',
    '    user.xp = (user.xp || 0) + 10',
    '    await m.reply("تم ✔️")',
    '  } catch (e) { console.error(e); m.reply("❌ " + e.message) }',
    '};',
    'handler.command = ["mycmd", "أمري"];',
    'handler.usage = ["mycmd"];',
    'handler.category = "tools";',
    'export default handler;',
    '',
    '═══ منهجية ═══',
    '• اقرا الملف الأول قبل التعديل.',
    '• write_file = الملف كامل.',
    '• عربية مصرية.'
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  💾 Sessions
// ═══════════════════════════════════════════════════════════════
function getOrCreateSession(m) {
  const k = skey(m); const st = getSettings()
  let s = sessions.get(k)
  if (!s || (Date.now() - s.lastActive > SESSION_TTL && !s.busy)) {
    if (s && !st.autoNewSession) return s
    s = { messages: [{ role: 'system', content: buildSystemPrompt() }], lastActive: Date.now(), agentMsgIds: new Set(), toolCount: 0, runTools: [], busy: false, prefix: '.', interrupted: false, cancel: false, wasResumed: false, askCount: 0, pendingDelete: null, pendingWrite: null, facts: [], longMemory: [], scratchpad: [], currentPlan: null, reflections: [] }
    sessions.set(k, s)
  }
  return s
}
function trimHistory(s) {
  const st = getSettings(); const max = Number(st.historyTrim) || 100
  if (s.messages.length > max) s.messages = [s.messages[0]].concat(s.messages.slice(-(max - 4)))
  const n = s.messages.length
  for (let i = 1; i < n - 10; i++) { const msg = s.messages[i]; if (typeof msg.content === 'string' && msg.content.length > 3000) msg.content = msg.content.slice(0, 3000) + '\n… (مختصر)' }
}
async function sendAgent(m, conn, body, s) {
  try {
    let out = String(body || '').trim(); if (!out) return
    const st = getSettings()
    if (st.showFactsSummary && s?.facts?.length) {
      const factLines = s.facts.slice(-8).map(f => `• ${f.key}: ${f.value}`).join('\n')
      const factBlock = '\n\n━━━━━━━━━━━━━━━━\n📊 *حقائق:*\n' + factLines
      if (out.length + factBlock.length <= 3400) out += factBlock
    }
    if (s?.runTools?.length) {
      const counts = {}; s.runTools.forEach(t => { counts[t] = (counts[t] || 0) + 1 })
      const footer = '\n\n_🛠️ ' + Object.entries(counts).map(([k, v]) => k + (v > 1 ? ' ×' + v : '')).join(' • ') + '_'
      if (out.length + footer.length <= 3800) out += footer
      s.runTools = []
    }
    if (out.length > 3800) out = out.slice(0, 3800) + '\n\n…(مختصر)'
    const sent = await conn.sendMessage(m.chat, { text: out }, { quoted: m })
    if (sent?.key?.id && s?.agentMsgIds) { s.agentMsgIds.add(sent.key.id); if (s.agentMsgIds.size > 50) s.agentMsgIds = new Set([...s.agentMsgIds].slice(-30)) }
  } catch (e) { console.error('[agent send]', e?.message || e) }
}
function extractFactsFromResult(toolName, args, result) {
  const facts = []; const r = String(result || '')
  if (toolName === 'list_files') { const m1 = r.match(/إجمالي:\s*(\d+)\s*عنصر/); if (m1) facts.push({ key: `عدد "${args?.dir || '.'}"`, value: m1[1] }) }
  if (toolName === 'search_code') { const m2 = r.match(/✅\s*(\d+)/); if (m2) facts.push({ key: `نتائج "${String(args?.query || '').slice(0, 30)}"`, value: m2[1] }) }
  if (toolName === 'plugin_list') { const m3 = r.match(/إجمالي\s*(\d+)\s*بلاجين/); if (m3) facts.push({ key: 'عدد البلاجينز', value: m3[1] }) }
  return facts
}

// ═══════════════════════════════════════════════════════════════
//  🔁 runLoop
// ═══════════════════════════════════════════════════════════════
// سقف الأمان الفعلي: الإعداد مسموح يقلّل الرقم، لكن عمره ما يتعدّى SAFETY_HARD_*_LIMIT.
function resolveLimits(st = getSettings()) {
  const rawIter = Number(st?.maxIter)
  const rawTools = Number(st?.maxTools)
  const iter = Number.isFinite(rawIter) && rawIter > 0 ? Math.min(Math.floor(rawIter), SAFETY_HARD_ITER_LIMIT) : SAFETY_HARD_ITER_LIMIT
  const tools = Number.isFinite(rawTools) && rawTools > 0 ? Math.min(Math.floor(rawTools), SAFETY_HARD_TOOL_LIMIT) : SAFETY_HARD_TOOL_LIMIT
  return { maxIter: iter, maxTools: tools, iterCapped: Number.isFinite(rawIter) && rawIter > SAFETY_HARD_ITER_LIMIT, toolsCapped: Number.isFinite(rawTools) && rawTools > SAFETY_HARD_TOOL_LIMIT }
}

// ═══════════════════════════════════════════════════════════════
//  🛡️ بوابة الموافقة (موافق / رفض)
// ═══════════════════════════════════════════════════════════════
// الافتراضي زي ما هو: askBeforeWrite/askBeforeDelete = false — مفيش موافقة بتتحول على ملك قديم.
function approvalKindFor(tool, st = getSettings()) {
  if (tool === 'write_file' && st?.askBeforeWrite) return 'write'
  if (tool === 'delete_file' && st?.askBeforeDelete) return 'delete'
  return null
}
// safetyEnabled بيقفل الأدوات اللي بتلمس النظام/المكتبات (مش بس بيسأل عليها).
function isSafetyGated(tool, st = getSettings()) { return !!st?.safetyEnabled && SAFETY_GATED_TOOLS.has(tool) }
function askBudgetLeft(s, st = getSettings()) { const max = Number(st?.maxAskPerSession) || 0; if (max <= 0) return Number.MAX_SAFE_INTEGER; return Math.max(0, max - (Number(s?.askCount) || 0)) }
function clearApproval(s) { if (!s) return null; const had = s.awaitingApproval || s.pendingWrite || s.pendingDelete || null; s.pendingWrite = null; s.pendingDelete = null; s.awaitingApproval = null; return had }
function pendingApprovalKind(s) { if (s?.pendingDelete) return 'delete'; if (s?.pendingWrite) return 'write'; return null }
// ⏰ أي موافقة معلّقة بتموت بعد APPROVAL_TTL_MS — مافيش تنفيذ بعد كده، ولا بتنفّذ بعد رفض.
function checkApprovalTimeout(s, now = Date.now()) {
  const at = Number(s?.awaitingApproval?.at) || 0
  if (!at) return null
  if (now - at <= APPROVAL_TTL_MS) return null
  clearApproval(s)
  return '⏰ *انتهت مهلة الموافقة* (' + Math.round(APPROVAL_TTL_MS / 60000) + ' دقايق) — الوكيل كمّل من غير ما ينفّذ أي كتابة أو حذف.'
}
// بيعلّق المهمة: بيسأل المالك في الشات، ومينفّذش الأداة إلا بكلمة "موافق".
async function requestApproval(s, m, conn, status, call, kind) {
  const st = getSettings()
  if (askBudgetLeft(s, st) <= 0) {
    const msg = '⛔ *سقف الموافقات:* (' + Number(st.maxAskPerSession) + ' في الجلسة) — *' + call.tool + '* اترفض تلقائيًا وماتنفذش.'
    s.messages.push({ role: 'user', content: toolObservation(call.tool, msg) })
    if (status) status.add('⛔', 'سقف الموافقات — ' + call.tool + ' اترفض')
    return { state: 'denied', message: msg }
  }
  s.askCount = (Number(s.askCount) || 0) + 1
  clearApproval(s)
  s.awaitingApproval = { kind, tool: call.tool, args: call.args || {}, at: Date.now() }
  if (kind === 'delete') s.pendingDelete = call; else s.pendingWrite = call
  const target = String(call.args?.path || '?')
  const ttlMin = Math.round(APPROVAL_TTL_MS / 60000)
  const msg = kind === 'delete'
    ? '⚠️ *موافقة مطلوبة — حذف:*\n\nالوكيل عايز يحذف `' + target + '`\n\n• *موافق* = ينفّذ الحذف\n• *رفض* = يلغي\n• *توقف* = يوقف المهمة\n\n⏰ المهلة ' + ttlMin + ' دقايق وبالمهلة دي المهمة بتكمّل من غير تنفيذ.\n↩️ أو رد على الرسالة دي بـ *موافق* / *رفض*.'
    : '⚠️ *موافقة مطلوبة — كتابة:*\n\nالوكيل عايز يكتب في `' + target + '`\n\n• *موافق* = ينفّذ الكتابة\n• *رفض* = يلغي\n• *توقف* = يوقف المهمة\n\n⏰ المهلة ' + ttlMin + ' دقايق وبالمهلة دي المهمة بتكمّل من غير تنفيذ.\n↩️ أو رد على الرسالة دي بـ *موافق* / *رفض*.'
  if (status) status.add('⏸️', 'مستني موافقتك: ' + call.tool + ' → ' + target)
  try {
    const sent = await conn.sendMessage(m.chat, { text: msg }, { quoted: m })
    // نسجّل مفتاح رسالة الموافقة عشان الرد عليها (quote + موافق) يتحسب رد على الوكيل.
    if (sent?.key?.id && s.agentMsgIds) { s.agentMsgIds.add(sent.key.id); if (s.agentMsgIds.size > 50) s.agentMsgIds = new Set([...s.agentMsgIds].slice(-30)) }
    return { state: 'pending', message: msg, key: sent?.key || null }
  }
  catch { return { state: 'pending', message: msg, key: null } }
}
// بينفّذ الموافقة المعلّقة مرة واحدة بس (بعد "موافق") — والمهلة لو خلصت مابينفّذش حاجة.
async function resumeApproved(s, m, conn, status, bot) {
  const expired = checkApprovalTimeout(s)
  if (expired) { s.messages.push({ role: 'user', content: 'APPROVAL [timeout]: ' + expired }); return { ok: false, expired: true, message: expired } }
  const kind = pendingApprovalKind(s)
  if (!kind) return { ok: false, message: 'مفيش موافقة معلّقة.' }
  const call = kind === 'delete' ? s.pendingDelete : s.pendingWrite
  clearApproval(s)
  const t0 = Date.now()
  if (status) status.setCurrent('🔧 بنفّذ ' + call.tool + ' بعد موافقتك…')
  const result = await executeToolSafe(call, { bot, conn })
  const dur = Math.round((Date.now() - t0) / 1000)
  const ok = !isToolErrorResult(result) && !String(result).startsWith('❌')
  const summary = String(result).split('\n')[0].slice(0, 120)
  if (status) status.add(ok ? '✅' : '⚠️', call.tool + ' → ' + summary)
  s.messages.push({ role: 'user', content: 'APPROVAL [approved]: المالك وافق — ' + call.tool + ' اتنفّذ.' })
  s.messages.push({ role: 'user', content: toolObservation(call.tool, result) })
  logAction('موافقة المالك: ' + call.tool + ' (' + dur + 'ث)')
  return { ok: true, kind, tool: call.tool, result, dur }
}
// "رفض" = الأداة اللي طلبت الموافقة تتلغي (مش المهمة كلها) — والتاريخ يفضل متّسق للجلسة.
function rejectPending(s) {
  const expired = checkApprovalTimeout(s)
  if (expired) return { ok: false, expired: true, message: expired }
  const kind = pendingApprovalKind(s)
  if (!kind) return { ok: false, message: 'مفيش موافقة معلّقة.' }
  const call = kind === 'delete' ? s.pendingDelete : s.pendingWrite
  const target = String(call.args?.path || '?')
  clearApproval(s)
  const msg = kind === 'delete' ? '❌ رفض المالك الحذف — `' + target + '` اتحذفش.' : '❌ رفض المالك الكتابة — `' + target + '` اتكتبش.'
  s.messages.push({ role: 'user', content: 'APPROVAL [rejected]: المالك رفض — ' + call.tool + ' ماتفذش.' })
  s.messages.push({ role: 'user', content: toolObservation(call.tool, '⛔ المالك رفض التنفيذ — الأداة دي اتلغت، كمّل من غيرها.') })
  logAction('رفض المالك: ' + call.tool)
  return { ok: true, rejected: true, kind, tool: call.tool, message: msg }
}

// يرد على "موافق"/"رفض" — نفس المنطق للأمر (بـ prefix) وللرد المباشر في الشات.
// opts.model بيتحقن في الاختبارات (نفس منفذ runLoop) — الإنتاج بيستخدم callAI.
async function handleApprovalReply(s, m, conn, bot, word, opts = {}) {
  const approve = ['موافق', 'اوافق', 'ok', 'yes'].includes(String(word || '').toLowerCase())
  if (!pendingApprovalKind(s)) return checkApprovalTimeout(s) || 'مفيش موافقة معلّقة.'
  if (!approve) { const out = rejectPending(s); persistSessions(true); return out.message }
  if (s.busy) return '⏳ الوكيل شغّال…'
  s.busy = true; s.cancel = false
  const status = new ActivityStatus(conn, m.chat, m); await status.init()
  try {
    const out = await resumeApproved(s, m, conn, status, bot)
    if (!out.ok) { await status.stop(); return out.message }
    await runLoop(s, m, conn, status, bot, opts)
    await status.stop()
    return null
  } catch (e) { await status.stop('❌ ' + e.message); return '❌ ' + e.message }
  finally { s.busy = false; persistSessions(true) }
}

// ═══════════════════════════════════════════════════════════════
//  🧾 ملاحظات الأدوات (بتترجع للوكيل زي أي أداة)
// ═══════════════════════════════════════════════════════════════
function toolErrorObservation(tool, e) {
  const msg = String(e?.message || e || 'خطأ غير معروف').slice(0, 400)
  return 'TOOL_ERROR [' + tool + ']: ⚠️ فشلت — ملاحظة قابلة لإعادة المحاولة: ' + msg
}
function isToolErrorResult(result) { return /^TOOL_ERROR \[/.test(String(result || '')) }
// النتيجة اللي بترجع للموديل: اسم الأداة + نتيجتها الحقيقية (+ وسم واضح لو فشلت).
function toolObservation(tool, result) {
  const body = String(result ?? '').slice(0, 50000)
  const failed = isToolErrorResult(result) || body.startsWith('❌')
  if (!failed) return 'TOOL_RESULT [' + tool + ']:\n' + body
  const tail = isToolErrorResult(result) ? '' : '\n⚠️ التنفيذ فشل — دي ملاحظة قابلة لإعادة المحاولة (جرّب مدخلات/أداة مختلفة).'
  return 'TOOL_RESULT [' + tool + '] [فشل — قابل لإعادة المحاولة]:\n' + body + tail
}

async function runLoop(s, m, conn, status, bot, opts = {}) {
  trimHistory(s)
  const st = getSettings()
  const limits = resolveLimits(st)
  const maxIter = limits.maxIter
  const maxTools = limits.maxTools
  const model = typeof opts.model === 'function' ? opts.model : callAI
  let formatRetries = 0; const MAX_FORMAT_RETRIES = 20; let iter = 0
  const ctx = { bot, conn }

  while (iter < maxIter) {
    iter++
    if (s.cancel) return
    if (sessions.get(skey(m)) !== s) { console.log('[agent] ⚠️ الجلسة اتغيرت'); return }
    s.lastActive = Date.now()
    const reply = await model(s.messages, (msg) => {
      if (s.cancel) return
      if (msg.startsWith('🚀') || msg.startsWith('🧠')) status.setCurrent(msg)
      else if (msg.startsWith('✅')) status.add('✅', msg.replace(/^✅\s*/, ''))
    })
    if (s.cancel) return
    const parsed = parseToolCalls(reply)
    const calls = parsed.calls
    const unknownTools = parsed.unknown || []
    if (parsed.hasUnparsedJson && !calls.length && !unknownTools.length) {
      formatRetries++
      status.add('⚠️', 'صيغة غلط (' + formatRetries + '/' + MAX_FORMAT_RETRIES + ')')
      s.messages.push({ role: 'assistant', content: reply })
      s.messages.push({ role: 'user', content: 'TOOL_RESULT [format_error]: الصيغة: <tool>{"name":"read_file","args":{"path":"x.js"}}</tool> أو tool read_file {"path":"x.js"}' })
      if (formatRetries >= MAX_FORMAT_RETRIES) { await sendAgent(m, conn, '⚠️ مش قادر يستخدم الصيغة.', s); persistSessions(true); return }
      persistSessions(); continue
    }
    if (unknownTools.length) {
      s.messages.push({ role: 'assistant', content: reply })
      s.messages.push({ role: 'user', content: 'TOOL_RESULT [unknown]: ' + unknownTools.join(', ') + ' مش موجودة.' })
      if (!calls.length) { persistSessions(); continue }
    }
    if (!calls.length) {
      const halluc = detectHallucinatedNumbers(reply, s)
      let finalReply = reply
      if (halluc) { status.add('⚠️', 'هلوسة'); finalReply += '\n\n' + halluc.message }
      s.messages.push({ role: 'assistant', content: reply })
      await sendAgent(m, conn, finalReply, s); persistSessions(true); return
    }
    formatRetries = 0
    s.messages.push({ role: 'assistant', content: reply })
    status.add('🧠', `دورة ${iter}: ${calls.length} أداة`)
    let paused = false
    const askCall = calls.find(c => c.tool === 'ask_user')
    const finishCall = calls.find(c => c.tool === 'finish')
    if (askCall) {
      s.askCount = (s.askCount || 0) + 1
      s.messages.push({ role: 'user', content: 'TOOL_RESULT [ask_user]: اتبعت.' })
      await sendAgent(m, conn, '❓ ' + String(askCall.args?.question || 'محتاج توضيح…'), s)
      paused = true
    }
    if (finishCall) {
      s.messages.push({ role: 'user', content: 'TOOL_RESULT [finish]: انتهت.' })
      await sendAgent(m, conn, '🏁 ' + String(finishCall.args?.summary || 'خلصت.'), s)
      sessions.delete(skey(m)); persistSessions(true); return
    }
    if (paused) { persistSessions(true); return }
    const toolCalls = calls.filter(c => c.tool !== 'ask_user' && c.tool !== 'finish')
    const READ_TOOLS = new Set(['list_files','read_file','search_code','plugin_list','analyze_plugins','list_tools','read_tool','research_plugin','inspect_plugin','suggest_plugins','web_search','wiki_search','fetch_url','think','reflect','memory'])
    const requiredArgs = { 'read_file': ['path'], 'search_code': ['query'], 'research_plugin': ['query'], 'inspect_plugin': ['name'], 'test_plugin': ['name'], 'suggest_plugins': ['category'], 'clone_plugin': ['source', 'newName'], 'write_file': ['path', 'content'], 'delete_file': ['path'], 'npm_install': ['package'], 'create_tool': ['name', 'description', 'code'], 'read_tool': ['name'], 'delete_tool': ['name'], 'think': ['thought'], 'plan': ['goal', 'steps'], 'reflect': ['what'], 'web_search': ['query'], 'wiki_search': ['query'], 'fetch_url': ['url'] }
    const seenSigs = new Set()
    const filteredCalls = []
    for (const c of toolCalls) {
      const req = requiredArgs[c.tool] || []
      const missing = req.filter(k => !c.args || c.args[k] === undefined || c.args[k] === null || String(c.args[k]).trim() === '')
      if (missing.length) { s.messages.push({ role: 'user', content: toolObservation(c.tool, '❌ ناقص: ' + missing.join(', ')) }); status.add('❌', 'رفض ' + c.tool); continue }
      if (isSafetyGated(c.tool, st)) {
        s.messages.push({ role: 'user', content: toolObservation(c.tool, '⛔ الأداة *' + c.tool + '* مقفولة و safetyEnabled شغّال — استخدم أداة تانية أو اقفل safetyEnabled من الإعدادات.') })
        status.add('⛔', 'safetyEnabled رفض ' + c.tool)
        continue
      }
      const sig = c.tool + '|' + JSON.stringify(c.args || {}).slice(0, 500)
      if (seenSigs.has(sig)) continue
      seenSigs.add(sig); filteredCalls.push(c)
    }
    if (!filteredCalls.length) { status.add('⚠️', 'كل الأدوات مكررة'); persistSessions(); continue }
    const toolBudget = Math.max(0, maxTools - (Number(s.toolCount) || 0))
    if (toolBudget <= 0) {
      await sendAgent(m, conn, '⛔ *سقف الأدوات:* وصلت ' + maxTools + ' أداة — المهمة اتوقفت.', s)
      persistSessions(true); return
    }
    const runnable = filteredCalls.slice(0, toolBudget)
    s.toolCount = (Number(s.toolCount) || 0) + runnable.length
    runnable.forEach(c => { c._session = s; s.runTools.push(c.tool) })
    // 🛡️ بوابة الموافقة: أي كتابة/حذف بيتعلّق لحد ما المالك يقول "موافق" — والمرفوض بيتشال من التنفيذ.
    const executable = []
    for (const c of runnable) {
      const kind = approvalKindFor(c.tool, st)
      if (!kind) { executable.push(c); continue }
      const ask = await requestApproval(s, m, conn, status, c, kind)
      if (ask.state === 'pending') { persistSessions(true); return }
    }
    if (!executable.length) { status.add('⚠️', 'كل أدوات الدورة محتاجة موافقة'); persistSessions(); continue }
    const allReads = executable.length > 1 && executable.every(c => READ_TOOLS.has(c.tool) && !customTools.has(c.tool))
    if (st.parallelToolsEnabled && allReads) {
      if (st.verboseTools) status.setCurrent('⚡ بنفذ ' + executable.length + ' بالتوازي…')
      const results = await Promise.all(executable.map(async (c) => { const t0 = Date.now(); const result = await executeToolSafe(c, ctx); return { c, result, dur: Math.round((Date.now() - t0) / 1000) } }))
      for (const { c, result, dur } of results) {
        if (s.cancel) return
        const summary = String(result).split('\n')[0].slice(0, 120); const ok = !String(result).startsWith('❌') && !isToolErrorResult(result)
        status.add(ok ? '✅' : '⚠️', c.tool + ' → ' + summary + ' (' + dur + 'ث)')
        const facts = extractFactsFromResult(c.tool, c.args, result)
        for (const f of facts) { s.facts = (s.facts || []).filter(x => x.key !== f.key); s.facts.push(f) }
        s.messages.push({ role: 'user', content: toolObservation(c.tool, result) })
      }
      persistSessions()
    } else {
      for (const c of executable) {
        if (s.cancel) return
        const label = toolLabel(c)
        if (st.verboseTools) status.setCurrent('🔧 ' + label + '…')
        const t0 = Date.now()
        const result = await executeToolSafe(c, ctx)
        const dur = Math.round((Date.now() - t0) / 1000)
        const summary = String(result).split('\n')[0].slice(0, 120); const ok = !String(result).startsWith('❌') && !isToolErrorResult(result)
        status.add(ok ? '✅' : '⚠️', c.tool + ' → ' + summary + ' (' + dur + 'ث)')
        const facts = extractFactsFromResult(c.tool, c.args, result)
        for (const f of facts) { s.facts = (s.facts || []).filter(x => x.key !== f.key); s.facts.push(f) }
        s.messages.push({ role: 'user', content: toolObservation(c.tool, result) })
        persistSessions()
      }
    }
    if (paused) { persistSessions(true); return }
  }
  await sendAgent(m, conn, '⛔ *سقف الأمان:* وصلت ' + maxIter + ' دورة و' + maxTools + ' أداة — المهمة اتوقفت.\nالحد ده ثابت (مش بيتغير من الشات) — ابعت *جديد* لمهمة جديدة.', s)
  persistSessions(true)
}

async function processUserMessage(s, m, conn, userText, usedPrefix, bot, opts = {}) {
  if (s.busy) { try { await m.reply('⏳ الوكيل شغّال…') } catch {}; return }
  // 🛡️ أي موافقة معلّقة فات وقتها أو المالك بدأ مهمة جديدة = تتلغي (ماتنفذش أي كتابة/حذف).
  const droppedApproval = pendingApprovalKind(s)
  if (droppedApproval) {
    const expiredMsg = checkApprovalTimeout(s)
    if (expiredMsg) s.messages.push({ role: 'user', content: 'APPROVAL [timeout]: ' + expiredMsg })
    else { clearApproval(s); s.messages.push({ role: 'user', content: 'APPROVAL [cancelled]: المالك بدأ مهمة جديدة — ' + droppedApproval + ' المعلّقة اتلغت وماتنفذتش.' }) }
  }
  s.busy = true; s.cancel = false
  s.prefix = usedPrefix || s.prefix || '.'
  s.lastActive = Date.now()
  s.toolCount = 0; s.runTools = []; s.facts = []
  s.messages.push({ role: 'user', content: String(userText || '').slice(0, 8000) })
  persistSessions()
  const status = new ActivityStatus(conn, m.chat, m)
  await status.init()
  try { await m.react('⏳') } catch {}
  try {
    await runLoop(s, m, conn, status, bot, opts)
    if (s.cancel) { await status.stop('⏹️ تم الإيقاف.'); try { await m.react('⏹️') } catch {} }
    else { await status.stop(); try { await m.react('✅') } catch {} }
  } catch (e) {
    console.error('[agent]', e)
    await status.stop('❌ مشكلة:\n' + String(e?.message || e).slice(0, 3500))
    try { await m.react('❌') } catch {}
  } finally { s.busy = false; s.lastActive = Date.now(); persistSessions(true) }
}

// ═══════════════════════════════════════════════════════════════
//  🎛️ Views
// ═══════════════════════════════════════════════════════════════
function buildHelp(p) {
  return [
    '🤖 *صانع البلاجينز — LIGHT Agent (v28.0)*',
    '',
    '🎯 LIGHT BOT (meowsab) • 🔓 سقف ' + SAFETY_HARD_ITER_LIMIT + ' دورة • ⏱️ مهلة 30ث على كل طلب',
    '🎯 NVIDIA Key مضاف ✅',
    '',
    '*🚀:* ' + p + 'صانع <وصف>',
    '*🛑:* توقف / موافق / رفض / جديد / امسح',
    '*🧠 الموديلز:* الموديلز / اكتشف-الموديلز / اختبر-الموديلز <مزود>',
    '*🆓:* المجانية / الموجهات / وضع-المجاني on|off',
    '*🔥 Groq:* groq-info / اختبر-groq / ضبط-groq',
    '*🔑:* مفتاح <مزود> <key> / مفاتيح / مسح-الكل',
    '*♻️:* اعرض-الجلسات / استئناف-الكل / تنظيف',
    '*🧅 Tor:* تفعيل-tor / ايقاف-tor / افحص-tor',
    '*🧠:* ذاكرة / خطة / افكار / حقائق',
    '*🔍:* ابحث / افحص / جرب / اقترح',
    '*🧰:* ادواتي / مسح-ادواتي',
    '*⚡:* بلا-حدود / توازي / وضع',
    '*🌐:* api / تعطيل / تفعيل / صحة / معلومات'
  ].join('\n')
}
function toolsListText() {
  return ['🧰 *أدوات الوكيل (LIGHT v28):*','','📦 list_files • read_file • search_code • plugin_list','🔍 analyze_plugins • research_plugin • inspect_plugin • test_plugin • suggest_plugins • clone_plugin','✏️ write_file • delete_file • npm_install (ممنوع)','🧰 create_tool • list_tools • read_tool • delete_tool','🧠 think • plan • reflect • memory','🌐 web_search • wiki_search • fetch_url','🎯 ask_user • finish','','🧰 *مخصصة:* ' + customTools.size].join('\n')
}
function providerStatus() {
  const cfg = getAgentCfg(); const st = getSettings()
  const gqKey = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
  const kiloKey = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
  const llm7Key = process.env.LLM7_KEY || cfg.llm7Key || st.llm7Key
  const orKey = process.env.OPENROUTER_KEY || cfg.openrouterKey || st.openrouterKey
  const nvKey = process.env.NVIDIA_API_KEY || cfg.nvidiaKey || st.nvidiaKey || DEFAULT_NVIDIA_KEY
  const afKey = process.env.AIRFORCE_KEY || cfg.airforceKey || st.airforceKey
  const cbKey = process.env.CEREBRAS_KEY || cfg.cerebrasKey || st.cerebrasKey
  const ghKey = process.env.GITHUB_TOKEN || cfg.githubToken || st.githubToken
  return ['🌐 *المزودين:*','',(kiloKey ? '🥇 Kilo ✅' : '🥇 Kilo ⬜'),(gqKey ? '🥈 Groq ✅' : '🥈 Groq ⬜'),(llm7Key ? '🥉 LLM7 ✅' : '🥉 LLM7 ⚪'),(nvKey ? '🎯 NVIDIA ✅' : '🎯 NVIDIA ⬜'),(orKey ? '🔷 OpenRouter ✅' : '🔷 OpenRouter ⬜'),(ghKey ? '🐙 GitHub ✅' : '🐙 GitHub ⬜'),(cbKey ? '⚡ Cerebras ✅' : '⚡ Cerebras ⬜'),(afKey ? '✈️ Airforce ✅' : '✈️ Airforce ⬜'),'🎨 Pollinations ✅ (مجاني)','🤖 GPT-AI ✅ (مجاني)','💳 UncloseAI','','🎯 Framework: LIGHT BOT','⏱️ مهلة الطلبات: 30ث','🔓 سقف الدورات: ' + SAFETY_HARD_ITER_LIMIT,'🧅 Tor: ' + (st.useTor ? '✅' : '⬜'),'💾 جلسات: ' + sessions.size,'🧰 أدوات: ' + customTools.size].join('\n')
}
function settingsText() {
  const st = getSettings(); const cfg = getAgentCfg()
  const lim = resolveLimits(st)
  return ['⚙️ *الإعدادات:*','',`• Framework: LIGHT`,`• maxIter: ${Number(st.maxIter) <= 0 ? '🔓' : st.maxIter} (الفعلي: ${lim.maxIter})${lim.iterCapped ? ' ⛔️' : ''}`,`• maxTools: ${Number(st.maxTools) <= 0 ? '🔓' : st.maxTools} (الفعلي: ${lim.maxTools})${lim.toolsCapped ? ' ⛔️' : ''}`,`• موافقة الكتابة: ${st.askBeforeWrite ? '✅' : '⬜'} • موافقة الحذف: ${st.askBeforeDelete ? '✅' : '⬜'} • سقف الموافقات: ${Number(st.maxAskPerSession) > 0 ? st.maxAskPerSession : 'بلا حد'}`,`• safetyEnabled: ${st.safetyEnabled ? '✅' : '⬜'}`,`• heartbeatMs: ${st.heartbeatMs}`,`• statusMode: ${st.statusMode}`,`• autoResume: ${st.autoResume}`,`• preferFreeModels: ${st.preferFreeModels}`,`• groqReasoningEffort: ${st.groqReasoningEffort}`,`• groqMaxTokens: ${st.groqMaxTokens}`,`• nvidiaKey: ${st.nvidiaKey ? '✅ ' + maskKey(st.nvidiaKey) : '⬜'}`,`• kiloKey: ${st.kiloKey ? '✅' : '⬜'}`,`• groqKey: ${st.groqKey ? '✅' : '⬜'}`,`• llm7Key: ${st.llm7Key ? '✅' : '⬜'}`,`• openrouterKey: ${st.openrouterKey ? '✅' : '⬜'}`,'',`🔒 مزود مجبور: ${cfg.forced || '(تلقائي)'}`].join('\n')
}
function keysText() {
  const cfg = getAgentCfg(); const st = getSettings()
  const gqKey = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
  const kiloKey = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
  const llm7Key = process.env.LLM7_KEY || cfg.llm7Key || st.llm7Key
  const orKey = process.env.OPENROUTER_KEY || cfg.openrouterKey || st.openrouterKey
  const nvKey = process.env.NVIDIA_API_KEY || cfg.nvidiaKey || st.nvidiaKey || DEFAULT_NVIDIA_KEY
  return ['🔑 *المفاتيح:*','',`• Kilo: ${kiloKey ? '✅ ' + maskKey(kiloKey) : '⬜'}`,`• Groq: ${gqKey ? '✅ ' + maskKey(gqKey) : '⬜'}`,`• LLM7: ${llm7Key ? '✅ ' + maskKey(llm7Key) : '⚪'}`,`• NVIDIA: ${nvKey ? '✅ ' + maskKey(nvKey) : '⬜'}`,`• OpenRouter: ${orKey ? '✅ ' + maskKey(orKey) : '⬜'}`].join('\n')
}
function sessionsListText() {
  if (!sessions.size) return '💬 مفيش جلسات.'
  const entries = [...sessions.entries()].sort((a, b) => (b[1].lastActive || 0) - (a[1].lastActive || 0))
  const lines = entries.slice(0, 20).map(([k, s]) => { const ago = Math.round((Date.now() - s.lastActive) / 1000); const agoStr = ago < 60 ? ago + 'ث' : (ago < 3600 ? Math.round(ago / 60) + 'د' : Math.round(ago / 3600) + 'س'); const flags = []; if (s.busy) flags.push('🟢'); if (s.interrupted) flags.push('⚠️'); return `• ${flags.join(' ') || '⚪'} — ${agoStr} — رسائل: ${s.messages.length}` })
  return `💬 *الجلسات (${sessions.size}):*\n\n${lines.join('\n')}`
}
function actionLogText() { if (!actions.length) return '🗂️ مفيش.'; return '🗂️ *آخر:*\n' + actions.slice(-15).map(e => { const d = new Date(e.t); return '• [' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '] ' + e.a }).join('\n') }
function infoText(bot) {
  const cfg = getBotConfig(bot)
  const mem = process.memoryUsage(); const uptime = Math.round(process.uptime())
  const totalModels = Object.values(modelsCache.providers).reduce((a, b) => a + b.length, 0)
  return ['ℹ️ *معلومات:*','',`• Framework: LIGHT BOT (meowsab)`,`• Bot: ${cfg.name}`,`• Node: ${process.version}`,`• الرام: ${Math.round(mem.rss / 1024 / 1024)}MB`,`• Uptime: ${Math.floor(uptime / 3600)}س ${Math.floor((uptime % 3600) / 60)}د`,`• الجلسات: ${sessions.size}`,`• 🧰 أدوات: ${customTools.size}`,`• 🧠 موديلات: ${totalModels}`,`• 🔓 سقف الدورات: ${SAFETY_HARD_ITER_LIMIT} • أدوات: ${SAFETY_HARD_TOOL_LIMIT}`,`• ⏱️ مهلة الطلبات: 30ث`,`• 🎯 NVIDIA: ✅ مضاف`].join('\n')
}
function factsText(s) { if (!s?.facts?.length) return '📊 مفيش حقائق.'; return '📊 *حقائق:*\n' + s.facts.map(f => `• ${f.key}: ${f.value}`).join('\n') }

// ═══════════════════════════════════════════════════════════════
//  🎛️ Main Handler
// ═══════════════════════════════════════════════════════════════
const handler = async (m, ctx) => {
  const { conn, bot, args = [], text, usedPrefix } = ctx || {}
  const k = skey(m)
  const a0 = (args[0] || '').toLowerCase()
  const a1 = (args[1] || '').toLowerCase()
  const p = usedPrefix || '.'

  if (!text || !text.trim()) return m.reply(buildHelp(p))

  if (['توقف', 'وقف', 'الغاء', 'إلغاء', 'cancel'].includes(a0)) {
    const s = sessions.get(k)
    // ⏸️ لو فيه موافقة معلّقة، "توقف" يلغيها — مفيش تنفيذ بعد كده.
    if (s && pendingApprovalKind(s)) {
      const kind = pendingApprovalKind(s)
      clearApproval(s); persistSessions(true)
      return m.reply('⏹️ تم الإيقاف وإلغاء موافقة الـ' + (kind === 'delete' ? 'حذف' : 'كتابة') + ' المعلّقة — ماتفذتش.')
    }
    if (!s || !s.busy) return m.reply('الوكيل مش شغال.')
    s.cancel = true; s.busy = false; persistSessions(true)
    return m.reply('⏹️ تم الإيقاف.')
  }
  if (['انهاء', 'إيقاف', 'ايقاف', 'end'].includes(a0)) { const had = sessions.delete(k); persistSessions(true); return m.reply(had ? '✅' : 'مفيش جلسة.') }
  if (['امسح'].includes(a0)) { const had = sessions.delete(k); persistSessions(true); return m.reply(had ? '🗑️' : 'مفيش جلسة.') }
  if (['جديد', 'reset'].includes(a0)) {
    sessions.delete(k); persistSessions(true)
    const req = args.slice(1).join(' ').trim()
    if (!req) return m.reply('🔄 اتصفّرت.')
    const s = getOrCreateSession(m)
    return processUserMessage(s, m, conn, req, p, bot)
  }
  if (['موافق', 'اوافق', 'ok', 'yes'].includes(a0)) {
    const s = sessions.get(k); if (!s) return m.reply('مفيش جلسة.')
    const out = await handleApprovalReply(s, m, conn, bot, a0)
    return out ? m.reply(out) : undefined
  }
  if (['رفض', 'reject', 'no'].includes(a0)) {
    const s = sessions.get(k); if (!s) return m.reply('مفيش جلسة.')
    return m.reply(await handleApprovalReply(s, m, conn, bot, a0))
  }

  if (['الموديلز', 'models'].includes(a0)) {
    const lines = ['🧠 *الموديلات:*', '']
    for (const [prov, list] of Object.entries(modelsCache.providers)) { if (!list.length) continue; const fc = list.filter(mm => mm.free).length; lines.push(`*${prov}* (${list.length}${fc ? ' 🆓' + fc : ''}):`); for (const mm of list.slice(0, 12)) lines.push(`  \`${mm.id}\``); lines.push('') }
    if (lines.length === 2) lines.push('(لسه — اكتب: ' + p + 'صانع اكتشف-الموديلز)')
    return m.reply(lines.join('\n'))
  }
  if (['اكتشف-الموديلز', 'refresh-models', 'discover'].includes(a0)) {
    m.reply('🔄 بجيب الموديلات من كل المزودين…')
    try { await refreshModelsCache(true); const counts = Object.entries(modelsCache.providers).map(([pp, l]) => `${pp}: ${l.length}`).join(' • '); return m.reply(`✅ اتحدث!\n\n${counts || '(مفيش)'}`) }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 300)) }
  }
  if (['اختبر-الموديلز', 'probe-models'].includes(a0)) {
    const target = a1 || 'nvidia'
    if (!modelsCache.providers[target]) return m.reply('❌ مفيش موديلات لـ ' + target + '\n\nجرب: ' + p + 'صانع اكتشف-الموديلز')
    m.reply(`🧪 بختبر *${target}*…`)
    try { const r = await probeAllProvider(target, () => {}); return m.reply(`✅ ${target}:\n• Total: ${r.tested}\n• شغال: ${r.ok} ✅\n• فشل: ${r.failed} ❌`) }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 300)) }
  }

  if (['المجانية', 'مجاني', 'free-models', 'free'].includes(a0) && args.length === 1) {
    const { byProvider, total, routers } = getAllFreeModels()
    if (!total && !routers.length) return m.reply('🆓 مفيش موديلات مجانية مكتشفة.\n\nجرب: ' + p + 'صانع اكتشف-الموديلز')
    const lines = [`🆓 *المجانية (${total}):*`, '']
    if (routers.length) { lines.push('🤖 موجّهات:'); for (const r of routers) lines.push(`  • \`${r.provider}/${r.id}\``); lines.push('') }
    for (const [prov, list] of Object.entries(byProvider)) { const nonRouter = list.filter(mm => !mm.isRouter); if (!nonRouter.length) continue; lines.push(`*${prov}* (${nonRouter.length}):`); for (const mm of nonRouter.slice(0, 15)) lines.push(`  \`${mm.id}\``); lines.push('') }
    return m.reply(lines.join('\n'))
  }
  if (['الموجهات', 'routers'].includes(a0)) {
    const lines = ['🤖 *موجّهات:*', '']
    for (const [prov, routers] of Object.entries(FREE_ROUTERS)) { if (!routers.length) continue; lines.push(`*${prov}*:`); for (const r of routers) lines.push(`  • \`${r}\``); lines.push('') }
    return m.reply(lines.join('\n'))
  }
  if (['وضع-المجاني', 'free-only'].includes(a0) && args[1]) {
    const v = ['on', 'تشغيل', 'فعل', 'نعم'].includes(a1.toLowerCase()) ? true : ['off', 'ايقاف', 'قفل', 'لا'].includes(a1.toLowerCase()) ? false : null
    if (v === null) return m.reply('استخدم: ' + p + 'صانع وضع-المجاني on|off')
    setSetting('freeOnlyMode', v); setSetting('preferFreeModels', v)
    return m.reply('🆓 ' + (v ? '✅' : '⬜'))
  }
  if (['امسح-الموديلز', 'clear-models'].includes(a0)) {
    modelsCache.providers = {}; modelsCache.probed = {}; modelsCache.lastRefresh = 0
    saveModelsCache()
    try { if (fs.existsSync(MODELS_CACHE_FILE)) fs.unlinkSync(MODELS_CACHE_FILE) } catch {}
    return m.reply('🗑️ تم مسح الكاش.')
  }

  if (['groq-info', 'معلومات-groq'].includes(a0)) {
    const cfg = getAgentCfg(); const st = getSettings()
    const key = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
    return m.reply(`🔥 *Groq:*\n\n• المفتاح: ${key ? '✅' : '⬜'}\n• effort: ${st.groqReasoningEffort}\n• max_tokens: ${st.groqMaxTokens}\n\nلإضافة: ${p}صانع مفتاح groq <key>`)
  }
  if (['ضبط-groq'].includes(a0) && args.length >= 3) {
    const subKey = args[1].toLowerCase(); const val = args.slice(2).join(' ')
    const map = { 'effort': 'groqReasoningEffort', 'tokens': 'groqMaxTokens', 'temperature': 'groqTemperature', 'temp': 'groqTemperature' }
    const realKey = map[subKey]; if (!realKey) return m.reply('المفاتيح: effort / tokens / temp')
    let v = val
    if (realKey === 'groqReasoningEffort') { if (!['low', 'medium', 'high'].includes(val.toLowerCase())) return m.reply('low/medium/high'); v = val.toLowerCase() }
    else { const n = Number(val); if (isNaN(n)) return m.reply('رقم'); v = n }
    setSetting(realKey, v)
    return m.reply(`✅ ${realKey} = ${JSON.stringify(v)}`)
  }
  if (['اختبر-groq', 'groq-test'].includes(a0)) {
    const cfg = getAgentCfg(); const st = getSettings(); const key = process.env.GROQ_KEY || cfg.groqKey || st.groqKey
    if (!key) return m.reply('❌ مفيش مفتاح Groq.')
    m.reply('🧪 بختبر Groq…')
    try { const t0 = Date.now(); const result = await groqCall([{ role: 'user', content: 'قول "OK"' }], { id: 'openai/gpt-oss-120b' }, key); return m.reply(`✅ (${Math.round((Date.now() - t0) / 1000)}ث)\n📤 ${String(result).slice(0, 500)}`) }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 400)) }
  }
  if (['اختبر-nvidia', 'nvidia-test'].includes(a0)) {
    m.reply('🧪 بختبر NVIDIA…')
    try { const t0 = Date.now(); const result = await nvidiaCall([{ role: 'user', content: 'قول "OK"' }], 'meta/llama-3.1-70b-instruct', DEFAULT_NVIDIA_KEY); return m.reply(`✅ (${Math.round((Date.now() - t0) / 1000)}ث)\n📤 ${String(result).slice(0, 500)}`) }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 400)) }
  }
  if (['اختبر-kilo', 'kilo-test'].includes(a0)) {
    const cfg = getAgentCfg(); const st = getSettings(); const key = process.env.KILO_API_KEY || cfg.kiloKey || st.kiloKey
    if (!key) return m.reply('❌ مفيش مفتاح Kilo.')
    m.reply('🧪 بختبر Kilo…')
    try { const t0 = Date.now(); const res = await axios.post('https://api.kilo.ai/api/gateway/chat/completions', { model: 'kilo/glm-5-free', messages: [{ role: 'user', content: 'قول "OK"' }], max_tokens: 20 }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'X-KILOCODE-EDITORNAME': 'light-agent' }, timeout: HTTP_TIMEOUT_MS }); const c = res.data?.choices?.[0]?.message?.content; return c ? m.reply('✅ (' + Math.round((Date.now() - t0) / 1000) + 'ث)\n📤 ' + c.slice(0, 100)) : m.reply('⚠️ رد غير متوقع') }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 300)) }
  }
  if (['اختبر-llm7', 'llm7-test'].includes(a0)) {
    m.reply('🧪 بختبر LLM7…')
    try { const t0 = Date.now(); const result = await llm7Call([{ role: 'user', content: 'قول "OK"' }], 'gpt-4o-mini', {}); return m.reply(`✅ (${Math.round((Date.now() - t0) / 1000)}ث)\n📤 ${String(result).slice(0, 100)}`) }
    catch (e) { return m.reply('❌ فشل: ' + String(e?.message || e).slice(0, 300)) }
  }

  if (['تنظيف', 'cleanup'].includes(a0)) {
    let removed = 0; const now = Date.now()
    for (const [k2, s] of [...sessions.entries()]) if (now - (s.lastActive || 0) > 7 * 24 * 60 * 60 * 1000 && !s.busy) { sessions.delete(k2); removed++ }
    persistSessions(true)
    return m.reply('🧹 ' + removed + '. باقي: ' + sessions.size)
  }
  if (['استئناف-الكل', 'resume-all'].includes(a0)) {
    return m.reply('♻️ Auto-resume بيشتغل تلقائي.')
  }
  if (['اعرض-الجلسات', 'debug-sessions'].includes(a0)) {
    if (!sessions.size) return m.reply('💬 مفيش جلسات.')
    const lines = []
    for (const [k2, s] of sessions.entries()) { const [chat, sender] = k2.split('|'); lines.push(`• *${k2}*\n   رسائل=${s.messages.length} | tools=${s.toolCount}`) }
    return m.reply('🔍 *الجلسات:*\n\n' + lines.join('\n'))
  }
  if (['مسح-الجلسات', 'clearsessions'].includes(a0)) { const n = sessions.size; sessions.clear(); try { if (fs.existsSync(SESSIONS_FILE)) fs.unlinkSync(SESSIONS_FILE) } catch {}; return m.reply('🗑️ ' + n) }

  if (['tor', 'تور'].includes(a0)) return m.reply(`🧅 *Tor:*\n• مفعّل: ${getSettings().useTor ? '✅' : '⬜'}\n• جاهز: ${torState.ready ? '✅' : '⬜'}\n• دورات: ${torState.circuitCount}\n• خطأ: ${torState.error || 'مفيش'}`)
  if (['تفعيل-tor', 'tor-on'].includes(a0)) { setSetting('useTor', true); return m.reply('🧅 تم تفعيل Tor.') }
  if (['ايقاف-tor', 'tor-off'].includes(a0)) { setSetting('useTor', false); return m.reply('🧅 تم إيقاف Tor.') }
  if (['افحص-tor', 'tor-check'].includes(a0)) { const r = await checkTor(); return m.reply(r.ok ? '✅ Tor شغال!\n📍 ' + r.ip : '❌ فشل: ' + (r.error || 'unknown')) }
  if (['غير-هوية', 'rotate-tor'].includes(a0)) { const ok = await rotateTorIdentity(); return m.reply(ok ? '🔄 #' + torState.circuitCount : '❌ فشل.') }

  if (['api', 'مزود', 'provider'].includes(a0) && args.length === 1) return m.reply(providerStatus())
  if (['ادوات', 'tools'].includes(a0)) return m.reply(toolsListText())
  if (['ادواتي'].includes(a0)) return m.reply(toolListTools())
  if (['اعدادات', 'settings'].includes(a0)) return m.reply(settingsText())
  if (['مفاتيح', 'keys'].includes(a0)) return m.reply(keysText())
  if (['سجل', 'log'].includes(a0)) return m.reply(actionLogText())
  if (['جلسات'].includes(a0)) return m.reply(sessionsListText())
  if (['معلومات', 'info'].includes(a0)) return m.reply(infoText(bot))
  if (['حقائق', 'facts'].includes(a0)) return m.reply(factsText(sessions.get(k)))
  if (['تشخيص', 'debug'].includes(a0)) {
    const lines = ['.', 'plugins', 'system', 'agent-tools'].map(pp => { try { const abs = safePath(pp); if (!fs.existsSync(abs)) return `❌ ${pp}`; return `📁 ${pp} → ${fs.readdirSync(abs).length}` } catch { return `⚠️ ${pp}` } })
    return m.reply(['🔍 *تشخيص:*', '', `Framework: LIGHT BOT`, `ROOT: \`${ROOT}\``, `plugins: ${getPluginCount(bot)}`, `custom tools: ${customTools.size}`, `sessions: ${sessions.size}`, `models: ${Object.values(modelsCache.providers).reduce((a, b) => a + b.length, 0)}`, '', ...lines].join('\n'))
  }

  if (['ذاكرة'].includes(a0)) return m.reply(toolMemory({ op: 'list' }, sessions.get(k)))
  if (['مسح-الذاكرة'].includes(a0)) { const s = sessions.get(k); if (s) { s.longMemory = []; return m.reply('🧠 تم المسح.') } return m.reply('مفيش جلسة.') }

  if (['ابحث'].includes(a0) && args[1]) return m.reply(await toolResearchPlugin(args.slice(1).join(' '), 'all'))
  if (['افحص'].includes(a0) && args[1]) return m.reply(await toolInspectPlugin(args.slice(1).join(' ')))
  if (['جرب'].includes(a0) && args[1]) return m.reply(await toolTestPlugin(args.slice(1).join(' ')))
  if (['اقترح'].includes(a0) && args[1]) return m.reply(await toolSuggestPlugins(args[1]))
  if (['افحص-البلاجينز'].includes(a0)) return m.reply((await toolAnalyzePlugins('plugins', 0)).slice(0, 3800))
  if (['بحث-ويب'].includes(a0) && args[1]) return m.reply((await toolWebSearch(args.slice(1).join(' '), 8)).slice(0, 3800))
  if (['ويكي'].includes(a0) && args[1]) return m.reply((await toolWikiSearch(args.slice(1).join(' '), 'ar')).slice(0, 3800))

  if (['صحة', 'health'].includes(a0)) {
    const stats = getHealthStats()
    if (!stats.length) return m.reply('✅ كل المزودين أصحاء.')
    return m.reply('🏥 *معطلين:*\n' + stats.map(s => `• ${s.name} — ${s.cooldownLeft}ث`).join('\n'))
  }
  if (['تصفير-الصحة'].includes(a0)) { providerHealth.clear(); return m.reply('♻️') }

  if (['بلا-حدود', 'unlimited'].includes(a0)) {
    // 🔓 "بلا-حدود" معناها "استخدم السقف الأقصى" — مش تعطيل للسقف ولا لمفتاح الأمان.
    setSetting('maxIter', 0); setSetting('maxTools', 0)
    const lim = resolveLimits(getSettings())
    const st2 = getSettings()
    return m.reply('🔓 *بلا-حدود* — السقف الأقصى: *' + lim.maxIter + '* دورة • *' + lim.maxTools + '* أداة (مش بيتعدّى).*\n🛡️ safetyEnabled: ' + (st2.safetyEnabled ? 'شغّال ✅' : 'مقفول ⬜') + ' • موافقة الكتابة: ' + (st2.askBeforeWrite ? '✅' : '⬜') + ' • موافقة الحذف: ' + (st2.askBeforeDelete ? '✅' : '⬜'))
  }
  if (['وضع', 'mode'].includes(a0) && a1) { if (!['silent', 'normal', 'verbose'].includes(a1)) return m.reply('silent/normal/verbose'); setSetting('statusMode', a1); return m.reply('🎛️ ' + a1) }
  if (['توازي'].includes(a0) && args[1]) { const n = Number(args[1]); if (isNaN(n) || n < 1 || n > 20) return m.reply('1-20'); setSetting('maxConcurrentProviders', n); return m.reply('⚡ ' + n) }
  if (['استئناف-تلقائي'].includes(a0) && args[1]) { const v = ['on', 'تشغيل'].includes(a1.toLowerCase()) ? true : ['off', 'ايقاف'].includes(a1.toLowerCase()) ? false : null; if (v === null) return m.reply('on|off'); setSetting('autoResume', v); return m.reply('♻️ ' + (v ? '✅' : '⬜')) }

  if (['مفتاح', 'key'].includes(a0)) {
    const prov = a1
    const valid = ['kilo', 'groq', 'llm7', 'openrouter', 'nvidia', 'pollinations', 'github', 'cerebras', 'airforce']
    if (!valid.includes(prov)) return m.reply('المزودات: ' + valid.join(' / '))
    const key = args.slice(2).join(' ').trim()
    if (!key) return m.reply('اكتب المفتاح.')
    const cfg = getAgentCfg()
    if (prov === 'kilo') { cfg.kiloKey = key; setSetting('kiloKey', key); return m.reply('✅ Kilo') }
    if (prov === 'groq') { cfg.groqKey = key; setSetting('groqKey', key); return m.reply('🔥 Groq') }
    if (prov === 'llm7') { cfg.llm7Key = key; setSetting('llm7Key', key); return m.reply('🟢 LLM7') }
    if (prov === 'openrouter') { cfg.openrouterKey = key; setSetting('openrouterKey', key); return m.reply('🔷 OpenRouter') }
    if (prov === 'nvidia') { cfg.nvidiaKey = key; setSetting('nvidiaKey', key); return m.reply('🎯 NVIDIA') }
    cfg[prov + 'Key'] = key; setSetting(prov + 'Key', key)
    return m.reply('✅ ' + prov)
  }
  if (['مسح-المفتاح'].includes(a0)) {
    const prov = a1; if (!prov) return m.reply('حدد المزود.')
    const cfg = getAgentCfg(); let deleted = false
    if (cfg[prov + 'Key'] !== undefined) { delete cfg[prov + 'Key']; setSetting(prov + 'Key', ''); deleted = true }
    return m.reply(deleted ? '✅ ' + prov : 'مفيش')
  }
  if (['مسح-الكل', 'delall'].includes(a0)) {
    const cfg = getAgentCfg(); const removed = []
    for (const prov of ['kilo', 'groq', 'llm7', 'openrouter', 'github', 'cerebras', 'airforce']) { if (cfg[prov + 'Key'] || getSettings()[prov + 'Key']) { cfg[prov + 'Key'] = ''; setSetting(prov + 'Key', ''); removed.push(prov) } }
    // نسيب NVIDIA زي ما هي
    return m.reply(removed.length ? '🗑️ ' + removed.join(', ') : 'مفيش مفاتيح.')
  }

  if (['مزود', 'provider'].includes(a0) && args[1]) {
    const cfg = getAgentCfg(); const v = a1
    if (['auto', 'تلقائي'].includes(v)) { delete cfg.forced; return m.reply('🔄 تلقائي.') }
    const valid = ['kilo', 'groq', 'llm7', 'nvidia', 'openrouter', 'pollinations', 'gpt-ai']
    if (valid.includes(v)) { cfg.forced = v; return m.reply('🔒 ' + v) }
    return m.reply('القيم: ' + valid.join(' / '))
  }
  if (['تعطيل', 'disable'].includes(a0) && a1) { const st = getSettings(); const list = new Set(Array.isArray(st.disabledProviders) ? st.disabledProviders : []); list.add(a1); setSetting('disabledProviders', [...list]); return m.reply('⛔ ' + a1) }
  if (['تفعيل', 'enable'].includes(a0) && a1) { const st = getSettings(); const list = (Array.isArray(st.disabledProviders) ? st.disabledProviders : []).filter(x => x !== a1); setSetting('disabledProviders', list); return m.reply('✅ ' + a1) }

  const s = getOrCreateSession(m)
  await processUserMessage(s, m, conn, text.trim(), p, bot)
}

// ═══════════════════════════════════════════════════════════════
//  🚀 Startup
// ═══════════════════════════════════════════════════════════════
loadModelsCache()
loadAllCustomTools().catch(e => console.error('[agent-tools init]', e?.message))
loadPersistedSessions()

if (IS_FRESH_START) {
  console.log('[agent] 🆕 Fresh start — انتظار الاتصال…')
  ;(async () => {
    try {
      let n = 0
      while (n < 150) {
        if (global.bot?.sock?.user || global.conn?.user) break
        n++
        await new Promise(r => setTimeout(r, 2000))
      }
      console.log('[agent] ✅ الاتصال تم')
      if (getSettings().autoDiscoverModels) {
        try { await refreshModelsCache(true); console.log('[agent] ✅ الموديلز اتحدثوا') }
        catch (e) { console.error('[agent] models:', e?.message) }
      }
    } catch (e) { console.error('[agent] startup:', e?.message) }
  })()
}

// Refresh كل 6 ساعات — مؤقّت واحد بس (بيتشال مع أي إعادة تحميل للبلاجين)
let modelsRefreshTimer = null
function startModelsRefreshTimer() {
  modelsRefreshTimer = clearAgentTimer(modelsRefreshTimer)
  modelsRefreshTimer = registerAgentTimer(setInterval(() => { refreshModelsCache(true).catch(e => console.error('[agent] refresh:', e?.message)) }, MODELS_CACHE_TTL), 'interval')
}
startModelsRefreshTimer()

// ═══════════════════════════════════════════════════════════════
//  🎯 handler.before
// ═══════════════════════════════════════════════════════════════
handler.before = async function (m, ctx) {
  try {
    const conn = ctx?.conn || global.conn || global.bot?.sock
    const bot = ctx?.bot || global.bot
    if (!m.text || !m.quoted || !conn) return
    const s = sessions.get(skey(m))
    if (!s) return
    if (Date.now() - s.lastActive > SESSION_TTL && !s.busy) { sessions.delete(skey(m)); persistSessions(); return }
    const qid = (m.msg?.contextInfo?.stanzaId) || m.quoted?.id || m.quoted?.key?.id || ''
    if (!qid || !s.agentMsgIds.has(qid)) return
    const t = String(m.text).trim()
    const prefixes = bot?.config?.prefix || ['.', '/', '!']
    const preRe = new RegExp('^[' + prefixes.map(p2 => p2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + ']')
    if (!t || preRe.test(t)) return
    if (s.busy) { try { await m.reply('⏳ الوكيل شغّال…') } catch {}; return true }
    // 🛡️ رد مباشر على طلب الموافقة (من غير prefix) — بيقفل دورة الموافقة في نفس الشات
    const bareWord = String(m.text || '').trim().toLowerCase()
    if (['موافق', 'اوافق', 'رفض', 'reject'].includes(bareWord) && pendingApprovalKind(s)) {
      m._agentHandled = true
      const approvalReply = await handleApprovalReply(s, m, conn, bot, bareWord)
      if (approvalReply) { try { await m.reply(approvalReply) } catch {} }
      return true
    }
    m._agentHandled = true
    const currentPrefix = ctx?.usedPrefix || s.prefix || '.'
    await processUserMessage(s, m, conn, t, currentPrefix, bot)
    return true
  } catch (e) { console.error('[agent before]', e?.message || e) }
}

// ═══════════════════════════════════════════════════════════════
//  🎯 Exports
// ═══════════════════════════════════════════════════════════════
handler.command = ['صانع', 'صنع-بلوقن', 'plugin-agent']
handler.usage = ['صانع <وصف المطلوب>']
handler.category = 'owner'
handler.owner = true
handler.usePrefix = true

// 🧪 سطح اختبار — نفس دوال الحماية المستخدمة جوه البوت
export { safetyCheckToolCode, toolExecutionGateAsync, toolNpm, toolCreateTool, buildToolContext, ActivityStatus, agentTimers, stopAgentTimers, TOOL_ALLOWED_GLOBALS, TOOL_CTX_PROPS, HTTP_TIMEOUT_MS,
  // 🧪 سطح الاختبار: نفس الدوال اللي شغّالة جوه البوت (الموديل بيتحقن في runLoop)
  runLoop, processUserMessage, getOrCreateSession, parseToolCalls, executeTool, resolveLimits,
  approvalKindFor, isSafetyGated, askBudgetLeft, pendingApprovalKind, clearApproval, checkApprovalTimeout,
  requestApproval, resumeApproved, rejectPending, toolObservation, toolErrorObservation, isToolErrorResult,
  handleApprovalReply,
  getSettings, setSetting, persistSessions, loadPersistedSessions, sessions, skey, DEFAULT_SETTINGS,
  SAFETY_HARD_ITER_LIMIT, SAFETY_HARD_TOOL_LIMIT, APPROVAL_TTL_MS, SAFETY_GATED_TOOLS }

export default handler