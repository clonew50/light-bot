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
import { makeWASocket, prepareOutgoingContent, protoType, serialize, smsg } from '../lib/simple.js';
import initDatabase from '../lib/database.js';
import { handler } from '../handler.js';
import mainMenuPlugin from '../plugins/main-menu.js';
import readViewOncePlugin from '../plugins/media-readviewonce.js';
import msgInfoPlugin from '../plugins/tools-msginfo.js';
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

	// Clonew50 @lid owner ID is recognized even when sub-bot is paused
	await handler.call(sock, {
		messages: [
			{
				key: { remoteJid: '79006443503783@lid', fromMe: false, id: 'USER_ANDROID_OWNER01' },
				message: { conversation: '.ping' },
				pushName: 'Clonew50',
			},
		],
	});
	assert.equal(calls.length, 2);
	assert.equal(calls[1].extra.isROwner, true);
	assert.equal(calls[1].extra.isOwner, true);

	// Unregistered prompt uses English .register command
	const unregReplies = [];
	await global.dfail('unreg', { chat: '201099887766@s.whatsapp.net' }, { reply: async (_chat, text) => unregReplies.push(text) });
	assert.equal(unregReplies.length, 1);
	assert.ok(unregReplies[0].includes('.register Name.age'));
	assert.ok(!unregReplies[0].includes('.daftar'));
});

