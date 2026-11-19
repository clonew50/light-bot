import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInteractiveButtonId, normalizeButtons, installInteractiveButtonShim } from '../system/buttonFix.js';

test('extractInteractiveButtonId prioritizes id over displayText for nativeFlowResponseMessage', () => {
  const m = {
    body: '✊ حجر',
    message: {
      interactiveResponseMessage: {
        nativeFlowResponseMessage: {
          paramsJson: JSON.stringify({ displayText: '✊ حجر', id: '.rps rock' })
        }
      }
    }
  };
  const ctx = { text: '✊ حجر' };
  const id = extractInteractiveButtonId(m, ctx);
  assert.equal(id, '.rps rock');
  assert.equal(m.body, '.rps rock');
  assert.equal(ctx.text, '.rps rock');
});

test('extractInteractiveButtonId handles listResponseMessage and buttonsResponseMessage', () => {
  const mList = {
    body: 'مشاري العفاسي',
    message: {
      listResponseMessage: {
        singleSelectReply: { selectedRowId: '.قران setreciter|hssr' }
      }
    }
  };
  assert.equal(extractInteractiveButtonId(mList), '.قران setreciter|hssr');
  assert.equal(mList.body, '.قران setreciter|hssr');

  const mBtn = {
    body: 'Option',
    message: {
      buttonsResponseMessage: { selectedButtonId: '.menu 9' }
    }
  };
  assert.equal(extractInteractiveButtonId(mBtn), '.menu 9');
  assert.equal(mBtn.body, '.menu 9');
});

test('normalizeButtons converts legacy and shorthand buttons cleanly', () => {
  const res = normalizeButtons([
    { buttonId: '.rps rock', buttonText: { displayText: '✊ حجر' } },
    { name: 'quick_reply', params: { display_text: '✋ ورقة', id: '.rps paper' } }
  ]);
  assert.equal(res.length, 2);
  assert.equal(res[0].name, 'quick_reply');
  assert.equal(res[0].params.id, '.rps rock');
  assert.equal(res[1].params.id, '.rps paper');
});

test('installInteractiveButtonShim converts sendMessage({ text, buttons }) into relayMessage with biz native_flow node', async () => {
  const relayed = [];
  const sentOrig = [];
  const sock = {
    user: { id: '201000000000:1@s.whatsapp.net' },
    sendMessage: async (jid, content, opts) => { sentOrig.push({ jid, content, opts }); },
    relayMessage: async (jid, msg, opts) => { relayed.push({ jid, msg, opts }); }
  };

  installInteractiveButtonShim(sock);
  // Idempotent second call must not double-wrap
  installInteractiveButtonShim(sock);

  await sock.sendMessage('201000000001@s.whatsapp.net', {
    text: 'اختر حركتك:',
    buttons: [
      { name: 'quick_reply', params: { display_text: '✊ حجر', id: '.rps rock' } }
    ]
  });

  assert.equal(sentOrig.length, 0, 'did not send broken legacy buttonsMessage');
  assert.equal(relayed.length, 1, 'sent via relayMessage');
  const flow = relayed[0].msg.viewOnceMessage.message.interactiveMessage.nativeFlowMessage;
  assert.equal(flow.buttons.length, 1);
  assert.equal(flow.buttons[0].name, 'quick_reply');
  assert.ok(flow.buttons[0].buttonParamsJson.includes('.rps rock'));
  assert.equal(relayed[0].opts.additionalNodes[0].tag, 'biz');
  assert.equal(relayed[0].opts.additionalNodes[0].content[0].attrs.type, 'native_flow');

  // Plain text without buttons passes through normally
  await sock.sendMessage('201000000001@s.whatsapp.net', { text: 'hello' });
  assert.equal(sentOrig.length, 1);
  assert.equal(sentOrig[0].content.text, 'hello');
});
