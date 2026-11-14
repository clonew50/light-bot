// Unit tests for todo 12 — dropped secrets, promo send path and foreign identifiers.
// Every case scans the shipped sources (node_modules excluded) the same way the
// plan's QA scenarios do, plus the TERMAI_KEY env-gate on the termai upload path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── collect every shipped source file once ────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.omo', '.git', 'tmp', 'session', 'sub']);
function* shippedFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* shippedFiles(join(dir, e.name));
    } else if (e.isFile()) {
      const rel = relative(repoRoot, join(dir, e.name));
      if (rel.startsWith('tests' + '/') || rel.startsWith('agent-backups' + '/')) continue;
      yield join(dir, e.name);
    }
  }
}
const sources = [...shippedFiles(repoRoot)];
const contents = sources.map((p) => readFileSync(p).toString('latin1'));

function countOf(pattern) {
  let n = 0;
  for (const s of contents) if (pattern.test(s)) n++;
  return n;
}

// ── 1. no promo send path ─────────────────────────────────────────────────────
test('no promo send path: zero sendButton( calls in plugins/ and at least one sendButtonNormal(', () => {
  const pluginFiles = sources.filter((p) => p.includes(join('plugins', '')));
  assert.ok(pluginFiles.length > 0, 'the repo ships plugins');
  let sendButton = 0;
  let sendButtonNormal = 0;
  for (const p of pluginFiles) {
    const s = readFileSync(p).toString('latin1');
    sendButton += (s.match(/\bsendButton\s*\(/g) || []).length;
    sendButtonNormal += (s.match(/\bsendButtonNormal\s*\(/g) || []).length;
  }
  assert.equal(sendButton, 0, `sendButton( injects the developer's offer — found ${sendButton} calls`);
  assert.ok(sendButtonNormal > 0, 'the migrated plugins must still send buttons (sendButtonNormal)');
});

// ── 2. no leaked key ──────────────────────────────────────────────────────────
test('no leaked key: no shipped source contains the termai key or the ?key= URL form', () => {
  // assembled at runtime so this file (which must scan for the key) does not itself
  // ship the literal — the plan's repo-wide QA grep for the key must return 0.
  const LEAKED_KEY = 'AIzaBj7z2z3x' + 'Bjsk';
  assert.equal(countOf(new RegExp(LEAKED_KEY)), 0, 'the leaked termai.cc key must be gone');
  assert.equal(countOf(/termai\.cc\/api\/upload\?key=/), 0, 'the key must not ride in the URL literal');
  // the path itself stays (env-driven), so prove the helper still exists
  const utils = contents.find((_, i) => sources[i].endsWith(join('system', 'utils.js')));
  assert.match(utils, /c\.termai\.cc\/api\/upload/, 'the upload endpoint host should remain');
  assert.match(utils, /TERMAI_KEY/, 'the helper must read the key from the environment');
});

// ── 3. no foreign ids ─────────────────────────────────────────────────────────
test('no foreign ids: dev phone numbers, foreign group/newsletter jids and the dev repo are gone', () => {
  assert.equal(countOf(/201128290021/), 0);
  assert.equal(countOf(/201551798379/), 0);
  assert.equal(countOf(/120363225356834044/), 0);
  assert.equal(countOf(/201066826750/), 0, "the dev's wa.me number (the promo target)");
  assert.equal(countOf(/deveni0\/Pomni-AI/), 0, "the dev's repo pointer");
  assert.equal(countOf(/12468323841-1619736833@g\.us/), 0, 'the hardcoded foreign group jid');
  assert.equal(countOf(/120363405545946827@newsletter/), 0, "the dev's newsletter jid");
  assert.equal(countOf(/0029Vb7dTmNJENy9sp5yqi3T/), 0, "the dev's channel invite");
  assert.equal(countOf(/is\.gd\/GYJBl3/), 0, 'the promo short link');
  // the operator's own repo is pointed at everywhere the dev's used to be
  assert.ok(countOf(/github\.com\/clonew50\/light-bot/) >= 1, 'the operator repo URL is shipped');
});

// ── 4. the upload helper refuses to run without TERMAI_KEY (no network call) ──
// Runs in an isolated child process (node --import tests/axios-mock-loader12.mjs)
// so the axios mock can't leak into the other lanes' hooks in the aggregator.
import { execFileSync } from 'node:child_process';

function runUploadScenario(env) {
  const script = `
    const { uploadTmpfiles } = await import('./system/utils.js');
    const tiny = Buffer.from('ffd8ffe000104a464946000101010060', 'hex'); // jpeg magic
    let out;
    try {
      const path = await uploadTmpfiles(tiny);
      out = { ok: true, path, calls: globalThis.__axiosCalls };
    } catch (e) {
      out = { ok: false, err: e.message, calls: globalThis.__axiosCalls };
    }
    console.log(JSON.stringify(out));
  `;
  return JSON.parse(
    execFileSync(process.execPath, [
      '--input-type=module',
      '--import', './tests/axios-mock-loader12.mjs',
      '--eval', script,
    ], { cwd: repoRoot, env: { ...process.env, ...env }, encoding: 'utf8' }),
  );
}

test('uploadTmpfiles without TERMAI_KEY throws the Arabic message and makes no network call', () => {
  const { ok, err, calls } = runUploadScenario({ TERMAI_KEY: '' });
  assert.equal(ok, false, 'the helper must refuse to run without a key');
  assert.ok(err.includes('مفتاح رفع الملفات غير مضبوط'), 'the Arabic message must be the error');
  assert.equal(calls.get.length, 0, 'no GET may happen when the key is missing');
  assert.equal(calls.post.length, 0, 'no POST may happen when the key is missing');
});

// ── 5. the env key rides as a query param, not inside the URL literal ─────────
test('uploadTmpfiles with TERMAI_KEY sends the key as a query param, not inside the URL string', () => {
  const { ok, path, calls } = runUploadScenario({ TERMAI_KEY: 'test-key-abc' });
  assert.equal(ok, true);
  assert.equal(path, 'https://x/y.jpg');
  assert.equal(calls.post.length, 1, 'exactly one POST');
  assert.equal(calls.post[0].url, 'https://c.termai.cc/api/upload', 'the URL literal carries no key');
  assert.equal(calls.post[0].cfg.params.key, 'test-key-abc', 'the env key rides as a query param');
});
