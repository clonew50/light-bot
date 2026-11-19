import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { simulateCommand } from '../system/simulator.js';

const CREATIVE_PACK_FILES = [
  'chronos_time_pack.js',
  'detective_mystery_pack.js',
  'empire_realm_pack.js',
  'mind_psych_pack.js',
  'cosmos_science_pack.js',
  'creator_studio_pack.js',
  'social_arena_pack.js',
  'survival_expedition_pack.js',
  'cyber_code_lab_pack.js',
  'life_finance_pack.js'
];

const TECHNICAL_NUMERIC_ALLOWLIST = new Set([
  'تشفير_روت13',
  'بصمة_sha512',
  'بصمة_blake2',
  'حاسبة_أذونات_chmod',
  'نسبة_قهوة_v60',
  'تعقيد_ثابت_o1',
  'تعقيد_تربيعي_on2',
  'مؤشر_الشمس_uv',
  'تحليل_mbti',
  'حزم_جديدة'
]);

async function loadCreativeHandlers() {
  const out = [];
  for (const file of CREATIVE_PACK_FILES) {
    const mod = await import(pathToFileURL(path.resolve('plugins/packs', file)).href);
    const list = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const handler of list) out.push({ file, handler });
  }
  return out;
}

test('Creative Packs: 1,000+ genuinely distinct new commands with zero numbered clones & zero collisions', async () => {
  const entries = await loadCreativeHandlers();
  assert.ok(entries.length >= 1000, `Expected >= 1000 new handlers, got ${entries.length}`);

  const newTriggers = new Map();
  for (const { file, handler } of entries) {
    assert.equal(typeof handler, 'function', `${file} handler must be callable`);
    const cmds = Array.isArray(handler.command) ? handler.command : [handler.command];
    assert.ok(cmds.length > 0 && cmds[0], `${file} handler missing command`);
    assert.ok(Array.isArray(handler.usage) && handler.usage.length > 0, `${file} handler ${cmds[0]} missing usage`);
    assert.ok(handler.category, `${file} handler ${cmds[0]} missing category`);
    assert.ok(handler.description, `${file} handler ${cmds[0]} missing description`);

    for (const c of cmds) {
      const k = String(c).toLowerCase();
      // Strictly forbid numbered clone patterns like cmd1, cmd2, وحش1, وحش2
      if (!TECHNICAL_NUMERIC_ALLOWLIST.has(k)) {
        assert.equal(/\d$/.test(k), false, `Trigger "${c}" in ${file} must not be a numbered clone`);
      }
      assert.equal(newTriggers.has(k), false, `Duplicate new trigger "${k}" in ${file} and ${newTriggers.get(k)}`);
      newTriggers.set(k, file);
    }
  }

  // Scan ALL prior plugins (both non-pack plugins and the 7 original pack files) in an isolated process
  const scanScript = `
    import fs from 'node:fs';
    import path from 'node:path';
    import { pathToFileURL } from 'node:url';
    const NEW_SET = new Set(${JSON.stringify(CREATIVE_PACK_FILES)});
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
    );
    const files = walk('plugins').filter((f) =>
      /\\.(js|mjs|cjs)$/.test(f) &&
      !f.endsWith(path.sep + 'agent.js') &&
      !NEW_SET.has(path.basename(f))
    );
    const out = [];
    for (const f of files) {
      const mod = await import(pathToFileURL(path.resolve(f)).href);
      const list = Array.isArray(mod.default) ? mod.default : mod.default ? [mod.default] : [];
      for (const h of list) {
        const cmds = Array.isArray(h?.command) ? h.command : h?.command ? [h.command] : [];
        for (const c of cmds) if (typeof c === 'string') out.push([c.toLowerCase(), f]);
      }
    }
    process.stdout.write('EXISTING_JSON:' + JSON.stringify(out));
    process.exit(0);
  `;
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', scanScript], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const marker = raw.lastIndexOf('EXISTING_JSON:');
  assert.ok(marker >= 0, 'Expected EXISTING_JSON marker');
  const existingMap = new Map(JSON.parse(raw.slice(marker + 'EXISTING_JSON:'.length)));

  for (const [k, file] of newTriggers) {
    assert.equal(
      existingMap.has(k),
      false,
      `New trigger "${k}" (${file}) collides with existing plugin (${existingMap.get(k)})`
    );
  }
});

