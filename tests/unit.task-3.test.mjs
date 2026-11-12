/**
 * tests/unit.task-3.test.mjs — todo 3: "Make the pairing state truthful so self-heal never stays disarmed"
 * ====================================================================================================
 * GAP-13: the panel computed "a pairing is in progress" as `!!(state.qr || state.pairingCode)`.
 * That flag never went away on its own: a QR that nobody scanned (or a bot that was restarted
 * mid-pairing) kept it TRUE forever, so `index.js` watchdog (`if (rt.pairing) return;`) and the
 * healer (`rt.stopped || rt.pairing`) stayed DISARMED for the whole life of the process.
 *
 * These cases assert the STATE VALUE (never the presence of a log line) and drive the state
 * machine with a FAKE CLOCK — there is not a single wall-clock sleep in this file:
 *  - an emitted QR / pairing code  -> the pairing is ACTIVE
 *  - a connection 'open'            -> the pairing is CLEARED
 *  - 3 minutes without an open     -> the pairing is INACTIVE (expired)
 *  - a 401 / 403 close             -> the pairing is CLEARED
 *  - a STALE pairing runtime       -> the watchdog STILL calls the restart function
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const { createPairingState, PAIRING_TTL_MS } = await import(
  pathToFileURL(path.join(repoRoot, 'system', 'pairing.js')).href
);
const panel = await import(
  pathToFileURL(path.join(repoRoot, 'system', 'webPanel.js')).href
);

/* fake clock — no wall-clock waiting anywhere in this suite */
function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms) { t += ms; return t; }
  };
}

/**
 * نسخة من تكة الـ watchdog في index.js بنفس ترتيب الحراسات.
 * index.js غير قابل للاستيراد (بيشغّل البوت)، فبنحاكي التكة هنا
 * وبنستخدم نفس helpers الحقيقية من webPanel.js.
 */
function watchdogTick({ runtime, now, connected = false, restart }) {
  if (runtime.stopped) return 'skipped:stopped';
  if (panel.pairingActive(now)) return 'skipped:pairing';
  if (connected) return 'skipped:connected';
  restart('watchdog');
  return 'restarted';
}

/* ------------------------------------------------------------------ *
 * 1. the state machine itself (fake clock, no sleeps)
 * ------------------------------------------------------------------ */

test('pairing: an emitted QR makes the pairing active', () => {
  const clock = fakeClock();
  const ps = createPairingState({ now: clock.now });
  assert.equal(ps.isActive(clock.now), false, 'a fresh state has no pairing');
  assert.equal(ps.ageMs(clock.now), 0);

  ps.setQr('QR-PAYLOAD');
  assert.equal(ps.isActive(clock.now), true, 'an emitted QR is an active pairing');
  assert.equal(ps.ageMs(clock.now), 0);
  assert.equal(ps.qr, 'QR-PAYLOAD');
});

test('pairing expiry: the pairing goes inactive after 3 minutes without an open', () => {
  const clock = fakeClock();
  const ps = createPairingState({ now: clock.now });
  ps.setQr('x');

  assert.equal(PAIRING_TTL_MS, 180000, 'the pairing TTL is 3 minutes');

  clock.advance(PAIRING_TTL_MS - 1);
  assert.equal(ps.isActive(clock.now), true, 'still inside the 3 minute window');
  assert.equal(ps.ageMs(clock.now), PAIRING_TTL_MS - 1);

  clock.advance(2); // age is now > 180000
  assert.ok(ps.ageMs(clock.now) > 180000, 'the age really passed 180000 ms');
  assert.equal(ps.isActive(clock.now), false, 'a stale pairing must NOT stay active');
  assert.equal(ps.expired(clock.now), true);
});

