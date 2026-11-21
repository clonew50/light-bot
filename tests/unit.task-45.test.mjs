import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const {
  sanitizePhone,
  generateMainPairCode,
  isSessionRegistered,
  backupUnregisteredSession,
  installMainBotConnectionFix,
  requestMainBotPairing,
} = await import(pathToFileURL(path.join(repoRoot, 'system', 'mainBotFix.js')).href);
const { isSocketOpen, isAlive, markOpen } = await import(pathToFileURL(path.join(repoRoot, 'system', 'liveness.js')).href);

test('liveness: recognizes Baileys v7 WebSocketClient shape (ws.isOpen + ws.socket.readyState) as open', () => {
  const baileysV7Client = {
    sock: {
      user: { id: '201012345678@s.whatsapp.net' },
      ws: { isOpen: true, socket: { readyState: 1 } },
    },
  };
  assert.equal(isSocketOpen(baileysV7Client), true);
  markOpen(baileysV7Client, Date.now(), baileysV7Client.sock);
  assert.equal(isAlive(baileysV7Client, Date.now()), true);

  baileysV7Client.sock.ws.isOpen = false;
  baileysV7Client.sock.ws.socket.readyState = 3;
  assert.equal(isSocketOpen(baileysV7Client), false);
  assert.equal(isAlive(baileysV7Client, Date.now()), false);
});

test('mainBotFix: sanitizePhone normalizes JIDs, + prefixes, and rejects invalid inputs', () => {
  assert.equal(sanitizePhone('+20 10-1234-5678'), '201012345678');
  assert.equal(sanitizePhone('201505362172:14@s.whatsapp.net'), '201505362172');
  assert.equal(sanitizePhone('123'), '');
  assert.equal(sanitizePhone(''), '');
});

test('mainBotFix: generateMainPairCode returns 8-char alphanumeric code distinct from VENI1234', () => {
  const code = generateMainPairCode();
  assert.match(code, /^[A-Z0-9]{8}$/);
  assert.notEqual(code, 'VENI1234');
});

test('mainBotFix: backupUnregisteredSession protects registered sessions and archives unregistered ones', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mainfix-sess-'));
  try {
    const regDir = path.join(tmp, 'session-reg');
    fs.mkdirSync(regDir, { recursive: true });
    fs.writeFileSync(path.join(regDir, 'creds.json'), JSON.stringify({ registered: true, me: { id: '2010@s.whatsapp.net' } }));
    assert.equal(isSessionRegistered(regDir), true);
    const keepRes = backupUnregisteredSession(regDir);
    assert.deepEqual(keepRes, { moved: false, reason: 'registered' });
    assert.equal(fs.existsSync(regDir), true);

    const unregDir = path.join(tmp, 'session-unreg');
    fs.mkdirSync(unregDir, { recursive: true });
    fs.writeFileSync(path.join(unregDir, 'creds.json'), JSON.stringify({ registered: false }));
    assert.equal(isSessionRegistered(unregDir), false);
    const movRes = backupUnregisteredSession(unregDir);
    assert.equal(movRes.moved, true);
    assert.ok(path.basename(movRes.backupPath).startsWith('session-unreg.bak-'));
    assert.equal(fs.existsSync(unregDir), false);
    assert.equal(fs.existsSync(path.join(movRes.backupPath, 'creds.json')), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('mainBotFix: initializes reconnectAttempts, resets running=false on close, promotes force=true on dead sock, and pairs safely', async () => {
  const events = [];
  const paired = [];
  let startForces = [];
  let currentSock = null;

  const client = {
    config: { printQR: false, phoneNumber: '+201012345678' },
    running: true,
    reconnectTimeout: null,
    get sock() { return currentSock; },
    set sock(v) { currentSock = v; },
    async start(force = false) {
      startForces.push(force);
      return true;
    },
    async stop() {
      this.running = false;
    },
  };

  installMainBotConnectionFix(client, {
    onPairingCode: (code, phone) => paired.push({ code, phone }),
    onEvent: (kind, text) => events.push({ kind, text }),
  });

  assert.equal(client.reconnectAttempts, 0);
  assert.equal(client.config.phoneNumber, '201012345678');

  // Attach a fake socket with readyState 3 (dead) -> start() must auto-promote force=true
  const deadEv = new EventEmitter();
  client.sock = {
    ws: { readyState: 3 },
    ev: deadEv,
    authState: { creds: { registered: false } },
    async requestPairingCode() { return 'DEAD0000'; },
  };
  await client.start(false);
  assert.equal(startForces[0], true, 'dead sock with running=true must force start');

  // Close event must reset client.running to false
  deadEv.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 408 }, message: 'QR refs attempts ended' } },
  });
  assert.equal(client.running, false);

  // Live socket: pairing wrapper issues single code and notifies onPairingCode
  let reqCount = 0;
  const liveEv = new EventEmitter();
  const liveSock = {
    ws: { readyState: 1 },
    ev: liveEv,
    authState: { creds: { registered: false } },
    async requestPairingCode(phone, custom) {
      reqCount += 1;
      assert.equal(phone, '201012345678');
      assert.notEqual(custom, 'VENI1234');
      return custom;
    },
  };
  client.sock = liveSock;

  const [c1, c2] = await Promise.all([
    liveSock.requestPairingCode('201012345678', 'VENI1234'),
    liveSock.requestPairingCode('201012345678'),
  ]);
  assert.equal(reqCount, 1, 'concurrent requestPairingCode calls must coalesce into one network request');
  assert.equal(c1, c2);
  assert.match(c1, /^[A-Z0-9]{8}$/);
  assert.equal(paired.length, 1);
  assert.equal(paired[0].code, c1);

  client.__mainBotFixHandle.stop();
});

