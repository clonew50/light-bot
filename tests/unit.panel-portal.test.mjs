import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Client } from 'meowsab';

import { renderPublicPortalHtml, ADMIN_PANEL_HTML } from '../system/panelViews.js';
import { startWebPanel } from '../system/webPanel.js';
import { buildConfig } from '../system/config.js';
import {
  normalizePhone,
  generateControlCode,
  resetStoreCacheForTests,
  ensureSubBotRecord,
  verifySubBotAccess,
  updateSubBotSettings,
  updateMainBotSettings,
  applyMainBotSettingsOnBoot,
  getMainBotSettings,
  syncConnectedBotOwner,
  syncSubBotSelfOwner
} from '../system/botRegistry.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'light-panel-test-'));
}

function makeMockSubBots() {
  const emitter = new EventEmitter();
  const bots = new Map();
  let seq = 0;

  return Object.assign(emitter, {
    async add(phone) {
      seq += 1;
      const id = `sub-${seq}`;
      const pairCode = `PAIR${String(seq).padStart(4, '0')}`;
      const bot = {
        id,
        phoneNumber: phone,
        phone,
        index: seq,
        connected: false,
        msgCount: 0,
        config: { prefix: ['.'], info: { nameBot: 'Sub' } }
      };
      bots.set(id, bot);
      setTimeout(() => emitter.emit('pair', id, pairCode), 30);
      return id;
    },
    get(id) {
      return bots.get(id) || null;
    },
    getByPhone(phone) {
      for (const b of bots.values()) if (b.phoneNumber === phone) return b;
      return null;
    },
    list() {
      return [...bots.values()].map((b) => ({
        id: b.id,
        phone: b.phoneNumber,
        index: b.index,
        connected: b.connected,
        messages: b.msgCount,
        name: b.config?.info?.nameBot || ''
      }));
    },
    stats() {
      const all = [...bots.values()];
      return {
        total: all.length,
        connected: all.filter((b) => b.connected).length,
        disconnected: all.filter((b) => !b.connected).length,
        totalMessages: all.reduce((a, b) => a + b.msgCount, 0)
      };
    },
    async remove(id) {
      return bots.delete(id);
    },
    async removeByPhone(phone) {
      for (const [k, v] of bots.entries()) {
        if (v.phoneNumber === phone) return bots.delete(k);
      }
      return false;
    }
  });
}

test('panelViews: both public portal and admin panel inline scripts are syntactically valid JS', () => {
  const pubHtml = renderPublicPortalHtml('اختبار خطأ');
  const pubScript = pubHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(pubScript, 'Public portal HTML must have inline <script>');
  assert.doesNotThrow(() => new Function(pubScript[1]), 'Public portal inline JS must parse cleanly');

  const admScript = ADMIN_PANEL_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(admScript, 'Admin panel HTML must have inline <script>');
  assert.doesNotThrow(() => new Function(admScript[1]), 'Admin panel inline JS must parse cleanly');
});

