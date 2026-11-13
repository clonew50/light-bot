/**
 * tests/unit.task-8.test.mjs — todo 8: panel tells the truth
 * ==========================================================================================
 * Three things are pinned here, with STATE VALUES / ORDER / TIMESTAMPS (not log strings):
 *   1. `selectErrors` takes the FIRST 15 entries of client.errors(), because meowsab returns
 *      newest-first (`W.unshift({...})`; `get:()=>[...W]`). The old code did
 *      `slice(-15).reverse()` and rendered the OLDEST 15.
 *   2. The runtime event bus keeps newest-first, caps at 100, every entry has a numeric `ts`
 *      and an Arabic `text`, and `getClientInfo()` exposes the same list under the `events`
 *      key (the key the UI depends on) with `errors[].error` (the key the UI depends on).
 *   3. `connected` uses the interim honest signal (ws.readyState + sock.user + last open/close)
 *      and NOT the framework's lying `isConnected()`.
 * Plus static assertions that every required runtime failure publishes a typed event.
 *
 * Fake clock only — no wall-clock sleeps, no bot boot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const eventsMod = await import(pathToFileURL(path.join(repoRoot, 'system', 'events.js')).href);
const { pushEvent, getEvents, clearEvents, EVENT_LIMIT } = eventsMod;

const panelMod = await import(pathToFileURL(path.join(repoRoot, 'system', 'webPanel.js')).href);
const { pushEvent: panelPushEvent, getClientInfo, computeConnected, selectErrors, handleConnectionUpdate } = panelMod;

const quiet = (fn) => {
  const orig = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = orig; }
};

function fakeClient(overrides = {}) {
  const errors = Array.from({ length: 20 }, (_, i) => ({ error: 'e' + i, command: 'c' + i, time: 't' + i }));
  return {
    config: { sessionPath: '/tmp/opencode/task8-no-session', info: { nameBot: 'LightBot' }, phoneNumber: '201000000000' },
    sock: { ws: { readyState: 1 }, user: { id: '1:2' } },
    getAllCommands: () => new Array(7),
    errors: () => errors,
    isConnected: () => true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * 1. newest-first errors
 * ------------------------------------------------------------------ */

test('errors newest first: selectErrors keeps the first 15, newest at index 0', () => {
  const errors = Array.from({ length: 20 }, (_, i) => ({ error: 'e' + i, command: 'c' + i, time: 't' + i }));
  const picked = selectErrors(errors);
  assert.equal(picked.length, 15);
  assert.equal(picked[0].error, 'e0', 'index 0 must be the newest (errors() is newest-first)');
  assert.equal(picked[14].error, 'e14');
  assert.equal(picked[0].time, 't0');
});

test('errors stale_state: a newer error never resurfaces below an old one', () => {
  // simulate the framework array after a new error is unshifted
  const errors = [{ error: 'newest', time: 'now' }, { error: 'older', time: 'before' }, { error: 'oldest', time: 'long-ago' }];
  const picked = selectErrors(errors);
  assert.equal(picked[0].error, 'newest');
  assert.notEqual(picked[0].error, 'oldest');
  assert.equal(picked[2].error, 'oldest');
});

test('getClientInfo payload: errors[0].error is newest and events are newest-first', () => {
  clearEvents();
  const info = quiet(() => {
    pushEvent('boot', 'إقلاع تجريبي');
    return getClientInfo(fakeClient());
  });
  assert.equal(info.errors[0].error, 'e0');
  assert.equal(typeof info.errors[0].error, 'string');
  assert.equal(info.errors[0].message, undefined, 'payload key must be `error`, not `message`');
  assert.ok(Array.isArray(info.events));
  assert.equal(info.events[0].text, 'إقلاع تجريبي');
  assert.equal(typeof info.events[0].ts, 'number');
});

/* ------------------------------------------------------------------ *
 * 2. event bus
 * ------------------------------------------------------------------ */

test('event bus: newest-first, capped at 100, each entry has ts + Arabic text', () => {
  clearEvents();
  for (let i = 0; i < 150; i++) pushEvent('test', 'حدث ' + i);
  const ev = getEvents();
  assert.equal(EVENT_LIMIT, 100);
  assert.equal(ev.length, 100, 'retained list never exceeds 100');
  assert.equal(ev[0].text, 'حدث 149', 'newest at top');
  assert.equal(ev[99].text, 'حدث 50', 'oldest retained is the 50th push');
  assert.equal(typeof ev[0].ts, 'number');
  assert.ok(Number.isFinite(ev[0].ts));
  assert.ok(ev[0].ts <= Date.now() + 1000);
  assert.match(ev[0].line, /حدث 149/);
});

test('event bus: timestamp order follows the clock (fake, no sleeps)', () => {
  clearEvents();
  const realNow = Date.now;
  let t = 1_700_000_000_000;
  Date.now = () => t;
  try {
    pushEvent('x', 'first');
    t += 5_000;
    pushEvent('x', 'second');
    t += 5_000;
    pushEvent('x', 'third');
  } finally {
    Date.now = realNow;
  }
  const ev = getEvents();
  assert.deepEqual(ev.map((e) => e.text), ['third', 'second', 'first']);
  assert.deepEqual(ev.map((e) => e.ts), [1_700_000_010_000, 1_700_000_005_000, 1_700_000_000_000]);
});