test('webPanel: qr update does not clobber active pairingCode in code mode; pair-main validates and issues code in-process', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'task45-panel-'));
  const prevCfg = process.env.PANEL_CONFIG_FILE;
  process.env.PANEL_CONFIG_FILE = path.join(scratch, 'panel-config.json');
  fs.writeFileSync(
    process.env.PANEL_CONFIG_FILE,
    JSON.stringify({ password: 'test-panel-password', loginMode: 'code', phone: '201099887766', secret: 'abc'.repeat(21) }),
    { mode: 0o600 }
  );

  try {
    const panel = await import(pathToFileURL(path.join(repoRoot, 'system', 'webPanel.js')).href + `?t=${Date.now()}`);
    let sock = null;
    const mockClient = {
      config: { sessionPath: path.join(scratch, 'session'), printQR: false, phoneNumber: '201099887766' },
      running: false,
      get sock() { return sock; },
      set sock(v) { sock = v; },
      getAllCommands: () => [],
      errors: () => [],
      async stop() { this.running = false; },
      async start() {
        const ev = new EventEmitter();
        const s = {
          ws: { readyState: 1 },
          ev,
          authState: { creds: { registered: false } },
          async requestPairingCode(phone, custom) {
            return custom || 'PAIR9988';
          },
        };
        this.sock = s;
        ev.emit('connection.update', { connection: 'connecting', qr: 'QR-FIRST-TICK' });
        await s.requestPairingCode('201099887766');
      },
    };

    const port = 41500 + (process.pid % 1000);
    const server = panel.startWebPanel(mockClient, { port, host: '127.0.0.1', password: 'test-panel-password' });
    await new Promise((r) => setTimeout(r, 150));

    try {
      const loginRes = await fetch(`http://127.0.0.1:${port}/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'test-panel-password' }),
      });
      const cookieMatch = /pw=([^;]+)/.exec(loginRes.headers.get('set-cookie') || '');
      assert.ok(cookieMatch);
      const cookie = 'pw=' + cookieMatch[1];

      // Bad phone rejected with 400
      const badPair = await fetch(`http://127.0.0.1:${port}/api/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'pair-main', loginMode: 'code', phone: '12' }),
      });
      assert.equal(badPair.status, 400);

      // Valid pair-main runs in-process and returns pairingCode
      const goodPair = await fetch(`http://127.0.0.1:${port}/api/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'pair-main', loginMode: 'code', phone: '201099887766' }),
      });
      const pairBody = await goodPair.json();
      assert.equal(goodPair.status, 200);
      assert.equal(pairBody.ok, true);
      assert.match(String(pairBody.pairingCode || ''), /^[A-Z0-9]{8}$/);

      // A 20s QR refresh tick from Baileys must NOT wipe pairingCode when loginMode==='code'
      panel.handleConnectionUpdate({ qr: 'QR-SECOND-20S-TICK' });
      const statusRes = await fetch(`http://127.0.0.1:${port}/api/status`, { headers: { cookie } });
      const st = await statusRes.json();
      assert.equal(st.pairingCode, pairBody.pairingCode);
      assert.equal(st.qr, null);
    } finally {
      mockClient.__mainBotFixHandle?.stop?.();
      server.close();
    }
  } finally {
    if (prevCfg === undefined) delete process.env.PANEL_CONFIG_FILE;
    else process.env.PANEL_CONFIG_FILE = prevCfg;
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('menu2 & yt-button: handle null conn or socket without sendButtonNormal cleanly', async () => {
  const { default: menuHandler } = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'menu2.js')).href);
  const replies = [];
  const m = {
    chat: 'user@s.whatsapp.net',
    sender: 'user@s.whatsapp.net',
    reply: async (txt) => { replies.push(txt); },
  };
  await menuHandler(m, { conn: null, bot: null, command: 'اوامر', args: [] });
  assert.equal(replies.length, 1);
  assert.match(replies[0], /الـتـحـمـيـل|قائمة/);

  await menuHandler(m, { conn: {}, bot: null, command: 'menu', args: [] });
  assert.equal(replies.length, 2);
});

