/**
 * tests/unit.task-31.test.mjs — todo 31: harden the sub-bot layer (root sub.js)
 * ===========================================================================
 * Static source scans (importing sub.js has real framework side effects —
 * SIGINT handlers, global config writes). Asserts:
 *   - the static "LIGHTBOT" well-known code is gone; a random 8-char code is
 *     generated, persisted to the db (db.subPairing) and invalidated after a
 *     successful pairing, then regenerated for the next pairing round
 *   - msg.key.id / msg.key.remoteJid are guarded before use
 *   - badSession actually removes the sub-bot record and pushes a panel event
 *   - the derived phone number is validated (+ and 8-15 digits) and rejected
 *     with an Arabic warning
 *   - the .خاص / .عام owner modes are preserved untouched
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const src = (p) => readFileSync(path.join(repoRoot, p), 'utf8');

const s = src('sub.js');
const split = (marker) => s.slice(s.indexOf(marker));
const pairBlock = split("global.subBots.on('pair'").slice(0, split("global.subBots.on('pair'").indexOf("global.subBots.on('message'"));
const msgBlock = split("global.subBots.on('message'").slice(0, split("global.subBots.on('message'").indexOf("global.subBots.on('close'"));
const badBlock = split("global.subBots.on('badSession'").slice(0, 1200);

/* ═══════════════ (a) random pairing code ═══════════════ */

test('todo31a: the static well-known pairing code is gone', () => {
    assert.doesNotMatch(s, /pariCode\(["']LIGHTBOT["']\)/, 'no static LIGHTBOT code');
    assert.doesNotMatch(s, /pariCode\(["']VENI1234["']\)/, 'no static default code');
});

test('todo31a: the boot code is generated, not hardcoded', () => {
    assert.match(s, /const generatePairCode = \(\) =>/, 'generator exists');
    assert.match(s, /PAIR_CODE_CHARS = "[A-Z2-9]+"/, 'alphabet without confusing glyphs');
    assert.match(s, /SubBots\.pariCode\(bootCode\)/, 'framework receives the generated code');
    assert.match(s, /generatePairCode\(\)\s*\n\s*for|for \(let i = 0;/, 'random per-character build');
});

test('todo31a: the code is persisted for the panel', () => {
    assert.match(s, /global\.db\.subPairing = \{/, 'written to the db');
    assert.match(s, /persistPairCode\(bootCode/, 'boot code persisted');
});

test('todo31a: the code is invalidated and renewed after a successful pairing', () => {
    assert.match(pairBlock, /rec\.used = true/, 'used flag set');
    assert.match(pairBlock, /rec\.usedAt = Date\.now\(\)/, 'timestamped invalidation');
    assert.match(pairBlock, /code === rec\.code/, 'only the matching code is consumed');
    assert.match(pairBlock, /SubBots\.pariCode\(fresh\)/, 'fresh code installed for next round');
    assert.match(pairBlock, /persistPairCode\(fresh/, 'fresh code persisted');
    assert.match(pairBlock, /pushEvent\('sub'/, 'pairing reaches the panel');
});

/* ═══════════════ (b) malformed messages ═══════════════ */

test('todo31b: key id and remoteJid are guarded before use', () => {
    assert.match(msgBlock, /const keyId = msg\?\.key\?\.id;/, 'keyId captured');
    assert.match(msgBlock, /const remoteJid = msg\?\.key\?\.remoteJid;/, 'remoteJid captured');
    assert.match(msgBlock, /if \(!keyId \|\| !remoteJid\) return;/, 'malformed messages ignored');
    assert.doesNotMatch(msgBlock, /msg\.key\.id\.includes/, 'no unguarded key.id access');
    assert.doesNotMatch(msgBlock, /msg\.key\.remoteJid/, 'no unguarded remoteJid access');
});

/* ═══════════════ (c) badSession ═══════════════ */

test('todo31c: badSession removes the record and pushes a panel event', () => {
    assert.doesNotMatch(badBlock, /Bad session, removed`/, 'the fake log line is gone');
    assert.match(badBlock, /global\.subBots\.remove\(/, 'tries the id removal');
    assert.match(badBlock, /global\.subBots\.removeByphone\(/, 'falls back to phone removal');
    assert.match(badBlock, /pushEvent\('sub'/, 'panel event either way');
});

/* ═══════════════ (d) phone format ═══════════════ */

test('todo31d: the derived number is validated (+ and 8-15 digits)', () => {
    assert.match(msgBlock, /\^\\\+\?\\d\{8,15\}\$\/\.test\(botNumber\)/, 'format check present');
    assert.match(msgBlock, /تم تجاهل الرسالة/, 'Arabic rejection wording');
    assert.doesNotMatch(msgBlock, /msg\.key\.remoteJid\.split\('@'\)\[0\]\s*\?/, 'sender number uses the guarded remoteJid');
});

test('todo31d: the phone validation regex itself', async () => {
    const { readFileSync: rf } = await import('node:fs');
    const text = rf(path.join(repoRoot, 'sub.js'), 'utf8');
    const m = text.match(/\^\\\+\?\\d\{8,15\}\$/);
    assert.ok(m, 'regex literal present');
    const re = new RegExp(m[0]);
    for (const ok of ['218930171336', '201505362172', '12345678']) assert.ok(re.test(ok), `accepts ${ok}`);
    for (const bad of ['1234', '1234567890123456', 'abc', '']) assert.ok(!re.test(bad), `rejects ${bad}`);
});

/* ═══════════════ Must NOT: modes preserved ═══════════════ */

test('todo31: the private/public modes survive untouched', () => {
    assert.match(msgBlock, /body === "\.خاص"/, '.خاص handled');
    assert.match(msgBlock, /body === "\.عام"/, '.عام handled');
    assert.match(msgBlock, /subBotModes\.set\(uid, true\)/, 'private switch');
    assert.match(msgBlock, /subBotModes\.set\(uid, false\)/, 'public switch');
    assert.match(msgBlock, /isPrivate && senderNumber !== botNumber/, 'owner-only private mode');
    assert.match(msgBlock, /getMessageText/, 'command body extraction intact');
});

test('todo31: the pairing code is never leaked to other chats', () => {
    // the only logging of the code is the owner-side console + db, no sendMessage
    const msgSends = msgBlock.match(/sendMessage\([^)]*\)/g) || [];
    for (const call of msgSends) assert.doesNotMatch(call, /code/i, 'no code in message payloads');
    assert.doesNotMatch(msgBlock, /subPairing/, 'message handler never touches the pairing record');
});

/* ═══════════════ lane wiring ═══════════════ */

test('lane file is named for the aggregator auto-import', () => {
    assert.match(path.basename(import.meta.url), /^unit\.task-31\.test\.mjs$/);
});