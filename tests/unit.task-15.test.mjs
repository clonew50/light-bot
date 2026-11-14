// Unit tests for todo 15 — pin the framework dependency and make installs reproducible.
// Offline: reads package.json, the committed package-lock.json and the installed
// meowsab dist, and exercises the index.js shield block in a vm (never boots the bot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const PIN_RE = /^https:\/\/github\.com\/deveni0\/(ws|sharp-tmx)\/archive\/[0-9a-f]{40}\.tar\.gz$/;

// ── 1. package.json pins both deps to immutable commit tarballs ───────────────
test('package.json pins meowsab and sharp to immutable archive/<sha>.tar.gz', () => {
  assert.match(pkg.dependencies.meowsab, PIN_RE, 'meowsab must be an archive/<sha>.tar.gz pin');
  assert.match(pkg.dependencies.sharp, PIN_RE, 'sharp must be an archive/<sha>.tar.gz pin');
  // the exact SHAs resolved from the GitHub API for this pin
  assert.equal(pkg.dependencies.meowsab, 'https://github.com/deveni0/ws/archive/446bc68b8a0bade128bfbea224e33dc552ebc10b.tar.gz');
  assert.equal(pkg.dependencies.sharp, 'https://github.com/deveni0/sharp-tmx/archive/67f11b2c6176c50cd9beb821f10c7fd50dc8459e.tar.gz');
});

// ── 2. overrides stay consistent with the pinned sharp ────────────────────────
test('overrides force the same pinned sharp everywhere', () => {
  assert.equal(pkg.overrides.sharp, pkg.dependencies.sharp, 'overrides.sharp must equal the pinned sharp');
  assert.equal(pkg.overrides['*'].sharp, pkg.dependencies.sharp, 'overrides["*"].sharp must equal the pinned sharp');
});

// ── 3. package-lock.json exists, is valid, and pins the same URLs ─────────────
test('package-lock.json exists, is valid, and pins the same tarball URLs', () => {
  const lockPath = join(repoRoot, 'package-lock.json');
  assert.ok(existsSync(lockPath), 'package-lock.json must be committed');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.ok(lock.lockfileVersion, 'lockfileVersion must be present');
  const root = lock.packages[''];
  assert.equal(root.dependencies.meowsab, pkg.dependencies.meowsab, 'lock root meowsab must match package.json');
  assert.equal(root.dependencies.sharp, pkg.dependencies.sharp, 'lock root sharp must match package.json');
  const mk = lock.packages['node_modules/meowsab'];
  const sk = lock.packages['node_modules/sharp'];
  assert.ok(mk && mk.resolved === pkg.dependencies.meowsab, 'meowsab must resolve to the pinned tarball');
  assert.ok(mk.integrity, 'meowsab must carry an integrity hash');
  assert.ok(sk && sk.resolved === pkg.dependencies.sharp, 'sharp must resolve to the pinned tarball');
  // a lockfile built while node_modules was a symlink would contain link: entries — reject that
  const links = Object.values(lock.packages).filter((p) => p.link);
  assert.equal(links.length, 0, 'the committed lockfile must not contain symlink link: entries');
});

// ── 4. the pinned meowsab dist still carries the shield strings ───────────────
// The runtime shield (index.js) stubs Utils.keyCore1/keyCore2/keysMessagesObjWA from
// the installed meowsab; the installed copy is the pinned SHA (verified against the
// archive tarball). Assert the strings the shield's watermark/ban checks rely on exist.
test('the pinned meowsab dist still exposes the shield stubs and watermark strings', () => {
  const dist = readFileSync(join(repoRoot, 'node_modules', 'meowsab', 'dist', 'index.cjs'), 'latin1');
  for (const s of ['KeysMessageWA', 'keyCore1', 'keyCore2', 'keysMessagesObjWA']) {
    assert.ok(dist.includes(s), `the pinned dist must still contain ${s} (the shield relies on it)`);
  }
  // the clean button path used by the migrated plugins
  assert.ok(dist.includes('sendButtonNormal'), 'the pinned dist must still expose sendButtonNormal');
  // the framework surface the bot imports
  for (const s of ['Client', 'Utils', 'Convert', 'Scrapy', 'SubBots']) {
    assert.ok(dist.includes(s), `the pinned dist must still expose ${s}`);
  }
});