test('pairing expiry: the pairing-code path expires exactly the same way', () => {
  const clock = fakeClock();
  const ps = createPairingState({ now: clock.now });
  ps.setPairingCode('ABCD1234');
  assert.equal(ps.isActive(clock.now), true);
  assert.equal(ps.pairingCode, 'ABCD1234');

  clock.advance(PAIRING_TTL_MS + 1);
  assert.equal(ps.isActive(clock.now), false, 'a stale pairing code must NOT stay active');
});

test('pairing: a new QR / pairing code restarts the 3 minute window', () => {
  const clock = fakeClock();
  const ps = createPairingState({ now: clock.now });
  ps.setQr('first');
  clock.advance(PAIRING_TTL_MS - 1000);
  ps.setQr('second');            // QR جديد => الساعة رجعت من الأول
  assert.equal(ps.ageMs(clock.now), 0);
  clock.advance(PAIRING_TTL_MS - 1000);
  assert.equal(ps.isActive(clock.now), true, 'the refreshed QR keeps the pairing alive');
});

test('pairing: clear() ends the pairing immediately', () => {
  const clock = fakeClock();
  const ps = createPairingState({ now: clock.now });
  ps.setQr('x');
  assert.equal(ps.isActive(clock.now), true);
  ps.clear();
  assert.equal(ps.isActive(clock.now), false);
  assert.equal(ps.ageMs(clock.now), 0);
  assert.equal(ps.qr, null);
});

/* ------------------------------------------------------------------ *
 * 2. the panel wiring (real panel code, real shared state)
 * ------------------------------------------------------------------ */

test('panel: an open connection clears the pairing', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'QR-1' });
  assert.equal(panel.panelRuntime().pairing, true, 'a fresh QR is an active pairing');

  panel.handleConnectionUpdate({ connection: 'open' });
  assert.equal(panel.panelRuntime().pairing, false, 'open clears the pairing');
  assert.equal(panel.panelRuntime().pairingAgeMs, 0);
});

test('panel: a 401 close clears the pairing', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'QR-401' });
  assert.equal(panel.panelRuntime().pairing, true);

  panel.handleConnectionUpdate({
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 401 } } } // loggedOut
  });
  assert.equal(panel.panelRuntime().pairing, false, 'a 401 close clears the pairing');
});

test('panel: a 403 close clears the pairing', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'QR-403' });
  assert.equal(panel.panelRuntime().pairing, true);

  panel.handleConnectionUpdate({
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 403 } } } // forbidden
  });
  assert.equal(panel.panelRuntime().pairing, false, 'a 403 close clears the pairing');
});

test('panel: an unrelated close keeps the pairing alive', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'QR-500' });
  panel.handleConnectionUpdate({
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 500 } } } // badSession — لسه في ربط
  });
  assert.equal(panel.panelRuntime().pairing, true, 'a 500 close does not end a live pairing');
  panel.pairingState.clear();
});

test('panel: panelRuntime() exposes a truthful pairing + pairingAgeMs', () => {
  panel.pairingState.clear();
  assert.equal(panel.panelRuntime().pairing, false);
  assert.equal(panel.panelRuntime().pairingAgeMs, 0);

  panel.handleConnectionUpdate({ qr: 'QR-AGE' });
  const started = panel.pairingState.startedAt;

  const live = panel.panelRuntime(started + 5000);
  assert.equal(live.pairing, true);
  assert.equal(live.pairingAgeMs, 5000, 'pairingAgeMs is the age of the live pairing');

  const stale = panel.panelRuntime(started + 200000); // > 3 minutes
  assert.equal(stale.pairing, false, 'the panel must not report a stale pairing as active');
  assert.equal(stale.pairingAgeMs, 0);
  panel.pairingState.clear();
});

/* ------------------------------------------------------------------ *
 * 3. the watchdog must stay armed (the whole point of the todo)
 * ------------------------------------------------------------------ */

