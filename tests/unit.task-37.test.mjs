// Todo 37 — the owner-agent safety switches are real and the agent loop is bounded.
// Cases live here so `node --test tests/unit.test.mjs` (the lane aggregator) runs them.
//
// The behavioural cases drive the plugin's own runLoop inside a child process (the module
// starts timers and touches the filesystem on import, so it must not be imported into the
// test runner itself). The model is injected: no network, no bot boot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const AGENT = join(ROOT, 'plugins', 'owner', 'agent.js')
const src = readFileSync(AGENT, 'utf8')

const PROBE = `
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const out = { scenarios: {} }
const push = (name, obj) => { out.scenarios[name] = obj }

const run = async () => {
  // ── the probe must never touch the repository's real session store ──
  const origWrite = fs.writeFileSync.bind(fs)
  let persistedRaw = null
  fs.writeFileSync = function (p, ...rest) {
    if (String(p).endsWith('agent-sessions.json')) { persistedRaw = String(rest[0]); return }
    return origWrite(p, ...rest)
  }
  const origRead = fs.readFileSync.bind(fs)
  fs.readFileSync = function (p, ...rest) {
    if (String(p).endsWith('agent-sessions.json')) return persistedRaw || '{}'
    return origRead(p, ...rest)
  }

  global.__agentSessions = new Map()
  global.__agentActions = []
  global.__agentCustomTools = new Map()
  global.db = { data: { agent: { settings: {} } } }

  const mod = await import(pathToFileURL(process.env.T37_AGENT).href)
  const sent = []
  const mkConn = () => ({ sendMessage: async (chat, body, o) => { const text = body && typeof body === 'object' ? (body.text || body.conversation || '') : String(body || ''); sent.push({ chat, text: String(text), edit: !!(o && o.edit) }); const key = { id: 'k' + sent.length }; sent[sent.length - 1].key = key.id; return { key } } })
  const mkM = (tag) => ({ chat: 'task37-' + tag, sender: 'owner-' + tag, reply: async (t) => { sent.push({ chat: 'task37-' + tag, text: String(t), edit: false }) }, react: async () => {} })
  const mkModel = (replies) => { const calls = []; const model = async (messages) => { calls.push(messages.map(x => ({ role: x.role, content: String(x.content) }))); const i = Math.min(calls.length - 1, replies.length - 1); const r = replies[i]; return typeof r === 'function' ? r(calls.length) : r }; model.calls = calls; return model }
  const mkStatus = async (conn, m) => { const st = new mod.ActivityStatus(conn, m.chat, m); await st.init(); return st }
  const setSt = (o) => { global.db.data.agent.settings = Object.assign({}, mod.DEFAULT_SETTINGS, o) }
  const target = (tag) => { const rel = '.task37-probe-' + process.pid + '-' + tag + '.txt'; return { rel, abs: path.join(ROOT, rel) } }
  const writeCall = (rel, content) => '<tool>{\\"name\\":\\"write_file\\",\\"args\\":{\\"path\\":\\"' + rel + '\\",\\"content\\":\\"' + content + '\\"}}<\\/tool>'
  const finishCall = (summary) => '<tool>{\\"name\\":\\"finish\\",\\"args\\":{\\"summary\\":\\"' + summary + '\\"}}<\\/tool>'

  // ── 1. the defaults must stay exactly as they are today ──
  push('defaults', {
    askBeforeWrite: mod.DEFAULT_SETTINGS.askBeforeWrite,
    askBeforeDelete: mod.DEFAULT_SETTINGS.askBeforeDelete,
    safetyEnabled: mod.DEFAULT_SETTINGS.safetyEnabled,
    maxAskPerSession: mod.DEFAULT_SETTINGS.maxAskPerSession,
    hardIter: mod.SAFETY_HARD_ITER_LIMIT,
    hardTools: mod.SAFETY_HARD_TOOL_LIMIT,
    finiteIter: Number.isFinite(mod.SAFETY_HARD_ITER_LIMIT),
    finiteTools: Number.isFinite(mod.SAFETY_HARD_TOOL_LIMIT),
    gated: [...mod.SAFETY_GATED_TOOLS].sort()
  })

  // ── 2. askBeforeWrite: the write waits for موافق, then happens exactly once ──
  try {
    const t = target('approve')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('approve')
    const model = mkModel([writeCall(t.rel, 'APPROVED-37'), finishCall('خلصت')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    await st.flush()
    const afterSuspend = {
      exists: fs.existsSync(t.abs),
      pendingTool: s.pendingWrite ? s.pendingWrite.tool : null,
      pendingPath: s.pendingWrite ? s.pendingWrite.args.path : null,
      modelCalls: model.calls.length,
      askSent: sent.some(x => !x.edit && /موافقة مطلوبة/.test(x.text)),
      askTracked: (() => { const ask = sent.find(x => !x.edit && /موافقة مطلوبة/.test(x.text)); return !!(ask && ask.key && s.agentMsgIds && s.agentMsgIds.has(ask.key)) })()
    }
    const resumed = await mod.resumeApproved(s, m, conn, st, {})
    const contentAfterApprove = fs.existsSync(t.abs) ? fs.readFileSync(t.abs, 'utf8') : null
    await mod.runLoop(s, m, conn, st, {}, { model })
    await st.flush(); await st.stop()
    push('approve', {
      afterSuspend,
      resumedOk: resumed.ok,
      resumedTool: resumed.tool,
      contentAfterApprove,
      modelCalls: model.calls.length,
      finished: sent.some(x => /خلصت/.test(x.text)),
      approvalCleared: !s.pendingWrite && !s.pendingDelete
    })
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('approve', { error: String((e && e.message) || e) }) }

  // ── 3. رفض aborts the write: nothing is written, the agent is told ──
  try {
    const t = target('reject')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('reject')
    const model = mkModel([writeCall(t.rel, 'REJECTED-37'), finishCall('تمام')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const existedAtAsk = fs.existsSync(t.abs)
    const rej = mod.rejectPending(s)
    push('reject', {
      existedAtAsk,
      existedAfterReject: fs.existsSync(t.abs),
      ok: rej.ok,
      rejected: !!rej.rejected,
      message: rej.message,
      approvalCleared: !s.pendingWrite && !s.pendingDelete,
      historyHasRejection: s.messages.some(x => /APPROVAL \\[rejected\\]/.test(String(x.content))),
      modelCalls: model.calls.length
    })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('reject', { error: String((e && e.message) || e) }) }

  // ── 3b. askBeforeDelete: the delete waits for موافق too ──
  try {
    const t = target('delete')
    fs.writeFileSync(t.abs, 'DELETE-ME-37', 'utf8')
    setSt({ askBeforeDelete: true })
    const conn = mkConn(); const m = mkM('delete')
    const model = mkModel(['<tool>{\"name\":\"delete_file\",\"args\":{\"path\":\"' + t.rel + '\"}}<\/tool>', finishCall('خلصت')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const existsAtAsk = fs.existsSync(t.abs)
    const pendingKind = s.pendingDelete ? 'delete' : (s.pendingWrite ? 'write' : null)
    const resumed = await mod.resumeApproved(s, m, conn, st, {})
    push('delete', {
      existsAtAsk,
      pendingKind,
      resumedOk: resumed.ok,
      existsAfterApprove: fs.existsSync(t.abs),
      modelCalls: model.calls.length,
      approvalCleared: !s.pendingWrite && !s.pendingDelete
    })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('delete', { error: String((e && e.message) || e) }) }

  // ── 4. an approval older than the TTL never executes ──
  try {
    const t = target('timeout')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('timeout')
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    s.awaitingApproval = { kind: 'write', tool: 'write_file', args: { path: t.rel, content: 'OLD-37' }, at: Date.now() - (mod.APPROVAL_TTL_MS + 5000) }
    s.pendingWrite = { tool: 'write_file', args: { path: t.rel, content: 'OLD-37' } }
    const r = await mod.resumeApproved(s, m, conn, st, {})
    push('timeout', { ok: r.ok, expired: !!r.expired, message: r.message, exists: fs.existsSync(t.abs), cleared: !s.pendingWrite })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('timeout', { error: String((e && e.message) || e) }) }

  // ── 4b. a bare "موافق"/"رفض" in the chat resolves the same pending approval ──
  try {
    const t = target('bare-ok')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('bare-ok')
    const model = mkModel([writeCall(t.rel, 'BARE-OK-37'), finishCall('خلصت')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const outOk = await mod.handleApprovalReply(s, m, conn, {}, 'موافق', { model: mkModel(['تمام، نفّذت الكتابة']) })
    const okState = { out: outOk, exists: fs.existsSync(t.abs), pending: mod.pendingApprovalKind(s), saidDone: sent.some(x => !x.edit && /نفّذت الكتابة/.test(x.text)) }
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)

    const t2 = target('bare-no')
    const conn2 = mkConn(); const m2 = mkM('bare-no')
    const model2 = mkModel([writeCall(t2.rel, 'BARE-NO-37')])
    const s2 = mod.getOrCreateSession(m2)
    const st2 = await mkStatus(conn2, m2)
    await mod.runLoop(s2, m2, conn2, st2, {}, { model: model2 })
    const outNo = await mod.handleApprovalReply(s2, m2, conn2, {}, 'رفض')
    push('bare', {
      okOut: okState.out,
      okExists: okState.exists,
      okPending: okState.pending,
      okSaidDone: okState.saidDone,
      noOut: outNo,
      noExists: fs.existsSync(t2.abs),
      noPending: mod.pendingApprovalKind(s2)
    })
    await st2.stop()
    if (fs.existsSync(t2.abs)) fs.unlinkSync(t2.abs)
  } catch (e) { push('bare', { error: String((e && e.message) || e) }) }

  // ── 4c. "توقف" while an approval is pending cancels it (the ask promises this) ──
  try {
    const t = target('stop')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('stop')
    const model = mkModel([writeCall(t.rel, 'STOP-37')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const pendingBefore = mod.pendingApprovalKind(s)
    await mod.default(m, { conn, bot: {}, args: ['توقف'], text: '.صانع توقف', usedPrefix: '.' })
    const replyText = sent.filter(x => !x.edit && x.chat === m.chat).map(x => x.text).slice(-1)[0] || ''
    push('stop', {
      pendingBefore,
      pendingAfter: mod.pendingApprovalKind(s),
      exists: fs.existsSync(t.abs),
      reply: replyText.slice(0, 160),
      saidCancelled: /إلغاء موافقة/.test(replyText),
      modelCalls: model.calls.length
    })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('stop', { error: String((e && e.stack) || e) }) }

  // ── 5. a pending approval does not survive a restart ──
  try {
    const t = target('restart')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('restart')
    const model = mkModel([writeCall(t.rel, 'RESTART-37'), finishCall('تمام')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const pendingBefore = !!s.pendingWrite
    mod.persistSessions(true)
    const raw = persistedRaw || ''
    mod.sessions.clear()
    mod.loadPersistedSessions()
    const s2 = mod.sessions.get('task37-restart|owner-restart')
    push('restart', {
      pendingBefore,
      rawHasPendingWrite: /pendingWrite/.test(raw),
      restoredSession: !!s2,
      restoredPending: s2 ? !!s2.pendingWrite : null,
      restoredKind: s2 ? mod.pendingApprovalKind(s2) : 'no-session',
      exists: fs.existsSync(t.abs)
    })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('restart', { error: String((e && e.message) || e) }) }

  // ── 6. a new task mid-run cancels the pending write (cancel/resume) ──
  try {
    const t = target('cancel')
    setSt({ askBeforeWrite: true })
    const conn = mkConn(); const m = mkM('cancel')
    const model1 = mkModel([writeCall(t.rel, 'CANCEL-37')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model: model1 })
    const pendingBefore = !!s.pendingWrite
    const model2 = mkModel(['تمام، فهمت المهمة الجديدة'])
    await mod.processUserMessage(s, m, conn, 'مهمة جديدة خالص', '.', {}, { model: model2 })
    push('cancel', {
      pendingBefore,
      exists: fs.existsSync(t.abs),
      pendingAfter: mod.pendingApprovalKind(s),
      historyHasCancelled: s.messages.some(x => /APPROVAL \\[cancelled\\]/.test(String(x.content))),
      secondTaskAnswered: sent.some(x => /تمام، فهمت المهمة الجديدة/.test(x.text))
    })
    await st.stop()
    if (fs.existsSync(t.abs)) fs.unlinkSync(t.abs)
  } catch (e) { push('cancel', { error: String((e && e.message) || e) }) }

  // ── 7. maxAskPerSession: after the cap the tool is denied without asking ──
  try {
    const a = target('cap-a'); const b = target('cap-b')
    setSt({ askBeforeWrite: true, maxAskPerSession: 1 })
    const conn = mkConn(); const m = mkM('askcap')
    const model = mkModel([writeCall(a.rel, 'A-37'), writeCall(b.rel, 'B-37'), finishCall('خلصت')])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    const firstAsk = { pending: s.pendingWrite ? s.pendingWrite.args.path : null, askCount: s.askCount }
    const rej = mod.rejectPending(s)
    await mod.runLoop(s, m, conn, st, {}, { model })
    await st.flush(); await st.stop()
    push('askcap', {
      firstAsk,
      rejected: !!rej.rejected,
      askCount: s.askCount,
      deniedByCap: s.messages.some(x => /سقف الموافقات/.test(String(x.content))),
      existsA: fs.existsSync(a.abs),
      existsB: fs.existsSync(b.abs),
      pendingAfter: mod.pendingApprovalKind(s),
      modelCalls: model.calls.length
    })
    for (const f of [a.abs, b.abs]) if (fs.existsSync(f)) fs.unlinkSync(f)
  } catch (e) { push('askcap', { error: String((e && e.message) || e) }) }

  // ── 8. the "unlimited" setting stops at the hard ceiling and says so ──
  try {
    setSt({ maxIter: 0, maxTools: 0 })
    const conn = mkConn(); const m = mkM('ceiling')
    const model = mkModel(['<tool>{\\"name\\":\\"list_files\\",\\"args\\":{\\"dir\\":\\"plugins\\"}}<\\/tool>'])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    const t0 = Date.now()
    await mod.runLoop(s, m, conn, st, {}, { model })
    const elapsedMs = Date.now() - t0
    await st.flush(); await st.stop()
    const last = sent.filter(x => !x.edit && /سقف الأمان/.test(x.text)).map(x => x.text).slice(-1)[0] || ''
    push('ceiling', {
      modelCalls: model.calls.length,
      hard: mod.SAFETY_HARD_ITER_LIMIT,
      atHard: model.calls.length === mod.SAFETY_HARD_ITER_LIMIT,
      reported: /سقف الأمان/.test(last),
      lastLine: String(last).slice(0, 160),
      elapsedMs,
      hardTools: mod.SAFETY_HARD_TOOL_LIMIT,
      resolved: mod.resolveLimits({ maxIter: 0, maxTools: 0 }),
      resolvedAbove: mod.resolveLimits({ maxIter: 1e9, maxTools: 1e9 }),
      resolvedLower: mod.resolveLimits({ maxIter: 3, maxTools: 2 })
    })
  } catch (e) { push('ceiling', { error: String((e && e.message) || e) }) }

  // ── 9. the safety switch really gates the tool set ──
  try {
    setSt({ safetyEnabled: true })
    const conn = mkConn(); const m = mkM('gate')
    const model = mkModel(['<tool>{\\"name\\":\\"create_tool\\",\\"args\\":{\\"name\\":\\"evil\\",\\"description\\":\\"x\\",\\"code\\":\\"export default async function(){return 1}\\"}}<\\/tool>', 'خلصت'])
    const s = mod.getOrCreateSession(m)
    const st = await mkStatus(conn, m)
    await mod.runLoop(s, m, conn, st, {}, { model })
    await st.flush(); await st.stop()
    push('gate', {
      gatedHit: s.messages.some(x => /safetyEnabled/.test(String(x.content))),
      executeBlocked: String(await mod.executeTool({ tool: 'npm_install', args: { package: 'left-pad' } }, {})).slice(0, 60),
      modelCalls: model.calls.length
    })
  } catch (e) { push('gate', { error: String((e && e.message) || e) }) }

  // cleanup: no probe artefact may be left behind
  try { for (const f of fs.readdirSync(ROOT)) if (/^\\.task37-probe-/.test(f)) fs.unlinkSync(path.join(ROOT, f)) } catch {}
  try { const bdir = path.join(ROOT, 'agent-backups'); for (const f of fs.readdirSync(bdir)) if (f.includes('task37-probe-')) fs.unlinkSync(path.join(bdir, f)) } catch {}
}

try { await run() } catch (e) { out.fatal = String((e && e.stack) || e) }
process.stdout.write('__T37__' + JSON.stringify(out) + '\\n')
process.exit(0)
`

