/**
 * tests/unit.task-9.test.mjs — todo 9: "Make the panel's install and reset-session buttons actually work"
 * =====================================================================================================
 * GAP-16: كان `set-login` و`reset-session` بينادوا global.restartBot() — إعادة تشغيل
 * داخلية: الإس كي موديولز مش بيتحمّلوا من تاني وحالة الذاكرة بتفضل قديمة، فولا
 * أمر منهم بيغيّر أي حاجة فعلًا.
 *
 * بنثبت بالقيم (مش بلوجات):
 *   1) set-login: بيحفظ panel-config.json (loginMode/phone) وبعدها خروج نظيف كامل
 *      (restartBotClean → كود 1) — والعملية الجديدة هي اللي بتقرا الإعدادات.
 *      + حالة الانتظار (pendingRestart) ظاهرة في /api/status و"أعد التشغيل جارٍ"
 *        في رد الـ API بدل الرد الصامت.
 *   2) reset-session: بيوقف البوت وبينقل session/ إلى session.bak-<timestamp>
 *      (rename — مفيش unlink ولا حذف للنسخة) وبعدها نفس الخروج النظيف.
 *   3) reset-session من غير جلسة موجودة: 200 + "لا توجد جلسة لحذفها" + اللوحة
 *      ما بتنهارش ومفيش إعادة تشغيل.
 *   4) عقد المصدر: مسار set-login/reset-session ميرجعش لـ global.restartBot
 *      (الداخلية)، وindex.js بيركّب مسار الخروج النظيف وبيقرا panel-config.json
 *      عند الإقلاع ويطبّق config.printQR.
 *
 * كل الحالات بتشتغل بعملية فرعية صغيرة (webPanel بس — مفيش بوت بيقلع) على منفذ
 * عالي وعن إعدادات في مجلد سكراتش تحت /tmp/opencode. العملية الفرعية بتحقن
 * restartBotClean نفسها (global hook) — فالخروج الفعلي بيحصل هناك بكود 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const WEB_PANEL = path.join(repoRoot, 'system', 'webPanel.js');
const INDEX_JS = path.join(repoRoot, 'index.js');
const panel = await import(pathToFileURL(WEB_PANEL).href);

/* ------------------------------ هارنس العملية الفرعية ------------------------------ */
/* سيناريو واحد لكل عملية: boot webPanel على منفذ عالي + عميل وهمي + مجلد سكراتش.
   restartBotClean محقون هنا بـ process.exit(1) — نفس عقد خطوة السلّم المشتركة. */