// ── shield block extraction + vm harness ──────────────────────────────────────
function extractShieldBlock() {
  const src = readFileSync(join(repoRoot, 'index.js'), 'utf8');
  const start = src.indexOf('const BOT_SHIELD');
  assert.ok(start >= 0, 'index.js must contain the BOT_SHIELD knob');
  const ifIdx = src.indexOf('if (BOT_SHIELD)', start);
  const braceStart = src.indexOf('{', ifIdx);
  let depth = 0, end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  assert.ok(end > braceStart, 'could not find the end of the shield block');
  return { src, block: src.slice(start, end) };
}

function runShield(block, { botShield = '1', utilsThrows = false } = {}) {
  const events = [];
  const realEvalCalls = [];
  const realEval = (c) => { realEvalCalls.push(c); return 'REAL:' + c; };
  const sandbox = {
    process: { env: { BOT_SHIELD: botShield } },
    console: { log() {}, error() {} },
    pushRuntimeEvent: (kind, msg) => events.push({ kind, msg }),
    Utils: utilsThrows ? new Proxy({}, { set() { throw new Error('Utils is frozen'); } }) : {},
    realEval,
    eval: realEval,
  };
  vm.runInNewContext(block, sandbox, { filename: 'shield-block.js' });
  return { sandbox, events, realEvalCalls };
}

// ── 5. shield is armed: eval guard blocks the kill-switch, failed install events ─
test('shield is armed: guarded eval blocks process.exit(0) and a failed install raises an event', () => {
  const { block } = extractShieldBlock();

  // armed: the framework's third kill-switch decodes to exactly "process.exit(0)"
  const armed = runShield(block, { botShield: '1' });
  const kill = armed.sandbox.eval('process.exit(0)');
  assert.equal(kill, undefined, 'the guarded eval must NOT execute the process.exit(0) payload');
  assert.equal(armed.realEvalCalls.includes('process.exit(0)'), false, 'the kill-switch payload must never reach realEval');
  // a benign payload still evaluates normally
  assert.equal(armed.sandbox.eval('40+2'), 'REAL:40+2', 'benign code must still evaluate');
  // a fresh shield install announces itself
  assert.ok(armed.events.some((e) => e.kind === 'shield'), 'an armed shield pushes a shield event');

  // failed install: a frozen Utils makes the stub assignment throw -> caught + event, not swallowed
  const failed = runShield(block, { botShield: '1', utilsThrows: true });
  assert.ok(failed.events.some((e) => e.kind === 'shield'), 'a failed shield install must raise a shield event (not be swallowed)');
});

// ── 6. BOT_SHIELD=0 disables the shield (the knob still works) ────────────────
test('BOT_SHIELD=0 disables the shield: no event and eval is not guarded', () => {
  const { block } = extractShieldBlock();
  const off = runShield(block, { botShield: '0' });
  assert.equal(off.events.length, 0, 'with BOT_SHIELD=0 the shield block must not run');
  // eval is untouched -> the kill-switch payload would reach realEval (shield disarmed)
  assert.equal(off.sandbox.eval('process.exit(0)'), 'REAL:process.exit(0)', 'with the shield off, eval is not guarded');
});

// ── 7. index.js keeps the full shield wiring (static guard against regressions) ─
test('index.js keeps the shield wiring: knob, three Utils stubs, eval guard, failure event', () => {
  const { src } = extractShieldBlock();
  assert.ok(src.includes('const BOT_SHIELD = process.env.BOT_SHIELD'), 'BOT_SHIELD env knob must stay');
  assert.ok(/Utils\.keyCore1\s*=/.test(src), 'keyCore1 stub must stay');
  assert.ok(/Utils\.keyCore2\s*=/.test(src), 'keyCore2 stub must stay');
  assert.ok(/Utils\.keysMessagesObjWA\s*=/.test(src), 'keysMessagesObjWA stub must stay');
  assert.ok(/globalThis\.eval\s*=/.test(src), 'the eval guard must stay');
  assert.ok(/process\\s\*\\\.\\s\*\(exit\|kill\)/.test(src), 'the kill-switch regex must stay');
  assert.ok(/pushRuntimeEvent\('shield'/.test(src), 'the shield failure path must push an event');
});