function probe() {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', PROBE], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, T37_AGENT: AGENT },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const line = out.split('\n').find((l) => l.startsWith('__T37__'))
  assert.ok(line, 'probe did not return a result (stdout: ' + out.slice(0, 400) + ')')
  return JSON.parse(line.slice('__T37__'.length))
}

const res = probe()
const S = res.scenarios || {}

test('row 37 approval gate: the safety switches keep today’s defaults (nothing silently enabled)', () => {
  assert.equal(S.defaults.finiteIter, true, 'SAFETY_HARD_ITER_LIMIT must be finite')
  assert.equal(S.defaults.finiteTools, true, 'SAFETY_HARD_TOOL_LIMIT must be finite')
  assert.equal(S.defaults.askBeforeWrite, false, 'askBeforeWrite must stay false by default')
  assert.equal(S.defaults.askBeforeDelete, false, 'askBeforeDelete must stay false by default')
  assert.equal(S.defaults.safetyEnabled, false, 'safetyEnabled must stay false by default')
  assert.equal(S.defaults.maxAskPerSession, 0, 'maxAskPerSession must stay 0 by default')
  assert.deepEqual(S.defaults.gated, ['create_tool', 'delete_tool', 'npm_install'], 'safetyEnabled gates exactly the system tools')
})

