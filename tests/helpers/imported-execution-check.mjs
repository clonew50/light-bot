import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installImportedMediaListener } from '../../system/imported-compat.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const sourceRoot = path.join(repoRoot, 'extensions', 'imported-plugins');
const bridgeRoot = path.join(repoRoot, 'plugins', 'imported');

try {
  const sent = [];
  const relayed = [];
  const socket = {
    user: { id: 'bot@s.whatsapp.net' },
    ev: new EventEmitter(),
    async sendMessage(...args) {
      sent.push(args);
      return { key: { id: `sent-${sent.length}` } };
    },
    async relayMessage(...args) {
      relayed.push(args);
      return { key: { id: `relayed-${relayed.length}` } };
    },
    async profilePictureUrl() {
      return Buffer.from('fake-image');
    }
  };

  const users = {};
  const groups = {};
  const data = { sticker: {}, stats: {}, settings: {} };
  globalThis.db = { users, groups, data };

  const bot = {
    sock: socket,
    config: {
      owners: ['owner@s.whatsapp.net'],
      info: { nameBot: 'LightBot', images: ['https://example.com/bot.jpg'] },
      settings: {}
    },
    async getAllCommands() {
      return [
        { command: ['demo'], usage: ['demo'], category: 'tools', __filePath: path.join(bridgeRoot, 'demo.js') },
        { command: ['demo2'], usage: ['demo2'], category: 'tools', __filePath: path.join(bridgeRoot, 'demo.js') },
        { command: ['other'], usage: ['other'], category: 'info', __filePath: path.join(bridgeRoot, 'other.js') }
      ];
    }
  };

  const sender = 'user@s.whatsapp.net';
  const chat = 'chat@s.whatsapp.net';
  const ctx = {
    conn: socket,
    bot,
    isOwner: false,
    isAdmin: false,
    isBotAdmin: false,
    prefix: '.',
    usedPrefix: '.',
    command: 'setcmd',
    text: 'hello',
    args: ['hello']
  };
  const message = {
    chat,
    sender,
    pushName: 'User',
    quoted: { fileSha256: 'hash-1' },
    async react() {},
    async reply() {}
  };

  const setCmd = await import(pathToFileURL(path.join(bridgeRoot, 'cmd-set.js')).href);
  await setCmd.default.execute(message, ctx, bot);
  assert.equal(globalThis.db.data.sticker['hash-1'].text, 'hello');

  const quotedRaw = {
    key: { id: 'quoted-raw-1' },
    message: {
      stickerMessage: {
        fileSha256: 'quoted-raw-hash',
        fileEncSha256: 'quoted-raw-enc',
        mediaKey: 'quoted-raw-media-key',
        directPath: '/quoted/raw',
        mimetype: 'image/webp'
      }
    }
  };
  const quotedEnvelope = {
    raw: quotedRaw,
    mtype: 'stickerMessage',
    message: quotedRaw.message.stickerMessage,
    fakeObj: () => quotedRaw
  };
  await setCmd.default.execute(
    { ...message, quoted: quotedEnvelope },
    { ...ctx, text: 'quoted command' },
    bot
  );
  assert.equal(globalThis.db.data.sticker['quoted-raw-hash'].text, 'quoted command');
  assert.equal(quotedEnvelope.fileSha256, 'quoted-raw-hash');
  assert.equal(quotedEnvelope.fakeObj.key.id, 'quoted-raw-1');

  const totalFitur = await import(pathToFileURL(path.join(bridgeRoot, 'info-totalfitur.js')).href);
  await totalFitur.default.execute({ ...message, quoted: undefined }, { ...ctx, text: '' }, bot);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(sent.some(([, payload]) => String(payload?.text || '').includes('Total Fitur Bot')));
  assert.deepEqual(Object.keys(globalThis.plugins).sort(), ['demo.js', 'other.js']);
  assert.deepEqual(globalThis.plugins['demo.js'].usage, ['demo', 'demo2']);

  assert.equal(typeof socket.sendButtonNormal, 'function');
  await socket.sendButtonNormal(chat, {
    text: 'Button test',
    buttons: [{
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: 'Yes', id: '1' })
    }]
  }, { quoted: message });
  const buttonMessage = sent.find(([, payload]) => payload?.text === 'Button test');
  assert.equal(buttonMessage?.[1]?.buttons?.[0]?.name, 'quick_reply');
  assert.equal(buttonMessage?.[1]?.buttons?.[0]?.params?.id, '1');

  globalThis.db.data.sticker['media-hash'] = {
    text: 'ping',
    mentionedJid: [],
    creator: sender,
    at: Date.now(),
    locked: false
  };
  const generatedMediaCommand = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.ev.off('messages.upsert', onUpdate);
      reject(new Error('stored media command was not emitted'));
    }, 2000);
    function onUpdate(update) {
      for (const raw of update?.messages || []) {
        const text = raw?.message?.conversation || raw?.message?.extendedTextMessage?.text;
        if (text === '.ping') {
          clearTimeout(timeout);
          socket.ev.off('messages.upsert', onUpdate);
          resolve(raw);
          return;
        }
      }
    }
    socket.ev.on('messages.upsert', onUpdate);
  });
  installImportedMediaListener(socket, bot);
  socket.ev.emit('messages.upsert', {
    messages: [{
      key: { id: 'media-message-1', remoteJid: chat, participant: sender },
      message: {
        stickerMessage: {
          fileSha256: 'media-hash',
          fileEncSha256: 'media-enc-hash',
          mediaKey: 'media-key',
          directPath: '/media/path',
          mimetype: 'image/webp'
        }
      },
      pushName: 'User'
    }],
    type: 'append'
  });
  const generated = await generatedMediaCommand;
  assert.equal(
    generated.message.conversation || generated.message.extendedTextMessage?.text,
    '.ping'
  );

  const register = await import(pathToFileURL(path.join(bridgeRoot, 'xp-register.js')).href);
  await register.default.execute(
    { ...message, quoted: undefined },
    { ...ctx, command: 'daftar', text: 'Alice.17' },
    bot
  );
  assert.equal(globalThis.db.users[sender].registered, true);
  assert.equal(globalThis.db.users[sender].name, 'Alice');

  const dino = await import(pathToFileURL(path.join(repoRoot, 'plugins', 'dino.js')).href);
  await dino.default({ chat }, { conn: socket });
  assert.equal(relayed.length, 1);
  assert.ok(relayed[0][1]?.botForwardedMessage?.message?.richResponseMessage);

  const menu = await import(pathToFileURL(path.join(bridgeRoot, 'menu.js')).href);
  assert.deepEqual(menu.default.command, ['menu3']);
  assert.equal(menu.default.usage[0], 'menu3');
  assert.equal(menu.default.category, 'info');

  console.log('IMPORTED_EXECUTION_OK');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