test('event bus: a publisher can never throw into its caller', () => {
  clearEvents();
  assert.doesNotThrow(() => pushEvent(null, null));
  assert.doesNotThrow(() => pushEvent(undefined));
  assert.doesNotThrow(() => pushEvent(Symbol('nope')));
  assert.doesNotThrow(() => pushEvent({ toString() { throw new Error('boom'); } }));
  assert.doesNotThrow(() => pushEvent('ok', 'still works'));
  assert.equal(getEvents()[0].text, 'still works');
});

test('event bus: 150 pushes still leave the status payload at 100', () => {
  clearEvents();
  for (let i = 0; i < 150; i++) pushEvent('flood', 'f' + i);
  const info = quiet(() => getClientInfo(fakeClient()));
  assert.equal(info.events.length, 100);
  assert.equal(info.events[0].text, 'f149');
});

test('panel pushEvent is routed through the shared bus', () => {
  clearEvents();
  quiet(() => panelPushEvent('رسالة من اللوحة'));
  const ev = getEvents();
  assert.equal(ev[0].text, 'رسالة من اللوحة');
  assert.equal(ev[0].kind, 'panel');
  assert.equal(typeof ev[0].ts, 'number');
});

/* ------------------------------------------------------------------ *
 * 3. honest connected (interim, until todo 35 liveness helper)
 * ------------------------------------------------------------------ */

test('connected: open ws + user (late attach, no open event) => connected', () => {
  quiet(() => handleConnectionUpdate({ connection: 'open' })); // reset baseline
  const c = { sock: { ws: { readyState: 1 }, user: { id: '1' } }, isConnected: () => true };
  assert.equal(computeConnected(c), true);
});

test('connected: framework isConnected() lies when ws is closed => panel says false', () => {
  const c = { sock: { ws: { readyState: 3 }, user: { id: '1' } }, isConnected: () => true };
  assert.equal(c.isConnected(), true);
  assert.equal(computeConnected(c), false);
  const info = quiet(() => getClientInfo(c));
  assert.equal(info.connected, false);
});

test('connected: no socket => false even if isConnected() claims true', () => {
  assert.equal(computeConnected({ isConnected: () => true }), false);
  assert.equal(computeConnected(null), false);
});

test('connected: a close after the last open => false until a new open', () => {
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    quiet(() => handleConnectionUpdate({ connection: 'open' }));
    const c = { sock: { ws: { readyState: 1 }, user: { id: '1' } }, isConnected: () => true };
    assert.equal(computeConnected(c), true);
    t += 1_000;
    quiet(() => handleConnectionUpdate({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } }));
    assert.equal(computeConnected(c), false);
    t += 1_000;
    quiet(() => handleConnectionUpdate({ connection: 'open' }));
    assert.equal(computeConnected(c), true);
  } finally {
    Date.now = realNow;
  }
});

/* ------------------------------------------------------------------ *
 * 4. required runtime publishers exist and are typed
 * ------------------------------------------------------------------ */

test('index.js publishes every required runtime failure as a typed event', () => {
  const src = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
  for (const kind of ['shield', 'restore', 'boot', 'healer', 'watchdog', 'memory', 'update', 'uncaught', 'rejection']) {
    assert.match(src, new RegExp("pushRuntimeEvent\\('" + kind + "'"), 'missing pushRuntimeEvent for ' + kind);
  }
  // healer action goes through a wrapper that both publishes and restarts
  assert.match(src, /restart:\s*\(reason\)\s*=>\s*\{[\s\S]*?pushRuntimeEvent\('healer'[\s\S]*?global\.restartBot\?\.\(reason\)/);
  // auto-update surfaces pulled / skipped / deleted / needsInstall
  assert.match(src, /r\.changes/);
  assert.match(src, /r\.skipped/);
  assert.match(src, /r\.deleted/);
  assert.match(src, /r\.needsInstall/);
});

test('webPanel payload uses the newest-errors + honest-connected helpers (source contract)', () => {
  const src = readFileSync(path.join(repoRoot, 'system', 'webPanel.js'), 'utf8');
  assert.match(src, /errors:\s*selectErrors\(errors\)/);
  assert.match(src, /connected:\s*computeConnected\(client\)/);
  assert.match(src, /events:\s*getEvents\(\)/);
  assert.doesNotMatch(src, /errors:\s*errors\.slice\(-15\)/, 'oldest-15 slice must be gone');
  assert.match(src, /TODO\(todo-35\)/, 'interim signal must be marked for the liveness helper');
});

test('webPanel no longer keeps a private events array (bus is the single store)', () => {
  const src = readFileSync(path.join(repoRoot, 'system', 'webPanel.js'), 'utf8');
  assert.doesNotMatch(src, /state\.events/);
});