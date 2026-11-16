/**
 * tests/unit.task-29.test.mjs — todo 29: remove harmful/dead/duplicated plugins, gate sub pairing
 * ============================================================================================
 * Mix of behaviour (approve/deny handlers with a fake db) and static scans. Asserts:
 *   - the mass-broadcast plugins (owner/az3a.js, subs/azi3a.js) are gone
 *   - the dead success-reporting stubs are gone
 *   - no Array.prototype patch remains anywhere in the tree; h.js and بيبضني.js
 *     use the local helpers instead
 *   - the hardcoded foreign numbers/group ids in the auto plugins are gone
 *   - sub.js and sub2.js refuse an unapproved pairing request and pass an approved one
 *   - approve.js / deny.js persist the allowlist on the db (get + delete)
 *   - statistics.js guards the db/sock access; join.js is owner+category owner;
 *     copybtn.js dropped the owner flag; عرض.js no longer imports @whiskeysockets/baileys
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const src = (p) => readFileSync(path.join(repoRoot, p), 'utf8');
const gone = (p) => assert.equal(existsSync(path.join(repoRoot, p)), false, `${p} must not exist`);

/** Arabic-named plugin files on disk (e.g. #U0634#U0631#U062d.js) — resolve by content. */
const srcByNeedle = (dir, needle) => {
    const abs = path.join(repoRoot, dir);
    for (const name of readdirSync(abs)) {
        if (!name.endsWith('.js')) continue;
        const s = readFileSync(path.join(abs, name), 'utf8');
        if (s.includes(needle)) return s;
    }
    throw new Error(`no file under ${dir} contains: ${needle}`);
};

const allPluginSources = () => {
    const out = [];
    const walk = (relDir) => {
        const abs = path.join(repoRoot, relDir);
        for (const entry of readdirSync(abs, { withFileTypes: true })) {
            const p = path.join(relDir, entry.name);
            if (entry.isDirectory()) walk(p);
            else if (entry.name.endsWith('.js')) out.push(readFileSync(path.join(abs, entry.name), 'utf8'));
        }
    };
    walk('plugins');
    walk('system');
    return out;
};

/* ═══════════════ (a) broadcasts deleted ═══════════════ */

test('todo29a: mass-broadcast plugins are deleted', () => {
    gone('plugins/owner/az3a.js');
    gone('plugins/subs/azi3a.js');
});

test('todo29a: no broadcast path remains in the tree', () => {
    const offenders = allPluginSources()
        .filter(s => s.includes('groupFetchAllParticipating') && s.includes('mentions: metadata.participants'))
        .map(() => 'participants-mention broadcast');
    assert.equal(offenders.length, 0);
});

/* ═══════════════ (b) dead stubs deleted ═══════════════ */

test('todo29b: dead success-reporting stubs are deleted', () => {
    for (const f of [
        'plugins/owner/exec.js', 'plugins/owner/eval.js', 'plugins/owner/clean.js',
        'plugins/owner.js', 'plugins/subs/bots.js',
        'plugins/tools/debugyt.js', 'plugins/tools/debugyt2.js',
    ]) gone(f);
});

test('todo29b: no plugin still replies success without a mechanism', () => {
    const offenders = allPluginSources()
        .filter(s => /✅\s*تم (?:التنفيذ|تنفيذ الأمر|تنظيف البيانات)/.test(s))
        .map(() => 'stub success reply');
    assert.equal(offenders.length, 0);
});

/* ═══════════════ (c) prototype patches replaced ═══════════════ */

test('todo29c: no Array.prototype patch anywhere in plugins/ or system/', () => {
    const offenders = allPluginSources()
        .filter(s => /Array\.prototype\.\w+\s*=/.test(s))
        .map(() => 'Array.prototype patch');
    assert.equal(offenders.length, 0);
});

test('todo29c: h.js and بيبضني.js use the local helpers', () => {
    const h = src('plugins/admins/h.js');
    assert.match(h, /pickRandom\(images\)/, 'h.js must call pickRandom');
    assert.doesNotMatch(h, /images\.random\(\)/);
    const bib = srcByNeedle('plugins/game', 'قراءة الأعضاء');
    assert.match(bib, /const pickRandom = /, 'local helper declared');
    assert.doesNotMatch(bib, /\.getRandom\(\)/, 'prototype call gone');
    assert.ok(src('system/utils.js').includes('export function pickRandom'), 'shared helper exists');
});

/* ═══════════════ (d) hardcoded foreign numbers/ids ═══════════════ */

test('todo29d: auto plugins carry no hardcoded phone numbers or group ids', () => {
    const phone = /(?<![\d.])(?:\+\d{10,15}|\d{10,15})(?![\d.])/;
    for (const f of [
        'plugins/auto/anti-badword.js', 'plugins/auto/noBots.js', 'plugins/auto/anti-link.js',
        'plugins/subs/sub.js', 'plugins/subs/sub2.js',
    ]) {
        for (const [n, line] of src(f).split('\n').entries()) {
            assert.doesNotMatch(line, phone, `${f}:${n + 1} still has a raw number → ${line.trim()}`);
        }
    }
});

