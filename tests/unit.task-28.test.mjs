/**
 * tests/unit.task-28.test.mjs — todo 28: bounded memory + payload size
 * ===================================================================
 * Mix of behaviour (module under test) and static source scans. Asserts:
 *   - every module-level cooldown map in plugins/ is pruned or self-capped
 *   - pruneCooldown expires by TTL and still caps oversized maps
 *   - splitText keeps content intact under the 4096 limit (line boundaries,
 *     hard cuts, empty input); fitText states the cut; mentionsIn resolves
 *   - the nine oversized payload sites now chunk / truncate / cap
 *   - system/utils.js: no shell exec, ffmpeg has a timeout, every
 *     axios/fetch call is bounded, fileTypeFromBuffer is guarded
 *   - tools/tomp3.js: ffmpeg timeout, temp cleanup in finally, input cap
 *   - download/مانهوا.js: chapter download already capped (todo 24)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const rel = (p) => path.relative(repoRoot, p);
const src = (p) => readFileSync(path.join(repoRoot, p), 'utf8');

const { pruneCooldown, MAX_TRACKED } = await import(pathToFileURL(path.join(repoRoot, 'system/cooldowns.js')).href);
const chunks = await import(pathToFileURL(path.join(repoRoot, 'system/text-chunks.js')).href);

/** Arabic plugin files carry escaped names on disk (e.g. #U0634#U0631#U062d.js) —
 *  resolve them by content needle instead of hardcoding either spelling. */
const srcByNeedle = (dir, needle) => {
    const abs = path.join(repoRoot, dir);
    for (const name of readdirSync(abs)) {
        if (!name.endsWith('.js')) continue;
        const s = readFileSync(path.join(abs, name), 'utf8');
        if (s.includes(needle)) return s;
    }
    throw new Error(`no file under ${dir} contains: ${needle}`);
};

/* ── cooldown maps & bounded state maps ── */

test('task-28: request-contact prunes the pending map and command cooldowns are disabled', () => {
    const s = src('plugins/tools/request-contact.js');
    assert.match(s, /import \{ pruneCooldown \} from "\.\.\/\.\.\/system\/cooldowns\.js";/);
    assert.match(s, /pruneCooldown\(pending, REQUEST_TTL\)/);
});

test('task-28: quran plugin sets COOLDOWN_MS to 0 and keeps cooldowns map bounded', () => {
    const s = srcByNeedle('plugins/islamic', 'per-user cooldown');
    assert.match(s, /const COOLDOWN_MS = 0;/);
    assert.match(s, /if \(cooldowns\.size > MAX_TRACKED\)/);
});

test('task-28: no other module-level cooldown map ships unpruned', () => {
    const root = path.join(repoRoot, 'plugins');
    const files = [];
    (function walk(d) {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            if (['node_modules', 'session', 'sub'].includes(e.name)) continue;
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.js')) files.push(p);
        }
    })(root);

    const unpruned = [];
    for (const f of files) {
        const s = readFileSync(f, 'utf8');
        const moduleLevel = /^const \w*cooldown\w* = new Map\(\);$/im.exec(s);
        if (!moduleLevel) continue;
        const guarded = /pruneCooldown\(|pruneCooldowns\(|cooldowns?\.size >/.test(s);
        if (!guarded) unpruned.push(rel(f));
    }
    assert.deepEqual(unpruned, []);
});

test('task-28: pruneCooldown expires by TTL then caps the size', () => {
    const map = new Map([['old', Date.now() - 60000], ['new', Date.now()]]);
    assert.equal(pruneCooldown(map, 10000), 1);
    assert.equal(map.size, 1);
    assert.ok(map.has('new'));

    const big = new Map();
    for (let i = 0; i < MAX_TRACKED + 200; i++) big.set(`k${i}`, Date.now() - i);
    const removed = pruneCooldown(big, 10 ** 12);
    assert.equal(big.size, MAX_TRACKED);
    assert.equal(removed, 200);
    // oldest entries dropped first
    assert.ok(!big.has(`k${MAX_TRACKED + 199}`));
    assert.ok(big.has('k0'));
});

/* ── text chunks ── */

test('task-28: splitText keeps every line under the limit without losing content', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `سطر ${i} ${'x'.repeat(30)}`);
    const original = lines.join('\n');
    const parts = chunks.splitText(original);
    assert.ok(parts.length > 1);
    for (const p of parts) assert.ok(p.length <= 4096, `part too big: ${p.length}`);
    const restored = parts.join('\n').split('\n').map((l) => (l.startsWith('…') ? l.slice(1) : l)).join('\n');
    assert.equal(restored, original);
});

test('task-28: splitText hard-cuts single oversized lines and passes trivia through', () => {
    const hard = chunks.splitText('ي'.repeat(9000));
    assert.equal(hard.length, 3);
    for (const p of hard) assert.ok(p.length <= 4096);
    assert.deepEqual(chunks.splitText(''), []);
    assert.deepEqual(chunks.splitText('   '), []);
    assert.deepEqual(chunks.splitText('قصير'), ['قصير']);
});

test('task-28: fitText truncates with an explicit cut note', () => {
    const fit = chunks.fitText('x'.repeat(5000));
    assert.ok(fit.length <= 4096);
    assert.match(fit, /تم قطع/);
    assert.equal(chunks.fitText('قصير'), 'قصير');
});