test('row 37 approval gate: askBeforeWrite suspends the run and executes the write only after موافق', () => {
  assert.equal(S.approve.error, undefined, 'scenario threw: ' + S.approve.error)
  assert.equal(S.approve.afterSuspend.exists, false, 'the file was written BEFORE the approval')
  assert.equal(S.approve.afterSuspend.pendingTool, 'write_file', 'the pending call was not parked on the session')
  assert.ok(/^\.task37-probe-\d+-approve\.txt$/.test(S.approve.afterSuspend.pendingPath), 'the pending path is wrong: ' + S.approve.afterSuspend.pendingPath)
  assert.equal(S.approve.afterSuspend.askSent, true, 'no Arabic approval question was sent to the chat')
  assert.equal(S.approve.afterSuspend.askTracked, true, 'the approval message is not quotable (its id is not tracked as an agent message)')
  assert.equal(S.approve.afterSuspend.modelCalls, 1, 'the run must suspend instead of looping on')
  assert.equal(S.approve.resumedOk, true, 'resumeApproved refused a granted approval')
  assert.equal(S.approve.contentAfterApprove, 'APPROVED-37', 'the real file content after موافق is wrong')
  assert.equal(S.approve.modelCalls, 2, 'the loop did not continue after the approved tool')
  assert.equal(S.approve.finished, true, 'the run did not end with the finish answer')
  assert.equal(S.approve.approvalCleared, true, 'the approval was left pending after execution')
})