test('plugins/media-readviewonce.js and smsg handle viewOnce replies (.فضح / .vv), messageContextInfo, and clean sendMessage', async () => {
	const { sock, sent } = createConnectedFakeSock();
	const fakeBuf = Buffer.from('fake-image-bytes');

	// Verify prepareOutgoingContent (used by sendMessage) no longer injects streamingSidecar or embeddedMusic annotations
	const { generateWAMessageContent } = await import('baileys');
	const outgoingPayload = prepareOutgoingContent(sock, { image: fakeBuf, caption: 'clean reveal @201099887766' });
	assert.equal(outgoingPayload.annotations, undefined);
	assert.equal(outgoingPayload.streamingSidecar, undefined);
	assert.deepEqual(outgoingPayload.mentions, ['201099887766@s.whatsapp.net']);
	const generated = await generateWAMessageContent(outgoingPayload, {
		upload: async () => ({
			directPath: '/v/t62.7118-24/mock',
			mediaUrl: 'https://mmg.whatsapp.net/v/t62.7118-24/mock',
			mediaKey: Buffer.alloc(32, 1),
			fileSha256: Buffer.alloc(32, 2),
			fileEncSha256: Buffer.alloc(32, 3),
			fileLength: fakeBuf.length,
		}),
	});
	assert.ok(generated.imageMessage);
	assert.equal(generated.imageMessage.annotations?.length || 0, 0, 'imageMessage must not have fake embeddedMusic annotations');
	assert.equal(generated.imageMessage.streamingSidecar?.length || 0, 0, 'imageMessage must not have fake streamingSidecar');

	// Malformed/empty quotedMessage must never crash smsg
	assert.doesNotThrow(() =>
		smsg(sock, {
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_MALFORMED_Q1' },
			message: {
				extendedTextMessage: {
					text: '.فضح',
					contextInfo: { stanzaId: 'BAD_Q', participant: '201099887766@s.whatsapp.net', quotedMessage: {} },
				},
			},
		}).quoted
	);

	// messageContextInfo before imageMessage inside viewOnceMessageV2 must still resolve m.quoted.mediaType === 'imageMessage'
	const mCtxQuoted = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_RVO_CTX_00001' },
		message: {
			extendedTextMessage: {
				text: '.فضح',
				contextInfo: {
					stanzaId: 'QUOTED_CTX',
					participant: '201099887766@s.whatsapp.net',
					quotedMessage: {
						viewOnceMessageV2: {
							message: {
								messageContextInfo: { deviceListMetadataVersion: 2 },
								imageMessage: { caption: 'ctx secret', mimetype: 'image/jpeg', viewOnce: true, url: 'https://mmg.whatsapp.net/ctx' },
							},
						},
					},
				},
			},
		},
	});
	assert.equal(mCtxQuoted.quoted.mtype, 'imageMessage');
	assert.equal(mCtxQuoted.quoted.mediaType, 'imageMessage');
	assert.equal(typeof mCtxQuoted.quoted.download, 'function');

	// Non-viewOnce reply should throw the Arabic prompt
	const mNonViewOnce = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_RVO_00000000001' },
		message: {
			extendedTextMessage: {
				text: '.فضح',
				contextInfo: {
					stanzaId: 'QUOTED_1',
					participant: '201099887766@s.whatsapp.net',
					quotedMessage: { imageMessage: { caption: 'normal', mimetype: 'image/jpeg' } },
				},
			},
		},
	});
	await assert.rejects(() => readViewOncePlugin.call(sock, mNonViewOnce, { conn: sock }), /رد على فيديو أو صورة/);

	// Ephemeral + viewOnceMessageV2 + .vv command + loadMessage fallback when quoted stub lacks url
	assert.ok(readViewOncePlugin.command.test('vv'));
	assert.ok(readViewOncePlugin.command.test('فضح'));
	sock.chats['201099887766@s.whatsapp.net'] = {
		id: '201099887766@s.whatsapp.net',
		messages: {
			QUOTED_2: {
				key: { remoteJid: '201099887766@s.whatsapp.net', id: 'QUOTED_2' },
				message: {
					viewOnceMessageV2: {
						message: {
							imageMessage: { caption: 'secret', mimetype: 'image/jpeg', viewOnce: true, url: 'https://mmg.whatsapp.net/x' },
						},
					},
				},
			},
		},
	};
	Object.defineProperty(sock, 'downloadM', { value: async () => fakeBuf, configurable: true });
	const mViewOnce = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_RVO_00000000002' },
		message: {
			extendedTextMessage: {
				text: '.vv',
				contextInfo: {
					stanzaId: 'QUOTED_2',
					participant: '201099887766@s.whatsapp.net',
					quotedMessage: {
						ephemeralMessage: {
							message: {
								viewOnceMessageV2: {
									message: {
										messageContextInfo: { deviceListMetadataVersion: 2 },
										imageMessage: { caption: 'secret', mimetype: 'image/jpeg', viewOnce: true },
									},
								},
							},
						},
					},
				},
			},
		},
	});
	await readViewOncePlugin.call(sock, mViewOnce, { conn: sock });
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].content.image, fakeBuf);
	assert.ok(sent[0].content.caption.includes('secret'));
	assert.ok(sent[0].content.caption.includes('لا يسمح لك بإخفاء شيء هنا'));

	// pushMessage stores even fromMe ViewOnce messages immediately so loadMessage finds them
	await sock.pushMessage([
		{
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: true, id: 'FROMME_VO_999' },
			message: {
				viewOnceMessageV2: {
					message: {
						imageMessage: {
							url: 'https://mmg.whatsapp.net/v/vo999',
							directPath: '/v/vo999',
							mimetype: 'image/jpeg',
							mediaKey: Buffer.alloc(32, 9),
							fileLength: 4321,
							viewOnce: true,
							caption: 'peek',
						},
					},
				},
			},
		},
	]);
	const loadedVo = sock.loadMessage('FROMME_VO_999');
	assert.ok(loadedVo);
	assert.equal(loadedVo.message?.viewOnceMessageV2?.message?.imageMessage?.url, 'https://mmg.whatsapp.net/v/vo999');

	// .معلومات / .msginfo inspects quoted message metadata, CDN URL, mediaKey, and JSON
	const mInspect = smsg(sock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_MSGINFO_1' },
		message: {
			extendedTextMessage: {
				text: '.معلومات',
				contextInfo: {
					stanzaId: 'FROMME_VO_999',
					participant: '201099887766@s.whatsapp.net',
					quotedMessage: {
						viewOnceMessageV2: {
							message: { imageMessage: { mimetype: 'image/jpeg', viewOnce: true } },
						},
					},
				},
			},
		},
	});
	await msgInfoPlugin.call(sock, mInspect, { conn: sock });
	const infoText = sent[sent.length - 1]?.content?.text || '';
	assert.ok(infoText.includes('FROMME_VO_999'));
	assert.ok(infoText.includes('https://mmg.whatsapp.net/v/vo999'));
	assert.ok(infoText.includes('/v/vo999'));
	assert.ok(infoText.includes('MediaKey'));
	assert.ok(infoText.includes('peek'));

	// Simulate bot restart with deviceSentMessage -> viewOnceMessageV2 (directPath only, persisted in global.db.data.msgs)
	global.db = { data: { users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {} } };
	await sock.pushMessage([
		{
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: true, id: 'DEVICE_SENT_VO_1' },
			message: {
				deviceSentMessage: {
					destinationJid: '201099887766@s.whatsapp.net',
					message: {
						viewOnceMessageV2: {
							message: {
								imageMessage: {
									directPath: '/v/t62/device_sent_only',
									mimetype: 'image/jpeg',
									mediaKey: Buffer.alloc(32, 5),
									viewOnce: true,
									caption: 'device sent secret',
								},
							},
						},
					},
				},
			},
		},
	]);
	const { sock: restartedSock, sent: restartedSent } = createConnectedFakeSock();
	Object.defineProperty(restartedSock, 'downloadM', {
		value: async (node) => {
			assert.equal(node.directPath, '/v/t62/device_sent_only');
			assert.equal(node.url, 'https://mmg.whatsapp.net/v/t62/device_sent_only');
			assert.ok(Buffer.isBuffer(node.mediaKey));
			return fakeBuf;
		},
		configurable: true,
	});
	const mAfterRestart = smsg(restartedSock, {
		key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_RVO_AFTER_RESTART' },
		message: {
			extendedTextMessage: {
				text: '.فضح',
				contextInfo: {
					stanzaId: 'DEVICE_SENT_VO_1',
					participant: '201099887766@s.whatsapp.net',
					quotedMessage: {
						viewOnceMessageV2: {
							message: { imageMessage: { mimetype: 'image/jpeg', viewOnce: true } },
						},
					},
				},
			},
		},
	});
	await readViewOncePlugin.call(restartedSock, mAfterRestart, { conn: restartedSock });
	assert.equal(restartedSent.length, 1);
	assert.deepEqual(restartedSent[0].content.image, fakeBuf);
	assert.ok(restartedSent[0].content.caption.includes('device sent secret'));

	// Quote stub stored in participant chat must NEVER shadow full message stored in global.db.data.msgs
	restartedSock.chats['999888777@s.whatsapp.net'] = {
		id: '999888777@s.whatsapp.net',
		messages: {
			SHADOW_VO_1: {
				_isQuoteStub: true,
				key: { remoteJid: '999888777@s.whatsapp.net', id: 'SHADOW_VO_1' },
				message: { viewOnceMessageV2: { message: { imageMessage: { mimetype: 'image/jpeg', viewOnce: true } } } },
			},
		},
	};
	global.db.data.msgs.SHADOW_VO_1 = {
		key: { remoteJid: '120363999@g.us', id: 'SHADOW_VO_1', participant: '999888777@s.whatsapp.net' },
		message: {
			viewOnceMessageV2: {
				message: {
					imageMessage: {
						directPath: '/v/t62/unshadowed_path',
						mimetype: 'image/jpeg',
						mediaKey: Buffer.alloc(32, 3).toString('base64'),
						viewOnce: true,
					},
				},
			},
		},
	};
	const loadedBest = restartedSock.loadMessage('SHADOW_VO_1');
	assert.equal(loadedBest?.message?.viewOnceMessageV2?.message?.imageMessage?.directPath, '/v/t62/unshadowed_path');
});

