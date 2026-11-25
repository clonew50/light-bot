import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import sizeOf from 'image-size';

import '../lib/globals.js';
import '../config.js';
import { makeWASocket, protoType, serialize, smsg } from '../lib/simple.js';
import initDatabase from '../lib/database.js';
import { handler } from '../handler.js';
import mainMenuPlugin from '../plugins/main-menu.js';
import { handleWebRequest, pushPanelEvent } from '../system/webPanel.js';

protoType();
serialize();

function createConnectedFakeSock() {
	const sent = [];
	const relayed = [];
	const sock = makeWASocket({
		auth: { creds: { me: { id: '201505362172:1@s.whatsapp.net', name: 'Yono' }, registered: true }, keys: { get: async () => ({}), set: async () => {} } },
		logger: { info() {}, warn() {}, error() {}, debug() {}, trace() {}, child() { return this; } },
	});
	sock.user = { id: '201505362172:1@s.whatsapp.net', jid: '201505362172@s.whatsapp.net', name: 'Yono' };
	// Keep simple.js sendMessage wrapper active by swapping relayMessage / Orig behavior via testing sendMessage wrapper
	sock.relayMessage = async (jid, message, opts = {}) => {
		const id = opts?.messageId || 'REL_' + (relayed.length + 1);
		sock._sentMsgIds.set(id, true);
		relayed.push({ jid, message, opts, id });
		return id;
	};
	sock.waUploadToServer = async () => ({
		directPath: '/v/mock',
		mediaKey: Buffer.alloc(32),
		fileSha256: Buffer.alloc(32),
		fileEncSha256: Buffer.alloc(32),
	});
	sock.readMessages = async () => {};
	sock.onWhatsApp = async () => [];
	// Mock sock.sendMessage while preserving sendButton & _sentMsgIds behavior
	const origSimpleSend = sock.sendMessage.bind(sock);
	sock.sendMessage = async (jid, content, opts = {}) => {
		// Intercept actual network query by simulating OrigMsg result while still testing sendButton -> sendMessage -> _sentMsgIds
		if (content?.document?.url === 'https://invalid.example.test/fail.jpg') {
			throw new Error('simulated upload error');
		}
		const id = 'BOTSEND_' + (sent.length + 1) + '_XYZ';
		sock._sentMsgIds.set(id, true);
		sent.push({ jid, content, opts, id });
		return { key: { remoteJid: jid, fromMe: true, id } };
	};
	sock._origSimpleSend = origSimpleSend;
	return { sock, sent, relayed };
}

test('isBaileys only flags actual bot-sent IDs and Baileys prefixes, never real user Android/W4B IDs', () => {
	const { sock } = createConnectedFakeSock();

	// 20-char, 22-char, 24-char, 28-char real user IDs (previously marked 'unknown' -> isBaileys=true!)
	const realIds = [
		'AC1234567890ABCDEF12', // 20 chars
		'3EB0A1B2C3D4E5F6071829', // 22 chars incoming from another WA client (fromMe: false)
		'A1B2C3D4E5F607182930ABCD', // 24 chars
		'3A1234567890123456', // 18 chars iOS
	];
	for (const id of realIds) {
		const m = smsg(sock, {
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id },
			message: { conversation: '.menu' },
		});
		assert.equal(m.isBaileys, false, `Expected isBaileys=false for real user id ${id}`);
	}

	// Bot-sent tracked ID MUST be flagged true
	sock._sentMsgIds.set('MY_BOT_REPLY_ID_999', true);
	const botEcho = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: true, id: 'MY_BOT_REPLY_ID_999' },
		message: { conversation: 'hi' },
	});
	assert.equal(botEcho.isBaileys, true);

	// BAE5 ID MUST be flagged true
	const legacyBot = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: true, id: 'BAE51234567890AB' },
		message: { conversation: 'hi' },
	});
	assert.equal(legacyBot.isBaileys, true);

	// Message sent from owner's real phone (fromMe: true, real phone ID) MUST NOT be flagged as Baileys
	const phoneFromMe = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: true, id: '3A1234567890ABCDEF12' },
		message: { conversation: '.menu' },
	});
	assert.equal(phoneFromMe.isBaileys, false);
	assert.equal(phoneFromMe.sender, '201505362172@s.whatsapp.net');
});

test('conn.resize resizes PNG buffer to JPEG thumbnail and getFile handles missing local media safely', async () => {
	const { sock } = createConnectedFakeSock();
	const png = await sharp({
		create: { width: 200, height: 200, channels: 3, background: { r: 34, g: 211, b: 238 } },
	})
		.png()
		.toBuffer();

	const resized = await sock.resize(png, 100, 100);
	assert.ok(Buffer.isBuffer(resized) && resized.length > 0);
	const dims = sizeOf(resized);
	assert.equal(dims.width, 100);
	assert.equal(dims.height, 100);

	const fallback = await sock.getFile('./media/nonexistent-thumbnail.jpg');
	assert.ok(Buffer.isBuffer(fallback.data) && fallback.data.length > 0);
});