test('row 37 approval gate: رفض aborts the write and nothing is written', () => {
  assert.equal(S.reject.error, undefined, 'scenario threw: ' + S.reject.error)
  assert.equal(S.reject.existedAtAsk, false, 'the file existed before the owner answered')
  assert.equal(S.reject.existedAfterReject, false, 'رفض still executed the write')
  assert.equal(S.reject.rejected, true, 'rejectPending did not report a rejection')
  assert.match(S.reject.message, /رفض/, 'the refusal message is not Arabic/clear: ' + S.reject.message)
  assert.equal(S.reject.approvalCleared, true, 'the rejected call stayed pending')
  assert.equal(S.reject.historyHasRejection, true, 'the rejection was not recorded for the model')
})

test('row 37 approval gate: askBeforeDelete suspends the delete until موافق', () => {
  assert.equal(S.delete.error, undefined, 'scenario threw: ' + S.delete.error)
  assert.equal(S.delete.existsAtAsk, true, 'the probe file was deleted BEFORE the approval')
  assert.equal(S.delete.pendingKind, 'delete', 'the pending call was not parked as a delete')
  assert.equal(S.delete.resumedOk, true, 'resumeApproved refused a granted delete')
  assert.equal(S.delete.existsAfterApprove, false, 'the delete never happened after موافق')
  assert.equal(S.delete.modelCalls, 1, 'the run did not suspend while the delete was pending')
  assert.equal(S.delete.approvalCleared, true, 'the approval was left pending after the delete')
})