test('plugins/main-menu.js runs cleanly for list, category, and unknown menu without protobuf or TypeError', async () => {
	const { sock, sent, relayed } = createConnectedFakeSock();
	const { proto } = await import('baileys');
	const { default: axios } = await import('axios');
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

	const origAdapter = axios.defaults.adapter;
	axios.defaults.adapter = async () => {
		throw new Error('offline test stub');
	};
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
		assert.equal(relayed.length, 2);
		assert.doesNotThrow(() => proto.Message.encode(proto.Message.fromObject(relayed[0].message)).finish());
		assert.doesNotThrow(() => proto.Message.encode(proto.Message.fromObject(relayed[1].message)).finish());
		assert.ok(relayed[1].message.interactiveMessage.bloksWidget.data.includes('MAIN MENU'));
		assert.ok(!relayed[1].message.interactiveMessage.bloksWidget.data.includes('MENU UTAMA'));
		assert.ok(!relayed[1].message.interactiveMessage.bloksWidget.data.includes('Fitur Utama'));
		assert.ok(!relayed[1].message.interactiveMessage.bloksWidget.data.includes('Hubungi Developer'));

		// Unknown category replies via conn.reply
		const mBad = smsg(sock, {
			key: { remoteJid: '201099887766@s.whatsapp.net', fromMe: false, id: 'USER_MENU_MSG_000002' },
			message: { conversation: '.menu nonexistent' },
			pushName: 'Tester',
		});
		await mainMenuPlugin.call(sock, mBad, {
			conn: sock,
			usedPrefix: '.',
			args: ['nonexistent'],
			isPrems: false,
			isOwner: false,
			command: 'menu',
		});
		assert.ok(sent.some((s) => s.content?.text?.includes('Not found')));
	} finally {
		axios.defaults.adapter = origAdapter;
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

		// 6. Public commands catalog route (returns full commands list by default without 48 cap)
		const pubCmdsRes = await fetch(`${base}/api/public/commands?q=ping`);
		assert.equal(pubCmdsRes.status, 200);
		const pubCmds = await pubCmdsRes.json();
		assert.equal(pubCmds.ok, true);
		assert.equal(pubCmds.total, 1);
		assert.equal(pubCmds.commands[0].primary, 'ping');

		const origPlugins = global.plugins;
		try {
			const manyPlugins = {};
			for (let i = 1; i <= 60; i++) {
				manyPlugins[`p${i}.js`] = { command: `cmd${i}`, tags: ['tools'], help: [`cmd${i}`] };
			}
			global.plugins = manyPlugins;
			const fullRes = await fetch(`${base}/api/public/commands`);
			const fullJson = await fullRes.json();
			assert.equal(fullJson.ok, true);
			assert.equal(fullJson.total, 60);
			assert.equal(fullJson.commands.length, 60);
		} finally {
			global.plugins = origPlugins;
		}

		// 7. Save main bot settings route updates db & global.opts
		const saveSetRes = await fetch(`${base}/api/action`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: pwCookie },
			body: JSON.stringify({ action: 'save-bot-settings', public: true, gconly: false, autoread: true, anticall: false }),
		});
		assert.equal(saveSetRes.status, 200);
		const saveSetJson = await saveSetRes.json();
		assert.equal(saveSetJson.ok, true);
		assert.equal(saveSetJson.botSettings.autoread, true);
		assert.equal(saveSetJson.botSettings.gconly, false);

		// 8. Rendered HTML pages (/) and (/admin) have valid inline JS syntax & public portal exposes commands menu without simulator
		const publicHtml = await (await fetch(`${base}/`)).text();
		assert.ok(publicHtml.includes('قائمة أوامر البوت'));
		assert.ok(!publicHtml.includes('معاينة تفاعلية للأوامر'));
		assert.ok(!publicHtml.includes('id="simulator"'));
		assert.ok(!publicHtml.includes('id="simInput"'));

		const adminHtml = await (await fetch(`${base}/admin`, { headers: { Cookie: pwCookie } })).text();
		for (const [label, html] of [
			['public', publicHtml],
			['admin', adminHtml],
		]) {
			assert.ok(html.includes('execCopySync('), `Expected execCopySync fallback in ${label}`);
			assert.ok(html.includes('showManualCopyToast('), `Expected manual copy fallback in ${label}`);
			assert.ok(html.includes('showCopyFeedback('), `Expected inline copy feedback in ${label}`);
			const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
			assert.ok(scripts.length >= 1, `Expected inline script in ${label}`);
			for (const code of scripts) {
				assert.doesNotThrow(() => new Function(code), `Syntax error in ${label} inline script`);
			}
		}
		assert.ok(publicHtml.includes('copyCodeValue(prefix + cmd, el)'), 'Expected public cmd card to pass element');
		assert.ok(adminHtml.includes('copyCodeValue(this.dataset.cmd, this)'), 'Expected admin cmd card to pass element');
		assert.ok(publicHtml.includes('copyCodeValue(this.dataset.code, this)'), 'Expected code tiles to pass element');
	} finally {
		server.close();
		server.closeAllConnections?.();
		try {
			fs.rmSync(tmpCfg, { force: true });
		} catch {}
		delete process.env.PANEL_CONFIG_FILE;
	}
});