test('todo29d: operator group lists are empty placeholders, not foreign ids', () => {
    assert.match(src('plugins/auto/anti-badword.js'), /const groups = \[\];/);
    assert.match(src('plugins/auto/noBots.js'), /const groups = \[\];/);
    assert.match(src('plugins/auto/anti-link.js'), /const blockedGroups = \[\];/);
});

/* ═══════════════ (e) pairing gate ═══════════════ */

test('todo29e: both pairing commands refuse an unapproved requester', async () => {
    for (const f of ['plugins/subs/sub.js', 'plugins/subs/sub2.js']) {
        const s = src(f);
        assert.match(s, /global\.db\.subPairAllow/, `gate present in ${f}`);
        assert.match(s, /محتاج موافقة المطور/, `Arabic refusal in ${f}`);
        assert.match(s, /m\.isOwner === true \|\| !!allow\[num\]/, 'owner bypass shape');
    }
});

test('todo29e: approve lists, adds and refuses non-owners', async () => {
    const db = {};
    globalThis.db = db;
    const mod = await import(pathToFileURL(path.join(repoRoot, 'plugins/subs/approve.js')).href);
    const handler = mod.default;

    const reply = async (t) => t;
    // non-owner → refused
    assert.match(await handler({ isOwner: false, reply }, { args: ['2XXXXXXXXXXX'] }), /للمطور فقط/);
    assert.equal(db.subPairAllow, undefined, 'nothing written for a non-owner');

    // owner+no args → empty list message
    assert.match(await handler({ isOwner: true, reply }, { args: [] }), /مفيش أرقام/);

    // owner+number → allowlist entry recorded on the db
    const num = '201001234567';
    assert.match(await handler({ isOwner: true, sender: '201001234567@s.whatsapp.net', reply }, { args: [num] }), /تم السماح/);
    assert.equal(db.subPairAllow[num].by, '201001234567@s.whatsapp.net');
});

test('todo29e: deny removes the allowlist entry', async () => {
    globalThis.db = { subPairAllow: { '201001234567': { at: 1 } } };
    const mod = await import(pathToFileURL(path.join(repoRoot, 'plugins/subs/deny.js')).href);
    const handler = mod.default;
    const reply = async (t) => t;

    assert.match(await handler({ isOwner: false, reply }, { args: ['201001234567'] }), /للمطور فقط/);
    assert.match(await handler({ isOwner: true, reply }, { args: ['201001234567'] }), /تم شيل السماح/);
    assert.equal(globalThis.db.subPairAllow['201001234567'], undefined);
});

/* ═══════════════ (f) targeted fixes ═══════════════ */

test('todo29f: statistics guards the db/sock access', () => {
    const s = src('plugins/subs/statistics.js');
    assert.match(s, /sub\.stats\(\)/, 'stats call present');
    assert.match(s, /try\s*\{[\s\S]*?catch/, 'guarded call');
    assert.match(s, /bot\?\.sock\?\.user\?\.id/, 'sock guarded');
    assert.doesNotMatch(s, /bot\.sock\.user\.id\.split/, 'unguarded access gone');
});

test('todo29f: ping reports no fabricated number', async () => {
    const s = src('plugins/info/ping.js');
    assert.doesNotMatch(s, /Math\.random/, 'random fabrication removed');
    assert.match(s, /m\.messageTimestamp/, 'uses the real message timestamp');

    const mod = await import(pathToFileURL(path.join(repoRoot, 'plugins/info/ping.js')).href);
    const sent = [];
    const conn = { sendMessage: async (chat, payload) => { sent.push(payload.text); } };
    await mod.default({ chat: 'c@s.whatsapp.net', messageTimestamp: Math.floor((Date.now() - 1234) / 1000) }, { conn });
    assert.match(sent[0], /سرعة البوت/, 'replies with the speed card');

    // أي رقم معروض لازم يكون قياس فعلي (من timestamp الرسالة) — مش ملفّق
    const conn2 = { sendMessage: async (chat, payload) => { sent.push(payload.text); } };
    await mod.default({ chat: 'c@s.whatsapp.net', messageTimestamp: Math.floor(Date.now() / 1000) }, { conn: conn2 });
    assert.match(sent[1], /\*\d+(?:\.\d)?ms\*/, 'a real measured number is shown');
});

test('todo29f: join.js declares owner metadata, copybtn drops the owner flag', () => {
    const join = src('plugins/owner/join.js');
    assert.match(join, /handler\.owner = true/);
    assert.match(join, /handler\.category = "owner"/);
    const copybtn = src('plugins/tools/copybtn.js');
    assert.doesNotMatch(copybtn, /handler\.owner\s*=\s*true/, 'benign utility is not owner-only');
});

test('todo29f: عرض.js no longer imports the undeclared baileys package', () => {
    // the Arabic-named display plugin — resolved by a unique body marker
    // (annotate.js has neither marker and keeps its own import, out of scope)
    const display = srcByNeedle('plugins', 'viewonce');
    assert.doesNotMatch(display, /@whiskeysockets/, 'no baileys reference left');
    assert.match(display, /conn\.downloadMediaMessage\(/, 'uses the client socket method');
});

/* ═══════════════ lane wiring ═══════════════ */

test('lane file is named for the aggregator auto-import', () => {
    assert.match(path.basename(import.meta.url), /^unit\.task-29\.test\.mjs$/);
});