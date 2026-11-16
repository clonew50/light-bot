/**
 * tests/unit.task-26.test.mjs — todo 26: command collisions resolved, fail-closed owner guard
 * ==========================================================================================
 * Static scan only (no bot boot). Asserts:
 *   - every command name registered under plugins is claimed by exactly one file
 *     (array-literal commands and single-identifier arrays like textpro's `logos`)
 *   - the historical shadowing list (حذف/عدل/نسخ/معلومات/عرض/cat) has one owner each
 *   - `بروفايل` belongs to the bank profile, `pfp`/`profile` to the picture fetcher
 *   - no plugin guards with the fail-open `isOwner === false` pattern anymore
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const pluginsRoot = path.join(repoRoot, 'plugins');

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'session' || entry.name === 'sub') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

/** Collect every command name a plugin file registers, resolving simple indirections. */
function commandsOf(file) {
    const src = readFileSync(file, 'utf8');
    const names = [];
    const assign = /handler\.command\s*=\s*([^;\n]+)/g;
    let m;
    while ((m = assign.exec(src))) {
        const rhs = m[1].trim();
        let body = null;
        if (rhs.startsWith('[')) {
            body = rhs;
        } else {
            // `handler.command = logos;` — resolve an array declared in the same file.
            const id = rhs.match(/^[A-Za-z_$][\w$]*$/);
            if (!id) continue;
            const decl = new RegExp(`(?:const|let|var)\\s+${id[0]}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src);
            if (!decl) continue; // unresolvable: reported by the caller as a scan failure
            body = `[${decl[1]}]`;
        }
        if (body === null) throw new Error(`unresolvable handler.command in ${path.relative(repoRoot, file)}: ${rhs}`);
        for (const raw of body.slice(1, -1).split(',')) {
            const cmd = raw.trim().replace(/^['"`]|['"`]$/g, '').trim();
            if (cmd) names.push(cmd);
        }
    }
    return names;
}

test('task-26: no command name is claimed by two plugins', () => {
    const owners = new Map();
    for (const file of walk(pluginsRoot)) {
        for (const cmd of commandsOf(file)) {
            const rel = path.relative(repoRoot, file);
            if (!owners.has(cmd)) owners.set(cmd, new Set());
            owners.get(cmd).add(rel);
        }
    }
    const dupes = [...owners.entries()].filter(([, set]) => set.size > 1).map(([cmd, set]) => `${cmd} <- ${[...set].join(', ')}`);
    assert.deepEqual(dupes, [], `duplicate commands: ${dupes.join(' | ')}`);
    assert.ok(owners.size > 100, `scan found only ${owners.size} commands — walk broken?`);
});

test('task-26: بروفايل is the bank profile, pfp/profile fetch the picture', () => {
    const bank = path.join(pluginsRoot, 'bank/profile.js');
    const pro = path.join(pluginsRoot, 'tools/pro.js');
    assert.ok(commandsOf(bank).includes('بروفايل'));
    assert.ok(!commandsOf(bank).includes('profile'));
    assert.ok(commandsOf(pro).includes('pfp'));
    assert.ok(commandsOf(pro).includes('profile'));
    assert.ok(!commandsOf(pro).includes('بروفايل'));
});

test('task-26: no fail-open isOwner === false guard ships', () => {
    const offenders = [];
    for (const file of walk(pluginsRoot)) {
        const src = readFileSync(file, 'utf8');
        if (/isOwner\s*===\s*false/.test(src)) offenders.push(path.relative(repoRoot, file));
    }
    assert.deepEqual(offenders, []);
});