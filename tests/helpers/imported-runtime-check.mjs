import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'meowsab';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const pluginsRoot = path.join(repoRoot, 'plugins');
const bridgeRoot = path.join(pluginsRoot, 'imported');

try {
  const bot = new Client({
    commandsPath: bridgeRoot,
    prefix: ['.', '/', '!']
  });

  await bot.commandSystem.loadDirectory(bridgeRoot);
  await bot.commandSystem.loadFile(path.join(pluginsRoot, 'menu2.js'));

  const expectedBridges = (await readdir(bridgeRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(bridgeRoot, entry.name));
  const registeredPaths = new Set(
    bot.commandSystem.registry
      .getAll()
      .map((command) => path.resolve(command.__filePath || command.file || ''))
  );

  for (const bridge of expectedBridges) {
    assert.ok(registeredPaths.has(bridge), `${bridge} was not registered by Meowsab`);
  }

  const menu3 = bot.commandSystem.registry.findByName('menu3')?.command;
  const menu = bot.commandSystem.registry.findByName('menu')?.command;
  assert.equal(menu3?.__filePath, path.join(bridgeRoot, 'menu.js'));
  assert.equal(menu?.__filePath, path.join(pluginsRoot, 'menu2.js'));

  console.log(`IMPORTED_RUNTIME_OK ${expectedBridges.length}`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
