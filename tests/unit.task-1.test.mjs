/**
 * tests/unit.task-1.test.mjs — todo 1: "Pin the WhatsApp linked-device identity to a stable fingerprint"
 * ==========================================================================================
 * GAP-1: the meowsab schema defaults `browser` to a RANDOM value
 * ("Chrome"/"Firefox"/"Safari"/"Edge"), so the WhatsApp device tuple
 * ['Ubuntu', <browser>, '22.04.4'] changed on every boot.
 *
 * These cases assert the VALUE (not the presence of a log line):
 *  - buildConfig() pins the fingerprint to 'LightBot' (overridable via BOT_BROWSER)
 *  - the framework's own zod parse of that config keeps 'LightBot'
 *  - the resolved device tuple is ['Ubuntu','LightBot','22.04.4'] BEFORE AND AFTER a restart
 *  - the framework default IS random -> the pinned value really comes from our config
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Browsers } = require('@whiskeysockets/baileys');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const CONFIG_MODULE = path.join(repoRoot, 'system', 'config.js');

const { buildConfig, buildInfo, DEFAULT_BROWSER } = await import(pathToFileURL(CONFIG_MODULE).href);

const EXPECTED_TUPLE = ['Ubuntu', 'LightBot', '22.04.4'];
const FRAMEWORK_RANDOM_BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];

/* ------------------------------------------------------------------ *
 * 1. the pinned fingerprint itself
 * ------------------------------------------------------------------ */

test('config: browser is pinned to LightBot by default', () => {
  assert.equal(buildConfig({}).browser, 'LightBot');
  assert.equal(buildConfig({}).browser, DEFAULT_BROWSER);
});

test('config: BOT_BROWSER overrides the pinned fingerprint', () => {
  assert.equal(buildConfig({ BOT_BROWSER: 'Custom' }).browser, 'Custom');
});

test('config: an empty BOT_BROWSER never falls through to the framework random default', () => {
  assert.equal(buildConfig({ BOT_BROWSER: '' }).browser, 'LightBot');
  assert.notEqual(buildConfig({ BOT_BROWSER: '' }).browser, '');
  for (const b of FRAMEWORK_RANDOM_BROWSERS) {
    assert.notEqual(buildConfig({ BOT_BROWSER: '' }).browser, b);
  }
});

/* ------------------------------------------------------------------ *
 * 2. the device tuple that WhatsApp actually sees
 * ------------------------------------------------------------------ */

test('config: the device tuple resolves to Ubuntu/LightBot/22.04.4', () => {
  const config = buildConfig({});
  assert.deepEqual(Browsers.ubuntu(config.browser), EXPECTED_TUPLE);
});

test('config: the device tuple is identical BEFORE and AFTER an in-process restart', () => {
  // A restart re-evaluates the module and re-parses the config (fresh boot state).
  // The fingerprint must NOT change — that is the whole point of the todo.
  const script = `
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const { Browsers } = require('${path.join(repoRoot, 'node_modules', '@whiskeysockets', 'baileys').replace(/\\/g, '/')}');
    const { Client } = require('${path.join(repoRoot, 'node_modules', 'meowsab').replace(/\\/g, '/')}');
    const cfgUrl = ${JSON.stringify(pathToFileURL(CONFIG_MODULE).href)};

    async function boot(tag) {
      // cache-busted import == a fresh evaluation of the module (new boot / restart)
      const mod = await import(cfgUrl + '?boot=' + tag);
      const cfg = mod.buildConfig({});
      // let the REAL framework parse it (zod .strict() schema) and read back what it kept
      const client = new Client(cfg);
      const effective = client.config.browser;
      const tuple = Browsers.ubuntu(effective);
      // control: what the framework WOULD have picked on its own (random default)
      const control = new Client({ ...cfg, browser: undefined });
      const controlBrowser = control.config.browser;
      await client.cleanup();
      await control.cleanup();
      return { effective, tuple, controlBrowser };
    }

    const before = await boot('before');
    const after = await boot('after');
    console.log(JSON.stringify({ before, after }));
    process.exit(0);
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const { before, after } = JSON.parse(out.trim().split('\n').pop());

  // BEFORE the restart
  assert.equal(before.effective, 'LightBot');
  assert.deepEqual(before.tuple, EXPECTED_TUPLE);

  // AFTER the restart — same identity, not just "logged again"
  assert.equal(after.effective, 'LightBot');
  assert.deepEqual(after.tuple, EXPECTED_TUPLE);
  assert.deepEqual(after.tuple, before.tuple);

  // control: the framework default is random, so 'LightBot' can only come from our config
  assert.ok(
    FRAMEWORK_RANDOM_BROWSERS.includes(before.controlBrowser),
    `expected a randomized framework default, got ${before.controlBrowser}`
  );
  assert.notEqual(before.controlBrowser, 'LightBot');
});

/* ------------------------------------------------------------------ *
 * 3. every other config key keeps its old value and semantics
 * ------------------------------------------------------------------ */

test('config: the other Client keys are unchanged', () => {
  const config = buildConfig({});
  assert.equal(config.phoneNumber, '201505362172');
  assert.deepEqual(config.prefix, ['.', '/', '!']);
  assert.equal(config.fromMe, false);
  assert.equal(config.owners.length, 3);
  assert.deepEqual(config.owners[0].jid, '218930171336@s.whatsapp.net');
  assert.deepEqual(config.owners[2].jid, '201212446299@s.whatsapp.net');
  assert.deepEqual(config.settings, { noWelcome: true });
  assert.equal(config.commandsPath, './plugins');
  // sessionPath / printQR are not part of the Client literal — they stay framework-owned
  assert.equal('sessionPath' in config, false);
  assert.equal('printQR' in config, false);
  // BOT_PHONE still wins over the default
  assert.equal(buildConfig({ BOT_PHONE: '201111111111' }).phoneNumber, '201111111111');
});

test('config: buildInfo() returns the bot info without foreign identifiers', () => {
  const info = buildInfo();
  // the dev newsletter / Pomni-AI repo / dev channel were removed in todo 12 —
  // idChannel is env-driven (BOT_NEWSLETTER_JID), repo/channel point at the operator's repo
  assert.equal(info.idChannel, '');
  assert.equal(buildInfo({ BOT_NEWSLETTER_JID: '123@newsletter' }).idChannel, '123@newsletter');
  assert.equal(info.urls.repo, 'https://github.com/clonew50/light-bot');
  assert.equal(info.urls.api, 'https://text.pollinations.ai');
  assert.equal(info.urls.channel, 'https://github.com/clonew50/light-bot');
  assert.equal(info.copyright.author, info.nameBot);
  assert.equal(info.images.length, 3);
});

/* ------------------------------------------------------------------ *
 * 4. index.js wiring — the boot log line must exist exactly once
 * ------------------------------------------------------------------ */

test('index: boots through buildConfig() and logs the fingerprint exactly once', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(repoRoot, 'index.js'), 'utf8');
  const matches = src.match(/🔎 بصمة الجهاز/g) || [];
  assert.equal(matches.length, 1, 'the fingerprint must be logged exactly once at boot');
  assert.match(src, /new Client\(buildConfig\(\)\)/);
  assert.match(src, /config\.info = buildInfo\(\)/);
});