test('handler isolates plugin.before errors, blocks banned users, parses multiline args, clamps limits, and binds this in events', async () => {
	const { sock, sent } = createConnectedFakeSock();
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
	const origPlugins = global.plugins;
	try {
		global.plugins = {
			'broken-before.js': Object.assign(async () => {}, {
				before() {
					throw new Error('hook boom');
				},
			}),
			'echo-cmd.js': Object.assign(
				async (msg, extra) => {
					msg.limit = 5;
					calls.push({ command: extra.command, args: extra.args, text: extra.text });
				},
				{ help: ['echo'], tags: ['tools'], command: /^echo$/i, limit: 1 }
			),
		};

		// Seed user with limit = 2 -> limit=5 must clamp to 0 (never negative)
		const userJid = '201099887766@s.whatsapp.net';
		global.db.data.users[userJid] = { banned: false, limit: 2, exp: 0 };

		await handler.call(sock, {
			messages: [
				{
					key: { remoteJid: userJid, fromMe: false, id: 'USER_MULTILINE_CMD1' },
					message: { conversation: '.echo first line\nsecond line' },
					pushName: 'Alice',
				},
			],
		});

		assert.equal(calls.length, 1);
		assert.equal(calls[0].command, 'echo');
		assert.equal(calls[0].text, 'first line\nsecond line');
		assert.equal(global.db.data.users[userJid].limit, 0);

		// Banned user is ignored cleanly
		global.db.data.users[userJid].banned = true;
		await handler.call(sock, {
			messages: [
				{
					key: { remoteJid: userJid, fromMe: false, id: 'USER_BANNED_CMD2' },
					message: { conversation: '.echo blocked' },
					pushName: 'Alice',
				},
			],
		});
		assert.equal(calls.length, 1);

		// participantsUpdate & deleteUpdate bind `this` instead of failing on undefined `conn`
		const { participantsUpdate, deleteUpdate } = await import('../handler.js');
		const grpJid = '120363000111222@g.us';
		global.db.data.chats[grpJid] = { detect: true, delete: true, welcome: false };
		await participantsUpdate.call(sock, {
			id: grpJid,
			participants: ['201099887766@s.whatsapp.net'],
			action: 'promote',
			simulate: true,
		});
		assert.ok(sent.some((s) => s.jid === grpJid && /Admin/i.test(s.content?.text || '')));

		sock.chats[grpJid] = {
			id: grpJid,
			messages: {
				DEL_MSG_1: {
					key: { remoteJid: grpJid, fromMe: false, id: 'DEL_MSG_1', participant: userJid },
					message: { conversation: 'deleted hello' },
				},
			},
		};
		await deleteUpdate.call(sock, { fromMe: false, id: 'DEL_MSG_1', participant: userJid });
		assert.ok(sent.some((s) => s.jid === grpJid && /deleted a message/i.test(s.content?.text || '')));
	} finally {
		global.plugins = origPlugins;
	}
});

