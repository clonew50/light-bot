import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  progressBar,
  formatCard,
  makeQuickButton,
  makeCopyButton,
  makeUrlButton,
  makeSelectButton,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget
} from '../system/interactiveUI.js';
import { normalizeCommandsList, matchCommand, simulateCommand } from '../system/simulator.js';
import { startWebPanel } from '../system/webPanel.js';

const PACK_FILES = [
  'islamic_pack.js',
  'tools_dev_pack.js',
  'text_decor_pack.js',
  'games_fun_pack.js',
  'knowledge_edu_pack.js',
  'economy_social_pack.js',
  'interactive_admin_pack.js',
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

async function loadAllPackHandlers() {
  const all = [];
  for (const f of PACK_FILES) {
    const mod = await import(pathToFileURL(path.resolve('plugins/packs', f)).href);
    const list = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const h of list) all.push({ file: f, handler: h });
  }
  return all;
}

test('Command packs: load 1,000+ valid handlers with zero trigger collisions', async () => {
  const packs = await loadAllPackHandlers();
  assert.ok(packs.length >= 1000, `Expected >= 1000 new command handlers, got ${packs.length}`);

  const packTriggers = new Map();
  for (const { file, handler } of packs) {
    assert.equal(typeof handler, 'function', `${file} handler must be callable`);
    const cmds = Array.isArray(handler.command) ? handler.command : [handler.command];
    assert.ok(cmds.length > 0 && cmds[0], `${file} handler missing command trigger`);
    assert.ok(handler.category, `${file} handler ${cmds[0]} missing category`);
    assert.ok(handler.description, `${file} handler ${cmds[0]} missing description`);

    for (const c of cmds) {
      const k = String(c).toLowerCase();
      assert.equal(packTriggers.has(k), false, `Duplicate pack trigger "${k}" in ${file} and ${packTriggers.get(k)}`);
      packTriggers.set(k, file);
    }
  }

  // Check zero collisions against existing non-pack plugins in an isolated child process
  // so legacy plugins with top-level timers/listeners never leak handles into node:test.
  const scanScript = `
    import fs from 'node:fs';
    import path from 'node:path';
    import { pathToFileURL } from 'node:url';
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
    );
    const files = walk('plugins').filter((f) => /\\.(js|mjs|cjs)$/.test(f) && !f.includes(path.sep + 'packs' + path.sep) && !f.endsWith(path.sep + 'agent.js'));
    const out = [];
    for (const f of files) {
      const mod = await import(pathToFileURL(path.resolve(f)).href);
      const list = Array.isArray(mod.default) ? mod.default : mod.default ? [mod.default] : [];
      for (const h of list) {
        const cmds = Array.isArray(h?.command) ? h.command : h?.command ? [h.command] : [];
        for (const c of cmds) if (typeof c === 'string') out.push(c.toLowerCase());
      }
    }
    process.stdout.write('TRIGGERS_JSON:' + JSON.stringify(out));
    process.exit(0);
  `;
  const rawOut = execFileSync(process.execPath, ['--input-type=module', '-e', scanScript], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const markerIdx = rawOut.lastIndexOf('TRIGGERS_JSON:');
  assert.ok(markerIdx >= 0, 'Expected TRIGGERS_JSON marker from plugin scan');
  const existingTriggers = new Set(JSON.parse(rawOut.slice(markerIdx + 'TRIGGERS_JSON:'.length)));
  for (const [k, file] of packTriggers) {
    assert.equal(existingTriggers.has(k), false, `Pack trigger "${k}" (${file}) collides with existing plugin`);
  }
});

test('interactiveUI: progressBar, formatCard, button builders, and send fallbacks', async () => {
  assert.match(progressBar(50, 100, 10), /50%/);
  assert.match(progressBar(150, 100, 10), /100%/);
  assert.match(progressBar(-10, 100, 10), /0%/);

  const card = formatCard({
    title: 'عنوان تجريبي',
    subtitle: 'وصف فرعي',
    badge: '✨',
    body: 'محتوى البطاقة',
    fields: [{ label: 'الحالة', value: 'ممتاز' }],
    tip: 'نصيحة مفيدة',
    theme: 'royal'
  });
  assert.match(card, /عنوان تجريبي/);
  assert.match(card, /محتوى البطاقة/);
  assert.match(card, /الحالة:\* ممتاز/);
  assert.match(card, /نصيحة مفيدة/);

  const qb = makeQuickButton('تشغيل', 'حظي', '.');
  assert.equal(qb.name, 'quick_reply');
  assert.equal(qb.params.id, '.حظي');
  assert.equal(makeCopyButton('نسخ', 'ABC').params.copy_code, 'ABC');
  assert.equal(makeUrlButton('فتح', 'https://example.com').params.url, 'https://example.com');
  assert.equal(makeSelectButton('قائمة', []).name, 'single_select');

  // Native sendButtonNormal capture
  const sentButtons = [];
  const connNormal = {
    config: { prefix: '.' },
    sendButtonNormal: async (_chat, payload) => {
      sentButtons.push(payload);
      return { ok: true };
    }
  };
  await sendInteractiveCard(
    { chat: 'c@s.whatsapp.net', sender: 'u@s.whatsapp.net' },
    { conn: connNormal },
    { title: 'بطاقة', body: 'تجربة', buttons: [{ label: 'حظي', id: 'حظي' }, { label: 'نسخ', copy: 'XYZ' }] }
  );
  assert.equal(sentButtons.length, 1);
  assert.equal(sentButtons[0].buttons.length, 2);

  // Graceful fallback to plain text message when sendButtonNormal throws
  const fallbackMsgs = [];
  const connFallback = {
    config: { prefix: '.' },
    sendButtonNormal: async () => { throw new Error('not supported'); },
    sendMessage: async (_chat, payload) => { fallbackMsgs.push(payload); return {}; }
  };
  await sendInteractiveCard(
    { chat: 'c@s.whatsapp.net', sender: 'u@s.whatsapp.net' },
    { conn: connFallback },
    { title: 'تجربة تراجع', body: 'نص', buttons: [{ label: 'حظي', id: 'حظي' }] }
  );
  assert.equal(fallbackMsgs.length, 1);
  assert.match(fallbackMsgs[0].text, /\.حظي/);

  // Poll & Widget relayMessage encoding
  const relayed = [];
  const pollSent = [];
  const connRich = {
    sendMessage: async (_chat, payload) => { pollSent.push(payload); },
    relayMessage: async (_chat, payload) => { relayed.push(payload); },
    generateMessageTag: async () => 'TAG1'
  };
  await sendInteractivePoll({ chat: 'c@s.whatsapp.net' }, { conn: connRich }, { name: 'سؤال؟', values: ['أ', 'ب'] });
  assert.equal(pollSent[0].poll.name, 'سؤال؟');
  assert.deepEqual(pollSent[0].poll.values, ['أ', 'ب']);

  await sendInteractiveWidget({ chat: 'c@s.whatsapp.net' }, { sock: connRich }, { title: 'T', html: '<h1>Hi</h1>' });
  const b64 = relayed[0].botForwardedMessage.message.richResponseMessage.unifiedResponse.data;
  const decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  assert.equal(decoded.embedded_screens[0].content[0].tabs[0].sections[0].view_model.primitive.payload, '<h1>Hi</h1>');
});

test('Simulator: executes commands across all 7 packs and persists DB rewards', async () => {
  global.db = { users: {}, groups: {} };
  const packs = await loadAllPackHandlers();
  const handlers = packs.map((p) => p.handler);
  const client = {
    config: { prefix: ['.'], phoneNumber: '201000000000', info: { nameBot: 'Light Test' } },
    getAllCommands: () => handlers
  };

  const list = normalizeCommandsList(client);
  assert.equal(list.length, handlers.length);
  assert.ok(matchCommand(handlers, 'سورة_الكهف'));
  assert.equal(matchCommand(handlers, 'does_not_exist_123'), null);

  const sampleCommands = [
    '.سورة_الكهف',
    '.اذكار_الصباح',
    '.سبحة',
    '.حصاد_الذكر',
    '.كم_لميل 10',
    '.مؤشر_الكتلة 70 175',
    '.توليد_توكين',
    '.خط_عريض Light',
    '.زخرفة1 لايت',
    '.برج_الأسد',
    '.تحقق_لعبة لغز1 | الصوت',
    '.مغامرة',
    '.دولة_مصر',
    '.عنصر_ذهب',
    '.دليل_js',
    '.مكافأة_ساعة',
    '.وظيفة_مبرمج',
    '.محفظتي',
    '.تصويت_سريع',
    '.بطاقتي',
    '.معاينة_كاروسيل',
    '.بحث_امر سورة',
    '.تصفح'
  ];

  for (const cmd of sampleCommands) {
    const res = await simulateCommand(client, cmd);
    assert.equal(res.ok, true, `Expected ${cmd} to succeed, got error: ${res.error}`);
    assert.ok(res.outputs.length >= 1, `Expected ${cmd} to produce at least 1 output`);
  }

  // Verify DB persistence from .سبحة, .تحقق_لعبة, .مغامرة, .مكافأة_ساعة, .وظيفة_مبرمج
  const user = global.db.users['tester@s.whatsapp.net'];
  assert.ok(user, 'Tester DB record should exist');
  assert.ok(user.tasbeehCount >= 1, 'Expected .سبحة to increment tasbeehCount');
  assert.ok(user.money > 0, 'Expected economy/game commands to award coins');
  assert.ok(user.exp > 0, 'Expected economy/game commands to award XP');

  // Specific output types
  const pollRes = await simulateCommand(client, '.تصويت_سريع');
  assert.equal(pollRes.outputs[0].type, 'poll');
  assert.ok(pollRes.outputs[0].values.length >= 2);

  const widgetRes = await simulateCommand(client, '.بطاقتي');
  assert.equal(widgetRes.outputs[0].type, 'widget');
  assert.match(widgetRes.outputs[0].html, /البطاقة الشخصية/);

  const carRes = await simulateCommand(client, '.معاينة_كاروسيل');
  assert.equal(carRes.outputs[0].type, 'carousel');
  assert.ok(carRes.outputs[0].cards.length >= 3);
});

test('webPanel: inline script parses cleanly + /api/commands & /api/simulate work with auth', async () => {
  const prevCfgEnv = process.env.PANEL_CONFIG_FILE;
  const tmpCfg = path.resolve(`tmp-panel-${Date.now()}.json`);
  process.env.PANEL_CONFIG_FILE = tmpCfg;

  const packs = await loadAllPackHandlers();
  const handlers = packs.map((p) => p.handler);
  const client = {
    config: { prefix: ['.'], phoneNumber: '201000000000', info: { nameBot: 'Light Test' } },
    getAllCommands: () => handlers,
    errors: () => []
  };

  let server;
  try {
    server = startWebPanel(client, { port: 0, host: '127.0.0.1', password: 'test-password-1234' });
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Unauthenticated API calls must return 401
    const unauthCmds = await fetch(`${baseUrl}/api/commands`);
    assert.equal(unauthCmds.status, 401);
    const unauthSim = await fetch(`${baseUrl}/api/simulate`, { method: 'POST', body: JSON.stringify({ input: '.سبحة' }) });
    assert.equal(unauthSim.status, 401);

    // Authenticate via /login
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=test-password-1234',
      redirect: 'manual'
    });
    assert.equal(loginRes.status, 302);
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
    assert.match(cookie, /^pw=/);

    // Fetch authenticated HTML and validate inline <script> syntax!
    const htmlRes = await fetch(`${baseUrl}/`, { headers: { Cookie: cookie } });
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'PANEL_HTML must contain an inline <script>');
    assert.doesNotThrow(() => new Function(scriptMatch[1]), 'Inline PANEL_HTML script must be valid JS');

    // GET /api/commands with filter
    const cmdsRes = await fetch(`${baseUrl}/api/commands?q=${encodeURIComponent('زخرفة')}`, { headers: { Cookie: cookie } });
    assert.equal(cmdsRes.status, 200);
    const cmdsJson = await cmdsRes.json();
    assert.equal(cmdsJson.ok, true);
    assert.ok(cmdsJson.total >= 1000);
    assert.ok(cmdsJson.filtered >= 35);
    assert.ok(cmdsJson.categories.length >= 5);

    // POST /api/simulate
    const simRes = await fetch(`${baseUrl}/api/simulate`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '.كم_لميل 10' })
    });
    assert.equal(simRes.status, 200);
    const simJson = await simRes.json();
    assert.equal(simJson.ok, true);
    assert.match(simJson.outputs[0].text, /6\.21/);
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