const CHILD_SCRIPT = String.raw`
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scenario = process.env.SCENARIO || '';
const out = (k, v) => console.log(k + ' ' + JSON.stringify(v));

async function main() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'task9-'));
  process.env.PANEL_CONFIG_FILE = path.join(scratch, 'panel-config.json');
  process.chdir(scratch); // sessionPathOf() بتقرا cwd — فمجلد الجلسة داخل السكراتش

  const panel = await import(pathToFileURL(path.join(process.env.REPO_ROOT, 'system', 'webPanel.js')).href);

  const sessionDir = path.join(scratch, 'session');
  const credsMarker = JSON.stringify({ registered: true, marker: 'task9-creds' });

  const client = {
    config: { sessionPath: './session' },
    running: false,
    sock: { ws: { readyState: 3 }, user: undefined, ev: { on() {}, removeListener() {} } },
    getAllCommands: () => [],
    errors: () => [],
    stopCalls: 0,
    async stop() { this.stopCalls += 1; this.running = false; },
    async start() { this.running = true; },
  };

  async function waitReady(port) {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/'); return r.status; } catch {}
      await new Promise((res) => setTimeout(res, 100));
    }
    throw new Error('server not ready on ' + port);
  }

  async function login(port) {
    const r = await fetch('http://127.0.0.1:' + port + '/login', {
      method: 'POST',
      redirect: 'manual', // فمش بنتاب الـ 302 — محتاجين كوكي الرد الأول
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: process.env.WEB_PASSWORD }),
    });
    const sc = r.headers.get('set-cookie') || '';
    const m = /pw=([^;]+)/.exec(sc);
    return { status: r.status, cookie: m ? 'pw=' + m[1] : '' };
  }

  const port = 39500 + (process.pid % 5000);
  const server = panel.startWebPanel(client, { port, host: '127.0.0.1' });
  await waitReady(port);
  const { cookie } = await login(port);
  if (!cookie) throw new Error('login did not set a pw cookie');

  async function postAction(action, extra = {}) {
    const r = await fetch('http://127.0.0.1:' + port + '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ action, ...extra }),
    });
    let body = null;
    try { body = await r.json(); } catch {}
    return { status: r.status, body };
  }

  if (scenario === 'set-login') {
    // جلسة قديمة موجودة — لازم تفضل محفوظة بعد أمر التنصيب
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'creds.json'), credsMarker);

    globalThis.restartBotClean = async (reason) => {
      out('CLEANEXIT', { reason });
      process.exit(1);
    };

    const act = await postAction('set-login', { loginMode: 'qr', phone: '201234567890' });
    // فورًا: حالة الانتظار لازم تبان في الستاتس (بدل الرد الصامت)
    const st = await fetch('http://127.0.0.1:' + port + '/api/status', { headers: { cookie }, redirect: 'manual' });
    const statusBody = await st.json();
    out('RESULT', {
      action: act,
      pendingRestart: statusBody.pendingRestart || null,
      configFile: process.env.PANEL_CONFIG_FILE,
      sessionDir,
    });
    // الخروج بيجي من مؤقّت المسار النظيف — مفيش حاجة تانية لازم نعملها
    setTimeout(() => { out('ERROR', { message: 'no clean restart happened' }); process.exit(33); }, 9000);
    return;
  }

  if (scenario === 'reset-session') {
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'creds.json'), credsMarker);
    fs.writeFileSync(path.join(sessionDir, 'extra-file.txt'), 'keep me');

    globalThis.restartBotClean = async (reason) => {
      out('CLEANEXIT', { reason });
      out('STOPCALLS', { n: client.stopCalls });
      process.exit(1);
    };

    const act = await postAction('reset-session');
    out('RESULT', { action: act, sessionDir, scratch });
    setTimeout(() => { out('ERROR', { message: 'no clean restart happened' }); process.exit(33); }, 9000);
    return;
  }

  if (scenario === 'reset-session-missing') {
    // مفيش جلسة — 200 برسالة عربية واضحة، مفيش ريستارت، واللوحة بتفضل شغالة
    const act = await postAction('reset-session');
    const page = await fetch('http://127.0.0.1:' + port + '/', { redirect: 'manual' });
    out('RESULT', { action: act, pageStatus: page.status });
    server.close();
    process.exit(0);
  }

  out('ERROR', { message: 'unknown scenario ' + scenario });
  process.exit(2);
}

main().catch((e) => {
  out('ERROR', { message: String(e && e.message ? e.message : e) });
  process.exit(2);
});
`;

function runChild(scenario, timeoutMs = 25000) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', CHILD_SCRIPT], {
    encoding: 'utf8',
    timeout: timeoutMs,
    cwd: repoRoot,
    env: {
      ...process.env,
      TMPDIR: '/tmp/opencode',
      REPO_ROOT: repoRoot,
      SCENARIO: scenario,
      WEB_PASSWORD: 'task9-panel-pass',
      // ما نسمحش بأي شيء آخر يقلع
      AUTO_UPDATE: '0',
      HEALER: '0',
      WATCHDOG: '0',
    },
  });
}

function parseChild(res) {
  const lines = String(res.stdout || '').split('\n');
  const pick = (prefix) => {
    const line = lines.find((l) => l.startsWith(prefix + ' '));
    return line ? JSON.parse(line.slice(prefix.length + 1)) : null;
  };
  return { cleanexit: pick('CLEANEXIT'), result: pick('RESULT'), error: pick('ERROR'), stopCalls: pick('STOPCALLS') };
}

function listBackups(sessionDir, scratch) {
  const parent = scratch;
  return fs.readdirSync(parent).filter((n) => n.startsWith('session.bak-'));
}