test('row 37 approval gate: an approval that times out never executes', () => {
  assert.equal(S.timeout.error, undefined, 'scenario threw: ' + S.timeout.error)
  assert.equal(S.timeout.ok, false, 'an expired approval was executed')
  assert.equal(S.timeout.expired, true, 'the timeout was not reported as a timeout')
  assert.match(S.timeout.message, /مهلة الموافقة/, 'the timeout message is not the Arabic one: ' + S.timeout.message)
  assert.equal(S.timeout.exists, false, 'the write happened after the approval TTL')
  assert.equal(S.timeout.cleared, true, 'the pending call was not cleared on timeout')
})

test('row 37 approval gate: a bare موافق / رفض in the chat resolves the pending approval', () => {
  assert.equal(S.bare.error, undefined, 'scenario threw: ' + S.bare.error)
  assert.equal(S.bare.okOut, null, 'the bare موافق answered instead of running the tool: ' + S.bare.okOut)
  assert.equal(S.bare.okExists, true, 'the bare موافق did not execute the write')
  assert.equal(S.bare.okPending, null, 'the approval stayed pending after موافق')
  assert.equal(S.bare.okSaidDone, true, 'the resumed run never answered after the approved write')
  assert.match(S.bare.noOut, /رفض/, 'the bare رفض did not answer with the Arabic refusal: ' + S.bare.noOut)
  assert.equal(S.bare.noExists, false, 'the bare رفض executed the write')
  assert.equal(S.bare.noPending, null, 'the approval stayed pending after رفض')
})