test('botRegistry: generates control codes, verifies access, and persists settings atomically', () => {
  const dir = makeTempDir();
  const prevState = process.env.BOTS_STATE_FILE;
  process.env.BOTS_STATE_FILE = path.join(dir, 'bots-state.json');
  resetStoreCacheForTests();

  try {
    assert.equal(normalizePhone('+20 101-234-5678'), '201012345678');
    assert.equal(normalizePhone('123'), '');
    assert.match(generateControlCode(), /^LB-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const rec = ensureSubBotRecord('201012345678');
    assert.ok(rec.controlCode.startsWith('LB-'));
    assert.equal(verifySubBotAccess('201012345678', rec.controlCode).ok, true);
    assert.equal(verifySubBotAccess('201012345678', 'WRONG-CODE').ok, false);

    updateSubBotSettings('201012345678', {
      mode: 'private',
      customName: 'بوت خاص',
      prefix: '!',
      welcome: false,
      paused: true
    });

    const mockClient = { config: { prefix: ['.'], info: { nameBot: 'Original' }, fromMe: false, autoRead: false } };
    updateMainBotSettings(mockClient, {
      nameBot: 'لايت المحدث',
      prefix: '. / #',
      allowPublicWebPair: false,
      maintenance: true
    });

    // Clear in-memory cache and re-read from disk
    resetStoreCacheForTests();
    const check = verifySubBotAccess('201012345678', rec.controlCode);
    assert.equal(check.ok, true);
    assert.equal(check.record.settings.mode, 'private');
    assert.equal(check.record.settings.customName, 'بوت خاص');
    assert.equal(check.record.settings.prefix, '!');
    assert.equal(check.record.settings.welcome, false);
    assert.equal(check.record.settings.paused, true);

    const ms = getMainBotSettings({ config: { prefix: ['.'], info: { nameBot: 'Original' } } });
    assert.equal(ms.allowPublicWebPair, false);
    assert.equal(mockClient.config.info.nameBot, 'لايت المحدث');
    assert.deepEqual(mockClient.config.prefix, ['.', '/', '#']);
  } finally {
    resetStoreCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    if (prevState === undefined) delete process.env.BOTS_STATE_FILE;
    else process.env.BOTS_STATE_FILE = prevState;
  }
});

test('webPanel public portal & admin fleet routes end-to-end HTTP workflow', async () => {
  const dir = makeTempDir();
  const prevCfg = process.env.PANEL_CONFIG_FILE;
  const prevState = process.env.BOTS_STATE_FILE;
  const prevSubBots = global.subBots;
  const prevDb = global.db;

  const cfgPath = path.join(dir, 'panel-config.json');
  const statePath = path.join(dir, 'bots-state.json');
  process.env.PANEL_CONFIG_FILE = cfgPath;
  process.env.BOTS_STATE_FILE = statePath;
  resetStoreCacheForTests();
  global.db = { users: {}, groups: {}, subPairAllow: {} };
  global.subBots = makeMockSubBots();

  const client = {
    config: { prefix: ['.'], phoneNumber: '201099999999', info: { nameBot: 'Light Core' }, owners: [{ name: 'Owner', jid: '201099999999@s.whatsapp.net' }] },
    getAllCommands: () => [],
    errors: () => []
  };

  let server;
  try {
    server = startWebPanel(client, { port: 0, host: '127.0.0.1' });
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Random password generated in panel-config.json (0600)
    const diskCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.ok(diskCfg.password && diskCfg.password.length >= 16);

    // 2. Unauthenticated GET / shows default public WhatsApp pairing screen (no admin panel content)
    const pubRes = await fetch(`${baseUrl}/`);
    assert.equal(pubRes.status, 200);
    const pubHtml = await pubRes.text();
    assert.match(pubHtml, /ربط حسابك على واتساب/);
    assert.equal(pubHtml.includes('tab-fleet'), false, 'Admin fleet DOM must not be served unauthenticated');
    assert.equal(pubHtml.includes(diskCfg.password), false, 'Random admin password must never appear in public HTML');

    // 3. Unauthenticated /api/public/sub/me returns 200 authenticated:false (zero browser console errors), while mutations & admin endpoints reject with 401
    const unauthMe = await fetch(`${baseUrl}/api/public/sub/me`);
    assert.equal(unauthMe.status, 200);
    assert.equal((await unauthMe.json()).authenticated, false);
    assert.equal((await fetch(`${baseUrl}/api/public/sub/settings`, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/admin/bots`)).status, 401);

    // 4. User pairs WhatsApp account on default landing screen -> gets pairCode, saved controlCode, and sub_tok cookie
    const pairRes = await fetch(`${baseUrl}/api/public/sub/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '201122334455' })
    });
    assert.equal(pairRes.status, 200);
    const pairSetCookie = pairRes.headers.get('set-cookie') || '';
    assert.match(pairSetCookie, /sub_tok=/);
    assert.match(pairSetCookie, /SameSite=Strict/);
    const subCookie = pairSetCookie.split(';')[0];

    const pairJson = await pairRes.json();
    assert.equal(pairJson.ok, true);
    assert.equal(pairJson.pairCode, 'PAIR0001');
    assert.match(pairJson.controlCode, /^LB-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // 5. User updates their own bot settings using sub_tok cookie
    const updRes = await fetch(`${baseUrl}/api/public/sub/settings`, {
      method: 'POST',
      headers: { Cookie: subCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'private', customName: 'بوتي الذكي', prefix: '!', paused: false })
    });
    assert.equal(updRes.status, 200);
    const updJson = await updRes.json();
    assert.equal(updJson.bot.settings.mode, 'private');
    assert.equal(updJson.bot.settings.customName, 'بوتي الذكي');
    assert.equal(updJson.bot.settings.prefix, '!');

    // 6. Returning user unlocks bot using saved controlCode (without cookie)
    const authRes = await fetch(`${baseUrl}/api/public/sub/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '201122334455', code: pairJson.controlCode })
    });
    assert.equal(authRes.status, 200);
    const authJson = await authRes.json();
    assert.equal(authJson.ok, true);
    assert.equal(authJson.bot.settings.customName, 'بوتي الذكي');

    // 7. Admin logs in using random password from panel-config.json
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(diskCfg.password)}`,
      redirect: 'manual'
    });
    assert.equal(loginRes.status, 302);
    const adminCookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
    assert.match(adminCookie, /^pw=/);

    // 8. Admin GET / renders Status Dashboard + Fleet panel
    const admHtmlRes = await fetch(`${baseUrl}/`, { headers: { Cookie: adminCookie } });
    assert.equal(admHtmlRes.status, 200);
    const admHtml = await admHtmlRes.text();
    assert.match(admHtml, /لوحة الحالة التفصيلية/);
    assert.match(admHtml, /إدارة البوتات/);

    // 9. Admin inspects all bots via /api/admin/bots and updates main + sub bot settings
    const fleetRes = await fetch(`${baseUrl}/api/admin/bots`, { headers: { Cookie: adminCookie } });
    assert.equal(fleetRes.status, 200);
    const fleet = await fleetRes.json();
    assert.equal(fleet.stats.totalSubs, 1);
    assert.equal(fleet.subBots[0].phone, '201122334455');
    assert.equal(fleet.subBots[0].controlCode, pairJson.controlCode);

    const msRes = await fetch(`${baseUrl}/api/admin/main-settings`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameBot: 'Light Admin Edited', prefix: '. $', maintenance: false, fromMeMode: 'both' })
    });
    assert.equal(msRes.status, 200);
    const msJson = await msRes.json();
    assert.equal(msJson.settings.nameBot, 'Light Admin Edited');
    assert.equal(msJson.settings.fromMe, null);
    assert.equal(msJson.settings.fromMeMode, 'both');

    const ctrlRes = await fetch(`${baseUrl}/api/admin/bot-control`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', phone: '201122334455' })
    });
    assert.equal(ctrlRes.status, 200);
    assert.equal((await ctrlRes.json()).bot.settings.paused, true);

    // 10. Admin rotates random password -> new password works & old admin cookie is invalidated
    const rotRes = await fetch(`${baseUrl}/api/admin/rotate-password`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'random' })
    });
    assert.equal(rotRes.status, 200);
    const rotJson = await rotRes.json();
    assert.ok(rotJson.password && rotJson.password !== diskCfg.password);

    // Old adminCookie now has stale rev -> 401
    const staleStatus = await fetch(`${baseUrl}/api/admin/bots`, { headers: { Cookie: adminCookie } });
    assert.equal(staleStatus.status, 401);

    // New rotated password works cleanly
    const relogin = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: rotJson.password }),
      redirect: 'manual'
    });
    assert.equal(relogin.status, 302);
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
    }
    resetStoreCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    if (prevCfg === undefined) delete process.env.PANEL_CONFIG_FILE;
    else process.env.PANEL_CONFIG_FILE = prevCfg;
    if (prevState === undefined) delete process.env.BOTS_STATE_FILE;
    else process.env.BOTS_STATE_FILE = prevState;
    global.subBots = prevSubBots;
    global.db = prevDb;
  }
});