/* ------------------------------------------------------------------ *
 * 1. set-login: حفظ + خروج نظيف بكود 1 + حالة انتظار ظاهرة
 * ------------------------------------------------------------------ */

test('set-login: saves panel-config.json, shows the pending state, and exits the process with code 1', () => {
  const res = runChild('set-login');
  const { cleanexit, result, error } = parseChild(res);
  assert.equal(error, null, 'child harness error: ' + JSON.stringify(error));
  assert.equal(res.status, 1, `expected exit code 1 (clean restart), got ${res.status}; stdout=${res.stdout} stderr=${res.stderr}`);
  assert.ok(cleanexit, 'the clean full-restart path was never invoked');
  assert.ok(String(cleanexit.reason).length > 0, 'the clean restart carries a reason');

  assert.ok(result, 'missing RESULT line');
  assert.equal(result.action.status, 200, 'set-login must answer 200');
  assert.equal(result.action.body.ok, true);
  assert.match(result.action.body.message, /أعد التشغيل جارٍ/, 'the panel must report the pending restart, not a silent no-op');
  assert.equal(result.action.body.pendingRestart, true, 'the response must mark the pending restart');
  assert.ok(result.pendingRestart && String(result.pendingRestart.reason).length > 0, '/api/status must expose the pending restart state');

  // الإعداد الجديد محفوظ فعليًا في panel-config.json (الإقلاع الجديد بيقراه)
  const cfg = JSON.parse(fs.readFileSync(result.configFile, 'utf8'));
  assert.equal(cfg.loginMode, 'qr', 'the chosen login mode must be persisted');
  assert.equal(cfg.phone, '201234567890', 'the chosen phone must be persisted');

  // الجلسة القديمة ما اتلمستش خالص في مسار التنصيب
  assert.ok(fs.existsSync(path.join(result.sessionDir, 'creds.json')), 'the previous session must be preserved by set-login');
});

/* ------------------------------------------------------------------ *
 * 2. reset-session: rename إلى session.bak-<ts> (بدون unlink) + خروج نظيف
 * ------------------------------------------------------------------ */

test('reset-session: moves session/ to session.bak-<ts> (nothing deleted), stops the client, exits with code 1', () => {
  const res = runChild('reset-session');
  const { cleanexit, result, error, stopCalls } = parseChild(res);
  assert.equal(error, null, 'child harness error: ' + JSON.stringify(error));
  assert.equal(res.status, 1, `expected exit code 1 (clean restart), got ${res.status}; stdout=${res.stdout} stderr=${res.stderr}`);
  assert.ok(cleanexit, 'the clean full-restart path was never invoked');

  assert.ok(result, 'missing RESULT line');
  assert.equal(result.action.status, 200, 'reset-session must answer 200');
  assert.equal(result.action.body.ok, true);
  assert.match(result.action.body.message, /أعد التشغيل جارٍ/, 'the panel must report the pending restart');

  // session/ ما عداش موجود، والنسخة الاحتياطية session.bak-<ts> موجودة بمحتواها
  assert.equal(fs.existsSync(result.sessionDir), false, 'session/ must be moved aside (not running for the next boot)');
  const backups = listBackups(result.sessionDir, result.scratch);
  assert.equal(backups.length, 1, `exactly one session.bak-<ts> backup expected, got ${JSON.stringify(backups)}`);
  const bakDir = path.join(result.scratch, backups[0]);
  assert.ok(backups[0].startsWith('session.bak-'), 'backup name must be session.bak-<timestamp>');
  const creds = fs.readFileSync(path.join(bakDir, 'creds.json'), 'utf8');
  assert.match(creds, /task9-creds/, 'the backup copy must be preserved (never deleted)');
  assert.equal(fs.readFileSync(path.join(bakDir, 'extra-file.txt'), 'utf8'), 'keep me', 'every session file survives the move');

  // البوت اتوقف قبل نقل الجلسة
  assert.equal(stopCalls?.n ?? 0, 1, 'reset-session must stop the bot before moving the session');
});