test('yt downloader: SaveTube AES-128-CBC fallback works when innertube trips bot check', () => {
  const key = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');
  const iv = Buffer.alloc(16, 7);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const enc = Buffer.concat([iv, cipher.update(JSON.stringify({ key: 'st-key-1', title: 'SaveTube Song' })), cipher.final()]).toString('base64');

  const script = `
    console.log = () => {}; console.error = () => {};
    process.env.YTDLP_BIN = '';
    process.env.PATH = '';
    import { register } from 'node:module';
    const mockUrl = 'data:text/javascript,' + encodeURIComponent(\`
      export default {
        get: async (url) => {
          const u = String(url);
          if (u.includes('/oembed')) return { status: 200, data: { title: 'SaveTube Song', author_name: 'Ch' } };
          if (u.includes('random-cdn')) return { status: 200, data: { cdn: 'cdn51.savetube.me' } };
          if (u.includes('cdn.savetube.example')) return { status: 206, headers: { 'content-type': 'video/mp4' }, data: { destroy() {} } };
          throw new Error('down');
        },
        post: async (url) => {
          const u = String(url);
          if (u.includes('youtubei/v1/player')) return { status: 200, data: { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you are not a bot' } } };
          if (u.includes('/v2/info')) return { status: 200, data: { data: ${JSON.stringify(enc)} } };
          if (u.includes('/download')) return { status: 200, data: { data: { downloadUrl: 'https://cdn.savetube.example/video.mp4' } } };
          throw new Error('unexpected post ' + u);
        }
      };
    \`);
    // verify via getDownload
  `;
  void script;

  // Test decryptSaveTube + getDownload using a self-contained mock module loader inline
  const loaderScript = `
    export async function resolve(specifier, ctx, next) {
      if (specifier === 'axios') {
        const enc = ${JSON.stringify(enc)};
        const mockCode = \`
          export default {
            get: async (url) => {
              const u = String(url);
              if (u.includes('/oembed')) return { status: 200, data: { title: 'SaveTube Song', author_name: 'Ch' } };
              if (u.includes('random-cdn')) return { status: 200, data: { cdn: 'cdn51.savetube.me' } };
              if (u.includes('cdn.savetube.example')) return { status: 206, headers: { 'content-type': 'video/mp4' }, data: { destroy() {} } };
              throw new Error('down');
            },
            post: async (url) => {
              const u = String(url);
              if (u.includes('youtubei/v1/player')) return { status: 200, data: { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you are not a bot' } } };
              if (u.includes('/v2/info')) return { status: 200, data: { data: "\${enc}" } };
              if (u.includes('/download')) return { status: 200, data: { data: { downloadUrl: 'https://cdn.savetube.example/video.mp4' } } };
              throw new Error('unexpected post ' + u);
            }
          };
        \`;
        return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(mockCode), format: 'module' };
      }
      return next(specifier, ctx);
    }
  `;
  const tmpLoader = path.join(os.tmpdir(), `yt-st-mock-${process.pid}.mjs`);
  fs.writeFileSync(tmpLoader, `import { register } from 'node:module'; register(${JSON.stringify(pathToFileURL(tmpLoader).href)});\n` + loaderScript);
  try {
    const stdout = execFileSync(process.execPath, [
      '--input-type=module',
      '--import', pathToFileURL(tmpLoader).href,
      '--eval', `
        process.env.YTDLP_BIN = ''; process.env.PATH = '';
        const { getDownload } = await import('./plugins/download/yt.js');
        const res = await getDownload('dQw4w9WgXcQ', false);
        process.stdout.write(JSON.stringify(res));
      `,
    ], { cwd: repoRoot, encoding: 'utf8' });
    const res = JSON.parse(stdout);
    assert.equal(res.source, 'savetube');
    assert.equal(res.url, 'https://cdn.savetube.example/video.mp4');
    assert.equal(res.title, 'SaveTube Song');
    assert.equal(res.kind, 'video');
  } finally {
    fs.rmSync(tmpLoader, { force: true });
  }
});