test('Creative Packs: end-to-end simulation across all 10 packs (calculations, ciphers, DB state, polls, widgets)', async () => {
  global.db = { users: {}, groups: {} };
  const entries = await loadCreativeHandlers();
  const handlers = entries.map((e) => e.handler);
  const client = {
    config: { prefix: ['.'], phoneNumber: '201000000000', info: { nameBot: 'Light Test' } },
    getAllCommands: () => handlers
  };

  // 1. Chronos pack: time capsule DB flow + relativistic physics
  let r = await simulateCommand(client, '.كبسولة_زمن 0 | تذكير فوري');
  assert.equal(r.ok, true);
  r = await simulateCommand(client, '.كبسولاتي');
  assert.match(r.outputs[0].text, /CAP-/);
  r = await simulateCommand(client, '.فتح_كبسولتي');
  assert.match(r.outputs[0].text, /تذكير فوري/);
  r = await simulateCommand(client, '.تمدد_الزمن 80 5');
  assert.match(r.outputs[0].text, /8\.33 سنة/);

  // 2. Detective pack: solve case + real Caesar & Morse ciphers
  await simulateCommand(client, '.قضية_الغرفة_المغلقة');
  r = await simulateCommand(client, '.اتهام_مشتبه الرسام الزائر');
  assert.match(r.outputs[0].text, /تم حل القضية/);
  assert.ok(global.db.users['tester@s.whatsapp.net'].solvedCases.includes('قضية_الغرفة_المغلقة'));

  r = await simulateCommand(client, '.شفرة_يوليوس HELLO | 3');
  assert.match(r.outputs[0].text, /KHOOR/);
  r = await simulateCommand(client, '.تشفير_مورس_سري SOS');
  assert.match(r.outputs[0].text, /\.\.\. --- \.\.\./);
  r = await simulateCommand(client, '.فك_مورس_سري ... --- ...');
  assert.match(r.outputs[0].text, /SOS/);

  // 3. Empire realm pack: found kingdom, build mine, collect resources
  await simulateCommand(client, '.تأسيس_مملكة مملكة الشرق');
  await simulateCommand(client, '.بناء_منجم_ذهب');
  r = await simulateCommand(client, '.جمع_الموارد');
  assert.match(r.outputs[0].text, /\+105/);
  assert.equal(global.db.users['tester@s.whatsapp.net'].realm.buildings['منجم_ذهب'], 1);

  // 4. Mind & Psych pack: MBTI + Gratitude DB log
  r = await simulateCommand(client, '.تحليل_mbti INTJ');
  assert.match(r.outputs[0].text, /المخطط الاستراتيجي/);
  await simulateCommand(client, '.سجل_الامتنان نعمة الصحة والهدوء');
  assert.equal(global.db.users['tester@s.whatsapp.net'].gratitudeLog.length, 1);

  // 5. Cosmos & Science pack: Mars weight & DNA complement
  r = await simulateCommand(client, '.وزني_على_المريخ 100');
  assert.match(r.outputs[0].text, /37\.90 كجم/);
  r = await simulateCommand(client, '.مكمل_dna ATGC');
  assert.match(r.outputs[0].text, /TACG/);

  // 6. Creator Studio pack: Complementary hex & WCAG contrast
  r = await simulateCommand(client, '.لون_مكمل_سداسي #000000');
  assert.match(r.outputs[0].text, /#FFFFFF/);
  r = await simulateCommand(client, '.تباين_اللونين #FFFFFF | #000000');
  assert.match(r.outputs[0].text, /21\.00 : 1/);

  // 7. Social Arena pack: courtroom + team splitter
  r = await simulateCommand(client, '.تقسيم_فريقين علي، عمر، سارة، ندى');
  assert.match(r.outputs[0].text, /الفريق الأحمر/);
  assert.match(r.outputs[0].text, /الفريق الأزرق/);

  // 8. Survival Expedition pack: biome start + state actions
  await simulateCommand(client, '.رحلة_الصحراء_الكبرى');
  r = await simulateCommand(client, '.إشعال_نار');
  assert.equal(global.db.users['tester@s.whatsapp.net'].expedition.fireLit, true);
  assert.match(r.outputs[0].text, /اشتعلت النار/);

  // 9. Cyber Code Lab pack: CIDR + chmod + JWT
  r = await simulateCommand(client, '.حاسبة_الشبكة_cidr 24');
  assert.match(r.outputs[0].text, /254/);
  r = await simulateCommand(client, '.حاسبة_أذونات_chmod 755');
  assert.match(r.outputs[0].text, /-rwxr-xr-x/);
  r = await simulateCommand(client, '.فحص_رأس_jwt');
  assert.match(r.outputs[0].text, /Light/);

  // 10. Life & Finance pack: compound growth + showcase hub + poll + widget
  r = await simulateCommand(client, '.نمو_مركب 1000 10 2');
  assert.match(r.outputs[0].text, /1210\.00/);
  r = await simulateCommand(client, '.حزم_جديدة');
  assert.ok(r.outputs[0].buttons.some((b) => b.name === 'single_select'));

  r = await simulateCommand(client, '.استطلاع_وقت_الإنتاجية');
  assert.equal(r.outputs[0].type, 'poll');
  r = await simulateCommand(client, '.ودجت_العد_التنازلي');
  assert.equal(r.outputs[0].type, 'widget');
});