test('task-28: mentionsIn resolves only the jids present in a chunk', () => {
    const ids = ['123@s.whatsapp.net', '456@s.whatsapp.net', '999@lid'];
    assert.deepEqual(chunks.mentionsIn('hi @123 and @999', ids).sort(), ['123@s.whatsapp.net', '999@lid']);
    assert.deepEqual(chunks.mentionsIn('no tokens here', ids), []);
});

/* ── oversized payload sites ── */

test('task-28: the three group-mention plugins chunk and carry per-chunk mentions', () => {
    for (const file of ['plugins/admins/mentionall.js', 'plugins/admins/mentionmemeber.js', 'plugins/admins/mentionadmin.js']) {
        const s = src(file);
        assert.match(s, /splitText\(messageText\)/, `${file}: no split`);
        assert.match(s, /mentionsIn\(part,/, `${file}: no per-chunk mentions`);
        assert.match(s, /slice\(0, MAX_MENTIONS\)/, `${file}: no mention cap`);
        assert.doesNotMatch(s, /mentions: (participants|groupMembers|groupAdmins)\b/, `${file}: unbounded mentions left`);
    }
});

test('task-28: h.js caps the hidden-mention payload', () => {
    const s = src('plugins/admins/h.js');
    assert.match(s, /participants\.slice\(0, MAX_MENTIONS\)/);
});

test('task-28: lyrics chunks, ocr truncates, help list chunks as text', () => {
    assert.match(src('plugins/tools/lyrics.js'), /splitText\(result\)/);
    assert.match(src('plugins/tools/ocr.js'), /fitText\(parsed\)/);

    const help = srcByNeedle('plugins/info', 'قائمة أوامر البوت');
    assert.match(help, /caption: "📜 قائمة أوامر البوت"/);
    assert.match(help, /for \(const part of splitText\(helpMessage\)\)/);
    assert.doesNotMatch(help, /caption: helpMessage/);
});

test('task-28: owner errors batches under 4096 and caps the shown tail', async () => {
    const errors = Array.from({ length: 120 }, (_, i) => ({ file: `f${i}.js`, command: `c${i}`, error: `e${i}` }));
    const bot = { errors: async () => errors };
    const sent = [];
    const conn = { sendMessage: async (_chat, payload) => { sent.push(payload.text); } };
    const m = { reply: async (t) => sent.push(t) };

    const mod = await import(pathToFileURL(path.join(repoRoot, 'plugins/owner/errors.js')).href);
    await mod.default(m, { bot, conn });

    assert.ok(sent.length > 1, 'did not batch');
    for (const text of sent) assert.ok(text.length <= 4096, `batch too big: ${text.length}`);
    const flat = sent.join('\n');
    // الأحدث أولاً: أحدث 50 معروضين، والأقدم 70 مخفيين وبيتقولوا صراحة
    for (const e of errors.slice(-50)) assert.ok(flat.includes(e.error), `missing ${e.error}`);
    // e1 هي substring من e10 — بنقفل النهاية بـ \n عشان ما يحصلش تطابق كذّاب
    for (const e of errors.slice(0, 70)) assert.ok(!flat.includes(`#❌ الايرور: ${e.error}\n`), `old error shown: ${e.error}`);
    assert.match(sent.at(-1), /و70 إيرور أقدم مش معروض/);

    const emptyMod = { errors: async () => [] };
    const replies = [];
    await mod.default({ reply: async (t) => replies.push(t) }, { bot: emptyMod, conn });
    assert.deepEqual(replies, ['✅ مفيش أخطاء مسجلة.']);
});

/* ── utils + tomp3 ── */

test('task-28: system/utils.js has no shell exec and every request is bounded', () => {
    const s = src('system/utils.js');
    assert.doesNotMatch(s, /promisify\(exec\)/);
    assert.doesNotMatch(s, /execAsync\(`/);
    assert.match(s, /execFileAsync\("ffmpeg"/);
    assert.match(s, /\{ timeout: FFMPEG_TIMEOUT \}/);
    assert.match(s, /timeout: HTTP_TIMEOUT/);
    assert.match(s, /AbortSignal\.timeout\(30000\)/);
    // every axios call carries a timeout within its call options
    const lines = s.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (!/axios\.(get|post)\(/.test(lines[i])) continue;
        const window = lines.slice(i, i + 4).join('\n');
        assert.match(window, /timeout/, `unbounded request at line ${i + 1}`);
    }
    // fileTypeFromBuffer only inside the guarded helper
    const destructures = s.split('\n').filter((l) => /await fileTypeFromBuffer\(/.test(l) && !/type = \(/.test(l));
    assert.deepEqual(destructures, []);
    assert.match(s, /const \{ ext, mime \} = await fileInfo\(buffer\);/);
});

test('task-28: tomp3.js bounds ffmpeg, cleans temps, and caps the input', () => {
    const s = src('plugins/tools/tomp3.js');
    assert.match(s, /timeout: FFMPEG_TIMEOUT_MS/);
    assert.match(s, /finally \{[\s\S]*unlinkSync/);
    assert.match(s, /media\.length > MAX_INPUT_BYTES/);
});

test('task-28: manhwa chapter download is capped', () => {
    const s = srcByNeedle('plugins/download', 'MangaDex');
    assert.match(s, /slice\(0, MAX_PAGES\)/);
    assert.match(s, /totalBytes > MAX_ZIP_BYTES/);
    assert.match(s, /MAX_IMAGE_BYTES/);
});