test('conn.sendButton forwards nativeFlow and quoted message, falling back cleanly if media upload fails', async () => {
	const { sock, sent } = createConnectedFakeSock();
	const quoted = { key: { remoteJid: '0@s.whatsapp.net' }, message: { conversation: 'q' } };

	await sock.sendButton(
		'201099887766@s.whatsapp.net',
		{
			document: { url: 'https://files.catbox.moe/96cm7n.jpeg' },
			caption: 'hello menu',
			nativeFlow: [{}, { text: '🌐', url: 'https://example.com' }, { text: 'Menu', id: '.menu all' }],
		},
		quoted
	);
	assert.equal(sent.length, 1);
	assert.equal(sent[0].opts.quoted, quoted);
	assert.equal(sent[0].content.nativeFlow.length, 2); // empty {} filtered

	// Now simulate media upload failure -> text+nativeFlow fallback must still send!
	await sock.sendButton(
		'201099887766@s.whatsapp.net',
		{
			document: { url: 'https://invalid.example.test/fail.jpg' },
			caption: 'fallback body',
			nativeFlow: [{ text: 'Ping', id: '.ping' }],
		},
		quoted
	);
	assert.equal(sent.length, 2);
	assert.equal(sent[1].content.text, 'fallback body');
	assert.equal(sent[1].content.document, undefined);
});

test('initDatabase defaults gconly=false, public=true and creates both @lid users and DM chats', () => {
	global.db = { data: { users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {} } };
	global.opts = { self: false, public: true, restrict: true, autoread: false, anticall: false, gconly: false };
	const { sock } = createConnectedFakeSock();

	initDatabase({ sender: '12345678901234@lid', chat: '12345678901234@lid', name: 'LidUser' }, sock);
	assert.ok(global.db.data.users['12345678901234@lid']);
	assert.ok(global.db.data.chats['12345678901234@lid']);
	assert.equal(global.db.data.settings['201505362172@s.whatsapp.net'].gconly, false);
	assert.equal(global.db.data.settings['201505362172@s.whatsapp.net'].public, true);
});

test('handler executes command for non-owner user in DM with extra aliases & respects @lid owner', async () => {
	const { sock } = createConnectedFakeSock();
	global.db = {
		data: {
			users: {},
			chats: {},
			stats: {},
			msgs: {},
			sticker: {},
			settings: { '201505362172@s.whatsapp.net': { public: true, gconly: false, autoread: false, anticall: false } },
		},
	};
	global.loadDatabase = async () => {};
	global.prefix = /^[.]/;

	const calls = [];
	global.plugins = {
		'test-ping.js': Object.assign(
			async (m, extra) => {
				calls.push({ sender: m.sender, extra });
				await extra.sock.sendMessage(m.chat, { text: 'pong' });
			},
			{ help: ['ping'], tags: ['info'], command: /^ping$/i }
		),
	};

	// Regular user in DM
	await handler.call(sock, {
		messages: [
			{
				key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_ANDROID_20CHARS_' },
				message: { conversation: '.ping' },
				pushName: 'RegularUser',
			},
		],
	});

	assert.equal(calls.length, 1);
	assert.equal(calls[0].sender, '201099887766@s.whatsapp.net');
	assert.equal(calls[0].extra.prefix, '.');
	assert.equal(calls[0].extra.isOwner, false);
	assert.equal(calls[0].extra.sock, sock);
	assert.equal(calls[0].extra.satanic, sock);
	assert.equal(calls[0].extra.config, global.config);

	// Sub-bot paused mode blocks non-owner cleanly
	sock._subBotPhone = '201112223334';
	sock._subBotSettings = { paused: true, mode: 'public', prefix: '.' };
	await handler.call(sock, {
		messages: [
			{
				key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_ANDROID_20CHARS2' },
				message: { conversation: '.ping' },
			},
		],
	});
	assert.equal(calls.length, 1);
});