test('config & sub.js: DEFAULT_BROWSER is Chrome (companion_platform_id=1) instead of LightBot (9 / 400 bad-request)', () => {
  assert.equal(DEFAULT_BROWSER, 'Chrome');
  const cfg = buildConfig({});
  assert.equal(cfg.browser, 'Chrome');
  assert.equal(getCompanionPlatformId(Browsers.ubuntu(cfg.browser)), '1');

  const subSrc = fs.readFileSync(path.join(repoRoot, 'sub.js'), 'utf8');
  assert.match(subSrc, /installSubBotsPairingFix/);
  assert.match(subSrc, /browser:\s*config\.browser\s*\|\|\s*'Chrome'/);
});

test('mainBotFix: validatePairingPhone handles Arabic digits, 00 prefix, 2001x typo, and rejects local 0-prefix', () => {
  assert.deepEqual(validatePairingPhone('٢٠١٥٠٥٣٦٢١٧٢'), { ok: true, phone: '201505362172' });
  assert.deepEqual(validatePairingPhone('00201505362172'), { ok: true, phone: '201505362172' });
  assert.deepEqual(validatePairingPhone('2001012345678'), { ok: true, phone: '201012345678' });
  const localErr = validatePairingPhone('01505362172');
  assert.equal(localErr.ok, false);
  assert.match(localErr.error, /صفر/);
});

test('mainBotFix: real Baileys WS waits for pair-device/QR and rejects on CB:iq 400 error while resetting creds.me', async () => {
  const ws = new EventEmitter();
  ws.isOpen = true;
  const ev = new EventEmitter();
  const creds = { registered: false, me: undefined, pairingCode: undefined };
  let origCalledBeforeQr = false;
  let qrDelivered = false;

  const sock = {
    ws,
    ev,
    authState: { creds },
    async sendNode() {},
    async requestPairingCode(phone, code) {
      if (!qrDelivered) origCalledBeforeQr = true;
      creds.me = { id: `${phone}@s.whatsapp.net`, name: '~' };
      creds.pairingCode = code;
      // Simulate WhatsApp rejecting pairing IQ with 400 bad-request
      setImmediate(() => {
        ws.emit('CB:iq', {
          tag: 'iq',
          attrs: { type: 'error', id: 'iq-1' },
          content: [{ tag: 'error', attrs: { code: '400', text: 'bad-request' } }],
        });
      });
      return code;
    },
  };

  wrapSocketPairing(sock, { fallbackPhone: () => '201505362172' });

  const reqPromise = sock.requestPairingCode('201505362172', 'VENI1234');
  // Emit qr 40ms later — wrapper must wait for qr before invoking origReq
  setTimeout(() => {
    qrDelivered = true;
    ev.emit('connection.update', { qr: 'REAL-QR-REF' });
  }, 40);

  await assert.rejects(reqPromise, /400/);
  assert.equal(origCalledBeforeQr, false, 'requestPairingCode must wait until pair-device/qr arrives');
  assert.equal(creds.me, undefined, 'failed pairing must clear unregistered creds.me');
  assert.equal(creds.pairingCode, undefined);
});

test('installSubBotsPairingFix: blocks VENI1234 on SubBot sockets and clears unregistered creds.me on restart', async () => {
  const pairEvents = [];
  const subBots = { bots: new Map() };
  installSubBotsPairingFix(subBots, {
    onPairCode: (uid, code) => pairEvents.push({ uid, code }),
  });

  const ws = new EventEmitter();
  ws.isOpen = true;
  const ev = new EventEmitter();
  let authSaved = false;
  let currentSock = null;

  const bot = {
    id: 'sub-99',
    phoneNumber: '201505362172',
    stopped: false,
    auth: {
      state: { creds: { registered: false, me: { id: '201505362172@s.whatsapp.net', name: '~' } } },
      save: async () => { authSaved = true; },
    },
    get sock() { return currentSock; },
    set sock(v) { currentSock = v; },
    async start() {
      this.sock = {
        ws,
        ev,
        authState: { creds: { registered: false } },
        async sendNode() {},
        async requestPairingCode(phone, code) {
          assert.notEqual(code, 'VENI1234');
          setImmediate(() => {
            ws.emit('CB:iq', {
              tag: 'iq',
              attrs: { type: 'result', id: 'iq-ok' },
              content: [{ tag: 'link_code_companion_reg', attrs: { stage: 'companion_hello' } }],
            });
          });
          return code;
        },
      };
      ev.emit('connection.update', { qr: 'SUB-QR' });
    },
  };

  subBots.bots.set('sub-99', bot);
  await bot.start();
  assert.equal(authSaved, true, 'unregistered creds.me must be cleaned before SubBot restart');
  assert.equal(bot.auth.state.creds.me, undefined);

  const code = await bot.sock.requestPairingCode('201505362172', 'VENI1234');
  assert.notEqual(code, 'VENI1234');
  assert.match(code, /^[A-Z0-9]{8}$/);
  assert.deepEqual(pairEvents, [{ uid: 'sub-99', code }]);
});