test('row 37 approval gate: توقف while an approval is pending cancels it', () => {
  assert.equal(S.stop.error, undefined, 'scenario threw: ' + S.stop.error)
  assert.equal(S.stop.pendingBefore, 'write', 'the scenario never produced a pending write')
  assert.equal(S.stop.pendingAfter, null, 'توقف left the approval pending')
  assert.equal(S.stop.exists, false, 'the interrupted write was executed anyway')
  assert.equal(S.stop.saidCancelled, true, 'the stop reply is not the Arabic cancellation: ' + S.stop.reply)
})

test('row 37 approval gate: a pending approval does not survive a restart', () => {
  assert.equal(S.restart.error, undefined, 'scenario threw: ' + S.restart.error)
  assert.equal(S.restart.pendingBefore, true, 'the scenario never produced a pending write')
  assert.equal(S.restart.rawHasPendingWrite, false, 'the pending call was persisted to disk')
  assert.equal(S.restart.restoredSession, true, 'the session itself was not restored')
  assert.equal(S.restart.restoredPending, false, 'the approval came back after the restart')
  assert.equal(S.restart.restoredKind, null, 'the restored session still has a pending kind')
  assert.equal(S.restart.exists, false, 'the write happened across the restart')
})

test('row 37 approval gate: a new task mid-run cancels the pending write (cancel/resume)', () => {
  assert.equal(S.cancel.error, undefined, 'scenario threw: ' + S.cancel.error)
  assert.equal(S.cancel.pendingBefore, true, 'the scenario never produced a pending write')
  assert.equal(S.cancel.exists, false, 'the interrupted write was executed anyway')
  assert.equal(S.cancel.pendingAfter, null, 'the pending call survived the new task')
  assert.equal(S.cancel.historyHasCancelled, true, 'the cancellation was not recorded for the model')
  assert.equal(S.cancel.secondTaskAnswered, true, 'the new task was not answered')
})

test('row 37 approval gate: maxAskPerSession caps the asks and then denies the tool', () => {
  assert.equal(S.askcap.error, undefined, 'scenario threw: ' + S.askcap.error)
  assert.equal(S.askcap.firstAsk.askCount, 1, 'the first ask was not counted')
  assert.equal(S.askcap.rejected, true, 'the first ask could not be rejected')
  assert.equal(S.askcap.deniedByCap, true, 'the second write was not denied by the ask cap')
  assert.equal(S.askcap.existsA, false, 'file A was written without approval')
  assert.equal(S.askcap.existsB, false, 'file B was written after the ask cap')
  assert.equal(S.askcap.pendingAfter, null, 'a denied call stayed pending')
})