test('connected-number self-commands: buildConfig default, legacy migration, owner sync, and meowsab pipeline', async () => {
  const dir = makeTempDir();
  const statePath = path.join(dir, 'bots-state.json');
  const prevState = process.env.BOTS_STATE_FILE;
  process.env.BOTS_STATE_FILE = statePath;
  resetStoreCacheForTests();

  try {
    // 1. buildConfig defaults to fromMe: null so connected number + others can both run commands
    const cfg = buildConfig({});
    assert.equal(cfg.fromMe, null);

    // 2. Legacy bots-state.json with fromMe:false (pre-fromMeModeV2) migrates cleanly to null / 'both'
    fs.writeFileSync(statePath, JSON.stringify({
      subBots: {},
      mainBot: { nameBot: 'Legacy Bot', prefix: ['.'], fromMe: false }
    }));
    const msMigrated = getMainBotSettings({ config: { ...cfg } });
    assert.equal(msMigrated.fromMe, null);
    assert.equal(msMigrated.fromMeMode, 'both');

    // 3. Explicit 3-mode persistence ('others' -> false, 'self' -> true, 'both' -> null)
    const fakeClient = { config: { ...cfg, info: { ...cfg.info } }, sock: { user: { id: '201055566677:12@s.whatsapp.net', lid: '99887766:1@lid', name: 'Main Phone' } } };
    updateMainBotSettings(fakeClient, { fromMeMode: 'others' });
    assert.equal(fakeClient.config.fromMe, false);
    updateMainBotSettings(fakeClient, { fromMeMode: 'self' });
    assert.equal(fakeClient.config.fromMe, true);
    updateMainBotSettings(fakeClient, { fromMeMode: 'both' });
    assert.equal(fakeClient.config.fromMe, null);

    applyMainBotSettingsOnBoot(fakeClient);
    assert.equal(fakeClient.config.fromMe, null);

    // 4. Owner sync adds connected JID/LID cleanly without duplicates for both Main Bot and SubBot
    assert.equal(syncConnectedBotOwner(fakeClient), true);
    assert.equal(syncConnectedBotOwner(fakeClient), true);
    const matches = fakeClient.config.owners.filter((o) => o.jid === '201055566677@s.whatsapp.net');
    assert.equal(matches.length, 1);

    const fakeSub = {
      cfg: { owners: [], fromMe: undefined },
      sock: { user: { id: '201144455566:5@s.whatsapp.net', lid: '11223344@lid', name: 'Sub Phone' } }
    };
    assert.equal(syncSubBotSelfOwner(fakeSub, fakeSub.sock), true);
    assert.equal(fakeSub.cfg.fromMe, null);
    assert.equal(fakeSub.cfg.owners.some((o) => o.jid === '201144455566@s.whatsapp.net'), true);

    // 5. Real meowsab Client message processing pipeline allows self-sent non-3EB0 & other-user commands, ignores 3EB0 replies
    const { Utils } = await import('meowsab');
    const prevKc1 = Utils.keyCore1;
    const prevKc2 = Utils.keyCore2;
    const prevKm = Utils.keysMessagesObjWA;
    Utils.keyCore1 = async () => [];
    Utils.keyCore2 = async () => [];
    Utils.keysMessagesObjWA = async () => [];

    const createdTimers = [];
    const origSetInterval = globalThis.setInterval;
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setInterval = (...a) => {
      const t = origSetInterval(...a);
      t?.unref?.();
      createdTimers.push({ type: 'interval', t });
      return t;
    };
    globalThis.setTimeout = (...a) => {
      const t = origSetTimeout(...a);
      t?.unref?.();
      createdTimers.push({ type: 'timeout', t });
      return t;
    };

    const testClient = new Client({
      ...cfg,
      commandsPath: './system/__nonexistent_cmds_dir__',
      autoReconnect: false,
      showLogs: false
    });
    const mockSock = {
      user: { id: '201055566677:2@s.whatsapp.net', name: 'ConnectedSelf' },
      ws: { close() {} },
      ev: new EventEmitter(),
      sendMessage: async () => ({}),
      readMessages: async () => ({})
    };
    testClient.sock = mockSock;
    syncConnectedBotOwner(testClient);
    testClient.commandSystem.before((m, ctx) => {
      if (m?.fromMe && testClient.sock?.user?.id) {
        syncConnectedBotOwner(testClient);
        m.isOwner = true;
        if (ctx && typeof ctx === 'object') ctx.isOwner = true;
      }
      return false;
    });

    const executions = [];
    testClient.registerCommand({
      command: ['pingtest'],
      ownerOnly: true,
      execute: async (m, ctx) => {
        executions.push({ fromMe: m.fromMe, isOwner: ctx.isOwner, id: m.id, sender: m.sender });
      }
    });
    testClient.setup(async () => {}, false);

    globalThis.setInterval = origSetInterval;
    globalThis.setTimeout = origSetTimeout;

    const nowSec = Math.floor(Date.now() / 1000);
    // 5a: Command typed from the connected phone itself (non-3EB0 ID, fromMe: true)
    mockSock.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: '3AA112233445566Self', remoteJid: '201055566677@s.whatsapp.net', fromMe: true },
        message: { conversation: '.pingtest' },
        messageTimestamp: nowSec,
        pushName: 'ConnectedSelf'
      }]
    });
    // 5b: Bot's own Baileys-generated message (ID starts with 3EB0, fromMe: true) -> must be ignored to prevent loops
    mockSock.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: '3EB0LOOPPREVENT123', remoteJid: '201055566677@s.whatsapp.net', fromMe: true },
        message: { conversation: '.pingtest' },
        messageTimestamp: nowSec
      }]
    });
    // 5c: Message from another owner (fromMe: false) -> still executes
    mockSock.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: '3AA9988776655Other', remoteJid: '201505362172@s.whatsapp.net', fromMe: false },
        message: { conversation: '.pingtest' },
        messageTimestamp: nowSec,
        pushName: 'OtherOwner'
      }]
    });

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(executions.length, 2, 'Expected self-sent command and other-user command to execute, while 3EB0 reply is ignored');
    assert.equal(executions[0].id, '3AA112233445566Self');
    assert.equal(executions[0].fromMe, true);
    assert.equal(executions[0].isOwner, true);
    assert.equal(executions[1].id, '3AA9988776655Other');
    assert.equal(executions[1].fromMe, false);

    for (const item of createdTimers) {
      if (item.type === 'interval') clearInterval(item.t);
      else clearTimeout(item.t);
    }
    Utils.keyCore1 = prevKc1;
    Utils.keyCore2 = prevKc2;
    Utils.keysMessagesObjWA = prevKm;
    try { await testClient.cleanup(); } catch {}
  } finally {
    resetStoreCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    if (prevState === undefined) delete process.env.BOTS_STATE_FILE;
    else process.env.BOTS_STATE_FILE = prevState;
  }
});