test('fixed RPG, owner, fun, menu, welcome, and fakecall plugins execute without undefined globals or crashes', async () => {
	const { sock, sent } = createConnectedFakeSock();
	const userJid = '201099887766@s.whatsapp.net';
	const otherJid = '201011223344@s.whatsapp.net';
	const grpJid = '120363000333444@g.us';

	global.db = {
		data: {
			users: {
				[userJid]: {
					name: 'Tester',
					money: 500,
					atm: 0,
					limit: 10,
					potion: 2,
					trash: 5,
					diamond: 1,
					common: 2,
					uncommon: 0,
					mythic: 0,
					legendary: 0,
					string: 0,
					rock: 0,
					wood: 0,
					iron: 0,
					steak: 2,
					stamina: 90,
					level: 1,
					exp: 0,
					registered: false,
					lastrampok: 0,
					afk: -1,
					afkReason: '',
					spam: 0,
					lastspam: 0,
					premium: true,
					premiumTime: Date.now() - 1000,
				},
			},
			chats: { [grpJid]: { welcome: false, nsfw: false } },
			stats: {},
			msgs: {},
			sticker: {},
			settings: {},
		},
	};

	// 1. _premium.js expires expired premiumTime cleanly
	const { default: premiumHook } = await import('../plugins/_premium.js');
	const mBase = smsg(sock, {
		key: { remoteJid: grpJid, fromMe: false, id: 'USER_FIXES_0001', participant: userJid },
		message: { conversation: 'hi' },
		pushName: 'Tester',
	});
	await premiumHook.before.call(sock, mBase);
	assert.equal(global.db.data.users[userJid].premium, false);
	assert.equal(global.db.data.users[userJid].premiumTime, 0);

	// 2. rpg-eat.js consumes steak and clamps stamina <= 100
	const { default: rpgEat } = await import('../plugins/rpg-eat.js');
	await rpgEat.call(sock, mBase, { conn: sock, args: ['steak', '1'], usedPrefix: '.', command: 'eat' });
	assert.equal(global.db.data.users[userJid].steak, 1);
	assert.equal(global.db.data.users[userJid].stamina, 100);

	// 3. rpg-mentransfer.js initializes missing receiver & transfers trash cleanly
	const { default: rpgTransfer } = await import('../plugins/rpg-mentransfer.js');
	await rpgTransfer.call(sock, mBase, { conn: sock, args: ['trash', '3', '201011223344'], usedPrefix: '.' });
	assert.equal(global.db.data.users[userJid].trash, 2);
	assert.equal(global.db.data.users[otherJid].trash, 3);

	// 4. rpg-open.js opens common crate cleanly
	const { default: rpgOpen } = await import('../plugins/rpg-open.js');
	await rpgOpen.call(sock, mBase, { conn: sock, args: ['common', '1'], usedPrefix: '.', command: 'open' });
	assert.ok(global.db.data.users[userJid].money >= 101);
	assert.ok(global.db.data.users[userJid].exp >= 201);
	assert.ok(global.db.data.users[userJid].common === 1 || global.db.data.users[userJid].common === 2);

	// 5. xp-levelup.js & xp-register.js work without ReferenceError
	const { default: xpLevelUp } = await import('../plugins/xp-levelup.js');
	await xpLevelUp.call(sock, mBase, { conn: sock });
	assert.ok(sent.some((s) => /more EXP needed|Level Up/i.test(s.content?.text || '')));

	// 6. gp.js & owner-dfp.js reject path traversal
	const { default: gpPlugin } = await import('../plugins/gp.js');
	await assert.rejects(() => gpPlugin.call(sock, mBase, { conn: sock, text: '../config.js', usedPrefix: '.', command: 'gp' }), /Invalid/i);
	const { default: dfpPlugin } = await import('../plugins/owner-dfp.js');
	await assert.rejects(() => dfpPlugin.call(sock, mBase, { conn: sock, args: ['../config.js'], usedPrefix: '.', command: 'dfp' }), /Invalid/i);

	// 7. fakecall.js renders valid PNG locally via @napi-rs/canvas
	const { renderFakeCallImage } = await import('../plugins/fakecall.js');
	const callPng = await renderFakeCallImage({ name: 'Test User', duration: '01:23', avatarBuffer: null, ios: true });
	assert.ok(Buffer.isBuffer(callPng) && callPng.length > 1000);
	const callDims = sizeOf(callPng);
	assert.equal(callDims.type, 'png');
	assert.equal(callDims.width, 720);
	assert.equal(callDims.height, 1280);

	// 8. welcome.js & ترحيب.js do not shadow each other; ترحيب.js handles .welcome on and empty stubParameters
	const { default: welcomeTestPlugin } = await import('../plugins/welcome.js');
	const { default: arWelcomePlugin } = await import('../plugins/ترحيب.js');
	assert.equal(welcomeTestPlugin.command.test('welcome'), false);
	assert.equal(welcomeTestPlugin.command.test('one'), false);
	assert.equal(welcomeTestPlugin.command.test('testwelcome'), true);
	assert.equal(arWelcomePlugin.command.test('welcome'), true);
	assert.equal(arWelcomePlugin.command.test('one'), true);
	await arWelcomePlugin.call(sock, mBase, { conn: sock, usedPrefix: '.', command: 'welcome', args: ['on'] });
	assert.equal(global.db.data.chats[grpJid].welcome, true);
	await assert.doesNotReject(() => arWelcomePlugin.before.call(sock, { chat: grpJid, messageStubType: 27, messageStubParameters: undefined }, { conn: sock }));

	// 9. fun-dare & down-tiktok handle valid array JSON and non-JSON upstream errors cleanly
	const origFetch = global.fetch;
	try {
		global.fetch = async (url) => {
			if (String(url).includes('dare.json')) {
				return new Response(JSON.stringify(['Test dare prompt']), { status: 200, headers: { 'Content-Type': 'application/json' } });
			}
			return new Response('<html>502 Bad Gateway</html>', { status: 502 });
		};
		const { default: darePlugin } = await import('../plugins/fun-dare.js');
		await darePlugin.call(sock, mBase);
		assert.ok(sent.some((s) => s.content?.text === 'Test dare prompt'));

		const { default: ttPlugin } = await import('../plugins/down-tiktok.js');
		await ttPlugin.call(sock, mBase, { conn: sock, text: 'https://vt.tiktok.com/ZTest123/', usedPrefix: '.', command: 'tt' });
		assert.ok(sent.some((s) => /non-JSON response/i.test(s.content?.text || '')));
	} finally {
		global.fetch = origFetch;
	}

	// 10. جميع_الاوامر.js skips disabled plugins and uses arrayBuffer cleanly
	const origFetchAllCmds = global.fetch;
	const origPluginsRef = global.plugins;
	try {
		global.plugins = {
			'active.js': { help: ['activecmd'], tags: ['tools'], disabled: false },
			'disabled.js': { help: ['hiddencmd'], tags: ['tools'], disabled: true },
		};
		global.fetch = async () => new Response(Buffer.from('thumb'), { status: 200 });
		const { default: allCmdsAr } = await import('../plugins/جميع_الاوامر.js');
		await allCmdsAr.call(sock, mBase, { conn: sock, usedPrefix: '.' });
		const menuOut = sent[sent.length - 1]?.content?.text || '';
		assert.ok(menuOut.includes('.activecmd'));
		assert.ok(!menuOut.includes('.hiddencmd'));
	} finally {
		global.fetch = origFetchAllCmds;
		global.plugins = origPluginsRef;
	}
});