test('plugins/main-menu.js runs cleanly for main index and .menu main without TypeError', async () => {
	const { sock, sent } = createConnectedFakeSock();
	global.db = {
		data: {
			users: { '201099887766@s.whatsapp.net': { name: 'Tester', registered: false, limit: 20, level: 1, exp: 0, money: 0 } },
			chats: {},
			stats: {},
			settings: {},
		},
	};
	global.plugins = {
		'main-menu.js': mainMenuPlugin,
	};

	// Stub fetch quickly so unit test doesn't wait on network
	const origFetch = global.fetch;
	global.fetch = async () => ({ ok: false });
	try {
		const m1 = smsg(sock, {
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_MENU_MSG_000001' },
			message: { conversation: '.menu' },
			pushName: 'Tester',
		});
		await mainMenuPlugin.call(sock, m1, {
			conn: sock,
			usedPrefix: '.',
			args: [],
			isPrems: false,
			isOwner: false,
			command: 'menu',
		});
		assert.equal(sent.length, 1);
		assert.ok(sent[0].content.caption.includes('*U S E R*'));
		assert.ok(sent[0].content.caption.includes('*I N F O R M A T I O N*'));
		assert.ok(Array.isArray(sent[0].content.nativeFlow));

		const m2 = smsg(sock, {
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_MENU_MSG_000002' },
			message: { conversation: '.menu main' },
			pushName: 'Tester',
		});
		await mainMenuPlugin.call(sock, m2, {
			conn: sock,
			usedPrefix: '.',
			args: ['main'],
			isPrems: false,
			isOwner: false,
			command: 'menu',
		});
		assert.equal(sent.length, 2);
		assert.ok(sent[1].content.text.includes('.menu'));
	} finally {
		global.fetch = origFetch;
	}
});

test('webPanel routes: /admin login, /api/public/status, sub-bot pairing, and send ok:true', async () => {
	const tmpCfg = path.join(os.tmpdir(), `panel-test-${Date.now()}.json`);
	process.env.PANEL_CONFIG_FILE = tmpCfg;
	global.db = { data: { users: {}, chats: {}, stats: {}, settings: {}, subBots: {} } };
	global.__panelState = { connection: 'open', pairingCode: null, lastQR: null };
	global.plugins = { ping: { command: 'ping', tags: ['info'], help: ['ping'] } };
	pushPanelEvent('test panel boot');

	const { sock, sent } = createConnectedFakeSock();
	const server = http.createServer((req, res) => {
		handleWebRequest(req, res, sock, {
			requestSubBotPairing: async () => ({
				ok: true,
				pairingCode: 'TEST-1234',
				qr: null,
			}),
		});
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	const base = `http://127.0.0.1:${port}`;

	try {
		// 1. /admin unauthenticated shows login form
		const adminLoginRes = await fetch(`${base}/admin`);
		assert.equal(adminLoginRes.status, 200);
		const adminLoginHtml = await adminLoginRes.text();
		assert.ok(adminLoginHtml.includes('action="/login"'));

		// 2. /api/public/status works without auth
		const pubStatusRes = await fetch(`${base}/api/public/status`);
		assert.equal(pubStatusRes.status, 200);
		const pubStatus = await pubStatusRes.json();
		assert.equal(pubStatus.ok, true);
		assert.equal(pubStatus.connected, true);
		assert.equal(pubStatus.commands, 1);

		// 3. /api/public/sub/pair issues controlCode + real pairingCode and sets sub_tok cookie
		const pairRes = await fetch(`${base}/api/public/sub/pair`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ phone: '201099887766', mode: 'code' }),
		});
		assert.equal(pairRes.status, 200);
		const pairJson = await pairRes.json();
		assert.equal(pairJson.ok, true);
		assert.ok(pairJson.controlCode.startsWith('LB-'));
		assert.equal(pairJson.pairingCode, 'TEST-1234');
		const subCookie = pairRes.headers.get('set-cookie')?.split(';')[0];
		assert.ok(subCookie?.startsWith('sub_tok='));

		// 4. /api/public/sub/me works with cookie
		const meRes = await fetch(`${base}/api/public/sub/me`, { headers: { Cookie: subCookie } });
		const meJson = await meRes.json();
		assert.equal(meJson.authenticated, true);
		assert.equal(meJson.bot.phone, '201099887766');

		// 5. Admin login + /api/action send returns ok: true
		const cfg = JSON.parse(fs.readFileSync(tmpCfg, 'utf8'));
		const loginRes = await fetch(`${base}/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ password: cfg.password }).toString(),
			redirect: 'manual',
		});
		assert.equal(loginRes.status, 302);
		const pwCookie = loginRes.headers.get('set-cookie')?.split(';')[0];
		assert.ok(pwCookie?.startsWith('pw='));

		const sendRes = await fetch(`${base}/api/action`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: pwCookie },
			body: JSON.stringify({ action: 'send', to: '201099887766', text: 'hello test' }),
		});
		assert.equal(sendRes.status, 200);
		const sendJson = await sendRes.json();
		assert.equal(sendJson.ok, true);
		assert.equal(sent[sent.length - 1].content.text, 'hello test');
	} finally {
		server.close();
		try {
			fs.rmSync(tmpCfg, { force: true });
		} catch {}
		delete process.env.PANEL_CONFIG_FILE;
	}
});
