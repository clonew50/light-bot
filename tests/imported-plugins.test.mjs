import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const sourceRoot = path.join(repoRoot, 'extensions', 'imported-plugins');
const bridgeRoot = path.join(repoRoot, 'plugins', 'imported');
const excludedBridges = new Set([
  '_afk.js',
  '_antispam.js',
  '_cmdWithMedia.js',
  '_durability.js',
  '_premium.js',
  '_role.js',
  '_templateResponse.js',
  'dino.js'
]);

async function jsFiles(root) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();
}

function exactNames(command) {
  if (typeof command === 'string') return command.trim() ? [command.trim().toLowerCase()] : [];
  if (!Array.isArray(command)) return [];
  return command
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function staticExactCommands(source) {
  const names = [];
  const assignment = /handler\.command\s*=\s*([^;\n]+)/g;
  let match;
  while ((match = assignment.exec(source))) {
    const rhs = match[1].trim();
    let body = null;
    if (rhs.startsWith('[')) {
      body = rhs;
    } else {
      const identifier = rhs.match(/^[A-Za-z_$][\w$]*$/);
      if (!identifier) continue;
      const declaration = new RegExp(`(?:const|let|var)\\s+${identifier[0]}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
      if (!declaration) continue;
      body = `[${declaration[1]}]`;
    }
    for (const raw of body.slice(1, -1).split(',')) {
      const name = raw.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (name) names.push(name.toLowerCase());
    }
  }
  return names;
}

test('all supplied plugin sources are preserved and import successfully', async () => {
  const sources = await jsFiles(sourceRoot);
  assert.equal(sources.length, 169, 'the complete 169-file supplied plugin set must be preserved');

  for (const name of sources) {
    const module = await import(pathToFileURL(path.join(sourceRoot, name)).href);
    assert.ok(module, `${name} must be importable`);
  }
});

test('every command source has a loader-facing compatibility bridge', async () => {
  const sources = await jsFiles(sourceRoot);
  const bridges = await jsFiles(bridgeRoot);
  const expected = sources.filter((name) => !excludedBridges.has(name));

  assert.deepEqual(bridges, expected, 'bridge set must match command sources exactly');
  for (const name of bridges) {
    const source = await readFile(path.join(bridgeRoot, name), 'utf8');
    assert.doesNotMatch(source, /handler\.command\s*=/, `${name} bridge must not hard-code target command metadata`);
  }
});

test('adapted imported plugins expose valid metadata and unique exact commands', async () => {
  const bridges = await jsFiles(bridgeRoot);
  const owners = new Map();

  for (const name of bridges) {
    const module = await import(pathToFileURL(path.join(bridgeRoot, name)).href);
    const handler = module.default;
    assert.ok(handler && typeof handler.execute === 'function', `${name} must export an executable handler`);
    assert.ok(handler.command, `${name} must expose command metadata`);
    assert.ok(Array.isArray(handler.usage) && handler.usage.length, `${name} must expose usage metadata`);
    assert.equal(typeof handler.category, 'string', `${name} must expose a category`);

    for (const command of exactNames(handler.command)) {
      const previous = owners.get(command);
      assert.equal(previous, undefined, `${command} is claimed by both ${previous} and ${name}`);
      owners.set(command, name);
    }
  }

  assert.equal(owners.has('menu'), false, 'the target menu command must remain owned by menu2');
  assert.equal(owners.has('menu3'), true, 'the supplied menu must be available as menu3');
});

test('imported exact commands do not shadow existing target commands', async () => {
  const bridgeFiles = await walk(bridgeRoot);
  const imported = new Set();
  for (const file of bridgeFiles) {
    const module = await import(pathToFileURL(file).href);
    for (const name of exactNames(module.default?.command)) imported.add(name);
  }

  const target = new Set();
  for (const file of await walk(path.join(repoRoot, 'plugins'))) {
    if (file.startsWith(`${bridgeRoot}${path.sep}`)) continue;
    for (const name of staticExactCommands(await readFile(file, 'utf8'))) target.add(name);
  }

  const collisions = [...imported].filter((name) => target.has(name)).sort();
  assert.deepEqual(collisions, [], `imported exact commands shadow target commands: ${collisions.join(', ')}`);
});

test('the real Meowsab runtime registers every imported bridge and preserves menu ownership', async () => {
  const helper = path.join(here, 'helpers', 'imported-runtime-check.mjs');
  const { stdout } = await execFileAsync(process.execPath, [helper], {
    cwd: repoRoot,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024
  });

  assert.match(stdout, /IMPORTED_RUNTIME_OK/);
});

test('representative imported and dino handlers execute through the compatibility layer', async () => {
  const helper = path.join(here, 'helpers', 'imported-execution-check.mjs');
  const { stdout } = await execFileAsync(process.execPath, [helper], {
    cwd: repoRoot,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024
  });

  assert.match(stdout, /IMPORTED_EXECUTION_OK/);
});

test('the supplied dino replaced the previous target dino', async () => {
  const module = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'dino.js')).href);
  const handler = module.default;
  assert.ok(handler.command instanceof RegExp);
  assert.match(handler.command.source, /dino/i);
  assert.deepEqual(handler.usage, ['dino']);
  assert.equal(handler.category, 'games');
  assert.equal(handler.help, undefined);
  assert.equal(handler.tags, undefined);
});
