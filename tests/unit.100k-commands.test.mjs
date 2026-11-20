import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { normalizeCommandsList, matchCommand, simulateCommand } from '../system/simulator.js';
import { startWebPanel } from '../system/webPanel.js';

const MEGA_PACKS = [
  'plugins/packs/mega_math_science_pack.js',
  'plugins/packs/mega_text_cipher_pack.js',
  'plugins/packs/mega_dev_toolkit_pack.js',
  'plugins/packs/mega_islamic_pack.js',
  'plugins/packs/mega_world_atlas_pack.js',
  'plugins/packs/mega_games_rpg_pack.js',
  'plugins/packs/mega_economy_empire_pack.js',
  'plugins/packs/mega_design_color_pack.js',
  'plugins/packs/mega_lifestyle_health_pack.js',
  'plugins/packs/mega_creator_prompt_pack.js'
];

async function loadMegaAndPro() {
  const all = [];
  const proMod = await import(pathToFileURL(path.resolve('plugins/native/whatsapp_pro.js')).href);
  all.push(...proMod.default);
  for (const rel of MEGA_PACKS) {
    const mod = await import(pathToFileURL(path.resolve(rel)).href);
    all.push(...mod.default);
  }
  return all;
}

test('100k+ commands: loads >= 100,000 distinct functional commands with zero trigger duplicates', async () => {
  const handlers = await loadMegaAndPro();
  assert.ok(handlers.length >= 100000, `Expected >= 100,000 commands, got ${handlers.length}`);

  const seen = new Set();
  for (const h of handlers) {
    assert.ok(Array.isArray(h.command) && h.command.length > 0, 'Missing command trigger');
    assert.ok(Array.isArray(h.usage) && h.usage.length > 0, `Missing usage on ${h.command[0]}`);
    assert.ok(h.category, `Missing category on ${h.command[0]}`);
    assert.equal(typeof h.execute, 'function', `Missing execute on ${h.command[0]}`);
    for (const c of h.command) {
      const k = String(c).toLowerCase();
      assert.equal(seen.has(k), false, `Duplicate trigger in new packs: ${k}`);
      seen.add(k);
    }
  }

  // Verify zero collisions against all existing non-mega plugins in a clean child process
  const scanScript = `
    import fs from 'node:fs';
    import path from 'node:path';
    import { pathToFileURL } from 'node:url';
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
    );
    const files = walk('plugins').filter((f) => /\\.js$/.test(f) && !f.includes('mega_') && !f.endsWith('whatsapp_pro.js') && !f.endsWith('agent.js'));
    const out = [];
    for (const f of files) {
      const mod = await import(pathToFileURL(path.resolve(f)).href);
      const list = Array.isArray(mod.default) ? mod.default : mod.default ? [mod.default] : [];
      for (const h of list) {
        const cmds = Array.isArray(h?.command) ? h.command : h?.command ? [h.command] : [];
        for (const c of cmds) if (typeof c === 'string') out.push(c.toLowerCase());
      }
    }
    process.stdout.write('TRIG:' + JSON.stringify(out));
    process.exit(0);
  `;
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', scanScript], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '0' },
    encoding: 'utf8'
  });
  const baseTriggers = new Set(JSON.parse(raw.slice(raw.lastIndexOf('TRIG:') + 5)));
  for (const k of seen) {
    assert.equal(baseTriggers.has(k), false, `Mega/Pro command "${k}" collides with existing plugin`);
  }
});