test('lib/ytdl.js parses Netscape cookies, injects visitorData, and recovers when clients hit bot-check', async () => {
	const { default: axios } = await import('axios');
	const { downloadYouTubeMedia, parseNetscapeCookies, extractYouTubeId } = await import('../lib/ytdl.js');

	assert.equal(extractYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share'), 'dQw4w9WgXcQ');
	const parsed = parseNetscapeCookies(
		'# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1999999999\tSAPISID\tabc123\n.example.com\tTRUE\t/\tFALSE\t0\tIGNORE\t1\n.google.com\tTRUE\t/\tTRUE\t1999999999\tNID\txyz'
	);
	assert.equal(parsed, 'SAPISID=abc123; NID=xyz');

	const origPost = axios.post;
	const origGet = axios.get;
	const seenClients = [];
	try {
		axios.post = async (url, body) => {
			if (String(url).includes('visitor_id')) {
				return { data: { responseContext: { visitorData: 'TEST_VISITOR_DATA_123' } } };
			}
			const cName = body?.context?.client?.clientName;
			seenClients.push({ cName, visitorData: body?.context?.client?.visitorData });
			// First client (ANDROID_VR 1.60.19) simulates transient bot-check, second (ANDROID_VR_ALT 1.57.29) succeeds
			if (body?.context?.client?.clientVersion === '1.60.19') {
				return {
					data: {
						playabilityStatus: { status: 'LOGIN_REQUIRED', reason: "Sign in to confirm you're not a bot" },
					},
				};
			}
			return {
				data: {
					playabilityStatus: { status: 'OK' },
					videoDetails: { title: 'Recovered Track', author: 'Artist', lengthSeconds: '180', viewCount: '5000' },
					streamingData: {
						adaptiveFormats: [
							{ url: 'https://cdn.example.test/audio.m4a', mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 128000 },
						],
						formats: [],
					},
				},
			};
		};
		axios.get = async (url) => {
			assert.equal(url, 'https://cdn.example.test/audio.m4a');
			return { data: Buffer.from('FAKE_M4A_AUDIO_BYTES') };
		};

		const dl = await downloadYouTubeMedia('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'audio');
		assert.equal(dl.status, true);
		assert.equal(dl.title, 'Recovered Track');
		assert.equal(dl.ext, 'm4a');
		assert.equal(dl.buffer.toString(), 'FAKE_M4A_AUDIO_BYTES');
		assert.ok(seenClients.length >= 2);
		assert.equal(seenClients[0].cName, 'ANDROID_VR');
		assert.equal(seenClients[0].visitorData, 'TEST_VISITOR_DATA_123');
	} finally {
		axios.post = origPost;
		axios.get = origGet;
	}
});