/* ------------------------------------------------------------------ *
 * 3. reset-session من غير جلسة: 200 + رسالة عربية + مفيش ريستارت/كراش
 * ------------------------------------------------------------------ */

test('reset-session with no session: answers 200 "لا توجد جلسة لحذفها", does not restart and does not crash', () => {
  const res = runChild('reset-session-missing');
  const { result, error } = parseChild(res);
  assert.equal(error, null, 'child harness error: ' + JSON.stringify(error));
  assert.equal(res.status, 0, `the panel must survive the missing-session case, got exit ${res.status}`);
  assert.ok(result, 'missing RESULT line');
  assert.equal(result.action.status, 200, 'must answer 200 even when there is nothing to delete');
  assert.match(String(result.action.body?.message || ''), /لا توجد جلسة لحذفها/, 'the Arabic no-session message is required');
  assert.equal(result.pageStatus, 200, 'the panel must still serve pages after the action');
});

/* ------------------------------------------------------------------ *
 * 4. مسار الخروج النظيف نفسه (حقن مباشر — مفيش عملية فرعية)
 * ------------------------------------------------------------------ */

test('clean restart plumbing: setCleanRestart injects the path; without a path it never falls back to the in-process restart', async () => {
  const calls = [];
  panel.setCleanRestart(async (reason) => { calls.push(reason); });
  const ok = await panel.requestCleanRestart('فحص المسار');
  assert.equal(ok, true, 'the injected clean-restart path must be used');
  assert.deepEqual(calls, ['فحص المسار']);

  // من غير مسار مثبّت: مفيش global.restartBot (إعادة داخلية) ولا خروج صامت —
  // بنرجع false ونسيب حدث عربي في اللوحة.
  panel.setCleanRestart(null);
  const withoutPath = await panel.requestCleanRestart('فحص بدون مسار');
  assert.equal(withoutPath, false, 'must report failure instead of silently doing an in-process restart');
  assert.deepEqual(calls, ['فحص المسار'], 'no in-process restart fallback may run');
  panel.setCleanRestart(null);
});

/* ------------------------------------------------------------------ *
 * 5. عقد المصدر: مفيش global.restartBot جوّه set-login/reset-session،
 *    وindex.js بيركّب مسار الخروج النظيف ويقرا panel-config.json عند الإقلاع
 * ------------------------------------------------------------------ */

function actionCaseSlice(src, name) {
  const start = src.indexOf(`case '${name}'`);
  if (start === -1) return '';
  const rest = src.slice(start + `case '${name}'`.length);
  const next = rest.search(/case '|default:/);
  return next === -1 ? rest : rest.slice(0, next);
}

test('source contract: set-login and reset-session never route through the in-process restartBot', () => {
  const src = fs.readFileSync(WEB_PANEL, 'utf8');
  for (const name of ['set-login', 'reset-session']) {
    const slice = actionCaseSlice(src, name);
    assert.ok(slice.includes('requestCleanRestart'), `${name} must request the clean full restart`);
    assert.doesNotMatch(slice, /global\.restartBot\(/,
      `${name} must NOT call the in-process global.restartBot (it cannot reload ES modules)`);
  }
});

test('source contract: index.js wires the clean exit and re-reads panel-config.json at boot', () => {
  const src = fs.readFileSync(INDEX_JS, 'utf8');
  assert.match(src, /global\.restartBotClean\s*=/, 'index.js must install global.restartBotClean');
  assert.match(src, /setCleanRestart\(/, 'index.js must inject the clean-restart path into the panel');
  // خطوة السلّم: fatal = تفريغ الداتابيز + كود 1 (المصدر: system/restart-ladder.js)
  assert.match(src, /restartController\.fatal\(reason\)/, 'the clean path must go through the shared ladder fatal step (exit code 1)');
  assert.match(src, /readPanelConfig\(\)/, 'boot must re-read panel-config.json');
  assert.match(src, /config\.printQR = panelCfg\.loginMode === 'qr'/, 'the next boot must apply the chosen login mode to config.printQR');
  assert.match(src, /if \(panelCfg\.phone\) config\.phoneNumber = panelCfg\.phone/, 'the next boot must apply the chosen phone');
});
