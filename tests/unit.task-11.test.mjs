/**
 * tests/unit.task-11.test.mjs — todo 11: "Panel credential hygiene"
 * =====================================================================================================
 * نثبت بالسلوك (مش بالكلام):
 *   1) مفيش كلمة سر تُطبع في stdout — بس التلميح المقنّع + مسار panel-config.json،
 *      و/api/status ما بيفضحش الكلمة ولا السر.
 *   2) panel-config.json بصلاحية 0600: ملف جديد وملف قديم أوسع من كده الاتنين بيصلحوا.
 *   3) cookie revocation: عدّاد rev جوّه الكوكي — خروج من كل الأجهزة أو تغيير
 *      كلمة السر بيرفع rev، وأي كوكي اتصدر قبل كده بيرفض (حتى لو توقيعه سليم)،
 *      وكوكي جديد بعد التغيير بيتقبل.
 *   4) SameSite=Strict + HttpOnly دايمًا، وSecure لما الطلب جه على TLS
 *      (X-Forwarded-Proto: https).
 *   5) proxy-aware rate limit: الحد على أول hop من X-Forwarded-For لما يوجد،
 *      وإلا req.socket.remoteAddress — عميلين بـ XFF مختلفين بيتحسبوا منفصلين.
 *
 * كل الحالات بعملية فرعية صغيرة (webPanel بس على منفذ عالي وعن إعدادات في
 * سكراتش تحت /tmp/opencode) — مفيش بوت بيقلع أبدًا.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const WEB_PANEL = path.join(repoRoot, 'system', 'webPanel.js');

const PASSWORD_ONE = 'task11-pass-one';
const PASSWORD_TWO = 'task11-pass-two';
const SECRET = crypto.randomBytes(32).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ------------------------------ هارنس العملية الفرعية ------------------------------ */
const CHILD_SCRIPT = String.raw`
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scenario = process.env.SCENARIO || '';
const out = (k, v) => console.log(k + ' ' + JSON.stringify(v));

async function main() {
  const scratch = process.env.CHILD_SCRATCH
    ? process.env.CHILD_SCRATCH
    : fs.mkdtempSync(path.join('/tmp/opencode', 'task11-'));
  const configFile = path.join(scratch, 'panel-config.json');
  process.env.PANEL_CONFIG_FILE = configFile;
  process.chdir(scratch); // sessionPathOf() بتقرا cwd — كله جوّه السكراتش

  const passwordOne = process.env.PASSWORD_ONE;
  const passwordTwo = process.env.PASSWORD_TWO;
  const secret = process.env.SECRET;
  const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const crypto = await import('node:crypto');

  // إعدادات مبدئية لكل سيناريو (قبل استيراد الموديول)
  if (scenario === 'existing-mode' || scenario === 'cookie-flags' || scenario === 'logout-rev' || scenario === 'proxy-limit') {
    fs.writeFileSync(configFile, JSON.stringify({
      password: passwordOne, loginMode: 'code', phone: '', secret, rev: 0, pwHash: sha256(passwordOne),
    }));
    fs.chmodSync(configFile, 0o644); // ملف قديم بصلاحية أوسع — لازم يصلح لـ 0600
  }
  if (scenario === 'password-change-capture') {
    fs.writeFileSync(configFile, JSON.stringify({
      password: passwordOne, loginMode: 'code', phone: '', secret, rev: 0, pwHash: sha256(passwordOne),
    }));
  }
  // 'stdout-mode': مفيش ملف أصلًا — الكلمة بتتولّد تلقائيًا
  // (سيناريو password-change بيستخدم CHILD_SCRATCH المكتوب من الأب).

  const panel = await import(pathToFileURL(path.join(process.env.REPO_ROOT, 'system', 'webPanel.js')).href);

  const client = {
    config: { sessionPath: './session' },
    sock: { ws: { readyState: 3 }, user: undefined, ev: { on() {}, removeListener() {} } },
    getAllCommands: () => [],
    errors: () => [],
    async stop() {}, async start() {},
  };

  const port = 39600 + (process.pid % 4000);
  const server = panel.startWebPanel(client, { port, host: '127.0.0.1' });

  async function waitReady() {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/'); return r.status; } catch {}
      await new Promise((res) => setTimeout(res, 100));
    }
    throw new Error('server not ready on ' + port);
  }

  // login بيرجّع {status, setCookie} — setCookie هو قيمة هيدر Set-Cookie كامل
  async function login(password, headers = {}) {
    const r = await fetch('http://127.0.0.1:' + port + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ password: password || '' }),
    });
    return { status: r.status, setCookie: r.headers.get('set-cookie') || '' };
  }
  async function get(pathname, cookie, headers = {}) {
    const r = await fetch('http://127.0.0.1:' + port + pathname, {
      redirect: 'manual', headers: { cookie: cookie ? 'pw=' + cookie : '', ...headers },
    });
    let body = null;
    try { body = await r.json(); } catch {}
    return { status: r.status, body };
  }
  const pwOf = (sc) => { const m = /pw=([^;]+)/.exec(sc || ''); return m ? m[1] : ''; };

  await waitReady();

  if (scenario === 'stdout-mode') {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    // الكلمة المولّدة بنكتبها في ملف في السكراتش (مش في stdout!) عشان
    // الأب يتحقق إن stdout ما فيهاش الكلمة.
    fs.writeFileSync(path.join(scratch, 'password.txt'), cfg.password);
    const loginRes = await login(cfg.password);
    const cookie = pwOf(loginRes.setCookie);
    const status = await get('/api/status', cookie);
    const statusStr = JSON.stringify(status.body || {});
    out('RESULT', {
      scratch,
      loginStatus: loginRes.status,
      hasCookie: !!cookie,
      statusHasPassword: statusStr.includes(cfg.password),
      statusHasSecret: statusStr.includes(cfg.secret),
    });
    server.close();
    process.exit(0);
  }

  if (scenario === 'existing-mode') {
    const mode = (fs.statSync(configFile).mode & 0o777).toString(8);
    const loginRes = await login(passwordOne);
    out('RESULT', { scratch, modeAfterBoot: mode, loginStatus: loginRes.status, hasCookie: !!pwOf(loginRes.setCookie) });
    server.close();
    process.exit(0);
  }

  if (scenario === 'cookie-flags') {
    const httpsRes = await login(passwordOne, { 'x-forwarded-proto': 'https' });
    const plainRes = await login(passwordOne);
    out('RESULT', { httpsCookie: httpsRes.setCookie, plainCookie: plainRes.setCookie, status: httpsRes.status });
    server.close();
    process.exit(0);
  }

  if (scenario === 'logout-rev') {
    const first = await login(passwordOne);
    const cookieA = pwOf(first.setCookie);
    const beforeLogout = await get('/api/status', cookieA);
    // خروج من كل الأجهزة — بيرفع rev
    const lo = await fetch('http://127.0.0.1:' + port + '/api/action', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'pw=' + cookieA },
      body: JSON.stringify({ action: 'logout' }),
    });
    const loBody = await lo.json();
    const afterLogout = await get('/api/status', cookieA);
    const afterLogoutPage = await get('/', cookieA);
    const second = await login(passwordOne);
    const cookieB = pwOf(second.setCookie);
    const afterRelogin = await get('/api/status', cookieB);
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    out('RESULT', {
      scratch,
      beforeLogout: beforeLogout.status,
      logoutOk: loBody.ok, logoutMsg: loBody.message,
      afterLogout: afterLogout.status, afterLogoutPage: afterLogoutPage.status,
      reloginStatus: second.status,
      afterRelogin: afterRelogin.status,
      rev: cfg.rev,
    });
    server.close();
    process.exit(0);
  }

  if (scenario === 'password-change-capture') {
    const first = await login(passwordOne);
    const cookieA = pwOf(first.setCookie);
    if (!cookieA) throw new Error('no cookie captured');
    // بنكتب الكوكي في ملف (مش في stdout) عشان فحص "مفيش تسريب" يفضل نضيف
    fs.writeFileSync(path.join(scratch, 'cookieA.txt'), cookieA);
    out('RESULT', { scratch, captureStatus: first.status });    server.close();
    process.exit(0);
  }

  if (scenario === 'password-change') {
    // الكوكي القديم اتصدر قبل تغيير الكلمة (boot سابق بـ rev=0).
    // boot ده: الملف على القرص فيه كلمة جديدة مع pwHash قديم → الموديول
    // لازم يكتشف التغيير ويرفع rev قبل ما يوقّع أي كوكي جديد.
    const oldCookie = process.env.PREV_COOKIE || '';
    const oldStatus = await get('/api/status', oldCookie);
    const second = await login(passwordTwo);
    const cookieB = pwOf(second.setCookie);
    const newStatus = await get('/api/status', cookieB);
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    out('RESULT', {
      scratch,
      oldCookieStatus: oldStatus.status,
      reloginStatus: second.status,
      newCookieStatus: newStatus.status,
      rev: cfg.rev,
    });
    server.close();
    process.exit(0);
  }

  if (scenario === 'proxy-limit') {
    // 8 محاولات فاشلة من IP (أول hop في XFF) → الحد بيتقفل على العميل ده
    let last = null;
    for (let i = 0; i < 8; i++) {
      last = await login('wrong-' + i, { 'x-forwarded-for': '203.0.113.10' });
    }
    const blockedSame = await login('wrong-x', { 'x-forwarded-for': '203.0.113.10' });
    // عميل مختلف (XFF مختلف) → مش متأثر بحد العميل الأول
    const otherClient = await login('wrong-y', { 'x-forwarded-for': '203.0.113.11' });
    // نفس النداء من غير XFF → direct (remoteAddress) → عميل تالت مختلف
    const directClient = await login('wrong-z');
    // والعميل التاني يقدر يدخل صح في نفس اللحظة
    const otherOk = await login(passwordOne, { 'x-forwarded-for': '203.0.113.11' });
    out('RESULT', {
      lastFailStatus: last.status,
      blockedSameStatus: blockedSame.status,
      otherClientStatus: otherClient.status,
      directClientStatus: directClient.status,
      otherOkStatus: otherOk.status,
      otherOkHasCookie: !!pwOf(otherOk.setCookie),
    });
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

function runChild(scenario, extraEnv = {}, timeoutMs = 25000) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', CHILD_SCRIPT], {
    encoding: 'utf8',
    timeout: timeoutMs,
    cwd: repoRoot,
    env: {
      ...process.env,
      TMPDIR: '/tmp/opencode',
      REPO_ROOT: repoRoot,
      SCENARIO: scenario,
      PASSWORD_ONE: PASSWORD_ONE,
      PASSWORD_TWO: PASSWORD_TWO,
      SECRET: SECRET,
      ...extraEnv,
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
  return { result: pick('RESULT'), error: pick('ERROR') };
}

function expectCleanChild(res, parsed) {
  assert.equal(parsed.error, null, 'child harness error: ' + JSON.stringify(parsed.error) + ' stderr=' + res.stderr);
  assert.equal(res.status, 0, 'child exited ' + res.status + ' stderr=' + res.stderr);
}

/* ------------------------------------------------------------------ *
 * 1. مفيش كلمة سر في stdout — تلميح مقنّع + مسار الملف فقط
 * ------------------------------------------------------------------ */
test('no password on stdout: only the masked hint and the config path are printed; /api/status leaks nothing', () => {
  const res = runChild('stdout-mode');
  const parsed = parseChild(res);
  expectCleanChild(res, parsed);
  const { result } = parsed;

  // الكلمة المولّدة متحفظة في ملف السكراتش — مش في stdout العملية
  const password = fs.readFileSync(path.join(result.scratch, 'password.txt'), 'utf8');
  assert.ok(password && password.length >= 16, 'a strong password was generated');
  assert.equal(res.stdout.includes(password), false, 'the generated password must never appear in stdout');

  // التلميح المطلوب موجود في stdout مع مسار الملف
  assert.match(res.stdout, /كلمة السر محفوظة في/, 'the masked Arabic hint must be printed');
  assert.match(res.stdout, /panel-config\.json/, 'the config file path must be printed');

  // مفيش تسريب في /api/status
  assert.equal(result.loginStatus, 302, 'the login round-trip must keep working (302 + cookie)');
  assert.equal(result.hasCookie, true, 'login must still set a pw cookie');
  assert.equal(result.statusHasPassword, false, '/api/status must not contain the password');
  assert.equal(result.statusHasSecret, false, '/api/status must not contain the cookie secret');

  // الملف المولّد 0600
  const mode = fs.statSync(path.join(result.scratch, 'panel-config.json')).mode & 0o777;
  assert.equal(mode, 0o600, 'a freshly generated panel-config.json must be mode 600, got ' + mode.toString(8));
});

/* ------------------------------------------------------------------ *
 * 2. ملف قديم بصلاحية أوسع بيتصلح لـ 0600 عند الإقلاع
 * ------------------------------------------------------------------ */
test('panel-config.json is 0600: a pre-existing file with a wider mode is tightened at boot', () => {
  const res = runChild('existing-mode');
  const { result } = parseChild(res);
  expectCleanChild(res, parseChild(res));
  assert.equal(result.modeAfterBoot, '600', 'the pre-existing config must be chmod-ed to 600 at boot, got ' + result.modeAfterBoot);
  assert.equal(result.loginStatus, 302, 'the login round-trip must keep working (302 + cookie)');
  assert.equal(result.hasCookie, true, 'login must still set a pw cookie');
});

/* ------------------------------------------------------------------ *
 * 3. أعلام الكوكي: Secure على TLS، HttpOnly وSameSite=Strict دايمًا
 * ------------------------------------------------------------------ */
test('cookie flags: Secure with X-Forwarded-Proto https, HttpOnly and SameSite=Strict always', () => {
  const res = runChild('cookie-flags');
  const { result } = parseChild(res);
  expectCleanChild(res, parseChild(res));
  assert.equal(result.status, 302, 'login must answer 302 with the Set-Cookie header');
  assert.match(result.httpsCookie, /HttpOnly/, 'HttpOnly is always set');
  assert.match(result.httpsCookie, /SameSite=Strict/, 'SameSite must be Strict (was Lax)');
  assert.match(result.httpsCookie, /Secure/, 'Secure must be set when the request arrives over TLS');
  assert.match(result.plainCookie, /HttpOnly/, 'HttpOnly is always set');
  assert.match(result.plainCookie, /SameSite=Strict/, 'SameSite must be Strict (was Lax)');
  assert.equal(/Secure/.test(result.plainCookie), false, 'Secure must NOT be set on a plain-HTTP request');
});

/* ------------------------------------------------------------------ *
 * 4. cookie revocation: خروج من كل الأجهزة بيرفع rev والكوكي القديم بيرفض
 * ------------------------------------------------------------------ */
test('cookie revocation: logout-everywhere bumps rev, the pre-logout cookie is rejected, a fresh login is accepted', () => {
  const res = runChild('logout-rev');
  const { result } = parseChild(res);
  expectCleanChild(res, parseChild(res));
  assert.equal(result.beforeLogout, 200, 'the cookie works before logout');
  assert.equal(result.logoutOk, true, 'logout must answer ok');
  assert.match(String(result.logoutMsg || ''), /الجلسات/, 'logout reports revoking all sessions');
  assert.equal(result.afterLogout, 401, 'the pre-logout cookie must be rejected right after logout');
  assert.equal(result.afterLogoutPage, 200, 'a request with the revoked cookie gets the login page (never panel content)');
  assert.equal(result.reloginStatus, 302, 'the login round-trip must keep working after logout');
  assert.equal(result.afterRelogin, 200, 'a cookie signed after the rev bump must be accepted');
  assert.equal(result.rev >= 1, true, 'the rev counter must have been bumped and persisted');
});

/* ------------------------------------------------------------------ *
 * 5. cookie revocation عبر تغيير كلمة السر (إقلاع جديد بعد تعديل الكلمة)
 * ------------------------------------------------------------------ */
test('cookie revocation across a password change: a cookie signed before the change is rejected afterwards; a cookie signed after it is accepted', () => {
  // boot 1: كلمة السر الأولى — بنلم الكوكي
  const cap = runChild('password-change-capture');
  const capParsed = parseChild(cap);
  expectCleanChild(cap, capParsed);
  const cookieA = fs.readFileSync(path.join(capParsed.result.scratch, 'cookieA.txt'), 'utf8');
  assert.ok(cookieA, 'a cookie signed before the password change was captured');

  // boot 2: نفس السر + نفس rev في الملف، بس الكلمة اتغيّرت (pwHash قديم على القرص)
  // → الموديول لازم يكتشف التغيير عند الإقلاع ويرفع rev.
  const configFile = path.join(capParsed.result.scratch, 'panel-config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    password: PASSWORD_TWO, loginMode: 'code', phone: '', secret: SECRET, rev: 0, pwHash: sha256(PASSWORD_ONE),
  }));

  const res = runChild('password-change', { PREV_COOKIE: cookieA, CHILD_SCRATCH: capParsed.result.scratch });
  const { result } = parseChild(res);
  expectCleanChild(res, parseChild(res));
  assert.equal(result.rev >= 1, true, 'the rev counter must be bumped when the password changes, got ' + result.rev);
  assert.equal(result.oldCookieStatus, 401, 'a cookie signed before the password change must be rejected afterwards');
  assert.equal(result.reloginStatus, 302, 'logging in with the new password must work');
  assert.equal(result.newCookieStatus, 200, 'a cookie signed after the password change must be accepted');
});

/* ------------------------------------------------------------------ *
 * 6. proxy-aware rate limit: XFF مختلفين = عميلين مختلفين
 * ------------------------------------------------------------------ */
test('proxy rate limit: two requests with different X-Forwarded-For values count as different clients', () => {
  const res = runChild('proxy-limit');
  const { result } = parseChild(res);
  expectCleanChild(res, parseChild(res));
  assert.equal(result.lastFailStatus, 401, 'failed logins answer 401 while under the limit');
  assert.equal(result.blockedSameStatus, 429, 'the client over the limit (first XFF hop) gets 429');
  assert.equal(result.otherClientStatus, 401, 'a different X-Forwarded-For client must NOT be blocked by the first client');
  assert.equal(result.directClientStatus, 401, 'a direct client (no XFF) must NOT be blocked either');
  assert.equal(result.otherOkStatus, 302, 'the second client must still be able to log in');
  assert.equal(result.otherOkHasCookie, true, 'the second client gets a cookie');
});

/* ------------------------------------------------------------------ *
 * 7. عقد المصدر: مفيش كلمة سر في أي رد API، والكوكي فيه rev
 * ------------------------------------------------------------------ */
test('source contract: makeCookie embeds the rev counter, the cookie never exposes the password, no plaintext print sites', () => {
  const src = fs.readFileSync(WEB_PANEL, 'utf8');
  // الكوكي فيه rev
  assert.match(src, /payload = `\$\{exp\}\.\$\{Number\(panelCfg\.rev\) \|\| 0\}`/, 'the cookie payload must embed the rev counter');
  assert.match(src, /Number\(revStr\) !== \(Number\(panelCfg\.rev\) \|\| 0\)/, 'verifyCookie must reject an old rev');
  // مفيش طباعة كلمة سر: مفيش سطر بيطبع panelCfg.password
  assert.doesNotMatch(src, /console\.(log|error|warn)\([^)]*panelCfg\.password/, 'the password must never be printed');
  assert.match(src, /كلمة السر محفوظة في/, 'the masked hint line must exist');
  // SameSite=Strict (Lax القديمة راحت)
  assert.doesNotMatch(src, /SameSite=Lax/, 'SameSite=Lax must be gone');
  assert.match(src, /SameSite=Strict/, 'SameSite=Strict must be used');
  assert.match(src, /x-forwarded-proto/, 'the TLS detection via X-Forwarded-Proto must exist');
  // الحد على أول hop من XFF
  assert.match(src, /x-forwarded-for/, 'the X-Forwarded-For keying must exist');
});