test('row 37 iteration ceiling: the unlimited setting stops at the hard ceiling and reports it', () => {
  assert.equal(S.ceiling.error, undefined, 'scenario threw: ' + S.ceiling.error)
  assert.equal(S.ceiling.atHard, true, 'the run did not stop at the hard ceiling: ' + S.ceiling.modelCalls + '/' + S.ceiling.hard)
  assert.equal(S.ceiling.modelCalls, S.ceiling.hard, 'the loop ran more iterations than the ceiling')
  assert.equal(S.ceiling.reported, true, 'the ceiling abort message is missing (last: ' + S.ceiling.lastLine + ')')
  assert.ok(S.ceiling.elapsedMs < 120000, 'the bounded run took too long: ' + S.ceiling.elapsedMs + 'ms')
  assert.deepEqual(S.ceiling.resolved, { maxIter: S.ceiling.hard, maxTools: S.ceiling.hardTools, iterCapped: false, toolsCapped: false }, '0/0 must resolve to the hard ceiling')
  assert.equal(S.ceiling.resolvedAbove.maxIter, S.ceiling.hard, 'a configured value above the ceiling was not clamped')
  assert.equal(S.ceiling.resolvedAbove.maxTools, S.ceiling.hardTools, 'a configured tool value above the ceiling was not clamped')
  assert.deepEqual(
    { i: S.ceiling.resolvedLower.maxIter, t: S.ceiling.resolvedLower.maxTools },
    { i: 3, t: 2 },
    'a configured value below the ceiling must be honoured'
  )
})

test('row 37 approval gate: safetyEnabled actually gates the tool set', () => {
  assert.equal(S.gate.error, undefined, 'scenario threw: ' + S.gate.error)
  assert.equal(S.gate.gatedHit, true, 'create_tool was not refused while safetyEnabled is on')
  assert.match(S.gate.executeBlocked, /مقفولة/, 'executeTool did not refuse the gated tool: ' + S.gate.executeBlocked)
})

test('row 37 iteration ceiling: Infinity is gone from the iteration and tool ceilings (source scan)', () => {
  assert.ok(!/SAFETY_HARD_ITER_LIMIT\s*=\s*Infinity/.test(src), 'SAFETY_HARD_ITER_LIMIT is still Infinity')
  assert.ok(!/SAFETY_HARD_TOOL_LIMIT\s*=\s*Infinity/.test(src), 'SAFETY_HARD_TOOL_LIMIT is still Infinity')
  assert.ok(!/maxTools\s*=\s*[^;\n]*Infinity/.test(src), 'maxTools still falls back to Infinity')
  assert.ok(!/maxTools\s*===\s*Infinity/.test(src), 'the loop still branches on maxTools === Infinity')
  assert.match(src, /const limits = resolveLimits\(st\)/, 'the loop does not resolve its limits through resolveLimits')
  assert.match(src, /while \(iter < maxIter\)/, 'the loop is not bounded by the resolved ceiling')
  // the ONLY Infinity left in the file is the sandbox global allowlist (a JS global name, not a ceiling)
  const infinityLines = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /Infinity/.test(l))
  assert.equal(infinityLines.length, 1, 'Infinity is still used somewhere: ' + JSON.stringify(infinityLines))
  assert.ok(/'Infinity', 'NaN', 'undefined'/.test(infinityLines[0][1]), 'the remaining Infinity is not the sandbox global allowlist: line ' + infinityLines[0][0])
  // the switches are read, not just declared
  for (const key of ['askBeforeWrite', 'askBeforeDelete', 'safetyEnabled', 'maxAskPerSession']) {
    const reads = [...src.matchAll(new RegExp(key, 'g'))].length
    assert.ok(reads >= 2, key + ' is declared but never read (' + reads + ' occurrence)')
  }
})

test('row 37 approval gate: no probe artefact is left in the worktree', () => {
  const leftovers = readdirSync(ROOT).filter((f) => /^\.task37-probe-/.test(f))
  assert.deepEqual(leftovers, [], 'probe files left behind: ' + leftovers.join(', '))
  let backups = []
  try { backups = readdirSync(join(ROOT, 'agent-backups')).filter((f) => f.includes('task37-probe-')) } catch {}
  assert.deepEqual(backups, [], 'probe backups left behind: ' + backups.join(', '))
})