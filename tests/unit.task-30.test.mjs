/**
 * tests/unit.task-30.test.mjs — todo 30: group-event cards + access gate in system/control.js
 * ==========================================================================================
 * Mix of behaviour (group() + access() against fakes) and static scans. Asserts:
 *   - the participant list is built from p.id with a phoneNumber fallback, so
 *     LID-only participants produce real mentions instead of "No users"
 *   - group() answers with the named EVENT_HANDLED constant, not a bare 9999
 *   - group-event failures and access-gate denials reach the panel event bus
 *   - the denied-command reply is text-only — no remote image, no network call
 *   - the fail-closed gate decisions are unchanged
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const src = (p) => readFileSync(path.join(repoRoot, p), 'utf8');

const { group, access } = await import(pathToFileURL(path.join(repoRoot, 'system/control.js')).href);
const { getEvents, clearEvents } = await import(pathToFileURL(path.join(repoRoot, 'system/events.js')).href);

/* ═══════════════ (a) LID participants ═══════════════ */

test('todo30a: participant ids come from p.id with phoneNumber fallback', () => {
    const s = src('system/control.js');
    assert.match(s, /p\?\.id \|\| p\?\.phoneNumber/, 'maps id first, phone second');
    assert.doesNotMatch(s, /filter\(p => p\?\.phoneNumber\)/, 'no phone-only filter');
});

test('todo30a: LID-only participants are mentioned, not dropped', async () => {
    globalThis.db = { groups: {} };
    const sent = [];
    const ctx = { sock: { sendMessage: async (chat, payload) => { sent.push({ chat, payload }); } } };
    const event = {
        chat: 'g@g.us',
        participants: [{ id: '111@lid' }, { id: '222@lid' }],
        author: '333@lid',
        userUrl: null,
    };
    const r = await group(ctx, event, 'add');
    assert.equal(r, null, 'normal welcome returns null');
    assert.equal(sent.length, 1);
    const caption = sent[0].payload.caption;
    assert.ok(!caption.includes('No users'), 'LID participants present');
    assert.ok(caption.includes('@111') && caption.includes('@222'), 'numeric ids shown');
    assert.ok(sent[0].payload.mentions.includes('111@lid'), 'LID jid mentioned');
    assert.ok(sent[0].payload.mentions.includes('333@lid'), 'author mentioned once');
});

test('todo30a: non-participants are never invented', async () => {
    globalThis.db = { groups: {} };
    const sent = [];
    const ctx = { sock: { sendMessage: async (chat, payload) => { sent.push(payload); } } };
    await group(ctx, { chat: 'g@g.us', participants: [], author: null, userUrl: null }, 'add');
    assert.equal(sent.length, 1);
    assert.match(sent[0].caption, /No users/, 'empty participants stays honest');
    assert.deepEqual(sent[0].mentions, [], 'no mentions invented');
});

/* ═══════════════ (d) EVENT_HANDLED contract ═══════════════ */

test('todo30d: noWelcome returns the named constant, no magic number at the call', async () => {
    const s = src('system/control.js');
    assert.match(s, /const EVENT_HANDLED = 9999;/, 'named constant exists');
    assert.doesNotMatch(s, /return 9999;/, 'no bare magic return at the call site');
    assert.match(s, /return EVENT_HANDLED;/, 'early return uses the name');

    globalThis.db = { groups: { 'g@g.us': { noWelcome: true } } };
    const ctx = { sock: { sendMessage: async () => { throw new Error('must not send'); } } };
    const r = await group(ctx, { chat: 'g@g.us', participants: [{ id: '1@lid' }], author: 'a@lid', userUrl: null }, 'add');
    assert.equal(r, 9999, 'same wire value, documented meaning');
});

/* ═══════════════ (b) panel event stream ═══════════════ */

test('todo30b: a failing group card lands on the event bus', async () => {
    clearEvents();
    globalThis.db = { groups: {} };
    const ctx = { sock: { sendMessage: async () => { throw new Error('boom'); } } };
    const r = await group(ctx, { chat: 'g@g.us', participants: [{ id: '1@lid' }], author: 'a@lid', userUrl: null }, 'add');
    assert.equal(r, null, 'swallowed like before');
    const events = getEvents();
    assert.ok(events.some(e => /boom/.test(e.text) && e.kind === 'group'), 'panel event pushed');
});

/* ═══════════════ (c) denial is text-only ═══════════════ */

test('todo30c: the source drops the remote denial image', () => {
    const s = src('system/control.js');
    // the denial path lives inside access(); the group() welcome card keeps
    // its image (plan only forbids a network call on denials)
    const accessBody = s.slice(s.indexOf('const access'));
    assert.doesNotMatch(accessBody, /image: \{ url:/, 'no image payload in the denial path');
    assert.doesNotMatch(accessBody, /https?:\/\/i\.supaimg\.com/, 'no remote denial asset');
});

test('todo30c: denials send a text message with no media url', async () => {
    const s = src('system/control.js');
    const accessBody = s.slice(s.indexOf('const access'));
    assert.doesNotMatch(accessBody, /image: \{ url:/, 'no image payload left');

    const replies = [];
    const conn = { sendMessage: async (chat, payload) => { replies.push(payload); } };
    const msg = { chat: 'g@g.us', client: async () => conn };
    assert.equal(await access(msg, 'owner', 5), false, 'still denied');
    assert.equal(replies.length, 1);
    assert.equal(typeof replies[0].text, 'string', 'text-only reply');
    assert.ok(!('image' in replies[0]), 'no media field');
    assert.match(replies[0].text, /هذا الامر للمطور فقط/, 'same Arabic copy');
});

test('todo30c: denials never hit the network for media', async () => {
    const httpCalls = [];
    const conn = {
        sendMessage: async (chat, payload) => { httpCalls.push(payload); },
    };
    const msg = { chat: 'g@g.us', client: async () => conn };
    await access(msg, 'cooldown', 3);
    for (const payload of httpCalls) assert.ok(!payload.image && !payload.video && !payload.document, 'no media keys');
});

test('todo30c: unknown check types still fall through to null', async () => {
    const conn = { sendMessage: async () => { throw new Error('must not send'); } };
    const msg = { chat: 'g@g.us', client: async () => conn };
    assert.equal(await access(msg, 'nope', 0), null, 'unmatched type = no reply, no denial');
});

test('todo30c: a broken client stays fail-closed and logs to the bus', async () => {
    clearEvents();
    const msg = { chat: 'g@g.us', client: async () => { throw new Error('dead socket'); } };
    assert.equal(await access(msg, 'owner', 0), false, 'fail closed');
    const events = getEvents();
    assert.ok(events.some(e => /dead socket/.test(e.text) && e.kind === 'access'), 'access failure on the bus');
});

test('todo30: gate decisions are unchanged for every message type', async () => {
    const conn = { sendMessage: async (chat, payload) => ({ chat, payload }) };
    const msg = { chat: 'g@g.us', client: async () => conn };
    for (const t of ['cooldown', 'owner', 'group', 'admin', 'private', 'botAdmin', 'noSub', 'disabled', 'error']) {
        assert.equal(await access(msg, t, 0), false, `${t} denied`);
    }
});