test('watchdog not disarmed: a STALE pairing runtime does not stop the watchdog', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'STALE-QR' });
  const started = panel.pairingState.startedAt;

  // the panel runtime is stubbed with the OLD behaviour: a stale pairing flag
  const staleRuntime = { pairing: true, stopped: false, pairingAgeMs: 10 * 60 * 1000 };

  let restarts = 0;
  const result = watchdogTick({
    runtime: staleRuntime,
    now: started + 181000, // more than 3 minutes later — the QR is long dead
    connected: false,
    restart: () => { restarts++; }
  });

  assert.equal(result, 'restarted', 'a stale pairing flag must NOT disarm the watchdog');
  assert.equal(restarts, 1, 'the watchdog restart function must be called');
  panel.pairingState.clear();
});

test('watchdog: a GENUINE pairing does pause the watchdog', () => {
  panel.pairingState.clear();
  panel.handleConnectionUpdate({ qr: 'FRESH-QR' });
  const started = panel.pairingState.startedAt;

  const runtime = { pairing: true, stopped: false, pairingAgeMs: 1000 };
  let restarts = 0;
  const result = watchdogTick({
    runtime,
    now: started + 1000, // still inside the 3 minute window
    connected: false,
    restart: () => { restarts++; }
  });

  assert.equal(result, 'skipped:pairing', 'a real pairing in progress pauses the watchdog');
  assert.equal(restarts, 0);
  panel.pairingState.clear();
});

test('watchdog: an operator stop still pauses the watchdog', () => {
  panel.pairingState.clear();
  const runtime = { pairing: false, stopped: true, pairingAgeMs: 0 };
  let restarts = 0;
  const result = watchdogTick({
    runtime,
    now: Date.now(),
    connected: false,
    restart: () => { restarts++; }
  });
  assert.equal(result, 'skipped:stopped');
  assert.equal(restarts, 0);
});

/* ------------------------------------------------------------------ *
 * 4. index.js really asks the truthful state (and not the stale flag)
 * ------------------------------------------------------------------ */

test('index.js: the watchdog and the healer ask pairingActive(), not the stale panel flag', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'index.js'), 'utf8');

  assert.ok(
    /import\s*\{[^}]*pairingActive[^}]*\}\s*from\s*'\.\/system\/webPanel\.js'/.test(src),
    'index.js must import pairingActive() from the panel'
  );
  assert.equal(
    /\brt\.pairing\b/.test(src),
    false,
    'the stale panel flag (rt.pairing) must not gate the watchdog/healer any more'
  );
  assert.equal(
    (src.match(/pairingActive\(\)/g) || []).length,
    2,
    'both the healer shouldSkip() and the watchdog must consult pairingActive()'
  );
  // the watchdog guard keeps its order: stopped first, then the pairing
  assert.ok(
    /if \(rt\.stopped\) return;[\s\S]{0,200}if \(pairingActive\(\)\) return;/.test(src),
    'the watchdog guard order is: stopped -> pairingActive'
  );
});

/* ------------------------------------------------------------------ *
 * 5. the must-NOTs
 * ------------------------------------------------------------------ */

test('must-not: the pairing state never touches the session folder', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'system', 'pairing.js'), 'utf8');
  assert.equal(
    /node:fs|rmSync|unlink|renameSync|rmdir|creds|session/i.test(src),
    false,
    'system/pairing.js must not touch the filesystem or the session'
  );
});

test('must-not: the panel QR / pairing-code rendering is unchanged', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'system', 'webPanel.js'), 'utf8');
  const rendering = [
    "if(d.pairingCode){",
    "<div class=\"code\">'+esc(d.pairingCode)+'</div>'",
    "if(d.qr){",
    "html+='<div class=\"qrbox\">",
    "if(!d.pairingCode && !d.qr){",
    "qr: state.qr ? state.qrDataUrl : null,",
    "pairingCode: state.pairingCode,"
  ];
  for (const needle of rendering) {
    assert.ok(src.includes(needle), `rendering fragment missing: ${needle}`);
  }
});