test('All 10 mega-packs & whatsapp_pro execute with distinct real outputs and zero cooldowns', async () => {
  global.db = { users: {}, groups: {} };
  const handlers = await loadMegaAndPro();
  const client = { config: { prefix: ['.'], phoneNumber: '201000000000', info: { nameBot: 'Light Test' } }, getAllCommands: () => handlers };

  const samples = [
    ['.حول_وحدة_كم_الى_ميل 10', /6\.213/],
    ['.نظام_عد_10_الى_16 255', /FF/],
    ['.زخرف_نمط_1_اطار_1 لايت', /لايت/],
    ['.قيصر_شفر_3 ABC', /DEF/],
    ['.بورت_شبكة_443', /HTTPS/],
    ['.مفتاح_امني_1', /الإنتروبيا/],
    ['.سورة_اية_2_255', /البقرة/],
    ['.اسم_حسنى_1', /الله/],
    ['.مسافة_مدن_القاهرة_الى_الرياض', /كم/],
    ['.نرد_اوجه_20 3', /المجموع/],
    ['.زنزانة_بطل_1_عالم_1', /عملة/],
    ['.استثمار_مشروع_1_مستوى_5', /عملة/],
    ['.لون_طيف_180_سطوع_55', /HEX/],
    ['.حرق_تمرين_2_دقيقة_30 70', /سعرة/],
    ['.برومبت_فن_1_موضوع_5', /8k/i],
    ['.استطلاع_متعدد 2 | لغة؟ | JS | Python | Rust', null],
    ['.فحص_واتساب 201012345678', /201012345678/],
    ['.رابط_مكالمة فيديو', /call\.whatsapp\.com/],
    ['.ارسال_موقع 30.0444 31.2357 القاهرة', /القاهرة/],
    ['.بطاقة_جهة أحمد | 201012345678', /أحمد/],
    ['.حظر_مشاركة_متقدم تفعيل', /مفعّل|حماية/]
  ];

  const outputsSeen = new Set();
  for (const [cmdInput, pattern] of samples) {
    const r = await simulateCommand(client, cmdInput);
    assert.equal(r.ok, true, `Expected ${cmdInput} to succeed, got: ${r.error}`);
    assert.ok(r.outputs.length >= 1, `Expected output for ${cmdInput}`);
    const serialized = JSON.stringify(r.outputs);
    assert.equal(outputsSeen.has(serialized), false, `Output for ${cmdInput} was identical to another command`);
    outputsSeen.add(serialized);
    if (pattern) {
      assert.match(r.outputs[0].text || serialized, pattern, `Unexpected output for ${cmdInput}`);
    }
  }

  // Verify consecutive rapid executions are NOT blocked by cooldown
  const r1 = await simulateCommand(client, '.زنزانة_بطل_10_عالم_2');
  const r2 = await simulateCommand(client, '.زنزانة_بطل_10_عالم_2');
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.ok(global.db.users['tester@s.whatsapp.net'].money > 500, 'RPG/Empire commands must update DB');
});

test('webPanel /api/commands paginates 100k+ commands cleanly and quickly', async () => {
  const prevCfgEnv = process.env.PANEL_CONFIG_FILE;
  const tmpCfg = path.resolve(`tmp-100k-panel-${Date.now()}.json`);
  process.env.PANEL_CONFIG_FILE = tmpCfg;

  const handlers = await loadMegaAndPro();
  const client = {
    config: { prefix: ['.'], phoneNumber: '201000000000', info: { nameBot: 'Light 100K' } },
    getAllCommands: () => handlers,
    errors: () => []
  };

  let server;
  try {
    server = startWebPanel(client, { port: 0, host: '127.0.0.1', password: 'pass-100k-verify' });
    await new Promise((r) => server.once('listening', r));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=pass-100k-verify',
      redirect: 'manual'
    });
    assert.equal(loginRes.status, 302);
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/api/commands?page=2&limit=24`, { headers: { Cookie: cookie } });
    const elapsed = Date.now() - t0;
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.total >= 100000);
    assert.equal(data.page, 2);
    assert.equal(data.limit, 24);
    assert.equal(data.commands.length, 24);
    assert.ok(data.totalPages > 4000);
    assert.ok(elapsed < 2000, `Expected fast response, took ${elapsed}ms`);
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
    }
    try { fs.rmSync(tmpCfg, { force: true }); } catch {}
    if (prevCfgEnv === undefined) delete process.env.PANEL_CONFIG_FILE;
    else process.env.PANEL_CONFIG_FILE = prevCfgEnv;
  }
});
